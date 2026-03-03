/**
 * ─── Clinic Email Sender ─────────────────────────────────────────────────────
 *
 * Módulo compartilhado para envio de emails profissionais da CLÍNICA para o paciente.
 *
 * Remetente: "Nome da Clínica" <notificacoes@metaclass.com.br>
 * Reply-To:  email da clínica (tenants.email)
 *
 * Emails do SISTEMA (auth, suporte) continuam em send-custom-auth-email
 * com branding Metaclass/ClinicNest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createLogger } from "./logging.ts";

const log = createLogger("CLINIC-EMAIL");

// ─── Paleta Teal Médica ────────────────────────────────────────────────────
const TEAL_PRIMARY   = "#0d9488";  // teal-600
const TEAL_DARK      = "#0f766e";  // teal-700
const TEAL_LIGHT     = "#ccfbf1";  // teal-100
const TEAL_BG        = "#f0fdfa";  // teal-50
const TEAL_GRADIENT  = "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)"; // teal→cyan
const TEAL_SHADOW    = "rgba(13, 148, 136, 0.3)";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ClinicInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface ClinicEmailOptions {
  to: string;
  subject: string;
  clinic: ClinicInfo;
  /** Headline no header (ex: "Nova Mensagem", "Lembrete de Pagamento") */
  headline: string;
  /** Ícone antes da headline (emoji) */
  icon?: string;
  /** Conteúdo HTML do body do email */
  bodyHtml: string;
  /** Versão texto plano */
  bodyText: string;
  /** Cor de destaque para o header (default: TEAL_GRADIENT) */
  headerColor?: string;
  /** Texto do botão CTA (opcional) */
  ctaLabel?: string;
  /** URL do botão CTA (opcional) */
  ctaUrl?: string;
  /** Cor do botão CTA (default: teal) */
  ctaColor?: string;
}

// ─── HTML Helpers ───────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Header da clínica — gradient teal com nome da clínica */
function clinicHeader(clinicName: string, headline: string, icon: string, headerColor: string): string {
  return `
  <tr>
    <td style="background: ${headerColor}; padding: 0;">
      <!-- Top accent bar -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 32px 30px 8px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align: left;">
                  <span style="color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                    ${escHtml(clinicName)}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 30px 32px 30px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.3px;">
              ${icon ? icon + " " : ""}${escHtml(headline)}
            </h1>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Botão CTA */
function ctaButton(label: string, url: string, color: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 28px 0 8px 0;">
        <a href="${url}"
           style="display: inline-block;
                  background: ${color};
                  color: #ffffff;
                  text-decoration: none;
                  padding: 14px 40px;
                  border-radius: 8px;
                  font-size: 15px;
                  font-weight: 600;
                  letter-spacing: 0.2px;
                  box-shadow: 0 4px 14px ${TEAL_SHADOW};
                  mso-padding-alt: 14px 40px;">
          ${escHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

/** Footer com nome da clínica + "Enviado via ClinicNest" */
function clinicFooter(clinicName: string, clinicPhone?: string | null): string {
  const year = new Date().getFullYear();
  return `
  <tr>
    <td style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${clinicPhone ? `
        <tr>
          <td style="text-align: center; padding-bottom: 12px;">
            <span style="color: #64748b; font-size: 13px;">
              Dúvidas? Entre em contato: <strong style="color: #334155;">${escHtml(clinicPhone)}</strong>
            </span>
          </td>
        </tr>` : ""}
        <tr>
          <td style="text-align: center;">
            <span style="color: #94a3b8; font-size: 12px;">
              &copy; ${year} ${escHtml(clinicName)} &middot; Enviado via
              <span style="color: ${TEAL_PRIMARY}; font-weight: 600;">ClinicNest</span>
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── Template Completo ──────────────────────────────────────────────────────

export function buildClinicEmailHtml(opts: ClinicEmailOptions): string {
  const headerColor = opts.headerColor ?? TEAL_GRADIENT;
  const ctaColor = opts.ctaColor ?? TEAL_PRIMARY;

  const ctaHtml = opts.ctaLabel && opts.ctaUrl
    ? ctaButton(opts.ctaLabel, opts.ctaUrl, ctaColor)
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escHtml(opts.subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
             background-color: ${TEAL_BG};">
  <!-- Preheader (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${escHtml(opts.subject)} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color: ${TEAL_BG}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width: 600px; width: 100%;
                      background-color: #ffffff;
                      border-radius: 16px;
                      overflow: hidden;
                      box-shadow: 0 4px 24px rgba(15, 118, 110, 0.08), 0 1px 4px rgba(0,0,0,0.04);">

          ${clinicHeader(opts.clinic.name, opts.headline, opts.icon ?? "", headerColor)}

          <!-- Body -->
          <tr>
            <td style="padding: 36px 30px 16px 30px;">
              ${opts.bodyHtml}
              ${ctaHtml}
            </td>
          </tr>

          ${clinicFooter(opts.clinic.name, opts.clinic.phone)}

        </table>
        <!-- /Container -->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Info Box (card de destaque dentro do body) ─────────────────────────────

export function infoBox(
  items: Array<{ label: string; value: string }>,
  accentColor = TEAL_PRIMARY,
): string {
  const rows = items
    .map(
      (item, i) => `
    <tr>
      <td style="padding: 10px 0;${i > 0 ? " border-top: 1px solid #e2e8f0;" : ""}">
        <span style="color: #64748b; font-size: 13px;">${escHtml(item.label)}</span>
        <span style="color: #1e293b; font-size: 14px; font-weight: 600; float: right;">${item.value}</span>
      </td>
    </tr>`,
    )
    .join("");

  return `
  <div style="background-color: ${TEAL_BG}; border-radius: 10px; padding: 20px 24px; margin: 20px 0; border-left: 4px solid ${accentColor};">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${rows}
    </table>
  </div>`;
}

// ─── Greeting ───────────────────────────────────────────────────────────────

export function greeting(name: string): string {
  return `<p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
    Olá, <strong>${escHtml(name)}</strong>!
  </p>`;
}

export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.7;">${text}</p>`;
}

// ─── Envio via Resend com Reply-To ──────────────────────────────────────────

export interface SendClinicEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Envia email em nome da clínica.
 *
 * From: "Nome da Clínica" <notificacoes@metaclass.com.br>
 * Reply-To: email da clínica (se disponível)
 */
export async function sendClinicEmail(
  opts: ClinicEmailOptions,
): Promise<SendClinicEmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("RESEND_API_KEY não configurada");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  const senderDomain = Deno.env.get("CLINIC_EMAIL_DOMAIN") || "metaclass.com.br";
  const senderAddress = `notificacoes@${senderDomain}`;
  const fromField = `${opts.clinic.name} <${senderAddress}>`;

  const html = buildClinicEmailHtml(opts);

  const payload: Record<string, unknown> = {
    from: fromField,
    to: opts.to,
    subject: opts.subject,
    html,
    text: opts.bodyText,
  };

  // Reply-To: email da clínica para que respostas cheguem na clínica
  if (opts.clinic.email) {
    payload.reply_to = opts.clinic.email;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      log("Erro Resend", { status: response.status, error: errText.slice(0, 300) });
      return { ok: false, error: `Resend ${response.status}: ${errText.slice(0, 200)}` };
    }

    const result = await response.json();
    log("Email enviado", { to: opts.to, id: result.id, clinic: opts.clinic.name });
    return { ok: true, id: result.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("Exceção ao enviar", { error: msg });
    return { ok: false, error: msg };
  }
}

// ─── Constantes de Cor (re-exportadas para uso em templates) ─────────────────

export const COLORS = {
  TEAL_PRIMARY,
  TEAL_DARK,
  TEAL_LIGHT,
  TEAL_BG,
  TEAL_GRADIENT,
  TEAL_SHADOW,
  DANGER:  "#ef4444",
  WARNING: "#f59e0b",
  SUCCESS: "#10b981",
  INFO:    "#0ea5e9",
  PURPLE:  "#7c3aed",
} as const;
