// Pure TypeScript module — no React, no external dependencies.
// Generates complete email-client-compatible HTML from BuilderState.

export type TemplateId = "promocao" | "newsletter" | "novidade";

export interface ColorPreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  gradient: boolean;
}

export interface BuilderState {
  campaignName: string;
  subject: string;
  templateId: TemplateId;
  salonName: string;
  primaryColor: string;
  secondaryColor: string;
  useGradient: boolean;
  bannerUrl: string;
  bannerHeight: number; // px, 60–400
  preheader: string;
  headline: string;
  subheadline: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  footerText: string;
  startDate: string; // "YYYY-MM-DD" or ""
  endDate: string;   // "YYYY-MM-DD" or ""
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "luxo",     name: "Luxo",     primary: "#5b21b6", secondary: "#7c3aed", gradient: true  },
  { id: "rosa",     name: "Rosa",     primary: "#be185d", secondary: "#ec4899", gradient: true  },
  { id: "elegante", name: "Elegante", primary: "#1e293b", secondary: "#334155", gradient: false },
  { id: "natural",  name: "Natural",  primary: "#0f766e", secondary: "#14b8a6", gradient: true  },
  { id: "dourado",  name: "Dourado",  primary: "#b45309", secondary: "#d97706", gradient: true  },
];

export function makeDefaultState(templateId: TemplateId, salonName: string): BuilderState {
  const year = new Date().getFullYear();
  const footer = `© ${year} ${salonName}. Para cancelar o recebimento, responda este email com "Descadastrar".`;

  const base: BuilderState = {
    campaignName: "",
    subject: "",
    templateId,
    salonName,
    primaryColor: "#7c3aed",
    secondaryColor: "#db2777",
    useGradient: true,
    bannerUrl: "",
    bannerHeight: 200,
    preheader: "",
    headline: "",
    subheadline: "",
    bodyText: "",
    ctaText: "Agendar Agora",
    ctaUrl: "",
    ctaColor: "#7c3aed",
    footerText: footer,
    startDate: "",
    endDate: "",
  };

  if (templateId === "promocao") {
    return {
      ...base,
      primaryColor: "#7c3aed",
      secondaryColor: "#db2777",
      useGradient: true,
      ctaColor: "#db2777",
      headline: "Promoção Especial Para Você! 🎉",
      subheadline: "Aproveite nossos descontos exclusivos por tempo limitado",
      bodyText: "Não perca essa oportunidade única de cuidar de você com os melhores tratamentos da clínica.\n\nAgende agora e garanta sua vaga com desconto especial para clientes fiéis!",
      ctaText: "Aproveitar Desconto",
    };
  }

  if (templateId === "newsletter") {
    return {
      ...base,
      primaryColor: "#1e293b",
      secondaryColor: "#334155",
      useGradient: false,
      ctaColor: "#1e293b",
      headline: "Novidades da Clínica",
      subheadline: "Fique por dentro das últimas novidades e tendências",
      bodyText: "Temos muitas novidades para compartilhar com você este mês.\n\nNovos serviços, produtos e muito mais esperando por você.",
      ctaText: "Saiba Mais",
    };
  }

  // novidade
  return {
    ...base,
    primaryColor: "#b45309",
    secondaryColor: "#d97706",
    useGradient: true,
    ctaColor: "#b45309",
    headline: "Novidade na Clínica!",
    subheadline: "Conheça nosso mais novo procedimento exclusivo",
    bodyText: "Estamos muito animados em apresentar algo especial criado pensando em você.\n\nExperimente e sinta a diferença dos nossos tratamentos premium.",
    ctaText: "Conhecer Agora",
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHeaderBackground(state: BuilderState): string {
  if (state.useGradient) {
    return `linear-gradient(135deg, ${state.primaryColor} 0%, ${state.secondaryColor} 100%)`;
  }
  return state.primaryColor;
}

function buildTemplateHeaderExtra(state: BuilderState): string {
  if (state.templateId === "promocao") {
    return `<p style="margin:8px 0 0 0;font-size:14px;color:rgba(255,255,255,0.9);font-weight:500;">Oferta especial para você ✨</p>`;
  }
  if (state.templateId === "newsletter") {
    const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const now = new Date();
    const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;
    return `<p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,0.7);font-style:italic;">${dateStr}</p>`;
  }
  // novidade
  return `<span style="display:inline-block;background:rgba(255,255,255,0.2);color:#ffffff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;margin-top:10px;letter-spacing:1.5px;text-transform:uppercase;">NOVIDADE</span>`;
}

function buildPreheaderHtml(preheader: string): string {
  if (!preheader.trim()) return "";
  return `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${escHtml(preheader)}</div>`;
}

function buildBannerRow(state: BuilderState): string {
  if (!state.bannerUrl.trim()) return "";
  const h = state.bannerHeight ?? 200;
  return `
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="${escHtml(state.bannerUrl)}" alt="${escHtml(state.salonName)}"
                width="640" height="${h}"
                style="width:100%;max-width:640px;height:${h}px;object-fit:cover;display:block;border:0;" />
            </td>
          </tr>`;
}

function buildBodyParagraphs(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;font-size:15px;color:#4b5563;line-height:1.75;">${escHtml(para.trim()).replaceAll("\n", "<br />")}</p>`
    )
    .join("\n              ");
}

function buildCtaRow(state: BuilderState): string {
  if (!state.ctaText.trim() || !state.ctaUrl.trim()) return "";
  return `
          <tr>
            <td style="padding:0 32px 32px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:50px;background:${state.ctaColor};">
                    <a href="${escHtml(state.ctaUrl)}"
                      style="display:inline-block;padding:15px 40px;font-size:16px;font-weight:700;
                      color:#ffffff;text-decoration:none;border-radius:50px;letter-spacing:0.3px;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                      mso-padding-alt:0;text-underline-color:${state.ctaColor};"
                      target="_blank">
                      ${escHtml(state.ctaText)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function formatDateBR(iso: string): string {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch { return iso; }
}

function buildDateBadge(state: BuilderState): string {
  const { startDate, endDate } = state;
  if (!startDate && !endDate) return "";
  if (startDate && endDate) {
    return `<p style="margin:0 0 16px 0;font-size:13px;color:#6b7280;text-align:center;">
      📅 Válida de <strong>${formatDateBR(startDate)}</strong> até <strong>${formatDateBR(endDate)}</strong>
    </p>`;
  }
  if (startDate) return `<p style="margin:0 0 16px 0;font-size:13px;color:#6b7280;text-align:center;">📅 A partir de <strong>${formatDateBR(startDate)}</strong></p>`;
  return `<p style="margin:0 0 16px 0;font-size:13px;color:#6b7280;text-align:center;">📅 Válida até <strong>${formatDateBR(endDate)}</strong></p>`;
}

function buildFooterRow(state: BuilderState): string {
  return `
          <tr>
            <td style="background:#f8f8fc;padding:20px 32px;border-top:1px solid #e8e8f0;border-radius:0 0 16px 16px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                ${escHtml(state.footerText)}
              </p>
            </td>
          </tr>`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateEmailHtml(state: BuilderState): string {
  const headerBg = buildHeaderBackground(state);
  const headerExtra = buildTemplateHeaderExtra(state);
  const preheaderHtml = buildPreheaderHtml(state.preheader);
  const bannerRow = buildBannerRow(state);
  const bodyParagraphs = buildBodyParagraphs(state.bodyText);
  const ctaRow = buildCtaRow(state);
  const footerRow = buildFooterRow(state);
  const dateBadge = buildDateBadge(state);

  const subheadlineHtml = state.subheadline.trim()
    ? `<p style="margin:0 0 20px 0;font-size:16px;color:#6b7280;line-height:1.5;">${escHtml(state.subheadline)}</p>`
    : "";

  const dividerColor = `${state.primaryColor}30`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escHtml(state.subject || state.campaignName)}</title>
  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 640px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 16px !important; }
      .header-cell { padding: 20px 16px !important; }
      .cta-link { display: block !important; text-align: center !important; padding: 14px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-font-smoothing:antialiased;">
  ${preheaderHtml}

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center" style="padding:0;">

        <table class="email-container" role="presentation" cellpadding="0" cellspacing="0" border="0"
          width="640" style="max-width:640px;width:100%;background-color:#ffffff;
          border-radius:16px;overflow:hidden;
          box-shadow:0 4px 32px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06);">

          <!-- HEADER -->
          <tr>
            <td class="header-cell" style="background:${headerBg};padding:28px 32px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;
                letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                ${escHtml(state.salonName)}
              </p>
              ${headerExtra}
            </td>
          </tr>

          <!-- BANNER -->
          ${bannerRow}

          <!-- CONTENT -->
          <tr>
            <td class="content-cell" style="padding:32px;">
              <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:800;color:#111827;
                line-height:1.2;letter-spacing:-0.5px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                ${escHtml(state.headline)}
              </h1>
              ${subheadlineHtml}
              <div style="height:1px;background:${dividerColor};margin:0 0 20px 0;"></div>
              ${dateBadge}
              ${bodyParagraphs}
            </td>
          </tr>

          <!-- CTA -->
          ${ctaRow}

          <!-- FOOTER -->
          ${footerRow}

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}
