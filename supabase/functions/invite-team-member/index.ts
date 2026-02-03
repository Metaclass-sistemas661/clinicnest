import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteBody {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: "staff" | "admin";
}

const log = (message: string, data?: unknown) => {
  console.log(`[invite-team-member] ${message}`, data ? JSON.stringify(data) : "");
};

serve(async (req) => {
  log("Request recebido", { method: req.method });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    log("ERROR: Variáveis de ambiente faltando");
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    log("Iniciando processamento");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado. Faça login." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: InviteBody;
    try {
      body = await req.json();
      log("Body recebido", { email: body.email, full_name: body.full_name });
    } catch (err) {
      log("ERROR: Erro ao parsear body", { error: err });
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name, phone, role = "staff" } = body;
    const emailTrim = typeof email === "string" ? email.trim() : "";
    const fullNameTrim = typeof full_name === "string" ? full_name.trim() : "";
    const passwordStr = typeof password === "string" ? password : "";

    if (!emailTrim) {
      return new Response(
        JSON.stringify({ error: "E-mail é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!fullNameTrim) {
      return new Response(
        JSON.stringify({ error: "Nome completo é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!passwordStr || passwordStr.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (role !== "staff" && role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Função deve ser staff ou admin" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Buscando profile do usuário");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      log("ERROR: Erro ao buscar profile", { error: profileError.message });
      return new Response(
        JSON.stringify({ error: `Erro ao buscar perfil: ${profileError.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile?.tenant_id) {
      log("ERROR: Profile ou tenant não encontrado");
      return new Response(
        JSON.stringify({ error: "Perfil ou tenant não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    log("Tenant encontrado", { tenant_id: profile.tenant_id });

    log("Verificando se usuário é admin");
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "admin")
      .single();

    if (roleError) {
      log("ERROR: Erro ao buscar role", { error: roleError.message });
      return new Response(
        JSON.stringify({ error: `Erro ao verificar permissões: ${roleError.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleRow) {
      log("ERROR: Usuário não é admin");
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem convidar membros" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    log("Usuário confirmado como admin");

    log("Criando novo usuário", { email: emailTrim, tenant_id: profile.tenant_id });
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrim,
      password: passwordStr,
      email_confirm: true,
      user_metadata: {
        source: "admin_invite",
        tenant_id: profile.tenant_id,
        full_name: fullNameTrim,
        phone: typeof phone === "string" ? phone.trim() || null : null,
        role,
      },
    });

    if (createError) {
      const msg =
        createError.message?.toLowerCase().includes("already") ||
        createError.message?.toLowerCase().includes("registered")
          ? "Já existe uma conta com este e-mail"
          : createError.message || "Erro ao criar usuário";
      log("ERROR: Erro ao criar usuário", { error: createError.message, code: createError.status });
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Usuário criado com sucesso", { user_id: newUser.user?.id });
    return new Response(
      JSON.stringify({
        success: true,
        message: "Membro cadastrado. Ele já pode acessar o sistema com o e-mail e a senha definidos.",
        user_id: newUser.user?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR: Exceção não tratada", { message, stack });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
