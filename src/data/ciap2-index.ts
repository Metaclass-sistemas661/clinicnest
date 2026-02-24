// CIAP-2 Index - Consolidação de todos os códigos CIAP-2
import { 
  Ciap2Entry,
  CIAP2_GERAL,
  CIAP2_SANGUE,
  CIAP2_DIGESTIVO,
  CIAP2_OLHO,
} from './ciap2-parte1';

import {
  CIAP2_OUVIDO,
  CIAP2_CARDIOVASCULAR,
  CIAP2_MUSCULOESQUELETICO,
} from './ciap2-parte2';

import {
  CIAP2_NEUROLOGICO,
  CIAP2_PSICOLOGICO,
  CIAP2_RESPIRATORIO,
} from './ciap2-parte3';

import {
  CIAP2_PELE,
  CIAP2_ENDOCRINO,
  CIAP2_URINARIO,
  CIAP2_GRAVIDEZ,
  CIAP2_GENITAL_FEM,
  CIAP2_GENITAL_MASC,
  CIAP2_SOCIAL,
  CIAP2_PROCEDIMENTOS,
} from './ciap2-parte4';

export type { Ciap2Entry };

// Consolidação de todos os códigos CIAP-2
export const CIAP2_DATA: Ciap2Entry[] = [
  ...CIAP2_GERAL,
  ...CIAP2_SANGUE,
  ...CIAP2_DIGESTIVO,
  ...CIAP2_OLHO,
  ...CIAP2_OUVIDO,
  ...CIAP2_CARDIOVASCULAR,
  ...CIAP2_MUSCULOESQUELETICO,
  ...CIAP2_NEUROLOGICO,
  ...CIAP2_PSICOLOGICO,
  ...CIAP2_RESPIRATORIO,
  ...CIAP2_PELE,
  ...CIAP2_ENDOCRINO,
  ...CIAP2_URINARIO,
  ...CIAP2_GRAVIDEZ,
  ...CIAP2_GENITAL_FEM,
  ...CIAP2_GENITAL_MASC,
  ...CIAP2_SOCIAL,
  ...CIAP2_PROCEDIMENTOS,
];

// Mapa para busca rápida por código
export const CIAP2_MAP = new Map<string, Ciap2Entry>(
  CIAP2_DATA.map(entry => [entry.code, entry])
);

// Função de busca por código ou descrição
export function searchCiap2(query: string, limit = 20): Ciap2Entry[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Busca exata por código primeiro
  const exactMatch = CIAP2_MAP.get(query.toUpperCase());
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Busca por código parcial ou descrição
  return CIAP2_DATA
    .filter(entry => 
      entry.code.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, limit);
}

// Busca por capítulo
export function searchCiap2ByChapter(chapter: string): Ciap2Entry[] {
  return CIAP2_DATA.filter(entry => 
    entry.chapter.toLowerCase() === chapter.toLowerCase()
  );
}

// Lista de capítulos disponíveis
export const CIAP2_CHAPTERS = {
  A: "Geral e Inespecífico",
  B: "Sangue, Órgãos Hematopoiéticos, Linfáticos, Baço",
  D: "Aparelho Digestivo",
  F: "Olho",
  H: "Ouvido",
  K: "Aparelho Circulatório",
  L: "Sistema Musculoesquelético",
  N: "Sistema Neurológico",
  P: "Psicológico",
  R: "Aparelho Respiratório",
  S: "Pele",
  T: "Endócrino, Metabólico e Nutricional",
  U: "Aparelho Urinário",
  W: "Gravidez, Parto, Planejamento Familiar",
  X: "Aparelho Genital Feminino (incluindo mama)",
  Y: "Aparelho Genital Masculino",
  Z: "Problemas Sociais",
  Proc: "Procedimentos/Processos",
};

// Estatísticas
export const CIAP2_STATS = {
  total: CIAP2_DATA.length,
  capitulos: {
    geral: CIAP2_GERAL.length,
    sangue: CIAP2_SANGUE.length,
    digestivo: CIAP2_DIGESTIVO.length,
    olho: CIAP2_OLHO.length,
    ouvido: CIAP2_OUVIDO.length,
    cardiovascular: CIAP2_CARDIOVASCULAR.length,
    musculoesqueletico: CIAP2_MUSCULOESQUELETICO.length,
    neurologico: CIAP2_NEUROLOGICO.length,
    psicologico: CIAP2_PSICOLOGICO.length,
    respiratorio: CIAP2_RESPIRATORIO.length,
    pele: CIAP2_PELE.length,
    endocrino: CIAP2_ENDOCRINO.length,
    urinario: CIAP2_URINARIO.length,
    gravidez: CIAP2_GRAVIDEZ.length,
    genital_fem: CIAP2_GENITAL_FEM.length,
    genital_masc: CIAP2_GENITAL_MASC.length,
    social: CIAP2_SOCIAL.length,
    procedimentos: CIAP2_PROCEDIMENTOS.length,
  }
};

export default CIAP2_DATA;
