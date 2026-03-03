import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("REMOVE-TEAM-MEMBER");

async function auditLog(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await params.supabaseAdmin.rpc("log_tenant_action", {
      p_tenant_id: params.tenantId,
      p_actor_user_id: params.actorUserId,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_metadata: params.metadata ?? {},
    });
  } catch (err) {
    log("AUDIT: failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

interface RemoveBody {
  target_user_id: string;
  /** "deactivate" preserva o auth user mas remove profile/roles. "delete" remove tudo. */
  mode?: "deactivate" | "delete";
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUserWithTenant(req, cors);
  if (authResult.error) return authResult.error;
  const user = authResult.user;
  const tenantId = authResult.tenantId;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Rate limit
    const rl = await checkRateLimit(`remove:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    let body: RemoveBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { target_user_id, mode = "deactivate" } = body;

    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "target_user_id é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Impedir auto-remoção
    if (target_user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode remover a si mesmo" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verificar que o caller é admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem remover membros" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verificar que o alvo pertence ao mesmo tenant
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, user_id")
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Membro não encontrado no seu tenant" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Impedir remoção do último admin
    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "admin");

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId)
      .single();

    if (targetRole?.role === "admin" && (adminCount ?? 0) <= 1) {
      return new Response(
        JSON.stringify({ error: "Não é possível remover o único administrador da clínica" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Removendo membro", { target_user_id, mode, tenant_id: tenantId });

    // 1. Remover permission_overrides
    await supabaseAdmin
      .from("permission_overrides")
      .delete()
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId);

    // 2. Remover professional_commissions (se existir)
    await supabaseAdmin
      .from("professional_commissions")
      .delete()
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId);

    // 3. Remover user_roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId);

    // 4. Remover profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId);

    // 5. Se mode=delete, deletar o auth user completamente
    if (mode === "delete") {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        target_user_id
      );
      if (deleteError) {
        log("WARN: Falha ao deletar auth user (profile já removido)", {
          error: deleteError.message,
        });
        // Não falha o request — profile já foi removido, acesso revogado
      }
    }

    await auditLog({
      supabaseAdmin,
      tenantId,
      actorUserId: user.id,
      action: mode === "delete" ? "team_member_deleted" : "team_member_deactivated",
      entityType: "user",
      entityId: target_user_id,
      metadata: {
        removedName: targetProfile.full_name,
        mode,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message:
          mode === "delete"
            ? "Membro removido permanentemente."
            : "Membro desvinculado da clínica. A conta foi desativada.",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR: Exceção não tratada", { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
