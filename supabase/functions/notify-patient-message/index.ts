import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import {
  sendClinicEmail,
  greeting,
  paragraph,
  type ClinicInfo,
} from "../_shared/clinicEmail.ts";

const log = createLogger("NOTIFY-PATIENT-MESSAGE");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface MessageNotificationPayload {
  message_id: string;
  conversation_id: string;
}

// ─── Push Notification ─────────────────────────────────────────────────────────

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

function escHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
        .select("id, name, email, phone")
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

    const patient = patientResult.data;
    const tenant = tenantResult.data ?? { id: conversation.tenant_id, name: "Clínica", email: null, phone: null };
    const patientName = (patient.name ?? "").split(" ")[0] || "Paciente";
    const clinicName = tenant.name ?? "Sua Clínica";
    const senderName = senderResult.data?.full_name || clinicName;
    const messagePreview = truncateMessage(message.content, 200);
    const messageTime = formatDateTime(message.created_at);
    const siteUrl = Deno.env.get("SITE_URL") || "https://clinicnest.metaclass.com.br";
    const messagesUrl = `${siteUrl}/paciente/mensagens`;
    const clinic: ClinicInfo = { name: clinicName, email: tenant.email, phone: tenant.phone };

    // Build message card HTML
    const messageCardHtml = `
    <div style="background-color: #f0fdfa; border-radius: 10px; padding: 20px 24px; margin: 20px 0; border-left: 4px solid #0d9488;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 10px;">
            <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">De: ${escHtml(senderName)}</span>
            <span style="color: #94a3b8; font-size: 12px; float: right;">${escHtml(messageTime)}</span>
          </td>
        </tr>
        ${conversation.subject ? `
        <tr>
          <td style="padding-bottom: 10px;">
            <span style="color: #1e293b; font-size: 14px; font-weight: 600;">Assunto: ${escHtml(conversation.subject)}</span>
          </td>
        </tr>` : ""}
        <tr>
          <td>
            <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${escHtml(messagePreview)}</div>
          </td>
        </tr>
      </table>
    </div>`;

    const bodyHtml =
      greeting(patientName) +
      paragraph(`Você recebeu uma nova mensagem de <strong>${escHtml(clinicName)}</strong>.`) +
      messageCardHtml +
      paragraph(`<span style="color:#64748b;font-size:13px;">Acesse o portal do paciente para responder.</span>`);

    const bodyText = `Olá, ${patientName}! Você recebeu uma nova mensagem de ${clinicName}.\n\nDe: ${senderName}\nData: ${messageTime}\n${conversation.subject ? `Assunto: ${conversation.subject}\n` : ""}\nMensagem:\n${messagePreview}\n\nAcesse para ver: ${messagesUrl}`;

    const [emailResult, pushSent] = await Promise.all([
      sendClinicEmail({
        to: patient.email,
        subject: `💬 Nova mensagem de ${clinicName}`,
        clinic,
        headline: "Nova Mensagem",
        icon: "💬",
        bodyHtml,
        bodyText,
        ctaLabel: "Ver Mensagem Completa",
        ctaUrl: messagesUrl,
      }),
      patient.user_id
        ? sendPushNotification(
            supabaseAdmin,
            patient.user_id,
            `💬 ${clinicName}`,
            truncateMessage(message.content, 80),
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
      status: emailResult.ok ? "sent" : "failed",
      metadata: { message_id, conversation_id },
    });

    log("Notificação processada", { emailSent: emailResult.ok, pushSent });

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailResult.ok,
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
