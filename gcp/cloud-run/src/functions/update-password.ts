/**
 * update-password — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("UPDATE-PASSWORD");

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
  <title>Senha Alterada - ClinicNest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">ClinicNest</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Gestão Profissional para Clínicas</p>
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

/**
 * Template texto para email de confirmação de alteração de senha
 */
function getPasswordChangedEmailText(name: string, loginUrl: string): string {
  return `
Senha alterada com sucesso - ClinicNest

Olá${name ? `, ${name}` : ""}!

Sua senha foi alterada com sucesso. Sua conta está segura e protegida.

Alteração realizada em: ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" })}

Agora você pode fazer login com sua nova senha:
${loginUrl}

Dica de segurança: Se você não realizou esta alteração, entre em contato conosco imediatamente.

Precisa de ajuda? Entre em contato com o administrador do sistema.

© ${new Date().getFullYear()} ClinicNest. Todos os direitos reservados.
  `.trim();
}

function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "https://clinicnest.metaclass.com.br";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
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
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  log("EMAIL: Tentando enviar email via Resend", { to, subject });

  try {
    const emailFrom = process.env.EMAIL_FROM || "ClinicNest <no-reply@metaclass.com.br>";
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

    const result = await response.json() as any;
    log("EMAIL: E-mail enviado com sucesso via Resend", {
      emailId: result.id,
      to: to
    });
    return true;
  } catch (error: any) {
    log("EMAIL: Exceção ao enviar e-mail", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

interface UpdatePasswordBody {
  password: string;
}

export async function updatePassword(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    // CORS handled by middleware
      log("Request recebido", { method: req.method });
      const authResult = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); return authAdmin.getUser(token); })();
      if (authResult.error) {
        log("ERROR: Autenticação falhou");
        return authResult.error;
      }
      const user = (authResult.data?.user as any);
      log("Usuário autenticado", { userId: user.id });

      const rl = await checkRateLimit(`update-pwd:${user.id}`, 5, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
      }

      // DB accessed via shared/db module
        let body: UpdatePasswordBody;
        try {
          body = req.body;
          log("Body recebido", { hasPassword: !!body.password });
        } catch (err: any) {
          log("ERROR: Erro ao parsear body", { error: err });
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const { password } = body;
        if (!password || typeof password !== "string" || password.length < 6) {
          return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
        }

        // Atualizar senha usando admin.updateUserById (NÃO envia email automático)
        log("Atualizando senha do usuário", { userId: user.id });
        const { error: updateError } = await authAdmin.admin.updateUserById(user.id, {
          password: password,
        });

        if (updateError) {
          log("ERROR: Erro ao atualizar senha", { error: updateError.message });
          return res.status(500).json({ error: updateError.message || "Erro ao atualizar senha" });
        }

        log("Senha atualizada com sucesso");

        // Buscar nome do usuário
        let name = "";
        try {
          const { data: profileData } = await db.from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          name = profileData?.full_name || "";
        } catch (err: any) {
          log("WARNING: Não foi possível buscar nome do usuário", { error: err });
        }

        // Enviar email customizado de confirmação
        const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.PUBLIC_SITE_URL);
        const loginUrl = `${siteUrl}/login`;
        const emailHtml = getPasswordChangedEmailHtml(name, loginUrl);
        const emailText = getPasswordChangedEmailText(name, loginUrl);
        const subject = "Senha alterada com sucesso - ClinicNest";

        const emailSent = await sendEmailViaResend(
          user.email || "",
          subject,
          emailHtml,
          emailText
        );

        if (emailSent) {
          log("SUCCESS: Email customizado enviado", { email: user.email });
        } else {
          log("WARNING: Email customizado não foi enviado", { email: user.email });
        }

        return res.status(200).json({
            success: true,
            message: "Senha atualizada com sucesso",
            emailSent,
          });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR: Exceção não tratada", { message, stack });
    console.error(`[update-password] Error:`, message);
    return res.status(500).json({ error: message });
  }
}
