/**
 * ClinicNest — Componentes Injetáveis Premium para PDF
 *
 * Sub-componentes padronizados que os desenvolvedores usam
 * dentro do BasePremiumPDFLayout:
 *
 *  - PatientInfoBox   → caixa elegante com dados do paciente
 *  - PremiumTable      → tabela zebrada com cabeçalho accent
 *  - SignatureBlock    → bloco de assinatura com QR/certificado
 *  - SoapSection       → seção SOAP colorida
 *  - SummaryCards      → cards de resumo (receitas/despesas/saldo)
 *  - DigitalSealBlock  → selo de assinatura digital + QR Code
 */
import autoTable, { type UserOptions } from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FONT,
  COLORS,
  drawLine,
  type RGB,
} from "./pdf-design-system";
import type { BasePremiumPDFLayout } from "./base-premium-layout";

// ─── PatientInfoBox ────────────────────────────────────────

export interface PatientInfo {
  name: string;
  cpf?: string | null;
  birthDate?: string | null;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Renderiza um bloco cinza claro elegante com dados do paciente.
 * Retorna o próximo Y.
 */
export function renderPatientInfoBox(
  layout: BasePremiumPDFLayout,
  patient: PatientInfo,
  y: number,
): number {
  const doc = layout.doc;
  const m = layout.margin;
  const w = layout.contentW;

  const details: string[] = [];
  if (patient.cpf) details.push(`CPF: ${patient.cpf}`);
  if (patient.birthDate) {
    try {
      details.push(`Nasc.: ${format(new Date(patient.birthDate), "dd/MM/yyyy")}`);
    } catch { /* ignora data inválida */ }
  }
  if (patient.age != null) details.push(`${patient.age} anos`);
  if (patient.phone) details.push(`Tel: ${patient.phone}`);

  const boxH = details.length > 0 ? 20 : 14;

  y = layout.ensureSpace(y, boxH + 4);

  // Barra lateral accent
  doc.setFillColor(...layout.accent);
  doc.rect(m, y, 1.5, boxH, "F");

  // Fundo cinza claro
  doc.setFillColor(...COLORS.BG_SUBTLE);
  doc.rect(m + 1.5, y, w - 1.5, boxH, "F");

  // Label "PACIENTE"
  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...layout.accent);
  doc.text("PACIENTE", m + 5, y + 5.5);

  // Nome
  doc.setFontSize(FONT.BODY);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text(patient.name, m + 28, y + 5.5);

  // Detalhes
  if (details.length > 0) {
    doc.setFontSize(FONT.SMALL);
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text(details.join("     "), m + 5, y + 12.5);
  }

  if (patient.email) {
    doc.setFontSize(FONT.TINY);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(patient.email, m + 5, y + 17);
  }

  return y + boxH + 4;
}

// ─── PremiumTable ──────────────────────────────────────────

export interface PremiumTableOptions {
  /** Cabeçalho das colunas */
  head: string[];
  /** Dados (linhas) */
  body: (string | number)[][];
  /** Larguras de colunas (opcional, em % ou mm) */
  columnStyles?: Record<number, Partial<{ cellWidth: number | "auto" | "wrap"; halign: "left" | "center" | "right" }>>;
  /** Cor de fundo do cabeçalho (padrão: accent do layout) */
  headColor?: RGB;
  /** Inicia em Y (obrigatório) */
  startY: number;
  /** Margem lateral */
  margin?: number;
  /** Override total de opções autoTable */
  overrides?: Partial<UserOptions>;
}

/**
 * Renderiza uma tabela premium com linhas zebradas e cabeçalho accent.
 * Retorna o Y final após a tabela.
 */
export function renderPremiumTable(
  layout: BasePremiumPDFLayout,
  options: PremiumTableOptions,
): number {
  const m = options.margin ?? layout.margin;
  const headColor = options.headColor ?? layout.accent;

  autoTable(layout.doc, {
    startY: options.startY,
    head: [options.head],
    body: options.body.map((row) => row.map(String)),
    theme: "striped",
    headStyles: {
      fillColor: headColor,
      textColor: COLORS.WHITE,
      fontStyle: "bold",
      fontSize: FONT.SMALL,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: FONT.SMALL - 0.5,
      textColor: COLORS.TEXT_PRIMARY,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: COLORS.BG_ZEBRA,
    },
    styles: {
      font: FONT.FAMILY,
      lineWidth: 0.1,
      lineColor: COLORS.BORDER,
      overflow: "linebreak",
    },
    columnStyles: options.columnStyles as any,
    margin: { left: m, right: m },
    tableWidth: layout.contentW,
    ...options.overrides,
  });

  return ((layout.doc as any).lastAutoTable?.finalY ?? options.startY) + 6;
}

// ─── SignatureBlock ─────────────────────────────────────────

export interface SignatureBlockOptions {
  professionalName: string;
  councilNumber?: string | null;
  councilState?: string | null;
  specialty?: string | null;
}

/**
 * Renderiza bloco de assinatura profissional centralizado.
 * Retorna o próximo Y.
 */
export function renderSignatureBlock(
  layout: BasePremiumPDFLayout,
  opts: SignatureBlockOptions,
  y: number,
): number {
  const doc = layout.doc;
  const cx = layout.pageW / 2;

  y = layout.ensureSpace(y, 40);
  y += 6;

  drawLine(doc, y, COLORS.BORDER, layout.margin, layout.contentW);
  y += 18;

  // Linha de assinatura
  doc.setDrawColor(...layout.accent);
  doc.setLineWidth(0.4);
  doc.line(cx - 40, y, cx + 40, y);
  doc.setLineWidth(0.2);

  // Nome
  y += 5;
  doc.setFontSize(FONT.BODY);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text(opts.professionalName, cx, y, { align: "center" });

  // CRM/CRO
  if (opts.councilNumber) {
    y += 5;
    doc.setFontSize(FONT.SMALL + 0.5);
    doc.setFont(FONT.FAMILY, "normal");
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    const crmText = opts.councilState
      ? `${opts.councilNumber}/${opts.councilState}`
      : opts.councilNumber;
    doc.text(crmText, cx, y, { align: "center" });
  }

  // Especialidade
  if (opts.specialty) {
    y += 4;
    doc.setFontSize(FONT.SMALL);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(opts.specialty, cx, y, { align: "center" });
  }

  return y + 8;
}

// ─── DigitalSealBlock (assinatura digital + QR) ────────────

export interface DigitalSealOptions {
  hash: string;
  signedAt?: string | null;
  signerName?: string | null;
  signerCrm?: string | null;
  signerUf?: string | null;
  qrDataUrl?: string | null;
  verificationUrl?: string;
}

/**
 * Renderiza selo de assinatura digital com QR Code.
 * Retorna o próximo Y.
 */
export function renderDigitalSeal(
  layout: BasePremiumPDFLayout,
  opts: DigitalSealOptions,
  y: number,
): number {
  const doc = layout.doc;
  const m = layout.margin;
  const w = layout.contentW;
  const isSigned = !!opts.signedAt;

  y = layout.ensureSpace(y, 32);

  // Fundo
  doc.setFillColor(...(isSigned ? [240, 253, 244] as RGB : COLORS.BG_SUBTLE));
  doc.roundedRect(m, y, w, 28, 2, 2, "F");

  // Título
  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "bold");
  if (isSigned) {
    doc.setTextColor(...COLORS.SUCCESS);
    doc.text("✓ DOCUMENTO ASSINADO DIGITALMENTE", m + 4, y + 5);
  } else {
    doc.setTextColor(...layout.accent);
    doc.text("DOCUMENTO IDENTIFICADO DIGITALMENTE", m + 4, y + 5);
  }

  // Detalhes de assinatura
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_SECONDARY);

  let detailY = y + 10;
  if (opts.signedAt) {
    try {
      doc.setFontSize(FONT.LABEL);
      doc.text(
        `Assinado em: ${format(new Date(opts.signedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`,
        m + 4, detailY,
      );
      detailY += 4;
    } catch { /* data inválida */ }
  }

  if (opts.signerName) {
    doc.setFontSize(FONT.LABEL);
    const crmPart = opts.signerCrm
      ? (opts.signerUf ? ` — ${opts.signerCrm}/${opts.signerUf}` : ` — ${opts.signerCrm}`)
      : "";
    doc.text(`Profissional: ${opts.signerName}${crmPart}`, m + 4, detailY);
    detailY += 4;
  }

  // Hash
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.TEXT_MUTED);
  doc.text(`SHA-256: ${opts.hash.substring(0, 64)}`, m + 4, detailY);
  detailY += 4;

  // Verification URL
  if (opts.verificationUrl) {
    doc.setFontSize(FONT.TINY);
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text("Verifique:", m + 4, detailY);
    doc.setTextColor(...layout.accent);
    doc.text(opts.verificationUrl, m + 19, detailY);
  }

  // QR Code
  if (opts.qrDataUrl) {
    try {
      doc.addImage(opts.qrDataUrl, "PNG", m + w - 26, y + 2, 22, 22);
    } catch { /* sem QR */ }
  }

  return y + 32;
}

// ─── SoapSection ───────────────────────────────────────────

const SOAP_COLORS: Record<string, { color: RGB; code: string; label: string }> = {
  S: { color: [59, 130, 246], code: "S", label: "SUBJETIVO" },
  O: { color: [16, 185, 129], code: "O", label: "OBJETIVO" },
  A: { color: [245, 158, 11], code: "A", label: "AVALIAÇÃO" },
  P: { color: [139, 92, 246], code: "P", label: "PLANO" },
};

/**
 * Renderiza seção SOAP com badge colorido.
 * Retorna próximo Y.
 */
export function renderSoapSection(
  layout: BasePremiumPDFLayout,
  code: "S" | "O" | "A" | "P",
  content: string,
  y: number,
): number {
  const doc = layout.doc;
  const m = layout.margin;
  const { color, code: c, label } = SOAP_COLORS[code];

  y = layout.ensureSpace(y, 20);

  // Badge colorido
  doc.setFillColor(...color);
  doc.roundedRect(m, y - 3.5, 8, 8, 1.5, 1.5, "F");
  doc.setFontSize(FONT.SMALL);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.WHITE);
  doc.text(c, m + 2.8, y + 1.5);

  // Label
  doc.setTextColor(...color);
  doc.setFontSize(FONT.SMALL + 1);
  doc.text(label, m + 11, y + 1);
  y += 7;

  // Conteúdo
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setFontSize(FONT.BODY);
  const lines = doc.splitTextToSize(content, layout.contentW);
  for (const line of lines) {
    y = layout.ensureSpace(y, 6);
    doc.text(line, m, y);
    y += 4.8;
  }

  return y + 4;
}

// ─── Summary Cards (Receitas / Despesas / Saldo) ───────────

export interface SummaryCard {
  label: string;
  value: string;
  color: RGB;
  borderColor?: RGB;
}

/**
 * Renderiza cards de resumo lado a lado.
 * Retorna próximo Y.
 */
export function renderSummaryCards(
  layout: BasePremiumPDFLayout,
  cards: SummaryCard[],
  y: number,
): number {
  const doc = layout.doc;
  const m = layout.margin;
  const gap = 8;
  const cardW = (layout.contentW - gap * (cards.length - 1)) / cards.length;
  const cardH = 32;

  y = layout.ensureSpace(y, cardH + 6);

  cards.forEach((card, i) => {
    const x = m + i * (cardW + gap);

    // Fundo
    doc.setFillColor(...COLORS.BG_SUBTLE);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");

    // Borda de cor
    doc.setDrawColor(...(card.borderColor ?? card.color));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "S");
    doc.setLineWidth(0.2);

    // Label
    doc.setFontSize(FONT.SMALL);
    doc.setFont(FONT.FAMILY, "normal");
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text(card.label, x + 8, y + 11);

    // Valor
    doc.setFontSize(14);
    doc.setFont(FONT.FAMILY, "bold");
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 8, y + 24);
  });

  return y + cardH + 8;
}

// ─── VitalsGrid ────────────────────────────────────────────

/**
 * Renderiza grid compacto de sinais vitais.
 * Retorna próximo Y.
 */
export function renderVitalsGrid(
  layout: BasePremiumPDFLayout,
  vitals: string[],
  y: number,
): number {
  if (vitals.length === 0) return y;

  const doc = layout.doc;
  const m = layout.margin;

  y = layout.ensureSpace(y, 16);

  doc.setFillColor(...COLORS.BG_ZEBRA);
  doc.roundedRect(m, y - 3, layout.contentW, 13, 2, 2, "F");

  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...layout.accent);
  doc.text("SINAIS VITAIS", m + 4, y + 3);

  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.setFontSize(FONT.SMALL);
  const vitalsText = doc.splitTextToSize(vitals.join("  ·  "), layout.contentW - 38);
  doc.text(vitalsText, m + 34, y + 3);

  return y + 14;
}
