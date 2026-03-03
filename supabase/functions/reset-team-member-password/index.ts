import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("RESET-TEAM-MEMBER-PASSWORD");

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

interface ResetPasswordBody {
  target_user_id: string;
  new_password: string;
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
    // Rate limit: 5 resets por minuto por admin
    const rl = await checkRateLimit(`reset-pw:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    let body: ResetPasswordBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { target_user_id, new_password } = body;

    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "target_user_id é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A nova senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Impedir que admin redefina a própria senha por esta rota
    // (deve usar a rota padrão de alterar senha)
    if (target_user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Use a opção de alterar senha no seu perfil" }),
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
        JSON.stringify({ error: "Apenas administradores podem redefinir senhas" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verificar que o alvo pertence ao mesmo tenant
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", target_user_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Membro não encontrado no seu tenant" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Redefinindo senha", { target_user_id, tenant_id: tenantId });

    // Redefinir senha via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      target_user_id,
      { password: new_password }
    );

    if (updateError) {
      log("ERROR: Falha ao redefinir senha", { error: updateError.message });
      return new Response(
        JSON.stringify({ error: `Erro ao redefinir senha: ${updateError.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    await auditLog({
      supabaseAdmin,
      tenantId,
      actorUserId: user.id,
      action: "team_member_password_reset",
      entityType: "user",
      entityId: target_user_id,
      metadata: {
        targetName: targetProfile.full_name,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Senha de ${targetProfile.full_name} redefinida com sucesso.`,
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
