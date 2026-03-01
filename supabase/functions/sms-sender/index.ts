import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("SMS-SENDER");

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SmsProvider = "zenvia" | "twilio" | "vonage" | "generic";

interface TenantSmsConfig {
  id: string;
  sms_provider: SmsProvider;
  sms_api_key: string;
  sms_sender: string;
  name: string;
}

interface SendSmsPayload {
  phone: string;
  message: string;
  tenant_id?: string;
}

interface SmsResult {
  ok: boolean;
  provider: string;
  details?: string;
}

// ─── Normalizar telefone BR ──────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}

// ─── Provedores SMS ──────────────────────────────────────────────────────────

async function sendViaZenvia(
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<SmsResult> {
  try {
    const res = await fetch("https://api.zenvia.com/v2/channels/sms/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": apiKey,
      },
      body: JSON.stringify({
        from: sender,
        to: phone,
        contents: [{ type: "text", text: message }],
      }),
    });
    const text = await res.text();
    return res.ok ? { ok: true, provider: "zenvia" } : { ok: false, provider: "zenvia", details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, provider: "zenvia", details: e instanceof Error ? e.message : String(e) };
  }
}

async function sendViaTwilio(
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<SmsResult> {
  // apiKey format: "ACCOUNT_SID:AUTH_TOKEN"
  const [accountSid, authToken] = apiKey.split(":");
  if (!accountSid || !authToken) {
    return { ok: false, provider: "twilio", details: "invalid_api_key_format" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: sender.startsWith("+") ? sender : `+${sender}`,
      To: phone.startsWith("+") ? phone : `+${phone}`,
      Body: message,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const text = await res.text();
    return res.ok ? { ok: true, provider: "twilio" } : { ok: false, provider: "twilio", details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, provider: "twilio", details: e instanceof Error ? e.message : String(e) };
  }
}

async function sendViaVonage(
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<SmsResult> {
  // apiKey format: "API_KEY:API_SECRET"
  const [vonageKey, vonageSecret] = apiKey.split(":");
  if (!vonageKey || !vonageSecret) {
    return { ok: false, provider: "vonage", details: "invalid_api_key_format" };
  }

  try {
    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: vonageKey,
        api_secret: vonageSecret,
        from: sender,
        to: phone,
        text: message,
        type: "unicode",
      }),
    });
    const json = await res.json();
    const ok = json?.messages?.[0]?.status === "0";
    return ok ? { ok: true, provider: "vonage" } : { ok: false, provider: "vonage", details: JSON.stringify(json).slice(0, 500) };
  } catch (e) {
    return { ok: false, provider: "vonage", details: e instanceof Error ? e.message : String(e) };
  }
}

async function sendViaGeneric(
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<SmsResult> {
  // Generic webhook-based SMS provider
  // apiKey should be the full webhook URL, sender is an optional header
  try {
    const res = await fetch(apiKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sender ? { "X-Sender": sender } : {}),
      },
      body: JSON.stringify({ phone, message, sender }),
    });
    const text = await res.text();
    return res.ok ? { ok: true, provider: "generic" } : { ok: false, provider: "generic", details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, provider: "generic", details: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function sendSms(
  provider: SmsProvider,
  apiKey: string,
  sender: string,
  phone: string,
  message: string,
): Promise<SmsResult> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 12) {
    return { ok: false, provider, details: "invalid_phone_number" };
  }

  switch (provider) {
    case "zenvia":
      return sendViaZenvia(apiKey, sender, normalized, message);
    case "twilio":
      return sendViaTwilio(apiKey, sender, normalized, message);
    case "vonage":
      return sendViaVonage(apiKey, sender, normalized, message);
    case "generic":
      return sendViaGeneric(apiKey, sender, normalized, message);
    default:
      return { ok: false, provider: provider ?? "unknown", details: "unsupported_provider" };
  }
}

// ─── Edge Function ────────────────────────────────────────────────────────────

type SelectResult<T> = { data: T; error?: unknown };

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Servidor não configurado" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Authenticate: service role or authenticated user with tenant
  const authHeader = req.headers.get("Authorization") ?? "";
  let tenantId: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Get tenant
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    tenantId = role?.tenant_id ?? null;
  }

  try {
    const payload: SendSmsPayload = await req.json();
    const { phone, message } = payload;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone e message são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const effectiveTenantId = payload.tenant_id ?? tenantId;
    if (!effectiveTenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Get tenant SMS config
    const { data: tenant, error: tenantErr } = (await supabaseAdmin
      .from("tenants")
      .select("id, name, sms_provider, sms_api_key, sms_sender")
      .eq("id", effectiveTenantId)
      .maybeSingle()) as unknown as SelectResult<TenantSmsConfig | null>;

    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const provider = (tenant.sms_provider ?? "zenvia") as SmsProvider;
    const apiKey = (tenant.sms_api_key ?? "").trim();
    const sender = (tenant.sms_sender ?? "").trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "SMS não configurado no tenant. Configure provedor, API Key e remetente em Configurações.",
          code: "missing_sms_settings",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const result = await sendSms(provider, apiKey, sender, phone, message);

    if (!result.ok) {
      log("SMS send failed", { provider, phone: phone.slice(0, 5) + "***", details: result.details });
    }

    // Log the result
    await supabaseAdmin.from("notification_logs").insert({
      tenant_id: effectiveTenantId,
      recipient_type: "patient",
      channel: "sms",
      template_type: "manual",
      status: result.ok ? "sent" : "failed",
      error_details: result.details,
      metadata: { provider, phone_prefix: phone.slice(0, 5) },
    });

    return new Response(
      JSON.stringify({ success: result.ok, provider: result.provider, details: result.details }),
      { status: result.ok ? 200 : 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    log("Exception", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
