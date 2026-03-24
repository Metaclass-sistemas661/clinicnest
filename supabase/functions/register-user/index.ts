import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  BRAND,
  verificationCodeEmailHtml,
  verificationCodeEmailText,
} from "../_shared/emailTemplate.ts";

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
  text: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("RESEND_API_KEY não configurada");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  try {
    const emailFrom =
      Deno.env.get("EMAIL_FROM") ||
      Deno.env.get("RESEND_FROM") ||
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

    const result = await response.json();
    log("Email enviado via Resend", { emailId: result.id });
    return { ok: true };
  } catch (error) {
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

    const userId = createData.user.id;
    log("Usuário criado", { userId });

    // ── 2. Gerar código OTP de 6 dígitos ─────────────────────────────────
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidar códigos anteriores para este email
    await supabaseAdmin
      .from("email_verification_codes")
      .delete()
      .eq("email", emailTrim);

    // Inserir novo código
    const { error: insertError } = await supabaseAdmin
      .from("email_verification_codes")
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
        await supabaseAdmin.auth.admin.deleteUser(userId);
        log("Usuário removido após falha ao salvar código", { userId });
      } catch (cleanupErr) {
        log("Falha ao remover usuário", { error: String(cleanupErr) });
      }
      return new Response(
        JSON.stringify({ error: "Erro interno ao gerar código de verificação. Tente novamente." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Código OTP gerado", { email: emailTrim, expiresAt });

    // ── 3. Enviar email com código via Resend ────────────────────────────
    const subject = `${otpCode} — Código de verificação ${BRAND.name}`;
    const emailHtml = verificationCodeEmailHtml(nameTrim, otpCode);
    const emailText = verificationCodeEmailText(nameTrim, otpCode);

    const emailResult = await sendEmailViaResend(emailTrim, subject, emailHtml, emailText);

    if (!emailResult.ok) {
      log("Falha ao enviar email com código via Resend", {
        status: emailResult.status,
        error: emailResult.error,
      });
      // Limpar usuário e código
      try {
        await supabaseAdmin.from("email_verification_codes").delete().eq("user_id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        log("Usuário e código removidos após falha no envio", { userId });
      } catch (cleanupErr) {
        log("Falha ao remover usuário após erro de email", { error: String(cleanupErr) });
      }
      return new Response(
        JSON.stringify({
          success: false,
          emailSent: false,
          error: "Falha no envio de e-mail via Resend. Verifique a configuração do remetente e da API key.",
          resendStatus: emailResult.status ?? null,
          resendError: emailResult.error ?? null,
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Registro com código OTP completo", { email: emailTrim });

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        requiresCode: true,
        message: "Código de verificação enviado para seu e-mail.",
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
