import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("AUTOMATION-WORKER");

// ─── Types ─────────────────────────────────────────────────────────────────────

type TriggerType =
  | "appointment_created"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_completed"
  | "birthday"
  | "client_inactive_days";

type Channel = "whatsapp" | "email";

type AutomationRule = {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  channel: Channel;
  message_template: string;
  is_active: boolean;
};

type TenantSettings = {
  id: string;
  name: string | null;
  whatsapp_api_url: string | null;
  whatsapp_api_key: string | null;
  whatsapp_instance: string | null;
};

type DispatchResult = { sent: number; skipped: number; failed: number };

// ─── Template & formatting helpers ────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[String(k)] ?? "");
}

function normalizePhone(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

function formatDateBR(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

function formatTimeBR(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

/** dispatch_period for recurring automations */
function yearPeriod(): string {
  return String(new Date().getFullYear());
}

function yearMonthPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── WhatsApp via Evolution API ────────────────────────────────────────────────

async function sendWhatsapp(
  settings: TenantSettings,
  phone: string,
  message: string,
): Promise<{ ok: boolean; details?: string }> {
  const apiUrl = (settings.whatsapp_api_url ?? "").trim();
  const apiKey = (settings.whatsapp_api_key ?? "").trim();
  const instance = (settings.whatsapp_instance ?? "").trim();
  if (!apiUrl || !apiKey || !instance) return { ok: false, details: "missing_whatsapp_settings" };

  const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: phone, text: message }),
    });
    const text = await res.text();
    return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, details: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Email via Resend ──────────────────────────────────────────────────────────

function buildEmailHtml(message: string, salonName: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n").map((l) => `<p style="margin:0 0 10px 0">${l}</p>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">${salonName || "Seu Salão"}</h1>
    </div>
    <div style="padding:24px 32px;color:#333;font-size:14px;line-height:1.6">
      ${lines}
    </div>
    <div style="padding:16px 32px;background:#f9f9f9;font-size:12px;color:#999;text-align:center">
      Você está recebendo este e-mail porque tem agendamentos conosco.
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(
  resendKey: string,
  toEmail: string,
  toName: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; details?: string }> {
  if (!resendKey) return { ok: false, details: "missing_resend_key" };
  if (!toEmail) return { ok: false, details: "missing_email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "BeautyGest <no-reply@beautygest.com.br>",
        to: [toName ? `${toName} <${toEmail}>` : toEmail],
        subject,
        html,
      }),
    });
    const text = await res.text();
    return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, details: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Core dispatch (idempotent) ────────────────────────────────────────────────

async function dispatch(
  supabase: SupabaseClient,
  rule: AutomationRule,
  tenant: TenantSettings,
  entityType: "appointment" | "client",
  entityId: string,
  dispatchPeriod: string,
  phone: string,
  email: string,
  clientName: string,
  message: string,
  resendKey: string,
): Promise<"sent" | "skipped" | "failed"> {
  // Idempotency: check if already dispatched for this period
  const { data: existing } = await supabase
    .from("automation_dispatch_logs")
    .select("id")
    .eq("automation_id", rule.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("dispatch_period", dispatchPeriod)
    .maybeSingle();

  if (existing?.id) return "skipped";

  let result: { ok: boolean; details?: string };

  if (rule.channel === "whatsapp") {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      await supabase.from("automation_dispatch_logs").insert({
        tenant_id: rule.tenant_id,
        automation_id: rule.id,
        entity_type: entityType,
        entity_id: entityId,
        dispatch_period: dispatchPeriod,
        channel: "whatsapp",
        status: "skipped",
        details: { reason: "missing_phone" },
      });
      return "skipped";
    }
    result = await sendWhatsapp(tenant, normalized, message);
  } else {
    // email channel
    if (!email) {
      await supabase.from("automation_dispatch_logs").insert({
        tenant_id: rule.tenant_id,
        automation_id: rule.id,
        entity_type: entityType,
        entity_id: entityId,
        dispatch_period: dispatchPeriod,
        channel: "email",
        status: "skipped",
        details: { reason: "missing_email" },
      });
      return "skipped";
    }
    const salonName = tenant.name ?? "";
    const subject = salonName ? `Mensagem de ${salonName}` : "Mensagem do seu salão";
    const html = buildEmailHtml(message, salonName);
    result = await sendEmail(resendKey, email, clientName, subject, html);
  }

  const status = result.ok ? "sent" : "failed";
  await supabase.from("automation_dispatch_logs").insert({
    tenant_id: rule.tenant_id,
    automation_id: rule.id,
    entity_type: entityType,
    entity_id: entityId,
    dispatch_period: dispatchPeriod,
    channel: rule.channel,
    status,
    details: result.details ? { error: result.details } : {},
  });

  if (!result.ok) {
    log("Dispatch failed", {
      automation: rule.id,
      trigger: rule.trigger_type,
      entity: entityId,
      reason: result.details,
    });
  }

  return status;
}

// ─── Trigger: appointment-based (created, reminders, completed) ────────────────

async function processAppointmentTrigger(
  supabase: SupabaseClient,
  rules: AutomationRule[],
  triggerType: TriggerType,
  sinceMinutes: number,
  publicUrl: string,
  resendKey: string,
): Promise<DispatchResult> {
  const totals: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (!rules.length) return totals;

  // Group rules by tenant for batch processing
  const byTenant = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = byTenant.get(r.tenant_id) ?? [];
    list.push(r);
    byTenant.set(r.tenant_id, list);
  }

  for (const [tenantId, tenantRules] of byTenant) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
      .eq("id", tenantId)
      .maybeSingle() as any;

    if (!tenant) {
      totals.skipped += tenantRules.length;
      continue;
    }

    // Build appointment query for this trigger type
    const now = new Date();
    let apptQuery = supabase
      .from("appointments")
      .select("id, client_id, service_id, professional_id, scheduled_at, status, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .limit(300);

    if (triggerType === "appointment_created") {
      const since = new Date(now.getTime() - sinceMinutes * 60_000).toISOString();
      apptQuery = apptQuery.gte("created_at", since);
    } else if (triggerType === "appointment_reminder_24h") {
      // Window: appointments scheduled 24h±15min from now
      const lo = new Date(now.getTime() + (24 * 60 - 15) * 60_000).toISOString();
      const hi = new Date(now.getTime() + (24 * 60 + 15) * 60_000).toISOString();
      apptQuery = apptQuery.eq("status", "scheduled").gte("scheduled_at", lo).lte("scheduled_at", hi);
    } else if (triggerType === "appointment_reminder_2h") {
      // Window: appointments scheduled 2h±10min from now
      const lo = new Date(now.getTime() + (2 * 60 - 10) * 60_000).toISOString();
      const hi = new Date(now.getTime() + (2 * 60 + 10) * 60_000).toISOString();
      apptQuery = apptQuery.eq("status", "scheduled").gte("scheduled_at", lo).lte("scheduled_at", hi);
    } else if (triggerType === "appointment_completed") {
      const since = new Date(now.getTime() - sinceMinutes * 60_000).toISOString();
      apptQuery = apptQuery.eq("status", "completed").gte("updated_at", since);
    }

    const { data: appts, error: apptErr } = await apptQuery;
    if (apptErr) {
      log("appointment query error", { trigger: triggerType, tenant: tenantId, error: apptErr.message });
      continue;
    }
    if (!appts?.length) continue;

    // Batch-fetch related data
    const clientIds = [...new Set(appts.map((a: any) => a.client_id).filter(Boolean))];
    const serviceIds = [...new Set(appts.map((a: any) => a.service_id).filter(Boolean))];
    const profIds = [...new Set(appts.map((a: any) => a.professional_id).filter(Boolean))];
    const apptIds = appts.map((a: any) => a.id);

    const [clientsRes, servicesRes, profsRes, npsRes] = await Promise.all([
      supabase.from("clients").select("id, name, phone, email").in("id", clientIds as string[]),
      serviceIds.length
        ? supabase.from("services").select("id, name").in("id", serviceIds as string[])
        : Promise.resolve({ data: [] }),
      profIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", profIds as string[])
        : Promise.resolve({ data: [] }),
      triggerType === "appointment_completed"
        ? supabase.from("nps_responses").select("appointment_id, token").in("appointment_id", apptIds)
        : Promise.resolve({ data: [] }),
    ]);

    const clientMap = new Map<string, { id: string; name: string | null; phone: string | null; email: string | null }>(
      (clientsRes.data ?? []).map((c: any) => [String(c.id), c]),
    );
    const serviceMap = new Map<string, string>(
      (servicesRes.data ?? []).map((s: any) => [String(s.id), String(s.name ?? "")]),
    );
    const profMap = new Map<string, string>(
      (profsRes.data ?? []).map((p: any) => [String(p.id), String(p.full_name ?? "")]),
    );
    const npsMap = new Map<string, string>(
      (npsRes.data ?? []).map((n: any) => [String(n.appointment_id), String(n.token ?? "")]),
    );

    for (const appt of appts as any[]) {
      const client = clientMap.get(appt.client_id);
      if (!client) { totals.skipped++; continue; }

      const serviceName = serviceMap.get(appt.service_id) ?? "";
      const profName = profMap.get(appt.professional_id) ?? "";
      const npsToken = npsMap.get(appt.id);
      const npsLink = npsToken && publicUrl ? `${publicUrl}/nps/${npsToken}` : "";

      const vars: Record<string, string> = {
        client_name: client.name ?? "",
        service_name: serviceName,
        date: formatDateBR(appt.scheduled_at),
        time: formatTimeBR(appt.scheduled_at),
        professional_name: profName,
        salon_name: tenant.name ?? "",
        nps_link: npsLink,
      };

      for (const rule of tenantRules) {
        const message = interpolate(rule.message_template, vars);
        const r = await dispatch(
          supabase, rule, tenant,
          "appointment", appt.id, "once",
          client.phone ?? "", client.email ?? "", client.name ?? "",
          message, resendKey,
        );
        if (r === "sent") totals.sent++;
        else if (r === "failed") totals.failed++;
        else totals.skipped++;
      }
    }
  }

  return totals;
}

// ─── Trigger: birthday ────────────────────────────────────────────────────────

async function processBirthdayTrigger(
  supabase: SupabaseClient,
  rules: AutomationRule[],
  resendKey: string,
): Promise<DispatchResult> {
  const totals: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (!rules.length) return totals;

  const period = yearPeriod();
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  const byTenant = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = byTenant.get(r.tenant_id) ?? [];
    list.push(r);
    byTenant.set(r.tenant_id, list);
  }

  for (const [tenantId, tenantRules] of byTenant) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
      .eq("id", tenantId)
      .maybeSingle() as any;
    if (!tenant) { totals.skipped += tenantRules.length; continue; }

    // Fetch all clients with a birth_date for this tenant
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, phone, email, birth_date")
      .eq("tenant_id", tenantId)
      .not("birth_date", "is", null) as any;

    if (error) {
      log("birthday query error", { tenant: tenantId, error: error.message });
      continue;
    }

    // Filter to clients whose birthday is today (month + day match)
    const todayClients = (clients ?? []).filter((c: any) => {
      if (!c.birth_date) return false;
      // birth_date is YYYY-MM-DD; parse month/day safely
      const parts = String(c.birth_date).split("-");
      const m = parseInt(parts[1] ?? "0", 10);
      const d = parseInt(parts[2] ?? "0", 10);
      return m === todayMonth && d === todayDay;
    });

    for (const client of todayClients) {
      const vars: Record<string, string> = {
        client_name: client.name ?? "",
        service_name: "",
        date: "",
        time: "",
        professional_name: "",
        salon_name: tenant.name ?? "",
        nps_link: "",
      };

      for (const rule of tenantRules) {
        const message = interpolate(rule.message_template, vars);
        const r = await dispatch(
          supabase, rule, tenant,
          "client", client.id, period,
          client.phone ?? "", client.email ?? "", client.name ?? "",
          message, resendKey,
        );
        if (r === "sent") totals.sent++;
        else if (r === "failed") totals.failed++;
        else totals.skipped++;
      }
    }
  }

  return totals;
}

// ─── Trigger: client_inactive_days ────────────────────────────────────────────

async function processInactiveTrigger(
  supabase: SupabaseClient,
  rules: AutomationRule[],
  resendKey: string,
): Promise<DispatchResult> {
  const totals: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (!rules.length) return totals;

  const period = yearMonthPeriod(); // one dispatch per client per month
  const now = new Date();

  const byTenant = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = byTenant.get(r.tenant_id) ?? [];
    list.push(r);
    byTenant.set(r.tenant_id, list);
  }

  for (const [tenantId, tenantRules] of byTenant) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
      .eq("id", tenantId)
      .maybeSingle() as any;
    if (!tenant) { totals.skipped += tenantRules.length; continue; }

    // For each automation rule, process its configured inactive_days threshold
    for (const rule of tenantRules) {
      const inactiveDays = Math.max(1, Number(rule.trigger_config?.days ?? 60));

      // Target window: last appointment was between (inactiveDays) and (inactiveDays + 7) days ago
      const upperBound = new Date(now.getTime() - inactiveDays * 86_400_000)
        .toISOString().split("T")[0];
      const lowerBound = new Date(now.getTime() - (inactiveDays + 7) * 86_400_000)
        .toISOString().split("T")[0];

      // Get the most recent appointment per client (non-cancelled) within the lower/upper range
      const { data: apptRows, error: apptErr } = await supabase
        .from("appointments")
        .select("client_id, scheduled_at")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .gte("scheduled_at", lowerBound)
        .lte("scheduled_at", upperBound)
        .order("scheduled_at", { ascending: false })
        .limit(500) as any;

      if (apptErr) {
        log("inactive appt query error", { tenant: tenantId, error: apptErr.message });
        continue;
      }

      // Collect client IDs whose MOST RECENT appointment falls in this window
      // (meaning they haven't visited since then)
      const seen = new Set<string>();
      const candidateClientIds: string[] = [];
      for (const row of (apptRows ?? [])) {
        if (!seen.has(row.client_id)) {
          seen.add(row.client_id);
          candidateClientIds.push(row.client_id);
        }
      }

      // Exclude clients who had a MORE RECENT appointment (after upperBound)
      if (candidateClientIds.length) {
        const { data: recentRows } = await supabase
          .from("appointments")
          .select("client_id")
          .eq("tenant_id", tenantId)
          .neq("status", "cancelled")
          .in("client_id", candidateClientIds)
          .gt("scheduled_at", upperBound) as any;

        const recentSet = new Set((recentRows ?? []).map((r: any) => r.client_id));
        const trueInactiveIds = candidateClientIds.filter((id) => !recentSet.has(id));

        if (!trueInactiveIds.length) continue;

        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, phone, email")
          .in("id", trueInactiveIds) as any;

        for (const client of (clients ?? [])) {
          const vars: Record<string, string> = {
            client_name: client.name ?? "",
            service_name: "",
            date: "",
            time: "",
            professional_name: "",
            salon_name: tenant.name ?? "",
            nps_link: "",
          };

          const message = interpolate(rule.message_template, vars);
          const r = await dispatch(
            supabase, rule, tenant,
            "client", client.id, period,
            client.phone ?? "", client.email ?? "", client.name ?? "",
            message, resendKey,
          );
          if (r === "sent") totals.sent++;
          else if (r === "failed") totals.failed++;
          else totals.skipped++;
        }
      }
    }
  }

  return totals;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

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
  const workerKey = Deno.env.get("AUTOMATION_WORKER_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const publicUrl = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/$/, "");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Servidor não configurado" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!workerKey) {
    return new Response(JSON.stringify({ error: "AUTOMATION_WORKER_KEY não configurada" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const provided =
    req.headers.get("x-automation-worker-key")?.trim() ||
    req.headers.get("x-worker-key")?.trim() ||
    "";
  if (!provided || provided !== workerKey) {
    return new Response(JSON.stringify({ error: "Não autorizado (x-automation-worker-key)" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const sinceMinutes = Math.max(1, Number(new URL(req.url).searchParams.get("since_minutes") ?? 10));

  try {
    const { data: allRules, error: rulesErr } = await supabase
      .from("automations")
      .select("*")
      .eq("is_active", true) as any;

    if (rulesErr) throw rulesErr;

    const rules = (allRules ?? []) as AutomationRule[];
    const byType = (t: TriggerType) => rules.filter((r) => r.trigger_type === t);

    log("Worker started", { total_rules: rules.length, since_minutes: sinceMinutes });

    // Process all trigger types in parallel
    const [created, r24h, r2h, completed, birthday, inactive] = await Promise.allSettled([
      processAppointmentTrigger(supabase, byType("appointment_created"), "appointment_created", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_reminder_24h"), "appointment_reminder_24h", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_reminder_2h"), "appointment_reminder_2h", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_completed"), "appointment_completed", sinceMinutes, publicUrl, resendKey),
      processBirthdayTrigger(supabase, byType("birthday"), resendKey),
      processInactiveTrigger(supabase, byType("client_inactive_days"), resendKey),
    ]);

    const extract = (r: PromiseSettledResult<DispatchResult>): DispatchResult =>
      r.status === "fulfilled" ? r.value : { sent: 0, skipped: 0, failed: 0 };

    const totals = [created, r24h, r2h, completed, birthday, inactive].reduce(
      (acc, r) => {
        const v = extract(r);
        return { sent: acc.sent + v.sent, skipped: acc.skipped + v.skipped, failed: acc.failed + v.failed };
      },
      { sent: 0, skipped: 0, failed: 0 },
    );

    log("Worker finished", totals);

    return new Response(JSON.stringify({ success: true, ...totals }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Worker exception", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ success: false, error: "Erro interno no worker" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
