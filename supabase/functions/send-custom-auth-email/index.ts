import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("SEND-CUSTOM-AUTH-EMAIL");

/**
 * Template HTML para email de reset de senha
 */
function getPasswordResetEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha - VynloBella</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">VynloBella</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Gestão Profissional para Salões</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Redefinir sua senha 🔐</h2>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Olá${name ? `, ${name}` : ""}!
              </p>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no VynloBella.
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Se você não solicitou esta alteração, pode ignorar este email. Sua senha permanecerá a mesma.
              </p>

              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                <strong>Importante:</strong> Este link expira em 1 hora por motivos de segurança.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato com o administrador do sistema.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
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

/**
 * Template texto para email de reset de senha
 */
function getPasswordResetEmailText(name: string, resetUrl: string): string {
  return `
Redefinir sua senha - VynloBella

Olá${name ? `, ${name}` : ""}!

Recebemos uma solicitação para redefinir a senha da sua conta no VynloBella.

Clique no link abaixo para criar uma nova senha:
${resetUrl}

Se você não solicitou esta alteração, pode ignorar este email. Sua senha permanecerá a mesma.

Importante: Este link expira em 1 hora por motivos de segurança.

Precisa de ajuda? Entre em contato com o administrador do sistema.

© ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
  `.trim();
}

/**
 * Template HTML para email de confirmação de conta
 */
function getConfirmationEmailHtml(name: string, confirmationUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme sua conta - VynloBella</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">VynloBella</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Gestão Profissional para Salões</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bem-vindo ao VynloBella! 🎉</h2>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Olá${name ? `, ${name}` : ""}!
              </p>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Obrigado por se cadastrar no VynloBella! Estamos muito felizes em tê-lo conosco.
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Para ativar sua conta, clique no botão abaixo para confirmar seu email:
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${confirmationUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Confirmar Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Se você não criou uma conta no VynloBella, pode ignorar este email.
              </p>

              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                <strong>Importante:</strong> Este link expira em 24 horas por motivos de segurança.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato conosco.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
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

/**
 * Template texto para email de confirmação de conta
 */
function getConfirmationEmailText(name: string, confirmationUrl: string): string {
  return `
Bem-vindo ao VynloBella!

Olá${name ? `, ${name}` : ""}!

Obrigado por se cadastrar no VynloBella! Estamos muito felizes em tê-lo conosco.

Para ativar sua conta, clique no link abaixo para confirmar seu email:
${confirmationUrl}

Se você não criou uma conta no VynloBella, pode ignorar este email.

Importante: Este link expira em 24 horas por motivos de segurança.

Precisa de ajuda? Entre em contato conosco.

© ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
  `.trim();
}

/**
 * Template HTML para email de confirmação de alteração de senha
 */
function getPasswordChangedEmailHtml(name: string, loginUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Senha Alterada - VynloBella</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">VynloBella</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Gestão Profissional para Salões</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Senha alterada com sucesso! ✅</h2>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Olá${name ? `, ${name}` : ""}!
              </p>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Sua senha foi alterada com sucesso. Sua conta está segura e protegida.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">
                  ✓ Alteração realizada em ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
                </p>
              </div>

              <p style="margin: 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Agora você pode fazer login com sua nova senha:
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Fazer Login
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>Dica de segurança:</strong> Se você não realizou esta alteração, entre em contato conosco imediatamente.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato com o administrador do sistema.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
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

/**
 * Template texto para email de confirmação de alteração de senha
 */
function getPasswordChangedEmailText(name: string, loginUrl: string): string {
  return `
Senha alterada com sucesso - VynloBella

Olá${name ? `, ${name}` : ""}!

Sua senha foi alterada com sucesso. Sua conta está segura e protegida.

Alteração realizada em: ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })}

Agora você pode fazer login com sua nova senha:
${loginUrl}

Dica de segurança: Se você não realizou esta alteração, entre em contato conosco imediatamente.

Precisa de ajuda? Entre em contato com o administrador do sistema.

© ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
  `.trim();
}

/**
 * Envia email via Resend
 */
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
    const emailFrom = "VynloBella <noreply@vynlobella.com>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: to,
        subject: subject,
        html: html,
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      return false;
    }

    const result = await response.json();
    log("EMAIL: E-mail enviado com sucesso via Resend", { 
      emailId: result.id,
      to: to 
    });
    return true;
  } catch (error) {
    log("EMAIL: Exceção ao enviar e-mail", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}


interface EmailBody {
  email: string;
  type: "password_reset" | "confirmation" | "password_changed";
  name?: string;
}

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
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Para password_reset, não exigir autenticação (usuário esqueceu senha)
    // Para password_changed, exigir autenticação (usuário está logado)
    // Para confirmation, pode exigir autenticação se necessário
    const authHeader = req.headers.get("Authorization");
    let user = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
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
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { email, type, name } = body;
    const emailTrim = typeof email === "string" ? email.trim() : "";
    let nameTrim = typeof name === "string" ? name.trim() : "";

    if (!emailTrim) {
      return new Response(
        JSON.stringify({ error: "E-mail é obrigatório" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (type !== "password_reset" && type !== "confirmation" && type !== "password_changed") {
      return new Response(
        JSON.stringify({ error: "Tipo de email inválido. Use 'password_reset', 'confirmation' ou 'password_changed'" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Para password_changed, verificar se usuário está autenticado
    if (type === "password_changed" && !user) {
      log("ERROR: password_changed requer autenticação");
      return new Response(
        JSON.stringify({ error: "Autenticação necessária para este tipo de email" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
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
        // Continua sem nome
      }
    }

    // Preparar email
    let emailHtml: string;
    let emailText: string;
    let subject: string;

    if (type === "password_changed") {
      // Para password_changed, não precisa gerar link, apenas usar login URL
      const loginUrl = "https://vynlobella.com/login";
      subject = "Senha alterada com sucesso - VynloBella";
      emailHtml = getPasswordChangedEmailHtml(nameTrim, loginUrl);
      emailText = getPasswordChangedEmailText(nameTrim, loginUrl);
    } else {
      // Gerar link apropriado para password_reset ou confirmation
      let linkData;
      if (type === "password_reset") {
        linkData = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: emailTrim,
          options: {
            redirectTo: "https://vynlobella.com/reset-password",
          },
        });
      } else {
        linkData = await supabaseAdmin.auth.admin.generateLink({
          type: "signup",
          email: emailTrim,
          options: {
            redirectTo: "https://vynlobella.com/login",
          },
        });
      }

      if (linkData.error || !linkData.data) {
        log("ERROR: Erro ao gerar link", { error: linkData.error?.message });
        return new Response(
          JSON.stringify({ error: linkData.error?.message || "Erro ao gerar link" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const actionLink = linkData.data.properties.action_link;
      log("Link gerado", { link: actionLink.substring(0, 50) + "..." });

      if (type === "password_reset") {
        subject = "Redefinir sua senha - VynloBella";
        emailHtml = getPasswordResetEmailHtml(nameTrim, actionLink);
        emailText = getPasswordResetEmailText(nameTrim, actionLink);
      } else {
        subject = "Confirme sua conta - VynloBella";
        emailHtml = getConfirmationEmailHtml(nameTrim, actionLink);
        emailText = getConfirmationEmailText(nameTrim, actionLink);
      }
    }

    // Enviar email
    const emailSent = await sendEmailViaResend(
      emailTrim,
      subject,
      emailHtml,
      emailText
    );

    if (emailSent) {
      log("SUCCESS: Email enviado com sucesso", { email: emailTrim, type });
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email enviado com sucesso",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    } else {
      log("WARNING: Email não foi enviado", { email: emailTrim });
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao enviar email. Verifique as configurações do Resend.",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR: Exceção não tratada", { message, stack });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
