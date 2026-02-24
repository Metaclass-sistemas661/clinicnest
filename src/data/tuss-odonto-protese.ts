// TUSS Odontologia Expandida - Parte 5: Prótese Dentária
// Categoria: Próteses fixas, removíveis e sobre implantes

import type { TussOdontoEntry } from "./tuss-odonto-dentistica";

export const TUSS_ODONTO_PROTESE_EXP: TussOdontoEntry[] = [
  // Prótese Total
  {code:"81400200",description:"Prótese total superior convencional",category:"protese",scope:"arcada"},
  {code:"81400201",description:"Prótese total inferior convencional",category:"protese",scope:"arcada"},
  {code:"81400202",description:"Prótese total superior caracterizada",category:"protese",scope:"arcada"},
  {code:"81400203",description:"Prótese total inferior caracterizada",category:"protese",scope:"arcada"},
  {code:"81400204",description:"Prótese total imediata superior",category:"protese",scope:"arcada"},
  {code:"81400205",description:"Prótese total imediata inferior",category:"protese",scope:"arcada"},
  {code:"81400206",description:"Prótese total com dentes importados",category:"protese",scope:"arcada"},
  {code:"81400207",description:"Prótese total com base metálica",category:"protese",scope:"arcada"},
  {code:"81400208",description:"Prótese total com base flexível",category:"protese",scope:"arcada"},
  {code:"81400209",description:"Prótese total duplicada",category:"protese",scope:"arcada"},
  
  // Prótese Parcial Removível
  {code:"81400210",description:"PPR superior com grampos simples",category:"protese",scope:"arcada"},
  {code:"81400211",description:"PPR inferior com grampos simples",category:"protese",scope:"arcada"},
  {code:"81400212",description:"PPR superior com grampos estéticos",category:"protese",scope:"arcada"},
  {code:"81400213",description:"PPR inferior com grampos estéticos",category:"protese",scope:"arcada"},
  {code:"81400214",description:"PPR com estrutura metálica fundida",category:"protese",scope:"arcada"},
  {code:"81400215",description:"PPR com estrutura em cromo-cobalto",category:"protese",scope:"arcada"},
  {code:"81400216",description:"PPR com estrutura em titânio",category:"protese",scope:"arcada"},
  {code:"81400217",description:"PPR flexível (Flexite/Valplast)",category:"protese",scope:"arcada"},
  {code:"81400218",description:"PPR com encaixe de precisão",category:"protese",scope:"arcada"},
  {code:"81400219",description:"PPR com encaixe semi-precisão",category:"protese",scope:"arcada"},
  
  // Prótese Parcial Removível - Tipos Especiais
  {code:"81400220",description:"PPR provisória em acrílico",category:"protese",scope:"arcada"},
  {code:"81400221",description:"PPR tipo Roach",category:"protese",scope:"arcada"},
  {code:"81400222",description:"PPR com apoio em barra",category:"protese",scope:"arcada"},
  {code:"81400223",description:"PPR com retentor extracoronário",category:"protese",scope:"arcada"},
  {code:"81400224",description:"PPR com retentor intracoronário",category:"protese",scope:"arcada"},
  {code:"81400225",description:"PPR Kennedy classe I",category:"protese",scope:"arcada"},
  {code:"81400226",description:"PPR Kennedy classe II",category:"protese",scope:"arcada"},
  {code:"81400227",description:"PPR Kennedy classe III",category:"protese",scope:"arcada"},
  {code:"81400228",description:"PPR Kennedy classe IV",category:"protese",scope:"arcada"},
  {code:"81400229",description:"Placa de Hawley com dentes",category:"protese",scope:"arcada"},
  
  // Prótese Fixa Unitária
  {code:"81400230",description:"Coroa metalocerâmica unitária",category:"protese",scope:"dente"},
  {code:"81400231",description:"Coroa metalocerâmica com ombro cerâmico",category:"protese",scope:"dente"},
  {code:"81400232",description:"Coroa de porcelana pura (metal-free)",category:"protese",scope:"dente"},
  {code:"81400233",description:"Coroa de zircônia monolítica",category:"protese",scope:"dente"},
  {code:"81400234",description:"Coroa de zircônia estratificada",category:"protese",scope:"dente"},
  {code:"81400235",description:"Coroa de dissilicato de lítio (e.max)",category:"protese",scope:"dente"},
  {code:"81400236",description:"Coroa de cerômero",category:"protese",scope:"dente"},
  {code:"81400237",description:"Coroa metálica fundida",category:"protese",scope:"dente"},
  {code:"81400238",description:"Coroa metálica em ouro",category:"protese",scope:"dente"},
  {code:"81400239",description:"Coroa provisória de longa duração",category:"protese",scope:"dente"},
  
  // Prótese Fixa Múltipla
  {code:"81400240",description:"Prótese fixa de 3 elementos metalocerâmica",category:"protese",scope:"dente"},
  {code:"81400241",description:"Prótese fixa de 4 elementos metalocerâmica",category:"protese",scope:"dente"},
  {code:"81400242",description:"Prótese fixa de 5 elementos metalocerâmica",category:"protese",scope:"dente"},
  {code:"81400243",description:"Prótese fixa de 6+ elementos metalocerâmica",category:"protese",scope:"dente"},
  {code:"81400244",description:"Prótese fixa de 3 elementos metal-free",category:"protese",scope:"dente"},
  {code:"81400245",description:"Prótese fixa de 4 elementos metal-free",category:"protese",scope:"dente"},
  {code:"81400246",description:"Prótese fixa de 5+ elementos metal-free",category:"protese",scope:"dente"},
  {code:"81400247",description:"Prótese fixa de zircônia - 3 elementos",category:"protese",scope:"dente"},
  {code:"81400248",description:"Prótese fixa de zircônia - 4+ elementos",category:"protese",scope:"dente"},
  {code:"81400249",description:"Prótese fixa adesiva (Maryland)",category:"protese",scope:"dente"},
  
  // Prótese sobre Implante - Unitária
  {code:"81400250",description:"Coroa sobre implante metalocerâmica",category:"protese",scope:"dente"},
  {code:"81400251",description:"Coroa sobre implante metal-free",category:"protese",scope:"dente"},
  {code:"81400252",description:"Coroa sobre implante de zircônia",category:"protese",scope:"dente"},
  {code:"81400253",description:"Coroa sobre implante cimentada",category:"protese",scope:"dente"},
  {code:"81400254",description:"Coroa sobre implante parafusada",category:"protese",scope:"dente"},
  {code:"81400255",description:"Coroa sobre implante com pilar personalizado",category:"protese",scope:"dente"},
  {code:"81400256",description:"Coroa sobre implante com pilar de zircônia",category:"protese",scope:"dente"},
  {code:"81400257",description:"Coroa sobre implante com pilar de titânio",category:"protese",scope:"dente"},
  {code:"81400258",description:"Coroa provisória sobre implante",category:"protese",scope:"dente"},
  {code:"81400259",description:"Coroa provisória sobre implante - carga imediata",category:"protese",scope:"dente"},
  
  // Prótese sobre Implante - Múltipla
  {code:"81400260",description:"Prótese fixa sobre implante - 3 elementos",category:"protese",scope:"dente"},
  {code:"81400261",description:"Prótese fixa sobre implante - 4 elementos",category:"protese",scope:"dente"},
  {code:"81400262",description:"Prótese fixa sobre implante - 5+ elementos",category:"protese",scope:"dente"},
  {code:"81400263",description:"Protocolo sobre implante - arcada superior",category:"protese",scope:"arcada"},
  {code:"81400264",description:"Protocolo sobre implante - arcada inferior",category:"protese",scope:"arcada"},
  {code:"81400265",description:"Protocolo em resina sobre implante",category:"protese",scope:"arcada"},
  {code:"81400266",description:"Protocolo em cerâmica sobre implante",category:"protese",scope:"arcada"},
  {code:"81400267",description:"Protocolo em zircônia sobre implante",category:"protese",scope:"arcada"},
  {code:"81400268",description:"Protocolo híbrido (metal + resina)",category:"protese",scope:"arcada"},
  {code:"81400269",description:"Protocolo com gengiva artificial",category:"protese",scope:"arcada"},
  
  // Overdenture
  {code:"81400270",description:"Overdenture sobre implante - 2 implantes",category:"protese",scope:"arcada"},
  {code:"81400271",description:"Overdenture sobre implante - 4 implantes",category:"protese",scope:"arcada"},
  {code:"81400272",description:"Overdenture com sistema de barra",category:"protese",scope:"arcada"},
  {code:"81400273",description:"Overdenture com sistema O-ring",category:"protese",scope:"arcada"},
  {code:"81400274",description:"Overdenture com sistema Locator",category:"protese",scope:"arcada"},
  {code:"81400275",description:"Overdenture com sistema bola",category:"protese",scope:"arcada"},
  {code:"81400276",description:"Overdenture sobre raízes naturais",category:"protese",scope:"arcada"},
  {code:"81400277",description:"Substituição de componente de retenção",category:"protese",scope:"dente"},
  
  // Componentes e Pilares
  {code:"81400280",description:"Pilar protético de titânio",category:"protese",scope:"dente"},
  {code:"81400281",description:"Pilar protético de zircônia",category:"protese",scope:"dente"},
  {code:"81400282",description:"Pilar protético personalizado (UCLA)",category:"protese",scope:"dente"},
  {code:"81400283",description:"Pilar angulado",category:"protese",scope:"dente"},
  {code:"81400284",description:"Pilar multiunit",category:"protese",scope:"dente"},
  {code:"81400285",description:"Cilindro protético",category:"protese",scope:"dente"},
  {code:"81400286",description:"Parafuso protético",category:"protese",scope:"dente"},
  {code:"81400287",description:"Tampa de cicatrização",category:"protese",scope:"dente"},
  {code:"81400288",description:"Transferente de moldagem",category:"protese",scope:"dente"},
  {code:"81400289",description:"Análogo de implante",category:"protese",scope:"dente"},
  
  // Manutenção e Reparos
  {code:"81400290",description:"Reembasamento de prótese total - direto",category:"protese",scope:"arcada"},
  {code:"81400291",description:"Reembasamento de prótese total - indireto",category:"protese",scope:"arcada"},
  {code:"81400292",description:"Reembasamento de PPR",category:"protese",scope:"arcada"},
  {code:"81400293",description:"Reembasamento macio (soft liner)",category:"protese",scope:"arcada"},
  {code:"81400294",description:"Conserto de prótese - fratura simples",category:"protese",scope:"arcada"},
  {code:"81400295",description:"Conserto de prótese - fratura múltipla",category:"protese",scope:"arcada"},
  {code:"81400296",description:"Acréscimo de dente em prótese",category:"protese",scope:"dente"},
  {code:"81400297",description:"Acréscimo de grampo em PPR",category:"protese",scope:"dente"},
  {code:"81400298",description:"Substituição de dente em prótese",category:"protese",scope:"dente"},
  {code:"81400299",description:"Polimento e ajuste de prótese",category:"protese",scope:"arcada"},
  
  // Placas Oclusais
  {code:"81400300",description:"Placa miorrelaxante rígida",category:"protese",scope:"boca"},
  {code:"81400301",description:"Placa miorrelaxante resiliente",category:"protese",scope:"boca"},
  {code:"81400302",description:"Placa de mordida anterior",category:"protese",scope:"boca"},
  {code:"81400303",description:"Placa de mordida posterior",category:"protese",scope:"boca"},
  {code:"81400304",description:"Placa estabilizadora de Michigan",category:"protese",scope:"boca"},
  {code:"81400305",description:"Placa reposicionadora de mandíbula",category:"protese",scope:"boca"},
  {code:"81400306",description:"Placa para apneia do sono",category:"protese",scope:"boca"},
  {code:"81400307",description:"Placa para ronco",category:"protese",scope:"boca"},
  {code:"81400308",description:"Ajuste de placa oclusal",category:"protese",scope:"sessao"},
  {code:"81400309",description:"Conserto de placa oclusal",category:"protese",scope:"boca"},
  
  // Procedimentos Laboratoriais
  {code:"81400310",description:"Moldagem de estudo",category:"protese",scope:"arcada"},
  {code:"81400311",description:"Moldagem de trabalho com moldeira individual",category:"protese",scope:"arcada"},
  {code:"81400312",description:"Moldagem funcional",category:"protese",scope:"arcada"},
  {code:"81400313",description:"Registro de mordida",category:"protese",scope:"boca"},
  {code:"81400314",description:"Montagem em articulador semi-ajustável",category:"protese",scope:"boca"},
  {code:"81400315",description:"Prova de estrutura metálica",category:"protese",scope:"arcada"},
  {code:"81400316",description:"Prova de dentes",category:"protese",scope:"arcada"},
  {code:"81400317",description:"Prova de cerâmica (biscoito)",category:"protese",scope:"dente"},
  {code:"81400318",description:"Enceramento diagnóstico",category:"protese",scope:"arcada"},
  {code:"81400319",description:"Guia cirúrgico para implante",category:"protese",scope:"arcada"},
];
