// TUSS Odontologia - Índice Consolidado
// Total: 3.000+ procedimentos odontológicos organizados por categoria

import { TUSS_ODONTO_DENTISTICA, type TussOdontoEntry } from "./tuss-odonto-dentistica";
import { TUSS_ODONTO_DENTISTICA_ADV } from "./tuss-odonto-dentistica-adv";
import { TUSS_ODONTO_ENDODONTIA_EXP } from "./tuss-odonto-endodontia";
import { TUSS_ODONTO_ENDODONTIA_ADV } from "./tuss-odonto-endodontia-adv";
import { TUSS_ODONTO_PERIODONTIA_EXP } from "./tuss-odonto-periodontia";
import { TUSS_ODONTO_PERIODONTIA_ADV, TUSS_ODONTO_CIRURGIA_ADV } from "./tuss-odonto-perio-cirurgia-adv";
import { TUSS_ODONTO_CIRURGIA_EXP } from "./tuss-odonto-cirurgia";
import { TUSS_ODONTO_PROTESE_EXP } from "./tuss-odonto-protese";
import { TUSS_ODONTO_PROTESE_ADV, TUSS_ODONTO_ORTODONTIA_ADV, TUSS_ODONTO_IMPLANTE_ADV } from "./tuss-odonto-protese-orto-implante-adv";
import { TUSS_ODONTO_ORTODONTIA_EXP } from "./tuss-odonto-ortodontia";
import { TUSS_ODONTO_IMPLANTE_EXP, TUSS_ODONTO_PEDIATRIA_EXP } from "./tuss-odonto-implante-pediatria";
import { TUSS_ODONTO_PEDIATRIA_ADV, TUSS_ODONTO_ESPECIALIDADES_ADV } from "./tuss-odonto-pediatria-especialidades-adv";
import { TUSS_ODONTO_PREVENCAO_EXP } from "./tuss-odonto-prevencao";
import { 
  TUSS_ODONTO_ESTOMATOLOGIA, 
  TUSS_ODONTO_DTM, 
  TUSS_ODONTO_GERIATRIA, 
  TUSS_ODONTO_HOSPITALAR 
} from "./tuss-odonto-especialidades";
import { 
  TUSS_ODONTO_TRABALHO, 
  TUSS_ODONTO_LEGAL, 
  TUSS_ODONTO_DESPORTIVA, 
  TUSS_ODONTO_COMPLEMENTARES 
} from "./tuss-odonto-trabalho-legal";
import { TUSS_ODONTO_EXTRA_1 } from "./tuss-odonto-extra-1";
import { TUSS_ODONTO_EXTRA_2 } from "./tuss-odonto-extra-2";
import { TUSS_ODONTO_EXTRA_3 } from "./tuss-odonto-extra-3";
import { TUSS_ODONTO_EXTRA_4 } from "./tuss-odonto-extra-4";
import { TUSS_ODONTO_EXTRA_5 } from "./tuss-odonto-extra-5";
import { TUSS_ODONTO_EXTRA_6 } from "./tuss-odonto-extra-6";
import { TUSS_ODONTO_EXTRA_7 } from "./tuss-odonto-extra-7";
import { TUSS_ODONTO_EXTRA_8 } from "./tuss-odonto-extra-8";
import { TUSS_ODONTO_EXTRA_9 } from "./tuss-odonto-extra-9";

// Re-export do tipo
export type { TussOdontoEntry };

// Categorias odontológicas
export const ODONTO_CATEGORIES = [
  { key: "dentistica", name: "Dentística", icon: "🦷", color: "bg-blue-500" },
  { key: "endodontia", name: "Endodontia", icon: "🔬", color: "bg-red-500" },
  { key: "periodontia", name: "Periodontia", icon: "🩺", color: "bg-pink-500" },
  { key: "cirurgia", name: "Cirurgia", icon: "✂️", color: "bg-orange-500" },
  { key: "protese", name: "Prótese", icon: "🦿", color: "bg-purple-500" },
  { key: "ortodontia", name: "Ortodontia", icon: "📐", color: "bg-green-500" },
  { key: "implantodontia", name: "Implantodontia", icon: "🔩", color: "bg-cyan-500" },
  { key: "odontopediatria", name: "Odontopediatria", icon: "👶", color: "bg-yellow-500" },
  { key: "prevencao", name: "Prevenção e Diagnóstico", icon: "🔍", color: "bg-teal-500" },
  { key: "estomatologia", name: "Estomatologia", icon: "👄", color: "bg-rose-500" },
  { key: "dtm", name: "DTM/Dor Orofacial", icon: "😣", color: "bg-amber-500" },
  { key: "odontogeriatria", name: "Odontogeriatria", icon: "👴", color: "bg-slate-500" },
  { key: "hospitalar", name: "Odontologia Hospitalar", icon: "🏥", color: "bg-indigo-500" },
  { key: "trabalho", name: "Odontologia do Trabalho", icon: "👷", color: "bg-lime-500" },
  { key: "legal", name: "Odontologia Legal", icon: "⚖️", color: "bg-gray-500" },
  { key: "desportiva", name: "Odontologia Desportiva", icon: "🏃", color: "bg-emerald-500" },
  { key: "complementar", name: "Terapias Complementares", icon: "🌿", color: "bg-violet-500" },
] as const;

export type OdontoCategory = typeof ODONTO_CATEGORIES[number]["key"];

// Agrupamentos por categoria
export const TUSS_ODONTO_BY_CATEGORY: Record<OdontoCategory, TussOdontoEntry[]> = {
  dentistica: [...TUSS_ODONTO_DENTISTICA, ...TUSS_ODONTO_DENTISTICA_ADV],
  endodontia: [...TUSS_ODONTO_ENDODONTIA_EXP, ...TUSS_ODONTO_ENDODONTIA_ADV],
  periodontia: [...TUSS_ODONTO_PERIODONTIA_EXP, ...TUSS_ODONTO_PERIODONTIA_ADV],
  cirurgia: [...TUSS_ODONTO_CIRURGIA_EXP, ...TUSS_ODONTO_CIRURGIA_ADV],
  protese: [...TUSS_ODONTO_PROTESE_EXP, ...TUSS_ODONTO_PROTESE_ADV],
  ortodontia: [...TUSS_ODONTO_ORTODONTIA_EXP, ...TUSS_ODONTO_ORTODONTIA_ADV],
  implantodontia: [...TUSS_ODONTO_IMPLANTE_EXP, ...TUSS_ODONTO_IMPLANTE_ADV],
  odontopediatria: [...TUSS_ODONTO_PEDIATRIA_EXP, ...TUSS_ODONTO_PEDIATRIA_ADV],
  prevencao: TUSS_ODONTO_PREVENCAO_EXP,
  estomatologia: [...TUSS_ODONTO_ESTOMATOLOGIA, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "estomatologia")],
  dtm: [...TUSS_ODONTO_DTM, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "dtm")],
  odontogeriatria: TUSS_ODONTO_GERIATRIA,
  hospitalar: [...TUSS_ODONTO_HOSPITALAR, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "hospitalar")],
  trabalho: [...TUSS_ODONTO_TRABALHO, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "trabalho")],
  legal: [...TUSS_ODONTO_LEGAL, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "legal")],
  desportiva: [...TUSS_ODONTO_DESPORTIVA, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "desportiva")],
  complementar: [...TUSS_ODONTO_COMPLEMENTARES, ...TUSS_ODONTO_ESPECIALIDADES_ADV.filter(e => e.category === "complementar")],
};

// Array consolidado com TODOS os procedimentos odontológicos
export const TUSS_ODONTO_DATA: TussOdontoEntry[] = [
  ...TUSS_ODONTO_DENTISTICA,
  ...TUSS_ODONTO_DENTISTICA_ADV,
  ...TUSS_ODONTO_ENDODONTIA_EXP,
  ...TUSS_ODONTO_ENDODONTIA_ADV,
  ...TUSS_ODONTO_PERIODONTIA_EXP,
  ...TUSS_ODONTO_PERIODONTIA_ADV,
  ...TUSS_ODONTO_CIRURGIA_EXP,
  ...TUSS_ODONTO_CIRURGIA_ADV,
  ...TUSS_ODONTO_PROTESE_EXP,
  ...TUSS_ODONTO_PROTESE_ADV,
  ...TUSS_ODONTO_ORTODONTIA_EXP,
  ...TUSS_ODONTO_ORTODONTIA_ADV,
  ...TUSS_ODONTO_IMPLANTE_EXP,
  ...TUSS_ODONTO_IMPLANTE_ADV,
  ...TUSS_ODONTO_PEDIATRIA_EXP,
  ...TUSS_ODONTO_PEDIATRIA_ADV,
  ...TUSS_ODONTO_PREVENCAO_EXP,
  ...TUSS_ODONTO_ESTOMATOLOGIA,
  ...TUSS_ODONTO_DTM,
  ...TUSS_ODONTO_GERIATRIA,
  ...TUSS_ODONTO_HOSPITALAR,
  ...TUSS_ODONTO_TRABALHO,
  ...TUSS_ODONTO_LEGAL,
  ...TUSS_ODONTO_DESPORTIVA,
  ...TUSS_ODONTO_COMPLEMENTARES,
  ...TUSS_ODONTO_ESPECIALIDADES_ADV,
  ...TUSS_ODONTO_EXTRA_1,
  ...TUSS_ODONTO_EXTRA_2,
  ...TUSS_ODONTO_EXTRA_3,
  ...TUSS_ODONTO_EXTRA_4,
  ...TUSS_ODONTO_EXTRA_5,
  ...TUSS_ODONTO_EXTRA_6,
  ...TUSS_ODONTO_EXTRA_7,
  ...TUSS_ODONTO_EXTRA_8,
  ...TUSS_ODONTO_EXTRA_9,
];

// Mapa para busca rápida por código
export const TUSS_ODONTO_MAP = new Map<string, TussOdontoEntry>(
  TUSS_ODONTO_DATA.map((t) => [t.code, t])
);

// Função de busca otimizada
export function searchTussOdonto(
  query: string, 
  options?: {
    category?: OdontoCategory;
    scope?: TussOdontoEntry["scope"];
    limit?: number;
  }
): TussOdontoEntry[] {
  const q = query.toLowerCase().trim();
  const limit = options?.limit ?? 50;
  
  if (!q && !options?.category && !options?.scope) return [];
  
  let results = options?.category 
    ? TUSS_ODONTO_BY_CATEGORY[options.category] 
    : TUSS_ODONTO_DATA;
  
  if (options?.scope) {
    results = results.filter((t) => t.scope === options.scope);
  }
  
  if (q) {
    results = results.filter(
      (t) => t.code.includes(q) || t.description.toLowerCase().includes(q)
    );
  }
  
  return results.slice(0, limit);
}

// Função para obter procedimento por código
export function getTussOdontoByCode(code: string): TussOdontoEntry | undefined {
  return TUSS_ODONTO_MAP.get(code);
}

// Função para obter procedimentos por categoria
export function getTussOdontoByCategory(category: OdontoCategory): TussOdontoEntry[] {
  return TUSS_ODONTO_BY_CATEGORY[category] || [];
}

// Estatísticas
export const TUSS_ODONTO_STATS = {
  get total() { return TUSS_ODONTO_DATA.length; },
  get dentistica() { return TUSS_ODONTO_DENTISTICA.length; },
  get endodontia() { return TUSS_ODONTO_ENDODONTIA_EXP.length; },
  get periodontia() { return TUSS_ODONTO_PERIODONTIA_EXP.length; },
  get cirurgia() { return TUSS_ODONTO_CIRURGIA_EXP.length; },
  get protese() { return TUSS_ODONTO_PROTESE_EXP.length; },
  get ortodontia() { return TUSS_ODONTO_ORTODONTIA_EXP.length; },
  get implantodontia() { return TUSS_ODONTO_IMPLANTE_EXP.length; },
  get odontopediatria() { return TUSS_ODONTO_PEDIATRIA_EXP.length; },
  get prevencao() { return TUSS_ODONTO_PREVENCAO_EXP.length; },
  get estomatologia() { return TUSS_ODONTO_ESTOMATOLOGIA.length; },
  get dtm() { return TUSS_ODONTO_DTM.length; },
  get odontogeriatria() { return TUSS_ODONTO_GERIATRIA.length; },
  get hospitalar() { return TUSS_ODONTO_HOSPITALAR.length; },
  get trabalho() { return TUSS_ODONTO_TRABALHO.length; },
  get legal() { return TUSS_ODONTO_LEGAL.length; },
  get desportiva() { return TUSS_ODONTO_DESPORTIVA.length; },
  get complementar() { return TUSS_ODONTO_COMPLEMENTARES.length; },
  byCategory() {
    return ODONTO_CATEGORIES.map(cat => ({
      key: cat.key,
      name: cat.name,
      count: TUSS_ODONTO_BY_CATEGORY[cat.key].length
    }));
  }
};

// Log do total ao importar (para debug)
console.log(`[TUSS Odonto] Total de procedimentos odontológicos: ${TUSS_ODONTO_DATA.length}`);
