// TUSS Odontologia - Preços de Referência por Região
// Baseado em tabelas CROSP, APCD e valores de mercado

export type Region = "SP" | "RJ" | "MG" | "RS" | "PR" | "SC" | "BA" | "PE" | "CE" | "DF" | "GO" | "outros";

export interface PriceReference {
  code: string;
  prices: Partial<Record<Region, number>>;
  avg_national: number;
}

// Faixas de preço por categoria (valores médios em R$)
export const PRICE_RANGES = {
  dentistica: { min: 80, max: 2500 },
  endodontia: { min: 300, max: 2000 },
  periodontia: { min: 100, max: 3000 },
  cirurgia: { min: 150, max: 5000 },
  protese: { min: 500, max: 15000 },
  ortodontia: { min: 200, max: 12000 },
  implantodontia: { min: 1500, max: 25000 },
  odontopediatria: { min: 80, max: 800 },
  prevencao: { min: 50, max: 500 },
  estomatologia: { min: 150, max: 1500 },
  dtm: { min: 200, max: 3000 },
  odontogeriatria: { min: 100, max: 600 },
  hospitalar: { min: 500, max: 10000 },
  trabalho: { min: 80, max: 500 },
  legal: { min: 300, max: 3000 },
  desportiva: { min: 150, max: 1500 },
  complementar: { min: 100, max: 800 },
};

// Multiplicadores regionais (SP = 1.0 como base)
export const REGIONAL_MULTIPLIERS: Record<Region, number> = {
  SP: 1.0,
  RJ: 0.95,
  MG: 0.85,
  RS: 0.90,
  PR: 0.88,
  SC: 0.87,
  BA: 0.80,
  PE: 0.78,
  CE: 0.75,
  DF: 1.05,
  GO: 0.82,
  outros: 0.80,
};

// Preços de referência para procedimentos mais comuns (valores em R$ - base SP)
export const COMMON_PRICES: Record<string, number> = {
  // Consultas
  "81000400": 150, // Consulta inicial
  "81000401": 100, // Consulta retorno
  "81000402": 200, // Consulta urgência
  
  // Prevenção
  "81000420": 120, // Profilaxia
  "81000430": 80,  // Flúor gel
  "81000433": 100, // Flúor verniz
  "81000440": 80,  // Selante por dente
  
  // Restaurações
  "81000210": 150, // Resina classe I anterior
  "81000220": 180, // Resina classe I posterior
  "81000222": 250, // Resina classe II 2 faces
  "81000223": 320, // Resina classe II 3 faces
  "81000250": 400, // Faceta direta
  "81000254": 1500, // Faceta porcelana
  "81000257": 2000, // Lente de contato
  
  // Coroas
  "81000286": 1200, // Coroa metalocerâmica
  "81000289": 1800, // Coroa e.max
  "81000290": 2200, // Coroa zircônia monolítica
  "81000291": 2500, // Coroa zircônia estratificada
  
  // Clareamento
  "81000300": 800,  // Clareamento consultório sessão única
  "81000302": 600,  // Clareamento caseiro kit
  "81000307": 1200, // Clareamento combinado
  
  // Endodontia
  "81200210": 500,  // Canal anterior
  "81200220": 700,  // Canal pré-molar
  "81200230": 900,  // Canal molar 3 canais
  "81200231": 1100, // Canal molar 4 canais
  "81200250": 700,  // Retratamento unirradicular
  "81200252": 1200, // Retratamento multirradicular
  "81200300": 800,  // Apicectomia simples
  
  // Periodontia
  "81300212": 200,  // Raspagem supragengival boca toda
  "81300216": 400,  // Raspagem subgengival boca toda
  "81300220": 800,  // RAR boca toda sessão única
  "81300230": 600,  // Cirurgia a retalho por sextante
  "81300240": 1500, // RTG por defeito
  "81300250": 800,  // Enxerto gengival livre
  "81300252": 1200, // Enxerto tecido conjuntivo
  "81300270": 600,  // Aumento coroa clínica
  
  // Cirurgia
  "81700200": 150,  // Exodontia simples decíduo
  "81700202": 200,  // Exodontia simples permanente posterior
  "81700210": 400,  // Exodontia incluso favorável
  "81700214": 600,  // Siso inferior incluso classe I
  "81700215": 800,  // Siso inferior incluso classe II
  "81700216": 1000, // Siso inferior incluso classe III
  "81700250": 800,  // Enucleação cisto pequeno
  "81700260": 600,  // Remoção tórus palatino pequeno
  
  // Prótese
  "81400200": 1500, // Prótese total superior
  "81400210": 2000, // PPR com grampos simples
  "81400214": 2500, // PPR estrutura metálica
  "81400217": 3000, // PPR flexível
  "81400230": 1200, // Coroa metalocerâmica
  "81400240": 3500, // Prótese fixa 3 elementos
  "81400250": 1800, // Coroa sobre implante
  "81400263": 12000, // Protocolo superior
  "81400270": 6000, // Overdenture 2 implantes
  "81400300": 800,  // Placa miorrelaxante
  
  // Ortodontia
  "81500200": 400,  // Documentação ortodôntica
  "81500210": 3500, // Aparelho fixo metálico arcada
  "81500212": 6000, // Aparelho fixo metálico boca toda
  "81500220": 4500, // Aparelho fixo estético arcada
  "81500222": 8000, // Aparelho fixo estético boca toda
  "81500240": 5000, // Alinhadores caso simples
  "81500241": 8000, // Alinhadores caso moderado
  "81500242": 12000, // Alinhadores caso complexo
  "81500270": 800,  // Expansor palatino removível
  "81500271": 1200, // Expansor Hyrax
  "81500290": 400,  // Mini-implante instalação
  "81500300": 200,  // Manutenção mensal
  "81500310": 400,  // Contenção fixa
  
  // Implantodontia
  "81600210": 3500, // Implante unitário anterior
  "81600211": 3000, // Implante unitário posterior
  "81600225": 14000, // Implantes protocolo 4 unidades
  "81600226": 18000, // Implantes protocolo 6 unidades
  "81600229": 20000, // All-on-4
  "81600230": 8000, // Implante zigomático
  "81600250": 2000, // Enxerto autógeno mento
  "81600256": 800,  // Enxerto xenógeno
  "81600260": 3000, // Levantamento seio aberto
  "81600261": 1500, // Levantamento seio fechado
  "81600270": 1000, // ROG membrana reabsorvível
  
  // Odontopediatria
  "81800200": 150,  // Consulta odontopediátrica
  "81800205": 100,  // Profilaxia infantil
  "81800210": 120,  // Restauração amálgama decíduo
  "81800213": 150,  // Restauração resina decíduo
  "81800218": 300,  // Coroa aço decíduo
  "81800220": 250,  // Pulpotomia decíduo
  "81800226": 350,  // Pulpectomia decíduo
  "81800230": 80,   // Exodontia decíduo rizólise completa
  "81800240": 400,  // Mantenedor banda-alça
  "81800283": 200,  // Sedação óxido nitroso
};

// Função para calcular preço por região
export function getPriceByRegion(code: string, region: Region): number | null {
  const basePrice = COMMON_PRICES[code];
  if (!basePrice) return null;
  
  const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS.outros;
  return Math.round(basePrice * multiplier);
}

// Função para obter faixa de preço por categoria
export function getPriceRangeByCategory(category: keyof typeof PRICE_RANGES, region: Region = "SP") {
  const range = PRICE_RANGES[category];
  if (!range) return null;
  
  const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS.outros;
  return {
    min: Math.round(range.min * multiplier),
    max: Math.round(range.max * multiplier),
  };
}

// Função para obter todos os preços de um procedimento por região
export function getAllRegionalPrices(code: string): Partial<Record<Region, number>> | null {
  const basePrice = COMMON_PRICES[code];
  if (!basePrice) return null;
  
  const prices: Partial<Record<Region, number>> = {};
  for (const [region, multiplier] of Object.entries(REGIONAL_MULTIPLIERS)) {
    prices[region as Region] = Math.round(basePrice * multiplier);
  }
  return prices;
}

// Lista de regiões disponíveis
export const REGIONS: { code: Region; name: string; state: string }[] = [
  { code: "SP", name: "São Paulo", state: "São Paulo" },
  { code: "RJ", name: "Rio de Janeiro", state: "Rio de Janeiro" },
  { code: "MG", name: "Minas Gerais", state: "Minas Gerais" },
  { code: "RS", name: "Rio Grande do Sul", state: "Rio Grande do Sul" },
  { code: "PR", name: "Paraná", state: "Paraná" },
  { code: "SC", name: "Santa Catarina", state: "Santa Catarina" },
  { code: "BA", name: "Bahia", state: "Bahia" },
  { code: "PE", name: "Pernambuco", state: "Pernambuco" },
  { code: "CE", name: "Ceará", state: "Ceará" },
  { code: "DF", name: "Distrito Federal", state: "Distrito Federal" },
  { code: "GO", name: "Goiás", state: "Goiás" },
  { code: "outros", name: "Outras Regiões", state: "Brasil" },
];
