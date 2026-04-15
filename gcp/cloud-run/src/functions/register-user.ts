/**
 * register-user — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';

const BRAND = { name: 'ClinicNest', color: '#0d9488' };


function verificationCodeEmailHtml(code: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Código de Verificação</h2><p>Seu código é: <strong>${code}</strong></p></div>`;
}
function verificationCodeEmailText(code: string): string {
  return `Seu código de verificação é: ${code}`;
}

const log = createLogger("REGISTER-USER");

const OTP_EXPIRY_MINUTES = 15;

// ─── Gerar código OTP de 6 dígitos ────────────────────────────────────────
function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

// ─── Envio via Resend ──────────────────────────────────────────────────────
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    log("RESEND_API_KEY não configurada");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  try {
    const emailFrom =
      process.env.EMAIL_FROM ||
      process.env.RESEND_FROM ||
      `${BRAND.name} <onboarding@resend.dev>`;

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
      return { ok: false, status: response.status, error: errorText };
    }

    const result = await response.json() as any;
    log("Email enviado via Resend", { emailId: result.id });
    return { ok: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    log("Exceção ao enviar email", { error: message });
    return { ok: false, error: message };
  }
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

export async function registerUser(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    // CORS handled by middleware
      // DB accessed via shared/db module
      try {

        let body: RegisterBody;
        try {
          body = req.body;
        } catch {
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const { email, password, fullName, clinicName, phone, legalAcceptedAt, professionalData } = body;

        const emailTrim = typeof email === "string" ? email.trim().toLowerCase() : "";
        const nameTrim = typeof fullName === "string" ? fullName.trim() : "";
        const clinicTrim = typeof clinicName === "string" ? clinicName.trim() : "";

        // ── Validações ────────────────────────────────────────────────────────
        if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
          return res.status(400).json({ error: "E-mail inválido" });
        }

        if (!password || password.length < 6) {
          return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
        }

        if (!nameTrim) {
          return res.status(400).json({ error: "Nome completo é obrigatório" });
        }

        if (!clinicTrim) {
          return res.status(400).json({ error: "Nome da clínica é obrigatório" });
        }

        // ── Rate limit ────────────────────────────────────────────────────────
        const requesterIp =
          (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() ||
          (req.headers['cf-connecting-ip'] as string) ||
          "unknown";

        const rl = await checkRateLimit(`register-user:${requesterIp}`, 5, 300);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
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
        const { data: createData, error: createError } = await authAdmin.admin.createUser({
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
            return res.status(409).json({ error: "Este e-mail já está cadastrado" });
          }

          return res.status(400).json({ error: createError.message || "Erro ao criar conta" });
        }

        if (!createData?.user) {
          return res.status(500).json({ error: "Erro inesperado ao criar usuário" });
        }

        const userId = createData.user.uid;
        log("Usuário criado", { userId });

        // ── 2. Gerar código OTP de 6 dígitos ─────────────────────────────────
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        // Invalidar códigos anteriores para este email
        await db.from("email_verification_codes")
          .delete()
          .eq("email", emailTrim);

        // Inserir novo código
        const { error: insertError } = await db.from("email_verification_codes")
          .insert({
            user_id: userId,
            email: emailTrim,
            code: otpCode,
            expires_at: expiresAt,
            attempts: 0,
            verified: false,
          });

        if (insertError) {
          log("Erro ao salvar código de verificação", { error: insertError.message });
          try {
            await authAdmin.admin.deleteUser(userId);
            log("Usuário removido após falha ao salvar código", { userId });
          } catch (cleanupErr: any) {
            log("Falha ao remover usuário", { error: String(cleanupErr) });
          }
          return res.status(500).json({ error: "Erro interno ao gerar código de verificação. Tente novamente." });
        }

        log("Código OTP gerado", { email: emailTrim, expiresAt });

        // ── 3. Enviar email com código via Resend ────────────────────────────
        const subject = `${otpCode} — Código de verificação ${BRAND.name}`;
        const emailHtml = verificationCodeEmailHtml(otpCode);
        const emailText = verificationCodeEmailText(otpCode);

        const emailResult = await sendEmailViaResend(emailTrim, subject, emailHtml, emailText);

        if (!emailResult.ok) {
          log("Falha ao enviar email com código via Resend", {
            status: emailResult.status,
            error: emailResult.error,
          });
          // Limpar usuário e código
          try {
            await db.from("email_verification_codes").delete().eq("user_id", userId);
            await authAdmin.admin.deleteUser(userId);
            log("Usuário e código removidos após falha no envio", { userId });
          } catch (cleanupErr: any) {
            log("Falha ao remover usuário após erro de email", { error: String(cleanupErr) });
          }
          return res.status(502).json({
              success: false,
              emailSent: false,
              error: "Falha no envio de e-mail via Resend. Verifique a configuração do remetente e da API key.",
              resendStatus: emailResult.status ?? null,
              resendError: emailResult.error ?? null,
            });
        }

        log("Registro com código OTP completo", { email: emailTrim });

        return res.status(201).json({
            success: true,
            emailSent: true,
            requiresCode: true,
            message: "Código de verificação enviado para seu e-mail.",
          });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        log("Exceção não tratada", { error: message });
        return res.status(500).json({ error: message });
      }
  } catch (err: any) {
    console.error(`[register-user] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
