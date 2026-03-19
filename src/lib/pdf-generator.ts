/**
 * ClinicNest — Serviço Centralizado de Geração de PDFs
 *
 * Centraliza a lógica de download, preview em nova aba e
 * geração de Blob para evitar código duplicado nas páginas.
 */
import { BasePremiumPDFLayout, type ClinicInfo, type PremiumPDFOptions } from "./pdf/base-premium-layout";

export type PdfRenderFn = (layout: BasePremiumPDFLayout) => Promise<number | void>;

interface GenerateOptions extends PremiumPDFOptions {
  /** Nome do arquivo para download (ex: "atestado_2026-03-19.pdf") */
  filename: string;
  /** Dados da clínica (header universal) */
  clinic: ClinicInfo;
  /** Callback que recebe o layout e desenha o conteúdo */
  render: PdfRenderFn;
}

/**
 * Gera um PDF premium, dispara download e retorna o Blob.
 */
export async function generatePremiumPdf(options: GenerateOptions): Promise<Blob> {
  const { filename, clinic, render, ...pdfOpts } = options;

  const layout = new BasePremiumPDFLayout(clinic, pdfOpts);
  await layout.init();
  await render(layout);
  layout.finalize(filename);
  return layout.finalizeAsBlob();
}

/**
 * Gera o PDF e abre em nova aba (preview) sem disparar download.
 */
export async function previewPremiumPdf(options: Omit<GenerateOptions, "filename"> & { filename?: string }): Promise<void> {
  const { clinic, render, ...pdfOpts } = options;

  const layout = new BasePremiumPDFLayout(clinic, pdfOpts);
  await layout.init();
  await render(layout);
  const blob = layout.finalizeAsBlob();

  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  // Revoga o object URL quando a aba for fechada (ou após 60s como fallback)
  if (w) {
    const cleanup = () => URL.revokeObjectURL(url);
    w.addEventListener("beforeunload", cleanup);
    setTimeout(cleanup, 60_000);
  }
}

/**
 * Gera o PDF e retorna apenas o Blob (para upload, email, etc.)
 */
export async function generatePremiumPdfBlob(options: Omit<GenerateOptions, "filename">): Promise<Blob> {
  const { clinic, render, ...pdfOpts } = options;

  const layout = new BasePremiumPDFLayout(clinic, pdfOpts);
  await layout.init();
  await render(layout);
  return layout.finalizeAsBlob();
}
