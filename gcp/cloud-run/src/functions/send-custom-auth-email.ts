/**
 * send-custom-auth-email — Cloud Run handler */

import { Request, Response } from 'express';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
import {
  BRAND,
  confirmationEmailHtml,
  confirmationEmailText,
  passwordResetEmailHtml,
  passwordResetEmailText,
  passwordChangedEmailHtml,
  passwordChangedEmailText,
} from '../shared/emailTemplates';

const log = createLogger("SEND-CUSTOM-AUTH-EMAIL");

// ─── Envio via Resend ──────────────────────────────────────────────────────
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  log("EMAIL: Tentando enviar email via Resend", { to, subject });

  try {
    const emailFrom =
      process.env.EMAIL_FROM ||
      process.env.RESEND_FROM ||
      `${BRAND.name} <onboarding@resend.dev>`;
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
      return { ok: false, status: response.status, error: errorText };
    }

    const result: any = await response.json() as any;
    log("EMAIL: E-mail enviado com sucesso via Resend", { emailId: result.id, to });
    return { ok: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    log("EMAIL: Exceção ao enviar e-mail", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────
interface EmailBody {
  email: string;
  type: "password_reset" | "confirmation" | "password_changed";
  name?: string;
  redirectTo?: string;
}

const PRODUCTION_URL = "https://clinicnest.metaclass.com.br";

function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return PRODUCTION_URL;
  // Rejeitar localhost/127.0.0.1 — sempre usar produção
  if (s.includes("localhost") || s.includes("127.0.0.1")) return PRODUCTION_URL;
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

export async function sendCustomAuthEmail(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
      log("Request recebido", { method: req.method });

        const authHeader = (req.headers['authorization'] as string);
        let user = null;

        if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          const authResult = (await authAdmin.getUser(token) as any);
          if (!authResult.error && authResult.data) {
            user = authResult.data.user;
            log("Usuário autenticado", { userId: user.id });
          }
        }

        let body: EmailBody;
        try {
          body = req.body;
          log("Body recebido", { email: body.email, type: body.type });
        } catch (err: any) {
          log("ERROR: Erro ao parsear body", { error: err });
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const { email, type, name, redirectTo } = body;
        const emailTrim = typeof email === "string" ? email.trim() : "";
        let nameTrim = typeof name === "string" ? name.trim() : "";
        const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.PUBLIC_SITE_URL);
        const loginUrl = `${siteUrl}/login`;
        const resetPasswordRedirectTo = safeRedirectTo(redirectTo, `${siteUrl}/reset-password`);
        const requesterIp =
          (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() ||
          (req.headers['cf-connecting-ip'] as string) ||
          "unknown";

        if (!emailTrim) {
          return res.status(400).json({ error: "E-mail é obrigatório" });
        }

        if (
          type !== "password_reset" &&
          type !== "confirmation" &&
          type !== "password_changed"
        ) {
          return res.status(400).json({ error: "Tipo inválido. Use 'password_reset', 'confirmation' ou 'password_changed'" });
        }

        const rl = await checkRateLimit(
          `custom-auth-email:${type}:${requesterIp}:${emailTrim.toLowerCase()}`,
          type === "password_reset" ? 5 : 10,
          60
        );
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
        }

        if (type === "password_changed" && !user) {
          log("ERROR: tipo de email requer autenticação", { type });
          return res.status(401).json({ error: "Autenticação necessária para este tipo de email" });
        }

        // Buscar nome do usuário se não foi fornecido
        if (!nameTrim) {
          try {
            const { data: authUser } = await authAdmin.admin.getUserByEmail(emailTrim);
            if (authUser?.uid) {
              // Try profiles first (clinic staff)
              const { data: profileData } = await db.from("profiles")
                .select("full_name")
                .eq("user_id", authUser.uid)
                .maybeSingle();
              nameTrim = profileData?.full_name || "";

              // Fallback to user_metadata (patients)
              if (!nameTrim) {
                const meta = authUser.customClaims as Record<string, unknown> | undefined;
                nameTrim = typeof meta?.full_name === "string" ? meta.full_name : "";
              }
            }
          } catch (err: any) {
            log("WARNING: Não foi possível buscar nome do usuário", { error: err });
          }
        }

        // Preparar email
        let emailHtml: string;
        let emailText: string;
        let subject: string;

        if (type === "password_changed") {
          subject = `Senha alterada com sucesso — ${BRAND.name}`;
          emailHtml = passwordChangedEmailHtml(nameTrim, loginUrl);
          emailText = passwordChangedEmailText(nameTrim, loginUrl);
        } else {
          let linkData;
          if (type === "password_reset") {
            linkData = await authAdmin.admin.generateLink({
              type: "recovery",
              email: emailTrim,
              options: { redirectTo: resetPasswordRedirectTo },
            });
          } else {
            linkData = await authAdmin.admin.generateLink({
              type: "signup",
              email: emailTrim,
              options: { redirectTo: loginUrl },
            });
          }

          if (linkData.error || !linkData.data) {
            log("ERROR: Erro ao gerar link", { error: linkData.error?.message });
            if (type === "password_reset") {
              return res.status(200).json({
                  success: true,
                  message: "Se o e-mail existir, enviaremos as instruções de recuperação.",
                });
            }
            return res.status(500).json({ error: linkData.error?.message || "Erro ao gerar link" });
          }

          const actionLink = linkData.data.properties.action_link;
          log("Link gerado", { link: actionLink.substring(0, 50) + "..." });

          if (type === "password_reset") {
            subject = `Redefinir sua senha — ${BRAND.name}`;
            emailHtml = passwordResetEmailHtml(nameTrim, actionLink);
            emailText = passwordResetEmailText(nameTrim, actionLink);
          } else {
            subject = `Confirme sua conta — ${BRAND.name}`;
            emailHtml = confirmationEmailHtml(nameTrim, actionLink);
            emailText = confirmationEmailText(nameTrim, actionLink);
          }
        }

        const emailResult = await sendEmailViaResend(emailTrim, subject, emailHtml, emailText);

        if (emailResult.ok) {
          log("SUCCESS: Email enviado com sucesso", { email: emailTrim, type });
          return res.status(200).json({ success: true, message: "Email enviado com sucesso" });
        } else {
          log("WARNING: Email não foi enviado", {
            email: emailTrim,
            status: emailResult.status,
            error: emailResult.error,
          });
          return res.status(500).json({
              success: false,
              message: "Erro ao enviar email via Resend. Verifique as configurações.",
              resendStatus: emailResult.status ?? null,
              resendError: emailResult.error ?? null,
            });
        }
  } catch (err: any) {
    console.error(`[send-custom-auth-email] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
