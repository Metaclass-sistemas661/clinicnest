import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("NOTIFY-PATIENT-EVENTS");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EventType =
  | "consent_signed"
  | "return_scheduled"
  | "return_reminder"
  | "exam_ready"
  | "appointment_cancelled";

interface EventPayload {
  event_type: EventType;
  tenant_id: string;
  client_id: string;
  metadata?: Record<string, unknown>;
}

// ─── Email via Resend ──────────────────────────────────────────────────────────

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return false;

  try {
    const emailFrom = Deno.env.get("EMAIL_FROM") || "ClinicNest <no-reply@metaclass.com.br>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: emailFrom, to, subject, html, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Push Notification ─────────────────────────────────────────────────────────

async function sendPushNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  title: string,
  body: string,
): Promise<boolean> {
  try {
    const { data: clientUser } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("id", clientId)
      .single();

    if (!clientUser?.user_id) return false;

    const { data: tokens } = await supabaseAdmin
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", clientUser.user_id);

    if (!tokens?.length) return false;

    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmServerKey) return false;

    for (const { token } of tokens) {
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: { Authorization: `key=${fcmServerKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: token, notification: { title, body } }),
      });
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function buildConsentSignedEmail(
  clientName: string,
  clinicName: string,
  templateTitle: string,
): { subject: string; html: string; text: string } {
  const subject = `✅ Termo assinado com sucesso - ${clinicName}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">✅ Termo Assinado</h1>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="margin:0 0 20px;color:#374151;font-size:16px;">Olá, <strong>${clientName}</strong>!</p>
          <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.6;">
            Confirmamos que o termo <strong>"${templateTitle}"</strong> foi assinado com sucesso em nosso sistema.
          </p>
          <div style="background-color:#f0fdf4;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #10b981;">
            <p style="margin:0;color:#166534;font-size:14px;">
              📋 <strong>Documento:</strong> ${templateTitle}<br>
              📅 <strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}<br>
              🕐 <strong>Hora:</strong> ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <p style="margin:24px 0 0;color:#6b7280;font-size:14px;text-align:center;">
            Uma cópia deste documento pode ser acessada no seu portal do paciente.
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Olá, ${clientName}! O termo "${templateTitle}" foi assinado com sucesso em ${new Date().toLocaleDateString("pt-BR")}. - ${clinicName}`;
  return { subject, html, text };
}

function buildReturnScheduledEmail(
  clientName: string,
  clinicName: string,
  returnDate: string,
  reason: string,
  confirmLink?: string,
): { subject: string; html: string; text: string } {
  const subject = `📅 Retorno agendado - ${clinicName}`;
  const dateParts = returnDate.split("-");
  const formattedDate = dateParts.length === 3
    ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
    : returnDate;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">📅 Retorno Agendado</h1>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="margin:0 0 20px;color:#374151;font-size:16px;">Olá, <strong>${clientName}</strong>!</p>
          <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.6;">
            Um retorno foi agendado para você:
          </p>
          <div style="background-color:#f5f3ff;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #7c3aed;">
            <p style="margin:0;color:#4c1d95;font-size:14px;">
              📅 <strong>Data prevista:</strong> ${formattedDate}<br>
              ${reason ? `📋 <strong>Motivo:</strong> ${reason}<br>` : ""}
            </p>
          </div>
          ${confirmLink ? `
          <div style="text-align:center;margin:24px 0;">
            <a href="${confirmLink}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:600;font-size:16px;">
              Confirmar Retorno
            </a>
          </div>
          ` : ""}
          <p style="margin:24px 0 0;color:#6b7280;font-size:14px;text-align:center;">
            Entre em contato conosco caso precise reagendar.
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Olá, ${clientName}! Seu retorno está agendado para ${formattedDate}${reason ? ` (${reason})` : ""}. ${confirmLink ? `Confirme em: ${confirmLink}` : ""} - ${clinicName}`;
  return { subject, html, text };
}

function buildExamReadyEmail(
  clientName: string,
  clinicName: string,
  examName: string,
): { subject: string; html: string; text: string } {
  const subject = `🔬 Resultado de exame disponível - ${clinicName}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">🔬 Exame Disponível</h1>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="margin:0 0 20px;color:#374151;font-size:16px;">Olá, <strong>${clientName}</strong>!</p>
          <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.6;">
            O resultado do seu exame <strong>"${examName}"</strong> está disponível.
          </p>
          <div style="background-color:#f0f9ff;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #0ea5e9;">
            <p style="margin:0;color:#0c4a6e;font-size:14px;">
              Acesse seu portal do paciente para visualizar o resultado completo.
            </p>
          </div>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Olá, ${clientName}! O resultado do exame "${examName}" está disponível. Acesse seu portal para visualizar. - ${clinicName}`;
  return { subject, html, text };
}

function buildAppointmentCancelledEmail(
  clientName: string,
  clinicName: string,
  date: string,
  time: string,
  serviceName: string,
): { subject: string; html: string; text: string } {
  const subject = `❌ Consulta cancelada - ${clinicName}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <tr><td style="background:#ef4444;padding:30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">❌ Consulta Cancelada</h1>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="margin:0 0 20px;color:#374151;font-size:16px;">Olá, <strong>${clientName}</strong>!</p>
          <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.6;">
            Informamos que sua consulta foi cancelada.
          </p>
          <div style="background-color:#fef2f2;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #ef4444;">
            <p style="margin:0;color:#991b1b;font-size:14px;">
              📌 <strong>Serviço:</strong> ${serviceName}<br>
              📅 <strong>Data:</strong> ${date}<br>
              🕐 <strong>Horário:</strong> ${time}
            </p>
          </div>
          <p style="margin:24px 0 0;color:#6b7280;font-size:14px;text-align:center;">
            Se deseja reagendar, entre em contato conosco ou acesse o portal do paciente.
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Olá, ${clientName}! Sua consulta de ${serviceName} em ${date} às ${time} foi cancelada. Entre em contato para reagendar. - ${clinicName}`;
  return { subject, html, text };
}

// ─── Edge Function ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const payload: EventPayload = await req.json();
    const { event_type, tenant_id, client_id, metadata } = payload;

    if (!event_type || !tenant_id || !client_id) {
      return new Response(
        JSON.stringify({ error: "event_type, tenant_id e client_id são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Processando evento", { event_type, tenant_id });

    // Fetch client and tenant data
    const [clientResult, tenantResult] = await Promise.all([
      supabaseAdmin.from("clients").select("id, name, email, phone, user_id").eq("id", client_id).single(),
      supabaseAdmin.from("tenants").select("id, name, phone, address").eq("id", tenant_id).single(),
    ]);

    if (!clientResult.data) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const client = clientResult.data;
    const tenant = tenantResult.data ?? { id: tenant_id, name: "Clínica", phone: null, address: null };
    const clientName = (client.name ?? "").split(" ")[0] || "Paciente";
    const clinicName = tenant.name ?? "Sua Clínica";

    let emailTemplate: { subject: string; html: string; text: string } | null = null;
    let pushTitle = "";
    let pushBody = "";

    switch (event_type) {
      case "consent_signed": {
        const templateTitle = String(metadata?.template_title ?? "Termo de Consentimento");
        emailTemplate = buildConsentSignedEmail(clientName, clinicName, templateTitle);
        pushTitle = "Termo Assinado ✅";
        pushBody = `O termo "${templateTitle}" foi assinado com sucesso.`;
        break;
      }

      case "return_scheduled": {
        const returnDate = String(metadata?.return_date ?? "");
        const reason = String(metadata?.reason ?? "");
        const confirmLink = metadata?.confirm_link as string | undefined;
        emailTemplate = buildReturnScheduledEmail(clientName, clinicName, returnDate, reason, confirmLink);
        pushTitle = "Retorno Agendado 📅";
        pushBody = `Seu retorno está previsto para ${returnDate}${reason ? ` (${reason})` : ""}`;
        break;
      }

      case "return_reminder": {
        const returnDate = String(metadata?.return_date ?? "");
        const reason = String(metadata?.reason ?? "");
        const confirmLink = metadata?.confirm_link as string | undefined;
        emailTemplate = buildReturnScheduledEmail(clientName, clinicName, returnDate, reason, confirmLink);
        emailTemplate.subject = `⏰ Lembrete de retorno - ${clinicName}`;
        pushTitle = "Lembrete de Retorno ⏰";
        pushBody = `Não esqueça! Seu retorno está marcado para ${returnDate}`;
        break;
      }

      case "exam_ready": {
        const examName = String(metadata?.exam_name ?? "Exame");
        emailTemplate = buildExamReadyEmail(clientName, clinicName, examName);
        pushTitle = "Exame Disponível 🔬";
        pushBody = `O resultado do exame "${examName}" está disponível.`;
        break;
      }

      case "appointment_cancelled": {
        const date = String(metadata?.date ?? "");
        const time = String(metadata?.time ?? "");
        const serviceName = String(metadata?.service_name ?? "Consulta");
        emailTemplate = buildAppointmentCancelledEmail(clientName, clinicName, date, time, serviceName);
        pushTitle = "Consulta Cancelada ❌";
        pushBody = `Sua consulta de ${serviceName} foi cancelada.`;
        break;
      }
    }

    const results: Record<string, boolean> = {};

    // Send email
    if (emailTemplate && client.email) {
      const emailSent = await sendEmailViaResend(client.email, emailTemplate.subject, emailTemplate.html, emailTemplate.text);
      results.email = emailSent;
    }

    // Send push
    if (pushTitle && client.id) {
      const pushSent = await sendPushNotification(supabaseAdmin, client.id, pushTitle, pushBody);
      results.push = pushSent;
    }

    // Log notification
    await supabaseAdmin.from("notification_logs").insert({
      tenant_id,
      recipient_type: "patient",
      recipient_id: client_id,
      channel: "email",
      template_type: event_type,
      status: results.email ? "sent" : "failed",
      metadata: { event_type, ...(metadata ?? {}) },
    });

    log("Evento processado", { event_type, results });

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
