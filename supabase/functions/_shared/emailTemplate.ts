/**
 * Enterprise Email Template System — ClinicNest
 * Paleta Teal médica consistente com o sistema.
 *
 * Exports:
 *   - wrapEmail(title, preheader, content)  → HTML completo
 *   - brandButton(href, label)              → CTA button
 *   - infoBox(icon, text, variant)          → Callout box
 *   - securityFootnote(text)                → Nota de segurança
 *   - escapeHtml(str)                       → Escape para XSS
 *   - BRAND                                 → Constantes de marca
 */

// ─── Brand constants ───────────────────────────────────────────────────────
export const BRAND = {
  name: "ClinicNest",
  tagline: "Gestão Profissional para Clínicas",
  domain: "clinicnest.metaclass.com.br",
  supportEmail: "suporte@metaclass.com.br",
  year: new Date().getFullYear(),
  // Teal palette (matches tailwind.config / index.css)
  colors: {
    primary:     "#0C9B8B",   // hsl(174 72% 38%)
    primaryDark: "#0f766e",   // teal-700
    primaryDeep: "#134e4a",   // teal-900  (headings)
    accent:      "#0d7fa8",   // cyan-blue accent
    light:       "#ccfbf1",   // teal-100
    softer:      "#f0fdfa",   // teal-50   (background)
    surface:     "#ffffff",
    text:        "#374151",   // gray-700
    textLight:   "#6b7280",   // gray-500
    textMuted:   "#9ca3af",   // gray-400
    border:      "#99f6e4",   // teal-200
    borderLight: "#e5e7eb",   // gray-200
    success:     "#059669",   // emerald-600
    successBg:   "#ecfdf5",   // emerald-50
    warning:     "#d97706",   // amber-600
    warningBg:   "#fffbeb",   // amber-50
  },
} as const;

const C = BRAND.colors;
const GRADIENT = `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`;

// ─── Helpers ───────────────────────────────────────────────────────────────
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Enterprise header ────────────────────────────────────────────────────
function header(): string {
  return `
          <!-- Header -->
          <tr>
            <td style="background: ${GRADIENT}; padding: 0;">
              <!-- Top bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 32px 40px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <!-- Logo mark -->
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background: rgba(255,255,255,0.2); border-radius: 12px; padding: 10px 14px; line-height: 1;">
                                <span style="font-size: 22px; line-height: 1;">🏥</span>
                              </td>
                              <td style="padding-left: 14px;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
                                  ${BRAND.name}
                                </h1>
                                <p style="margin: 2px 0 0; color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 400; line-height: 1.3;">
                                  ${BRAND.tagline}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Teal accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height: 4px; background: rgba(255,255,255,0.25);"></td></tr>
              </table>
            </td>
          </tr>`;
}

// ─── Enterprise footer ────────────────────────────────────────────────────
function footer(): string {
  return `
          <!-- Divider -->
          <tr><td style="padding: 0 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height: 1px; background: ${C.borderLight};"></td></tr></table></td></tr>

          <!-- Help section -->
          <tr>
            <td style="padding: 24px 40px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: ${C.textLight}; font-size: 14px; line-height: 1.5;">
                      Precisa de ajuda? Estamos aqui para você.
                    </p>
                    <table cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://${BRAND.domain}" style="color: ${C.primary}; text-decoration: none; font-size: 13px; font-weight: 600;">Acessar Plataforma</a>
                        </td>
                        <td style="color: ${C.borderLight}; font-size: 13px;">|</td>
                        <td style="padding: 0 8px;">
                          <a href="mailto:${BRAND.supportEmail}" style="color: ${C.primary}; text-decoration: none; font-size: 13px; font-weight: 600;">Contatar Suporte</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal footer -->
          <tr>
            <td style="background-color: ${C.softer}; padding: 20px 40px; border-top: 1px solid ${C.border};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 4px; color: ${C.textMuted}; font-size: 12px; line-height: 1.5;">
                      &copy; ${BRAND.year} ${BRAND.name}. Todos os direitos reservados.
                    </p>
                    <p style="margin: 0; color: ${C.textMuted}; font-size: 11px; line-height: 1.5;">
                      Este é um e-mail automático. Por favor, não responda diretamente.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ─── CTA Button (with Outlook VML fallback) ───────────────────────────────
export function brandButton(href: string, label: string): string {
  return `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 28px 0 8px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="${href}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="15%" strokecolor="${C.primary}" fillcolor="${C.primary}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${href}"
                       style="display: inline-block; background: ${GRADIENT}; color: #ffffff;
                              text-decoration: none; padding: 16px 48px; border-radius: 10px;
                              font-size: 16px; font-weight: 700; letter-spacing: 0.2px;
                              box-shadow: 0 4px 14px rgba(12,155,139,0.35), 0 1px 3px rgba(0,0,0,0.08);
                              mso-hide: all;">
                      ${label}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

// ─── Info / Callout box ───────────────────────────────────────────────────
export function infoBox(
  icon: string,
  text: string,
  variant: "teal" | "success" | "warning" = "teal",
): string {
  const styles = {
    teal:    { bg: C.softer,    border: C.primary, text: C.primaryDeep },
    success: { bg: C.successBg, border: C.success, text: "#065f46" },
    warning: { bg: C.warningBg, border: C.warning, text: "#92400e" },
  }[variant];

  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td style="background-color: ${styles.bg}; border-left: 4px solid ${styles.border}; border-radius: 0 8px 8px 0; padding: 16px 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px; font-size: 18px; line-height: 1;">${icon}</td>
                        <td style="color: ${styles.text}; font-size: 14px; line-height: 1.6; font-weight: 500;">${text}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

// ─── Security footnote ────────────────────────────────────────────────────
export function securityFootnote(text: string): string {
  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: ${C.softer}; border: 1px solid ${C.border}; border-radius: 8px; padding: 14px 18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 10px; font-size: 16px; line-height: 1;">🔒</td>
                        <td style="color: ${C.textLight}; font-size: 12px; line-height: 1.6;">${text}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

// ─── Feature list item (for welcome email) ────────────────────────────────
export function featureItem(icon: string, title: string, desc: string): string {
  return `
                    <tr>
                      <td style="padding: 10px 0;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align: top; width: 40px;">
                              <div style="background: ${C.softer}; border: 1px solid ${C.border}; border-radius: 8px; width: 36px; height: 36px; text-align: center; line-height: 36px; font-size: 18px;">${icon}</div>
                            </td>
                            <td style="padding-left: 14px; vertical-align: top;">
                              <p style="margin: 0 0 2px; color: ${C.primaryDeep}; font-size: 14px; font-weight: 700; line-height: 1.3;">${title}</p>
                              <p style="margin: 0; color: ${C.textLight}; font-size: 13px; line-height: 1.4;">${desc}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>`;
}

// ─── Full email wrapper ───────────────────────────────────────────────────
export function wrapEmail(title: string, preheader: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)} — ${BRAND.name}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0; mso-table-rspace: 0; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a { color: ${C.primary}; }
    /* Mobile */
    @media only screen and (max-width: 640px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-container td { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-full { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${C.softer}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(preheader)}
    ${"&zwnj;&nbsp;".repeat(30)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${C.softer}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Email container -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0"
               style="background-color: ${C.surface}; border-radius: 16px; overflow: hidden;
                      box-shadow: 0 4px 24px rgba(12,155,139,0.08), 0 1px 4px rgba(0,0,0,0.04);
                      border: 1px solid ${C.border};">
          ${header()}
          ${content}
          ${footer()}
        </table>
        <!-- End container -->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRE-BUILT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Template: Confirmação de conta (welcome)
 */
export function confirmationEmailHtml(name: string, url: string): string {
  const greeting = name ? `Olá, <strong>${escapeHtml(name)}</strong>!` : "Olá!";
  const content = `
          <!-- Content -->
          <tr>
            <td style="padding: 40px 40px 16px;">
              <h2 style="margin: 0 0 8px; color: ${C.primaryDeep}; font-size: 24px; font-weight: 700; line-height: 1.3;">
                Bem-vindo ao ${BRAND.name}!
              </h2>
              <p style="margin: 0 0 24px; color: ${C.textLight}; font-size: 15px; line-height: 1.5;">
                Sua plataforma de gestão clínica profissional está pronta.
              </p>

              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 15px; line-height: 1.7;">
                Obrigado por se cadastrar no <strong>${BRAND.name}</strong>. Para ativar sua conta
                e começar a usar todos os recursos, confirme seu e-mail:
              </p>

              ${brandButton(url, "✓&nbsp;&nbsp;Confirmar Meu E-mail")}
            </td>
          </tr>

          <!-- Features preview -->
          <tr>
            <td style="padding: 8px 40px 12px;">
              ${infoBox("🚀", "Após confirmar, você terá acesso imediato à plataforma completa.", "teal")}
            </td>
          </tr>

          <tr>
            <td style="padding: 4px 40px 8px;">
              <p style="margin: 0 0 12px; color: ${C.primaryDark}; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                O que você pode fazer
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${featureItem("📅", "Agenda Inteligente", "Gerencie consultas, encaixes e lembretes automáticos")}
                ${featureItem("👥", "Prontuário Digital", "Registros clínicos organizados e seguros")}
                ${featureItem("💰", "Financeiro Completo", "Controle de receitas, comissões e relatórios")}
                ${featureItem("🤖", "IA Integrada", "Assistente de triagem, transcrição e sugestões clínicas")}
              </table>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding: 16px 40px 32px;">
              ${securityFootnote("Este link expira em <strong>24 horas</strong> por motivos de segurança. Se você não criou esta conta, ignore este e-mail.")}
            </td>
          </tr>`;

  return wrapEmail(
    "Confirme sua conta",
    `${name ? name + ", b" : "B"}em-vindo ao ${BRAND.name}! Confirme seu e-mail para ativar sua conta.`,
    content,
  );
}

export function confirmationEmailText(name: string, url: string): string {
  return `
Bem-vindo ao ${BRAND.name}!

Olá${name ? `, ${name}` : ""}!

Obrigado por se cadastrar no ${BRAND.name}! Para ativar sua conta, acesse o link abaixo:

${url}

O que você pode fazer:
- Agenda Inteligente: consultas, encaixes e lembretes automáticos
- Prontuário Digital: registros clínicos organizados e seguros
- Financeiro Completo: receitas, comissões e relatórios
- IA Integrada: triagem, transcrição e sugestões clínicas

Este link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.

© ${BRAND.year} ${BRAND.name} — ${BRAND.tagline}
Precisa de ajuda? ${BRAND.supportEmail}
`.trim();
}

/**
 * Template: Redefinir senha
 */
export function passwordResetEmailHtml(name: string, url: string): string {
  const greeting = name ? `Olá, <strong>${escapeHtml(name)}</strong>!` : "Olá!";
  const content = `
          <!-- Content -->
          <tr>
            <td style="padding: 40px 40px 16px;">
              <h2 style="margin: 0 0 8px; color: ${C.primaryDeep}; font-size: 24px; font-weight: 700; line-height: 1.3;">
                Redefinir sua senha
              </h2>
              <p style="margin: 0 0 24px; color: ${C.textLight}; font-size: 15px; line-height: 1.5;">
                Solicitação de recuperação de acesso
              </p>

              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 15px; line-height: 1.7;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${BRAND.name}</strong>.
                Clique no botão abaixo para criar uma nova senha:
              </p>

              ${brandButton(url, "🔐&nbsp;&nbsp;Redefinir Minha Senha")}
            </td>
          </tr>

          <tr>
            <td style="padding: 8px 40px 12px;">
              ${infoBox("ℹ️", "Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Sua senha permanecerá inalterada.", "teal")}
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding: 16px 40px 32px;">
              ${securityFootnote("Este link expira em <strong>1 hora</strong> por motivos de segurança. Cada link pode ser usado apenas uma vez.")}
            </td>
          </tr>`;

  return wrapEmail(
    "Redefinir sua senha",
    `Solicitação para redefinir a senha da sua conta ${BRAND.name}.`,
    content,
  );
}

export function passwordResetEmailText(name: string, url: string): string {
  return `
Redefinir sua senha — ${BRAND.name}

Olá${name ? `, ${name}` : ""}!

Recebemos uma solicitação para redefinir a senha da sua conta no ${BRAND.name}.

Acesse o link abaixo para criar uma nova senha:
${url}

Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.

Este link expira em 1 hora e pode ser usado apenas uma vez.

© ${BRAND.year} ${BRAND.name} — ${BRAND.tagline}
Precisa de ajuda? ${BRAND.supportEmail}
`.trim();
}

/**
 * Template: Senha alterada com sucesso
 */
export function passwordChangedEmailHtml(name: string, loginUrl: string): string {
  const greeting = name ? `Olá, <strong>${escapeHtml(name)}</strong>!` : "Olá!";
  const changedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  const content = `
          <!-- Content -->
          <tr>
            <td style="padding: 40px 40px 16px;">
              <h2 style="margin: 0 0 8px; color: ${C.primaryDeep}; font-size: 24px; font-weight: 700; line-height: 1.3;">
                Senha alterada com sucesso
              </h2>
              <p style="margin: 0 0 24px; color: ${C.textLight}; font-size: 15px; line-height: 1.5;">
                Sua conta está segura e protegida
              </p>

              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 6px; color: ${C.text}; font-size: 15px; line-height: 1.7;">
                Sua senha no <strong>${BRAND.name}</strong> foi alterada com sucesso.
                Agora você pode fazer login com sua nova senha.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 12px;">
              ${infoBox("✅", `Alteração realizada em <strong>${changedAt}</strong>`, "success")}
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 8px;">
              ${brandButton(loginUrl, "Acessar Minha Conta")}
            </td>
          </tr>

          <tr>
            <td style="padding: 8px 40px 12px;">
              ${infoBox("⚠️", "Se você <strong>não</strong> realizou esta alteração, entre em contato com o suporte imediatamente para proteger sua conta.", "warning")}
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding: 16px 40px 32px;">
              ${securityFootnote("Por segurança, todas as sessões anteriores foram encerradas. Faça login novamente em seus dispositivos.")}
            </td>
          </tr>`;

  return wrapEmail(
    "Senha alterada",
    `Sua senha no ${BRAND.name} foi alterada com sucesso em ${changedAt}.`,
    content,
  );
}

export function passwordChangedEmailText(name: string, loginUrl: string): string {
  const changedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  return `
Senha alterada com sucesso — ${BRAND.name}

Olá${name ? `, ${name}` : ""}!

Sua senha no ${BRAND.name} foi alterada com sucesso.

Alteração realizada em: ${changedAt}

Acesse o link abaixo para fazer login com sua nova senha:
${loginUrl}

IMPORTANTE: Se você NÃO realizou esta alteração, entre em contato com o suporte imediatamente.

Por segurança, todas as sessões anteriores foram encerradas.

© ${BRAND.year} ${BRAND.name} — ${BRAND.tagline}
Precisa de ajuda? ${BRAND.supportEmail}
`.trim();
}
