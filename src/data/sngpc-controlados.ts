// SNGPC - Medicamentos Controlados (Portaria 344/98)
// Sistema Nacional de Gerenciamento de Produtos Controlados

export type ListaControlada = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type TipoReceituario = 'AMARELA' | 'AZUL' | 'BRANCA_2VIAS';

export interface MedicamentoControlado {
  codigo: string;
  nome: string;
  lista: ListaControlada;
  registroMS?: string; // Registro ANVISA (13-14 dígitos, inicia com "1")
  dcb?: string; // Denominação Comum Brasileira
  concentracoes?: string[];
  formas?: string[];
  observacoes?: string;
}

export interface ListaInfo {
  codigo: ListaControlada;
  nome: string;
  tipo: string;
  receituario: TipoReceituario;
  corReceita: string;
  validadeReceita: number;
  quantidadeMaxima: string;
  retencaoReceita: boolean;
}

// Informações das listas
export const LISTAS_CONTROLADAS: Record<ListaControlada, ListaInfo> = {
  A1: {
    codigo: 'A1',
    nome: 'Entorpecentes',
    tipo: 'Substâncias entorpecentes',
    receituario: 'AMARELA',
    corReceita: 'Amarela',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  A2: {
    codigo: 'A2',
    nome: 'Entorpecentes (uso permitido em concentrações especiais)',
    tipo: 'Substâncias entorpecentes de uso permitido',
    receituario: 'AMARELA',
    corReceita: 'Amarela',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  A3: {
    codigo: 'A3',
    nome: 'Psicotrópicos',
    tipo: 'Substâncias psicotrópicas',
    receituario: 'AMARELA',
    corReceita: 'Amarela',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  B1: {
    codigo: 'B1',
    nome: 'Psicotrópicos',
    tipo: 'Substâncias psicotrópicas',
    receituario: 'AZUL',
    corReceita: 'Azul',
    validadeReceita: 30,
    quantidadeMaxima: '60 dias de tratamento',
    retencaoReceita: true,
  },
  B2: {
    codigo: 'B2',
    nome: 'Psicotrópicos anorexígenos',
    tipo: 'Substâncias psicotrópicas anorexígenas',
    receituario: 'AZUL',
    corReceita: 'Azul',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  C1: {
    codigo: 'C1',
    nome: 'Outras substâncias sujeitas a controle especial',
    tipo: 'Outras substâncias',
    receituario: 'BRANCA_2VIAS',
    corReceita: 'Branca (2 vias)',
    validadeReceita: 30,
    quantidadeMaxima: '60 dias de tratamento',
    retencaoReceita: true,
  },
  C2: {
    codigo: 'C2',
    nome: 'Retinoides de uso sistêmico',
    tipo: 'Retinoides',
    receituario: 'BRANCA_2VIAS',
    corReceita: 'Branca (2 vias)',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  C3: {
    codigo: 'C3',
    nome: 'Imunossupressores',
    tipo: 'Imunossupressores',
    receituario: 'BRANCA_2VIAS',
    corReceita: 'Branca (2 vias)',
    validadeReceita: 30,
    quantidadeMaxima: '30 dias de tratamento',
    retencaoReceita: true,
  },
  C4: {
    codigo: 'C4',
    nome: 'Anti-retrovirais',
    tipo: 'Anti-retrovirais',
    receituario: 'BRANCA_2VIAS',
    corReceita: 'Branca (2 vias)',
    validadeReceita: 30,
    quantidadeMaxima: '60 dias de tratamento',
    retencaoReceita: true,
  },
  C5: {
    codigo: 'C5',
    nome: 'Anabolizantes',
    tipo: 'Anabolizantes',
    receituario: 'BRANCA_2VIAS',
    corReceita: 'Branca (2 vias)',
    validadeReceita: 30,
    quantidadeMaxima: '60 dias de tratamento',
    retencaoReceita: true,
  },
};

// Lista A1 - Entorpecentes
export const LISTA_A1: MedicamentoControlado[] = [
  {codigo:"A1-001",nome:"Alfentanila",lista:"A1",concentracoes:["0,5mg/mL"],formas:["Solução injetável"]},
  {codigo:"A1-002",nome:"Alfaprodina",lista:"A1"},
  {codigo:"A1-003",nome:"Anileridina",lista:"A1"},
  {codigo:"A1-004",nome:"Bezitramida",lista:"A1"},
  {codigo:"A1-005",nome:"Carfentanila",lista:"A1"},
  {codigo:"A1-006",nome:"Cetobemidona",lista:"A1"},
  {codigo:"A1-007",nome:"Codeína",lista:"A1",concentracoes:["30mg","60mg"],formas:["Comprimido","Solução oral"]},
  {codigo:"A1-008",nome:"Concentrado de palha de papoula",lista:"A1"},
  {codigo:"A1-009",nome:"Desomorfina",lista:"A1"},
  {codigo:"A1-010",nome:"Dextromoramida",lista:"A1"},
  {codigo:"A1-011",nome:"Dextropropoxifeno",lista:"A1",concentracoes:["50mg","100mg"],formas:["Cápsula"]},
  {codigo:"A1-012",nome:"Diampromida",lista:"A1"},
  {codigo:"A1-013",nome:"Dietiltiambuteno",lista:"A1"},
  {codigo:"A1-014",nome:"Difenoxilato",lista:"A1"},
  {codigo:"A1-015",nome:"Difenoxina",lista:"A1"},
  {codigo:"A1-016",nome:"Di-hidrocodeína",lista:"A1"},
  {codigo:"A1-017",nome:"Di-hidromorfina",lista:"A1"},
  {codigo:"A1-018",nome:"Dimefeptanol",lista:"A1"},
  {codigo:"A1-019",nome:"Dimenoxadol",lista:"A1"},
  {codigo:"A1-020",nome:"Dimetiltiambuteno",lista:"A1"},
  {codigo:"A1-021",nome:"Dioxafetila butirato",lista:"A1"},
  {codigo:"A1-022",nome:"Dipipanona",lista:"A1"},
  {codigo:"A1-023",nome:"Drotebanol",lista:"A1"},
  {codigo:"A1-024",nome:"Ecgonina",lista:"A1"},
  {codigo:"A1-025",nome:"Etilmetiltiambuteno",lista:"A1"},
  {codigo:"A1-026",nome:"Etilmorfina",lista:"A1"},
  {codigo:"A1-027",nome:"Etonitazeno",lista:"A1"},
  {codigo:"A1-028",nome:"Etorfina",lista:"A1"},
  {codigo:"A1-029",nome:"Etoxeridina",lista:"A1"},
  {codigo:"A1-030",nome:"Fenadoxona",lista:"A1"},
  {codigo:"A1-031",nome:"Fenampromida",lista:"A1"},
  {codigo:"A1-032",nome:"Fenazocina",lista:"A1"},
  {codigo:"A1-033",nome:"Fenomorfano",lista:"A1"},
  {codigo:"A1-034",nome:"Fenoperidina",lista:"A1"},
  {codigo:"A1-035",nome:"Fentanila",lista:"A1",concentracoes:["25mcg/h","50mcg/h","75mcg/h","100mcg/h","0,05mg/mL"],formas:["Adesivo transdérmico","Solução injetável"]},
  {codigo:"A1-036",nome:"Furetidina",lista:"A1"},
  {codigo:"A1-037",nome:"Heroína",lista:"A1"},
  {codigo:"A1-038",nome:"Hidrocodona",lista:"A1"},
  {codigo:"A1-039",nome:"Hidromorfinol",lista:"A1"},
  {codigo:"A1-040",nome:"Hidromorfona",lista:"A1",concentracoes:["2mg","4mg","8mg"],formas:["Comprimido"]},
  {codigo:"A1-041",nome:"Hidroxipetidina",lista:"A1"},
  {codigo:"A1-042",nome:"Isometadona",lista:"A1"},
  {codigo:"A1-043",nome:"Levofenacilmorfano",lista:"A1"},
  {codigo:"A1-044",nome:"Levometorfano",lista:"A1"},
  {codigo:"A1-045",nome:"Levomoramida",lista:"A1"},
  {codigo:"A1-046",nome:"Levorfanol",lista:"A1"},
  {codigo:"A1-047",nome:"Metadona",lista:"A1",concentracoes:["5mg","10mg","10mg/mL"],formas:["Comprimido","Solução oral"]},
  {codigo:"A1-048",nome:"Metazocina",lista:"A1"},
  {codigo:"A1-049",nome:"Metildesorfina",lista:"A1"},
  {codigo:"A1-050",nome:"Metildi-hidromorfina",lista:"A1"},
  {codigo:"A1-051",nome:"Metopon",lista:"A1"},
  {codigo:"A1-052",nome:"Mirofina",lista:"A1"},
  {codigo:"A1-053",nome:"Morferidina",lista:"A1"},
  {codigo:"A1-054",nome:"Morfina",lista:"A1",concentracoes:["10mg","30mg","60mg","100mg","10mg/mL","1mg/mL"],formas:["Comprimido","Cápsula LP","Solução injetável","Solução oral"]},
  {codigo:"A1-055",nome:"MPPP",lista:"A1"},
  {codigo:"A1-056",nome:"Nicocodina",lista:"A1"},
  {codigo:"A1-057",nome:"Nicodicodina",lista:"A1"},
  {codigo:"A1-058",nome:"Nicomorfina",lista:"A1"},
  {codigo:"A1-059",nome:"Noracimetadol",lista:"A1"},
  {codigo:"A1-060",nome:"Norcodeína",lista:"A1"},
  {codigo:"A1-061",nome:"Norlevorfanol",lista:"A1"},
  {codigo:"A1-062",nome:"Normetadona",lista:"A1"},
  {codigo:"A1-063",nome:"Normorfina",lista:"A1"},
  {codigo:"A1-064",nome:"Norpipanona",lista:"A1"},
  {codigo:"A1-065",nome:"Ópio",lista:"A1"},
  {codigo:"A1-066",nome:"Oxicodona",lista:"A1",concentracoes:["5mg","10mg","20mg","40mg","80mg"],formas:["Comprimido","Comprimido LP"]},
  {codigo:"A1-067",nome:"Oximorfona",lista:"A1"},
  {codigo:"A1-068",nome:"PEPAP",lista:"A1"},
  {codigo:"A1-069",nome:"Petidina",lista:"A1",concentracoes:["50mg/mL","100mg"],formas:["Solução injetável","Comprimido"]},
  {codigo:"A1-070",nome:"Piminodina",lista:"A1"},
  {codigo:"A1-071",nome:"Piritramida",lista:"A1"},
  {codigo:"A1-072",nome:"Proheptazina",lista:"A1"},
  {codigo:"A1-073",nome:"Properidina",lista:"A1"},
  {codigo:"A1-074",nome:"Racemetorfano",lista:"A1"},
  {codigo:"A1-075",nome:"Racemoramida",lista:"A1"},
  {codigo:"A1-076",nome:"Racemorfano",lista:"A1"},
  {codigo:"A1-077",nome:"Remifentanila",lista:"A1",concentracoes:["1mg","2mg","5mg"],formas:["Pó para solução injetável"]},
  {codigo:"A1-078",nome:"Sufentanila",lista:"A1",concentracoes:["0,05mg/mL","0,075mg/mL"],formas:["Solução injetável"]},
  {codigo:"A1-079",nome:"Tebacona",lista:"A1"},
  {codigo:"A1-080",nome:"Tebaína",lista:"A1"},
  {codigo:"A1-081",nome:"Tilidina",lista:"A1"},
  {codigo:"A1-082",nome:"Trimeperidina",lista:"A1"},
];

// Lista A2 - Entorpecentes de uso permitido em concentrações especiais
export const LISTA_A2: MedicamentoControlado[] = [
  {codigo:"A2-001",nome:"Acetildi-hidrocodeína",lista:"A2"},
  {codigo:"A2-002",nome:"Codeína (associações)",lista:"A2",observacoes:"Associações com outros princípios ativos não sujeitos a controle especial"},
  {codigo:"A2-003",nome:"Dextropropoxifeno (associações)",lista:"A2"},
  {codigo:"A2-004",nome:"Di-hidrocodeína (associações)",lista:"A2"},
  {codigo:"A2-005",nome:"Etilmorfina (associações)",lista:"A2"},
  {codigo:"A2-006",nome:"Folcodina",lista:"A2"},
  {codigo:"A2-007",nome:"Nicocodina (associações)",lista:"A2"},
  {codigo:"A2-008",nome:"Norcodeína (associações)",lista:"A2"},
  {codigo:"A2-009",nome:"Propiram",lista:"A2"},
];

// Lista A3 - Psicotrópicos
export const LISTA_A3: MedicamentoControlado[] = [
  {codigo:"A3-001",nome:"Anfetamina",lista:"A3"},
  {codigo:"A3-002",nome:"Catina",lista:"A3"},
  {codigo:"A3-003",nome:"Catinona",lista:"A3"},
  {codigo:"A3-004",nome:"Clobenzorex",lista:"A3"},
  {codigo:"A3-005",nome:"Dexanfetamina",lista:"A3"},
  {codigo:"A3-006",nome:"Fenciclidina",lista:"A3"},
  {codigo:"A3-007",nome:"Fenetilina",lista:"A3"},
  {codigo:"A3-008",nome:"Fenmetrazina",lista:"A3"},
  {codigo:"A3-009",nome:"Fentermina",lista:"A3"},
  {codigo:"A3-010",nome:"Levoanfetamina",lista:"A3"},
  {codigo:"A3-011",nome:"Levometanfetamina",lista:"A3"},
  {codigo:"A3-012",nome:"Mecloqualone",lista:"A3"},
  {codigo:"A3-013",nome:"Metanfetamina",lista:"A3"},
  {codigo:"A3-014",nome:"Metcatinona",lista:"A3"},
  {codigo:"A3-015",nome:"Metilfenidato",lista:"A3",concentracoes:["10mg","20mg","30mg","40mg","18mg","36mg","54mg"],formas:["Comprimido","Comprimido LP","Cápsula LP"]},
  {codigo:"A3-016",nome:"Metilona",lista:"A3"},
  {codigo:"A3-017",nome:"Metilpirrolidinovalerofenona (MDPV)",lista:"A3"},
  {codigo:"A3-018",nome:"Metilona",lista:"A3"},
  {codigo:"A3-019",nome:"Pirovalerona",lista:"A3"},
  {codigo:"A3-020",nome:"Secobarbital",lista:"A3"},
];
