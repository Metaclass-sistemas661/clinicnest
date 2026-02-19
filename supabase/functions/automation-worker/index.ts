import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("AUTOMATION-WORKER");

type TriggerType =
  | "appointment_created"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_completed"
  | "birthday"
  | "client_inactive_days";

type Channel = "whatsapp" | "email";

type AutomationRow = {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  channel: Channel;
  message_template: string;
  is_active: boolean;
  created_at: string;
};

type TenantWhatsappSettings = {
  id: string;
  name: string | null;
  whatsapp_api_url: string | null;
  whatsapp_api_key: string | null;
  whatsapp_instance: string | null;
};

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => vars[String(key)] ?? "");
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function sendWhatsappViaEvolution(
  settings: TenantWhatsappSettings,
  phone: string,
  message: string
): Promise<{ ok: boolean; details?: string }> {
  const apiUrl = String(settings.whatsapp_api_url || "").trim();
  const apiKey = String(settings.whatsapp_api_key || "").trim();
  const instance = String(settings.whatsapp_instance || "").trim();

  if (!apiUrl || !apiKey || !instance) {
    return { ok: false, details: "missing_whatsapp_settings" };
  }

  const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone, text: message }),
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, details: text };
  return { ok: true };
}

serve(async (req: Request) => {
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

  const workerKey = Deno.env.get("AUTOMATION_WORKER_KEY") ?? "";
  if (!workerKey) {
    return new Response(JSON.stringify({ error: "AUTOMATION_WORKER_KEY não configurada" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const provided = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  if (!provided || provided !== workerKey) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // Note: worker minimal. Phase 1 scaffolding.
  // For now: runs appointment_completed trigger and sends WhatsApp message template with NPS link.
  // This endpoint should be called by cron (pg_cron) or an external scheduler.

  const sinceMinutes = Number(new URL(req.url).searchParams.get("since_minutes") || 180);
  const since = new Date(Date.now() - Math.max(1, sinceMinutes) * 60_000).toISOString();

  try {
    const { data: automations, error: aErr } = await supabaseAdmin
      .from("automations")
      .select("*")
      .eq("is_active", true)
      .in("trigger_type", ["appointment_completed"]) as any;

    if (aErr) throw aErr;

    const rows = (automations || []) as AutomationRow[];

    let sent = 0;
    let skipped = 0;

    for (const rule of rows) {
      if (rule.channel !== "whatsapp") {
        skipped++;
        continue;
      }

      const { data: tenantSettings, error: tErr } = await supabaseAdmin
        .from("tenants")
        .select("id, name, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
        .eq("id", rule.tenant_id)
        .maybeSingle();

      if (tErr || !tenantSettings) {
        skipped++;
        continue;
      }

      // Find recently completed appointments for tenant
      const { data: appts, error: apptErr } = await supabaseAdmin
        .from("appointments")
        .select("id, tenant_id, client_id, scheduled_at, status")
        .eq("tenant_id", rule.tenant_id)
        .eq("status", "completed")
        .gte("updated_at", since)
        .limit(200);

      if (apptErr) throw apptErr;

      for (const appt of appts || []) {
        // idempotency: skip if already dispatched
        const { data: existingLog } = await supabaseAdmin
          .from("automation_dispatch_logs")
          .select("id")
          .eq("automation_id", rule.id)
          .eq("entity_type", "appointment")
          .eq("entity_id", appt.id)
          .maybeSingle();

        if (existingLog?.id) {
          skipped++;
          continue;
        }

        // Pull NPS token for appointment
        const { data: nps } = await supabaseAdmin
          .from("nps_responses")
          .select("token")
          .eq("appointment_id", appt.id)
          .maybeSingle();

        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("id, name, phone")
          .eq("id", appt.client_id)
          .maybeSingle();

        const phone = normalizePhone(String(client?.phone || ""));
        if (!phone) {
          await supabaseAdmin.from("automation_dispatch_logs").insert({
            tenant_id: rule.tenant_id,
            automation_id: rule.id,
            entity_type: "appointment",
            entity_id: appt.id,
            channel: "whatsapp",
            status: "skipped",
            details: { reason: "missing_phone" },
          } as any);
          skipped++;
          continue;
        }

        const publicUrl = (Deno.env.get("PUBLIC_APP_URL") || "").replace(/\/$/, "");
        const npsLink = nps?.token && publicUrl ? `${publicUrl}/nps/${nps.token}` : "";

        const msg = interpolateTemplate(rule.message_template, {
          client_name: String(client?.name || ""),
          service_name: "",
          date: "",
          time: "",
          professional_name: "",
          salon_name: String((tenantSettings as any).name || "BeautyGest"),
          nps_link: npsLink,
        });

        const send = await sendWhatsappViaEvolution(tenantSettings as any, phone, msg);
        if (!send.ok) {
          await supabaseAdmin.from("automation_dispatch_logs").insert({
            tenant_id: rule.tenant_id,
            automation_id: rule.id,
            entity_type: "appointment",
            entity_id: appt.id,
            channel: "whatsapp",
            status: "failed",
            details: { error: send.details || null },
          } as any);
          skipped++;
          continue;
        }

        await supabaseAdmin.from("automation_dispatch_logs").insert({
          tenant_id: rule.tenant_id,
          automation_id: rule.id,
          entity_type: "appointment",
          entity_id: appt.id,
          channel: "whatsapp",
          status: "sent",
          details: { nps_link: npsLink || null },
        } as any);

        sent++;
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Worker exception", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({ success: false, error: "Erro no worker" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
