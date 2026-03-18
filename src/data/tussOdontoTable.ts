/**
 * F13: Tabela TUSS odontológica padrão (offline/fallback)
 * 
 * Mapeamento condição → código TUSS + preço referência.
 * Usado como fallback quando a tabela personalizada do tenant não está disponível.
 * 
 * Preços são valores de referência e NÃO devem ser usados como valores finais.
 */

export interface TussEntry {
  code: string;
  description: string;
  defaultPrice: number;
  category: string;
}

/** Tabela TUSS odontológica padrão */
export const TUSS_ODONTO_DEFAULT: TussEntry[] = [
  { code: "81000065", description: "Consulta odontológica inicial", defaultPrice: 150, category: "Consulta" },
  { code: "81000073", description: "Consulta odontológica de retorno", defaultPrice: 100, category: "Consulta" },
  { code: "81000170", description: "Urgência odontológica", defaultPrice: 200, category: "Urgência" },
  { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180, category: "Restauração" },
  { code: "82000042", description: "Restauração direta em resina composta - 2 faces", defaultPrice: 250, category: "Restauração" },
  { code: "82000050", description: "Restauração direta em resina composta - 3 faces", defaultPrice: 320, category: "Restauração" },
  { code: "82000069", description: "Restauração direta em amálgama - 1 face", defaultPrice: 120, category: "Restauração" },
  { code: "83000030", description: "Tratamento endodôntico unirradicular", defaultPrice: 600, category: "Endodontia" },
  { code: "83000048", description: "Tratamento endodôntico birradicular", defaultPrice: 800, category: "Endodontia" },
  { code: "83000056", description: "Tratamento endodôntico multirradicular", defaultPrice: 1000, category: "Endodontia" },
  { code: "84000036", description: "Raspagem subgengival por hemiarcada", defaultPrice: 250, category: "Periodontia" },
  { code: "84000044", description: "Raspagem supragengival", defaultPrice: 200, category: "Periodontia" },
  { code: "85000032", description: "Exodontia simples", defaultPrice: 200, category: "Cirurgia" },
  { code: "85000040", description: "Exodontia de dente incluso", defaultPrice: 500, category: "Cirurgia" },
  { code: "85000059", description: "Exodontia de dente semi-incluso", defaultPrice: 400, category: "Cirurgia" },
  { code: "86000039", description: "Coroa metalocerâmica", defaultPrice: 1200, category: "Prótese" },
  { code: "86000047", description: "Coroa em cerâmica pura", defaultPrice: 1800, category: "Prótese" },
  { code: "86000055", description: "Prótese parcial removível", defaultPrice: 1500, category: "Prótese" },
  { code: "86000063", description: "Prótese total", defaultPrice: 2000, category: "Prótese" },
  { code: "87000035", description: "Aplicação de selante por dente", defaultPrice: 80, category: "Prevenção" },
  { code: "87000043", description: "Aplicação tópica de flúor", defaultPrice: 60, category: "Prevenção" },
  { code: "87000051", description: "Profilaxia", defaultPrice: 150, category: "Prevenção" },
  { code: "88000031", description: "Radiografia periapical", defaultPrice: 40, category: "Radiologia" },
  { code: "88000049", description: "Radiografia panorâmica", defaultPrice: 120, category: "Radiologia" },
  { code: "88000057", description: "Radiografia interproximal (bite-wing)", defaultPrice: 40, category: "Radiologia" },
  { code: "89000038", description: "Clareamento dental de consultório", defaultPrice: 800, category: "Estética" },
  { code: "89000046", description: "Faceta direta em resina", defaultPrice: 400, category: "Estética" },
  { code: "89000054", description: "Faceta indireta em porcelana", defaultPrice: 1500, category: "Estética" },
];

/**
 * Mapeamento condição do odontograma → código TUSS sugerido
 * Usado ao gerar plano de tratamento automaticamente
 */
export const CONDITION_TUSS_MAP: Record<string, { code: string; description: string; defaultPrice: number }> = {
  caries:       { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  fracture:     { code: "82000050", description: "Restauração direta em resina composta - 3 faces", defaultPrice: 320 },
  extraction:   { code: "85000032", description: "Exodontia simples", defaultPrice: 200 },
  abscess:      { code: "83000030", description: "Tratamento endodôntico unirradicular", defaultPrice: 600 },
  periapical:   { code: "83000030", description: "Tratamento endodôntico unirradicular", defaultPrice: 600 },
  root_remnant: { code: "85000032", description: "Exodontia simples", defaultPrice: 200 },
  mobility:     { code: "84000036", description: "Raspagem subgengival por hemiarcada", defaultPrice: 250 },
  recession:    { code: "84000036", description: "Raspagem subgengival por hemiarcada", defaultPrice: 250 },
  erosion:      { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  abrasion:     { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  temporary:    { code: "82000042", description: "Restauração direta em resina composta - 2 faces", defaultPrice: 250 },
  fistula:      { code: "83000030", description: "Tratamento endodôntico unirradicular", defaultPrice: 600 },
  resorption:   { code: "83000030", description: "Tratamento endodôntico unirradicular", defaultPrice: 600 },
};

/**
 * Busca preço TUSS baseado na condição do dente.
 * Se o tenant tiver preços customizados, usa esses; caso contrário usa o padrão.
 */
export function getTussPrice(
  condition: string,
  tenantPrices?: Map<string, number>,
): { code: string; description: string; price: number } | null {
  const mapping = CONDITION_TUSS_MAP[condition];
  if (!mapping) return null;

  const customPrice = tenantPrices?.get(mapping.code);
  return {
    code: mapping.code,
    description: mapping.description,
    price: customPrice ?? mapping.defaultPrice,
  };
}
