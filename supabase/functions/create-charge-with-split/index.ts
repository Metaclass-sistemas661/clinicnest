/**
 * Edge Function: create-charge-with-split
 * Cria cobrança com split automático usando o gateway configurado pelo tenant
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChargeRequest {
  tenant_id: string;
  appointment_id?: string;
  invoice_id?: string;
  amount: number;
  description: string;
  due_date: string;
  customer: {
    name: string;
    email: string;
    cpf?: string;
  };
  professional_id?: string;
  payment_methods?: ("pix" | "boleto" | "credit_card")[];
}

interface SplitConfig {
  professional_id: string;
  commission_percentage: number;
  recipient_id?: string;
  wallet_id?: string;
}

// Gateway implementations
async function createAsaasCharge(
  apiKey: string,
  environment: string,
  request: ChargeRequest,
  split?: SplitConfig
) {
  const baseUrl = environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  // Find or create customer
  const customersRes = await fetch(
    `${baseUrl}/customers?email=${encodeURIComponent(request.customer.email)}`,
    { headers: { "access_token": apiKey } }
  );
  const customers = await customersRes.json();
  
  let customerId: string;
  if (customers.data?.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const createRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": apiKey },
      body: JSON.stringify({
        name: request.customer.name,
        email: request.customer.email,
        cpfCnpj: request.customer.cpf?.replace(/\D/g, ""),
      }),
    });
    const created = await createRes.json();
    if (!created.id) throw new Error(created.errors?.[0]?.description || "Erro ao criar cliente");
    customerId = created.id;
  }

  // Determine billing type
  const billingType = request.payment_methods?.includes("pix")
    ? "PIX"
    : request.payment_methods?.includes("boleto")
    ? "BOLETO"
    : "UNDEFINED";

  // Build payment payload
  const payload: Record<string, unknown> = {
    customer: customerId,
    billingType,
    value: request.amount,
    dueDate: request.due_date,
    description: request.description,
    externalReference: request.appointment_id || request.invoice_id,
  };

  // Add split if configured
  if (split?.wallet_id && split.commission_percentage > 0) {
    const splitAmount = (request.amount * split.commission_percentage) / 100;
    payload.split = [{
      walletId: split.wallet_id,
      fixedValue: splitAmount,
    }];
  }

  const chargeRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "access_token": apiKey },
    body: JSON.stringify(payload),
  });
  const charge = await chargeRes.json();

  if (!charge.id) {
    throw new Error(charge.errors?.[0]?.description || "Erro ao criar cobrança");
  }

  // Get PIX QR code if applicable
  let pixData = null;
  if (billingType === "PIX") {
    try {
      const pixRes = await fetch(`${baseUrl}/payments/${charge.id}/pixQrCode`, {
        headers: { "access_token": apiKey },
      });
      pixData = await pixRes.json();
    } catch { /* PIX may not be ready */ }
  }

  return {
    charge_id: charge.id,
    status: charge.status,
    amount: charge.value,
    payment_url: charge.invoiceUrl,
    boleto_url: charge.bankSlipUrl,
    boleto_barcode: charge.nossoNumero,
    pix_qr_code: pixData?.encodedImage,
    pix_copy_paste: pixData?.payload,
    due_date: charge.dueDate,
    provider: "asaas",
  };
}

async function createPagSeguroCharge(
  apiKey: string,
  environment: string,
  request: ChargeRequest,
  split?: SplitConfig
) {
  const baseUrl = environment === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";

  const qrCodes = request.payment_methods?.includes("pix") ? [{
    amount: { value: Math.round(request.amount * 100) },
    expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }] : undefined;

  const boletos = request.payment_methods?.includes("boleto") ? [{
    amount: { value: Math.round(request.amount * 100) },
    due_date: request.due_date,
    instruction_lines: {
      line_1: request.description.substring(0, 75),
      line_2: "Não receber após vencimento",
    },
    holder: {
      name: request.customer.name,
      tax_id: request.customer.cpf?.replace(/\D/g, ""),
      email: request.customer.email,
    },
  }] : undefined;

  const payload: Record<string, unknown> = {
    reference_id: request.appointment_id || request.invoice_id,
    customer: {
      name: request.customer.name,
      email: request.customer.email,
      tax_id: request.customer.cpf?.replace(/\D/g, ""),
    },
    items: [{
      name: request.description.substring(0, 64),
      quantity: 1,
      unit_amount: Math.round(request.amount * 100),
    }],
    qr_codes: qrCodes,
    boletos,
  };

  // Add split if configured
  if (split?.recipient_id && split.commission_percentage > 0) {
    const splitAmount = Math.round((request.amount * split.commission_percentage) / 100 * 100);
    payload.splits = [{
      method: "FIXED",
      receivers: [{
        account: { id: split.recipient_id },
        amount: { value: splitAmount },
      }],
    }];
  }

  const chargeRes = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const charge = await chargeRes.json();

  if (!charge.id) {
    throw new Error(charge.error_messages?.[0]?.description || "Erro ao criar cobrança");
  }

  const pixQrCode = charge.qr_codes?.[0]?.links?.find((l: any) => l.media === "image/png")?.href;
  const boletoUrl = charge.boletos?.[0]?.links?.find((l: any) => l.media === "application/pdf")?.href;

  return {
    charge_id: charge.id,
    status: charge.status,
    amount: request.amount,
    pix_qr_code: pixQrCode,
    pix_copy_paste: charge.qr_codes?.[0]?.text,
    boleto_url: boletoUrl,
    boleto_barcode: charge.boletos?.[0]?.barcode,
    boleto_digitableline: charge.boletos?.[0]?.formatted_barcode,
    due_date: request.due_date,
    provider: "pagseguro",
  };
}

async function createStoneCharge(
  apiKey: string,
  environment: string,
  request: ChargeRequest,
  split?: SplitConfig
) {
  const baseUrl = environment === "production"
    ? "https://api.openbank.stone.com.br/api/v1"
    : "https://sandbox-api.openbank.stone.com.br/api/v1";

  const payload: Record<string, unknown> = {
    amount: Math.round(request.amount * 100),
    description: request.description,
    due_date: request.due_date,
    external_id: request.appointment_id || request.invoice_id,
    customer: {
      name: request.customer.name,
      email: request.customer.email,
      document: request.customer.cpf?.replace(/\D/g, ""),
    },
  };

  // Add split if configured
  if (split?.recipient_id && split.commission_percentage > 0) {
    payload.split_rules = [{
      recipient_id: split.recipient_id,
      type: "percentage",
      percentage: split.commission_percentage,
      charge_processing_fee: false,
    }];
  }

  const chargeRes = await fetch(`${baseUrl}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const charge = await chargeRes.json();

  if (!charge.id) {
    throw new Error(charge.message || "Erro ao criar cobrança");
  }

  return {
    charge_id: charge.id,
    status: charge.status,
    amount: charge.amount / 100,
    pix_qr_code: charge.pix_qr_code,
    pix_copy_paste: charge.pix_copy_paste,
    boleto_url: charge.boleto_url,
    boleto_barcode: charge.boleto_barcode,
    due_date: charge.due_date,
    provider: "stone",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ChargeRequest = await req.json();

    // Get gateway config
    const { data: gateway, error: gatewayError } = await supabaseAdmin
      .from("tenant_payment_gateways")
      .select("*")
      .eq("tenant_id", body.tenant_id)
      .eq("is_active", true)
      .eq("validation_status", "valid")
      .maybeSingle();

    if (gatewayError || !gateway) {
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado", code: "no_gateway" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get split config if professional_id provided and split enabled
    let splitConfig: SplitConfig | undefined;
    if (body.professional_id && gateway.is_split_enabled) {
      // Get professional's payment account
      const { data: paymentAccount } = await supabaseAdmin
        .from("professional_payment_accounts")
        .select("*")
        .eq("tenant_id", body.tenant_id)
        .eq("professional_id", body.professional_id)
        .eq("gateway_id", gateway.id)
        .eq("is_verified", true)
        .maybeSingle();

      if (paymentAccount) {
        // Get commission rule
        const { data: commissionRule } = await supabaseAdmin
          .from("commission_rules")
          .select("value, calculation_type")
          .eq("tenant_id", body.tenant_id)
          .eq("professional_id", body.professional_id)
          .eq("is_active", true)
          .eq("calculation_type", "percentage")
          .order("priority", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (commissionRule) {
          splitConfig = {
            professional_id: body.professional_id,
            commission_percentage: commissionRule.value,
            recipient_id: paymentAccount.recipient_id,
            wallet_id: paymentAccount.wallet_id,
          };
        }
      }
    }

    // Create charge based on provider
    let result;
    switch (gateway.provider) {
      case "asaas":
        result = await createAsaasCharge(
          gateway.api_key_encrypted,
          gateway.environment,
          body,
          splitConfig
        );
        break;
      case "pagseguro":
        result = await createPagSeguroCharge(
          gateway.api_key_encrypted,
          gateway.environment,
          body,
          splitConfig
        );
        break;
      case "stone":
        result = await createStoneCharge(
          gateway.api_key_encrypted,
          gateway.environment,
          body,
          splitConfig
        );
        break;
      default:
        throw new Error(`Provider ${gateway.provider} não suportado`);
    }

    // Log split payment if applicable
    if (splitConfig) {
      const splitAmount = (body.amount * splitConfig.commission_percentage) / 100;
      await supabaseAdmin.from("split_payment_logs").insert({
        tenant_id: body.tenant_id,
        appointment_id: body.appointment_id,
        charge_id: result.charge_id,
        provider: gateway.provider,
        professional_id: splitConfig.professional_id,
        total_amount: body.amount,
        split_amount: splitAmount,
        clinic_amount: body.amount - splitAmount,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        split_enabled: !!splitConfig,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating charge:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao criar cobrança",
        code: "charge_failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
