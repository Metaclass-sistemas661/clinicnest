import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  BRAND,
  confirmationEmailHtml,
  confirmationEmailText,
  passwordResetEmailHtml,
  passwordResetEmailText,
  passwordChangedEmailHtml,
  passwordChangedEmailText,
} from "../_shared/emailTemplate.ts";

const log = createLogger("SEND-CUSTOM-AUTH-EMAIL");

// ─── Envio via Resend ──────────────────────────────────────────────────────
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  log("EMAIL: Tentando enviar email via Resend", { to, subject });

  try {
    const emailFrom =
      Deno.env.get("EMAIL_FROM") ||
      Deno.env.get("RESEND_FROM") ||
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

    const result = await response.json();
    log("EMAIL: E-mail enviado com sucesso via Resend", { emailId: result.id, to });
    return { ok: true };
  } catch (error) {
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

    if (type === "password_changed" && !user) {
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
          // Try profiles first (clinic staff)
          const { data: profileData } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", authUser.user.id)
            .maybeSingle();
          nameTrim = profileData?.full_name || "";

          // Fallback to user_metadata (patients)
          if (!nameTrim) {
            const meta = authUser.user.user_metadata as Record<string, unknown> | undefined;
            nameTrim = typeof meta?.full_name === "string" ? meta.full_name : "";
          }
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
      subject = `Senha alterada com sucesso — ${BRAND.name}`;
      emailHtml = passwordChangedEmailHtml(nameTrim, loginUrl);
      emailText = passwordChangedEmailText(nameTrim, loginUrl);
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
      return new Response(
        JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    } else {
      log("WARNING: Email não foi enviado", {
        email: emailTrim,
        status: emailResult.status,
        error: emailResult.error,
      });
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao enviar email via Resend. Verifique as configurações.",
          resendStatus: emailResult.status ?? null,
          resendError: emailResult.error ?? null,
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
