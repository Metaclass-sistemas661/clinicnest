/**
 * ClinicNest — Base Premium PDF Layout (Motor Universal)
 *
 * Wrapper mestre que envolve TODOS os PDFs do sistema.
 * Fornece: Header universal, Watermark, Footer com paginação,
 * design premium padronizado.
 *
 * Uso:
 *   const layout = new BasePremiumPDFLayout(clinicInfo, options);
 *   await layout.init();
 *   const y = layout.contentStartY;
 *   // ... desenhar conteúdo usando layout.doc ...
 *   layout.finalize("meu-documento.pdf");
 */
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PAGE,
  PAGE_LANDSCAPE,
  FONT,
  COLORS,
  hexToRgb,
  applyOpacity,
  drawLine,
  loadImageAsBase64,
  type RGB,
} from "./pdf-design-system";

// ─── Types ─────────────────────────────────────────────────

export interface ClinicInfo {
  name: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
}

export interface PremiumPDFOptions {
  /** Título do documento (ex: "Atestado Médico") */
  title?: string;
  /** Cor de destaque do documento (hex) */
  accentColor?: string;
  /** Orientação da página */
  orientation?: "portrait" | "landscape";
  /** Margens personalizadas (mm) */
  margin?: number;
  /** Mostrar marca d'água com logo/nome */
  watermark?: boolean;
  /** Opacidade da marca d'água (0.05–0.10) */
  watermarkOpacity?: number;
  /** Texto da marca d'água (padrão: nome da clínica) */
  watermarkText?: string;
  /** Mostrar espaço de assinatura no footer */
  showSignatures?: boolean;
  /** Labels das linhas de assinatura */
  signatureLabels?: string[];
  /** Subtítulo abaixo do título do documento */
  subtitle?: string;
}

// ─── Layout Engine ─────────────────────────────────────────

export class BasePremiumPDFLayout {
  public doc: jsPDF;
  public contentStartY: number;
  public accent: RGB;

  private clinic: ClinicInfo;
  private opts: Required<PremiumPDFOptions>;
  private geo: typeof PAGE | typeof PAGE_LANDSCAPE;
  private logoB64: string | null = null;
  private pageCount = 0;

  constructor(clinic: ClinicInfo, options?: PremiumPDFOptions) {
    this.clinic = clinic;
    const o = options ?? {};
    this.opts = {
      title: o.title ?? "",
      accentColor: o.accentColor ?? "#1e40af",
      orientation: o.orientation ?? "portrait",
      margin: o.margin ?? (o.orientation === "landscape" ? PAGE_LANDSCAPE.MARGIN : PAGE.MARGIN),
      watermark: o.watermark !== false,
      watermarkOpacity: o.watermarkOpacity ?? 0.06,
      watermarkText: o.watermarkText ?? clinic.name,
      showSignatures: o.showSignatures ?? false,
      signatureLabels: o.signatureLabels ?? ["Profissional", "Paciente"],
      subtitle: o.subtitle ?? "",
    };
    this.accent = hexToRgb(this.opts.accentColor);
    this.geo = this.opts.orientation === "landscape" ? PAGE_LANDSCAPE : PAGE;

    this.doc = new jsPDF({
      orientation: this.opts.orientation,
      unit: "mm",
      format: "a4",
    });

    this.contentStartY = this.geo.HEADER_END;
  }

  /** Margem lateral em uso */
  get margin(): number { return this.opts.margin; }

  /** Largura útil do conteúdo */
  get contentW(): number { return this.geo.W - this.margin * 2; }

  /** Início do rodapé */
  get footerStart(): number { return this.geo.FOOTER_START; }

  /** Largura total da página */
  get pageW(): number { return this.geo.W; }

  /** Altura total da página */
  get pageH(): number { return this.geo.H; }

  // ── Inicialização (carrega logo) ──────────────────────────

  async init(): Promise<void> {
    if (this.clinic.logoUrl) {
      this.logoB64 = await loadImageAsBase64(this.clinic.logoUrl);
    }
    this.drawPageChrome();
  }

  // ── Adicionar nova página ─────────────────────────────────

  addPage(): number {
    this.doc.addPage();
    this.drawPageChrome();
    return this.geo.HEADER_END;
  }

  /** Garante espaço; se não couber, adiciona página e retorna novo Y */
  ensureSpace(y: number, needed: number): number {
    if (y + needed > this.footerStart) {
      return this.addPage();
    }
    return y;
  }

  // ── Chrome de cada página (header + watermark + footer placeholder) ──

  private drawPageChrome(): void {
    this.pageCount++;
    this.drawHeader();
    if (this.opts.watermark) {
      this.drawWatermark();
    }
  }

  // ── Header Universal ──────────────────────────────────────

  private drawHeader(): void {
    const doc = this.doc;
    const m = this.margin;
    let y = m;

    // ── Logo ──
    let logoEndX = m;
    if (this.logoB64) {
      try {
        doc.addImage(this.logoB64, "PNG", m, y - 2, 16, 16);
        logoEndX = m + 20;
      } catch { /* sem logo */ }
    }

    // ── Nome da clínica ──
    doc.setFontSize(FONT.CLINIC_NAME);
    doc.setFont(FONT.FAMILY, "bold");
    doc.setTextColor(...this.accent);
    doc.text(this.clinic.name, logoEndX, y + 5);

    // ── Dados de contato (endereço · tel · CNPJ · email) ──
    const infoParts: string[] = [];
    if (this.clinic.address) infoParts.push(this.clinic.address);
    if (this.clinic.phone) infoParts.push(`Tel: ${this.clinic.phone}`);
    if (this.clinic.cnpj) infoParts.push(`CNPJ: ${this.clinic.cnpj}`);
    if (this.clinic.email) infoParts.push(this.clinic.email);

    if (infoParts.length > 0) {
      doc.setFontSize(FONT.CLINIC_INFO);
      doc.setFont(FONT.FAMILY, "normal");
      doc.setTextColor(...COLORS.TEXT_SECONDARY);
      const infoLines = doc.splitTextToSize(
        infoParts.join("  ·  "),
        this.contentW - (logoEndX - m),
      );
      doc.text(infoLines, logoEndX, y + 10);
      y += 10 + infoLines.length * 3;
    } else {
      y += 12;
    }

    y = Math.max(y, m + 16);

    // ── Linha horizontal de separação ──
    y += 3;
    doc.setDrawColor(...this.accent);
    doc.setLineWidth(0.6);
    doc.line(m, y, this.pageW - m, y);
    // Linha fina cinza abaixo
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.15);
    doc.line(m, y + 0.8, this.pageW - m, y + 0.8);
    doc.setLineWidth(0.2);

    // ── Faixa de título do documento (se fornecido) ──
    if (this.opts.title) {
      y += 5;
      doc.setFillColor(...this.accent);
      doc.roundedRect(m, y, this.contentW, 9, 1.5, 1.5, "F");
      doc.setFontSize(FONT.SECTION_TITLE - 2);
      doc.setFont(FONT.FAMILY, "bold");
      doc.setTextColor(...COLORS.WHITE);
      doc.text(this.opts.title.toUpperCase(), this.pageW / 2, y + 6.3, { align: "center" });
      y += 12;

      if (this.opts.subtitle) {
        doc.setFontSize(FONT.SMALL);
        doc.setFont(FONT.FAMILY, "normal");
        doc.setTextColor(...COLORS.TEXT_SECONDARY);
        doc.text(this.opts.subtitle, this.pageW / 2, y, { align: "center" });
        y += 5;
      }
    } else {
      y += 4;
    }

    this.contentStartY = y;
  }

  // ── Watermark (Marca D'água) ──────────────────────────────

  private drawWatermark(): void {
    const doc = this.doc;
    const cx = this.pageW / 2;
    const cy = this.pageH / 2;

    doc.saveGraphicsState();
    applyOpacity(doc, this.opts.watermarkOpacity);

    // Se temos logo, usar como watermark
    if (this.logoB64) {
      try {
        const wmSize = Math.min(this.pageW, this.pageH) * 0.35;
        doc.addImage(
          this.logoB64,
          "PNG",
          cx - wmSize / 2,
          cy - wmSize / 2,
          wmSize,
          wmSize,
        );
        doc.restoreGraphicsState();
        return;
      } catch { /* fallback para texto */ }
    }

    // Fallback: texto rotacionado
    doc.setFontSize(FONT.WATERMARK);
    doc.setFont(FONT.FAMILY, "bold");
    doc.setTextColor(...this.accent);
    doc.text(this.opts.watermarkText.toUpperCase(), cx, cy, {
      align: "center",
      angle: -35,
    });
    doc.restoreGraphicsState();
  }

  // ── Footer Universal ──────────────────────────────────────

  private drawFooter(pageNum: number, totalPages: number): void {
    const doc = this.doc;
    const m = this.margin;
    const yLine = this.geo.FOOTER_START;

    // Linha separadora
    drawLine(doc, yLine, this.accent, m, this.contentW, 0.5);

    const footY = yLine + 5;

    // Esquerda: data/hora da geração
    doc.setFontSize(FONT.TINY);
    doc.setFont(FONT.FAMILY, "normal");
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(
      `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`,
      m,
      footY,
    );

    // Centro: paginação
    doc.setFont(FONT.FAMILY, "bold");
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text(
      `Página ${pageNum} de ${totalPages}`,
      this.pageW / 2,
      footY,
      { align: "center" },
    );

    // Direita: nome da clínica
    doc.setFont(FONT.FAMILY, "normal");
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(this.clinic.name, this.pageW - m, footY, { align: "right" });

    // Aviso legal
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(
      "Este documento foi gerado eletronicamente pelo sistema ClinicNest.",
      this.pageW / 2,
      footY + 4,
      { align: "center" },
    );

    // Faixa de cor elegante na base
    doc.setFillColor(...this.accent);
    doc.rect(0, this.pageH - 2.5, this.pageW, 2.5, "F");
  }

  // ── Finalização (aplica footers e salva/retorna blob) ─────

  /** Desenha assinaturas (se configurado) na posição Y fornecida */
  drawSignatures(y: number): number {
    if (!this.opts.showSignatures) return y;

    const doc = this.doc;
    const m = this.margin;
    const labels = this.opts.signatureLabels;
    const slotWidth = this.contentW / labels.length;

    y = this.ensureSpace(y, 35);
    y += 8;

    drawLine(doc, y, COLORS.BORDER, m, this.contentW);
    y += 15;

    labels.forEach((label, i) => {
      const cx = m + slotWidth * i + slotWidth / 2;

      // Linha de assinatura
      doc.setDrawColor(...COLORS.TEXT_SECONDARY);
      doc.setLineWidth(0.3);
      doc.line(cx - 35, y, cx + 35, y);
      doc.setLineWidth(0.2);

      // Label
      doc.setFontSize(FONT.SMALL);
      doc.setFont(FONT.FAMILY, "normal");
      doc.setTextColor(...COLORS.TEXT_SECONDARY);
      doc.text(label, cx, y + 5, { align: "center" });
    });

    return y + 12;
  }

  /**
   * Finaliza o PDF: desenha footers em todas as páginas e salva.
   * @param filename Nome do arquivo para download
   * @returns O doc jsPDF (caso precise de acesso posterior)
   */
  finalize(filename: string): jsPDF {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.drawFooter(i, totalPages);
    }
    this.doc.save(filename);
    return this.doc;
  }

  /**
   * Finaliza e retorna como Blob (sem disparar download).
   */
  finalizeAsBlob(): Blob {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.drawFooter(i, totalPages);
    }
    return this.doc.output("blob");
  }
}
