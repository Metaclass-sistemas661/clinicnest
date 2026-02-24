// DCB Index - Consolidação de todos os princípios ativos DCB
import { DcbEntry, DCB_A, DCB_B, DCB_C } from './dcb-medicamentos-1';
import { DCB_D, DCB_E, DCB_F, DCB_G } from './dcb-medicamentos-2';
import { DCB_H, DCB_I, DCB_K, DCB_L } from './dcb-medicamentos-3';
import { DCB_M, DCB_N, DCB_O } from './dcb-medicamentos-4';
import { DCB_P, DCB_Q, DCB_R } from './dcb-medicamentos-5';
import { DCB_S, DCB_T, DCB_U, DCB_V, DCB_W, DCB_X, DCB_Z } from './dcb-medicamentos-6';
import { DCB_ASSOCIACOES, DCB_FITOTERAPICOS, DCB_HOMEOPATICOS, DCB_SUPLEMENTOS } from './dcb-medicamentos-7';
import { DCB_DERMATOLOGICOS, DCB_OFTALMOLOGICOS, DCB_OTOLOGICOS, DCB_NASAIS, DCB_BUCAIS } from './dcb-medicamentos-8';
import { DCB_ANESTESICOS, DCB_CONTRASTES, DCB_VACINAS, DCB_SOROS, DCB_ANTIDOTOS, DCB_RADIOFARMACOS } from './dcb-medicamentos-9';
import { DCB_DIVERSOS_1, DCB_DIVERSOS_2, DCB_DIVERSOS_3, DCB_DIVERSOS_4 } from './dcb-medicamentos-10';
import { DCB_DIVERSOS_5, DCB_DIVERSOS_6, DCB_DIVERSOS_7, DCB_DIVERSOS_8, DCB_DIVERSOS_9, DCB_DIVERSOS_10 } from './dcb-medicamentos-11';

export type { DcbEntry };

// Consolidação de todos os princípios ativos DCB
export const DCB_DATA: DcbEntry[] = [
  ...DCB_A, ...DCB_B, ...DCB_C,
  ...DCB_D, ...DCB_E, ...DCB_F, ...DCB_G,
  ...DCB_H, ...DCB_I, ...DCB_K, ...DCB_L,
  ...DCB_M, ...DCB_N, ...DCB_O,
  ...DCB_P, ...DCB_Q, ...DCB_R,
  ...DCB_S, ...DCB_T, ...DCB_U, ...DCB_V, ...DCB_W, ...DCB_X, ...DCB_Z,
  ...DCB_ASSOCIACOES, ...DCB_FITOTERAPICOS, ...DCB_HOMEOPATICOS, ...DCB_SUPLEMENTOS,
  ...DCB_DERMATOLOGICOS, ...DCB_OFTALMOLOGICOS, ...DCB_OTOLOGICOS, ...DCB_NASAIS, ...DCB_BUCAIS,
  ...DCB_ANESTESICOS, ...DCB_CONTRASTES, ...DCB_VACINAS, ...DCB_SOROS, ...DCB_ANTIDOTOS, ...DCB_RADIOFARMACOS,
  ...DCB_DIVERSOS_1, ...DCB_DIVERSOS_2, ...DCB_DIVERSOS_3, ...DCB_DIVERSOS_4,
  ...DCB_DIVERSOS_5, ...DCB_DIVERSOS_6, ...DCB_DIVERSOS_7, ...DCB_DIVERSOS_8, ...DCB_DIVERSOS_9, ...DCB_DIVERSOS_10,
];

// Mapa para busca rápida por código
export const DCB_MAP = new Map<string, DcbEntry>(
  DCB_DATA.map(entry => [entry.code, entry])
);

// Mapa para busca por nome
export const DCB_NAME_MAP = new Map<string, DcbEntry>(
  DCB_DATA.map(entry => [entry.name.toLowerCase(), entry])
);

// Função de busca por código ou nome
export function searchDcb(query: string, limit = 20): DcbEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Busca exata por código primeiro
  const exactMatch = DCB_MAP.get(query);
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Busca exata por nome
  const nameMatch = DCB_NAME_MAP.get(normalizedQuery);
  if (nameMatch) {
    return [nameMatch];
  }
  
  // Busca por código parcial ou nome
  return DCB_DATA
    .filter(entry => 
      entry.code.includes(query) ||
      entry.name.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, limit);
}

// Busca por categoria
export function searchDcbByCategory(category: string): DcbEntry[] {
  return DCB_DATA.filter(entry => 
    entry.category.toLowerCase().includes(category.toLowerCase())
  );
}

// Lista de categorias disponíveis
export function getDcbCategories(): string[] {
  const categories = new Set(DCB_DATA.map(entry => entry.category));
  return Array.from(categories).sort();
}

// Estatísticas
export const DCB_STATS = {
  total: DCB_DATA.length,
  categorias: {
    antibioticos: DCB_DATA.filter(e => e.category === 'Antibiótico').length,
    antineoplasicos: DCB_DATA.filter(e => e.category === 'Antineoplásico').length,
    anti_hipertensivos: DCB_DATA.filter(e => e.category.includes('Anti-hipertensivo')).length,
    antidiabeticos: DCB_DATA.filter(e => e.category === 'Antidiabético').length,
    anticonvulsivantes: DCB_DATA.filter(e => e.category === 'Anticonvulsivante').length,
    antidepressivos: DCB_DATA.filter(e => e.category === 'Antidepressivo').length,
    antipsicoticos: DCB_DATA.filter(e => e.category === 'Antipsicótico').length,
    analgesicos: DCB_DATA.filter(e => e.category.includes('Analgésico')).length,
    anti_inflamatorios: DCB_DATA.filter(e => e.category === 'Anti-inflamatório').length,
    imunobiologicos: DCB_DATA.filter(e => e.category === 'Imunobiológico').length,
    antivirais: DCB_DATA.filter(e => e.category.includes('Antiviral')).length,
    antifungicos: DCB_DATA.filter(e => e.category === 'Antifúngico').length,
    vacinas: DCB_DATA.filter(e => e.category === 'Vacina').length,
    fitoterapicos: DCB_DATA.filter(e => e.category === 'Fitoterápico').length,
    suplementos: DCB_DATA.filter(e => e.category === 'Suplemento').length,
    dermatologicos: DCB_DATA.filter(e => e.category === 'Dermatológico').length,
    oftalmologicos: DCB_DATA.filter(e => e.category === 'Oftalmológico').length,
  }
};

export default DCB_DATA;
