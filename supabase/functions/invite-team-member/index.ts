import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (message: string, data?: unknown) => {
  console.log(`[invite-team-member] ${message}`, data ? JSON.stringify(data) : "");
};

/**
 * Envia e-mail via Resend
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  log("EMAIL: Tentando enviar email via Resend", { to, subject });
  
  try {
    const emailFrom = "VynloBella <noreply@vynlobella.com>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: to,
        subject: subject,
        html: html,
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      return false;
    }

    const result = await response.json();
    log("EMAIL: E-mail enviado com sucesso via Resend", { 
      emailId: result.id,
      to: to 
    });
    return true;
  } catch (error) {
    log("EMAIL: Exceção ao enviar e-mail", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

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

function getTeamMemberWelcomeEmailHtml(name: string, email: string, loginUrl: string, role: string): string {
  const roleLabel = role === "admin" ? "Administrador" : "Profissional";
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao VynloBella</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">VynloBella</h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Gestão Profissional para Salões</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bem-vindo à equipe, ${name}! 🎉</h2>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Você foi cadastrado como <strong>${roleLabel}</strong> no sistema VynloBella.
              </p>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Suas credenciais de acesso são:
              </p>

              <div style="background-color: #f9fafb; border-left: 4px solid #7c3aed; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; font-weight: 600;">E-mail:</p>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; font-family: monospace;">${email}</p>
                <p style="margin: 0 0 8px; color: #1f2937; font-size: 14px; font-weight: 600;">Senha:</p>
                <p style="margin: 0; color: #4b5563; font-size: 16px;">A senha foi definida pelo administrador. Entre em contato com ele se precisar.</p>
              </div>

              <p style="margin: 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para acessar o sistema:
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Acessar o Sistema
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px;">O que você pode fazer:</h3>
              
              <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                <li>Gerenciar agendamentos</li>
                <li>Visualizar clientes e serviços</li>
                ${role === "admin" ? "<li>Acessar relatórios financeiros</li><li>Gerenciar produtos e equipe</li>" : ""}
                <li>Acompanhar sua agenda pessoal</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato com o administrador do sistema.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function getTeamMemberWelcomeEmailText(name: string, email: string, loginUrl: string, role: string): string {
  const roleLabel = role === "admin" ? "Administrador" : "Profissional";
  return `
Bem-vindo à equipe do VynloBella, ${name}!

Você foi cadastrado como ${roleLabel} no sistema VynloBella.

Suas credenciais de acesso são:
E-mail: ${email}
Senha: A senha foi definida pelo administrador. Entre em contato com ele se precisar.

Acesse o sistema em: ${loginUrl}

O que você pode fazer:
- Gerenciar agendamentos
- Visualizar clientes e serviços
${role === "admin" ? "- Acessar relatórios financeiros\n- Gerenciar produtos e equipe\n" : ""}- Acompanhar sua agenda pessoal

Precisa de ajuda? Entre em contato com o administrador do sistema.

© ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
  `.trim();
}

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
      log("ERROR: Sem Authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado. Faça login." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    log("Validando token");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      log("ERROR: Token inválido", { error: userError?.message });
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    log("Usuário autenticado", { userId: user.id });

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

    // Enviar email de boas-vindas ao profissional (não bloqueia se falhar)
    log("Iniciando processo de envio de email", { email: emailTrim });
    try {
      // Sempre usar vynlobella.com como domínio principal
      const siteUrl = Deno.env.get("SITE_URL") || "https://vynlobella.com";
      // Garantir que não use domínio vercel.app
      const finalSiteUrl = siteUrl.includes("vercel.app") ? "https://vynlobella.com" : siteUrl;
      const loginUrl = `${finalSiteUrl}/login`;
      log("URLs configuradas", { siteUrl, finalSiteUrl, loginUrl });
      
      const emailHtml = getTeamMemberWelcomeEmailHtml(fullNameTrim, emailTrim, loginUrl, role);
      const emailText = getTeamMemberWelcomeEmailText(fullNameTrim, emailTrim, loginUrl, role);
      log("Templates de email gerados", { htmlLength: emailHtml.length, textLength: emailText.length });
      
      const emailSent = await sendEmailViaResend(
        emailTrim,
        "Bem-vindo à equipe do VynloBella! 🎉",
        emailHtml,
        emailText
      );
      
      if (emailSent) {
        log("SUCCESS: Email de boas-vindas enviado com sucesso", { email: emailTrim });
      } else {
        log("WARNING: Email não foi enviado", { 
          email: emailTrim,
          reason: "Resend não configurado ou erro na API"
        });
      }
    } catch (emailError) {
      log("ERROR: Exceção ao tentar enviar email (não crítico)", { 
        error: emailError instanceof Error ? emailError.message : String(emailError),
        stack: emailError instanceof Error ? emailError.stack : undefined
      });
      // Não falha o cadastro se o email não for enviado
    }

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
