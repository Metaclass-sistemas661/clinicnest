// TUSS Odontologia Expandida - Parte 3: Periodontia
// Categoria: Tratamentos periodontais e gengivais

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_PERIODONTIA_EXP: TussOdontoEntry[] = [
  // Diagnóstico Periodontal
  {code:"81300200",description:"Exame periodontal completo",category:"periodontia",scope:"boca"},
  {code:"81300201",description:"Sondagem periodontal - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300202",description:"Sondagem periodontal - boca toda",category:"periodontia",scope:"boca"},
  {code:"81300203",description:"Índice de placa visível",category:"periodontia",scope:"boca"},
  {code:"81300204",description:"Índice de sangramento gengival",category:"periodontia",scope:"boca"},
  {code:"81300205",description:"Índice periodontal comunitário (PSR)",category:"periodontia",scope:"boca"},
  {code:"81300206",description:"Periograma completo",category:"periodontia",scope:"boca"},
  {code:"81300207",description:"Radiografia periapical para diagnóstico periodontal",category:"periodontia",scope:"dente"},
  {code:"81300208",description:"Radiografia interproximal para diagnóstico periodontal",category:"periodontia",scope:"hemiarcada"},
  {code:"81300209",description:"Status radiográfico periodontal completo",category:"periodontia",scope:"boca"},
  
  // Terapia Periodontal Não Cirúrgica - Raspagem
  {code:"81300210",description:"Raspagem supragengival - por dente",category:"periodontia",scope:"dente"},
  {code:"81300211",description:"Raspagem supragengival - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300212",description:"Raspagem supragengival - boca toda",category:"periodontia",scope:"boca"},
  {code:"81300213",description:"Raspagem subgengival - por dente",category:"periodontia",scope:"dente"},
  {code:"81300214",description:"Raspagem subgengival - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300215",description:"Raspagem subgengival - por hemiarcada",category:"periodontia",scope:"hemiarcada"},
  {code:"81300216",description:"Raspagem subgengival - boca toda",category:"periodontia",scope:"boca"},
  {code:"81300217",description:"Alisamento radicular - por dente",category:"periodontia",scope:"dente"},
  {code:"81300218",description:"Alisamento radicular - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300219",description:"Alisamento radicular - por hemiarcada",category:"periodontia",scope:"hemiarcada"},
  
  // Raspagem e Alisamento Radicular Completo
  {code:"81300220",description:"RAR boca toda - sessão única (full mouth)",category:"periodontia",scope:"boca"},
  {code:"81300221",description:"RAR boca toda - 2 sessões",category:"periodontia",scope:"boca"},
  {code:"81300222",description:"RAR boca toda - 4 sessões (por quadrante)",category:"periodontia",scope:"boca"},
  {code:"81300223",description:"RAR com ultrassom - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300224",description:"RAR com ultrassom - boca toda",category:"periodontia",scope:"boca"},
  {code:"81300225",description:"RAR com curetas de Gracey - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300226",description:"RAR com instrumentação manual e ultrassônica",category:"periodontia",scope:"boca"},
  {code:"81300227",description:"Descontaminação full mouth em 24h",category:"periodontia",scope:"boca"},
  {code:"81300228",description:"Terapia periodontal de suporte (manutenção)",category:"periodontia",scope:"boca"},
  {code:"81300229",description:"Reavaliação periodontal",category:"periodontia",scope:"boca"},
  
  // Cirurgia Periodontal - Acesso
  {code:"81300230",description:"Cirurgia a retalho - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300231",description:"Cirurgia a retalho de Widman modificado",category:"periodontia",scope:"hemiarcada"},
  {code:"81300232",description:"Cirurgia a retalho com reposicionamento apical",category:"periodontia",scope:"hemiarcada"},
  {code:"81300233",description:"Cirurgia a retalho com osteoplastia",category:"periodontia",scope:"hemiarcada"},
  {code:"81300234",description:"Cirurgia a retalho com ostectomia",category:"periodontia",scope:"hemiarcada"},
  {code:"81300235",description:"Cirurgia óssea ressectiva",category:"periodontia",scope:"hemiarcada"},
  {code:"81300236",description:"Gengivectomia - por dente",category:"periodontia",scope:"dente"},
  {code:"81300237",description:"Gengivectomia - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300238",description:"Gengivectomia a laser",category:"periodontia",scope:"dente"},
  {code:"81300239",description:"Gengivoplastia - por dente",category:"periodontia",scope:"dente"},
  
  // Cirurgia Periodontal - Regenerativa
  {code:"81300240",description:"Regeneração tecidual guiada (RTG) - por defeito",category:"periodontia",scope:"dente"},
  {code:"81300241",description:"RTG com membrana reabsorvível",category:"periodontia",scope:"dente"},
  {code:"81300242",description:"RTG com membrana não reabsorvível",category:"periodontia",scope:"dente"},
  {code:"81300243",description:"RTG com membrana de colágeno",category:"periodontia",scope:"dente"},
  {code:"81300244",description:"Enxerto ósseo autógeno periodontal",category:"periodontia",scope:"dente"},
  {code:"81300245",description:"Enxerto ósseo alógeno periodontal",category:"periodontia",scope:"dente"},
  {code:"81300246",description:"Enxerto ósseo xenógeno periodontal",category:"periodontia",scope:"dente"},
  {code:"81300247",description:"Enxerto ósseo sintético periodontal",category:"periodontia",scope:"dente"},
  {code:"81300248",description:"Proteínas derivadas da matriz do esmalte (Emdogain)",category:"periodontia",scope:"dente"},
  {code:"81300249",description:"Fatores de crescimento (PRF/PRP) periodontal",category:"periodontia",scope:"dente"},
  
  // Cirurgia Mucogengival - Recobrimento Radicular
  {code:"81300250",description:"Enxerto gengival livre - por dente",category:"periodontia",scope:"dente"},
  {code:"81300251",description:"Enxerto gengival livre - múltiplos dentes",category:"periodontia",scope:"hemiarcada"},
  {code:"81300252",description:"Enxerto de tecido conjuntivo subepitelial",category:"periodontia",scope:"dente"},
  {code:"81300253",description:"Enxerto de tecido conjuntivo - técnica de túnel",category:"periodontia",scope:"dente"},
  {code:"81300254",description:"Retalho posicionado coronalmente",category:"periodontia",scope:"dente"},
  {code:"81300255",description:"Retalho posicionado lateralmente",category:"periodontia",scope:"dente"},
  {code:"81300256",description:"Retalho semilunar",category:"periodontia",scope:"dente"},
  {code:"81300257",description:"Técnica de envelope",category:"periodontia",scope:"dente"},
  {code:"81300258",description:"Matriz dérmica acelular (Alloderm)",category:"periodontia",scope:"dente"},
  {code:"81300259",description:"Matriz de colágeno xenógena (Mucograft)",category:"periodontia",scope:"dente"},
  
  // Cirurgia Mucogengival - Aumento de Gengiva
  {code:"81300260",description:"Aumento de gengiva inserida - por dente",category:"periodontia",scope:"dente"},
  {code:"81300261",description:"Aumento de gengiva inserida - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300262",description:"Aprofundamento de vestíbulo",category:"periodontia",scope:"hemiarcada"},
  {code:"81300263",description:"Vestibuloplastia",category:"periodontia",scope:"arcada"},
  {code:"81300264",description:"Frenectomia labial superior",category:"periodontia",scope:"boca"},
  {code:"81300265",description:"Frenectomia labial inferior",category:"periodontia",scope:"boca"},
  {code:"81300266",description:"Frenectomia lingual",category:"periodontia",scope:"boca"},
  {code:"81300267",description:"Frenotomia",category:"periodontia",scope:"boca"},
  {code:"81300268",description:"Bridectomia",category:"periodontia",scope:"boca"},
  
  // Aumento de Coroa Clínica
  {code:"81300270",description:"Aumento de coroa clínica - por dente",category:"periodontia",scope:"dente"},
  {code:"81300271",description:"Aumento de coroa clínica estético - por dente",category:"periodontia",scope:"dente"},
  {code:"81300272",description:"Aumento de coroa clínica funcional - por dente",category:"periodontia",scope:"dente"},
  {code:"81300273",description:"Aumento de coroa clínica com osteotomia",category:"periodontia",scope:"dente"},
  {code:"81300274",description:"Aumento de coroa clínica com gengivectomia",category:"periodontia",scope:"dente"},
  {code:"81300275",description:"Aumento de coroa clínica a laser",category:"periodontia",scope:"dente"},
  {code:"81300276",description:"Extrusão ortodôntica forçada",category:"periodontia",scope:"dente"},
  {code:"81300277",description:"Tracionamento ortodôntico",category:"periodontia",scope:"dente"},
  
  // Tratamento de Defeitos Ósseos
  {code:"81300280",description:"Tratamento de defeito ósseo vertical",category:"periodontia",scope:"dente"},
  {code:"81300281",description:"Tratamento de defeito ósseo horizontal",category:"periodontia",scope:"dente"},
  {code:"81300282",description:"Tratamento de defeito de furca grau I",category:"periodontia",scope:"dente"},
  {code:"81300283",description:"Tratamento de defeito de furca grau II",category:"periodontia",scope:"dente"},
  {code:"81300284",description:"Tratamento de defeito de furca grau III",category:"periodontia",scope:"dente"},
  {code:"81300285",description:"Tunelização de furca",category:"periodontia",scope:"dente"},
  {code:"81300286",description:"Plastia de furca",category:"periodontia",scope:"dente"},
  {code:"81300287",description:"Odontoplastia de furca",category:"periodontia",scope:"dente"},
  {code:"81300288",description:"Hemisecção para tratamento de furca",category:"periodontia",scope:"dente"},
  {code:"81300289",description:"Amputação radicular para tratamento de furca",category:"periodontia",scope:"dente"},
  
  // Cirurgia Plástica Periodontal
  {code:"81300290",description:"Correção de sorriso gengival",category:"periodontia",scope:"boca"},
  {code:"81300291",description:"Nivelamento gengival estético",category:"periodontia",scope:"arcada"},
  {code:"81300292",description:"Reconstrução de papila interdental",category:"periodontia",scope:"dente"},
  {code:"81300293",description:"Aumento de papila com ácido hialurônico",category:"periodontia",scope:"dente"},
  {code:"81300294",description:"Despigmentação gengival",category:"periodontia",scope:"arcada"},
  {code:"81300295",description:"Despigmentação gengival a laser",category:"periodontia",scope:"arcada"},
  {code:"81300296",description:"Remoção de tatuagem de amálgama",category:"periodontia",scope:"dente"},
  {code:"81300297",description:"Correção de defeito de rebordo - Classe I",category:"periodontia",scope:"dente"},
  {code:"81300298",description:"Correção de defeito de rebordo - Classe II",category:"periodontia",scope:"dente"},
  {code:"81300299",description:"Correção de defeito de rebordo - Classe III",category:"periodontia",scope:"dente"},
  
  // Tratamento de Periimplantite
  {code:"81300300",description:"Diagnóstico de periimplantite",category:"periodontia",scope:"dente"},
  {code:"81300301",description:"Tratamento de mucosite periimplantar",category:"periodontia",scope:"dente"},
  {code:"81300302",description:"Tratamento de periimplantite - não cirúrgico",category:"periodontia",scope:"dente"},
  {code:"81300303",description:"Tratamento de periimplantite - cirúrgico",category:"periodontia",scope:"dente"},
  {code:"81300304",description:"Descontaminação de superfície de implante",category:"periodontia",scope:"dente"},
  {code:"81300305",description:"Descontaminação com laser",category:"periodontia",scope:"dente"},
  {code:"81300306",description:"Descontaminação com jato de ar abrasivo",category:"periodontia",scope:"dente"},
  {code:"81300307",description:"Regeneração óssea periimplantar",category:"periodontia",scope:"dente"},
  {code:"81300308",description:"Implantoplastia",category:"periodontia",scope:"dente"},
  
  // Terapias Adjuvantes
  {code:"81300310",description:"Aplicação local de antimicrobiano (Periochip)",category:"periodontia",scope:"dente"},
  {code:"81300311",description:"Aplicação local de antibiótico (Arestin)",category:"periodontia",scope:"dente"},
  {code:"81300312",description:"Irrigação subgengival com clorexidina",category:"periodontia",scope:"boca"},
  {code:"81300313",description:"Terapia fotodinâmica periodontal",category:"periodontia",scope:"boca"},
  {code:"81300314",description:"Laser de baixa potência periodontal",category:"periodontia",scope:"boca"},
  {code:"81300315",description:"Laser de alta potência periodontal",category:"periodontia",scope:"boca"},
  {code:"81300316",description:"Ozônioterapia periodontal",category:"periodontia",scope:"boca"},
  {code:"81300317",description:"Probióticos periodontais",category:"periodontia",scope:"boca"},
  {code:"81300318",description:"Modulação da resposta do hospedeiro",category:"periodontia",scope:"boca"},
  
  // Procedimentos Complementares
  {code:"81300320",description:"Contenção periodontal - por dente",category:"periodontia",scope:"dente"},
  {code:"81300321",description:"Contenção periodontal - por sextante",category:"periodontia",scope:"hemiarcada"},
  {code:"81300322",description:"Esplintagem periodontal com resina",category:"periodontia",scope:"hemiarcada"},
  {code:"81300323",description:"Esplintagem periodontal com fibra de vidro",category:"periodontia",scope:"hemiarcada"},
  {code:"81300324",description:"Ajuste oclusal por desgaste seletivo",category:"periodontia",scope:"boca"},
  {code:"81300325",description:"Placa oclusal para bruxismo",category:"periodontia",scope:"boca"},
  {code:"81300326",description:"Cunha distal",category:"periodontia",scope:"dente"},
  {code:"81300327",description:"Cunha proximal",category:"periodontia",scope:"dente"},
  {code:"81300328",description:"Coleta de área doadora palatina",category:"periodontia",scope:"boca"},
  {code:"81300329",description:"Coleta de área doadora tuberosidade",category:"periodontia",scope:"boca"},
];
