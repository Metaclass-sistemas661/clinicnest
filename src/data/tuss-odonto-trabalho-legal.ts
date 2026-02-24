// TUSS Odontologia Expandida - Parte 11: Odontologia do Trabalho, Legal, Desportiva e Complementares
// Categoria: Especialidades adicionais e procedimentos complementares

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_TRABALHO: TussOdontoEntry[] = [
  // Exames Ocupacionais
  {code:"81940200",description:"Exame odontológico admissional",category:"trabalho",scope:"boca"},
  {code:"81940201",description:"Exame odontológico periódico",category:"trabalho",scope:"boca"},
  {code:"81940202",description:"Exame odontológico demissional",category:"trabalho",scope:"boca"},
  {code:"81940203",description:"Exame odontológico de retorno ao trabalho",category:"trabalho",scope:"boca"},
  {code:"81940204",description:"Exame odontológico de mudança de função",category:"trabalho",scope:"boca"},
  {code:"81940205",description:"Avaliação de aptidão para trabalho em altura",category:"trabalho",scope:"boca"},
  {code:"81940206",description:"Avaliação de aptidão para trabalho confinado",category:"trabalho",scope:"boca"},
  {code:"81940207",description:"Avaliação de aptidão para mergulho",category:"trabalho",scope:"boca"},
  
  // Laudos e Pareceres
  {code:"81940210",description:"Atestado de saúde ocupacional odontológico",category:"trabalho",scope:"boca"},
  {code:"81940211",description:"Laudo odontológico ocupacional",category:"trabalho",scope:"boca"},
  {code:"81940212",description:"Parecer técnico odontológico",category:"trabalho",scope:"boca"},
  {code:"81940213",description:"Relatório de condições bucais",category:"trabalho",scope:"boca"},
  {code:"81940214",description:"Programa de saúde bucal empresarial",category:"trabalho",scope:"sessao"},
  {code:"81940215",description:"Levantamento epidemiológico bucal",category:"trabalho",scope:"sessao"},
  {code:"81940216",description:"Campanha de saúde bucal",category:"trabalho",scope:"sessao"},
  {code:"81940217",description:"Palestra de saúde bucal",category:"trabalho",scope:"sessao"},
];

export const TUSS_ODONTO_LEGAL: TussOdontoEntry[] = [
  // Identificação
  {code:"81950200",description:"Exame odontolegal",category:"legal",scope:"boca"},
  {code:"81950201",description:"Identificação odontológica",category:"legal",scope:"boca"},
  {code:"81950202",description:"Comparação de registros odontológicos",category:"legal",scope:"boca"},
  {code:"81950203",description:"Estimativa de idade pelo desenvolvimento dental",category:"legal",scope:"boca"},
  {code:"81950204",description:"Estimativa de idade por radiografia",category:"legal",scope:"boca"},
  {code:"81950205",description:"Análise de marcas de mordida",category:"legal",scope:"boca"},
  {code:"81950206",description:"Coleta de material para DNA",category:"legal",scope:"boca"},
  
  // Perícias
  {code:"81950210",description:"Perícia odontológica judicial",category:"legal",scope:"boca"},
  {code:"81950211",description:"Perícia odontológica extrajudicial",category:"legal",scope:"boca"},
  {code:"81950212",description:"Perícia de erro odontológico",category:"legal",scope:"boca"},
  {code:"81950213",description:"Avaliação de dano estético bucal",category:"legal",scope:"boca"},
  {code:"81950214",description:"Avaliação de dano funcional bucal",category:"legal",scope:"boca"},
  {code:"81950215",description:"Avaliação de sequela de trauma",category:"legal",scope:"boca"},
  {code:"81950216",description:"Laudo pericial odontológico",category:"legal",scope:"boca"},
  {code:"81950217",description:"Parecer técnico pericial",category:"legal",scope:"boca"},
  {code:"81950218",description:"Assistência técnica odontológica",category:"legal",scope:"boca"},
];

export const TUSS_ODONTO_DESPORTIVA: TussOdontoEntry[] = [
  // Avaliação
  {code:"81960200",description:"Avaliação odontológica de atleta",category:"desportiva",scope:"boca"},
  {code:"81960201",description:"Exame odontológico pré-competição",category:"desportiva",scope:"boca"},
  {code:"81960202",description:"Avaliação de risco de trauma dental",category:"desportiva",scope:"boca"},
  {code:"81960203",description:"Avaliação de ATM em atleta",category:"desportiva",scope:"boca"},
  {code:"81960204",description:"Avaliação de oclusão em atleta",category:"desportiva",scope:"boca"},
  
  // Protetores Bucais
  {code:"81960210",description:"Protetor bucal tipo I (estoque)",category:"desportiva",scope:"boca"},
  {code:"81960211",description:"Protetor bucal tipo II (termoplástico)",category:"desportiva",scope:"boca"},
  {code:"81960212",description:"Protetor bucal tipo III (personalizado)",category:"desportiva",scope:"boca"},
  {code:"81960213",description:"Protetor bucal laminado multicamadas",category:"desportiva",scope:"boca"},
  {code:"81960214",description:"Protetor bucal com inserção rígida",category:"desportiva",scope:"boca"},
  {code:"81960215",description:"Protetor bucal para ortodontia",category:"desportiva",scope:"boca"},
  {code:"81960216",description:"Ajuste de protetor bucal",category:"desportiva",scope:"sessao"},
  {code:"81960217",description:"Substituição de protetor bucal",category:"desportiva",scope:"boca"},
  
  // Trauma Esportivo
  {code:"81960220",description:"Atendimento de urgência em evento esportivo",category:"desportiva",scope:"boca"},
  {code:"81960221",description:"Tratamento de trauma dental em atleta",category:"desportiva",scope:"dente"},
  {code:"81960222",description:"Reimplante de dente avulsionado em atleta",category:"desportiva",scope:"dente"},
  {code:"81960223",description:"Contenção de dente traumatizado",category:"desportiva",scope:"dente"},
  {code:"81960224",description:"Restauração de emergência em atleta",category:"desportiva",scope:"dente"},
];

export const TUSS_ODONTO_COMPLEMENTARES: TussOdontoEntry[] = [
  // Anestesia
  {code:"81970200",description:"Anestesia local infiltrativa",category:"complementar",scope:"dente"},
  {code:"81970201",description:"Anestesia local por bloqueio regional",category:"complementar",scope:"hemiarcada"},
  {code:"81970202",description:"Bloqueio do nervo alveolar inferior",category:"complementar",scope:"hemiarcada"},
  {code:"81970203",description:"Bloqueio do nervo alveolar superior posterior",category:"complementar",scope:"hemiarcada"},
  {code:"81970204",description:"Bloqueio do nervo alveolar superior médio",category:"complementar",scope:"hemiarcada"},
  {code:"81970205",description:"Bloqueio do nervo alveolar superior anterior",category:"complementar",scope:"hemiarcada"},
  {code:"81970206",description:"Bloqueio do nervo nasopalatino",category:"complementar",scope:"arcada"},
  {code:"81970207",description:"Bloqueio do nervo palatino maior",category:"complementar",scope:"hemiarcada"},
  {code:"81970208",description:"Bloqueio do nervo mentoniano",category:"complementar",scope:"hemiarcada"},
  {code:"81970209",description:"Bloqueio do nervo bucal",category:"complementar",scope:"hemiarcada"},
  
  // Sedação
  {code:"81970210",description:"Sedação consciente com óxido nitroso",category:"complementar",scope:"sessao"},
  {code:"81970211",description:"Sedação consciente oral",category:"complementar",scope:"sessao"},
  {code:"81970212",description:"Sedação consciente endovenosa",category:"complementar",scope:"sessao"},
  {code:"81970213",description:"Monitorização durante sedação",category:"complementar",scope:"sessao"},
  {code:"81970214",description:"Anestesia geral para procedimento odontológico",category:"complementar",scope:"sessao"},
  
  // Laserterapia
  {code:"81970220",description:"Laserterapia de baixa potência - bioestimulação",category:"complementar",scope:"sessao"},
  {code:"81970221",description:"Laserterapia de baixa potência - analgesia",category:"complementar",scope:"sessao"},
  {code:"81970222",description:"Laserterapia de baixa potência - anti-inflamatório",category:"complementar",scope:"sessao"},
  {code:"81970223",description:"Laserterapia de baixa potência - cicatrização",category:"complementar",scope:"sessao"},
  {code:"81970224",description:"Laserterapia de alta potência - cirurgia",category:"complementar",scope:"sessao"},
  {code:"81970225",description:"Laserterapia de alta potência - gengivectomia",category:"complementar",scope:"dente"},
  {code:"81970226",description:"Laserterapia de alta potência - frenectomia",category:"complementar",scope:"boca"},
  {code:"81970227",description:"Laserterapia para hipersensibilidade",category:"complementar",scope:"dente"},
  {code:"81970228",description:"Laserterapia para herpes",category:"complementar",scope:"boca"},
  {code:"81970229",description:"Laserterapia para afta",category:"complementar",scope:"boca"},
  
  // Terapia Fotodinâmica
  {code:"81970230",description:"Terapia fotodinâmica antimicrobiana (aPDT)",category:"complementar",scope:"sessao"},
  {code:"81970231",description:"PDT para descontaminação periodontal",category:"complementar",scope:"boca"},
  {code:"81970232",description:"PDT para descontaminação endodôntica",category:"complementar",scope:"dente"},
  {code:"81970233",description:"PDT para descontaminação periimplantar",category:"complementar",scope:"dente"},
  
  // Ozônioterapia
  {code:"81970240",description:"Ozônioterapia odontológica - gás",category:"complementar",scope:"sessao"},
  {code:"81970241",description:"Ozônioterapia odontológica - água ozonizada",category:"complementar",scope:"sessao"},
  {code:"81970242",description:"Ozônioterapia odontológica - óleo ozonizado",category:"complementar",scope:"sessao"},
  {code:"81970243",description:"Ozônioterapia para cárie incipiente",category:"complementar",scope:"dente"},
  {code:"81970244",description:"Ozônioterapia para descontaminação",category:"complementar",scope:"boca"},
  
  // Acupuntura
  {code:"81970250",description:"Acupuntura odontológica - sessão",category:"complementar",scope:"sessao"},
  {code:"81970251",description:"Acupuntura para analgesia odontológica",category:"complementar",scope:"sessao"},
  {code:"81970252",description:"Acupuntura para DTM",category:"complementar",scope:"sessao"},
  {code:"81970253",description:"Acupuntura para xerostomia",category:"complementar",scope:"sessao"},
  {code:"81970254",description:"Acupuntura para ansiedade odontológica",category:"complementar",scope:"sessao"},
  {code:"81970255",description:"Auriculoterapia odontológica",category:"complementar",scope:"sessao"},
  
  // Homeopatia
  {code:"81970260",description:"Consulta odontológica homeopática",category:"complementar",scope:"boca"},
  {code:"81970261",description:"Prescrição homeopática odontológica",category:"complementar",scope:"boca"},
  {code:"81970262",description:"Acompanhamento homeopático odontológico",category:"complementar",scope:"sessao"},
  
  // Fitoterapia
  {code:"81970270",description:"Prescrição fitoterápica odontológica",category:"complementar",scope:"boca"},
  {code:"81970271",description:"Bochecho fitoterápico",category:"complementar",scope:"boca"},
  {code:"81970272",description:"Aplicação tópica de fitoterápico",category:"complementar",scope:"boca"},
  
  // Hipnose
  {code:"81970280",description:"Hipnose odontológica - sessão",category:"complementar",scope:"sessao"},
  {code:"81970281",description:"Hipnose para controle de ansiedade",category:"complementar",scope:"sessao"},
  {code:"81970282",description:"Hipnose para controle de dor",category:"complementar",scope:"sessao"},
  {code:"81970283",description:"Hipnose para controle de reflexo de vômito",category:"complementar",scope:"sessao"},
  
  // Materiais e Insumos Especiais
  {code:"81970290",description:"Uso de microscópio operatório - adicional",category:"complementar",scope:"sessao"},
  {code:"81970291",description:"Uso de magnificação (lupa) - adicional",category:"complementar",scope:"sessao"},
  {code:"81970292",description:"Uso de scanner intraoral",category:"complementar",scope:"arcada"},
  {code:"81970293",description:"Uso de CAD/CAM chairside",category:"complementar",scope:"dente"},
  {code:"81970294",description:"Impressão 3D de modelo",category:"complementar",scope:"arcada"},
  {code:"81970295",description:"Impressão 3D de guia cirúrgico",category:"complementar",scope:"arcada"},
  {code:"81970296",description:"Planejamento digital do sorriso (DSD)",category:"complementar",scope:"boca"},
  {code:"81970297",description:"Simulação de resultado estético",category:"complementar",scope:"boca"},
  {code:"81970298",description:"Fotografia com protocolo padronizado",category:"complementar",scope:"boca"},
  {code:"81970299",description:"Vídeo intraoral diagnóstico",category:"complementar",scope:"boca"},
];
