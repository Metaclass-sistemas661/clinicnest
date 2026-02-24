import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("NOTIFY-PATIENT-MESSAGE");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface MessageNotificationPayload {
  message_id: string;
  conversation_id: string;
}

interface MessageDetails {
  id: string;
  content: string;
  created_at: string;
  sender_type: "clinic" | "patient";
  conversation: {
    id: string;
    patient_id: string;
    tenant_id: string;
    subject?: string;
  };
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    user_id?: string;
  };
  tenant: {
    id: string;
    name: string;
    phone?: string;
  };
  sender?: {
    full_name: string;
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

function truncateMessage(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength - 3) + "...";
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEmailTemplate(details: MessageDetails): { subject: string; html: string; text: string } {
  const patientName = details.patient.name.split(" ")[0];
  const clinicName = details.tenant.name;
  const senderName = details.sender?.full_name || clinicName;
  const messagePreview = truncateMessage(details.content, 200);
  const messageTime = formatDateTime(details.created_at);
  const siteUrl = Deno.env.get("SITE_URL") || "https://clinicnest.metaclass.com.br";
  const messagesUrl = `${siteUrl}/paciente/mensagens`;

  const subject = `💬 Nova mensagem de ${clinicName}`;

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
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Nova Mensagem</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">Olá, <strong>${patientName}</strong>!</p>
              
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Você recebeu uma nova mensagem de <strong>${clinicName}</strong>.
              </p>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #7c3aed;">
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">De: ${senderName}</span>
                  <span style="color: #9ca3af; font-size: 12px; float: right;">${messageTime}</span>
                </div>
                ${details.conversation.subject ? `
                <div style="margin-bottom: 12px;">
                  <span style="color: #374151; font-size: 14px; font-weight: 600;">Assunto: ${details.conversation.subject}</span>
                </div>
                ` : ""}
                <div style="color: #1f2937; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${messagePreview}</div>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${messagesUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Ver Mensagem Completa
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                Acesse o portal do paciente para responder.
              </p>
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
Nova Mensagem de ${clinicName}

Olá, ${patientName}!

Você recebeu uma nova mensagem de ${clinicName}.

De: ${senderName}
Data: ${messageTime}
${details.conversation.subject ? `Assunto: ${details.conversation.subject}` : ""}

Mensagem:
${messagePreview}

Acesse para ver a mensagem completa e responder: ${messagesUrl}

© ${new Date().getFullYear()} ${clinicName}
`.trim();

  return { subject, html, text };
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
    const payload: MessageNotificationPayload = await req.json();
    const { message_id, conversation_id } = payload;

    if (!message_id || !conversation_id) {
      return new Response(
        JSON.stringify({ error: "message_id e conversation_id são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Processando notificação de mensagem", { message_id, conversation_id });

    const { data: message, error: messageError } = await supabaseAdmin
      .from("patient_messages")
      .select(`
        id,
        content,
        created_at,
        sender_type,
        sender_id,
        conversation_id
      `)
      .eq("id", message_id)
      .single();

    if (messageError || !message) {
      log("Mensagem não encontrada", { message_id });
      return new Response(
        JSON.stringify({ error: "Mensagem não encontrada" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (message.sender_type !== "clinic") {
      log("Mensagem não é da clínica, ignorando", { sender_type: message.sender_type });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Mensagem não é da clínica" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("patient_conversations")
      .select("id, patient_id, tenant_id, subject")
      .eq("id", conversation_id)
      .single();

    if (conversationError || !conversation) {
      log("Conversa não encontrada", { conversation_id });
      return new Response(
        JSON.stringify({ error: "Conversa não encontrada" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const [patientResult, tenantResult, senderResult] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id, name, email, phone, user_id")
        .eq("id", conversation.patient_id)
        .single(),
      supabaseAdmin
        .from("tenants")
        .select("id, name, phone")
        .eq("id", conversation.tenant_id)
        .single(),
      message.sender_id
        ? supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", message.sender_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (!patientResult.data?.email) {
      log("Paciente sem email", { patient_id: conversation.patient_id });
      return new Response(
        JSON.stringify({ error: "Paciente não possui email cadastrado" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const details: MessageDetails = {
      id: message.id,
      content: message.content,
      created_at: message.created_at,
      sender_type: message.sender_type,
      conversation: {
        id: conversation.id,
        patient_id: conversation.patient_id,
        tenant_id: conversation.tenant_id,
        subject: conversation.subject,
      },
      patient: patientResult.data,
      tenant: tenantResult.data ?? { id: conversation.tenant_id, name: "Clínica" },
      sender: senderResult.data ?? undefined,
    };

    const emailTemplate = getEmailTemplate(details);

    const [emailSent, pushSent] = await Promise.all([
      sendEmailViaResend(
        details.patient.email,
        emailTemplate.subject,
        emailTemplate.html,
        emailTemplate.text
      ),
      details.patient.user_id
        ? sendPushNotification(
            supabaseAdmin,
            details.patient.user_id,
            `💬 ${details.tenant.name}`,
            truncateMessage(details.content, 80),
            {
              type: "message",
              conversation_id,
              message_id,
            }
          )
        : Promise.resolve(false),
    ]);

    await supabaseAdmin.from("notification_logs").insert({
      tenant_id: conversation.tenant_id,
      recipient_type: "patient",
      recipient_id: conversation.patient_id,
      channel: "email",
      template_type: "patient_message",
      status: emailSent ? "sent" : "failed",
      metadata: { message_id, conversation_id },
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
