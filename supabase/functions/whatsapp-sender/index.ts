import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";

const log = createLogger("WHATSAPP-SENDER");

type Body = {
  phone: string;
  message: string;
  tenant_id?: string;
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const auth = await getAuthenticatedUserWithTenant(req, cors);
  if (auth.error) return auth.error;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : auth.tenantId;

  if (!phone) {
    return new Response(JSON.stringify({ error: "phone é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: "message é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (tenantId !== auth.tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id inválido" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rl = await checkRateLimit(`whatsapp-sender:${tenantId}:${auth.user.id}`, 20, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiUrl = String((tenant as any).whatsapp_api_url || "").trim();
  const apiKey = String((tenant as any).whatsapp_api_key || "").trim();
  const instance = String((tenant as any).whatsapp_instance || "").trim();

  if (!apiUrl || !apiKey || !instance) {
    return new Response(
      JSON.stringify({
        error: "WhatsApp não configurado no tenant. Preencha URL, API Key e Instância em Configurações.",
        code: "missing_whatsapp_settings",
      }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;

  try {
    const evoRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const text = await evoRes.text();
    if (!evoRes.ok) {
      log("Evolution API error", { status: evoRes.status, body: text });
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao enviar mensagem", details: text }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Exception while calling Evolution API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({ success: false, error: "Falha ao conectar na Evolution API" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
