// LOINC Index - Consolidação de todos os códigos LOINC
import { 
  LoincEntry,
  LOINC_HEMATOLOGIA,
  LOINC_COAGULACAO,
  LOINC_GLICEMIA,
  LOINC_LIPIDIOS,
  LOINC_RENAL,
  LOINC_HEPATICA,
  LOINC_TIREOIDE,
  LOINC_ELETROLITOS,
  LOINC_INFLAMATORIOS,
} from './loinc-laboratorio';

import {
  LOINC_CARDIACOS,
  LOINC_TUMORAIS,
  LOINC_HORMONIOS,
  LOINC_VITAMINAS,
  LOINC_AUTOIMUNIDADE,
  LOINC_SOROLOGIAS,
} from './loinc-laboratorio-2';

import {
  LOINC_URINÁLISE,
  LOINC_GASOMETRIA,
  LOINC_CULTURAS,
  LOINC_ANTIBIOGRAMA,
  LOINC_LIQUIDOS,
  LOINC_SINAIS_VITAIS,
  LOINC_POC,
} from './loinc-laboratorio-3';

import {
  LOINC_GENETICA,
  LOINC_FEZES,
  LOINC_FERTILIDADE,
  LOINC_DROGAS,
  LOINC_ALERGIA,
} from './loinc-laboratorio-4';

import {
  LOINC_TOXICOLOGIA,
  LOINC_NEONATAL,
  LOINC_PATOLOGIA,
  LOINC_ENDOCRINOLOGIA,
} from './loinc-laboratorio-5';

import {
  LOINC_IMUNOLOGIA,
  LOINC_MICROB_MOLECULAR,
  LOINC_RADIOLOGIA,
  LOINC_DOCUMENTOS,
} from './loinc-laboratorio-6';

import {
  LOINC_FARMACOGENOMICA,
  LOINC_ODONTOLOGIA,
  LOINC_DERMATOLOGIA,
  LOINC_METABOLOMICA,
} from './loinc-laboratorio-7';

export type { LoincEntry };

// Consolidação de todos os códigos LOINC
export const LOINC_DATA: LoincEntry[] = [
  ...LOINC_HEMATOLOGIA,
  ...LOINC_COAGULACAO,
  ...LOINC_GLICEMIA,
  ...LOINC_LIPIDIOS,
  ...LOINC_RENAL,
  ...LOINC_HEPATICA,
  ...LOINC_TIREOIDE,
  ...LOINC_ELETROLITOS,
  ...LOINC_INFLAMATORIOS,
  ...LOINC_CARDIACOS,
  ...LOINC_TUMORAIS,
  ...LOINC_HORMONIOS,
  ...LOINC_VITAMINAS,
  ...LOINC_AUTOIMUNIDADE,
  ...LOINC_SOROLOGIAS,
  ...LOINC_URINÁLISE,
  ...LOINC_GASOMETRIA,
  ...LOINC_CULTURAS,
  ...LOINC_ANTIBIOGRAMA,
  ...LOINC_LIQUIDOS,
  ...LOINC_SINAIS_VITAIS,
  ...LOINC_POC,
  ...LOINC_GENETICA,
  ...LOINC_FEZES,
  ...LOINC_FERTILIDADE,
  ...LOINC_DROGAS,
  ...LOINC_ALERGIA,
  // Parte 5 - Toxicologia, Neonatal, Patologia, Endocrinologia
  ...LOINC_TOXICOLOGIA,
  ...LOINC_NEONATAL,
  ...LOINC_PATOLOGIA,
  ...LOINC_ENDOCRINOLOGIA,
  // Parte 6 - Imunologia, Microbiologia Molecular, Radiologia, Documentos
  ...LOINC_IMUNOLOGIA,
  ...LOINC_MICROB_MOLECULAR,
  ...LOINC_RADIOLOGIA,
  ...LOINC_DOCUMENTOS,
  // Parte 7 - Farmacogenômica, Odontologia, Dermatologia, Metabolômica
  ...LOINC_FARMACOGENOMICA,
  ...LOINC_ODONTOLOGIA,
  ...LOINC_DERMATOLOGIA,
  ...LOINC_METABOLOMICA,
];

// Mapa para busca rápida por código
export const LOINC_MAP = new Map<string, LoincEntry>(
  LOINC_DATA.map(entry => [entry.code, entry])
);

// Função de busca por código ou descrição
export function searchLoinc(query: string, limit = 20): LoincEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Busca exata por código primeiro
  const exactMatch = LOINC_MAP.get(query);
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Busca por código parcial ou descrição (PT-BR ou EN)
  return LOINC_DATA
    .filter(entry => 
      entry.code.toLowerCase().includes(normalizedQuery) ||
      entry.display.toLowerCase().includes(normalizedQuery) ||
      entry.displayPtBR.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, limit);
}

// Busca por categoria
export function searchLoincByCategory(category: string): LoincEntry[] {
  return LOINC_DATA.filter(entry => 
    entry.category.toLowerCase() === category.toLowerCase()
  );
}

// Lista de categorias disponíveis
export function getLoincCategories(): string[] {
  const categories = new Set(LOINC_DATA.map(entry => entry.category));
  return Array.from(categories).sort();
}

// Estatísticas
export const LOINC_STATS = {
  total: LOINC_DATA.length,
  categorias: {
    hematologia: LOINC_HEMATOLOGIA.length,
    coagulacao: LOINC_COAGULACAO.length,
    glicemia: LOINC_GLICEMIA.length,
    lipidios: LOINC_LIPIDIOS.length,
    renal: LOINC_RENAL.length,
    hepatica: LOINC_HEPATICA.length,
    tireoide: LOINC_TIREOIDE.length,
    eletrolitos: LOINC_ELETROLITOS.length,
    inflamatorios: LOINC_INFLAMATORIOS.length,
    cardiacos: LOINC_CARDIACOS.length,
    tumorais: LOINC_TUMORAIS.length,
    hormonios: LOINC_HORMONIOS.length,
    vitaminas: LOINC_VITAMINAS.length,
    autoimunidade: LOINC_AUTOIMUNIDADE.length,
    sorologias: LOINC_SOROLOGIAS.length,
    urinalise: LOINC_URINÁLISE.length,
    gasometria: LOINC_GASOMETRIA.length,
    culturas: LOINC_CULTURAS.length,
    antibiograma: LOINC_ANTIBIOGRAMA.length,
    liquidos: LOINC_LIQUIDOS.length,
    sinais_vitais: LOINC_SINAIS_VITAIS.length,
    poc: LOINC_POC.length,
    genetica: LOINC_GENETICA.length,
    fezes: LOINC_FEZES.length,
    fertilidade: LOINC_FERTILIDADE.length,
    drogas: LOINC_DROGAS.length,
    alergia: LOINC_ALERGIA.length,
    // Parte 5
    toxicologia: LOINC_TOXICOLOGIA.length,
    neonatal: LOINC_NEONATAL.length,
    patologia: LOINC_PATOLOGIA.length,
    endocrinologia: LOINC_ENDOCRINOLOGIA.length,
    // Parte 6
    imunologia: LOINC_IMUNOLOGIA.length,
    microbiologia_molecular: LOINC_MICROB_MOLECULAR.length,
    radiologia: LOINC_RADIOLOGIA.length,
    documentos: LOINC_DOCUMENTOS.length,
    // Parte 7
    farmacogenomica: LOINC_FARMACOGENOMICA.length,
    odontologia: LOINC_ODONTOLOGIA.length,
    dermatologia: LOINC_DERMATOLOGIA.length,
    metabolomica: LOINC_METABOLOMICA.length,
  }
};

export default LOINC_DATA;
