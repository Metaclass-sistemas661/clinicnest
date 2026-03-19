/**
 * ClinicNest — Premium PDF Design System
 *
 * Centraliza constantes de tipografia, cores, espaçamentos e helpers
 * visuais usados pelo Motor Universal de PDFs.
 */
import jsPDF from "jspdf";

// ─── Page Geometry (A4 mm) ─────────────────────────────────
export const PAGE = {
  W: 210,
  H: 297,
  MARGIN: 18,
  get CONTENT_W() { return this.W - this.MARGIN * 2; },
  /** Topo útil após header universal */
  HEADER_END: 52,
  /** Limite inferior antes do footer universal */
  FOOTER_START: 270,
} as const;

export const PAGE_LANDSCAPE = {
  W: 297,
  H: 210,
  MARGIN: 15,
  get CONTENT_W() { return this.W - this.MARGIN * 2; },
  HEADER_END: 48,
  FOOTER_START: 185,
} as const;

// ─── Typography ────────────────────────────────────────────
export const FONT = {
  FAMILY: "helvetica" as const,
  /** Heading da clínica */
  CLINIC_NAME: 15,
  /** Subtítulo de contato */
  CLINIC_INFO: 7,
  /** Título de seção (ex: "ORÇAMENTO ODONTOLÓGICO") */
  SECTION_TITLE: 13,
  /** Labels de campos (ex: "PACIENTE") */
  LABEL: 7.5,
  /** Corpo principal de texto */
  BODY: 10,
  /** Texto secundário / rodapé */
  SMALL: 8,
  /** Texto mínimo (hashes, legal) */
  TINY: 6,
  /** Watermark */
  WATERMARK: 52,
} as const;

// ─── Color Palette ─────────────────────────────────────────
export type RGB = [number, number, number];

/** Paleta base Slate sofisticada — pode ser sobrescrita por cores do tenant */
export const COLORS = {
  /** Texto principal */
  TEXT_PRIMARY: [30, 41, 59] as RGB,        // slate-800
  /** Texto secundário */
  TEXT_SECONDARY: [100, 116, 139] as RGB,   // slate-500
  /** Texto terciário / rótulos */
  TEXT_MUTED: [148, 163, 184] as RGB,       // slate-400
  /** Linhas / bordas sutis */
  BORDER: [226, 232, 240] as RGB,           // slate-200
  /** Fundo de destaque leve */
  BG_SUBTLE: [248, 250, 252] as RGB,        // slate-50
  /** Fundo de linhas zebradas pares */
  BG_ZEBRA: [241, 245, 249] as RGB,         // slate-100
  /** Branco */
  WHITE: [255, 255, 255] as RGB,
  /** Preto */
  BLACK: [0, 0, 0] as RGB,
  /** Accent padrão (azul profissional) */
  ACCENT: [37, 99, 235] as RGB,             // blue-600
  /** Verde (sucesso / assinatura) */
  SUCCESS: [22, 163, 74] as RGB,            // green-600
  /** Vermelho (despesa / alerta) */
  DANGER: [220, 38, 38] as RGB,             // red-600
  /** Amarelo (alerta) */
  WARNING: [217, 119, 6] as RGB,            // amber-600
  /** Roxo (marca ClinicNest) */
  BRAND: [124, 58, 237] as RGB,             // violet-600
} as const;

// ─── Helpers ───────────────────────────────────────────────

/** Converte hex (#RRGGBB ou RRGGBB) para tupla RGB */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Aplica opacidade (GState) ao doc — salve/restaure manualmente */
export function applyOpacity(doc: jsPDF, opacity: number) {
  // @ts-expect-error — GState é suportado pelo jsPDF
  const gs = new doc.GState({ opacity });
  doc.setGState(gs);
}

/** Linha horizontal sutil */
export function drawLine(
  doc: jsPDF,
  y: number,
  color: RGB = COLORS.BORDER,
  margin = PAGE.MARGIN,
  width = PAGE.CONTENT_W,
  lineWidth = 0.35,
) {
  doc.setDrawColor(...color);
  doc.setLineWidth(lineWidth);
  doc.line(margin, y, margin + width, y);
  doc.setLineWidth(0.2);
}

/** Retorna true se o conteúdo não cabe na página e adiciona nova página */
export function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  footerStart = PAGE.FOOTER_START,
): number {
  if (y + needed > footerStart) {
    doc.addPage();
    return PAGE.HEADER_END;
  }
  return y;
}

/** Carrega imagem de URL como base64 data-URL */
export async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Renderiza campo label + valor (retorna próximo Y) */
export function renderField(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  margin = PAGE.MARGIN,
  contentW = PAGE.CONTENT_W,
): number {
  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.TEXT_MUTED);
  doc.text(label.toUpperCase(), margin, y);

  doc.setFontSize(FONT.BODY);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  const lines = doc.splitTextToSize(value || "—", contentW);
  doc.text(lines, margin, y + 5);

  return y + 5 + lines.length * 4.5 + 4;
}
