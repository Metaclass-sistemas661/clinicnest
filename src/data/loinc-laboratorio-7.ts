// LOINC - Códigos de Laboratório Expandidos (Parte 7) - Farmacogenômica, Odontologia, Dermatologia/Estética, Metabolômica
import { LoincEntry } from './loinc-laboratorio';

// =============================================
// FARMACOGENÔMICA
// =============================================
export const LOINC_FARMACOGENOMICA: LoincEntry[] = [
  // Enzimas metabolizadoras CYP
  {code:"82116-1",display:"CYP2D6 genotype",displayPtBR:"CYP2D6 genotipagem",unit:"",category:"Farmacogenômica"},
  {code:"79714-1",display:"CYP2C19 genotype",displayPtBR:"CYP2C19 genotipagem",unit:"",category:"Farmacogenômica"},
  {code:"79713-3",display:"CYP2C9 genotype",displayPtBR:"CYP2C9 genotipagem",unit:"",category:"Farmacogenômica"},
  {code:"82117-9",display:"CYP3A4 genotype",displayPtBR:"CYP3A4 genotipagem",unit:"",category:"Farmacogenômica"},
  {code:"82118-7",display:"CYP3A5 genotype",displayPtBR:"CYP3A5 genotipagem",unit:"",category:"Farmacogenômica"},
  {code:"82119-5",display:"CYP1A2 genotype",displayPtBR:"CYP1A2 genotipagem",unit:"",category:"Farmacogenômica"},
  // Transportadores e outros
  {code:"82120-3",display:"VKORC1 genotype",displayPtBR:"VKORC1 genotipagem (sensibilidade varfarina)",unit:"",category:"Farmacogenômica"},
  {code:"46301-8",display:"HLA-B*5701 genotype",displayPtBR:"HLA-B*5701 (hipersensibilidade abacavir)",unit:"",category:"Farmacogenômica"},
  {code:"82121-1",display:"HLA-B*1502 genotype",displayPtBR:"HLA-B*1502 (reação carbamazepina)",unit:"",category:"Farmacogenômica"},
  {code:"82122-9",display:"HLA-A*3101 genotype",displayPtBR:"HLA-A*3101 (reação carbamazepina)",unit:"",category:"Farmacogenômica"},
  {code:"82123-7",display:"UGT1A1 genotype",displayPtBR:"UGT1A1 genotipagem (Gilbert/irinotecano)",unit:"",category:"Farmacogenômica"},
  {code:"82124-5",display:"DPYD genotype",displayPtBR:"DPYD genotipagem (toxicidade fluoropirimidinas)",unit:"",category:"Farmacogenômica"},
  {code:"82125-2",display:"TPMT genotype",displayPtBR:"TPMT genotipagem (toxicidade tiopurinas)",unit:"",category:"Farmacogenômica"},
  {code:"82126-0",display:"NUDT15 genotype",displayPtBR:"NUDT15 genotipagem (toxicidade tiopurinas)",unit:"",category:"Farmacogenômica"},
  {code:"82127-8",display:"SLCO1B1 genotype",displayPtBR:"SLCO1B1 genotipagem (miopatia estatinas)",unit:"",category:"Farmacogenômica"},
  {code:"82128-6",display:"NAT2 genotype",displayPtBR:"NAT2 genotipagem (metabolismo isoniazida)",unit:"",category:"Farmacogenômica"},
  {code:"82129-4",display:"G6PD genotype",displayPtBR:"G6PD genotipagem (deficiência G6PD)",unit:"",category:"Farmacogenômica"},
  // Atividade enzimática
  {code:"32546-4",display:"TPMT activity [RBC]",displayPtBR:"TPMT atividade eritrocitária",unit:"U/mL",category:"Farmacogenômica"},
  {code:"2357-0",display:"G6PD activity [RBC]",displayPtBR:"G6PD atividade eritrocitária",unit:"U/g Hb",category:"Farmacogenômica"},
  // Painel farmacogenômico
  {code:"62374-4",display:"Pharmacogenomic comprehensive panel",displayPtBR:"Painel farmacogenômico abrangente",unit:"",category:"Farmacogenômica"},
  {code:"82130-2",display:"Pharmacogenomic psychiatric panel",displayPtBR:"Painel farmacogenômico psiquiátrico",unit:"",category:"Farmacogenômica"},
  {code:"82131-0",display:"Pharmacogenomic cardiology panel",displayPtBR:"Painel farmacogenômico cardiológico",unit:"",category:"Farmacogenômica"},
  {code:"82132-8",display:"Pharmacogenomic oncology panel",displayPtBR:"Painel farmacogenômico oncológico",unit:"",category:"Farmacogenômica"},
];

// =============================================
// ODONTOLOGIA - Exames laboratoriais e de imagem odontológicos
// =============================================
export const LOINC_ODONTOLOGIA: LoincEntry[] = [
  // Radiologia odontológica
  {code:"38082-4",display:"XR Panoramic dental",displayPtBR:"Radiografia panorâmica",unit:"",category:"Odontologia"},
  {code:"38070-9",display:"XR Periapical dental",displayPtBR:"Radiografia periapical",unit:"",category:"Odontologia"},
  {code:"69150-8",display:"XR Bitewing dental",displayPtBR:"Radiografia interproximal (bitewing)",unit:"",category:"Odontologia"},
  {code:"38071-7",display:"XR Occlusal dental",displayPtBR:"Radiografia oclusal",unit:"",category:"Odontologia"},
  {code:"44100-4",display:"CBCT Dental",displayPtBR:"Tomografia Cone Beam (CBCT)",unit:"",category:"Odontologia"},
  {code:"69151-6",display:"XR Cephalometric",displayPtBR:"Telerradiografia lateral (cefalométrica)",unit:"",category:"Odontologia"},
  {code:"69152-4",display:"XR Dental complete series",displayPtBR:"Levantamento periapical completo",unit:"",category:"Odontologia"},
  // Exames laboratoriais odontológicos
  {code:"55201-8",display:"Dental caries risk assessment",displayPtBR:"Avaliação de risco de cárie",unit:"",category:"Odontologia"},
  {code:"56849-3",display:"Salivary flow rate",displayPtBR:"Fluxo salivar (sialometria)",unit:"mL/min",category:"Odontologia"},
  {code:"56850-1",display:"Salivary pH",displayPtBR:"pH salivar",unit:"",category:"Odontologia"},
  {code:"56851-9",display:"Salivary buffer capacity",displayPtBR:"Capacidade tampão salivar",unit:"",category:"Odontologia"},
  {code:"630-4",display:"Bacterial culture [oral]",displayPtBR:"Cultura bacteriana (cavidade oral)",unit:"",category:"Odontologia"},
  {code:"6463-4",display:"Fungal culture [oral]",displayPtBR:"Cultura fúngica (cavidade oral)",unit:"",category:"Odontologia"},
  // Periodontia
  {code:"56852-7",display:"Periodontal screening record",displayPtBR:"Registro de sondagem periodontal (PSR)",unit:"",category:"Odontologia"},
  {code:"56853-5",display:"Periodontal charting",displayPtBR:"Mapeamento periodontal completo",unit:"mm",category:"Odontologia"},
  {code:"99999-1",display:"Gingival index",displayPtBR:"Índice gengival",unit:"",category:"Odontologia"},
  {code:"99999-2",display:"Plaque index",displayPtBR:"Índice de placa bacteriana",unit:"",category:"Odontologia"},
  {code:"99999-3",display:"Bleeding on probing",displayPtBR:"Sangramento à sondagem",unit:"%",category:"Odontologia"},
  // Biópsia oral
  {code:"22634-0",display:"Histopathology [oral tissue]",displayPtBR:"Histopatológico (tecido oral)",unit:"",category:"Odontologia"},
  {code:"33716-2",display:"FNAC [oral mass]",displayPtBR:"PAAF (massa oral)",unit:"",category:"Odontologia"},
  // ATM
  {code:"36399-4",display:"MR TMJ",displayPtBR:"RM da ATM (articulação temporomandibular)",unit:"",category:"Odontologia"},
  {code:"69153-2",display:"CT Dental maxillofacial",displayPtBR:"TC Bucomaxilofacial",unit:"",category:"Odontologia"},
  // Exames pré-cirúrgicos odontológicos
  {code:"58410-2",display:"CBC pre-dental surgery",displayPtBR:"Hemograma pré-cirúrgico odontológico",unit:"",category:"Odontologia"},
  {code:"5902-2",display:"PT pre-dental surgery",displayPtBR:"TP pré-cirúrgico odontológico",unit:"s",category:"Odontologia"},
  {code:"3173-2",display:"APTT pre-dental surgery",displayPtBR:"TTPA pré-cirúrgico odontológico",unit:"s",category:"Odontologia"},
  {code:"2345-7",display:"Glucose pre-dental surgery",displayPtBR:"Glicemia pré-cirúrgica odontológica",unit:"mg/dL",category:"Odontologia"},
];

// =============================================
// DERMATOLOGIA E ESTÉTICA
// =============================================
export const LOINC_DERMATOLOGIA: LoincEntry[] = [
  // Biópsia e patologia cutânea
  {code:"22634-0",display:"Skin biopsy histopathology",displayPtBR:"Histopatológico de pele (biópsia)",unit:"",category:"Dermatologia"},
  {code:"40684-6",display:"Skin IHC panel",displayPtBR:"Imunohistoquímica de pele",unit:"",category:"Dermatologia"},
  {code:"19766-5",display:"Skin cytology",displayPtBR:"Citologia de lesão cutânea",unit:"",category:"Dermatologia"},
  {code:"33721-2",display:"Melanoma Breslow thickness",displayPtBR:"Espessura de Breslow (melanoma)",unit:"mm",category:"Dermatologia"},
  {code:"33722-0",display:"Melanoma Clark level",displayPtBR:"Nível de Clark (melanoma)",unit:"",category:"Dermatologia"},
  {code:"44834-8",display:"Sentinel lymph node biopsy",displayPtBR:"Biópsia de linfonodo sentinela",unit:"",category:"Dermatologia"},
  // Micologia
  {code:"580-1",display:"Fungal culture [skin]",displayPtBR:"Cultura fúngica (pele/unha)",unit:"",category:"Dermatologia"},
  {code:"654-4",display:"KOH preparation [skin]",displayPtBR:"Exame micológico direto (KOH)",unit:"",category:"Dermatologia"},
  {code:"21415-5",display:"Dermatophyte PCR",displayPtBR:"Dermatófitos PCR",unit:"",category:"Dermatologia"},
  // Testes alérgicos cutâneos
  {code:"58954-9",display:"Patch test panel",displayPtBR:"Teste de contato (Patch test)",unit:"",category:"Dermatologia"},
  {code:"58955-6",display:"Prick test panel",displayPtBR:"Teste de puntura (Prick test)",unit:"",category:"Dermatologia"},
  // Exames pré-procedimento estético
  {code:"58410-2",display:"CBC pre-aesthetic",displayPtBR:"Hemograma pré-procedimento estético",unit:"",category:"Dermatologia"},
  {code:"5902-2",display:"PT pre-aesthetic",displayPtBR:"TP pré-procedimento estético",unit:"s",category:"Dermatologia"},
  {code:"3173-2",display:"APTT pre-aesthetic",displayPtBR:"TTPA pré-procedimento estético",unit:"s",category:"Dermatologia"},
  {code:"2345-7",display:"Glucose pre-aesthetic",displayPtBR:"Glicemia pré-procedimento estético",unit:"mg/dL",category:"Dermatologia"},
  {code:"5196-1",display:"HIV pre-aesthetic",displayPtBR:"Anti-HIV pré-procedimento estético",unit:"",category:"Dermatologia"},
  {code:"5195-3",display:"HBsAg pre-aesthetic",displayPtBR:"HBsAg pré-procedimento estético",unit:"",category:"Dermatologia"},
  {code:"5199-5",display:"Anti-HCV pre-aesthetic",displayPtBR:"Anti-HCV pré-procedimento estético",unit:"",category:"Dermatologia"},
  // Fotodocumentação e dermoscopia
  {code:"72170-4",display:"Dermoscopy image",displayPtBR:"Imagem de dermatoscopia",unit:"",category:"Dermatologia"},
  {code:"72171-2",display:"Clinical photo skin",displayPtBR:"Fotodocumentação clínica (pele)",unit:"",category:"Dermatologia"},
  {code:"72172-0",display:"Clinical photo pre-procedure",displayPtBR:"Foto pré-procedimento estético",unit:"",category:"Dermatologia"},
  {code:"72173-8",display:"Clinical photo post-procedure",displayPtBR:"Foto pós-procedimento estético",unit:"",category:"Dermatologia"},
  // Autoantibodies cutâneos
  {code:"5130-0",display:"Anti-desmoglein 1",displayPtBR:"Anti-desmogleína 1 (pênfigo foliáceo)",unit:"U/mL",category:"Dermatologia"},
  {code:"5131-8",display:"Anti-desmoglein 3",displayPtBR:"Anti-desmogleína 3 (pênfigo vulgar)",unit:"U/mL",category:"Dermatologia"},
  {code:"32218-7",display:"IIF skin biopsy",displayPtBR:"Imunofluorescência direta (pele)",unit:"",category:"Dermatologia"},
  {code:"32219-5",display:"IIF serum skin Ab",displayPtBR:"Imunofluorescência indireta (anticorpos cutâneos)",unit:"",category:"Dermatologia"},
];

// =============================================
// METABOLÔMICA E ERROS INATOS DO METABOLISMO
// =============================================
export const LOINC_METABOLOMICA: LoincEntry[] = [
  // Aminoácidos plasmáticos
  {code:"2862-1",display:"Amino acids quantitative [plasma]",displayPtBR:"Aminoácidos quantitativos (plasma)",unit:"umol/L",category:"Metabolômica"},
  {code:"29575-8",display:"Phenylalanine [serum]",displayPtBR:"Fenilalanina sérica",unit:"mg/dL",category:"Metabolômica"},
  {code:"14362-8",display:"Tyrosine [serum]",displayPtBR:"Tirosina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14295-0",display:"Leucine [serum]",displayPtBR:"Leucina sérica (doença xarope bordo)",unit:"umol/L",category:"Metabolômica"},
  {code:"14296-8",display:"Isoleucine [serum]",displayPtBR:"Isoleucina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14294-3",display:"Valine [serum]",displayPtBR:"Valina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"2756-5",display:"Homocysteine [serum]",displayPtBR:"Homocisteína sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14293-5",display:"Methionine [serum]",displayPtBR:"Metionina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14299-2",display:"Citrulline [serum]",displayPtBR:"Citrulina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14300-8",display:"Argininosuccinate [serum]",displayPtBR:"Ácido argininossuccínico sérico",unit:"umol/L",category:"Metabolômica"},
  {code:"14297-6",display:"Ornithine [serum]",displayPtBR:"Ornitina sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"14298-4",display:"Glycine [serum]",displayPtBR:"Glicina sérica",unit:"umol/L",category:"Metabolômica"},
  // Ácidos orgânicos urinários
  {code:"14363-6",display:"Organic acids [urine]",displayPtBR:"Ácidos orgânicos urinários",unit:"",category:"Metabolômica"},
  {code:"14364-4",display:"Methylmalonic acid [urine]",displayPtBR:"Ácido metilmalônico (urina)",unit:"mmol/mol creat",category:"Metabolômica"},
  {code:"14365-1",display:"Methylmalonic acid [serum]",displayPtBR:"Ácido metilmalônico (soro)",unit:"nmol/L",category:"Metabolômica"},
  {code:"14366-9",display:"Glutaric acid [urine]",displayPtBR:"Ácido glutárico (urina)",unit:"mmol/mol creat",category:"Metabolômica"},
  {code:"14367-7",display:"Orotic acid [urine]",displayPtBR:"Ácido orótico (urina)",unit:"umol/mmol creat",category:"Metabolômica"},
  {code:"14368-5",display:"Succinylacetone [urine]",displayPtBR:"Succinilacetona (urina) - tirosinemia",unit:"umol/L",category:"Metabolômica"},
  // Acilcarnitinas
  {code:"53155-8",display:"Acylcarnitine profile [serum]",displayPtBR:"Perfil de acilcarnitinas (soro)",unit:"",category:"Metabolômica"},
  {code:"42263-4",display:"Free carnitine [serum]",displayPtBR:"Carnitina livre sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"42264-2",display:"Total carnitine [serum]",displayPtBR:"Carnitina total sérica",unit:"umol/L",category:"Metabolômica"},
  {code:"53156-6",display:"Acylcarnitine C0 [serum]",displayPtBR:"Acilcarnitina C0 (carnitina livre)",unit:"umol/L",category:"Metabolômica"},
  {code:"53157-4",display:"Acylcarnitine C2 [serum]",displayPtBR:"Acilcarnitina C2 (acetilcarnitina)",unit:"umol/L",category:"Metabolômica"},
  {code:"53158-2",display:"Acylcarnitine C3 [serum]",displayPtBR:"Acilcarnitina C3 (propionilcarnitina)",unit:"umol/L",category:"Metabolômica"},
  {code:"53159-0",display:"Acylcarnitine C5 [serum]",displayPtBR:"Acilcarnitina C5 (isovalerilcarnitina)",unit:"umol/L",category:"Metabolômica"},
  {code:"53160-8",display:"Acylcarnitine C8 [serum]",displayPtBR:"Acilcarnitina C8 (octanoilcarnitina - MCADD)",unit:"umol/L",category:"Metabolômica"},
  {code:"53161-6",display:"Acylcarnitine C16 [serum]",displayPtBR:"Acilcarnitina C16 (palmitoilcarnitina - VLCADD)",unit:"umol/L",category:"Metabolômica"},
  // Doenças de depósito
  {code:"2340-8",display:"Glucocerebrosidase [leukocytes]",displayPtBR:"Glucocerebrosidase (Gaucher)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"2341-6",display:"Alpha-galactosidase A [leukocytes]",displayPtBR:"Alfa-galactosidase A (Fabry)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"2342-4",display:"Acid sphingomyelinase [leukocytes]",displayPtBR:"Esfingomielinase ácida (Niemann-Pick)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"2343-2",display:"Hexosaminidase A [serum]",displayPtBR:"Hexosaminidase A (Tay-Sachs)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"2344-0",display:"Alpha-L-iduronidase [leukocytes]",displayPtBR:"Alfa-L-iduronidase (Hurler/MPS I)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"2346-5",display:"Iduronate-2-sulfatase [serum]",displayPtBR:"Iduronato-2-sulfatase (Hunter/MPS II)",unit:"nmol/h/mg",category:"Metabolômica"},
  {code:"14729-8",display:"GAGs [urine]",displayPtBR:"Glicosaminoglicanos urinários (MPS)",unit:"mg/mmol creat",category:"Metabolômica"},
  {code:"2347-3",display:"Biotinidase activity [serum]",displayPtBR:"Atividade de biotinidase sérica",unit:"nmol/min/mL",category:"Metabolômica"},
  // Porfirias
  {code:"2737-5",display:"Porphyrins total [urine]",displayPtBR:"Porfirinas totais urinárias",unit:"ug/24h",category:"Metabolômica"},
  {code:"2745-8",display:"PBG (porphobilinogen) [urine]",displayPtBR:"Porfobilinogênio urinário (PBG)",unit:"mg/24h",category:"Metabolômica"},
  {code:"2743-3",display:"ALA (aminolevulinic acid) [urine]",displayPtBR:"Ácido aminolevulínico urinário (ALA)",unit:"mg/24h",category:"Metabolômica"},
  // Testes especiais
  {code:"2656-7",display:"Lactate [plasma]",displayPtBR:"Lactato plasmático",unit:"mmol/L",category:"Metabolômica"},
  {code:"2813-4",display:"Pyruvate [plasma]",displayPtBR:"Piruvato plasmático",unit:"mmol/L",category:"Metabolômica"},
  {code:"2579-1",display:"Lactate/Pyruvate ratio",displayPtBR:"Relação Lactato/Piruvato",unit:"",category:"Metabolômica"},
  {code:"2028-9",display:"Ammonia [plasma]",displayPtBR:"Amônia plasmática",unit:"umol/L",category:"Metabolômica"},
  {code:"22664-7",display:"Very long chain fatty acids",displayPtBR:"Ácidos graxos de cadeia muito longa (VLCFA)",unit:"",category:"Metabolômica"},
  {code:"35572-7",display:"Transferrin isoelectric focusing",displayPtBR:"Focalização isoelétrica da transferrina (CDG)",unit:"",category:"Metabolômica"},
  {code:"14814-8",display:"Ceruloplasmin [serum]",displayPtBR:"Ceruloplasmina sérica (Wilson)",unit:"mg/dL",category:"Metabolômica"},
];
