/**
 * Formatação de moeda centralizada (BRL).
 * Evita duplicação de formatCurrency em múltiplos arquivos.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
