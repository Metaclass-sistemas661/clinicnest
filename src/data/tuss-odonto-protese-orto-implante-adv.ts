// TUSS Odontologia Expandida - Parte 15: Prótese, Ortodontia e Implante Avançados
// Categoria: Procedimentos protéticos, ortodônticos e de implante avançados

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_PROTESE_ADV: TussOdontoEntry[] = [
  // Prótese Total Avançada
  {code:"81400320",description:"Prótese total superior com dentes de porcelana",category:"protese",scope:"arcada"},
  {code:"81400321",description:"Prótese total inferior com dentes de porcelana",category:"protese",scope:"arcada"},
  {code:"81400322",description:"Prótese total superior com base metálica",category:"protese",scope:"arcada"},
  {code:"81400323",description:"Prótese total inferior com base metálica",category:"protese",scope:"arcada"},
  {code:"81400324",description:"Prótese total superior com base flexível",category:"protese",scope:"arcada"},
  {code:"81400325",description:"Prótese total inferior com base flexível",category:"protese",scope:"arcada"},
  {code:"81400326",description:"Prótese total com sistema de sucção BPS",category:"protese",scope:"arcada"},
  {code:"81400327",description:"Prótese total com sistema Ivocap",category:"protese",scope:"arcada"},
  {code:"81400328",description:"Prótese total com sistema SR Phonares",category:"protese",scope:"arcada"},
  {code:"81400329",description:"Prótese total digital CAD/CAM",category:"protese",scope:"arcada"},
  
  // Prótese Parcial Removível Avançada
  {code:"81400330",description:"PPR com estrutura em titânio",category:"protese",scope:"arcada"},
  {code:"81400331",description:"PPR com estrutura em cromo-cobalto premium",category:"protese",scope:"arcada"},
  {code:"81400332",description:"PPR com encaixe de precisão Ceka",category:"protese",scope:"arcada"},
  {code:"81400333",description:"PPR com encaixe de precisão Rhein",category:"protese",scope:"arcada"},
  {code:"81400334",description:"PPR com encaixe de precisão Preci-Clix",category:"protese",scope:"arcada"},
  {code:"81400335",description:"PPR com encaixe de precisão ERA",category:"protese",scope:"arcada"},
  {code:"81400336",description:"PPR com sistema de barra Dolder",category:"protese",scope:"arcada"},
  {code:"81400337",description:"PPR com sistema de barra Hader",category:"protese",scope:"arcada"},
  {code:"81400338",description:"PPR flexível Valplast",category:"protese",scope:"arcada"},
  {code:"81400339",description:"PPR flexível Flexite",category:"protese",scope:"arcada"},
  
  // Prótese Fixa Avançada
  {code:"81400340",description:"Prótese fixa de 3 elementos em zircônia monolítica",category:"protese",scope:"dente"},
  {code:"81400341",description:"Prótese fixa de 4 elementos em zircônia monolítica",category:"protese",scope:"dente"},
  {code:"81400342",description:"Prótese fixa de 5+ elementos em zircônia monolítica",category:"protese",scope:"dente"},
  {code:"81400343",description:"Prótese fixa de 3 elementos em zircônia estratificada",category:"protese",scope:"dente"},
  {code:"81400344",description:"Prótese fixa de 4 elementos em zircônia estratificada",category:"protese",scope:"dente"},
  {code:"81400345",description:"Prótese fixa de 5+ elementos em zircônia estratificada",category:"protese",scope:"dente"},
  {code:"81400346",description:"Prótese fixa de 3 elementos em dissilicato de lítio",category:"protese",scope:"dente"},
  {code:"81400347",description:"Prótese fixa adesiva cantilever",category:"protese",scope:"dente"},
  {code:"81400348",description:"Prótese fixa adesiva com fibra de vidro",category:"protese",scope:"dente"},
  {code:"81400349",description:"Prótese fixa adesiva com fibra de polietileno",category:"protese",scope:"dente"},
  
  // Prótese sobre Implante Avançada
  {code:"81400350",description:"Coroa sobre implante com pilar personalizado CAD/CAM",category:"protese",scope:"dente"},
  {code:"81400351",description:"Coroa sobre implante com pilar de zircônia CAD/CAM",category:"protese",scope:"dente"},
  {code:"81400352",description:"Coroa sobre implante com pilar de titânio CAD/CAM",category:"protese",scope:"dente"},
  {code:"81400353",description:"Coroa sobre implante com pilar angulado 15°",category:"protese",scope:"dente"},
  {code:"81400354",description:"Coroa sobre implante com pilar angulado 25°",category:"protese",scope:"dente"},
  {code:"81400355",description:"Coroa sobre implante com pilar angulado 35°",category:"protese",scope:"dente"},
  {code:"81400356",description:"Protocolo sobre implante em zircônia monolítica",category:"protese",scope:"arcada"},
  {code:"81400357",description:"Protocolo sobre implante em zircônia estratificada",category:"protese",scope:"arcada"},
  {code:"81400358",description:"Protocolo sobre implante em PMMA fresado",category:"protese",scope:"arcada"},
  {code:"81400359",description:"Protocolo sobre implante em PEEK",category:"protese",scope:"arcada"},
  
  // Overdenture Avançada
  {code:"81400360",description:"Overdenture com sistema Locator",category:"protese",scope:"arcada"},
  {code:"81400361",description:"Overdenture com sistema Locator R-Tx",category:"protese",scope:"arcada"},
  {code:"81400362",description:"Overdenture com sistema Novaloc",category:"protese",scope:"arcada"},
  {code:"81400363",description:"Overdenture com sistema CM LOC",category:"protese",scope:"arcada"},
  {code:"81400364",description:"Overdenture com sistema Equator",category:"protese",scope:"arcada"},
  {code:"81400365",description:"Overdenture com barra fresada",category:"protese",scope:"arcada"},
  {code:"81400366",description:"Overdenture com barra Dolder",category:"protese",scope:"arcada"},
  {code:"81400367",description:"Overdenture com barra Hader",category:"protese",scope:"arcada"},
  {code:"81400368",description:"Overdenture com barra CAD/CAM",category:"protese",scope:"arcada"},
  {code:"81400369",description:"Overdenture híbrida (barra + attachments)",category:"protese",scope:"arcada"},
];

export const TUSS_ODONTO_ORTODONTIA_ADV: TussOdontoEntry[] = [
  // Ortodontia Digital
  {code:"81500340",description:"Escaneamento intraoral para ortodontia",category:"ortodontia",scope:"boca"},
  {code:"81500341",description:"Planejamento digital com ClinCheck",category:"ortodontia",scope:"boca"},
  {code:"81500342",description:"Planejamento digital com 3Shape",category:"ortodontia",scope:"boca"},
  {code:"81500343",description:"Planejamento digital com Dolphin",category:"ortodontia",scope:"boca"},
  {code:"81500344",description:"Planejamento digital com Nemoceph",category:"ortodontia",scope:"boca"},
  {code:"81500345",description:"Setup virtual com impressão 3D",category:"ortodontia",scope:"boca"},
  {code:"81500346",description:"Simulação de resultado com software",category:"ortodontia",scope:"boca"},
  {code:"81500347",description:"Sobreposição cefalométrica digital",category:"ortodontia",scope:"boca"},
  {code:"81500348",description:"Análise de modelos digitais",category:"ortodontia",scope:"boca"},
  {code:"81500349",description:"Monitoramento remoto de tratamento",category:"ortodontia",scope:"sessao"},
  
  // Alinhadores Avançados
  {code:"81500350",description:"Alinhadores Invisalign Comprehensive",category:"ortodontia",scope:"boca"},
  {code:"81500351",description:"Alinhadores Invisalign Moderate",category:"ortodontia",scope:"boca"},
  {code:"81500352",description:"Alinhadores Invisalign First (crianças)",category:"ortodontia",scope:"boca"},
  {code:"81500353",description:"Alinhadores Invisalign Go",category:"ortodontia",scope:"boca"},
  {code:"81500354",description:"Alinhadores SureSmile",category:"ortodontia",scope:"boca"},
  {code:"81500355",description:"Alinhadores Spark",category:"ortodontia",scope:"boca"},
  {code:"81500356",description:"Alinhadores 3M Clarity",category:"ortodontia",scope:"boca"},
  {code:"81500357",description:"Alinhadores Angel Align",category:"ortodontia",scope:"boca"},
  {code:"81500358",description:"Alinhadores nacionais personalizados",category:"ortodontia",scope:"boca"},
  {code:"81500359",description:"Refinamento adicional com alinhadores",category:"ortodontia",scope:"boca"},
  
  // Aparelhos Especiais
  {code:"81500360",description:"Aparelho Herbst com bandas",category:"ortodontia",scope:"boca"},
  {code:"81500361",description:"Aparelho Herbst com splints",category:"ortodontia",scope:"boca"},
  {code:"81500362",description:"Aparelho Herbst com coroas de aço",category:"ortodontia",scope:"boca"},
  {code:"81500363",description:"Aparelho Forsus com molas",category:"ortodontia",scope:"boca"},
  {code:"81500364",description:"Aparelho Jasper Jumper",category:"ortodontia",scope:"boca"},
  {code:"81500365",description:"Aparelho Carriere Motion",category:"ortodontia",scope:"boca"},
  {code:"81500366",description:"Aparelho Carriere SLX",category:"ortodontia",scope:"boca"},
  {code:"81500367",description:"Aparelho Pendulum",category:"ortodontia",scope:"boca"},
  {code:"81500368",description:"Aparelho Distal Jet",category:"ortodontia",scope:"boca"},
  {code:"81500369",description:"Aparelho First Class",category:"ortodontia",scope:"boca"},
  
  // Ancoragem Esquelética Avançada
  {code:"81500370",description:"Mini-implante ortodôntico autorosqueável",category:"ortodontia",scope:"dente"},
  {code:"81500371",description:"Mini-implante ortodôntico autoperfurante",category:"ortodontia",scope:"dente"},
  {code:"81500372",description:"Mini-implante ortodôntico com cabeça especial",category:"ortodontia",scope:"dente"},
  {code:"81500373",description:"Mini-placa ortodôntica em Y",category:"ortodontia",scope:"boca"},
  {code:"81500374",description:"Mini-placa ortodôntica em L",category:"ortodontia",scope:"boca"},
  {code:"81500375",description:"Mini-placa ortodôntica em T",category:"ortodontia",scope:"boca"},
  {code:"81500376",description:"Parafuso de ancoragem palatino (MSE)",category:"ortodontia",scope:"boca"},
  {code:"81500377",description:"Parafuso de ancoragem zigomático",category:"ortodontia",scope:"boca"},
  {code:"81500378",description:"Sistema de ancoragem com elásticos",category:"ortodontia",scope:"boca"},
  {code:"81500379",description:"Sistema de ancoragem com molas",category:"ortodontia",scope:"boca"},
  
  // Expansão Avançada
  {code:"81500380",description:"MARPE (Miniscrew-Assisted Rapid Palatal Expansion)",category:"ortodontia",scope:"arcada"},
  {code:"81500381",description:"SARPE (Surgically Assisted Rapid Palatal Expansion)",category:"ortodontia",scope:"arcada"},
  {code:"81500382",description:"Expansor híbrido (dento-suportado e ósseo)",category:"ortodontia",scope:"arcada"},
  {code:"81500383",description:"Expansor com ancoragem esquelética bilateral",category:"ortodontia",scope:"arcada"},
  {code:"81500384",description:"Expansor MSE com 4 mini-implantes",category:"ortodontia",scope:"arcada"},
  {code:"81500385",description:"Expansor Hyrax modificado",category:"ortodontia",scope:"arcada"},
  {code:"81500386",description:"Expansor Haas modificado",category:"ortodontia",scope:"arcada"},
  {code:"81500387",description:"Expansor com cobertura oclusal",category:"ortodontia",scope:"arcada"},
  {code:"81500388",description:"Expansor mandibular Schwarz",category:"ortodontia",scope:"arcada"},
  {code:"81500389",description:"Expansor mandibular com ancoragem",category:"ortodontia",scope:"arcada"},
];

export const TUSS_ODONTO_IMPLANTE_ADV: TussOdontoEntry[] = [
  // Implantes Especiais
  {code:"81600320",description:"Implante com superfície tratada SLA",category:"implantodontia",scope:"dente"},
  {code:"81600321",description:"Implante com superfície tratada SLActive",category:"implantodontia",scope:"dente"},
  {code:"81600322",description:"Implante com superfície tratada TiUnite",category:"implantodontia",scope:"dente"},
  {code:"81600323",description:"Implante com superfície tratada Osseotite",category:"implantodontia",scope:"dente"},
  {code:"81600324",description:"Implante com superfície tratada RBM",category:"implantodontia",scope:"dente"},
  {code:"81600325",description:"Implante com superfície tratada HA",category:"implantodontia",scope:"dente"},
  {code:"81600326",description:"Implante de corpo único (one-piece)",category:"implantodontia",scope:"dente"},
  {code:"81600327",description:"Implante de plataforma switching",category:"implantodontia",scope:"dente"},
  {code:"81600328",description:"Implante de conexão cônica",category:"implantodontia",scope:"dente"},
  {code:"81600329",description:"Implante de conexão hexagonal",category:"implantodontia",scope:"dente"},
  
  // Cirurgia Guiada
  {code:"81600330",description:"Cirurgia guiada com guia estereolitográfico",category:"implantodontia",scope:"arcada"},
  {code:"81600331",description:"Cirurgia guiada com guia fresado",category:"implantodontia",scope:"arcada"},
  {code:"81600332",description:"Cirurgia guiada com guia impresso 3D",category:"implantodontia",scope:"arcada"},
  {code:"81600333",description:"Cirurgia guiada flapless",category:"implantodontia",scope:"dente"},
  {code:"81600334",description:"Cirurgia guiada com carga imediata",category:"implantodontia",scope:"dente"},
  {code:"81600335",description:"Cirurgia guiada com provisório imediato",category:"implantodontia",scope:"dente"},
  {code:"81600336",description:"Cirurgia guiada para All-on-4",category:"implantodontia",scope:"arcada"},
  {code:"81600337",description:"Cirurgia guiada para All-on-6",category:"implantodontia",scope:"arcada"},
  {code:"81600338",description:"Cirurgia guiada para zigomático",category:"implantodontia",scope:"boca"},
  {code:"81600339",description:"Navegação cirúrgica em tempo real",category:"implantodontia",scope:"boca"},
  
  // Enxertos Avançados
  {code:"81600340",description:"Enxerto em bloco de mento",category:"implantodontia",scope:"boca"},
  {code:"81600341",description:"Enxerto em bloco de ramo",category:"implantodontia",scope:"boca"},
  {code:"81600342",description:"Enxerto em bloco de crista ilíaca",category:"implantodontia",scope:"boca"},
  {code:"81600343",description:"Enxerto em bloco de calvária",category:"implantodontia",scope:"boca"},
  {code:"81600344",description:"Enxerto em bloco de tíbia",category:"implantodontia",scope:"boca"},
  {code:"81600345",description:"Enxerto em bloco alógeno",category:"implantodontia",scope:"boca"},
  {code:"81600346",description:"Enxerto em bloco xenógeno",category:"implantodontia",scope:"boca"},
  {code:"81600347",description:"Enxerto com técnica de Khoury",category:"implantodontia",scope:"boca"},
  {code:"81600348",description:"Enxerto com técnica de tent pole",category:"implantodontia",scope:"boca"},
  {code:"81600349",description:"Enxerto com técnica de sausage",category:"implantodontia",scope:"boca"},
  
  // Levantamento de Seio Avançado
  {code:"81600350",description:"Levantamento de seio com técnica de Caldwell-Luc",category:"implantodontia",scope:"boca"},
  {code:"81600351",description:"Levantamento de seio com técnica de Tatum",category:"implantodontia",scope:"boca"},
  {code:"81600352",description:"Levantamento de seio com técnica de Summers",category:"implantodontia",scope:"dente"},
  {code:"81600353",description:"Levantamento de seio com técnica de Cosci",category:"implantodontia",scope:"dente"},
  {code:"81600354",description:"Levantamento de seio com balão",category:"implantodontia",scope:"boca"},
  {code:"81600355",description:"Levantamento de seio com piezoelétrico",category:"implantodontia",scope:"boca"},
  {code:"81600356",description:"Levantamento de seio com kit específico",category:"implantodontia",scope:"boca"},
  {code:"81600357",description:"Levantamento de seio com PRF",category:"implantodontia",scope:"boca"},
  {code:"81600358",description:"Levantamento de seio com BMP",category:"implantodontia",scope:"boca"},
  {code:"81600359",description:"Tratamento de comunicação buco-sinusal",category:"implantodontia",scope:"boca"},
  
  // Regeneração Óssea Avançada
  {code:"81600360",description:"ROG com técnica de GBR clássica",category:"implantodontia",scope:"dente"},
  {code:"81600361",description:"ROG com técnica de sausage",category:"implantodontia",scope:"dente"},
  {code:"81600362",description:"ROG com técnica de tent pole",category:"implantodontia",scope:"dente"},
  {code:"81600363",description:"ROG com técnica de shell",category:"implantodontia",scope:"dente"},
  {code:"81600364",description:"ROG com técnica de split crest",category:"implantodontia",scope:"dente"},
  {code:"81600365",description:"ROG com técnica de ridge expansion",category:"implantodontia",scope:"dente"},
  {code:"81600366",description:"ROG com técnica de ridge splitting",category:"implantodontia",scope:"dente"},
  {code:"81600367",description:"ROG com tela de titânio customizada",category:"implantodontia",scope:"dente"},
  {code:"81600368",description:"ROG com malha de titânio impressa 3D",category:"implantodontia",scope:"dente"},
  {code:"81600369",description:"ROG com membrana de PTFE reforçada",category:"implantodontia",scope:"dente"},
];
