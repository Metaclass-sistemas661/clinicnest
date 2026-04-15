/**
 * sms-sender — Cloud Run handler */

import { Request, Response } from 'express';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function smsSender(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
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
      message: string): Promise<SmsResult> {
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
      } catch (e: any) {
        return { ok: false, provider: "zenvia", details: e instanceof Error ? e.message : String(e) };
      }
    }

    async function sendViaTwilio(
      apiKey: string,
      sender: string,
      phone: string,
      message: string): Promise<SmsResult> {
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
      } catch (e: any) {
        return { ok: false, provider: "twilio", details: e instanceof Error ? e.message : String(e) };
      }
    }

    async function sendViaVonage(
      apiKey: string,
      sender: string,
      phone: string,
      message: string): Promise<SmsResult> {
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
        const json = await res.json() as any;
        const ok = json?.messages?.[0]?.status === "0";
        return ok ? { ok: true, provider: "vonage" } : { ok: false, provider: "vonage", details: JSON.stringify(json).slice(0, 500) };
      } catch (e: any) {
        return { ok: false, provider: "vonage", details: e instanceof Error ? e.message : String(e) };
      }
    }

    async function sendViaGeneric(
      apiKey: string,
      sender: string,
      phone: string,
      message: string): Promise<SmsResult> {
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
      } catch (e: any) {
        return { ok: false, provider: "generic", details: e instanceof Error ? e.message : String(e) };
      }
    }

    // ─── Dispatcher ──────────────────────────────────────────────────────────────

    async function sendSms(
      provider: SmsProvider,
      apiKey: string,
      sender: string,
      phone: string,
      message: string): Promise<SmsResult> {
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
      // CORS handled by middleware

      if (req.method === "OPTIONS") return res.status(204).end();

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }
      if (!(process.env.CLOUD_RUN_URL || 'https://clinicnest-api-294286835536.southamerica-east1.run.app') || !process.env.INTERNAL_API_KEY || '') {
        return res.status(500).json({ error: "Servidor não configurado" });
      }

      // Using shared database client
      // Authenticate: service role or authenticated user with tenant
      const authHeader = (req.headers['authorization'] as string) ?? "";
      let tenantId: string | null = null;

      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error } = (await authAdmin.getUser(token) as any);
        if (error || !user) {
          return res.status(401).json({ error: "Não autorizado" });
        }
        // Get tenant
        const { data: role } = await db.from("user_roles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();
        tenantId = role?.tenant_id ?? null;
      }

      try {
        const payload: SendSmsPayload = req.body;
        const { phone, message } = payload;

        if (!phone || !message) {
          return res.status(400).json({ error: "phone e message são obrigatórios" });
        }

        const effectiveTenantId = payload.tenant_id ?? tenantId;
        if (!effectiveTenantId) {
          return res.status(400).json({ error: "tenant_id é obrigatório" });
        }

        // Get tenant SMS config
        const { data: tenant, error: tenantErr } = (await db.from("tenants")
          .select("id, name, sms_provider, sms_api_key, sms_sender")
          .eq("id", effectiveTenantId)
          .maybeSingle()) as unknown as SelectResult<TenantSmsConfig | null>;

        if (tenantErr || !tenant) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }

        const provider = (tenant.sms_provider ?? "zenvia") as SmsProvider;
        const apiKey = (tenant.sms_api_key ?? "").trim();
        const sender = (tenant.sms_sender ?? "").trim();

        if (!apiKey) {
          return res.status(400).json({
              error: "SMS não configurado no tenant. Configure provedor, API Key e remetente em Configurações.",
              code: "missing_sms_settings",
            });
        }

        const result = await sendSms(provider, apiKey, sender, phone, message);

        if (!result.ok) {
          log("SMS send failed", { provider, phone: phone.slice(0, 5) + "***", details: result.details });
        }

        // Log the result
        await db.from("notification_logs").insert({
          tenant_id: effectiveTenantId,
          recipient_type: "patient",
          channel: "sms",
          template_type: "manual",
          status: result.ok ? "sent" : "failed",
          error_details: result.details,
          metadata: { provider, phone_prefix: phone.slice(0, 5) },
        });

        return res.status(result.ok ? 200 : 502).json({ success: result.ok, provider: result.provider, details: result.details });
      } catch (error: any) {
        log("Exception", { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ error: "Erro interno" });
      }
  } catch (err: any) {
    console.error(`[sms-sender] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
