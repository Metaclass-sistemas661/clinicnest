// TUSS Odontologia Expandida - Parte 9: Prevenção, Diagnóstico e Radiologia
// Categoria: Procedimentos preventivos, diagnósticos e de imagem

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_PREVENCAO_EXP: TussOdontoEntry[] = [
  // Consultas
  {code:"81000400",description:"Consulta odontológica inicial",category:"prevencao",scope:"boca"},
  {code:"81000401",description:"Consulta odontológica de retorno",category:"prevencao",scope:"boca"},
  {code:"81000402",description:"Consulta odontológica de urgência",category:"prevencao",scope:"boca"},
  {code:"81000403",description:"Consulta odontológica de emergência",category:"prevencao",scope:"boca"},
  {code:"81000404",description:"Consulta odontológica domiciliar",category:"prevencao",scope:"boca"},
  {code:"81000405",description:"Teleconsulta odontológica",category:"prevencao",scope:"boca"},
  {code:"81000406",description:"Consulta odontológica pré-operatória",category:"prevencao",scope:"boca"},
  {code:"81000407",description:"Consulta odontológica pós-operatória",category:"prevencao",scope:"boca"},
  {code:"81000408",description:"Avaliação odontológica para paciente especial",category:"prevencao",scope:"boca"},
  {code:"81000409",description:"Avaliação odontológica pré-tratamento oncológico",category:"prevencao",scope:"boca"},
  
  // Exame Clínico
  {code:"81000410",description:"Exame clínico odontológico completo",category:"prevencao",scope:"boca"},
  {code:"81000411",description:"Exame clínico odontológico simplificado",category:"prevencao",scope:"boca"},
  {code:"81000412",description:"Exame periodontal básico (PSR)",category:"prevencao",scope:"boca"},
  {code:"81000413",description:"Exame periodontal completo",category:"prevencao",scope:"boca"},
  {code:"81000414",description:"Avaliação de ATM",category:"prevencao",scope:"boca"},
  {code:"81000415",description:"Avaliação de oclusão",category:"prevencao",scope:"boca"},
  {code:"81000416",description:"Avaliação de mucosa oral",category:"prevencao",scope:"boca"},
  {code:"81000417",description:"Avaliação de glândulas salivares",category:"prevencao",scope:"boca"},
  {code:"81000418",description:"Teste de fluxo salivar",category:"prevencao",scope:"boca"},
  {code:"81000419",description:"Teste de pH salivar",category:"prevencao",scope:"boca"},
  
  // Profilaxia e Limpeza
  {code:"81000420",description:"Profilaxia dental com pasta profilática",category:"prevencao",scope:"boca"},
  {code:"81000421",description:"Profilaxia dental com jato de bicarbonato",category:"prevencao",scope:"boca"},
  {code:"81000422",description:"Profilaxia dental com ultrassom",category:"prevencao",scope:"boca"},
  {code:"81000423",description:"Remoção de manchas extrínsecas",category:"prevencao",scope:"boca"},
  {code:"81000424",description:"Remoção de cálculo supragengival",category:"prevencao",scope:"boca"},
  {code:"81000425",description:"Polimento coronário",category:"prevencao",scope:"boca"},
  {code:"81000426",description:"Polimento de restaurações",category:"prevencao",scope:"boca"},
  
  // Flúor
  {code:"81000430",description:"Aplicação tópica de flúor gel acidulado",category:"prevencao",scope:"boca"},
  {code:"81000431",description:"Aplicação tópica de flúor gel neutro",category:"prevencao",scope:"boca"},
  {code:"81000432",description:"Aplicação tópica de flúor espuma",category:"prevencao",scope:"boca"},
  {code:"81000433",description:"Aplicação tópica de flúor verniz",category:"prevencao",scope:"boca"},
  {code:"81000434",description:"Aplicação tópica de flúor verniz por dente",category:"prevencao",scope:"dente"},
  {code:"81000435",description:"Aplicação de flúor para hipersensibilidade",category:"prevencao",scope:"boca"},
  {code:"81000436",description:"Aplicação de flúor para remineralização",category:"prevencao",scope:"boca"},
  {code:"81000437",description:"Moldeira para flúor caseiro",category:"prevencao",scope:"boca"},
  
  // Selantes
  {code:"81000440",description:"Selante resinoso por dente",category:"prevencao",scope:"dente"},
  {code:"81000441",description:"Selante ionomérico por dente",category:"prevencao",scope:"dente"},
  {code:"81000442",description:"Selante flowable por dente",category:"prevencao",scope:"dente"},
  {code:"81000443",description:"Selante de fossas e fissuras - molar",category:"prevencao",scope:"dente"},
  {code:"81000444",description:"Selante de fossas e fissuras - pré-molar",category:"prevencao",scope:"dente"},
  {code:"81000445",description:"Selante preventivo em dente decíduo",category:"prevencao",scope:"dente"},
  {code:"81000446",description:"Reparo de selante",category:"prevencao",scope:"dente"},
  {code:"81000447",description:"Remoção de selante",category:"prevencao",scope:"dente"},
  
  // Educação em Saúde
  {code:"81000450",description:"Orientação de higiene oral individual",category:"prevencao",scope:"sessao"},
  {code:"81000451",description:"Orientação de higiene oral em grupo",category:"prevencao",scope:"sessao"},
  {code:"81000452",description:"Evidenciação de placa bacteriana",category:"prevencao",scope:"boca"},
  {code:"81000453",description:"Índice de placa visível",category:"prevencao",scope:"boca"},
  {code:"81000454",description:"Controle de placa bacteriana",category:"prevencao",scope:"boca"},
  {code:"81000455",description:"Orientação de uso de fio dental",category:"prevencao",scope:"sessao"},
  {code:"81000456",description:"Orientação de escovação supervisionada",category:"prevencao",scope:"sessao"},
  {code:"81000457",description:"Orientação de dieta não cariogênica",category:"prevencao",scope:"sessao"},
  {code:"81000458",description:"Programa preventivo individual",category:"prevencao",scope:"boca"},
  {code:"81000459",description:"Programa preventivo coletivo",category:"prevencao",scope:"sessao"},
  
  // Diagnóstico por Imagem - Radiografia Intraoral
  {code:"81000460",description:"Radiografia periapical",category:"prevencao",scope:"dente"},
  {code:"81000461",description:"Radiografia periapical - técnica do paralelismo",category:"prevencao",scope:"dente"},
  {code:"81000462",description:"Radiografia periapical - técnica da bissetriz",category:"prevencao",scope:"dente"},
  {code:"81000463",description:"Radiografia periapical digital",category:"prevencao",scope:"dente"},
  {code:"81000464",description:"Radiografia interproximal (bite-wing)",category:"prevencao",scope:"hemiarcada"},
  {code:"81000465",description:"Radiografia interproximal digital",category:"prevencao",scope:"hemiarcada"},
  {code:"81000466",description:"Radiografia oclusal superior",category:"prevencao",scope:"arcada"},
  {code:"81000467",description:"Radiografia oclusal inferior",category:"prevencao",scope:"arcada"},
  {code:"81000468",description:"Status radiográfico completo (14 periapicais)",category:"prevencao",scope:"boca"},
  {code:"81000469",description:"Status radiográfico completo (18 periapicais)",category:"prevencao",scope:"boca"},
  
  // Diagnóstico por Imagem - Radiografia Extraoral
  {code:"81000470",description:"Radiografia panorâmica",category:"prevencao",scope:"boca"},
  {code:"81000471",description:"Radiografia panorâmica digital",category:"prevencao",scope:"boca"},
  {code:"81000472",description:"Telerradiografia lateral",category:"prevencao",scope:"boca"},
  {code:"81000473",description:"Telerradiografia frontal (PA)",category:"prevencao",scope:"boca"},
  {code:"81000474",description:"Telerradiografia em 45 graus",category:"prevencao",scope:"boca"},
  {code:"81000475",description:"Radiografia carpal",category:"prevencao",scope:"boca"},
  {code:"81000476",description:"Radiografia de ATM - boca aberta/fechada",category:"prevencao",scope:"boca"},
  {code:"81000477",description:"Radiografia de seios da face",category:"prevencao",scope:"boca"},
  {code:"81000478",description:"Radiografia de Waters",category:"prevencao",scope:"boca"},
  {code:"81000479",description:"Radiografia de Towne",category:"prevencao",scope:"boca"},
  
  // Tomografia Computadorizada
  {code:"81000480",description:"Tomografia cone beam - região limitada",category:"prevencao",scope:"dente"},
  {code:"81000481",description:"Tomografia cone beam - maxila",category:"prevencao",scope:"arcada"},
  {code:"81000482",description:"Tomografia cone beam - mandíbula",category:"prevencao",scope:"arcada"},
  {code:"81000483",description:"Tomografia cone beam - face completa",category:"prevencao",scope:"boca"},
  {code:"81000484",description:"Tomografia cone beam - ATM bilateral",category:"prevencao",scope:"boca"},
  {code:"81000485",description:"Reconstrução 3D para implantes",category:"prevencao",scope:"boca"},
  {code:"81000486",description:"Planejamento virtual para implantes em tomografia",category:"prevencao",scope:"boca"},
  {code:"81000487",description:"Planejamento virtual para cirurgia ortognática",category:"prevencao",scope:"boca"},
  
  // Outros Exames de Imagem
  {code:"81000490",description:"Ressonância magnética de ATM",category:"prevencao",scope:"boca"},
  {code:"81000491",description:"Ultrassonografia de glândulas salivares",category:"prevencao",scope:"boca"},
  {code:"81000492",description:"Sialografia",category:"prevencao",scope:"boca"},
  {code:"81000493",description:"Cintilografia de glândulas salivares",category:"prevencao",scope:"boca"},
  
  // Modelos e Análises
  {code:"81000500",description:"Moldagem de estudo em alginato",category:"prevencao",scope:"arcada"},
  {code:"81000501",description:"Moldagem de estudo em silicone",category:"prevencao",scope:"arcada"},
  {code:"81000502",description:"Modelo de estudo em gesso",category:"prevencao",scope:"arcada"},
  {code:"81000503",description:"Modelo de estudo digital (escaneamento)",category:"prevencao",scope:"arcada"},
  {code:"81000504",description:"Análise de modelos",category:"prevencao",scope:"boca"},
  {code:"81000505",description:"Análise cefalométrica manual",category:"prevencao",scope:"boca"},
  {code:"81000506",description:"Análise cefalométrica computadorizada",category:"prevencao",scope:"boca"},
  {code:"81000507",description:"Traçado cefalométrico",category:"prevencao",scope:"boca"},
  {code:"81000508",description:"VTO (Visualização do Objetivo de Tratamento)",category:"prevencao",scope:"boca"},
  {code:"81000509",description:"Setup ortodôntico digital",category:"prevencao",scope:"boca"},
  
  // Fotografias e Documentação
  {code:"81000510",description:"Fotografia intraoral - série completa",category:"prevencao",scope:"boca"},
  {code:"81000511",description:"Fotografia intraoral - frontal",category:"prevencao",scope:"boca"},
  {code:"81000512",description:"Fotografia intraoral - lateral direita",category:"prevencao",scope:"boca"},
  {code:"81000513",description:"Fotografia intraoral - lateral esquerda",category:"prevencao",scope:"boca"},
  {code:"81000514",description:"Fotografia intraoral - oclusal superior",category:"prevencao",scope:"boca"},
  {code:"81000515",description:"Fotografia intraoral - oclusal inferior",category:"prevencao",scope:"boca"},
  {code:"81000516",description:"Fotografia extraoral - série completa",category:"prevencao",scope:"boca"},
  {code:"81000517",description:"Fotografia extraoral - frontal",category:"prevencao",scope:"boca"},
  {code:"81000518",description:"Fotografia extraoral - perfil",category:"prevencao",scope:"boca"},
  {code:"81000519",description:"Fotografia extraoral - sorriso",category:"prevencao",scope:"boca"},
  
  // Laudos e Pareceres
  {code:"81000520",description:"Laudo radiográfico",category:"prevencao",scope:"boca"},
  {code:"81000521",description:"Laudo tomográfico",category:"prevencao",scope:"boca"},
  {code:"81000522",description:"Parecer odontológico",category:"prevencao",scope:"boca"},
  {code:"81000523",description:"Atestado odontológico",category:"prevencao",scope:"boca"},
  {code:"81000524",description:"Relatório para convênio",category:"prevencao",scope:"boca"},
  {code:"81000525",description:"Plano de tratamento odontológico",category:"prevencao",scope:"boca"},
  {code:"81000526",description:"Orçamento odontológico",category:"prevencao",scope:"boca"},
  {code:"81000527",description:"Prontuário odontológico - abertura",category:"prevencao",scope:"boca"},
  {code:"81000528",description:"Termo de consentimento livre e esclarecido",category:"prevencao",scope:"boca"},
  {code:"81000529",description:"Documentação ortodôntica completa",category:"prevencao",scope:"boca"},
];
