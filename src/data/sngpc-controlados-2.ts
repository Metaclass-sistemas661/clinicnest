// SNGPC - Medicamentos Controlados (Portaria 344/98) - Parte 2
// Listas B1, B2

import { MedicamentoControlado } from './sngpc-controlados';

// Lista B1 - Psicotrópicos
export const LISTA_B1: MedicamentoControlado[] = [
  {codigo:"B1-001",nome:"Alobarbital",lista:"B1"},
  {codigo:"B1-002",nome:"Alprazolam",lista:"B1",concentracoes:["0,25mg","0,5mg","1mg","2mg"],formas:["Comprimido"]},
  {codigo:"B1-003",nome:"Amobarbital",lista:"B1"},
  {codigo:"B1-004",nome:"Aprobarbital",lista:"B1"},
  {codigo:"B1-005",nome:"Barbexaclona",lista:"B1"},
  {codigo:"B1-006",nome:"Barbital",lista:"B1"},
  {codigo:"B1-007",nome:"Bentazepam",lista:"B1"},
  {codigo:"B1-008",nome:"Bromazepam",lista:"B1",concentracoes:["3mg","6mg"],formas:["Comprimido"]},
  {codigo:"B1-009",nome:"Brotizolam",lista:"B1"},
  {codigo:"B1-010",nome:"Butalbital",lista:"B1"},
  {codigo:"B1-011",nome:"Butobarbital",lista:"B1"},
  {codigo:"B1-012",nome:"Camazepam",lista:"B1"},
  {codigo:"B1-013",nome:"Cetazolam",lista:"B1"},
  {codigo:"B1-014",nome:"Clobazam",lista:"B1",concentracoes:["10mg","20mg"],formas:["Comprimido"]},
  {codigo:"B1-015",nome:"Clonazepam",lista:"B1",concentracoes:["0,5mg","2mg","2,5mg/mL"],formas:["Comprimido","Solução oral"]},
  {codigo:"B1-016",nome:"Clorazepato",lista:"B1",concentracoes:["5mg","10mg","15mg"],formas:["Cápsula"]},
  {codigo:"B1-017",nome:"Clordiazepóxido",lista:"B1",concentracoes:["5mg","10mg","25mg"],formas:["Comprimido","Cápsula"]},
  {codigo:"B1-018",nome:"Clotiazepam",lista:"B1"},
  {codigo:"B1-019",nome:"Cloxazolam",lista:"B1",concentracoes:["1mg","2mg"],formas:["Comprimido"]},
  {codigo:"B1-020",nome:"Delorazepam",lista:"B1"},
  {codigo:"B1-021",nome:"Diazepam",lista:"B1",concentracoes:["5mg","10mg","5mg/mL"],formas:["Comprimido","Solução injetável","Solução oral"]},
  {codigo:"B1-022",nome:"Estazolam",lista:"B1",concentracoes:["2mg"],formas:["Comprimido"]},
  {codigo:"B1-023",nome:"Etclorvinol",lista:"B1"},
  {codigo:"B1-024",nome:"Etinamato",lista:"B1"},
  {codigo:"B1-025",nome:"Etilloflazepato",lista:"B1"},
  {codigo:"B1-026",nome:"Fencamfamina",lista:"B1"},
  {codigo:"B1-027",nome:"Fenobarbital",lista:"B1",concentracoes:["50mg","100mg","40mg/mL","100mg/mL"],formas:["Comprimido","Solução oral","Solução injetável"]},
  {codigo:"B1-028",nome:"Fludiazepam",lista:"B1"},
  {codigo:"B1-029",nome:"Flunitrazepam",lista:"B1",concentracoes:["1mg","2mg"],formas:["Comprimido"]},
  {codigo:"B1-030",nome:"Flurazepam",lista:"B1",concentracoes:["15mg","30mg"],formas:["Cápsula"]},
  {codigo:"B1-031",nome:"Glutetimida",lista:"B1"},
  {codigo:"B1-032",nome:"Halazepam",lista:"B1"},
  {codigo:"B1-033",nome:"Haloxazolam",lista:"B1"},
  {codigo:"B1-034",nome:"Loprazolam",lista:"B1"},
  {codigo:"B1-035",nome:"Lorazepam",lista:"B1",concentracoes:["1mg","2mg","2mg/mL"],formas:["Comprimido","Solução injetável"]},
  {codigo:"B1-036",nome:"Lormetazepam",lista:"B1"},
  {codigo:"B1-037",nome:"Medazepam",lista:"B1"},
  {codigo:"B1-038",nome:"Meprobamato",lista:"B1"},
  {codigo:"B1-039",nome:"Metaclona",lista:"B1"},
  {codigo:"B1-040",nome:"Metilfenobarbital",lista:"B1"},
  {codigo:"B1-041",nome:"Metiprilona",lista:"B1"},
  {codigo:"B1-042",nome:"Midazolam",lista:"B1",concentracoes:["7,5mg","15mg","1mg/mL","5mg/mL"],formas:["Comprimido","Solução injetável","Solução oral"]},
  {codigo:"B1-043",nome:"Nimetazepam",lista:"B1"},
  {codigo:"B1-044",nome:"Nitrazepam",lista:"B1",concentracoes:["5mg"],formas:["Comprimido"]},
  {codigo:"B1-045",nome:"Nordazepam",lista:"B1"},
  {codigo:"B1-046",nome:"Oxazepam",lista:"B1",concentracoes:["10mg","15mg","30mg"],formas:["Comprimido"]},
  {codigo:"B1-047",nome:"Oxazolam",lista:"B1"},
  {codigo:"B1-048",nome:"Pentobarbital",lista:"B1"},
  {codigo:"B1-049",nome:"Pinazepam",lista:"B1"},
  {codigo:"B1-050",nome:"Prazepam",lista:"B1"},
  {codigo:"B1-051",nome:"Quazepam",lista:"B1"},
  {codigo:"B1-052",nome:"Secbutabarbital",lista:"B1"},
  {codigo:"B1-053",nome:"Temazepam",lista:"B1"},
  {codigo:"B1-054",nome:"Tetrazepam",lista:"B1"},
  {codigo:"B1-055",nome:"Triazolam",lista:"B1",concentracoes:["0,25mg"],formas:["Comprimido"]},
  {codigo:"B1-056",nome:"Vinilbital",lista:"B1"},
  {codigo:"B1-057",nome:"Zolpidem",lista:"B1",concentracoes:["5mg","10mg","6,25mg CR","12,5mg CR"],formas:["Comprimido","Comprimido LP"]},
  {codigo:"B1-058",nome:"Zopiclona",lista:"B1",concentracoes:["7,5mg"],formas:["Comprimido"]},
  {codigo:"B1-059",nome:"Eszopiclona",lista:"B1",concentracoes:["1mg","2mg","3mg"],formas:["Comprimido"]},
  {codigo:"B1-060",nome:"Zaleplon",lista:"B1",concentracoes:["5mg","10mg"],formas:["Cápsula"]},
];

// Lista B2 - Psicotrópicos anorexígenos
// ⚠️ ATUALIZADO conforme RDC ANVISA 2023
// Substâncias PROIBIDAS removidas: Anfepramona, Femproporex, Mazindol, Fentermina, Aminorex, Etilanfetamina, Fendimetrazina, Mefenorex
// Apenas Sibutramina e Lorcaserina são PERMITIDAS (com restrições)

// Lista de substâncias B2 PROIBIDAS (para validação e bloqueio)
export const SUBSTANCIAS_B2_PROIBIDAS = [
  'Aminorex',
  'Anfepramona',
  'Dietilpropiona', // sinônimo de Anfepramona
  'Etilanfetamina',
  'Femproporex',
  'Fendimetrazina',
  'Fentermina',
  'Mazindol',
  'Mefenorex',
] as const;

export const LISTA_B2: MedicamentoControlado[] = [
  {
    codigo: "B2-001",
    nome: "Sibutramina",
    lista: "B2",
    concentracoes: ["10mg", "15mg"],
    formas: ["Cápsula"],
    observacoes: "OBRIGATÓRIO: Termo de Responsabilidade do Prescritor (RDC 52/2011). Contraindicada para pacientes com histórico cardiovascular."
  },
  {
    codigo: "B2-002",
    nome: "Lorcaserina",
    lista: "B2",
    concentracoes: ["10mg"],
    formas: ["Comprimido"],
    observacoes: "Agonista seletivo do receptor 5-HT2C. Monitorar função cardíaca valvar."
  },
];
