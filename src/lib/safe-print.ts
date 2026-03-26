import { sanitizeHtml } from "./sanitize-html";

/**
 * Abre uma janela de impressão com HTML sanitizado.
 * Previne XSS ao sanitizar o conteúdo antes de renderizar.
 */
export function safePrintHtml(html: string): void {
  const sanitized = sanitizeHtml(html);
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(sanitized);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
}
