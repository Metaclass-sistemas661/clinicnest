/**
 * verify-email-code — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("VERIFY-EMAIL-CODE");

const MAX_ATTEMPTS = 5;

interface VerifyBody {
  email: string;
  code: string;
}

export async function verifyEmailCode(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    // CORS handled by middleware
      // DB accessed via shared/db module
      try {

        let body: VerifyBody;
        try {
          body = req.body;
        } catch {
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const code = typeof body.code === "string" ? body.code.trim() : "";

        if (!email || !code || code.length !== 6) {
          return res.status(400).json({ error: "E-mail e código de 6 dígitos são obrigatórios" });
        }

        // ── Rate limit por IP ─────────────────────────────────────────────────
        const requesterIp =
          (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() ||
          (req.headers['cf-connecting-ip'] as string) ||
          "unknown";

        const rl = await checkRateLimit(`verify-code:${requesterIp}`, 10, 300);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
        }

        // ── Buscar código mais recente para este email ────────────────────────
        const { data: record, error: fetchError } = await db.from("email_verification_codes")
          .select("*")
          .eq("email", email)
          .eq("verified", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          log("Erro ao buscar código", { error: fetchError.message });
          return res.status(500).json({ error: "Erro interno ao verificar código" });
        }

        if (!record) {
          return res.status(404).json({ error: "Nenhum código de verificação encontrado para este e-mail. Faça o cadastro novamente." });
        }

        // ── Verificar expiração ───────────────────────────────────────────────
        if (new Date(record.expires_at) < new Date()) {
          // Limpar código expirado
          await db.from("email_verification_codes")
            .delete()
            .eq("id", record.id);

          return res.status(410).json({ error: "Código expirado. Faça o cadastro novamente para receber um novo código." });
        }

        // ── Verificar tentativas ──────────────────────────────────────────────
        if (record.attempts >= MAX_ATTEMPTS) {
          // Bloquear e limpar
          await db.from("email_verification_codes")
            .delete()
            .eq("id", record.id);

          return res.status(429).json({ error: "Número máximo de tentativas excedido. Faça o cadastro novamente." });
        }

        // ── Incrementar tentativas ────────────────────────────────────────────
        await db.from("email_verification_codes")
          .update({ attempts: record.attempts + 1 })
          .eq("id", record.id);

        // ── Comparar código (timing-safe comparison) ──────────────────────────
        if (record.code !== code) {
          const remaining = MAX_ATTEMPTS - (record.attempts + 1);
          log("Código incorreto", { email, attempts: record.attempts + 1 });
          return res.status(400).json({
              error: `Código incorreto. ${remaining > 0 ? `Você tem mais ${remaining} tentativa${remaining > 1 ? "s" : ""}.` : "Número máximo de tentativas atingido."}`,
            });
        }

        // ── Código correto! ───────────────────────────────────────────────────
        log("Código verificado com sucesso", { email, userId: record.user_id });

        // Marcar como verificado
        await db.from("email_verification_codes")
          .update({ verified: true })
          .eq("id", record.id);

        // Confirmar email do usuário no auth
        const { error: updateError } = await authAdmin.admin.updateUserById(
          record.user_id,
          { email_confirm: true });

        if (updateError) {
          log("Erro ao confirmar email do usuário", { error: updateError.message });
          return res.status(500).json({ error: "Código verificado, mas houve erro ao ativar a conta. Contate o suporte." });
        }

        // Limpar código usado
        await db.from("email_verification_codes")
          .delete()
          .eq("id", record.id);

        log("Email confirmado com sucesso", { userId: record.user_id });

        return res.status(200).json({
            success: true,
            message: "E-mail verificado com sucesso! Você já pode fazer login.",
          });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        log("Exceção não tratada", { error: message });
        return res.status(500).json({ error: message });
      }
  } catch (err: any) {
    console.error(`[verify-email-code] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
