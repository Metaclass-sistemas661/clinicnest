/**
 * Helper para Edge Functions chamadas por usuário autenticado (JWT no Authorization).
 * Usa anon key + JWT para validar a sessão (evita 401 ao usar service_role para getUser).
 * Use em toda função que for chamada pelo frontend com session do usuário.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type { User } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export type AuthResult =
  | { user: User; error: null }
  | { user: null; error: Response };

/**
 * Valida o JWT do Authorization header e retorna o usuário autenticado.
 * Se falhar, retorna uma Response pronta para retornar (401) com CORS.
 */
export async function getAuthenticatedUser(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<AuthResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Não autorizado. Faça login." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { user, error: null };
}

export type AuthWithTenantResult =
  | { user: User; tenantId: string; error: null }
  | { user: null; tenantId: null; error: Response };

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Valida o JWT e retorna o usuário autenticado e o tenant_id do perfil (Seção 4.6).
 * Use em operações sensíveis que exigem tenant (ex.: convite, recursos por tenant).
 * Se o perfil não tiver tenant_id, retorna erro 403.
 */
export async function getAuthenticatedUserWithTenant(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<AuthWithTenantResult> {
  const authResult = await getAuthenticatedUser(req, corsHeaders);
  if (authResult.error) return { user: null, tenantId: null, error: authResult.error };

  const user = authResult.user;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      user: null,
      tenantId: null,
      error: new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.tenant_id) {
    return {
      user: null,
      tenantId: null,
      error: new Response(
        JSON.stringify({ error: "Perfil ou tenant não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { user, tenantId: profile.tenant_id, error: null };
}
