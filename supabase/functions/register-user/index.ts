import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("REGISTER-USER");

// ─── Paleta ClinicNest ─────────────────────────────────────────────────────
const BRAND_GRADIENT = "linear-gradient(135deg, #17a096 0%, #0d7fa8 100%)";
const BRAND_SHADOW = "rgba(23, 160, 150, 0.35)";
const BRAND_NAME = "ClinicNest";
const BRAND_TAGLINE = "Gestão Profissional para Clínicas";

// ─── Email HTML helpers ────────────────────────────────────────────────────
function brandHeader(): string {
  return `
          <tr>
            <td style="background: ${BRAND_GRADIENT}; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">
                ${BRAND_NAME}
              </h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 15px; opacity: 0.88;">
                ${BRAND_TAGLINE}
              </p>
            </td>
          </tr>`;
}

function brandFooter(): string {
  return `
          <tr>
            <td style="background-color: #f9fafb; padding: 28px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 6px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato com o suporte do ${BRAND_NAME}.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.
              </p>
            </td>
          </tr>`;
}

function brandButton(href: string, label: string): string {
  return `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="${href}"
                       style="display: inline-block; background: ${BRAND_GRADIENT}; color: #ffffff;
                              text-decoration: none; padding: 16px 44px; border-radius: 8px;
                              font-size: 16px; font-weight: 600;
                              box-shadow: 0 4px 14px ${BRAND_SHADOW};">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>`;
}

function wrapEmail(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${BRAND_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border-radius: 10px; overflow: hidden;
                      box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          ${brandHeader()}
          ${content}
          ${brandFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getConfirmationEmailHtml(name: string, confirmationUrl: string): string {
  const greeting = name ? `Olá, <strong>${escapeHtml(name)}</strong>!` : "Olá!";
  const content = `
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #134e4a; font-size: 24px;">
                Bem-vindo ao ${BRAND_NAME}! 🏥
              </h2>
              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Obrigado por se cadastrar no <strong>${BRAND_NAME}</strong>!
                Estamos felizes em ter você na nossa plataforma de gestão clínica.
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Para ativar sua conta, confirme seu e-mail clicando no botão abaixo:
              </p>
              ${brandButton(confirmationUrl, "Confirmar E-mail")}
              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Se você não criou uma conta no ${BRAND_NAME}, pode ignorar este e-mail com segurança.
              </p>
              <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                <strong>Atenção:</strong> Este link expira em <strong>24 horas</strong> por motivos de segurança.
              </p>
            </td>
          </tr>`;
  return wrapEmail("Confirme sua conta", content);
}

function getConfirmationEmailText(name: string, confirmationUrl: string): string {
  return `
Bem-vindo ao ${BRAND_NAME}!

Olá${name ? `, ${name}` : ""}!

Obrigado por se cadastrar no ${BRAND_NAME}! Estamos felizes em ter você na nossa plataforma de gestão clínica.

Para ativar sua conta, acesse o link abaixo:
${confirmationUrl}

Se você não criou uma conta no ${BRAND_NAME}, pode ignorar este e-mail.

Atenção: Este link expira em 24 horas por motivos de segurança.

© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Envio via Resend ──────────────────────────────────────────────────────
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("RESEND_API_KEY não configurada");
    return false;
  }

  try {
    const emailFrom =
      Deno.env.get("EMAIL_FROM") || `${BRAND_NAME} <no-reply@metaclass.com.br>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: emailFrom, to, subject, html, text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("Erro ao enviar via Resend", { status: response.status, error: errorText });
      return false;
    }

    const result = await response.json();
    log("Email enviado via Resend", { emailId: result.id });
    return true;
  } catch (error) {
    log("Exceção ao enviar email", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "https://clinicnest.metaclass.com.br";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

interface RegisterBody {
  email: string;
  password: string;
  fullName: string;
  clinicName: string;
  phone?: string;
  legalAcceptedAt?: string;
  professionalData?: {
    professional_type?: string;
    council_type?: string;
    council_number?: string;
    council_state?: string;
  };
}

// ─── Handler principal ────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    let body: RegisterBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { email, password, fullName, clinicName, phone, legalAcceptedAt, professionalData } = body;

    const emailTrim = typeof email === "string" ? email.trim().toLowerCase() : "";
    const nameTrim = typeof fullName === "string" ? fullName.trim() : "";
    const clinicTrim = typeof clinicName === "string" ? clinicName.trim() : "";

    // ── Validações ────────────────────────────────────────────────────────
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!nameTrim) {
      return new Response(
        JSON.stringify({ error: "Nome completo é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!clinicTrim) {
      return new Response(
        JSON.stringify({ error: "Nome da clínica é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    const requesterIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const rl = await checkRateLimit(`register-user:${requesterIp}`, 5, 300);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Montar user_metadata ──────────────────────────────────────────────
    const userMetadata: Record<string, unknown> = {
      full_name: nameTrim,
      clinic_name: clinicTrim,
      phone: phone || "",
      terms_accepted: true,
      privacy_policy_accepted: true,
      legal_accepted_at: legalAcceptedAt || new Date().toISOString(),
    };

    if (professionalData?.professional_type) {
      userMetadata.professional_type = professionalData.professional_type;
    }
    if (professionalData?.council_type) {
      userMetadata.council_type = professionalData.council_type;
    }
    if (professionalData?.council_number) {
      userMetadata.council_number = professionalData.council_number;
    }
    if (professionalData?.council_state) {
      userMetadata.council_state = professionalData.council_state;
    }

    log("Criando usuário", { email: emailTrim });

    // ── 1. Criar usuário via Admin API (NÃO envia email automático) ──────
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrim,
      password,
      email_confirm: false,
      user_metadata: userMetadata,
    });

    if (createError) {
      log("Erro ao criar usuário", { error: createError.message });

      // Tratar erros comuns
      if (
        createError.message?.includes("already been registered") ||
        createError.message?.includes("already exists")
      ) {
        return new Response(
          JSON.stringify({ error: "Este e-mail já está cadastrado" }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: createError.message || "Erro ao criar conta" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!createData?.user) {
      return new Response(
        JSON.stringify({ error: "Erro inesperado ao criar usuário" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Usuário criado", { userId: createData.user.id });

    // ── 2. Gerar link de confirmação ─────────────────────────────────────
    const siteUrl = normalizeSiteUrl(
      Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_SITE_URL"),
    );
    const loginUrl = `${siteUrl}/login`;

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: emailTrim,
        options: { redirectTo: loginUrl },
      });

    if (linkError || !linkData?.properties?.action_link) {
      log("Erro ao gerar link de confirmação", { error: linkError?.message });
      // Usuário foi criado mas não conseguimos gerar o link.
      // Não é fatal — o usuário pode solicitar reenvio depois.
      return new Response(
        JSON.stringify({
          success: true,
          emailSent: false,
          message: "Conta criada, mas houve erro ao enviar email de confirmação. Use 'reenviar email' no login.",
        }),
        { status: 201, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const confirmationUrl = linkData.properties.action_link;
    log("Link de confirmação gerado");

    // ── 3. Enviar email customizado via Resend ───────────────────────────
    const subject = `Confirme sua conta - ${BRAND_NAME}`;
    const emailHtml = getConfirmationEmailHtml(nameTrim, confirmationUrl);
    const emailText = getConfirmationEmailText(nameTrim, confirmationUrl);

    const emailSent = await sendEmailViaResend(emailTrim, subject, emailHtml, emailText);

    if (!emailSent) {
      log("Falha ao enviar email de confirmação via Resend");
      return new Response(
        JSON.stringify({
          success: true,
          emailSent: false,
          message: "Conta criada, mas houve erro ao enviar email. Use 'reenviar email' no login.",
        }),
        { status: 201, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Registro completo com sucesso");
    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        message: "Conta criada! Verifique seu e-mail para confirmar.",
      }),
      { status: 201, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("Exceção não tratada", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
