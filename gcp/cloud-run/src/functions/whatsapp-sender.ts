/**
 * whatsapp-sender — Cloud Run handler
 *
 * Sends WhatsApp messages via Meta WhatsApp Business Cloud API (official).
 */

import { Request, Response } from 'express';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';

const log = createLogger("WHATSAPP-SENDER");

type Body = {
  phone: string;
  message: string;
  tenant_id?: string;
  template_name?: string;
  template_language?: string;
  template_components?: unknown[];
};

type TenantRow = {
  id: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_business_account_id: string | null;
};

type SelectResult<T> = { data: T; error: unknown };

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }
  return digits;
}

/**
 * Send a text message via Meta WhatsApp Cloud API.
 */
export async function sendMetaWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (data as any)?.error?.message || JSON.stringify(data);
      log("Meta API error", { status: res.status, error: errMsg });
      return { ok: false, error: errMsg };
    }

    const messageId = ((data as any)?.messages?.[0]?.id) as string | undefined;
    return { ok: true, messageId };
  } catch (error: any) {
    log("Meta API exception", { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Send a template message via Meta WhatsApp Cloud API.
 */
export async function sendMetaWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = "pt_BR",
  components?: unknown[],
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (data as any)?.error?.message || JSON.stringify(data);
      log("Meta template API error", { status: res.status, error: errMsg });
      return { ok: false, error: errMsg };
    }

    const messageId = ((data as any)?.messages?.[0]?.id) as string | undefined;
    return { ok: true, messageId };
  } catch (error: any) {
    log("Meta template API exception", { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Send interactive buttons via Meta WhatsApp Cloud API.
 */
export async function sendMetaWhatsAppButtons(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(headerText ? { header: { type: "text", text: headerText } } : {}),
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const textFallback = (headerText ? `*${headerText}*\n\n` : "") +
        bodyText + "\n\n" +
        buttons.map((b, i) => `*${i + 1}* - ${b.title}`).join("\n");
      return sendMetaWhatsAppMessage(phoneNumberId, accessToken, to, textFallback);
    }
    return { ok: true };
  } catch {
    const textFallback = (headerText ? `*${headerText}*\n\n` : "") +
      bodyText + "\n\n" +
      buttons.map((b, i) => `*${i + 1}* - ${b.title}`).join("\n");
    return sendMetaWhatsAppMessage(phoneNumberId, accessToken, to, textFallback);
  }
}

/**
 * Send interactive list via Meta WhatsApp Cloud API.
 */
export async function sendMetaWhatsAppList(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map(s => ({
          title: s.title.slice(0, 24),
          rows: s.rows.slice(0, 10).map(r => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const allRows = sections.flatMap(s => s.rows);
      const textFallback = `*${headerText}*\n${bodyText}\n\n` +
        allRows.map((r, i) => `*${i + 1}* - ${r.title}${r.description ? ` (${r.description})` : ""}`).join("\n");
      return sendMetaWhatsAppMessage(phoneNumberId, accessToken, to, textFallback);
    }
    return { ok: true };
  } catch {
    const allRows = sections.flatMap(s => s.rows);
    const textFallback = `*${headerText}*\n${bodyText}\n\n` +
      allRows.map((r, i) => `*${i + 1}* - ${r.title}${r.description ? ` (${r.description})` : ""}`).join("\n");
    return sendMetaWhatsAppMessage(phoneNumberId, accessToken, to, textFallback);
  }
}

/**
 * Mark a message as read via Meta WhatsApp Cloud API.
 */
export async function markMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
): Promise<void> {
  const url = `${META_API_BASE}/${phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch {
    // Best-effort — don't fail on read receipt errors
  }
}

export async function whatsappSender(req: Request, res: Response) {
  try {
    const db = createDbClient();

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const auth = await (async () => {
      const authAdmin = createAuthAdmin();
      const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', '');
      const r = await authAdmin.getUser(token);
      return { user: r.data?.user, tenant_id: (r.data?.user as any)?.user_metadata?.tenant_id };
    })();
    if (!auth.user) return res.status(401).json({ error: 'Não autorizado.' });

    let body: Body;
    try {
      body = req.body;
    } catch {
      return res.status(400).json({ error: "Corpo da requisição inválido" });
    }

    const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : auth.tenant_id;

    if (!phone) return res.status(400).json({ error: "phone é obrigatório" });
    if (!message) return res.status(400).json({ error: "message é obrigatório" });
    if (tenantId !== auth.tenant_id) return res.status(403).json({ error: "tenant_id inválido" });

    const rl = await checkRateLimit(`whatsapp-sender:${tenantId}:${auth.user.id}`, 20, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
    }

    const { data: tenant, error: tenantError } = (await db.from("tenants")
      .select("id, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_business_account_id")
      .eq("id", tenantId)
      .maybeSingle()) as unknown as SelectResult<TenantRow | null>;

    if (tenantError || !tenant) {
      return res.status(404).json({ error: "Tenant não encontrado" });
    }

    const phoneNumberId = (tenant.whatsapp_phone_number_id || "").trim();
    const accessToken = (tenant.whatsapp_access_token || "").trim();

    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({
        error: "WhatsApp não configurado. Configure o Phone Number ID e Access Token nas Integrações.",
        code: "missing_whatsapp_settings",
      });
    }

    if (body.template_name) {
      const result = await sendMetaWhatsAppTemplate(
        phoneNumberId, accessToken, phone,
        body.template_name,
        body.template_language || "pt_BR",
        body.template_components as unknown[] | undefined,
      );
      if (!result.ok) {
        return res.status(502).json({ success: false, error: "Erro ao enviar template", details: result.error });
      }
      return res.status(200).json({ success: true, message_id: result.messageId });
    }

    const result = await sendMetaWhatsAppMessage(phoneNumberId, accessToken, phone, message);
    if (!result.ok) {
      return res.status(502).json({ success: false, error: "Erro ao enviar mensagem", details: result.error });
    }

    return res.status(200).json({ success: true, message_id: result.messageId });
  } catch (err: any) {
    console.error(`[whatsapp-sender] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
