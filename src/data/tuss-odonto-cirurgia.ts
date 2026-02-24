// TUSS Odontologia Expandida - Parte 4: Cirurgia Oral
// Categoria: Exodontias e cirurgias bucomaxilofaciais

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_CIRURGIA_EXP: TussOdontoEntry[] = [
  // Exodontias Simples
  {code:"81700200",description:"Exodontia simples de dente decíduo",category:"cirurgia",scope:"dente"},
  {code:"81700201",description:"Exodontia simples de dente permanente anterior",category:"cirurgia",scope:"dente"},
  {code:"81700202",description:"Exodontia simples de dente permanente posterior",category:"cirurgia",scope:"dente"},
  {code:"81700203",description:"Exodontia simples com alveoloplastia",category:"cirurgia",scope:"dente"},
  {code:"81700204",description:"Exodontia de raiz residual",category:"cirurgia",scope:"dente"},
  {code:"81700205",description:"Exodontia múltipla - 2 a 4 dentes",category:"cirurgia",scope:"hemiarcada"},
  {code:"81700206",description:"Exodontia múltipla - 5 a 8 dentes",category:"cirurgia",scope:"arcada"},
  {code:"81700207",description:"Exodontia múltipla - mais de 8 dentes",category:"cirurgia",scope:"boca"},
  {code:"81700208",description:"Exodontia com odontosecção",category:"cirurgia",scope:"dente"},
  {code:"81700209",description:"Exodontia com osteotomia",category:"cirurgia",scope:"dente"},
  
  // Exodontias de Dentes Inclusos
  {code:"81700210",description:"Exodontia de dente incluso - posição favorável",category:"cirurgia",scope:"dente"},
  {code:"81700211",description:"Exodontia de dente incluso - posição desfavorável",category:"cirurgia",scope:"dente"},
  {code:"81700212",description:"Exodontia de dente semi-incluso",category:"cirurgia",scope:"dente"},
  {code:"81700213",description:"Exodontia de terceiro molar superior incluso",category:"cirurgia",scope:"dente"},
  {code:"81700214",description:"Exodontia de terceiro molar inferior incluso - classe I",category:"cirurgia",scope:"dente"},
  {code:"81700215",description:"Exodontia de terceiro molar inferior incluso - classe II",category:"cirurgia",scope:"dente"},
  {code:"81700216",description:"Exodontia de terceiro molar inferior incluso - classe III",category:"cirurgia",scope:"dente"},
  {code:"81700217",description:"Exodontia de canino incluso superior",category:"cirurgia",scope:"dente"},
  {code:"81700218",description:"Exodontia de canino incluso inferior",category:"cirurgia",scope:"dente"},
  {code:"81700219",description:"Exodontia de supranumerário incluso",category:"cirurgia",scope:"dente"},
  
  // Exodontias Especiais
  {code:"81700220",description:"Exodontia de dente anquilosado",category:"cirurgia",scope:"dente"},
  {code:"81700221",description:"Exodontia de dente com hipercementose",category:"cirurgia",scope:"dente"},
  {code:"81700222",description:"Exodontia de dente com dilaceração radicular",category:"cirurgia",scope:"dente"},
  {code:"81700223",description:"Exodontia de dente com reabsorção radicular",category:"cirurgia",scope:"dente"},
  {code:"81700224",description:"Exodontia de dente com tratamento endodôntico",category:"cirurgia",scope:"dente"},
  {code:"81700225",description:"Exodontia de dente com pino/núcleo",category:"cirurgia",scope:"dente"},
  {code:"81700226",description:"Exodontia de dente com coroa protética",category:"cirurgia",scope:"dente"},
  {code:"81700227",description:"Exodontia para fins ortodônticos",category:"cirurgia",scope:"dente"},
  {code:"81700228",description:"Exodontia seriada",category:"cirurgia",scope:"dente"},
  {code:"81700229",description:"Germectomia",category:"cirurgia",scope:"dente"},
  
  // Alveoloplastia e Regularização
  {code:"81700230",description:"Alveoloplastia simples - por dente",category:"cirurgia",scope:"dente"},
  {code:"81700231",description:"Alveoloplastia - por sextante",category:"cirurgia",scope:"hemiarcada"},
  {code:"81700232",description:"Alveoloplastia - por arcada",category:"cirurgia",scope:"arcada"},
  {code:"81700233",description:"Regularização de rebordo alveolar",category:"cirurgia",scope:"arcada"},
  {code:"81700234",description:"Remoção de espícula óssea",category:"cirurgia",scope:"dente"},
  {code:"81700235",description:"Remoção de septo interradicular",category:"cirurgia",scope:"dente"},
  {code:"81700236",description:"Remoção de septo interalveolar",category:"cirurgia",scope:"dente"},
  {code:"81700237",description:"Plastia de rebordo para prótese",category:"cirurgia",scope:"arcada"},
  
  // Cirurgia de Tecidos Moles
  {code:"81700240",description:"Biópsia incisional de tecido mole",category:"cirurgia",scope:"boca"},
  {code:"81700241",description:"Biópsia excisional de tecido mole",category:"cirurgia",scope:"boca"},
  {code:"81700242",description:"Biópsia de glândula salivar menor",category:"cirurgia",scope:"boca"},
  {code:"81700243",description:"Remoção de mucocele",category:"cirurgia",scope:"boca"},
  {code:"81700244",description:"Remoção de rânula",category:"cirurgia",scope:"boca"},
  {code:"81700245",description:"Marsupialização de rânula",category:"cirurgia",scope:"boca"},
  {code:"81700246",description:"Remoção de fibroma",category:"cirurgia",scope:"boca"},
  {code:"81700247",description:"Remoção de papiloma",category:"cirurgia",scope:"boca"},
  {code:"81700248",description:"Remoção de lipoma",category:"cirurgia",scope:"boca"},
  {code:"81700249",description:"Remoção de hemangioma - escleroterapia",category:"cirurgia",scope:"boca"},
  
  // Cirurgia de Cistos e Tumores
  {code:"81700250",description:"Enucleação de cisto odontogênico pequeno",category:"cirurgia",scope:"boca"},
  {code:"81700251",description:"Enucleação de cisto odontogênico médio",category:"cirurgia",scope:"boca"},
  {code:"81700252",description:"Enucleação de cisto odontogênico grande",category:"cirurgia",scope:"boca"},
  {code:"81700253",description:"Marsupialização de cisto",category:"cirurgia",scope:"boca"},
  {code:"81700254",description:"Descompressão de cisto",category:"cirurgia",scope:"boca"},
  {code:"81700255",description:"Enucleação de cisto não odontogênico",category:"cirurgia",scope:"boca"},
  {code:"81700256",description:"Remoção de ameloblastoma",category:"cirurgia",scope:"boca"},
  {code:"81700257",description:"Remoção de odontoma composto",category:"cirurgia",scope:"boca"},
  {code:"81700258",description:"Remoção de odontoma complexo",category:"cirurgia",scope:"boca"},
  {code:"81700259",description:"Remoção de cementoma",category:"cirurgia",scope:"boca"},
  
  // Cirurgia de Tórus e Exostoses
  {code:"81700260",description:"Remoção de tórus palatino pequeno",category:"cirurgia",scope:"boca"},
  {code:"81700261",description:"Remoção de tórus palatino médio",category:"cirurgia",scope:"boca"},
  {code:"81700262",description:"Remoção de tórus palatino grande",category:"cirurgia",scope:"boca"},
  {code:"81700263",description:"Remoção de tórus mandibular unilateral",category:"cirurgia",scope:"boca"},
  {code:"81700264",description:"Remoção de tórus mandibular bilateral",category:"cirurgia",scope:"boca"},
  {code:"81700265",description:"Remoção de exostose vestibular",category:"cirurgia",scope:"boca"},
  {code:"81700266",description:"Remoção de exostose lingual",category:"cirurgia",scope:"boca"},
  {code:"81700267",description:"Remoção de exostose múltipla",category:"cirurgia",scope:"boca"},
  
  // Cirurgia Pré-Protética
  {code:"81700270",description:"Aprofundamento de sulco vestibular",category:"cirurgia",scope:"arcada"},
  {code:"81700271",description:"Vestibuloplastia com enxerto",category:"cirurgia",scope:"arcada"},
  {code:"81700272",description:"Vestibuloplastia sem enxerto",category:"cirurgia",scope:"arcada"},
  {code:"81700273",description:"Aumento de rebordo com enxerto ósseo",category:"cirurgia",scope:"arcada"},
  {code:"81700274",description:"Aumento de rebordo com biomaterial",category:"cirurgia",scope:"arcada"},
  {code:"81700275",description:"Redução de tuberosidade maxilar",category:"cirurgia",scope:"boca"},
  {code:"81700276",description:"Redução de rebordo flácido",category:"cirurgia",scope:"arcada"},
  {code:"81700277",description:"Remoção de hiperplasia fibrosa inflamatória",category:"cirurgia",scope:"arcada"},
  {code:"81700278",description:"Remoção de épulis fissuratum",category:"cirurgia",scope:"arcada"},
  
  // Tratamento de Infecções
  {code:"81700280",description:"Drenagem de abscesso dentoalveolar",category:"cirurgia",scope:"dente"},
  {code:"81700281",description:"Drenagem de abscesso submucoso",category:"cirurgia",scope:"boca"},
  {code:"81700282",description:"Drenagem de abscesso subperiosteal",category:"cirurgia",scope:"boca"},
  {code:"81700283",description:"Drenagem de abscesso de espaço fascial",category:"cirurgia",scope:"boca"},
  {code:"81700284",description:"Tratamento de alveolite seca",category:"cirurgia",scope:"dente"},
  {code:"81700285",description:"Tratamento de alveolite úmida",category:"cirurgia",scope:"dente"},
  {code:"81700286",description:"Curetagem alveolar",category:"cirurgia",scope:"dente"},
  {code:"81700287",description:"Sequestrectomia",category:"cirurgia",scope:"boca"},
  {code:"81700288",description:"Tratamento de osteomielite",category:"cirurgia",scope:"boca"},
  {code:"81700289",description:"Tratamento de osteonecrose (MRONJ)",category:"cirurgia",scope:"boca"},
  
  // Cirurgia de ATM
  {code:"81700290",description:"Artrocentese de ATM",category:"cirurgia",scope:"boca"},
  {code:"81700291",description:"Artroscopia de ATM diagnóstica",category:"cirurgia",scope:"boca"},
  {code:"81700292",description:"Artroscopia de ATM terapêutica",category:"cirurgia",scope:"boca"},
  {code:"81700293",description:"Infiltração intra-articular de ATM",category:"cirurgia",scope:"boca"},
  {code:"81700294",description:"Viscossuplementação de ATM",category:"cirurgia",scope:"boca"},
  {code:"81700295",description:"Aplicação de toxina botulínica para DTM",category:"cirurgia",scope:"boca"},
  {code:"81700296",description:"Eminectomia",category:"cirurgia",scope:"boca"},
  {code:"81700297",description:"Condilectomia",category:"cirurgia",scope:"boca"},
  {code:"81700298",description:"Discectomia de ATM",category:"cirurgia",scope:"boca"},
  {code:"81700299",description:"Reposicionamento de disco articular",category:"cirurgia",scope:"boca"},
  
  // Cirurgia Ortognática
  {code:"81700300",description:"Osteotomia Le Fort I",category:"cirurgia",scope:"boca"},
  {code:"81700301",description:"Osteotomia sagital bilateral de mandíbula",category:"cirurgia",scope:"boca"},
  {code:"81700302",description:"Mentoplastia",category:"cirurgia",scope:"boca"},
  {code:"81700303",description:"Osteotomia segmentar de maxila",category:"cirurgia",scope:"boca"},
  {code:"81700304",description:"Osteotomia segmentar de mandíbula",category:"cirurgia",scope:"boca"},
  {code:"81700305",description:"Distração osteogênica maxilar",category:"cirurgia",scope:"boca"},
  {code:"81700306",description:"Distração osteogênica mandibular",category:"cirurgia",scope:"boca"},
  {code:"81700307",description:"Expansão rápida de maxila assistida cirurgicamente (SARPE)",category:"cirurgia",scope:"boca"},
  
  // Trauma Bucomaxilofacial
  {code:"81700310",description:"Redução de fratura dentoalveolar",category:"cirurgia",scope:"boca"},
  {code:"81700311",description:"Contenção de fratura dentoalveolar",category:"cirurgia",scope:"boca"},
  {code:"81700312",description:"Redução de fratura de mandíbula - fechada",category:"cirurgia",scope:"boca"},
  {code:"81700313",description:"Redução de fratura de mandíbula - aberta",category:"cirurgia",scope:"boca"},
  {code:"81700314",description:"Redução de fratura de maxila",category:"cirurgia",scope:"boca"},
  {code:"81700315",description:"Redução de fratura de zigoma",category:"cirurgia",scope:"boca"},
  {code:"81700316",description:"Redução de fratura de órbita",category:"cirurgia",scope:"boca"},
  {code:"81700317",description:"Bloqueio maxilomandibular",category:"cirurgia",scope:"boca"},
  {code:"81700318",description:"Fixação interna rígida com placa e parafuso",category:"cirurgia",scope:"boca"},
  {code:"81700319",description:"Remoção de material de osteossíntese",category:"cirurgia",scope:"boca"},
  
  // Procedimentos Complementares
  {code:"81700320",description:"Sutura de ferida intraoral",category:"cirurgia",scope:"boca"},
  {code:"81700321",description:"Sutura de ferida extraoral",category:"cirurgia",scope:"boca"},
  {code:"81700322",description:"Remoção de corpo estranho intraoral",category:"cirurgia",scope:"boca"},
  {code:"81700323",description:"Remoção de corpo estranho em tecido ósseo",category:"cirurgia",scope:"boca"},
  {code:"81700324",description:"Ulectomia/Ulotomia",category:"cirurgia",scope:"dente"},
  {code:"81700325",description:"Exposição de dente incluso para tracionamento",category:"cirurgia",scope:"dente"},
  {code:"81700326",description:"Colagem de acessório para tracionamento",category:"cirurgia",scope:"dente"},
  {code:"81700327",description:"Fenestração para erupção",category:"cirurgia",scope:"dente"},
  {code:"81700328",description:"Transplante dentário autógeno",category:"cirurgia",scope:"dente"},
  {code:"81700329",description:"Reimplante dentário",category:"cirurgia",scope:"dente"},
];
