/**
 * Edge Function: payment-webhook-handler
 * Webhook handler unificado para todos os gateways de pagamento
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-asaas-access-token, x-pagseguro-signature, x-stone-signature",
};

type PaymentStatus = "pending" | "confirmed" | "received" | "overdue" | "refunded" | "cancelled" | "failed";

interface WebhookResult {
  provider: string;
  charge_id: string;
  status: PaymentStatus;
  amount?: number;
  paid_at?: string;
}

function detectProvider(req: Request, body: unknown): string | null {
  const headers = Object.fromEntries(req.headers.entries());
  
  // Check headers first
  if (headers["x-asaas-access-token"]) return "asaas";
  if (headers["x-pagseguro-signature"]) return "pagseguro";
  if (headers["x-stone-signature"]) return "stone";

  // Check body structure
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  // Asaas: has "event" starting with PAYMENT_
  if (typeof data.event === "string" && data.event.startsWith("PAYMENT_")) {
    return "asaas";
  }

  // PagSeguro: has "charges" array or specific structure
  if (Array.isArray(data.charges) || data.reference_id) {
    return "pagseguro";
  }

  // Stone: has "event" and "data" object
  if (data.event && data.data && typeof data.data === "object") {
    return "stone";
  }

  return null;
}

function parseAsaasWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    event: string;
    payment?: {
      id: string;
      status: string;
      value: number;
      paymentDate?: string;
    };
  };

  if (!data.payment) return null;

  const statusMap: Record<string, PaymentStatus> = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    RECEIVED: "received",
    OVERDUE: "overdue",
    REFUNDED: "refunded",
    CANCELLED: "cancelled",
  };

  return {
    provider: "asaas",
    charge_id: data.payment.id,
    status: statusMap[data.payment.status] || "pending",
    amount: data.payment.value,
    paid_at: data.payment.paymentDate,
  };
}

function parsePagSeguroWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    id: string;
    charges?: Array<{
      id: string;
      status: string;
      amount: { value: number };
      paid_at?: string;
    }>;
  };

  const charge = data.charges?.[0];
  if (!charge) return null;

  const statusMap: Record<string, PaymentStatus> = {
    WAITING: "pending",
    IN_ANALYSIS: "pending",
    AUTHORIZED: "confirmed",
    PAID: "received",
    AVAILABLE: "received",
    REFUNDED: "refunded",
    CANCELED: "cancelled",
    DECLINED: "failed",
  };

  return {
    provider: "pagseguro",
    charge_id: charge.id,
    status: statusMap[charge.status] || "pending",
    amount: charge.amount.value / 100,
    paid_at: charge.paid_at,
  };
}

function parseStoneWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    event: string;
    data: {
      id: string;
      status: string;
      amount: number;
      paid_at?: string;
    };
  };

  if (!data.data) return null;

  const statusMap: Record<string, PaymentStatus> = {
    created: "pending",
    pending: "pending",
    approved: "confirmed",
    settled: "received",
    refunded: "refunded",
    cancelled: "cancelled",
    failed: "failed",
  };

  return {
    provider: "stone",
    charge_id: data.data.id,
    status: statusMap[data.data.status] || "pending",
    amount: data.data.amount / 100,
    paid_at: data.data.paid_at,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 100 webhook calls per minute per IP
    const requesterIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`payment-webhook:${requesterIp}`, 100, 60);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 60) },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const provider = detectProvider(req, body);

    if (!provider) {
      console.log("Unknown webhook provider:", JSON.stringify(body).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Unknown provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook based on provider
    let result: WebhookResult | null = null;
    switch (provider) {
      case "asaas":
        result = parseAsaasWebhook(body);
        break;
      case "pagseguro":
        result = parsePagSeguroWebhook(body);
        break;
      case "stone":
        result = parseStoneWebhook(body);
        break;
    }

    if (!result) {
      console.log("Could not parse webhook:", provider, JSON.stringify(body).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Could not parse webhook" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook received:", result);

    // Update split_payment_logs if exists
    const { data: splitLog } = await supabaseAdmin
      .from("split_payment_logs")
      .select("id, tenant_id, appointment_id, professional_id, split_amount")
      .eq("charge_id", result.charge_id)
      .maybeSingle();

    if (splitLog) {
      // Update split log status
      const newStatus = result.status === "received" ? "completed" : result.status;
      await supabaseAdmin
        .from("split_payment_logs")
        .update({
          status: newStatus,
          webhook_received_at: new Date().toISOString(),
          settled_at: result.status === "received" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", splitLog.id);

      // If payment received and split completed, create commission_payment record
      if (result.status === "received" && splitLog.professional_id) {
        // Check if commission_payment already exists
        const { data: existingCommission } = await supabaseAdmin
          .from("commission_payments")
          .select("id")
          .eq("appointment_id", splitLog.appointment_id)
          .eq("professional_id", splitLog.professional_id)
          .maybeSingle();

        if (!existingCommission) {
          await supabaseAdmin.from("commission_payments").insert({
            tenant_id: splitLog.tenant_id,
            professional_id: splitLog.professional_id,
            appointment_id: splitLog.appointment_id,
            amount: splitLog.split_amount,
            service_price: result.amount || 0,
            status: "paid",
            payment_date: new Date().toISOString(),
            notes: `Split automático via ${provider}`,
          });
        }
      }
    }

    // Update patient_invoices if exists
    const { data: invoice } = await supabaseAdmin
      .from("patient_invoices")
      .select("id")
      .eq("external_payment_id", result.charge_id)
      .maybeSingle();

    if (invoice) {
      const invoiceStatus = result.status === "received" ? "paid" : 
                           result.status === "cancelled" ? "cancelled" :
                           result.status === "refunded" ? "refunded" : "pending";
      
      await supabaseAdmin
        .from("patient_invoices")
        .update({
          status: invoiceStatus,
          paid_at: result.status === "received" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);
    }

    // Log webhook
    await supabaseAdmin.from("webhook_logs").insert({
      provider,
      event_type: result.status,
      payload: body,
      processed_at: new Date().toISOString(),
    }).catch(() => { /* table may not exist */ });

    return new Response(
      JSON.stringify({ success: true, processed: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
