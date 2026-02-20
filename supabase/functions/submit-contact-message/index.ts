import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("SUBMIT-CONTACT-MESSAGE");

type Channel = "contact" | "lgpd";

interface SubmitContactBody {
  name: string;
  phone?: string;
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

function formatMessageForStorage(
  channel: Channel,
  requestType: string,
  message: string,
  phone: string
): string {
  if (channel === "lgpd") {
    const requestLabel = lgpdRequestTypeLabel[requestType] || requestType || "Solicitacao LGPD";
    const phoneLabel = phone || "Nao informado";
    return `Solicitacao recebida pelo Canal LGPD.\nTipo: ${requestLabel}\nCelular: ${phoneLabel}\n\nDetalhes:\n${message}`;
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

function getChannelTheme(channel: Channel): {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  messageBg: string;
  messageBorder: string;
  highlightTitle: string;
  highlightText: string;
} {
  if (channel === "lgpd") {
    return {
      badgeBg: "#fff7ed",
      badgeBorder: "#f59e0b",
      badgeText: "#92400e",
      messageBg: "#fffbeb",
      messageBorder: "#f59e0b",
      highlightTitle: "Solicitacao de privacidade recebida",
      highlightText:
        "Esta mensagem veio do Canal LGPD e deve ser tratada conforme os prazos e procedimentos internos.",
    };
  }

  return {
    badgeBg: "#f5f3ff",
    badgeBorder: "#8b5cf6",
    badgeText: "#5b21b6",
    messageBg: "#f8fafc",
    messageBorder: "#e5e7eb",
    highlightTitle: "Novo contato recebido pelo site",
    highlightText:
      "Revise os dados abaixo e responda ao cliente. O campo Reply-To ja aponta para o e-mail informado.",
  };
}

interface ContactNotificationTemplateInput {
  channel: Channel;
  channelHuman: string;
  requestTypeHuman: string;
  safeName: string;
  safePhone: string;
  safeEmail: string;
  safeSubject: string;
  safeMessage: string;
  safeRequestType: string;
  submittedAt: string;
  messageId: string;
}

function getContactNotificationEmailHtml(input: ContactNotificationTemplateInput): string {
  const theme = getChannelTheme(input.channel);
  const showLgpdType = input.channel === "lgpd";
  const showPhone = input.safePhone.length > 0;
  const requestTypeRow = showLgpdType
    ? `
      <tr>
        <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px; width: 160px;">Tipo LGPD</td>
        <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.safeRequestType}</td>
      </tr>
    `
    : "";
  const phoneRow = showPhone
    ? `
      <tr>
        <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">Celular</td>
        <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.safePhone}</td>
      </tr>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova mensagem - ClinicNest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
    <tr>
      <td style="padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 34px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 30px; font-weight: 700;">ClinicNest</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.92); font-size: 15px;">Gestão profissional para clínicas</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 28px 18px;">
              <p style="margin: 0 0 12px;">
                <span style="display: inline-block; background: ${theme.badgeBg}; border: 1px solid ${theme.badgeBorder}; color: ${theme.badgeText}; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700;">
                  ${input.channelHuman}
                </span>
              </p>
              <h2 style="margin: 0 0 10px; color: #111827; font-size: 24px; line-height: 1.25;">Nova mensagem recebida</h2>
              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                ${theme.highlightTitle}. ${theme.highlightText}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 28px 22px;">
              <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 16px 8px; background: #ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px; width: 160px;">Nome</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">E-mail</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.safeEmail}</td>
                  </tr>
                  ${phoneRow}
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">Assunto</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.safeSubject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">Canal</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.channelHuman}</td>
                  </tr>
                  ${requestTypeRow}
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">Data</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.submittedAt}</td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 10px; color: #6b7280; font-size: 13px;">ID da solicitacao</td>
                    <td style="padding: 0 0 10px; color: #111827; font-size: 14px; font-weight: 600;">${input.messageId}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 28px 28px;">
              <div style="background: ${theme.messageBg}; border: 1px solid ${theme.messageBorder}; border-radius: 10px; padding: 16px;">
                <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 700;">Mensagem</p>
                <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.7;">${input.safeMessage}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 28px; text-align: center;">
              <p style="margin: 0 0 6px; color: #6b7280; font-size: 13px;">
                Email transacional automático do site ClinicNest.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ClinicNest. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function getContactNotificationEmailText(input: {
  channelHuman: string;
  requestTypeHuman: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  messageId: string;
  showLgpdType: boolean;
}): string {
  const lgpdTypeLine = input.showLgpdType ? `Tipo LGPD: ${input.requestTypeHuman}\n` : "";
  return [
    `Nova mensagem recebida (${input.channelHuman})`,
    "",
    `Nome: ${input.name}`,
    `E-mail: ${input.email}`,
    input.phone ? `Celular: ${input.phone}` : "",
    `Assunto: ${input.subject}`,
    `Canal: ${input.channelHuman}`,
    lgpdTypeLine.trimEnd(),
    `Data: ${input.submittedAt}`,
    `ID da solicitacao: ${input.messageId}`,
    "",
    "Mensagem:",
    input.message,
  ]
    .filter(Boolean)
    .join("\n");
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
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
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
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const name = toTrimmedString(body.name, 120);
    const phone = toTrimmedString(body.phone, 40);
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
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (channel === "lgpd" && !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Preencha nome, celular, e-mail e mensagem." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "E-mail invalido." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!termsAccepted || !privacyAccepted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Aceite de Termos de Uso e Politica de Privacidade e obrigatorio.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
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
    const messageForStorage = formatMessageForStorage(channel, requestType, message, phone);

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
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = (Deno.env.get("CONTACT_ADMIN_EMAIL") ?? "contato@metaclass.com.br").trim();
    const emailFrom = (Deno.env.get("CONTACT_EMAIL_FROM") ?? "ClinicNest <no-reply@metaclass.com.br>")
      .trim();
    const channelHuman = channelLabel(channel);
    const requestTypeHuman =
      channel === "lgpd" ? lgpdRequestTypeLabel[requestType] || requestType || "-" : "-";

    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(resolvedSubject);
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");
    const safeRequestType = escapeHtml(requestTypeHuman);
    const submittedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const mailSubject = `[${channelHuman}] ${resolvedSubject}`;
    const mailHtml = getContactNotificationEmailHtml({
      channel,
      channelHuman,
      requestTypeHuman,
      safeName,
      safePhone,
      safeEmail,
      safeSubject,
      safeMessage,
      safeRequestType,
      submittedAt,
      messageId: createdMessage.id,
    });

    const mailText = getContactNotificationEmailText({
      channelHuman,
      requestTypeHuman,
      name,
      phone,
      email,
      subject: resolvedSubject,
      message,
      submittedAt,
      messageId: createdMessage.id,
      showLgpdType: channel === "lgpd",
    });

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
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
