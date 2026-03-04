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
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("EVOLUTION-PROXY");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const CHATBOT_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-chatbot`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function evolutionFetch(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
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
  } catch (err) {
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
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
    await supabase
      .from("tenants")
      .update({
        whatsapp_api_url: EVOLUTION_API_URL.replace(/\/$/, ""),
        whatsapp_api_key: EVOLUTION_API_KEY,
        whatsapp_instance: instName,
      })
      .eq("id", tenantId);

    // Auto-seed chatbot_settings with sensible defaults if not exists
    const { data: existing } = await supabase
      .from("chatbot_settings")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!existing) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();

      const clinicName = (tenant as { name?: string } | null)?.name ?? "nossa clínica";

      await supabase.from("chatbot_settings").insert({
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
    await supabase
      .from("tenants")
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

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405, cors);
  }

  // Check Evolution API config
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return jsonResponse(
      { error: "Evolution API não configurada no servidor. Contate o suporte." },
      503,
      cors,
    );
  }

  // Auth
  const auth = await getAuthenticatedUserWithTenant(req, cors);
  if (auth.error) return auth.error;

  let body: { action: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido" }, 400, cors);
  }

  const { action } = body;
  const tenantId = auth.tenantId;
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
          }, 200, cors);
        }

        const result = await createInstance(tenantId, instName);
        if (!result.ok) {
          return jsonResponse(
            { error: "Falha ao criar instância", details: result.data },
            502,
            cors,
          );
        }
        return jsonResponse({
          ok: true,
          action: "created",
          instanceName: instName,
          ...((result.data as Record<string, unknown>) || {}),
        }, 200, cors);
      }

      case "get-qrcode": {
        const result = await getQrCode(instName);
        if (!result.ok) {
          return jsonResponse(
            { error: "Falha ao obter QR Code", details: result.data },
            502,
            cors,
          );
        }
        return jsonResponse({
          ok: true,
          instanceName: instName,
          ...((result.data as Record<string, unknown>) || {}),
        }, 200, cors);
      }

      case "get-status": {
        const result = await getStatus(instName);
        if (!result.ok) {
          return jsonResponse({
            ok: true,
            state: "not_found",
            instanceName: instName,
          }, 200, cors);
        }
        return jsonResponse({
          ok: true,
          instanceName: instName,
          ...((result.data as Record<string, unknown>) || {}),
        }, 200, cors);
      }

      case "disconnect": {
        const result = await disconnectInstance(instName);
        return jsonResponse({
          ok: result.ok,
          action: "disconnected",
          instanceName: instName,
        }, result.ok ? 200 : 502, cors);
      }

      case "delete-instance": {
        const result = await deleteInstance(tenantId, instName);
        return jsonResponse({
          ok: result.ok,
          action: "deleted",
          instanceName: instName,
        }, result.ok ? 200 : 502, cors);
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400, cors);
    }
  } catch (err) {
    log("Action error", { action, error: String(err) });
    return jsonResponse({ error: "Erro interno" }, 500, cors);
  }
});
