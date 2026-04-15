/**
 * notify-patient-message — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
interface ClinicInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
}

function greeting(name: string): string {
  return `<p>Olá, <strong>${name}</strong>!</p>`;
}

async function sendClinicEmail(opts: {
  to: string;
  subject: string;
  clinic: ClinicInfo;
  headline: string;
  icon: string;
  bodyHtml: string;
  bodyText: string;
  headerColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctaHtml = opts.ctaUrl && opts.ctaLabel
    ? `<p style="text-align:center;margin:24px 0"><a href="${opts.ctaUrl}" style="background:${opts.headerColor || '#3b82f6'};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${opts.ctaLabel}</a></p>`
    : '';
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;padding:20px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
      <div style="background:${opts.headerColor || '#3b82f6'};padding:20px;text-align:center">
        <span style="font-size:32px">${opts.icon}</span>
        <h2 style="color:#fff;margin:8px 0 0">${opts.headline}</h2>
      </div>
      <div style="padding:24px">${opts.bodyHtml}${ctaHtml}</div>
      <div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px">${opts.clinic.name}</div>
    </div></body></html>`;
  return sendEmail(opts.to, opts.subject, html, opts.bodyText) as Promise<{ ok: boolean; error?: string }>;
}

function paragraph(text: string): string {
  return '<p style="margin: 8px 0; color: #374151; font-size: 14px; line-height: 1.6;">' + text + '</p>';
}

const log = createLogger("NOTIFY-PATIENT-MESSAGE");
interface MessageNotificationPayload {
  message_id: string;
  conversation_id: string;
}

// ─── Push Notification ─────────────────────────────────────────────────────────

async function sendPushNotification(userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const { data: tokens, error } = await db.from("push_tokens")
      .select("token, platform")
      .eq("user_id", userId);

    if (error || !tokens?.length) {
      log("PUSH: Nenhum token encontrado", { userId });
      return false;
    }

    const fcmServerKey = process.env.FCM_SERVER_KEY;
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
  } catch (error: any) {
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

export async function notifyPatientMessage(req: Request, res: Response) {
  try {
    // CORS handled by middleware
        const payload: MessageNotificationPayload = req.body;
        const { message_id, conversation_id } = payload;

        if (!message_id || !conversation_id) {
          return res.status(400).json({ error: "message_id e conversation_id são obrigatórios" });
        }

        log("Processando notificação de mensagem", { message_id, conversation_id });

        const { data: message, error: messageError } = await db.from("patient_messages")
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
          return res.status(404).json({ error: "Mensagem não encontrada" });
        }

        if (message.sender_type !== "clinic") {
          log("Mensagem não é da clínica, ignorando", { sender_type: message.sender_type });
          return res.status(200).json({ success: true, skipped: true, reason: "Mensagem não é da clínica" });
        }

        const { data: conversation, error: conversationError } = await db.from("patient_conversations")
          .select("id, patient_id, tenant_id, subject")
          .eq("id", conversation_id)
          .single();

        if (conversationError || !conversation) {
          log("Conversa não encontrada", { conversation_id });
          return res.status(404).json({ error: "Conversa não encontrada" });
        }

        const [patientResult, tenantResult, senderResult] = await Promise.all([
          db.from("clients")
            .select("id, name, email, phone, user_id")
            .eq("id", conversation.patient_id)
            .single(),
          db.from("tenants")
            .select("id, name, email, phone")
            .eq("id", conversation.tenant_id)
            .single(),
          message.sender_id
            ? db.from("profiles")
                .select("full_name")
                .eq("user_id", message.sender_id)
                .single()
            : Promise.resolve({ data: null }),
        ]);

        if (!patientResult.data?.email) {
          log("Paciente sem email", { patient_id: conversation.patient_id });
          return res.status(400).json({ error: "Paciente não possui email cadastrado" });
        }

        const patient = patientResult.data;
        const tenant = tenantResult.data ?? { id: conversation.tenant_id, name: "Clínica", email: null, phone: null };
        const patientName = (patient.name ?? "").split(" ")[0] || "Paciente";
        const clinicName = tenant.name ?? "Sua Clínica";
        const senderName = senderResult.data?.full_name || clinicName;
        const messagePreview = truncateMessage(message.content, 200);
        const messageTime = formatDateTime(message.created_at);
        const siteUrl = process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
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
            ? sendPushNotification(patient.user_id,
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

        await db.from("notification_logs").insert({
          tenant_id: conversation.tenant_id,
          recipient_type: "patient",
          recipient_id: conversation.patient_id,
          channel: "email",
          template_type: "patient_message",
          status: emailResult.ok ? "sent" : "failed",
          metadata: { message_id, conversation_id },
        });

        log("Notificação processada", { emailSent: emailResult.ok, pushSent });

        return res.status(200).json({
            success: true,
            email_sent: emailResult.ok,
            push_sent: pushSent,
          });
  } catch (error: any) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    console.error(`[notify-patient-message] Error:`, error.message || error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Erro interno" });
  }
}
