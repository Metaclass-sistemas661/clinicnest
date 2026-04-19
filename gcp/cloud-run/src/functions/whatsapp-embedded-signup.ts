/**
 * whatsapp-embedded-signup — Cloud Run handler
 *
 * Handles the server-side of Meta WhatsApp Embedded Signup flow.
 *
 * Actions:
 *   POST /api/whatsapp-embedded-signup { action: "exchange-token", code }
 *     → Exchanges the auth code from FB SDK for a business token, fetches WABA + phone info,
 *       subscribes webhooks, registers the phone number, and saves to tenants table.
 */

import { Request, Response } from 'express';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
import { createTemplatesForWaba, getTemplateStatuses } from './whatsapp-templates';

const log = createLogger("WHATSAPP-EMBEDDED-SIGNUP");
const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// App credentials (from environment / Secret Manager)
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function metaGet(url: string, token?: string): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    log("metaGet error", { url: url.replace(/access_token=[^&]+/, 'access_token=***'), error: String(err) });
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

async function metaPost(url: string, token: string, body?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    log("metaPost error", { url, error: String(err) });
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

// ─── Token Exchange ──────────────────────────────────────────────────────────

async function exchangeCodeForToken(code: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  // GET /oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=CODE
  const url = `${META_API_BASE}/oauth/access_token?client_id=${encodeURIComponent(META_APP_ID)}&client_secret=${encodeURIComponent(META_APP_SECRET)}&code=${encodeURIComponent(code)}`;
  const result = await metaGet(url);

  if (!result.ok || !result.data?.access_token) {
    log("Token exchange failed", { status: result.status, data: result.data });
    return { ok: false, error: result.data?.error?.message || "Falha ao trocar código por token" };
  }

  return { ok: true, token: result.data.access_token };
}

// ─── Subscribe Webhooks on WABA ──────────────────────────────────────────────

async function subscribeWebhooks(wabaId: string, businessToken: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`;
  const result = await metaPost(url, businessToken);

  if (!result.ok) {
    log("Webhook subscription failed", { wabaId, data: result.data });
    return { ok: false, error: result.data?.error?.message || "Falha ao inscrever webhooks" };
  }

  log("Webhooks subscribed", { wabaId });
  return { ok: true };
}

// ─── Register Phone Number for Cloud API ─────────────────────────────────────

async function registerPhoneNumber(phoneNumberId: string, businessToken: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}/register`;
  const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit random PIN
  const result = await metaPost(url, businessToken, {
    messaging_product: "whatsapp",
    pin,
  });

  if (!result.ok) {
    // Already registered is OK
    const errMsg = result.data?.error?.message || "";
    if (errMsg.includes("already registered") || result.data?.error?.code === 10) {
      log("Phone already registered, continuing", { phoneNumberId });
      return { ok: true };
    }
    log("Phone registration failed", { phoneNumberId, data: result.data });
    return { ok: false, error: errMsg || "Falha ao registrar número de telefone" };
  }

  log("Phone registered", { phoneNumberId });
  return { ok: true };
}

// ─── Fetch Phone Number Details ──────────────────────────────────────────────

async function getPhoneNumberInfo(phoneNumberId: string, token: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`;
  const result = await metaGet(url, token);
  if (!result.ok) return { ok: false, error: result.data?.error?.message || "Falha ao obter info do telefone" };
  return { ok: true, data: result.data };
}

// ─── HTTP Handler ────────────────────────────────────────────────────────────

export async function whatsappEmbeddedSignup(req: Request, res: Response) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    // Auth — user must be logged in
    const authAdmin = createAuthAdmin();
    const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', '');
    const r = await authAdmin.getUser(token);
    const user = r.data?.user;
    const tenantId = (user as any)?.user_metadata?.tenant_id;
    if (!user || !tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { action, code, phone_number_id, waba_id } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: "action é obrigatório" });
    }

    // Validate app credentials exist
    if (!META_APP_ID || !META_APP_SECRET) {
      log("Missing META_APP_ID or META_APP_SECRET env vars");
      return res.status(500).json({ error: "Configuração do servidor incompleta (APP_ID/APP_SECRET)" });
    }

    const db = createDbClient();

    switch (action) {
      case "exchange-token": {
        // Expects: code (from FB SDK), phone_number_id, waba_id (from session message event)
        if (!code) {
          return res.status(400).json({ error: "code é obrigatório" });
        }
        if (!phone_number_id || !waba_id) {
          return res.status(400).json({ error: "phone_number_id e waba_id são obrigatórios" });
        }

        log("Starting Embedded Signup flow", { tenantId, waba_id, phone_number_id });

        // Step 1: Exchange code for business token
        const tokenResult = await exchangeCodeForToken(code);
        if (!tokenResult.ok || !tokenResult.token) {
          return res.status(400).json({ ok: false, error: tokenResult.error });
        }
        const businessToken = tokenResult.token;
        log("Token exchanged successfully", { tenantId });

        // Step 2: Subscribe our app to webhooks on the customer's WABA
        const webhookResult = await subscribeWebhooks(waba_id, businessToken);
        if (!webhookResult.ok) {
          log("Webhook subscription failed but continuing", { error: webhookResult.error });
          // Non-blocking: continue even if webhook subscription fails
        }

        // Step 3: Register the phone number for Cloud API usage
        const registerResult = await registerPhoneNumber(phone_number_id, businessToken);
        if (!registerResult.ok) {
          log("Phone registration failed but continuing", { error: registerResult.error });
          // Non-blocking: phone might already be registered
        }

        // Step 4: Fetch phone number details
        const phoneInfo = await getPhoneNumberInfo(phone_number_id, businessToken);

        // Step 5: Save everything to the tenants table
        const { error: dbError } = await db.from("tenants")
          .update({
            whatsapp_phone_number_id: phone_number_id,
            whatsapp_access_token: businessToken,
            whatsapp_business_account_id: waba_id,
          })
          .eq("id", tenantId);

        if (dbError) {
          log("DB save failed", { tenantId, error: String(dbError) });
          return res.status(500).json({ ok: false, error: "Falha ao salvar credenciais no banco de dados" });
        }

        // Auto-seed chatbot_settings if not exists
        const { data: existing } = await db.from("chatbot_settings")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!existing) {
          const { data: tenant } = await db.from("tenants")
            .select("name")
            .eq("id", tenantId)
            .maybeSingle();

          const clinicName = (tenant as { name?: string } | null)?.name ?? "nossa clínica";

          await db.from("chatbot_settings").insert({
            tenant_id: tenantId,
            is_active: true,
            welcome_message: `Olá! 👋 Bem-vindo(a) à *${clinicName}*. Como posso ajudá-lo(a)?`,
            menu_message: "Escolha uma opção:",
            outside_hours_message: `Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.\nDeixe sua mensagem que retornaremos assim que possível. 😊`,
            business_hours_start: "08:00",
            business_hours_end: "18:00",
            business_days: [1, 2, 3, 4, 5],
            auto_confirm_booking: false,
            max_future_days: 30,
          });
          log("Chatbot settings auto-created", { tenantId });
        }

        // Step 6: Create Meta Message Templates on the tenant's WABA
        log("Provisioning message templates", { tenantId, waba_id });
        const templateResult = await createTemplatesForWaba(waba_id, businessToken);
        log("Template provisioning done", {
          tenantId,
          created: templateResult.created.length,
          skipped: templateResult.skipped.length,
          failed: templateResult.failed.length,
        });

        const webhookUrl = `${process.env.CLOUD_RUN_URL || ''}/api/webhooks/whatsapp-chatbot`;
        const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

        log("Embedded Signup completed", {
          tenantId,
          waba_id,
          phone_number_id,
          verifiedName: phoneInfo?.data?.verified_name,
        });

        return res.status(200).json({
          ok: true,
          action: "embedded-signup-complete",
          phoneInfo: phoneInfo?.data || null,
          webhookUrl,
          verifyToken,
          webhookSubscribed: webhookResult.ok,
          phoneRegistered: registerResult.ok,
          templates: {
            created: templateResult.created,
            skipped: templateResult.skipped,
            failed: templateResult.failed,
          },
        });
      }

      case "get-template-status": {
        // Returns the approval status of all system templates
        const { data: tenant } = await db.from("tenants")
          .select("whatsapp_business_account_id, whatsapp_access_token")
          .eq("id", tenantId)
          .maybeSingle();

        const wabaIdVal = (tenant as any)?.whatsapp_business_account_id;
        const tokenVal = (tenant as any)?.whatsapp_access_token;

        if (!wabaIdVal || !tokenVal) {
          return res.status(400).json({
            ok: false,
            error: "WhatsApp Business n\u00e3o configurado. Fa\u00e7a o Embedded Signup primeiro.",
          });
        }

        const statuses = await getTemplateStatuses(wabaIdVal, tokenVal);
        return res.status(200).json({ ok: true, templates: statuses });
      }

      case "provision-templates": {
        // Re-create templates (idempotent) — useful if some failed during signup
        const { data: tenant } = await db.from("tenants")
          .select("whatsapp_business_account_id, whatsapp_access_token")
          .eq("id", tenantId)
          .maybeSingle();

        const wId = (tenant as any)?.whatsapp_business_account_id;
        const tknVal = (tenant as any)?.whatsapp_access_token;

        if (!wId || !tknVal) {
          return res.status(400).json({
            ok: false,
            error: "WhatsApp Business n\u00e3o configurado.",
          });
        }

        const provResult = await createTemplatesForWaba(wId, tknVal);
        return res.status(200).json({ ok: true, ...provResult });
      }

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${action}` });
    }
  } catch (err: any) {
    log("Handler error", { error: String(err) });
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
