/**
 * public-booking — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const log = createLogger("PUBLIC-BOOKING");

type Action = "get_context" | "get_slots" | "create" | "cancel" | "confirm";

type Body =
  | { action: "get_context"; slug: string }
  | { action: "get_slots"; slug: string; professional_id: string; service_id: string; date: string }
  | {
      action: "create";
      slug: string;
      service_id: string;
      professional_id: string;
      scheduled_at: string;
      client_name: string;
      client_email?: string | null;
      client_phone?: string | null;
      notes?: string | null;
    }
  | { action: "cancel"; token: string; reason?: string | null }
  | { action: "confirm"; token: string };

function toTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidISODate(value: string): boolean {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  clinicName?: string,
  clinicEmail?: string | null): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  const senderDomain = process.env.CLINIC_EMAIL_DOMAIN || "metaclass.com.br";
  const emailFrom = clinicName
    ? `${clinicName} <notificacoes@${senderDomain}>`
    : `ClinicNest <notificacoes@${senderDomain}>`;

  try {
    const payload: Record<string, unknown> = {
      from: emailFrom,
      to,
      subject,
      html,
      text,
    };
    if (clinicEmail) payload.reply_to = clinicEmail;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", { status: response.status, error: errorText });
      return false;
    }

    const result: any = await response.json() as any;
    log("EMAIL: E-mail enviado com sucesso via Resend", { emailId: result.id });
    return true;
  } catch (error: any) {
    log("EMAIL: Exceção ao enviar e-mail", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

function getBookingConfirmationEmailHtml(input: {
  tenantName: string;
  serviceName: string;
  professionalName: string;
  scheduledAtLocal: string;
  cancelUrl: string;
  confirmUrl: string;
  clientName: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de agendamento</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0fdfa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,148,136,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0891b2 100%);padding:32px 28px;color:#fff;text-align:center;">
              <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px;">${escapeHtml(input.tenantName)}</div>
              <div style="font-size:24px;font-weight:800;">Agendamento Confirmado</div>
              <div style="opacity:.88;margin-top:6px;font-size:14px;">Seu horário foi reservado com sucesso</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 18px;color:#374151;line-height:1.6;font-size:15px;">Olá, <strong>${escapeHtml(input.clientName)}</strong>! Seu agendamento foi registrado com sucesso.</p>
              <div style="border-left:4px solid #0d9488;border-radius:10px;padding:16px 18px;background:#f0fdfa;margin-bottom:20px;">
                <div style="color:#0f766e;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Detalhes do agendamento</div>
                <div style="color:#111827;font-size:15px;font-weight:700;margin-bottom:8px;">${escapeHtml(input.serviceName)}</div>
                <div style="color:#374151;font-size:14px;margin-bottom:6px;">Profissional: <strong>${escapeHtml(input.professionalName)}</strong></div>
                <div style="color:#374151;font-size:14px;">Horário: <strong>${escapeHtml(input.scheduledAtLocal)}</strong></div>
              </div>
              ${input.confirmUrl ? `<p style="margin:0 0 14px;text-align:center;"><a href="${input.confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;box-shadow:0 2px 8px rgba(13,148,136,0.25);">Confirmar presença</a></p>` : ""}
              <p style="margin:14px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">Se precisar cancelar, utilize o link abaixo (sujeito à política de antecedência da clínica):</p>
              <p style="margin:10px 0 0;"><a href="${input.cancelUrl}" style="color:#0d9488;font-weight:700;">Cancelar agendamento</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f0fdfa;border-top:1px solid #ccfbf1;padding:16px 18px;text-align:center;">
              <div style="color:#6b7280;font-size:12px;">${escapeHtml(input.tenantName)} · Enviado via ClinicNest</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:4px;">Mensagem automática. Não responda este e-mail.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getBookingConfirmationEmailText(input: {
  tenantName: string;
  serviceName: string;
  professionalName: string;
  scheduledAtLocal: string;
  cancelUrl: string;
  confirmUrl: string;
  clientName: string;
}): string {
  return `
${input.tenantName} - Confirmação de agendamento

Olá, ${input.clientName}.

Seu agendamento foi registrado com sucesso:
- Procedimento: ${input.serviceName}
- Profissional: ${input.professionalName}
- Horário: ${input.scheduledAtLocal}

${input.confirmUrl ? `Confirmar presença:\n${input.confirmUrl}\n` : ""}
Para cancelar (sujeito à política da clínica):
${input.cancelUrl}
  `.trim();
}

export async function publicBooking(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }
    const requesterIp =
      (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() ||
      (req.headers['cf-connecting-ip'] as string) ||
      "unknown";

    let body: Body;
    try {
      body = (req.body) as Body;
    } catch {
      return res.status(400).json({ error: "Corpo da requisição inválido" });
    }

    const action = (body as any)?.action as Action;
    if (!action) {
      return res.status(400).json({ error: "action é obrigatório" });
    }

    const rl = await checkRateLimit(`public-booking:${action}:${requesterIp}`, 30, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
    }

    if (action === "get_context") {
      const slug = toTrimmedString((body as any).slug, 80);
      if (!slug) {
        return res.status(400).json({ error: "slug é obrigatório" });
      }

      const { data: tenant, error: tenantError } = await db.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );

      if (tenantError || !tenant) {
        return res.status(404).json({ error: "Clínica não encontrada" });
      }

      if ((tenant as any).online_booking_enabled !== true) {
        return res.status(403).json({
          success: false,
          message: "Agendamento online indisponível",
          details: "BOOKING_DISABLED",
        });
      }

      const tenantId = String((tenant as any).id);

      const [servicesRes, profsRes] = await Promise.all([
        db.from("services")
          .select("id, name, description, duration_minutes, price")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        db.from("profiles")
          .select("id, full_name")
          .eq("tenant_id", tenantId)
          .order("full_name", { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (profsRes.error) throw profsRes.error;

      return res.status(200).json({
        success: true,
        tenant: {
          id: tenantId,
          name: (tenant as any).name,
          slug: (tenant as any).online_booking_slug,
          min_lead_minutes: (tenant as any).online_booking_min_lead_minutes,
          cancel_min_lead_minutes: (tenant as any).online_booking_cancel_min_lead_minutes,
        },
        services: servicesRes.data || [],
        professionals: profsRes.data || [],
      });
    }

    if (action === "get_slots") {
      const slug = toTrimmedString((body as any).slug, 80);
      const professionalId = toTrimmedString((body as any).professional_id, 60);
      const serviceId = toTrimmedString((body as any).service_id, 60);
      const date = toTrimmedString((body as any).date, 10);

      if (!slug || !professionalId || !serviceId || !date) {
        return res.status(400).json({ error: "slug, professional_id, service_id e date são obrigatórios" });
      }

      if (!isValidISODate(date)) {
        return res.status(400).json({ error: "date inválida" });
      }

      const { data: tenant, error: tenantError } = await db.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );
      if (tenantError || !tenant) {
        return res.status(404).json({ error: "Clínica não encontrada" });
      }

      const tenantId = String((tenant as any).id);

      const [{ data: service, error: serviceError }, { data: wh, error: whError }] = await Promise.all([
        db.from("services")
          .select("id, duration_minutes")
          .eq("tenant_id", tenantId)
          .eq("id", serviceId)
          .maybeSingle(),
        db.from("professional_working_hours")
          .select("start_time, end_time, is_active, day_of_week")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId),
      ]);

      if (serviceError) throw serviceError;
      if (whError) throw whError;

      const duration = Math.max(1, Number((service as any)?.duration_minutes ?? 45));

      const targetDate = new Date(`${date}T00:00:00-03:00`);
      const dayOfWeek = (targetDate.getDay() + 6) % 7; // convert JS (0=Sun) to 0=Mon

      const whRow = (wh || []).find((r: any) => Number(r.day_of_week) === dayOfWeek && r.is_active === true);
      if (!whRow) {
        return res.status(200).json({ success: true, slots: [] });
      }

      const startTime = String((whRow as any).start_time);
      const endTime = String((whRow as any).end_time);

      const dayStart = new Date(`${date}T00:00:00-03:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59-03:00`).toISOString();

      const [aptsRes, blocksRes] = await Promise.all([
        db.from("appointments")
          .select("scheduled_at, duration_minutes, status")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId)
          .neq("status", "cancelled")
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd),
        db.from("schedule_blocks")
          .select("start_at, end_at, professional_id")
          .eq("tenant_id", tenantId)
          .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
          .gte("end_at", dayStart)
          .lte("start_at", dayEnd),
      ]);

      if (aptsRes.error) throw aptsRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const busyRanges: Array<{ start: number; end: number }> = [];
      for (const a of aptsRes.data || []) {
        const s = new Date((a as any).scheduled_at).getTime();
        const e = s + Number((a as any).duration_minutes ?? 0) * 60_000;
        busyRanges.push({ start: s, end: e });
      }
      for (const b of blocksRes.data || []) {
        const s = new Date((b as any).start_at).getTime();
        const e = new Date((b as any).end_at).getTime();
        busyRanges.push({ start: s, end: e });
      }

      const slots: string[] = [];
      const slotStart = new Date(`${date}T${startTime}-03:00`).getTime();
      const slotEnd = new Date(`${date}T${endTime}-03:00`).getTime();
      const stepMinutes = 15;

      for (let t = slotStart; t + duration * 60_000 <= slotEnd; t += stepMinutes * 60_000) {
        const tEnd = t + duration * 60_000;
        const overlaps = busyRanges.some((r: any) => t < r.end && tEnd > r.start);
        if (!overlaps) {
          slots.push(new Date(t).toISOString());
        }
      }

      return res.status(200).json({ success: true, slots });
    }

    if (action === "create") {
      const slug = toTrimmedString((body as any).slug, 80);
      const serviceId = toTrimmedString((body as any).service_id, 60);
      const professionalId = toTrimmedString((body as any).professional_id, 60);
      const scheduledAt = toTrimmedString((body as any).scheduled_at, 80);
      const clientName = toTrimmedString((body as any).client_name, 120);
      const clientEmailRaw = toTrimmedString((body as any).client_email, 160);
      const clientPhone = toTrimmedString((body as any).client_phone, 40);
      const notes = toTrimmedString((body as any).notes, 500);

      if (!slug || !serviceId || !professionalId || !scheduledAt || !clientName) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes" });
      }

      const clientEmail = clientEmailRaw ? clientEmailRaw : "";
      if (clientEmail && !isValidEmail(clientEmail)) {
        return res.status(400).json({ error: "E-mail inválido" });
      }

      const { data: createRes, error: createErr } = await db.rpc("create_public_appointment_v1", {
        p_tenant_slug: slug,
        p_service_id: serviceId,
        p_professional_profile_id: professionalId,
        p_scheduled_at: scheduledAt,
        p_client_name: clientName,
        p_client_email: clientEmail || null,
        p_client_phone: clientPhone || null,
        p_notes: notes || null,
      });

      if (createErr) {
        return res.status(400).json({
          success: false,
          message: createErr.message,
          details: (createErr as any).details,
          code: (createErr as any).code,
        });
      }

      const appointmentId = String((createRes as any)?.appointment_id ?? "");
      const token = String((createRes as any)?.public_booking_token ?? "");

      const { data: tenant, error: tenantError } = await db.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );
      if (tenantError || !tenant) {
        return res.status(200).json({ success: true, appointment_id: appointmentId, token });
      }

      const tenantId = String((tenant as any).id);
      const [{ data: service }, { data: prof }] = await Promise.all([
        db.from("services")
          .select("name")
          .eq("tenant_id", tenantId)
          .eq("id", serviceId)
          .maybeSingle(),
        db.from("profiles")
          .select("full_name")
          .eq("tenant_id", tenantId)
          .eq("id", professionalId)
          .maybeSingle(),
      ]);

      const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.PUBLIC_SITE_URL);
      const cancelUrl  = siteUrl ? `${siteUrl}/agendar/${encodeURIComponent(slug)}?cancelToken=${encodeURIComponent(token)}` : "";
      const confirmUrl = siteUrl ? `${siteUrl}/confirmar/${encodeURIComponent(token)}` : "";

      if (clientEmail) {
        const scheduledLocal = new Date(scheduledAt).toLocaleString("pt-BR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        });

        const html = getBookingConfirmationEmailHtml({
          tenantName: String((tenant as any).name ?? "ClinicNest"),
          serviceName: String((service as any)?.name ?? "Procedimento"),
          professionalName: String((prof as any)?.full_name ?? "Profissional"),
          scheduledAtLocal: scheduledLocal,
          cancelUrl: cancelUrl || "",
          confirmUrl: confirmUrl || "",
          clientName,
        });

        const text = getBookingConfirmationEmailText({
          tenantName: String((tenant as any).name ?? "ClinicNest"),
          serviceName: String((service as any)?.name ?? "Procedimento"),
          professionalName: String((prof as any)?.full_name ?? "Profissional"),
          scheduledAtLocal: scheduledLocal,
          cancelUrl: cancelUrl || "",
          confirmUrl: confirmUrl || "",
          clientName,
        });

        const clinicName = String((tenant as any).name ?? "ClinicNest");
        const clinicEmail = (tenant as any).email ?? null;
        await sendEmailViaResend(clientEmail, "Confirmação de agendamento", html, text, clinicName, clinicEmail);
      }

      return res.status(200).json({ success: true, appointment_id: appointmentId, token });
    }

    if (action === "cancel") {
      const token = toTrimmedString((body as any).token, 80);
      const reason = toTrimmedString((body as any).reason, 300);

      if (!token) {
        return res.status(400).json({ error: "token é obrigatório" });
      }

      const { data, error } = await db.rpc("cancel_public_appointment_v1", {
        p_public_booking_token: token,
        p_reason: reason || null,
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
          details: (error as any).details,
          code: (error as any).code,
        });
      }

      return res.status(200).json({ success: true, ...(data as any) });
    }

    if (action === "confirm") {
      const token = toTrimmedString((body as any).token, 80);

      if (!token) {
        return res.status(400).json({ error: "token é obrigatório" });
      }

      // Busca o agendamento pelo token público
      const { data: apt, error: aptError } = await db.from("appointments")
        .select("id, status, confirmed_at")
        .eq("public_booking_token", token)
        .maybeSingle();

      if (aptError) {
        return res.status(400).json({ success: false, message: aptError.message });
      }

      if (!apt) {
        return res.status(404).json({ success: false, message: "Agendamento não encontrado" });
      }

      if ((apt as any).status === "cancelled") {
        return res.status(400).json({ success: false, message: "Este agendamento já foi cancelado" });
      }

      // Se já confirmado, retorna sucesso silencioso (idempotente)
      if ((apt as any).confirmed_at) {
        return res.status(200).json({ success: true, already_confirmed: true });
      }

      const { error: updateError } = await db.from("appointments")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("public_booking_token", token);

      if (updateError) {
        return res.status(500).json({ success: false, message: updateError.message });
      }

      return res.status(200).json({ success: true, already_confirmed: false });
    }

    return res.status(400).json({ error: "action inválida" });
  } catch (err: any) {
    console.error(`[public-booking] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
