/**
 * notify-patient-events — Cloud Run handler */

import { Request, Response } from 'express';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
// ─── Email template helpers (from original clinicEmail shared module) ─────────

const COLORS = {
  SUCCESS: '#10b981',
  INFO: '#3b82f6',
  DANGER: '#ef4444',
  WARNING: '#f59e0b',
};

interface ClinicInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
}

function greeting(name: string): string {
  return `<p>Olá, <strong>${name}</strong>!</p>`;
}

function paragraph(text: string): string {
  return `<p>${text}</p>`;
}

function infoBox(items: Array<{ label: string; value: string }>, color?: string): string {
  const borderColor = color || COLORS.INFO;
  return `<div style="border-left:4px solid ${borderColor};padding:12px;margin:16px 0;background:#f9fafb;border-radius:4px">${items.map(i => `<p><strong>${i.label}:</strong> ${i.value}</p>`).join('')}</div>`;
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
}): Promise<{ ok: boolean }> {
  const ctaHtml = opts.ctaUrl && opts.ctaLabel
    ? `<p style="text-align:center;margin:24px 0"><a href="${opts.ctaUrl}" style="background:${opts.headerColor || COLORS.INFO};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${opts.ctaLabel}</a></p>`
    : '';
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;padding:20px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
      <div style="background:${opts.headerColor || COLORS.INFO};padding:20px;text-align:center">
        <span style="font-size:32px">${opts.icon}</span>
        <h2 style="color:#fff;margin:8px 0 0">${opts.headline}</h2>
      </div>
      <div style="padding:24px">${opts.bodyHtml}${ctaHtml}</div>
      <div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px">${opts.clinic.name}</div>
    </div></body></html>`;
  return sendEmail(opts.to, opts.subject, html, opts.bodyText);
}

const log = createLogger("NOTIFY-PATIENT-EVENTS");
// ─── Types ─────────────────────────────────────────────────────────────────────

type EventType =
  | "consent_signed"
  | "return_scheduled"
  | "return_reminder"
  | "exam_ready"
  | "appointment_cancelled"
  | "waitlist_slot_available"
  | "document_available";

interface EventPayload {
  event_type: EventType;
  tenant_id: string;
  client_id?: string;
  patient_id?: string;
  metadata?: Record<string, unknown>;
}

// ─── Push Notification ─────────────────────────────────────────────────────────

async function sendPushNotification(
  clientId: string,
  title: string,
  body: string): Promise<boolean> {
  try {
    const { data: clientUser } = await db.from("clients")
      .select("user_id")
      .eq("id", clientId)
      .single();

    if (!clientUser?.user_id) return false;

    const { data: tokens } = await db.from("push_tokens")
      .select("token, platform")
      .eq("user_id", clientUser.user_id);

    if (!tokens?.length) return false;

    const fcmServerKey = process.env.FCM_SERVER_KEY;
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

// ─── Email Content Builders ────────────────────────────────────────────────────

function consentSignedContent(clientName: string, templateTitle: string): { headline: string; icon: string; bodyHtml: string; bodyText: string } {
  const now = new Date();
  return {
    headline: "Termo Assinado",
    icon: "✅",
    bodyHtml:
      greeting(clientName) +
      paragraph(`Confirmamos que o termo <strong>"${templateTitle}"</strong> foi assinado com sucesso em nosso sistema.`) +
      infoBox([
        { label: "📋 Documento", value: templateTitle },
        { label: "📅 Data", value: now.toLocaleDateString("pt-BR") },
        { label: "🕐 Hora", value: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
      ], COLORS.SUCCESS) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Uma cópia deste documento pode ser acessada no seu portal do paciente.</span>`),
    bodyText: `Olá, ${clientName}! O termo "${templateTitle}" foi assinado com sucesso em ${now.toLocaleDateString("pt-BR")}.`,
  };
}

function returnScheduledContent(clientName: string, returnDate: string, reason: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const dateParts = returnDate.split("-");
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : returnDate;

  const items: Array<{ label: string; value: string }> = [
    { label: "📅 Data prevista", value: formattedDate },
  ];
  if (reason) items.push({ label: "📋 Motivo", value: reason });

  return {
    headline: "Retorno Agendado",
    icon: "📅",
    bodyHtml:
      greeting(clientName) +
      paragraph("Um retorno foi agendado para você:") +
      infoBox(items) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Entre em contato conosco caso precise reagendar.</span>`),
    bodyText: `Olá, ${clientName}! Seu retorno está agendado para ${formattedDate}${reason ? ` (${reason})` : ""}.`,
  };
}

function examReadyContent(clientName: string, examName: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const siteUrl = process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
  return {
    headline: "Exame Disponível",
    icon: "🔬",
    bodyHtml:
      greeting(clientName) +
      paragraph(`O resultado do seu exame <strong>"${examName}"</strong> está disponível.`) +
      infoBox([{ label: "🔬 Exame", value: examName }], COLORS.INFO) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Acesse seu portal do paciente para visualizar o resultado completo.</span>`),
    bodyText: `Olá, ${clientName}! O resultado do exame "${examName}" está disponível. Acesse seu portal para visualizar.`,
    ctaLabel: "Ver Resultado",
    ctaUrl: `${siteUrl}/paciente/exames`,
  };
}

function appointmentCancelledContent(clientName: string, date: string, time: string, serviceName: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; headerColor: string } {
  return {
    headline: "Consulta Cancelada",
    icon: "❌",
    headerColor: COLORS.DANGER,
    bodyHtml:
      greeting(clientName) +
      paragraph("Informamos que sua consulta foi cancelada.") +
      infoBox([
        { label: "📌 Procedimento", value: serviceName },
        { label: "📅 Data", value: date },
        { label: "🕐 Horário", value: time },
      ], COLORS.DANGER) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Se deseja reagendar, entre em contato conosco ou acesse o portal do paciente.</span>`),
    bodyText: `Olá, ${clientName}! Sua consulta de ${serviceName} em ${date} às ${time} foi cancelada. Entre em contato para reagendar.`,
  };
}

function waitlistSlotContent(clientName: string, serviceName: string, professionalName: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const siteUrl = process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
  const items: Array<{ label: string; value: string }> = [];
  if (serviceName) items.push({ label: "📌 Procedimento", value: serviceName });
  if (professionalName) items.push({ label: "👨\u200d⚕\ufe0f Profissional", value: professionalName });

  return {
    headline: "Vaga Disponível!",
    icon: "🎉",
    bodyHtml:
      greeting(clientName) +
      paragraph("<strong>Boas notícias!</strong> Uma vaga ficou disponível para o procedimento que você aguardava na lista de espera.") +
      (items.length > 0 ? infoBox(items, COLORS.SUCCESS) : "") +
      paragraph("Acesse o portal do paciente para agendar ou entre em contato conosco."),
    bodyText: `Olá, ${clientName}! Uma vaga ficou disponível${serviceName ? ` para ${serviceName}` : ""}. Acesse o portal para agendar.`,
    ctaLabel: "Agendar Agora",
    ctaUrl: `${siteUrl}/paciente/agendar`,
  };
}

function documentAvailableContent(clientName: string, documentType: string, documentTitle: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const siteUrl = process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
  const typeLabels: Record<string, string> = {
    certificate: "Atestado",
    prescription: "Receita",
    exam: "Exame",
    report: "Laudo",
  };
  const label = typeLabels[documentType] || "Documento";

  return {
    headline: `${label} Disponível`,
    icon: "📄",
    bodyHtml:
      greeting(clientName) +
      paragraph(`Um novo documento foi emitido para você: <strong>${documentTitle}</strong>.`) +
      infoBox([
        { label: "📋 Tipo", value: label },
        { label: "📄 Documento", value: documentTitle },
        { label: "📅 Data", value: new Date().toLocaleDateString("pt-BR") },
      ], COLORS.INFO) +
      paragraph("Acesse seu portal do paciente para visualizar, baixar e assinar o documento."),
    bodyText: `Olá, ${clientName}! Um novo ${label.toLowerCase()} foi emitido para você: "${documentTitle}". Acesse seu portal para visualizar e assinar.`,
    ctaLabel: "Ver Documentos",
    ctaUrl: `${siteUrl}/paciente/documentos`,
  };
}

// ─── Edge Function ─────────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    const payload: EventPayload = req.body;
        const { event_type, tenant_id, metadata } = payload;
        // Support both client_id and patient_id (waitlist uses patient_id)
        const client_id = payload.client_id || payload.patient_id;

        if (!event_type || !tenant_id || !client_id) {
          return res.status(400).json({ error: "event_type, tenant_id e client_id são obrigatórios" });
        }

        log("Processando evento", { event_type, tenant_id });

        // Fetch client and tenant data (include tenant email for Reply-To)
        const [clientResult, tenantResult] = await Promise.all([
          db.from("clients").select("id, name, email, phone, user_id").eq("id", client_id).single(),
          db.from("tenants").select("id, name, email, phone, address").eq("id", tenant_id).single(),
        ]);

        if (!clientResult.data) {
          return res.status(404).json({ error: "Cliente não encontrado" });
        }

        const client = clientResult.data;
        const tenant = tenantResult.data ?? { id: tenant_id, name: "Clínica", email: null, phone: null, address: null };
        const clientName = (client.name ?? "").split(" ")[0] || "Paciente";
        const clinicName = tenant.name ?? "Sua Clínica";
        const clinic: ClinicInfo = { name: clinicName, email: tenant.email, phone: tenant.phone };

        let emailContent: {
          headline: string;
          icon: string;
          bodyHtml: string;
          bodyText: string;
          headerColor?: string;
          ctaLabel?: string;
          ctaUrl?: string;
        } | null = null;
        let subject = "";
        let pushTitle = "";
        let pushBody = "";

        switch (event_type) {
          case "consent_signed": {
            const templateTitle = String(metadata?.template_title ?? "Termo de Consentimento");
            emailContent = consentSignedContent(clientName, templateTitle);
            subject = `✅ Termo assinado com sucesso - ${clinicName}`;
            pushTitle = "Termo Assinado ✅";
            pushBody = `O termo "${templateTitle}" foi assinado com sucesso.`;
            break;
          }

          case "return_scheduled": {
            const returnDate = String(metadata?.return_date ?? "");
            const reason = String(metadata?.reason ?? "");
            emailContent = returnScheduledContent(clientName, returnDate, reason);
            subject = `📅 Retorno agendado - ${clinicName}`;
            pushTitle = "Retorno Agendado 📅";
            pushBody = `Seu retorno está previsto para ${returnDate}${reason ? ` (${reason})` : ""}`;
            break;
          }

          case "return_reminder": {
            const returnDate = String(metadata?.return_date ?? "");
            const reason = String(metadata?.reason ?? "");
            emailContent = returnScheduledContent(clientName, returnDate, reason);
            subject = `⏰ Lembrete de retorno - ${clinicName}`;
            pushTitle = "Lembrete de Retorno ⏰";
            pushBody = `Não esqueça! Seu retorno está marcado para ${returnDate}`;
            break;
          }

          case "exam_ready": {
            const examName = String(metadata?.exam_name ?? "Exame");
            emailContent = examReadyContent(clientName, examName);
            subject = `🔬 Resultado de exame disponível - ${clinicName}`;
            pushTitle = "Exame Disponível 🔬";
            pushBody = `O resultado do exame "${examName}" está disponível.`;
            break;
          }

          case "appointment_cancelled": {
            const date = String(metadata?.date ?? "");
            const time = String(metadata?.time ?? "");
            const serviceName = String(metadata?.service_name ?? "Consulta");
            emailContent = appointmentCancelledContent(clientName, date, time, serviceName);
            subject = `❌ Consulta cancelada - ${clinicName}`;
            pushTitle = "Consulta Cancelada ❌";
            pushBody = `Sua consulta de ${serviceName} foi cancelada.`;
            break;
          }

          case "waitlist_slot_available": {
            const serviceName = String(metadata?.service_name ?? "Consulta");
            const professionalName = String(metadata?.professional_name ?? "");
            emailContent = waitlistSlotContent(clientName, serviceName, professionalName);
            subject = `🎉 Vaga disponível - ${clinicName}`;
            pushTitle = "Vaga Disponível! 🎉";
            pushBody = `Uma vaga ficou disponível${serviceName ? ` para ${serviceName}` : ""}. Agende agora!`;
            break;
          }

          case "document_available": {
            const documentType = String(metadata?.document_type ?? "document");
            const documentTitle = String(metadata?.document_title ?? "Documento");
            emailContent = documentAvailableContent(clientName, documentType, documentTitle);
            subject = `📄 Novo documento disponível - ${clinicName}`;
            pushTitle = "Documento Disponível 📄";
            pushBody = `Um novo documento foi emitido para você: "${documentTitle}". Acesse o portal para visualizar e assinar.`;
            break;
          }
        }

        const results: Record<string, boolean> = {};

        // Send email via shared clinic email module
        if (emailContent && client.email) {
          const res = await sendClinicEmail({
            to: client.email,
            subject,
            clinic,
            headline: emailContent.headline,
            icon: emailContent.icon,
            bodyHtml: emailContent.bodyHtml,
            bodyText: emailContent.bodyText,
            headerColor: emailContent.headerColor,
            ctaLabel: emailContent.ctaLabel,
            ctaUrl: emailContent.ctaUrl,
          });
          results.email = res.ok;
        }

        // Send push
        if (pushTitle && client.id) {
          const pushSent = await sendPushNotification(client.id, pushTitle, pushBody);
          results.push = pushSent;
        }

        // Log notification
        await db.from("notification_logs").insert({
          tenant_id,
          recipient_type: "patient",
          recipient_id: client_id,
          channel: "email",
          template_type: event_type,
          status: results.email ? "sent" : "failed",
          metadata: { event_type, ...(metadata ?? {}) },
        });

        log("Evento processado", { event_type, results });

        return res.status(200).json({ success: true, results });
  } catch (err: any) {
    console.error(`[notify-patient-events] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
