/**
 * evolution-proxy — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
import { createAuthAdmin } from '../shared/auth-admin';
/**
 * Evolution API Proxy — Permite que clínicas conectem WhatsApp via QR Code
 * diretamente pela interface do ClinicNest.
 *
 * Endpoints:
 *   POST /evolution-proxy  { action: "create-instance", tenant_id }
 *   POST /evolution-proxy  { action: "get-qrcode", tenant_id }
 *   POST /evolution-proxy  { action: "get-status", tenant_id }
 *   POST /evolution-proxy  { action: "disconnect", tenant_id }
 *   POST /evolution-proxy  { action: "delete-instance", tenant_id }
 *
 * Auth: Bearer token (user must be admin/owner of tenant)
 */

const log = createLogger("EVOLUTION-PROXY");
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const CHATBOT_WEBHOOK_URL = `${process.env.CLOUD_RUN_URL || 'https://clinicnest-api-294286835536.southamerica-east1.run.app'}/whatsapp-chatbot`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function evolutionFetch(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    log("Evolution fetch error", { path, error: String(err) });
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

function instanceName(tenantId: string): string {
  // Sanitize to valid instance name
  return `cn-${tenantId.replace(/-/g, "").slice(0, 16)}`;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number): { statusCode: number; body: string } {
  return { statusCode: status, body: JSON.stringify(body) };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function createInstance(tenantId: string, instName: string): Promise<{ ok: boolean; data: unknown }> {
  const result = await evolutionFetch("/instance/create", "POST", {
    instanceName: instName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: {
      url: CHATBOT_WEBHOOK_URL,
      byEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT"],
    },
  });

  if (result.ok) {
    // Save instance info to tenant
    await db.from("tenants")
      .update({
        whatsapp_api_url: EVOLUTION_API_URL.replace(/\/$/, ""),
        whatsapp_api_key: EVOLUTION_API_KEY,
        whatsapp_instance: instName,
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
  }

  return result;
}

async function getQrCode(instName: string): Promise<{ ok: boolean; data: unknown }> {
  return evolutionFetch(`/instance/connect/${encodeURIComponent(instName)}`);
}

async function getStatus(instName: string): Promise<{ ok: boolean; data: unknown }> {
  const result = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instName)}`);
  return result;
}

async function disconnectInstance(instName: string): Promise<{ ok: boolean; data: unknown }> {
  return evolutionFetch(`/instance/logout/${encodeURIComponent(instName)}`, "DELETE");
}

async function deleteInstance(tenantId: string, instName: string): Promise<{ ok: boolean; data: unknown }> {
  const result = await evolutionFetch(`/instance/delete/${encodeURIComponent(instName)}`, "DELETE");

  if (result.ok) {
    await db.from("tenants")
      .update({
        whatsapp_api_url: null,
        whatsapp_api_key: null,
        whatsapp_instance: null,
      })
      .eq("id", tenantId);
  }

  return result;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

export async function evolutionProxy(req: Request, res: Response) {
  try {
    // CORS handled by middleware
      if (req.method !== "POST") {
        return jsonResponse({ error: "Método não permitido" }, 405, );
      }

      // Check Evolution API config
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return jsonResponse(
          { error: "Evolution API não configurada no servidor. Contate o suporte." },
          503,
          );
      }

      // Auth
      const auth = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); const r = await authAdmin.getUser(token); return { user: r.data?.user, tenant_id: (r.data?.user as any)?.user_metadata?.tenant_id }; })();
      if (!auth.user) return jsonResponse({ error: 'Unauthorized' }, 401);

      let body: { action: string; tenant_id?: string };
      try {
        body = req.body;
      } catch {
        return jsonResponse({ error: "Body inválido" }, 400, );
      }

      const { action } = body;
      const tenantId = auth.tenant_id;
      const instName = instanceName(tenantId);

      log("Action", { action, tenantId, instName });

      try {
        switch (action) {
          case "create-instance": {
            // Check if instance already exists
            const status = await getStatus(instName);
            if (status.ok) {
              // Instance exists, return QR code
              const qr = await getQrCode(instName);
              return jsonResponse({
                ok: true,
                action: "existing",
                instanceName: instName,
                ...((qr.data as Record<string, unknown>) || {}),
              }, 200, );
            }

            const result = await createInstance(tenantId, instName);
            if (!result.ok) {
              return jsonResponse(
                { error: "Falha ao criar instância", details: result.data },
                502,
                );
            }
            return jsonResponse({
              ok: true,
              action: "created",
              instanceName: instName,
              ...((result.data as Record<string, unknown>) || {}),
            }, 200, );
          }

          case "get-qrcode": {
            const result = await getQrCode(instName);
            if (!result.ok) {
              return jsonResponse(
                { error: "Falha ao obter QR Code", details: result.data },
                502,
                );
            }
            return jsonResponse({
              ok: true,
              instanceName: instName,
              ...((result.data as Record<string, unknown>) || {}),
            }, 200, );
          }

          case "get-status": {
            const result = await getStatus(instName);
            if (!result.ok) {
              return jsonResponse({
                ok: true,
                state: "not_found",
                instanceName: instName,
              }, 200, );
            }
            return jsonResponse({
              ok: true,
              instanceName: instName,
              ...((result.data as Record<string, unknown>) || {}),
            }, 200, );
          }

          case "disconnect": {
            const result = await disconnectInstance(instName);
            return jsonResponse({
              ok: result.ok,
              action: "disconnected",
              instanceName: instName,
            }, result.ok ? 200 : 502, );
          }

          case "delete-instance": {
            const result = await deleteInstance(tenantId, instName);
            return jsonResponse({
              ok: result.ok,
              action: "deleted",
              instanceName: instName,
            }, result.ok ? 200 : 502, );
          }

          default:
            return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400, );
        }
      } catch (err: any) {
        log("Action error", { action, error: String(err) });
        return jsonResponse({ error: "Erro interno" }, 500, );
      }
  } catch (err: any) {
    console.error(`[evolution-proxy] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
