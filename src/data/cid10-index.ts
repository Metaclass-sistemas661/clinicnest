// CID-10 Index - Consolidação de todos os códigos CID-10
import { CID10_DATA as CID10_BASE } from './cid10';
import { CID10_INFECCIOSAS } from './cid10-infecciosas';
import { CID10_VIRAIS } from './cid10-virais';
import { CID10_NEOPLASIAS } from './cid10-neoplasias';
import { CID10_NEOPLASIAS_GENITO } from './cid10-neoplasias-2';
import { CID10_SANGUE_ENDOCRINAS } from './cid10-sangue';
import { CID10_ENDOCRINAS } from './cid10-endocrinas';
import { CID10_MENTAL } from './cid10-mental';
import { CID10_NERVOSO_MUSCULO } from './cid10-nervoso';

export interface Cid10Entry {
  code: string;
  description: string;
}

// Consolidação de todos os códigos CID-10
export const CID10_DATA: Cid10Entry[] = [
  ...CID10_BASE,
  ...CID10_INFECCIOSAS,
  ...CID10_VIRAIS,
  ...CID10_NEOPLASIAS,
  ...CID10_NEOPLASIAS_GENITO,
  ...CID10_SANGUE_ENDOCRINAS,
  ...CID10_ENDOCRINAS,
  ...CID10_MENTAL,
  ...CID10_NERVOSO_MUSCULO,
];

// Mapa para busca rápida por código
export const CID10_MAP = new Map<string, Cid10Entry>(
  CID10_DATA.map(entry => [entry.code, entry])
);

// Função de busca por código ou descrição
export function searchCid10(query: string, limit = 20): Cid10Entry[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Busca exata por código primeiro
  const exactMatch = CID10_MAP.get(query.toUpperCase());
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Busca por código parcial ou descrição
  return CID10_DATA
    .filter(entry => 
      entry.code.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, limit);
}

// Estatísticas
export const CID10_STATS = {
  total: CID10_DATA.length,
  categorias: {
    base: CID10_BASE.length,
    infecciosas: CID10_INFECCIOSAS.length,
    virais: CID10_VIRAIS.length,
    neoplasias: CID10_NEOPLASIAS.length + CID10_NEOPLASIAS_GENITO.length,
    sangue: CID10_SANGUE_ENDOCRINAS.length,
    endocrinas: CID10_ENDOCRINAS.length,
    mental: CID10_MENTAL.length,
    nervoso_musculo: CID10_NERVOSO_MUSCULO.length,
  }
};

export default CID10_DATA;
