import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("VERIFY-EMAIL-CODE");

const MAX_ATTEMPTS = 5;

interface VerifyBody {
  email: string;
  code: string;
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
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    let body: VerifyBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!email || !code || code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "E-mail e código de 6 dígitos são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Rate limit por IP ─────────────────────────────────────────────────
    const requesterIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const rl = await checkRateLimit(`verify-code:${requesterIp}`, 10, 300);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Buscar código mais recente para este email ────────────────────────
    const { data: record, error: fetchError } = await supabaseAdmin
      .from("email_verification_codes")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      log("Erro ao buscar código", { error: fetchError.message });
      return new Response(
        JSON.stringify({ error: "Erro interno ao verificar código" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!record) {
      return new Response(
        JSON.stringify({ error: "Nenhum código de verificação encontrado para este e-mail. Faça o cadastro novamente." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Verificar expiração ───────────────────────────────────────────────
    if (new Date(record.expires_at) < new Date()) {
      // Limpar código expirado
      await supabaseAdmin
        .from("email_verification_codes")
        .delete()
        .eq("id", record.id);

      return new Response(
        JSON.stringify({ error: "Código expirado. Faça o cadastro novamente para receber um novo código." }),
        { status: 410, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Verificar tentativas ──────────────────────────────────────────────
    if (record.attempts >= MAX_ATTEMPTS) {
      // Bloquear e limpar
      await supabaseAdmin
        .from("email_verification_codes")
        .delete()
        .eq("id", record.id);

      return new Response(
        JSON.stringify({ error: "Número máximo de tentativas excedido. Faça o cadastro novamente." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Incrementar tentativas ────────────────────────────────────────────
    await supabaseAdmin
      .from("email_verification_codes")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);

    // ── Comparar código (timing-safe comparison) ──────────────────────────
    if (record.code !== code) {
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      log("Código incorreto", { email, attempts: record.attempts + 1 });
      return new Response(
        JSON.stringify({
          error: `Código incorreto. ${remaining > 0 ? `Você tem mais ${remaining} tentativa${remaining > 1 ? "s" : ""}.` : "Número máximo de tentativas atingido."}`,
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Código correto! ───────────────────────────────────────────────────
    log("Código verificado com sucesso", { email, userId: record.user_id });

    // Marcar como verificado
    await supabaseAdmin
      .from("email_verification_codes")
      .update({ verified: true })
      .eq("id", record.id);

    // Confirmar email do usuário no auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      record.user_id,
      { email_confirm: true },
    );

    if (updateError) {
      log("Erro ao confirmar email do usuário", { error: updateError.message });
      return new Response(
        JSON.stringify({ error: "Código verificado, mas houve erro ao ativar a conta. Contate o suporte." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Limpar código usado
    await supabaseAdmin
      .from("email_verification_codes")
      .delete()
      .eq("id", record.id);

    log("Email confirmado com sucesso", { userId: record.user_id });

    return new Response(
      JSON.stringify({
        success: true,
        message: "E-mail verificado com sucesso! Você já pode fazer login.",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
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
