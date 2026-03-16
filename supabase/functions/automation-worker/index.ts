import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("AUTOMATION-WORKER");

// ─── Types ─────────────────────────────────────────────────────────────────────

type TriggerType =
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_completed"
  | "appointment_cancelled"
  | "birthday"
  | "client_inactive_days"
  | "return_reminder"
  | "consent_signed"
  | "return_scheduled"
  | "invoice_created"
  | "exam_ready";

type Channel = "whatsapp" | "email" | "sms";

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
  email: string | null;
  whatsapp_api_url: string | null;
  whatsapp_api_key: string | null;
  whatsapp_instance: string | null;
  sms_provider: string | null;
  sms_api_key: string | null;
  sms_sender: string | null;
  smart_confirmation_enabled?: boolean;
  smart_confirmation_4h_channel?: string;
  smart_confirmation_1h_channel?: string;
  smart_confirmation_autorelease_minutes?: number;
};

type SelectResult<T> = { data: T; error: unknown };

type AppointmentRow = {
  id: string;
  patient_id: string | null;
  procedure_id: string | null;
  professional_id: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ClientRow = { id: string; name: string | null; phone: string | null; email: string | null };
type ServiceRow = { id: string; name: string | null };
type ProfileRow = { id: string; full_name: string | null };
type NpsRow = { appointment_id: string; token: string | null };

type BirthdayClientRow = ClientRow & { birth_date: string | null };
type ApptRecentRow = { patient_id: string };
type ApptWindowRow = { patient_id: string; scheduled_at: string | null };

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

function getErrorMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : JSON.stringify(m);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
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

function buildEmailHtml(message: string, clinicName: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n").map((l) => `<p style="margin:0 0 10px 0">${l}</p>`).join("");
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0fdfa;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,148,136,.08),0 1px 4px rgba(0,0,0,.04)">
    <div style="background:linear-gradient(135deg,#0d9488 0%,#0891b2 100%);padding:28px 32px">
      <span style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase">${clinicName || "Sua Clínica"}</span>
    </div>
    <div style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.7">
      ${lines}
    </div>
    <div style="padding:20px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0">
      &copy; ${year} ${clinicName || "Sua Clínica"} &middot; Enviado via <span style="color:#0d9488;font-weight:600">ClinicNest</span>
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
  clinicName?: string,
  clinicEmail?: string | null,
): Promise<{ ok: boolean; details?: string }> {
  if (!resendKey) return { ok: false, details: "missing_resend_key" };
  if (!toEmail) return { ok: false, details: "missing_email" };
  try {
    const senderDomain = Deno.env.get("CLINIC_EMAIL_DOMAIN") || "metaclass.com.br";
    const fromField = clinicName
      ? `${clinicName} <notificacoes@${senderDomain}>`
      : `ClinicNest <notificacoes@${senderDomain}>`;
    const payload: Record<string, unknown> = {
      from: fromField,
      to: [toName ? `${toName} <${toEmail}>` : toEmail],
      subject,
      html,
    };
    if (clinicEmail) payload.reply_to = clinicEmail;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, details: e instanceof Error ? e.message : String(e) };
  }
}

// ─── SMS via provedor configurado ──────────────────────────────────────────────

async function sendSms(
  settings: TenantSettings,
  phone: string,
  message: string,
): Promise<{ ok: boolean; details?: string }> {
  const apiKey = (settings.sms_api_key ?? "").trim();
  const sender = (settings.sms_sender ?? "").trim();
  const provider = (settings.sms_provider ?? "zenvia").trim();

  if (!apiKey) return { ok: false, details: "missing_sms_settings" };

  const normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone || normalizedPhone.length < 10) return { ok: false, details: "invalid_phone" };

  const fullPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

  try {
    if (provider === "zenvia") {
      const res = await fetch("https://api.zenvia.com/v2/channels/sms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-TOKEN": apiKey },
        body: JSON.stringify({ from: sender, to: fullPhone, contents: [{ type: "text", text: message }] }),
      });
      const text = await res.text();
      return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
    } else if (provider === "twilio") {
      const [accountSid, authToken] = apiKey.split(":");
      if (!accountSid || !authToken) return { ok: false, details: "invalid_twilio_key" };
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({ From: sender, To: `+${fullPhone}`, Body: message });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const text = await res.text();
      return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
    } else {
      // Generic webhook
      const res = await fetch(apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, message, sender }),
      });
      const text = await res.text();
      return res.ok ? { ok: true } : { ok: false, details: text.slice(0, 500) };
    }
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
  } else if (rule.channel === "sms") {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      await supabase.from("automation_dispatch_logs").insert({
        tenant_id: rule.tenant_id,
        automation_id: rule.id,
        entity_type: entityType,
        entity_id: entityId,
        dispatch_period: dispatchPeriod,
        channel: "sms",
        status: "skipped",
        details: { reason: "missing_phone" },
      });
      return "skipped";
    }
    result = await sendSms(tenant, normalized, message);
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
    const clinicName = tenant.name ?? "";
    const subject = clinicName ? `Mensagem de ${clinicName}` : "Mensagem da sua clínica";
    const html = buildEmailHtml(message, clinicName);
    result = await sendEmail(resendKey, email, clientName, subject, html, clinicName, tenant.email);
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
    const { data: tenant } = (await supabase
      .from("tenants")
      .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender")
      .eq("id", tenantId)
      .maybeSingle()) as unknown as SelectResult<TenantSettings | null>;

    if (!tenant) {
      totals.skipped += tenantRules.length;
      continue;
    }

    // Build appointment query for this trigger type
    const now = new Date();
    let apptQuery = supabase
      .from("appointments")
      .select("id, patient_id, procedure_id, professional_id, scheduled_at, status, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .limit(300);

    if (triggerType === "appointment_created") {
      const since = new Date(now.getTime() - sinceMinutes * 60_000).toISOString();
      apptQuery = apptQuery.gte("created_at", since);
    } else if (triggerType === "appointment_confirmed") {
      const since = new Date(now.getTime() - sinceMinutes * 60_000).toISOString();
      apptQuery = apptQuery.eq("status", "confirmed").gte("updated_at", since);
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

    const { data: appts, error: apptErr } = (await apptQuery) as unknown as SelectResult<AppointmentRow[] | null>;
    if (apptErr) {
      log("appointment query error", { trigger: triggerType, tenant: tenantId, error: getErrorMessage(apptErr) });
      continue;
    }
    if (!appts?.length) continue;

    // Batch-fetch related data
    const patientIds = [...new Set(appts.map((a) => a.patient_id).filter((v): v is string => Boolean(v)))];
    const procedureIds = [...new Set(appts.map((a) => a.procedure_id).filter((v): v is string => Boolean(v)))];
    const profIds = [...new Set(appts.map((a) => a.professional_id).filter((v): v is string => Boolean(v)))];
    const apptIds = appts.map((a) => a.id);

    const [patientsRes, proceduresRes, profsRes, npsRes] = await Promise.all([
      (supabase.from("patients").select("id, name, phone, email").in("id", patientIds)) as unknown as SelectResult<ClientRow[] | null>,
      procedureIds.length
        ? ((supabase.from("procedures").select("id, name").in("id", procedureIds)) as unknown as SelectResult<ServiceRow[] | null>)
        : Promise.resolve({ data: [] as ServiceRow[] }),
      profIds.length
        ? ((supabase.from("profiles").select("id, full_name").in("id", profIds)) as unknown as SelectResult<ProfileRow[] | null>)
        : Promise.resolve({ data: [] as ProfileRow[] }),
      triggerType === "appointment_completed"
        ? ((supabase.from("nps_responses").select("appointment_id, token").in("appointment_id", apptIds)) as unknown as SelectResult<NpsRow[] | null>)
        : Promise.resolve({ data: [] as NpsRow[] }),
    ]);

    const patientMap = new Map<string, { id: string; name: string | null; phone: string | null; email: string | null }>(
      (patientsRes.data ?? []).map((c) => [String(c.id), c]),
    );
    const procedureMap = new Map<string, string>(
      (proceduresRes.data ?? []).map((s) => [String(s.id), String(s.name ?? "")]),
    );
    const profMap = new Map<string, string>(
      (profsRes.data ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]),
    );
    const npsMap = new Map<string, string>(
      (npsRes.data ?? []).map((n) => [String(n.appointment_id), String(n.token ?? "")]),
    );

    for (const appt of appts) {
      const client = appt.patient_id ? patientMap.get(appt.patient_id) : undefined;
      if (!client) { totals.skipped++; continue; }

      const serviceName = appt.procedure_id ? (procedureMap.get(appt.procedure_id) ?? "") : "";
      const profName = appt.professional_id ? (profMap.get(appt.professional_id) ?? "") : "";
      const npsToken = npsMap.get(appt.id);
      const npsLink = npsToken && publicUrl ? `${publicUrl}/nps/${npsToken}` : "";

      const vars: Record<string, string> = {
        patient_name: client.name ?? "",
        procedure_name: serviceName,
        date: formatDateBR(appt.scheduled_at ?? ""),
        time: formatTimeBR(appt.scheduled_at ?? ""),
        professional_name: profName,
        clinic_name: tenant.name ?? "",
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
    const { data: tenant } = (await supabase
      .from("tenants")
      .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender")
      .eq("id", tenantId)
      .maybeSingle()) as unknown as SelectResult<TenantSettings | null>;
    if (!tenant) { totals.skipped += tenantRules.length; continue; }

    // Fetch all patients with a birth_date for this tenant
    const { data: clients, error } = (await supabase
      .from("patients")
      .select("id, name, phone, email, birth_date")
      .eq("tenant_id", tenantId)
      .not("birth_date", "is", null)) as unknown as SelectResult<BirthdayClientRow[] | null>;

    if (error) {
      log("birthday query error", { tenant: tenantId, error: getErrorMessage(error) });
      continue;
    }

    // Filter to clients whose birthday is today (month + day match)
    const todayClients = (clients ?? []).filter((c) => {
      if (!c.birth_date) return false;
      // birth_date is YYYY-MM-DD; parse month/day safely
      const parts = String(c.birth_date).split("-");
      const m = parseInt(parts[1] ?? "0", 10);
      const d = parseInt(parts[2] ?? "0", 10);
      return m === todayMonth && d === todayDay;
    });

    for (const client of todayClients) {
      const vars: Record<string, string> = {
        patient_name: client.name ?? "",
        procedure_name: "",
        date: "",
        time: "",
        professional_name: "",
        clinic_name: tenant.name ?? "",
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

type ReturnReminderRow = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  return_date: string;
  reason: string | null;
  status: string;
  tenant_id: string;
};

async function processReturnReminderTrigger(
  supabase: SupabaseClient,
  rules: AutomationRule[],
  publicUrl: string,
  resendKey: string,
): Promise<DispatchResult> {
  const totals: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (!rules.length) return totals;

  const byTenant = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = byTenant.get(r.tenant_id) ?? [];
    list.push(r);
    byTenant.set(r.tenant_id, list);
  }

  for (const [tenantId, tenantRules] of byTenant) {
    const { data: tenant } = (await supabase
      .from("tenants")
      .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender")
      .eq("id", tenantId)
      .maybeSingle()) as unknown as SelectResult<TenantSettings | null>;

    if (!tenant) {
      totals.skipped += tenantRules.length;
      continue;
    }

    for (const rule of tenantRules) {
      // Get days_before from trigger_config (default 3 days)
      const daysBefore = Math.max(1, Number(rule.trigger_config?.days_before ?? 3));
      
      // Calculate target date range (returns scheduled for X days from now)
      const now = new Date();
      const targetDate = new Date(now.getTime() + daysBefore * 86_400_000);
      const targetDateStr = targetDate.toISOString().split("T")[0];
      
      // Get return reminders that need notification
      const { data: returns, error: returnErr } = (await supabase
        .from("return_reminders")
        .select("id, patient_id, professional_id, return_date, reason, status, tenant_id")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .eq("return_date", targetDateStr)
        .limit(200)) as unknown as SelectResult<ReturnReminderRow[] | null>;

      if (returnErr) {
        log("return reminder query error", { tenant: tenantId, error: getErrorMessage(returnErr) });
        continue;
      }

      if (!returns?.length) continue;

      // Batch-fetch client and professional data
      const clientIds = [...new Set(returns.map((r) => r.patient_id))];
      const profIds = [...new Set(returns.map((r) => r.professional_id).filter((v): v is string => Boolean(v)))];

      const [clientsRes, profsRes] = await Promise.all([
        (supabase.from("patients").select("id, name, phone, email").in("id", clientIds)) as unknown as SelectResult<ClientRow[] | null>,
        profIds.length
          ? ((supabase.from("profiles").select("id, full_name").in("id", profIds)) as unknown as SelectResult<ProfileRow[] | null>)
          : Promise.resolve({ data: [] as ProfileRow[] }),
      ]);

      const clientMap = new Map<string, ClientRow>(
        (clientsRes.data ?? []).map((c) => [String(c.id), c]),
      );
      const profMap = new Map<string, string>(
        (profsRes.data ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]),
      );

      for (const returnItem of returns) {
        const client = clientMap.get(returnItem.patient_id);
        if (!client) {
          totals.skipped++;
          continue;
        }

        const profName = returnItem.professional_id ? (profMap.get(returnItem.professional_id) ?? "") : "";
        
        // Generate confirmation link if available
        let confirmLink = "";
        try {
          const { data: tokenData } = await supabase.rpc("create_return_confirmation_link", {
            p_tenant_id: tenantId,
            p_return_id: returnItem.id,
            p_expires_hours: 72,
          });
          if (tokenData && publicUrl) {
            confirmLink = `${publicUrl}/confirmar-retorno/${tokenData}`;
          }
        } catch {
          // Token creation failed, continue without link
        }

        const vars: Record<string, string> = {
          patient_name: client.name ?? "",
          procedure_name: "",
          date: formatDateBR(returnItem.return_date),
          time: "",
          professional_name: profName,
          clinic_name: tenant.name ?? "",
          nps_link: "",
          return_reason: returnItem.reason ?? "",
          confirm_link: confirmLink,
        };

        const message = interpolate(rule.message_template, vars);
        const r = await dispatch(
          supabase, rule, tenant,
          "client", returnItem.id, `return-${returnItem.id}`,
          client.phone ?? "", client.email ?? "", client.name ?? "",
          message, resendKey,
        );

        if (r === "sent") {
          totals.sent++;
          // Update return reminder status to notified
          await supabase
            .from("return_reminders")
            .update({ status: "notified", notified_at: new Date().toISOString() })
            .eq("id", returnItem.id);
        } else if (r === "failed") {
          totals.failed++;
        } else {
          totals.skipped++;
        }
      }
    }
  }

  return totals;
}

// ─── Trigger: client_inactive_days (original) ─────────────────────────────────

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
    const { data: tenant } = (await supabase
      .from("tenants")
      .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender")
      .eq("id", tenantId)
      .maybeSingle()) as unknown as SelectResult<TenantSettings | null>;
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
      const { data: apptRows, error: apptErr } = (await supabase
        .from("appointments")
        .select("patient_id, scheduled_at")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .gte("scheduled_at", lowerBound)
        .lte("scheduled_at", upperBound)
        .order("scheduled_at", { ascending: false })
        .limit(500)) as unknown as SelectResult<ApptWindowRow[] | null>;

      if (apptErr) {
        log("inactive appt query error", { tenant: tenantId, error: getErrorMessage(apptErr) });
        continue;
      }

      // Collect client IDs whose MOST RECENT appointment falls in this window
      // (meaning they haven't visited since then)
      const seen = new Set<string>();
      const candidateClientIds: string[] = [];
      for (const row of (apptRows ?? [])) {
        if (!seen.has(row.patient_id)) {
          seen.add(row.patient_id);
          candidateClientIds.push(row.patient_id);
        }
      }

      // Exclude clients who had a MORE RECENT appointment (after upperBound)
      if (candidateClientIds.length) {
        const { data: recentRows } = (await supabase
          .from("appointments")
          .select("patient_id")
          .eq("tenant_id", tenantId)
          .neq("status", "cancelled")
          .in("patient_id", candidateClientIds)
          .gt("scheduled_at", upperBound)) as unknown as SelectResult<ApptRecentRow[] | null>;

        const recentSet = new Set((recentRows ?? []).map((r) => r.patient_id));
        const trueInactiveIds = candidateClientIds.filter((id) => !recentSet.has(id));

        if (!trueInactiveIds.length) continue;

        const { data: clients } = (await supabase
          .from("patients")
          .select("id, name, phone, email")
          .in("id", trueInactiveIds)) as unknown as SelectResult<ClientRow[] | null>;

        for (const client of (clients ?? [])) {
          const vars: Record<string, string> = {
            patient_name: client.name ?? "",
            procedure_name: "",
            date: "",
            time: "",
            professional_name: "",
            clinic_name: tenant.name ?? "",
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

// ─── Trigger: queued notifications (consent_signed, return_scheduled, etc.) ───

type QueuedNotifRow = {
  id: string;
  tenant_id: string;
  recipient_id: string | null;
  template_type: string;
  metadata: Record<string, unknown>;
};

async function processQueuedNotifications(
  supabase: SupabaseClient,
  rules: AutomationRule[],
  triggerType: string,
  resendKey: string,
): Promise<DispatchResult> {
  const totals: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (!rules.length) return totals;

  // Fetch queued notifications matching this trigger type
  const { data: queued } = (await supabase
    .from("notification_logs")
    .select("id, tenant_id, recipient_id, template_type, metadata")
    .eq("template_type", triggerType)
    .eq("status", "queued")
    .limit(200)) as unknown as SelectResult<QueuedNotifRow[] | null>;

  if (!queued?.length) return totals;

  const byTenant = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = byTenant.get(r.tenant_id) ?? [];
    list.push(r);
    byTenant.set(r.tenant_id, list);
  }

  for (const notif of queued) {
    const tenantRules = byTenant.get(notif.tenant_id);
    if (!tenantRules?.length) {
      // Mark as processed even without rules
      await supabase
        .from("notification_logs")
        .update({ status: "skipped" })
        .eq("id", notif.id);
      totals.skipped++;
      continue;
    }

    if (!notif.recipient_id) {
      await supabase
        .from("notification_logs")
        .update({ status: "skipped", error_details: "no_recipient" })
        .eq("id", notif.id);
      totals.skipped++;
      continue;
    }

    // Get tenant settings
    const { data: tenant } = (await supabase
      .from("tenants")
      .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender")
      .eq("id", notif.tenant_id)
      .maybeSingle()) as unknown as SelectResult<TenantSettings | null>;

    if (!tenant) {
      totals.skipped++;
      continue;
    }

    // Get patient data
    const { data: client } = (await supabase
      .from("patients")
      .select("id, name, phone, email")
      .eq("id", notif.recipient_id)
      .maybeSingle()) as unknown as SelectResult<ClientRow | null>;

    if (!client) {
      await supabase
        .from("notification_logs")
        .update({ status: "skipped", error_details: "patient_not_found" })
        .eq("id", notif.id);
      totals.skipped++;
      continue;
    }

    // Build vars based on trigger type
    const vars: Record<string, string> = {
      patient_name: client.name ?? "",
      clinic_name: tenant.name ?? "",
      procedure_name: "",
      date: "",
      time: "",
      professional_name: "",
      nps_link: "",
    };

    // Add metadata-specific vars
    if (triggerType === "consent_signed") {
      vars.consent_template = String(notif.metadata?.template_id ?? "");
    } else if (triggerType === "return_scheduled") {
      const returnDate = notif.metadata?.return_date as string | undefined;
      vars.date = returnDate ? formatDateBR(returnDate) : "";
      vars.return_reason = String(notif.metadata?.reason ?? "");
    }

    let anySuccess = false;
    for (const rule of tenantRules) {
      const message = interpolate(rule.message_template, vars);
      const r = await dispatch(
        supabase, rule, tenant,
        "client", notif.recipient_id, `notif-${notif.id}`,
        client.phone ?? "", client.email ?? "", client.name ?? "",
        message, resendKey,
      );
      if (r === "sent") { totals.sent++; anySuccess = true; }
      else if (r === "failed") totals.failed++;
      else totals.skipped++;
    }

    // Mark notification as processed
    await supabase
      .from("notification_logs")
      .update({ status: anySuccess ? "sent" : "failed" })
      .eq("id", notif.id);
  }

  return totals;
}

// ─── Smart Confirmation (4h → 1h → auto-release) ──────────────────────────────

type SmartConfirmationResult = { sent_4h: number; sent_1h: number; released: number };

async function processSmartConfirmation(
  supabase: SupabaseClient,
  publicUrl: string,
  resendKey: string,
): Promise<SmartConfirmationResult> {
  const result: SmartConfirmationResult = { sent_4h: 0, sent_1h: 0, released: 0 };

  // Fetch tenants with smart confirmation enabled
  const { data: tenants, error: tErr } = (await supabase
    .from("tenants")
    .select("id, name, email, whatsapp_api_url, whatsapp_api_key, whatsapp_instance, sms_provider, sms_api_key, sms_sender, smart_confirmation_enabled, smart_confirmation_4h_channel, smart_confirmation_1h_channel, smart_confirmation_autorelease_minutes")
    .eq("smart_confirmation_enabled", true)) as unknown as SelectResult<TenantSettings[] | null>;

  if (tErr || !tenants?.length) return result;

  const now = new Date();

  for (const tenant of tenants) {
    const tenantId = tenant.id;
    const channel4h = (tenant.smart_confirmation_4h_channel ?? "whatsapp") as Channel;
    const channel1h = (tenant.smart_confirmation_1h_channel ?? "sms") as Channel;
    const autoReleaseMin = tenant.smart_confirmation_autorelease_minutes ?? 30;

    // ── 4h reminders: between 4h15m and 3h45m from now ──
    const lo4h = new Date(now.getTime() + (4 * 60 - 15) * 60_000).toISOString();
    const hi4h = new Date(now.getTime() + (4 * 60 + 15) * 60_000).toISOString();

    const { data: appts4h } = (await supabase
      .from("appointments")
      .select("id, patient_id, procedure_id, professional_id, scheduled_at")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"])
      .eq("confirmation_sent_4h", false)
      .gte("scheduled_at", lo4h)
      .lte("scheduled_at", hi4h)
      .is("confirmed_at", null)
      .limit(100)) as unknown as SelectResult<AppointmentRow[] | null>;

    for (const appt of appts4h ?? []) {
      if (!appt.patient_id) continue;

      const { data: client } = (await supabase
        .from("patients")
        .select("id, name, phone, email")
        .eq("id", appt.patient_id)
        .maybeSingle()) as unknown as SelectResult<ClientRow | null>;

      if (!client) continue;

      const { data: prof } = appt.professional_id
        ? (await supabase.from("profiles").select("full_name").eq("id", appt.professional_id).maybeSingle()) as unknown as SelectResult<ProfileRow | null>
        : { data: null };

      const confirmLink = publicUrl
        ? `${publicUrl}/confirmar/${appt.id}`
        : "";

      const message = `Olá ${client.name?.split(" ")[0] ?? ""}! 🏥\n\nSua consulta é hoje às ${formatTimeBR(appt.scheduled_at ?? "")}${prof?.full_name ? ` com ${prof.full_name}` : ""}.\n\n✅ Confirme sua presença: ${confirmLink}\n\nSe não puder comparecer, avise para liberarmos a vaga.\n\n${tenant.name ?? "Sua Clínica"}`;

      let sent = false;
      if (channel4h === "whatsapp" && client.phone) {
        const r = await sendWhatsapp(tenant, normalizePhone(client.phone), message);
        sent = r.ok;
      } else if (channel4h === "sms" && client.phone) {
        const r = await sendSms(tenant, normalizePhone(client.phone), message);
        sent = r.ok;
      } else if (channel4h === "email" && client.email) {
        const html = buildEmailHtml(message, tenant.name ?? "");
        const r = await sendEmail(resendKey, client.email, client.name ?? "", `⏰ Confirme sua consulta - ${tenant.name ?? ""}`, html, tenant.name ?? "", tenant.email);
        sent = r.ok;
      }

      if (sent) {
        await supabase
          .from("appointments")
          .update({ confirmation_sent_4h: true })
          .eq("id", appt.id);
        result.sent_4h++;
      }
    }

    // ── 1h reminders: between 1h10m and 50min from now ──
    const lo1h = new Date(now.getTime() + 50 * 60_000).toISOString();
    const hi1h = new Date(now.getTime() + 70 * 60_000).toISOString();

    const { data: appts1h } = (await supabase
      .from("appointments")
      .select("id, patient_id, procedure_id, professional_id, scheduled_at")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "confirmed"])
      .eq("confirmation_sent_4h", true)
      .eq("confirmation_sent_1h", false)
      .gte("scheduled_at", lo1h)
      .lte("scheduled_at", hi1h)
      .is("confirmed_at", null)
      .limit(100)) as unknown as SelectResult<AppointmentRow[] | null>;

    for (const appt of appts1h ?? []) {
      if (!appt.patient_id) continue;

      const { data: client } = (await supabase
        .from("patients")
        .select("id, name, phone, email")
        .eq("id", appt.patient_id)
        .maybeSingle()) as unknown as SelectResult<ClientRow | null>;

      if (!client) continue;

      const confirmLink = publicUrl
        ? `${publicUrl}/confirmar/${appt.id}`
        : "";

      const message = `⚠️ Última chamada!\n\n${client.name?.split(" ")[0] ?? ""}, sua consulta é em 1 hora (${formatTimeBR(appt.scheduled_at ?? "")}).\n\nConfirme agora: ${confirmLink}\n\nSem confirmação, a vaga será liberada para outro paciente.\n\n${tenant.name ?? ""}`;

      let sent = false;
      if (channel1h === "sms" && client.phone) {
        const r = await sendSms(tenant, normalizePhone(client.phone), message);
        sent = r.ok;
      } else if (channel1h === "whatsapp" && client.phone) {
        const r = await sendWhatsapp(tenant, normalizePhone(client.phone), message);
        sent = r.ok;
      } else if (channel1h === "email" && client.email) {
        const html = buildEmailHtml(message, tenant.name ?? "");
        const r = await sendEmail(resendKey, client.email, client.name ?? "", `⚠️ Confirme AGORA sua consulta - ${tenant.name ?? ""}`, html, tenant.name ?? "", tenant.email);
        sent = r.ok;
      }

      if (sent) {
        await supabase
          .from("appointments")
          .update({ confirmation_sent_1h: true })
          .eq("id", appt.id);
        result.sent_1h++;
      }
    }

    // ── Auto-release: unconfirmed within autorelease window ──
    const { data: releaseData } = (await supabase.rpc("auto_release_unconfirmed_appointments")) as unknown as SelectResult<{ released: number } | null>;
    result.released += (releaseData as any)?.released ?? 0;
  }

  log("Smart confirmation processed", result);
  return result;
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
    const { data: allRules, error: rulesErr } = (await supabase
      .from("automations")
      .select("*")
      .eq("is_active", true)) as unknown as SelectResult<AutomationRule[] | null>;

    if (rulesErr) throw rulesErr;

    const rules = (allRules ?? []) as AutomationRule[];
    const byType = (t: TriggerType) => rules.filter((r) => r.trigger_type === t);

    log("Worker started", { total_rules: rules.length, since_minutes: sinceMinutes });

    // Process all trigger types in parallel
    const [created, confirmed, r24h, r2h, completed, birthday, inactive, returnReminder, consentSigned, returnScheduled, smartConfirm] = await Promise.allSettled([
      processAppointmentTrigger(supabase, byType("appointment_created"), "appointment_created", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_confirmed"), "appointment_confirmed", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_reminder_24h"), "appointment_reminder_24h", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_reminder_2h"), "appointment_reminder_2h", sinceMinutes, publicUrl, resendKey),
      processAppointmentTrigger(supabase, byType("appointment_completed"), "appointment_completed", sinceMinutes, publicUrl, resendKey),
      processBirthdayTrigger(supabase, byType("birthday"), resendKey),
      processInactiveTrigger(supabase, byType("client_inactive_days"), resendKey),
      processReturnReminderTrigger(supabase, byType("return_reminder"), publicUrl, resendKey),
      processQueuedNotifications(supabase, byType("consent_signed"), "consent_signed", resendKey),
      processQueuedNotifications(supabase, byType("return_scheduled"), "return_scheduled", resendKey),
      processSmartConfirmation(supabase, publicUrl, resendKey),
    ]);

    const extract = (r: PromiseSettledResult<DispatchResult>): DispatchResult =>
      r.status === "fulfilled" ? r.value : { sent: 0, skipped: 0, failed: 0 };

    const totals = [created, confirmed, r24h, r2h, completed, birthday, inactive, returnReminder, consentSigned, returnScheduled].reduce(
      (acc, r) => {
        const v = extract(r);
        return { sent: acc.sent + v.sent, skipped: acc.skipped + v.skipped, failed: acc.failed + v.failed };
      },
      { sent: 0, skipped: 0, failed: 0 },
    );

    const smartResult = smartConfirm.status === "fulfilled" ? smartConfirm.value : { sent_4h: 0, sent_1h: 0, released: 0 };

    log("Worker finished", { ...totals, smart_confirmation: smartResult });

    return new Response(JSON.stringify({ success: true, ...totals, smart_confirmation: smartResult }), {
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
