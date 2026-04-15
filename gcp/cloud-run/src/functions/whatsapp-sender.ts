/**
 * whatsapp-sender — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("WHATSAPP-SENDER");

type Body = {
  phone: string;
  message: string;
  tenant_id?: string;
};

type TenantRow = {
  id: string;
  whatsapp_api_url: string | null;
  whatsapp_api_key: string | null;
  whatsapp_instance: string | null;
};

type SelectResult<T> = { data: T; error: unknown };

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // Remove leading 0 (ex: 011...)
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Add country code 55 if missing
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }
  return digits;
}

export async function whatsappSender(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      // DB accessed via shared/db module

      const auth = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); const r = await authAdmin.getUser(token); return { user: r.data?.user, tenant_id: (r.data?.user as any)?.user_metadata?.tenant_id }; })();
      if (!auth.user) return res.status(401).json({ error: 'Unauthorized' });
      let body: Body;
      try {
        body = req.body;
      } catch {
        return res.status(400).json({ error: "Corpo da requisição inválido" });
      }

      const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : "";
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : auth.tenant_id;

      if (!phone) {
        return res.status(400).json({ error: "phone é obrigatório" });
      }

      if (!message) {
        return res.status(400).json({ error: "message é obrigatório" });
      }

      if (tenantId !== auth.tenant_id) {
        return res.status(403).json({ error: "tenant_id inválido" });
      }

      const rl = await checkRateLimit(`whatsapp-sender:${tenantId}:${auth.user.id}`, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
      }

      const { data: tenant, error: tenantError } = (await db.from("tenants")
        .select("id, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
        .eq("id", tenantId)
        .maybeSingle()) as unknown as SelectResult<TenantRow | null>;

      if (tenantError || !tenant) {
        return res.status(404).json({ error: "Tenant não encontrado" });
      }

      const apiUrl = String(tenant.whatsapp_api_url || "").trim();
      const apiKey = String(tenant.whatsapp_api_key || "").trim();
      const instance = String(tenant.whatsapp_instance || "").trim();

      if (!apiUrl || !apiKey || !instance) {
        return res.status(400).json({
            error: "WhatsApp não configurado no tenant. Preencha URL, API Key e Instância em Configurações.",
            code: "missing_whatsapp_settings",
          });
      }

      const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;

      try {
        const evoRes = await fetch(url, {
          method: "POST",
          body: JSON.stringify({
            number: phone,
            text: message,
          }),
        });

        const text = await evoRes.text();
        if (!evoRes.ok) {
          log("Evolution API error", { status: evoRes.status, body: text });
          return res.status(502).json({ success: false, error: "Erro ao enviar mensagem", details: text });
        }

        return res.status(200).json({ success: true });
      } catch (error: any) {
        log("Exception while calling Evolution API", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return res.status(502).json({ success: false, error: "Falha ao conectar na Evolution API" });
      }
  } catch (err: any) {
    console.error(`[whatsapp-sender] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
