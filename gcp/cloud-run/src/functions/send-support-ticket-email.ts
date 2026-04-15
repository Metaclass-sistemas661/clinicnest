/**
 * send-support-ticket-email — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const log = createLogger("SEND-SUPPORT-TICKET-EMAIL");

type Body = {
  ticketId: string;
};

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEmailViaResend(
  to: string,
  replyTo: string | null,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  const emailFrom = process.env.SUPPORT_EMAIL_FROM || "ClinicNest <no-reply@metaclass.com.br>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
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

export async function sendSupportTicketEmail(req: Request, res: Response) {
  try {
    const db = createDbClient();
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const user = (req as any).user;
    if (!user?.uid) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const { data: userProfile } = await db.from("profiles")
      .select("tenant_id")
      .eq("user_id", user.uid)
      .single();

    if (!userProfile?.tenant_id) {
      return res.status(403).json({ error: "Tenant não encontrado" });
    }

    const tenantId = userProfile.tenant_id;

    let body: Body;
    try {
      body = req.body;
    } catch {
      return res.status(400).json({ error: "Corpo da requisição inválido" });
    }

      const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
      if (!ticketId) {
        return res.status(400).json({ error: "ticketId é obrigatório" });
      }

    const rl = await checkRateLimit(`support-email:${tenantId}:${user.uid}`, 10, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
      }

      const { data: ticket, error: ticketError } = await db.from("support_tickets")
        .select("id, tenant_id, subject, category, priority, status, channel, created_at, created_by")
        .eq("id", ticketId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (ticketError || !ticket) {
        return res.status(404).json({ error: "Ticket não encontrado" });
      }

      const [{ data: tenant }, { data: profile }, { data: lastMessage }] = await Promise.all([
        db.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
        db.from("profiles").select("full_name").eq("user_id", user.uid).maybeSingle(),
        db.from("support_messages")
          .select("message, metadata, created_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const tenantName = (tenant?.name || "ClinicNest").trim();
      const fullName = (profile?.full_name || "Usuário").trim();

      const supportTo = process.env.SUPPORT_EMAIL_TO || "suporte@metaclass.com.br";
      const replyTo = user.email ?? null;

      const createdAt = new Date(ticket.created_at).toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });

      const safeSubject = escapeHtml(ticket.subject);
      const safeMessage = escapeHtml(String(lastMessage?.message || ""));
      const safeCategory = escapeHtml(String(ticket.category || "general"));
      const safePriority = escapeHtml(String(ticket.priority || "normal"));
      const safeStatus = escapeHtml(String(ticket.status || "open"));

      const subject = `Suporte - ${tenantName}: ${ticket.subject}`;

      const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Ticket de suporte - ClinicNest</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        <div style="border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);padding:22px 20px;color:#fff;">
            <div style="font-size:20px;font-weight:800;">ClinicNest</div>
            <div style="opacity:.92;margin-top:6px;">Novo ticket de suporte</div>
          </div>
          <div style="padding:18px 20px;">
            <p style="margin:0 0 12px;color:#111827;">
              <strong>${escapeHtml(fullName)}</strong> abriu um ticket no tenant <strong>${escapeHtml(tenantName)}</strong>.
            </p>
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 12px 4px;background:#fff;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;width:160px;">Ticket</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${escapeHtml(ticket.id)}</td></tr>
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Assunto</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeSubject}</td></tr>
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Categoria</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeCategory}</td></tr>
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Prioridade</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safePriority}</td></tr>
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Status</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeStatus}</td></tr>
                <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Criado em</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${escapeHtml(createdAt)}</td></tr>
              </table>
            </div>
            <div style="margin-top:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
              <div style="font-size:13px;color:#111827;font-weight:800;margin-bottom:6px;">Mensagem</div>
              <div style="font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${safeMessage}</div>
            </div>
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 20px;text-align:center;color:#6b7280;font-size:12px;">
            Email transacional do módulo de suporte.
          </div>
        </div>
      </div>
    </body>
    </html>
      `.trim();

      const text = [
        "Novo ticket de suporte - ClinicNest",
        "",
        `Tenant: ${tenantName}`,
        `Usuário: ${fullName} (${replyTo ?? "sem email"})`,
        `Ticket: ${ticket.id}`,
        `Assunto: ${ticket.subject}`,
        `Categoria: ${ticket.category}`,
        `Prioridade: ${ticket.priority}`,
        `Status: ${ticket.status}`,
        `Criado em: ${createdAt}`,
        "",
        "Mensagem:",
        String(lastMessage?.message || ""),
      ].join("\n");

      const sent = await sendEmailViaResend(supportTo, replyTo, subject, html, text);

      return res.status(200).json({ success: true, notificationSent: sent });
  } catch (err: any) {
    console.error(`[send-support-ticket-email] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
