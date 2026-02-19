/**
 * asaas-pix — Criação de cobranças PIX via Asaas
 *
 * POST /functions/v1/asaas-pix
 * Body: {
 *   action: "create_charge" | "get_qrcode" | "cancel_charge",
 *   // create_charge:
 *   customer_name?: string,
 *   customer_cpf_cnpj?: string,
 *   customer_email?: string,
 *   value?: number,
 *   due_date?: string,         // YYYY-MM-DD
 *   description?: string,
 *   // get_qrcode / cancel_charge:
 *   charge_id?: string,
 * }
 *
 * Env secrets required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   ASAAS_API_KEY   — chave de API Asaas do tenant
 *
 * Optionally per-tenant (read from tenants.asaas_api_key if column exists):
 *   Neste MVP, a chave é única por deployment (uma conta Asaas).
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";

const log = createLogger("ASAAS-PIX");

const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

type CreateChargeBody = {
  action: "create_charge";
  customer_name: string;
  customer_cpf_cnpj?: string;
  customer_email?: string;
  value: number;
  due_date: string;
  description?: string;
};

type GetQrcodeBody = {
  action: "get_qrcode";
  charge_id: string;
};

type CancelChargeBody = {
  action: "cancel_charge";
  charge_id: string;
};

type RequestBody = CreateChargeBody | GetQrcodeBody | CancelChargeBody;

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.description ?? data?.description ?? "Erro Asaas");
  }
  return data;
}

async function ensureAsaasCustomer(
  apiKey: string,
  name: string,
  cpfCnpj?: string,
  email?: string,
): Promise<string> {
  // Try to find existing customer by cpfCnpj
  if (cpfCnpj) {
    const search = await asaasRequest(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, "GET", apiKey);
    if (search?.data?.length > 0) {
      return search.data[0].id as string;
    }
  }

  // Create new customer
  const created = await asaasRequest("/customers", "POST", apiKey, {
    name,
    cpfCnpj: cpfCnpj ?? undefined,
    email: email ?? undefined,
  });
  return created.id as string;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate user
    const { error: authError, tenant_id } = await getAuthenticatedUserWithTenant(req, supabase);
    if (authError || !tenant_id) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get Asaas API key: first try tenant column, then env secret
    let apiKey = Deno.env.get("ASAAS_API_KEY") ?? "";

    // Try to fetch tenant-specific key if column exists
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("asaas_api_key")
      .eq("id", tenant_id)
      .single();
    if (tenantRow?.asaas_api_key) {
      apiKey = tenantRow.asaas_api_key as string;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Chave Asaas não configurada. Configure em Configurações do Salão." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as RequestBody;

    if (body.action === "create_charge") {
      const { customer_name, customer_cpf_cnpj, customer_email, value, due_date, description } = body;

      if (!customer_name || !value || !due_date) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: customer_name, value, due_date" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      log.info("Creating Asaas customer...");
      const customerId = await ensureAsaasCustomer(apiKey, customer_name, customer_cpf_cnpj, customer_email);

      log.info("Creating PIX charge...");
      const charge = await asaasRequest("/payments", "POST", apiKey, {
        customer: customerId,
        billingType: "PIX",
        value,
        dueDate: due_date,
        description: description ?? "Cobrança BeautyGest",
      });

      log.info("Fetching PIX QR code...");
      const qrcode = await asaasRequest(`/payments/${charge.id}/pixQrCode`, "GET", apiKey);

      return new Response(JSON.stringify({
        success: true,
        charge_id: charge.id,
        invoice_url: charge.invoiceUrl ?? null,
        pix_encoded_image: qrcode.encodedImage ?? null,
        pix_copy_paste: qrcode.payload ?? null,
        expiration_date: qrcode.expirationDate ?? null,
        status: charge.status,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (body.action === "get_qrcode") {
      const { charge_id } = body;
      if (!charge_id) {
        return new Response(JSON.stringify({ error: "charge_id obrigatório" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const [charge, qrcode] = await Promise.all([
        asaasRequest(`/payments/${charge_id}`, "GET", apiKey),
        asaasRequest(`/payments/${charge_id}/pixQrCode`, "GET", apiKey),
      ]);

      return new Response(JSON.stringify({
        success: true,
        charge_id,
        status: charge.status,
        pix_encoded_image: qrcode.encodedImage ?? null,
        pix_copy_paste: qrcode.payload ?? null,
        expiration_date: qrcode.expirationDate ?? null,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (body.action === "cancel_charge") {
      const { charge_id } = body;
      if (!charge_id) {
        return new Response(JSON.stringify({ error: "charge_id obrigatório" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      await asaasRequest(`/payments/${charge_id}`, "DELETE", apiKey);
      return new Response(JSON.stringify({ success: true, charge_id }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("asaas-pix error", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
