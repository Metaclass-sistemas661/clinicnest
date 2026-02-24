// TUSS Odontologia Expandida - Parte 1: Dentística
// Categoria: Procedimentos restauradores e estéticos

export interface TussOdontoEntry {
  code: string;
  description: string;
  category: string;
  scope: "dente" | "arcada" | "hemiarcada" | "boca" | "sessao";
  price_ref?: number;
}

export const TUSS_ODONTO_DENTISTICA: TussOdontoEntry[] = [
  // Restaurações de Amálgama
  {code:"81000200",description:"Restauração de amálgama classe I - 1 face",category:"dentistica",scope:"dente"},
  {code:"81000201",description:"Restauração de amálgama classe I - 2 faces",category:"dentistica",scope:"dente"},
  {code:"81000202",description:"Restauração de amálgama classe II - 2 faces (MO/OD)",category:"dentistica",scope:"dente"},
  {code:"81000203",description:"Restauração de amálgama classe II - 3 faces (MOD)",category:"dentistica",scope:"dente"},
  {code:"81000204",description:"Restauração de amálgama classe V",category:"dentistica",scope:"dente"},
  {code:"81000205",description:"Restauração de amálgama complexa (4+ faces)",category:"dentistica",scope:"dente"},
  {code:"81000206",description:"Restauração de amálgama com pino",category:"dentistica",scope:"dente"},
  {code:"81000207",description:"Restauração de amálgama adesiva",category:"dentistica",scope:"dente"},
  
  // Restaurações de Resina Composta - Anteriores
  {code:"81000210",description:"Restauração de resina composta classe I anterior",category:"dentistica",scope:"dente"},
  {code:"81000211",description:"Restauração de resina composta classe III - 1 face",category:"dentistica",scope:"dente"},
  {code:"81000212",description:"Restauração de resina composta classe III - 2 faces",category:"dentistica",scope:"dente"},
  {code:"81000213",description:"Restauração de resina composta classe IV pequena",category:"dentistica",scope:"dente"},
  {code:"81000214",description:"Restauração de resina composta classe IV média",category:"dentistica",scope:"dente"},
  {code:"81000215",description:"Restauração de resina composta classe IV extensa",category:"dentistica",scope:"dente"},
  {code:"81000216",description:"Restauração de resina composta classe V anterior",category:"dentistica",scope:"dente"},
  {code:"81000217",description:"Restauração de resina composta com envolvimento incisal",category:"dentistica",scope:"dente"},
  
  // Restaurações de Resina Composta - Posteriores
  {code:"81000220",description:"Restauração de resina composta classe I posterior - 1 face",category:"dentistica",scope:"dente"},
  {code:"81000221",description:"Restauração de resina composta classe I posterior - 2 faces",category:"dentistica",scope:"dente"},
  {code:"81000222",description:"Restauração de resina composta classe II - 2 faces (MO/OD)",category:"dentistica",scope:"dente"},
  {code:"81000223",description:"Restauração de resina composta classe II - 3 faces (MOD)",category:"dentistica",scope:"dente"},
  {code:"81000224",description:"Restauração de resina composta classe II - 4 faces",category:"dentistica",scope:"dente"},
  {code:"81000225",description:"Restauração de resina composta classe V posterior",category:"dentistica",scope:"dente"},
  {code:"81000226",description:"Restauração de resina composta complexa posterior",category:"dentistica",scope:"dente"},
  {code:"81000227",description:"Restauração de resina composta com recobrimento de cúspide",category:"dentistica",scope:"dente"},
  {code:"81000228",description:"Restauração de resina composta bulk fill",category:"dentistica",scope:"dente"},
  {code:"81000229",description:"Restauração de resina composta flow",category:"dentistica",scope:"dente"},
  
  // Restaurações de Ionômero de Vidro
  {code:"81000230",description:"Restauração de ionômero de vidro convencional",category:"dentistica",scope:"dente"},
  {code:"81000231",description:"Restauração de ionômero de vidro modificado por resina",category:"dentistica",scope:"dente"},
  {code:"81000232",description:"Restauração de ionômero de vidro alta viscosidade (ART)",category:"dentistica",scope:"dente"},
  {code:"81000233",description:"Base de ionômero de vidro",category:"dentistica",scope:"dente"},
  {code:"81000234",description:"Forramento de ionômero de vidro",category:"dentistica",scope:"dente"},
  {code:"81000235",description:"Selamento de ionômero de vidro",category:"dentistica",scope:"dente"},
  
  // Restaurações Provisórias
  {code:"81000240",description:"Restauração provisória com IRM",category:"dentistica",scope:"dente"},
  {code:"81000241",description:"Restauração provisória com Cavit",category:"dentistica",scope:"dente"},
  {code:"81000242",description:"Restauração provisória com cimento de óxido de zinco",category:"dentistica",scope:"dente"},
  {code:"81000243",description:"Restauração provisória com resina acrílica",category:"dentistica",scope:"dente"},
  {code:"81000244",description:"Restauração provisória com cimento de ionômero",category:"dentistica",scope:"dente"},
  
  // Facetas
  {code:"81000250",description:"Faceta direta em resina composta - técnica incremental",category:"dentistica",scope:"dente"},
  {code:"81000251",description:"Faceta direta em resina composta - técnica estratificada",category:"dentistica",scope:"dente"},
  {code:"81000252",description:"Faceta direta em resina composta com matriz de silicone",category:"dentistica",scope:"dente"},
  {code:"81000253",description:"Faceta indireta em resina composta laboratorial",category:"dentistica",scope:"dente"},
  {code:"81000254",description:"Faceta de porcelana feldspática",category:"dentistica",scope:"dente"},
  {code:"81000255",description:"Faceta de porcelana injetada (e.max)",category:"dentistica",scope:"dente"},
  {code:"81000256",description:"Faceta de porcelana estratificada",category:"dentistica",scope:"dente"},
  {code:"81000257",description:"Lente de contato dental",category:"dentistica",scope:"dente"},
  {code:"81000258",description:"Faceta de zircônia",category:"dentistica",scope:"dente"},
  {code:"81000259",description:"Remoção de faceta",category:"dentistica",scope:"dente"},
  
  // Inlays e Onlays
  {code:"81000260",description:"Inlay de resina composta",category:"dentistica",scope:"dente"},
  {code:"81000261",description:"Inlay de porcelana",category:"dentistica",scope:"dente"},
  {code:"81000262",description:"Inlay de ouro",category:"dentistica",scope:"dente"},
  {code:"81000263",description:"Inlay de zircônia",category:"dentistica",scope:"dente"},
  {code:"81000264",description:"Onlay de resina composta",category:"dentistica",scope:"dente"},
  {code:"81000265",description:"Onlay de porcelana",category:"dentistica",scope:"dente"},
  {code:"81000266",description:"Onlay de ouro",category:"dentistica",scope:"dente"},
  {code:"81000267",description:"Onlay de zircônia",category:"dentistica",scope:"dente"},
  {code:"81000268",description:"Overlay de porcelana",category:"dentistica",scope:"dente"},
  {code:"81000269",description:"Endocrown de porcelana",category:"dentistica",scope:"dente"},
  
  // Núcleos e Pinos
  {code:"81000270",description:"Núcleo de preenchimento em resina composta",category:"dentistica",scope:"dente"},
  {code:"81000271",description:"Núcleo de preenchimento em ionômero de vidro",category:"dentistica",scope:"dente"},
  {code:"81000272",description:"Núcleo metálico fundido",category:"dentistica",scope:"dente"},
  {code:"81000273",description:"Núcleo metálico fundido com espiga",category:"dentistica",scope:"dente"},
  {code:"81000274",description:"Pino de fibra de vidro",category:"dentistica",scope:"dente"},
  {code:"81000275",description:"Pino de fibra de carbono",category:"dentistica",scope:"dente"},
  {code:"81000276",description:"Pino de fibra de quartzo",category:"dentistica",scope:"dente"},
  {code:"81000277",description:"Pino metálico pré-fabricado",category:"dentistica",scope:"dente"},
  {code:"81000278",description:"Pino metálico rosqueável",category:"dentistica",scope:"dente"},
  {code:"81000279",description:"Remoção de pino intrarradicular",category:"dentistica",scope:"dente"},
  
  // Coroas Unitárias
  {code:"81000280",description:"Coroa provisória em resina acrílica",category:"dentistica",scope:"dente"},
  {code:"81000281",description:"Coroa provisória em bis-acrílico",category:"dentistica",scope:"dente"},
  {code:"81000282",description:"Coroa provisória em PMMA fresada",category:"dentistica",scope:"dente"},
  {code:"81000283",description:"Coroa de aço inoxidável pré-fabricada",category:"dentistica",scope:"dente"},
  {code:"81000284",description:"Coroa de policarbonato",category:"dentistica",scope:"dente"},
  {code:"81000285",description:"Coroa metálica fundida",category:"dentistica",scope:"dente"},
  {code:"81000286",description:"Coroa metalocerâmica",category:"dentistica",scope:"dente"},
  {code:"81000287",description:"Coroa metalocerâmica com ombro cerâmico",category:"dentistica",scope:"dente"},
  {code:"81000288",description:"Coroa de porcelana pura feldspática",category:"dentistica",scope:"dente"},
  {code:"81000289",description:"Coroa de porcelana injetada (e.max)",category:"dentistica",scope:"dente"},
  {code:"81000290",description:"Coroa de zircônia monolítica",category:"dentistica",scope:"dente"},
  {code:"81000291",description:"Coroa de zircônia estratificada",category:"dentistica",scope:"dente"},
  {code:"81000292",description:"Coroa de dissilicato de lítio",category:"dentistica",scope:"dente"},
  {code:"81000293",description:"Coroa de resina composta CAD/CAM",category:"dentistica",scope:"dente"},
  {code:"81000294",description:"Coroa de cerômero",category:"dentistica",scope:"dente"},
  {code:"81000295",description:"Coroa 3/4",category:"dentistica",scope:"dente"},
  {code:"81000296",description:"Coroa 7/8",category:"dentistica",scope:"dente"},
  {code:"81000297",description:"Coroa veneer",category:"dentistica",scope:"dente"},
  {code:"81000298",description:"Remoção de coroa",category:"dentistica",scope:"dente"},
  {code:"81000299",description:"Recimentação de coroa",category:"dentistica",scope:"dente"},
  
  // Clareamento Dental
  {code:"81000300",description:"Clareamento dental de consultório - sessão única",category:"dentistica",scope:"boca"},
  {code:"81000301",description:"Clareamento dental de consultório - por sessão",category:"dentistica",scope:"sessao"},
  {code:"81000302",description:"Clareamento dental caseiro supervisionado - kit completo",category:"dentistica",scope:"boca"},
  {code:"81000303",description:"Clareamento dental caseiro - moldeira superior",category:"dentistica",scope:"arcada"},
  {code:"81000304",description:"Clareamento dental caseiro - moldeira inferior",category:"dentistica",scope:"arcada"},
  {code:"81000305",description:"Clareamento de dente desvitalizado - walking bleach",category:"dentistica",scope:"dente"},
  {code:"81000306",description:"Clareamento de dente desvitalizado - técnica mista",category:"dentistica",scope:"dente"},
  {code:"81000307",description:"Clareamento combinado (consultório + caseiro)",category:"dentistica",scope:"boca"},
  {code:"81000308",description:"Clareamento com laser/LED - por sessão",category:"dentistica",scope:"sessao"},
  {code:"81000309",description:"Dessensibilização pós-clareamento",category:"dentistica",scope:"sessao"},
  
  // Microabrasão e Tratamentos Estéticos
  {code:"81000310",description:"Microabrasão do esmalte - por dente",category:"dentistica",scope:"dente"},
  {code:"81000311",description:"Microabrasão do esmalte - por arcada",category:"dentistica",scope:"arcada"},
  {code:"81000312",description:"Infiltração de resina (Icon) - por dente",category:"dentistica",scope:"dente"},
  {code:"81000313",description:"Ameloplastia estética",category:"dentistica",scope:"dente"},
  {code:"81000314",description:"Reanatomização dental com resina",category:"dentistica",scope:"dente"},
  {code:"81000315",description:"Fechamento de diastema com resina",category:"dentistica",scope:"dente"},
  {code:"81000316",description:"Aumento de coroa clínica estético",category:"dentistica",scope:"dente"},
  {code:"81000317",description:"Gengivoplastia estética a laser",category:"dentistica",scope:"dente"},
  {code:"81000318",description:"Harmonização do sorriso - planejamento digital",category:"dentistica",scope:"boca"},
  {code:"81000319",description:"Mock-up diagnóstico",category:"dentistica",scope:"boca"},
  
  // Procedimentos Auxiliares
  {code:"81000320",description:"Isolamento absoluto do campo operatório",category:"dentistica",scope:"sessao"},
  {code:"81000321",description:"Matriz metálica - por dente",category:"dentistica",scope:"dente"},
  {code:"81000322",description:"Matriz de poliéster - por dente",category:"dentistica",scope:"dente"},
  {code:"81000323",description:"Cunha de madeira",category:"dentistica",scope:"dente"},
  {code:"81000324",description:"Anel de separação",category:"dentistica",scope:"dente"},
  {code:"81000325",description:"Proteção pulpar direta com hidróxido de cálcio",category:"dentistica",scope:"dente"},
  {code:"81000326",description:"Proteção pulpar direta com MTA",category:"dentistica",scope:"dente"},
  {code:"81000327",description:"Proteção pulpar indireta",category:"dentistica",scope:"dente"},
  {code:"81000328",description:"Tratamento expectante",category:"dentistica",scope:"dente"},
  {code:"81000329",description:"Remoção seletiva de cárie",category:"dentistica",scope:"dente"},
  
  // Ajustes e Polimentos
  {code:"81000330",description:"Ajuste oclusal de restauração",category:"dentistica",scope:"dente"},
  {code:"81000331",description:"Polimento de restauração de amálgama",category:"dentistica",scope:"dente"},
  {code:"81000332",description:"Polimento de restauração de resina",category:"dentistica",scope:"dente"},
  {code:"81000333",description:"Acabamento e polimento de faceta",category:"dentistica",scope:"dente"},
  {code:"81000334",description:"Reparo de restauração de resina",category:"dentistica",scope:"dente"},
  {code:"81000335",description:"Reparo de faceta",category:"dentistica",scope:"dente"},
  {code:"81000336",description:"Substituição de restauração",category:"dentistica",scope:"dente"},
  {code:"81000337",description:"Remoção de restauração antiga",category:"dentistica",scope:"dente"},
  {code:"81000338",description:"Glazeamento de restauração cerâmica",category:"dentistica",scope:"dente"},
  {code:"81000339",description:"Caracterização de restauração",category:"dentistica",scope:"dente"},
];
