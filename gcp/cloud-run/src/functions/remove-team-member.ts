/**
 * remove-team-member — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("REMOVE-TEAM-MEMBER");

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

interface RemoveBody {
  target_user_id: string;
  /** "deactivate" preserva o auth user mas remove profile/roles. "delete" remove tudo. */
  mode?: "deactivate" | "delete";
}

export async function removeTeamMember(req: Request, res: Response) {
  try {
    const authAdmin = createAuthAdmin();
    // CORS handled by middleware
      const user = (req as any).user;
      const tenantId = user.tenant_id;

      // DB accessed via shared/db module
        // Rate limit
        const rl = await checkRateLimit(`remove:${user.id}`, 5, 60);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
        }

        let body: RemoveBody;
        try {
          body = req.body;
        } catch {
          return res.status(400).json({ error: "Corpo da requisição inválido" });
        }

        const { target_user_id, mode = "deactivate" } = body;

        if (!target_user_id || typeof target_user_id !== "string") {
          return res.status(400).json({ error: "target_user_id é obrigatório" });
        }

        // Impedir auto-remoção
        if (target_user_id === user.id) {
          return res.status(400).json({ error: "Você não pode remover a si mesmo" });
        }

        // Verificar que o caller é admin
        const { data: callerRole } = await db.from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .eq("role", "admin")
          .single();

        if (!callerRole) {
          return res.status(403).json({ error: "Apenas administradores podem remover membros" });
        }

        // Verificar que o alvo pertence ao mesmo tenant
        const { data: targetProfile } = await db.from("profiles")
          .select("id, full_name, user_id")
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId)
          .single();

        if (!targetProfile) {
          return res.status(404).json({ error: "Membro não encontrado no seu tenant" });
        }

        // Impedir remoção do último admin
        const { count: adminCount } = await db.from("user_roles")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("role", "admin");

        const { data: targetRole } = await db.from("user_roles")
          .select("role")
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId)
          .single();

        if (targetRole?.role === "admin" && (adminCount ?? 0) <= 1) {
          return res.status(400).json({ error: "Não é possível remover o único administrador da clínica" });
        }

        log("Removendo membro", { target_user_id, mode, tenant_id: tenantId });

        // 1. Remover permission_overrides
        await db.from("permission_overrides")
          .delete()
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId);

        // 2. Remover professional_commissions (se existir)
        await db.from("professional_commissions")
          .delete()
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId);

        // 3. Remover user_roles
        await db.from("user_roles")
          .delete()
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId);

        // 4. Remover profile
        await db.from("profiles")
          .delete()
          .eq("user_id", target_user_id)
          .eq("tenant_id", tenantId);

        // 5. Se mode=delete, deletar o auth user completamente
        if (mode === "delete") {
          const { error: deleteError } = await authAdmin.admin.deleteUser(
            target_user_id
          );
          if (deleteError) {
            log("WARN: Falha ao deletar auth user (profile já removido)", {
              error: deleteError.message,
            });
            // Não falha o request — profile já foi removido, acesso revogado
          }
        }

        await auditLog({ tenantId,
          actorUserId: user.id,
          action: mode === "delete" ? "team_member_deleted" : "team_member_deactivated",
          entityType: "user",
          entityId: target_user_id,
          metadata: {
            removedName: targetProfile.full_name,
            mode,
          },
        });

        return res.status(200).json({
            success: true,
            message:
              mode === "delete"
                ? "Membro removido permanentemente."
                : "Membro desvinculado da clínica. A conta foi desativada.",
          });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR: Exceção não tratada", { message });
    console.error(`[remove-team-member] Error:`, message);
    return res.status(500).json({ error: message });
  }
}
