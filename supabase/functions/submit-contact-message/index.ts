import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("SUBMIT-CONTACT-MESSAGE");

type Channel = "contact" | "lgpd";

interface SubmitContactBody {
  name: string;
  email: string;
  subject?: string;
  message: string;
  channel?: Channel;
  requestType?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
}

const lgpdRequestTypeLabel: Record<string, string> = {
  access: "Acesso aos dados",
  correction: "Correcao de dados",
  deletion: "Eliminacao de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogacao de consentimento",
  opposition: "Oposicao ao tratamento",
};

function toTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replaceAll("\0", "").trim().slice(0, maxLength);
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

function formatMessageForStorage(channel: Channel, requestType: string, message: string): string {
  if (channel === "lgpd") {
    const requestLabel = lgpdRequestTypeLabel[requestType] || requestType || "Solicitacao LGPD";
    return `Solicitacao recebida pelo Canal LGPD.\nTipo: ${requestLabel}\n\nDetalhes:\n${message}`;
  }
  return message;
}

function resolveSubject(channel: Channel, requestType: string, subject: string): string {
  if (subject) return subject;
  if (channel === "lgpd") {
    const requestLabel = lgpdRequestTypeLabel[requestType] || "Solicitacao LGPD";
    return `Canal LGPD - ${requestLabel}`;
  }
  return "Contato pelo site";
}

function channelLabel(channel: Channel): string {
  return channel === "lgpd" ? "Canal LGPD" : "Contato";
}

async function sendEmailViaResend(input: {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return { sent: false, reason: "RESEND_API_KEY nao configurada" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { sent: false, reason: `resend_http_${response.status}:${errorText}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Configuracao do servidor incompleta" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    let body: SubmitContactBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Corpo da requisicao invalido" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const name = toTrimmedString(body.name, 120);
    const email = toTrimmedString(body.email, 254).toLowerCase();
    const subject = toTrimmedString(body.subject, 180);
    const message = sanitizeMultiline(body.message, 5000);
    const requestType = toTrimmedString(body.requestType, 80);
    const channel: Channel = body.channel === "lgpd" ? "lgpd" : "contact";
    const termsAccepted = body.termsAccepted === true;
    const privacyAccepted = body.privacyAccepted === true;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Preencha nome, e-mail e mensagem." }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "E-mail invalido." }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!termsAccepted || !privacyAccepted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Aceite de Termos de Uso e Politica de Privacidade e obrigatorio.",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const requesterIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const rl = await checkRateLimit(`contact-message:${requesterIp}:${email}`, 5, 900);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Muitas requisicoes. Tente novamente em alguns minutos.",
        }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const resolvedSubject = resolveSubject(channel, requestType, subject);
    const messageForStorage = formatMessageForStorage(channel, requestType, message);

    const { data: createdMessage, error: insertError } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name,
        email,
        subject: resolvedSubject,
        message: messageForStorage,
        terms_accepted: true,
        privacy_accepted: true,
        consented_at: new Date().toISOString(),
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      log("ERROR: falha ao salvar mensagem", { error: insertError.message, channel });
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao registrar mensagem." }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = (Deno.env.get("CONTACT_ADMIN_EMAIL") ?? "contato@vynlobella.com").trim();
    const emailFrom = (Deno.env.get("CONTACT_EMAIL_FROM") ?? "VynloBella <noreply@vynlobella.com>")
      .trim();
    const channelHuman = channelLabel(channel);
    const requestTypeHuman =
      channel === "lgpd" ? lgpdRequestTypeLabel[requestType] || requestType || "-" : "-";

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(resolvedSubject);
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");
    const safeRequestType = escapeHtml(requestTypeHuman);
    const submittedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const mailSubject = `[${channelHuman}] ${resolvedSubject}`;
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">Nova mensagem recebida (${channelHuman})</h2>
        <p style="margin: 0 0 16px;">Uma nova solicitacao foi registrada no site.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 8px;"><strong>Nome:</strong> ${safeName}</p>
          <p style="margin: 0 0 8px;"><strong>E-mail:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 8px;"><strong>Assunto:</strong> ${safeSubject}</p>
          <p style="margin: 0 0 8px;"><strong>Canal:</strong> ${channelHuman}</p>
          <p style="margin: 0 0 8px;"><strong>Tipo LGPD:</strong> ${safeRequestType}</p>
          <p style="margin: 0 0 8px;"><strong>Data:</strong> ${submittedAt}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
          <p style="margin: 0;"><strong>Mensagem:</strong><br />${safeMessage}</p>
        </div>
      </div>
    `;

    const mailText = [
      `Nova mensagem recebida (${channelHuman})`,
      "",
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `Assunto: ${resolvedSubject}`,
      `Canal: ${channelHuman}`,
      `Tipo LGPD: ${requestTypeHuman}`,
      `Data: ${submittedAt}`,
      "",
      "Mensagem:",
      message,
    ].join("\n");

    const emailResult = await sendEmailViaResend({
      to: adminEmail,
      from: emailFrom,
      replyTo: email,
      subject: mailSubject,
      html: mailHtml,
      text: mailText,
    });

    if (!emailResult.sent) {
      log("WARNING: mensagem salva, mas email nao enviado", {
        id: createdMessage.id,
        channel,
        reason: emailResult.reason,
      });
      return new Response(
        JSON.stringify({
          success: true,
          notificationSent: false,
          messageId: createdMessage.id,
          message:
            "Mensagem registrada com sucesso, mas a notificacao por e-mail esta temporariamente indisponivel.",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("SUCCESS: mensagem salva e email enviado", {
      id: createdMessage.id,
      channel,
      to: adminEmail,
    });

    return new Response(
      JSON.stringify({
        success: true,
        notificationSent: true,
        messageId: createdMessage.id,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("ERROR: excecao nao tratada", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao processar solicitacao." }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
