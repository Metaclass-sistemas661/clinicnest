// TUSS Odontologia Expandida - Parte 16: Odontopediatria e Especialidades Avançadas
// Categoria: Procedimentos pediátricos e especialidades avançadas

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_PEDIATRIA_ADV: TussOdontoEntry[] = [
  // Prevenção Avançada
  {code:"81800300",description:"Programa preventivo para bebês (0-3 anos)",category:"odontopediatria",scope:"boca"},
  {code:"81800301",description:"Programa preventivo para pré-escolares (3-6 anos)",category:"odontopediatria",scope:"boca"},
  {code:"81800302",description:"Programa preventivo para escolares (6-12 anos)",category:"odontopediatria",scope:"boca"},
  {code:"81800303",description:"Programa preventivo para adolescentes (12-18 anos)",category:"odontopediatria",scope:"boca"},
  {code:"81800304",description:"Avaliação de risco de cárie infantil",category:"odontopediatria",scope:"boca"},
  {code:"81800305",description:"Protocolo CAMBRA pediátrico",category:"odontopediatria",scope:"boca"},
  {code:"81800306",description:"Aplicação de diamino fluoreto de prata",category:"odontopediatria",scope:"dente"},
  {code:"81800307",description:"Aplicação de cariostático",category:"odontopediatria",scope:"dente"},
  {code:"81800308",description:"Selante preventivo resinoso",category:"odontopediatria",scope:"dente"},
  {code:"81800309",description:"Selante preventivo ionomérico",category:"odontopediatria",scope:"dente"},
  
  // Restaurações Pediátricas Avançadas
  {code:"81800310",description:"Restauração ART em dente decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800311",description:"Restauração com técnica de Hall",category:"odontopediatria",scope:"dente"},
  {code:"81800312",description:"Restauração com strip crown",category:"odontopediatria",scope:"dente"},
  {code:"81800313",description:"Coroa de aço com face estética",category:"odontopediatria",scope:"dente"},
  {code:"81800314",description:"Coroa de zircônia pediátrica",category:"odontopediatria",scope:"dente"},
  {code:"81800315",description:"Coroa de resina pré-fabricada",category:"odontopediatria",scope:"dente"},
  {code:"81800316",description:"Restauração com compômero",category:"odontopediatria",scope:"dente"},
  {code:"81800317",description:"Restauração com giômero",category:"odontopediatria",scope:"dente"},
  {code:"81800318",description:"Restauração com ionômero de vidro bioativo",category:"odontopediatria",scope:"dente"},
  {code:"81800319",description:"Restauração com ionômero de vidro reforçado",category:"odontopediatria",scope:"dente"},
  
  // Tratamento Pulpar Pediátrico Avançado
  {code:"81800320",description:"Pulpotomia com MTA branco",category:"odontopediatria",scope:"dente"},
  {code:"81800321",description:"Pulpotomia com MTA cinza",category:"odontopediatria",scope:"dente"},
  {code:"81800322",description:"Pulpotomia com Biodentine",category:"odontopediatria",scope:"dente"},
  {code:"81800323",description:"Pulpotomia com TheraCal",category:"odontopediatria",scope:"dente"},
  {code:"81800324",description:"Pulpotomia com laser",category:"odontopediatria",scope:"dente"},
  {code:"81800325",description:"Pulpotomia com eletrocirurgia",category:"odontopediatria",scope:"dente"},
  {code:"81800326",description:"Pulpectomia com pasta CTZ",category:"odontopediatria",scope:"dente"},
  {code:"81800327",description:"Pulpectomia com pasta Guedes-Pinto",category:"odontopediatria",scope:"dente"},
  {code:"81800328",description:"Pulpectomia com pasta de hidróxido de cálcio",category:"odontopediatria",scope:"dente"},
  {code:"81800329",description:"Pulpectomia com pasta iodoformada",category:"odontopediatria",scope:"dente"},
  
  // Ortodontia Interceptiva Avançada
  {code:"81800330",description:"Aparelho de Frankel I",category:"odontopediatria",scope:"boca"},
  {code:"81800331",description:"Aparelho de Frankel II",category:"odontopediatria",scope:"boca"},
  {code:"81800332",description:"Aparelho de Frankel III",category:"odontopediatria",scope:"boca"},
  {code:"81800333",description:"Aparelho de Bionator de Balters",category:"odontopediatria",scope:"boca"},
  {code:"81800334",description:"Aparelho de Klammt",category:"odontopediatria",scope:"boca"},
  {code:"81800335",description:"Aparelho de Simões Network",category:"odontopediatria",scope:"boca"},
  {code:"81800336",description:"Aparelho de Planas",category:"odontopediatria",scope:"boca"},
  {code:"81800337",description:"Twin Block modificado",category:"odontopediatria",scope:"boca"},
  {code:"81800338",description:"Aparelho de Herbst pediátrico",category:"odontopediatria",scope:"boca"},
  {code:"81800339",description:"Máscara facial de Delaire pediátrica",category:"odontopediatria",scope:"boca"},
  
  // Trauma Dental Pediátrico Avançado
  {code:"81800340",description:"Tratamento de fratura de esmalte em decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800341",description:"Tratamento de fratura de esmalte-dentina em decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800342",description:"Tratamento de fratura complicada em decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800343",description:"Tratamento de fratura corono-radicular em decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800344",description:"Tratamento de fratura radicular em decíduo",category:"odontopediatria",scope:"dente"},
  {code:"81800345",description:"Tratamento de concussão em permanente jovem",category:"odontopediatria",scope:"dente"},
  {code:"81800346",description:"Tratamento de subluxação em permanente jovem",category:"odontopediatria",scope:"dente"},
  {code:"81800347",description:"Tratamento de luxação em permanente jovem",category:"odontopediatria",scope:"dente"},
  {code:"81800348",description:"Tratamento de avulsão em permanente jovem",category:"odontopediatria",scope:"dente"},
  {code:"81800349",description:"Contenção flexível para trauma pediátrico",category:"odontopediatria",scope:"dente"},
  
  // Sedação Pediátrica Avançada
  {code:"81800350",description:"Sedação com óxido nitroso - titulação",category:"odontopediatria",scope:"sessao"},
  {code:"81800351",description:"Sedação oral com midazolam",category:"odontopediatria",scope:"sessao"},
  {code:"81800352",description:"Sedação oral com hidrato de cloral",category:"odontopediatria",scope:"sessao"},
  {code:"81800353",description:"Sedação oral com hidroxizina",category:"odontopediatria",scope:"sessao"},
  {code:"81800354",description:"Sedação combinada (oral + N2O)",category:"odontopediatria",scope:"sessao"},
  {code:"81800355",description:"Sedação intranasal com midazolam",category:"odontopediatria",scope:"sessao"},
  {code:"81800356",description:"Sedação retal com midazolam",category:"odontopediatria",scope:"sessao"},
  {code:"81800357",description:"Monitorização durante sedação pediátrica",category:"odontopediatria",scope:"sessao"},
  {code:"81800358",description:"Recuperação pós-sedação",category:"odontopediatria",scope:"sessao"},
  {code:"81800359",description:"Anestesia geral para tratamento odontológico pediátrico",category:"odontopediatria",scope:"sessao"},
];

export const TUSS_ODONTO_ESPECIALIDADES_ADV: TussOdontoEntry[] = [
  // Estomatologia Avançada
  {code:"81900260",description:"Biópsia com punch",category:"estomatologia",scope:"boca"},
  {code:"81900261",description:"Biópsia com bisturi circular",category:"estomatologia",scope:"boca"},
  {code:"81900262",description:"Biópsia com laser",category:"estomatologia",scope:"boca"},
  {code:"81900263",description:"Citologia esfoliativa com escova",category:"estomatologia",scope:"boca"},
  {code:"81900264",description:"Citologia esfoliativa com espátula",category:"estomatologia",scope:"boca"},
  {code:"81900265",description:"Teste de azul de toluidina",category:"estomatologia",scope:"boca"},
  {code:"81900266",description:"Teste de lugol",category:"estomatologia",scope:"boca"},
  {code:"81900267",description:"Fluorescência para detecção de lesões",category:"estomatologia",scope:"boca"},
  {code:"81900268",description:"Quimioluminescência para detecção de lesões",category:"estomatologia",scope:"boca"},
  {code:"81900269",description:"Autofluorescência para detecção de lesões",category:"estomatologia",scope:"boca"},
  
  // DTM Avançada
  {code:"81910250",description:"Eletromiografia de superfície mastigatória",category:"dtm",scope:"boca"},
  {code:"81910251",description:"Eletrognatografia",category:"dtm",scope:"boca"},
  {code:"81910252",description:"Cinesiografia mandibular",category:"dtm",scope:"boca"},
  {code:"81910253",description:"Sonografia de ATM",category:"dtm",scope:"boca"},
  {code:"81910254",description:"Termografia de ATM",category:"dtm",scope:"boca"},
  {code:"81910255",description:"Algometria de pressão",category:"dtm",scope:"boca"},
  {code:"81910256",description:"Teste de provocação de dor",category:"dtm",scope:"boca"},
  {code:"81910257",description:"Avaliação postural para DTM",category:"dtm",scope:"boca"},
  {code:"81910258",description:"Avaliação de hábitos parafuncionais",category:"dtm",scope:"boca"},
  {code:"81910259",description:"Protocolo RDC/TMD completo",category:"dtm",scope:"boca"},
  
  // Odontologia Hospitalar Avançada
  {code:"81930240",description:"Avaliação odontológica em UTI neonatal",category:"hospitalar",scope:"boca"},
  {code:"81930241",description:"Avaliação odontológica em UTI pediátrica",category:"hospitalar",scope:"boca"},
  {code:"81930242",description:"Avaliação odontológica em UTI adulto",category:"hospitalar",scope:"boca"},
  {code:"81930243",description:"Protocolo de higiene oral em UTI",category:"hospitalar",scope:"boca"},
  {code:"81930244",description:"Prevenção de pneumonia associada à ventilação",category:"hospitalar",scope:"boca"},
  {code:"81930245",description:"Tratamento de mucosite grau I",category:"hospitalar",scope:"boca"},
  {code:"81930246",description:"Tratamento de mucosite grau II",category:"hospitalar",scope:"boca"},
  {code:"81930247",description:"Tratamento de mucosite grau III",category:"hospitalar",scope:"boca"},
  {code:"81930248",description:"Tratamento de mucosite grau IV",category:"hospitalar",scope:"boca"},
  {code:"81930249",description:"Laserterapia preventiva para mucosite",category:"hospitalar",scope:"boca"},
  
  // Odontologia do Trabalho Avançada
  {code:"81940220",description:"Exame odontológico para trabalho em altura",category:"trabalho",scope:"boca"},
  {code:"81940221",description:"Exame odontológico para trabalho confinado",category:"trabalho",scope:"boca"},
  {code:"81940222",description:"Exame odontológico para trabalho subaquático",category:"trabalho",scope:"boca"},
  {code:"81940223",description:"Exame odontológico para trabalho em pressão",category:"trabalho",scope:"boca"},
  {code:"81940224",description:"Exame odontológico para trabalho com radiação",category:"trabalho",scope:"boca"},
  {code:"81940225",description:"Exame odontológico para trabalho com químicos",category:"trabalho",scope:"boca"},
  {code:"81940226",description:"Programa de saúde bucal ocupacional",category:"trabalho",scope:"sessao"},
  {code:"81940227",description:"Levantamento epidemiológico ocupacional",category:"trabalho",scope:"sessao"},
  {code:"81940228",description:"Campanha de saúde bucal empresarial",category:"trabalho",scope:"sessao"},
  {code:"81940229",description:"Consultoria em saúde bucal ocupacional",category:"trabalho",scope:"sessao"},
  
  // Odontologia Legal Avançada
  {code:"81950220",description:"Identificação odontológica post-mortem",category:"legal",scope:"boca"},
  {code:"81950221",description:"Identificação odontológica em desastres",category:"legal",scope:"boca"},
  {code:"81950222",description:"Estimativa de idade por método de Demirjian",category:"legal",scope:"boca"},
  {code:"81950223",description:"Estimativa de idade por método de Nolla",category:"legal",scope:"boca"},
  {code:"81950224",description:"Estimativa de idade por método de Willems",category:"legal",scope:"boca"},
  {code:"81950225",description:"Estimativa de idade por terceiros molares",category:"legal",scope:"boca"},
  {code:"81950226",description:"Análise de marcas de mordida em pele",category:"legal",scope:"boca"},
  {code:"81950227",description:"Análise de marcas de mordida em alimentos",category:"legal",scope:"boca"},
  {code:"81950228",description:"Análise de marcas de mordida em objetos",category:"legal",scope:"boca"},
  {code:"81950229",description:"Coleta de DNA de polpa dental",category:"legal",scope:"boca"},
  
  // Odontologia Desportiva Avançada
  {code:"81960230",description:"Protetor bucal tipo III com inserção rígida",category:"desportiva",scope:"boca"},
  {code:"81960231",description:"Protetor bucal tipo III com válvula de respiração",category:"desportiva",scope:"boca"},
  {code:"81960232",description:"Protetor bucal tipo III com proteção labial",category:"desportiva",scope:"boca"},
  {code:"81960233",description:"Protetor bucal tipo III para ortodontia",category:"desportiva",scope:"boca"},
  {code:"81960234",description:"Protetor bucal tipo III para prótese",category:"desportiva",scope:"boca"},
  {code:"81960235",description:"Protetor bucal tipo III para implante",category:"desportiva",scope:"boca"},
  {code:"81960236",description:"Protetor bucal com monitoramento de impacto",category:"desportiva",scope:"boca"},
  {code:"81960237",description:"Protetor bucal com sensor de força",category:"desportiva",scope:"boca"},
  {code:"81960238",description:"Avaliação de performance mastigatória",category:"desportiva",scope:"boca"},
  {code:"81960239",description:"Otimização oclusal para performance",category:"desportiva",scope:"boca"},
  
  // Terapias Complementares Avançadas
  {code:"81970300",description:"Laserterapia de baixa potência - biomodulação",category:"complementar",scope:"sessao"},
  {code:"81970301",description:"Laserterapia de baixa potência - analgesia",category:"complementar",scope:"sessao"},
  {code:"81970302",description:"Laserterapia de baixa potência - anti-inflamatório",category:"complementar",scope:"sessao"},
  {code:"81970303",description:"Laserterapia de baixa potência - cicatrização",category:"complementar",scope:"sessao"},
  {code:"81970304",description:"Laserterapia de baixa potência - regeneração",category:"complementar",scope:"sessao"},
  {code:"81970305",description:"Terapia fotodinâmica com azul de metileno",category:"complementar",scope:"sessao"},
  {code:"81970306",description:"Terapia fotodinâmica com azul de toluidina",category:"complementar",scope:"sessao"},
  {code:"81970307",description:"Terapia fotodinâmica com curcumina",category:"complementar",scope:"sessao"},
  {code:"81970308",description:"Ozônioterapia com gás ozonizado",category:"complementar",scope:"sessao"},
  {code:"81970309",description:"Ozônioterapia com água ozonizada",category:"complementar",scope:"sessao"},
];
