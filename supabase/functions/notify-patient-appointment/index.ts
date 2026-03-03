import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("NOTIFY-PATIENT-APPOINTMENT");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface AppointmentNotificationPayload {
  appointment_id: string;
  notification_type: "created" | "confirmed" | "updated" | "cancelled" | "reminder";
}

interface AppointmentDetails {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  professional: {
    id: string;
    full_name: string;
  };
  service: {
    id: string;
    name: string;
    duration_minutes: number;
  };
  tenant: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada");
    return false;
  }

  try {
    const emailFrom = Deno.env.get("EMAIL_FROM") || "ClinicNest <no-reply@metaclass.com.br>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar", { status: response.status, error: errorText });
      return false;
    }

    log("EMAIL: Enviado com sucesso", { to });
    return true;
  } catch (error) {
    log("EMAIL: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function sendPushNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const { data: tokens, error } = await supabaseAdmin
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", userId);

    if (error || !tokens?.length) {
      log("PUSH: Nenhum token encontrado", { userId });
      return false;
    }

    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmServerKey) {
      log("PUSH: FCM_SERVER_KEY não configurada");
      return false;
    }

    for (const { token } of tokens) {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Authorization": `key=${fcmServerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data: data ?? {},
        }),
      });

      if (!response.ok) {
        log("PUSH: Erro ao enviar", { token: token.substring(0, 10) + "..." });
      }
    }

    log("PUSH: Notificações enviadas", { userId, count: tokens.length });
    return true;
  } catch (error) {
    log("PUSH: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function formatDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function getEmailTemplate(
  type: AppointmentNotificationPayload["notification_type"],
  details: AppointmentDetails
): { subject: string; html: string; text: string } {
  const { date, time } = formatDateTime(details.start_time);
  const clinicName = details.tenant.name;
  const patientName = details.client.name.split(" ")[0];
  const professionalName = details.professional.full_name;
  const serviceName = details.service.name;

  const templates = {
    created: {
      subject: `✅ Consulta agendada - ${clinicName}`,
      title: "Consulta Agendada com Sucesso!",
      message: `Sua consulta foi agendada para <strong>${date}</strong> às <strong>${time}</strong>.`,
      color: "#10b981",
    },
    confirmed: {
      subject: `✅ Consulta confirmada - ${clinicName}`,
      title: "Consulta Confirmada pela Clínica!",
      message: `Sua consulta para <strong>${date}</strong> às <strong>${time}</strong> foi <strong>confirmada</strong> pela clínica.`,
      color: "#059669",
    },
    updated: {
      subject: `📝 Consulta reagendada - ${clinicName}`,
      title: "Consulta Reagendada",
      message: `Sua consulta foi reagendada para <strong>${date}</strong> às <strong>${time}</strong>.`,
      color: "#f59e0b",
    },
    cancelled: {
      subject: `❌ Consulta cancelada - ${clinicName}`,
      title: "Consulta Cancelada",
      message: `Sua consulta que estava marcada para <strong>${date}</strong> às <strong>${time}</strong> foi cancelada.`,
      color: "#ef4444",
    },
    reminder: {
      subject: `⏰ Lembrete de consulta - ${clinicName}`,
      title: "Lembrete de Consulta",
      message: `Não esqueça! Sua consulta está marcada para <strong>${date}</strong> às <strong>${time}</strong>.`,
      color: "#3b82f6",
    },
  };

  const t = templates[type];

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: ${t.color}; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${t.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">Olá, <strong>${patientName}</strong>!</p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">${t.message}</p>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Serviço:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">${serviceName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Profissional:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">${professionalName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Data:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">${date}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Horário:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">${time}</span>
                    </td>
                  </tr>
                  ${details.tenant.address ? `
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Local:</span>
                      <span style="color: #1f2937; font-size: 14px; float: right;">${details.tenant.address}</span>
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </div>

              ${details.tenant.phone ? `
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                Dúvidas? Entre em contato: <strong>${details.tenant.phone}</strong>
              </p>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
${t.title}

Olá, ${patientName}!

${t.message.replace(/<[^>]*>/g, "")}

Detalhes:
- Serviço: ${serviceName}
- Profissional: ${professionalName}
- Data: ${date}
- Horário: ${time}
${details.tenant.address ? `- Local: ${details.tenant.address}` : ""}

${details.tenant.phone ? `Dúvidas? Entre em contato: ${details.tenant.phone}` : ""}

© ${new Date().getFullYear()} ${clinicName}
`.trim();

  return { subject: t.subject, html, text };
}

function getPushMessage(
  type: AppointmentNotificationPayload["notification_type"],
  details: AppointmentDetails
): { title: string; body: string } {
  const { date, time } = formatDateTime(details.start_time);
  const clinicName = details.tenant.name;

  const messages = {
    created: {
      title: "Consulta Agendada ✅",
      body: `${details.service.name} em ${date} às ${time} - ${clinicName}`,
    },
    confirmed: {
      title: "Consulta Confirmada ✅",
      body: `Sua consulta em ${date} às ${time} foi confirmada! - ${clinicName}`,
    },
    updated: {
      title: "Consulta Reagendada 📝",
      body: `Nova data: ${date} às ${time} - ${clinicName}`,
    },
    cancelled: {
      title: "Consulta Cancelada ❌",
      body: `Sua consulta em ${clinicName} foi cancelada`,
    },
    reminder: {
      title: "Lembrete de Consulta ⏰",
      body: `Amanhã às ${time} - ${details.service.name} em ${clinicName}`,
    },
  };

  return messages[type];
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const payload: AppointmentNotificationPayload = await req.json();
    const { appointment_id, notification_type } = payload;

    if (!appointment_id || !notification_type) {
      return new Response(
        JSON.stringify({ error: "appointment_id e notification_type são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Processando notificação", { appointment_id, notification_type });

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        status,
        notes,
        patient_id,
        professional_id,
        procedure_id,
        tenant_id
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      log("Agendamento não encontrado", { appointment_id });
      return new Response(
        JSON.stringify({ error: "Agendamento não encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Calcular end_time a partir de scheduled_at + duration_minutes
    const startDt = new Date(appointment.scheduled_at);
    const endDt = new Date(startDt.getTime() + (appointment.duration_minutes || 30) * 60 * 1000);

    const [clientResult, professionalResult, serviceResult, tenantResult] = await Promise.all([
      supabaseAdmin.from("patients").select("id, name, email, phone").eq("id", appointment.patient_id).single(),
      supabaseAdmin.from("profiles").select("id, full_name").eq("user_id", appointment.professional_id).single(),
      supabaseAdmin.from("procedures").select("id, name, duration_minutes").eq("id", appointment.procedure_id).single(),
      supabaseAdmin.from("tenants").select("id, name, phone, address").eq("id", appointment.tenant_id).single(),
    ]);

    if (!clientResult.data?.email) {
      log("Cliente sem email", { patient_id: appointment.patient_id });
      return new Response(
        JSON.stringify({ error: "Cliente não possui email cadastrado" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const details: AppointmentDetails = {
      id: appointment.id,
      start_time: appointment.scheduled_at,
      end_time: endDt.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
      client: clientResult.data,
      professional: professionalResult.data ?? { id: "", full_name: "Profissional" },
      service: serviceResult.data ?? { id: "", name: "Consulta", duration_minutes: 30 },
      tenant: tenantResult.data ?? { id: "", name: "Clínica" },
    };

    const emailTemplate = getEmailTemplate(notification_type, details);
    const pushMessage = getPushMessage(notification_type, details);

    const [emailSent, pushSent] = await Promise.all([
      sendEmailViaResend(details.client.email, emailTemplate.subject, emailTemplate.html, emailTemplate.text),
      clientResult.data.id
        ? sendPushNotification(supabaseAdmin, clientResult.data.id, pushMessage.title, pushMessage.body, {
            type: "appointment",
            appointment_id,
            notification_type,
          })
        : Promise.resolve(false),
    ]);

    await supabaseAdmin.from("notification_logs").insert({
      tenant_id: appointment.tenant_id,
      recipient_type: "patient",
      recipient_id: appointment.patient_id,
      channel: "email",
      template_type: `appointment_${notification_type}`,
      status: emailSent ? "sent" : "failed",
      metadata: { appointment_id, notification_type },
    });

    log("Notificação processada", { emailSent, pushSent });

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        push_sent: pushSent,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
