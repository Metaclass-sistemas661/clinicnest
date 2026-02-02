/**
 * Templates de e-mail para o webhook do Stripe
 */

export function getWelcomeEmailHtml(name: string, magicLink: string): string {
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
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">Bem-vindo, ${name}! 🎉</h2>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Seu pagamento foi confirmado com sucesso!
              </p>
              
              <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Agora você tem acesso completo ao <strong>VynloBella</strong>, o sistema de gestão que vai transformar a forma como você gerencia seu salão.
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para acessar sua conta:
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                      Acessar Minha Conta
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>Importante:</strong> Este link expira em 1 hora por motivos de segurança.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px;">O que você pode fazer agora:</h3>
              
              <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                <li>Configure seus serviços e produtos</li>
                <li>Adicione sua equipe de profissionais</li>
                <li>Cadastre seus clientes</li>
                <li>Comece a gerenciar agendamentos</li>
                <li>Acompanhe suas finanças em tempo real</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                Precisa de ajuda? Entre em contato conosco:
              </p>
              <p style="margin: 0 0 16px; color: #7c3aed; font-size: 14px; font-weight: 600;">
                suporte@vynlobella.com
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

export function getWelcomeEmailText(name: string, magicLink: string): string {
  return `
Bem-vindo ao VynloBella, ${name}!

Seu pagamento foi confirmado com sucesso.

Agora você tem acesso completo ao VynloBella, o sistema de gestão que vai transformar a forma como você gerencia seu salão.

Clique no link abaixo para acessar sua conta:
${magicLink}

Importante: Este link expira em 1 hora por motivos de segurança.

O que você pode fazer agora:
- Configure seus serviços e produtos
- Adicione sua equipe de profissionais
- Cadastre seus clientes
- Comece a gerenciar agendamentos
- Acompanhe suas finanças em tempo real

Precisa de ajuda? Entre em contato conosco:
suporte@vynlobella.com

© ${new Date().getFullYear()} VynloBella. Todos os direitos reservados.
  `.trim();
}

/**
 * Envia e-mail via Resend
 * Para ativar: adicione RESEND_API_KEY nas env vars do Supabase
 */
export async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("[EMAIL] RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VynloBella <onboarding@resend.dev>", // Domínio de teste Resend; troque por noreply@vynlobella.com quando verificar o domínio
        to: to,
        subject: subject,
        html: html,
        text: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[EMAIL] Erro ao enviar via Resend:", error);
      return false;
    }

    const result = await response.json();
    console.log("[EMAIL] E-mail enviado via Resend:", result.id);
    return true;
  } catch (error) {
    console.error("[EMAIL] Exceção ao enviar e-mail:", error);
    return false;
  }
}
