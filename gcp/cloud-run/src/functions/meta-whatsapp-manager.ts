/**
 * meta-whatsapp-manager — Cloud Run handler
 *
 * Manages WhatsApp Business Cloud API configuration for tenants.
 *
 * Actions:
 *   POST /api/meta-whatsapp-manager { action: "save-config", phone_number_id, access_token, business_account_id }
 *   POST /api/meta-whatsapp-manager { action: "get-status" }
 *   POST /api/meta-whatsapp-manager { action: "test-connection" }
 *   POST /api/meta-whatsapp-manager { action: "disconnect" }
 *   POST /api/meta-whatsapp-manager { action: "get-phone-numbers" }
 */

import { Request, Response } from 'express';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';

const log = createLogger("META-WHATSAPP-MANAGER");
const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const CHATBOT_WEBHOOK_URL = `${process.env.CLOUD_RUN_URL || ''}/api/webhooks/whatsapp-chatbot`;
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function metaApiFetch(
  path: string,
  accessToken: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${META_API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    log("Meta API fetch error", { path, error: String(err) });
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function saveConfig(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
  phoneNumberId: string,
  accessToken: string,
  businessAccountId: string,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  // Validate the token by fetching phone number info
  const validation = await metaApiFetch(`/${phoneNumberId}`, accessToken);
  if (!validation.ok) {
    return { ok: false, error: "Token inválido ou Phone Number ID incorreto. Verifique suas credenciais." };
  }

  await db.from("tenants")
    .update({
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_access_token: accessToken,
      whatsapp_business_account_id: businessAccountId,
    })
    .eq("id", tenantId);

  // Auto-seed chatbot_settings with sensible defaults if not exists
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

  return { ok: true, data: { phoneInfo: validation.data, webhookUrl: CHATBOT_WEBHOOK_URL, verifyToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN } };
}

async function getStatus(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
): Promise<{ ok: boolean; data: unknown }> {
  const { data: tenant } = await db.from("tenants")
    .select("whatsapp_phone_number_id, whatsapp_access_token, whatsapp_business_account_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, data: { state: "not_configured" } };

  const t = tenant as { whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null; whatsapp_business_account_id: string | null };
  const phoneNumberId = (t.whatsapp_phone_number_id || "").trim();
  const accessToken = (t.whatsapp_access_token || "").trim();

  if (!phoneNumberId || !accessToken) {
    return { ok: true, data: { state: "not_configured" } };
  }

  // Fetch phone number info from Meta
  const result = await metaApiFetch(
    `/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`,
    accessToken,
  );

  if (!result.ok) {
    return { ok: true, data: { state: "invalid_token", phoneNumberId, error: result.data } };
  }

  const phoneInfo = result.data as Record<string, unknown>;

  return {
    ok: true,
    data: {
      state: "connected",
      phoneNumberId,
      businessAccountId: t.whatsapp_business_account_id,
      verifiedName: phoneInfo.verified_name,
      displayPhoneNumber: phoneInfo.display_phone_number,
      qualityRating: phoneInfo.quality_rating,
      webhookUrl: CHATBOT_WEBHOOK_URL,
      verifyToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    },
  };
}

async function testConnection(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
): Promise<{ ok: boolean; data: unknown }> {
  const { data: tenant } = await db.from("tenants")
    .select("whatsapp_phone_number_id, whatsapp_access_token")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, data: { error: "Tenant não encontrado" } };

  const t = tenant as { whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null };
  const phoneNumberId = (t.whatsapp_phone_number_id || "").trim();
  const accessToken = (t.whatsapp_access_token || "").trim();

  if (!phoneNumberId || !accessToken) {
    return { ok: false, data: { error: "WhatsApp não configurado" } };
  }

  const result = await metaApiFetch(
    `/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    accessToken,
  );

  return { ok: result.ok, data: result.data };
}

async function getPhoneNumbers(
  accessToken: string,
  businessAccountId: string,
): Promise<{ ok: boolean; data: unknown }> {
  const result = await metaApiFetch(
    `/${businessAccountId}/phone_numbers?fields=verified_name,display_phone_number,quality_rating,id`,
    accessToken,
  );
  return { ok: result.ok, data: result.data };
}

async function disconnect(
  db: ReturnType<typeof createDbClient>,
  tenantId: string,
): Promise<{ ok: boolean }> {
  await db.from("tenants")
    .update({
      whatsapp_phone_number_id: null,
      whatsapp_access_token: null,
      whatsapp_business_account_id: null,
    })
    .eq("id", tenantId);

  return { ok: true };
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

export async function metaWhatsappManager(req: Request, res: Response) {
  try {
    const db = createDbClient();

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    // Auth
    const auth = await (async () => {
      const authAdmin = createAuthAdmin();
      const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', '');
      const r = await authAdmin.getUser(token);
      return { user: r.data?.user, tenant_id: (r.data?.user as any)?.user_metadata?.tenant_id };
    })();
    if (!auth.user) return res.status(401).json({ error: "Unauthorized" });

    let body: {
      action: string;
      phone_number_id?: string;
      access_token?: string;
      business_account_id?: string;
    };
    try {
      body = req.body;
    } catch {
      return res.status(400).json({ error: "Body inválido" });
    }

    const { action } = body;
    const tenantId = auth.tenant_id;

    log("Action", { action, tenantId });

    try {
      switch (action) {
        case "save-config": {
          const phoneNumberId = (body.phone_number_id || "").trim();
          const accessToken = (body.access_token || "").trim();
          const businessAccountId = (body.business_account_id || "").trim();

          if (!phoneNumberId || !accessToken) {
            return res.status(400).json({ error: "phone_number_id e access_token são obrigatórios" });
          }

          const result = await saveConfig(db, tenantId, phoneNumberId, accessToken, businessAccountId);
          if (!result.ok) {
            return res.status(400).json({ error: result.error });
          }
          return res.status(200).json({ ok: true, action: "saved", ...result.data as object });
        }

        case "get-status": {
          const result = await getStatus(db, tenantId);
          return res.status(200).json({ ok: true, ...result.data as object });
        }

        case "test-connection": {
          const result = await testConnection(db, tenantId);
          return res.status(result.ok ? 200 : 400).json({ ok: result.ok, ...result.data as object });
        }

        case "get-phone-numbers": {
          const { data: tenant } = await db.from("tenants")
            .select("whatsapp_access_token, whatsapp_business_account_id")
            .eq("id", tenantId)
            .maybeSingle();

          const t = tenant as { whatsapp_access_token: string | null; whatsapp_business_account_id: string | null } | null;
          const accessToken = (t?.whatsapp_access_token || body.access_token || "").trim();
          const businessAccountId = (t?.whatsapp_business_account_id || body.business_account_id || "").trim();

          if (!accessToken || !businessAccountId) {
            return res.status(400).json({ error: "access_token e business_account_id são obrigatórios" });
          }

          const result = await getPhoneNumbers(accessToken, businessAccountId);
          return res.status(result.ok ? 200 : 400).json({ ok: result.ok, ...result.data as object });
        }

        case "disconnect": {
          const result = await disconnect(db, tenantId);
          return res.status(200).json({ ok: result.ok, action: "disconnected" });
        }

        default:
          return res.status(400).json({ error: `Ação desconhecida: ${action}` });
      }
    } catch (err: any) {
      log("Action error", { action, error: String(err) });
      return res.status(500).json({ error: "Erro interno" });
    }
  } catch (err: any) {
    console.error(`[meta-whatsapp-manager] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
