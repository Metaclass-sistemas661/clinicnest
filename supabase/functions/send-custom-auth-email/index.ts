import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("SEND-CUSTOM-AUTH-EMAIL");

// ─── Paleta ClinicNest ─────────────────────────────────────────────────────
// Primary:  Teal médico  hsl(174 72% 38%) ≈ #17a096
// Accent:   Azul         hsl(195 80% 40%) ≈ #0d7fa8
const BRAND_GRADIENT = "linear-gradient(135deg, #17a096 0%, #0d7fa8 100%)";
const BRAND_SHADOW   = "rgba(23, 160, 150, 0.35)";
const BRAND_NAME     = "ClinicNest";
const BRAND_TAGLINE  = "Gestão Profissional para Clínicas";

// ─── Header HTML compartilhado ─────────────────────────────────────────────
function brandHeader(): string {
  return `
          <!-- Header -->
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

// ─── Footer HTML compartilhado ─────────────────────────────────────────────
function brandFooter(): string {
  return `
          <!-- Footer -->
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

// ─── Button HTML compartilhado ─────────────────────────────────────────────
function brandButton(href: string, label: string): string {
  return `
              <!-- Button -->
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

// ─── Layout base ──────────────────────────────────────────────────────────
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

// ─── Template: Confirmação de conta ───────────────────────────────────────
function getConfirmationEmailHtml(name: string, confirmationUrl: string): string {
  const greeting = name ? `Olá, <strong>${name}</strong>!` : "Olá!";
  const content = `
          <!-- Content -->
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

// ─── Template: Redefinir senha ─────────────────────────────────────────────
function getPasswordResetEmailHtml(name: string, resetUrl: string): string {
  const greeting = name ? `Olá, <strong>${name}</strong>!` : "Olá!";
  const content = `
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #134e4a; font-size: 24px;">
                Redefinir sua senha 🔐
              </h2>

              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>

              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${BRAND_NAME}</strong>.
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              ${brandButton(resetUrl, "Redefinir Senha")}

              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Se você não solicitou esta alteração, pode ignorar este e-mail.
                Sua senha permanecerá a mesma.
              </p>

              <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                <strong>Atenção:</strong> Este link expira em <strong>1 hora</strong> por motivos de segurança.
              </p>
            </td>
          </tr>`;
  return wrapEmail("Redefinir sua senha", content);
}

function getPasswordResetEmailText(name: string, resetUrl: string): string {
  return `
Redefinir sua senha - ${BRAND_NAME}

Olá${name ? `, ${name}` : ""}!

Recebemos uma solicitação para redefinir a senha da sua conta no ${BRAND_NAME}.

Acesse o link abaixo para criar uma nova senha:
${resetUrl}

Se você não solicitou esta alteração, pode ignorar este e-mail. Sua senha permanecerá a mesma.

Atenção: Este link expira em 1 hora por motivos de segurança.

© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.
  `.trim();
}

// ─── Template: Senha alterada ──────────────────────────────────────────────
function getPasswordChangedEmailHtml(name: string, loginUrl: string): string {
  const greeting = name ? `Olá, <strong>${name}</strong>!` : "Olá!";
  const changedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  const content = `
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #134e4a; font-size: 24px;">
                Senha alterada com sucesso ✅
              </h2>

              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>

              <p style="margin: 0 0 14px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Sua senha foi alterada com sucesso. Sua conta está segura e protegida.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 16px;
                          margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">
                  ✓ Alteração realizada em ${changedAt}
                </p>
              </div>

              <p style="margin: 20px 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Agora você pode fazer login com sua nova senha:
              </p>

              ${brandButton(loginUrl, "Fazer Login")}

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px;
                          margin: 24px 0 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Dica de segurança:</strong> Se você não realizou esta alteração,
                  entre em contato com o suporte imediatamente.
                </p>
              </div>
            </td>
          </tr>`;
  return wrapEmail("Senha alterada", content);
}

function getPasswordChangedEmailText(name: string, loginUrl: string): string {
  return `
Senha alterada com sucesso - ${BRAND_NAME}

Olá${name ? `, ${name}` : ""}!

Sua senha foi alterada com sucesso. Sua conta está segura e protegida.

Alteração realizada em: ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })}

Acesse o link abaixo para fazer login com sua nova senha:
${loginUrl}

Dica de segurança: Se você não realizou esta alteração, entre em contato com o suporte imediatamente.

© ${new Date().getFullYear()} ${BRAND_NAME}. Todos os direitos reservados.
  `.trim();
}

// ─── Envio via Resend ──────────────────────────────────────────────────────
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  log("EMAIL: Tentando enviar email via Resend", { to, subject });

  try {
    const emailFrom = Deno.env.get("EMAIL_FROM") || `${BRAND_NAME} <no-reply@metaclass.com.br>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: emailFrom, to, subject, html, text }),
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

    const result = await response.json();
    log("EMAIL: E-mail enviado com sucesso via Resend", { emailId: result.id, to });
    return true;
  } catch (error) {
    log("EMAIL: Exceção ao enviar e-mail", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────
interface EmailBody {
  email: string;
  type: "password_reset" | "confirmation" | "password_changed";
  name?: string;
  redirectTo?: string;
}

function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "https://clinicnest.metaclass.com.br";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

function safeRedirectTo(raw: string | undefined | null, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  if (s.startsWith("https://")) return s;
  return fallback;
}

// ─── Handler principal ────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  log("Request recebido", { method: req.method });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    log("ERROR: Variáveis de ambiente faltando");
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    let user = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: authUser }, error: userError } =
        await supabaseAdmin.auth.getUser(token);
      if (!userError && authUser) {
        user = authUser;
        log("Usuário autenticado", { userId: user.id });
      }
    }

    let body: EmailBody;
    try {
      body = await req.json();
      log("Body recebido", { email: body.email, type: body.type });
    } catch (err) {
      log("ERROR: Erro ao parsear body", { error: err });
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { email, type, name, redirectTo } = body;
    const emailTrim = typeof email === "string" ? email.trim() : "";
    let nameTrim = typeof name === "string" ? name.trim() : "";
    const siteUrl = normalizeSiteUrl(Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_SITE_URL"));
    const loginUrl = `${siteUrl}/login`;
    const resetPasswordRedirectTo = safeRedirectTo(redirectTo, `${siteUrl}/reset-password`);
    const requesterIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (!emailTrim) {
      return new Response(
        JSON.stringify({ error: "E-mail é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (
      type !== "password_reset" &&
      type !== "confirmation" &&
      type !== "password_changed"
    ) {
      return new Response(
        JSON.stringify({ error: "Tipo inválido. Use 'password_reset', 'confirmation' ou 'password_changed'" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const rl = await checkRateLimit(
      `custom-auth-email:${type}:${requesterIp}:${emailTrim.toLowerCase()}`,
      type === "password_reset" ? 5 : 10,
      60
    );
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if ((type === "password_changed" || type === "confirmation") && !user) {
      log("ERROR: tipo de email requer autenticação", { type });
      return new Response(
        JSON.stringify({ error: "Autenticação necessária para este tipo de email" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome do usuário se não foi fornecido
    if (!nameTrim) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserByEmail(emailTrim);
        if (authUser?.user?.id) {
          const { data: profileData } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", authUser.user.id)
            .maybeSingle();
          nameTrim = profileData?.full_name || "";
        }
      } catch (err) {
        log("WARNING: Não foi possível buscar nome do usuário", { error: err });
      }
    }

    // Preparar email
    let emailHtml: string;
    let emailText: string;
    let subject: string;

    if (type === "password_changed") {
      subject = `Senha alterada com sucesso - ${BRAND_NAME}`;
      emailHtml = getPasswordChangedEmailHtml(nameTrim, loginUrl);
      emailText = getPasswordChangedEmailText(nameTrim, loginUrl);
    } else {
      let linkData;
      if (type === "password_reset") {
        linkData = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: emailTrim,
          options: { redirectTo: resetPasswordRedirectTo },
        });
      } else {
        linkData = await supabaseAdmin.auth.admin.generateLink({
          type: "signup",
          email: emailTrim,
          options: { redirectTo: loginUrl },
        });
      }

      if (linkData.error || !linkData.data) {
        log("ERROR: Erro ao gerar link", { error: linkData.error?.message });
        if (type === "password_reset") {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Se o e-mail existir, enviaremos as instruções de recuperação.",
            }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: linkData.error?.message || "Erro ao gerar link" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const actionLink = linkData.data.properties.action_link;
      log("Link gerado", { link: actionLink.substring(0, 50) + "..." });

      if (type === "password_reset") {
        subject = `Redefinir sua senha - ${BRAND_NAME}`;
        emailHtml = getPasswordResetEmailHtml(nameTrim, actionLink);
        emailText = getPasswordResetEmailText(nameTrim, actionLink);
      } else {
        subject = `Confirme sua conta - ${BRAND_NAME}`;
        emailHtml = getConfirmationEmailHtml(nameTrim, actionLink);
        emailText = getConfirmationEmailText(nameTrim, actionLink);
      }
    }

    const emailSent = await sendEmailViaResend(emailTrim, subject, emailHtml, emailText);

    if (emailSent) {
      log("SUCCESS: Email enviado com sucesso", { email: emailTrim, type });
      return new Response(
        JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    } else {
      log("WARNING: Email não foi enviado", { email: emailTrim });
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao enviar email. Verifique as configurações do Resend.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR: Exceção não tratada", { message, stack });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
