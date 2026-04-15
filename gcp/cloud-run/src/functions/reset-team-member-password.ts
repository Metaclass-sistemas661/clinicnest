/**
 * reset-team-member-password — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("RESET-TEAM-MEMBER-PASSWORD");

async function auditLog(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.rpc("log_tenant_action", {
      p_tenant_id: params.tenantId,
      p_actor_user_id: params.actorUserId,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_metadata: params.metadata ?? {},
    });
  } catch (err: any) {
    log("AUDIT: failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

interface ResetPasswordBody {
  target_user_id: string;
  new_password: string;
}

export async function resetTeamMemberPassword(req: Request, res: Response) {
  try {
    const authAdmin = createAuthAdmin();
    // CORS handled by middleware
      const user = (req as any).user;
      const tenantId = user.tenant_id;

      // DB accessed via shared/db module
        // Rate limit: 5 resets por minuto por admin
        const rl = await checkRateLimit(`reset-pw:${user.id}`, 5, 60);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
        }

        let body: ResetPasswordBody;
        try {
          body = req.body;
        } catch {
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const { target_user_id, new_password } = body;

        if (!target_user_id || typeof target_user_id !== "string") {
          return res.status(400).json({ error: "target_user_id é obrigatório" });
        }

        if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
          return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres" });
        }

        // Impedir que admin redefina a própria senha por esta rota
        // (deve usar a rota padrão de alterar senha)
        if (target_user_id === user.id) {
          return res.status(400).json({ error: "Use a opção de alterar senha no seu perfil" });
        }

        // Verificar que o caller é admin
        const { data: callerRole } = await db.from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .eq("role", "admin")
          .single();

        if (!callerRole) {
          return res.status(403).json({ error: "Apenas administradores podem redefinir senhas" });
        }

        // Verificar que o alvo pertence ao mesmo tenant
        const { data: targetProfile } = await db.from("profiles")
          .select("id, full_name")
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId)
          .single();

        if (!targetProfile) {
          return res.status(404).json({ error: "Membro não encontrado no seu tenant" });
        }

        log("Redefinindo senha", { target_user_id, tenant_id: tenantId });

        // Redefinir senha via admin API
        const { error: updateError } = await authAdmin.admin.updateUserById(
          target_user_id,
          { password: new_password }
        );

        if (updateError) {
          log("ERROR: Falha ao redefinir senha", { error: updateError.message });
          return res.status(500).json({ error: `Erro ao redefinir senha: ${updateError.message}` });
        }

        await auditLog({ tenantId,
          actorUserId: user.id,
          action: "team_member_password_reset",
          entityType: "user",
          entityId: target_user_id,
          metadata: {
            targetName: targetProfile.full_name,
          },
        });

        return res.status(200).json({
            success: true,
            message: `Senha de ${targetProfile.full_name} redefinida com sucesso.`,
          });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR: Exceção não tratada", { message });
    console.error(`[reset-team-member-password] Error:`, message);
    return res.status(500).json({ error: message });
  }
}
