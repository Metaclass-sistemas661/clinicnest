// LOINC - Códigos de Laboratório Expandidos (Parte 5) - Toxicologia, Neonatal/Pediátrico, Patologia, Endocrinologia Expandida
import { LoincEntry } from './loinc-laboratorio';

// =============================================
// TOXICOLOGIA - Drogas de abuso e metais pesados
// =============================================
export const LOINC_TOXICOLOGIA: LoincEntry[] = [
  // Drogas de abuso - Triagem
  {code:"19295-5",display:"Amphetamines [urine screen]",displayPtBR:"Anfetaminas (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"19270-8",display:"Barbiturates [urine screen]",displayPtBR:"Barbitúricos (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"19271-6",display:"Benzodiazepines [urine screen]",displayPtBR:"Benzodiazepínicos (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"3397-7",display:"Cocaine metabolite [urine]",displayPtBR:"Metabólito de cocaína (urina)",unit:"ng/mL",category:"Toxicologia"},
  {code:"19288-0",display:"Cannabis [urine screen]",displayPtBR:"Cannabis/THC (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"19294-8",display:"Opiates [urine screen]",displayPtBR:"Opiáceos (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"19293-0",display:"Methadone [urine screen]",displayPtBR:"Metadona (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"19301-1",display:"Phencyclidine [urine screen]",displayPtBR:"Fenciclidina/PCP (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"3774-7",display:"MDMA [urine]",displayPtBR:"Ecstasy/MDMA (urina)",unit:"ng/mL",category:"Toxicologia"},
  {code:"43985-4",display:"Drug abuse screen panel [urine]",displayPtBR:"Painel triagem drogas de abuso (urina)",unit:"",category:"Toxicologia"},
  {code:"19296-3",display:"Tricyclic antidepressants [urine screen]",displayPtBR:"Antidepressivos tricíclicos (triagem)",unit:"",category:"Toxicologia"},
  {code:"19310-2",display:"Ethanol [blood]",displayPtBR:"Etanol/Álcool (sangue)",unit:"mg/dL",category:"Toxicologia"},
  {code:"5645-7",display:"Ethanol [urine]",displayPtBR:"Etanol/Álcool (urina)",unit:"mg/dL",category:"Toxicologia"},
  {code:"72828-1",display:"Fentanyl [urine screen]",displayPtBR:"Fentanil (triagem urinária)",unit:"",category:"Toxicologia"},
  {code:"58376-5",display:"Buprenorphine [urine screen]",displayPtBR:"Buprenorfina (triagem urinária)",unit:"",category:"Toxicologia"},
  // Metais pesados
  {code:"5671-3",display:"Lead [blood]",displayPtBR:"Chumbo (sangue)",unit:"ug/dL",category:"Toxicologia"},
  {code:"5688-7",display:"Mercury [blood]",displayPtBR:"Mercúrio (sangue)",unit:"ug/L",category:"Toxicologia"},
  {code:"5690-3",display:"Mercury [urine]",displayPtBR:"Mercúrio (urina)",unit:"ug/L",category:"Toxicologia"},
  {code:"5621-8",display:"Arsenic [urine]",displayPtBR:"Arsênico (urina)",unit:"ug/L",category:"Toxicologia"},
  {code:"5619-2",display:"Arsenic [blood]",displayPtBR:"Arsênico (sangue)",unit:"ug/L",category:"Toxicologia"},
  {code:"5609-3",display:"Cadmium [blood]",displayPtBR:"Cádmio (sangue)",unit:"ug/L",category:"Toxicologia"},
  {code:"5610-1",display:"Cadmium [urine]",displayPtBR:"Cádmio (urina)",unit:"ug/L",category:"Toxicologia"},
  {code:"5631-7",display:"Chromium [blood]",displayPtBR:"Cromo (sangue)",unit:"ug/L",category:"Toxicologia"},
  {code:"5694-5",display:"Nickel [blood]",displayPtBR:"Níquel (sangue)",unit:"ug/L",category:"Toxicologia"},
  {code:"5778-6",display:"Thallium [urine]",displayPtBR:"Tálio (urina)",unit:"ug/L",category:"Toxicologia"},
  {code:"5601-9",display:"Aluminum [serum]",displayPtBR:"Alumínio (soro)",unit:"ug/L",category:"Toxicologia"},
  {code:"5637-4",display:"Copper [serum]",displayPtBR:"Cobre (soro)",unit:"ug/dL",category:"Toxicologia"},
  {code:"5638-2",display:"Copper [urine 24h]",displayPtBR:"Cobre (urina 24h)",unit:"ug/24h",category:"Toxicologia"},
  {code:"5791-9",display:"Zinc [serum]",displayPtBR:"Zinco (soro)",unit:"ug/dL",category:"Toxicologia"},
  {code:"2831-6",display:"Manganese [blood]",displayPtBR:"Manganês (sangue)",unit:"ug/L",category:"Toxicologia"},
  // Outros tóxicos
  {code:"20563-3",display:"Carboxyhemoglobin [blood]",displayPtBR:"Carboxihemoglobina",unit:"%",category:"Toxicologia"},
  {code:"2028-9",display:"Carbon monoxide [blood]",displayPtBR:"Monóxido de carbono (sangue)",unit:"%",category:"Toxicologia"},
  {code:"12841-2",display:"Methemoglobin [blood]",displayPtBR:"Metahemoglobina",unit:"%",category:"Toxicologia"},
  {code:"14685-2",display:"Colinesterase [serum]",displayPtBR:"Colinesterase sérica",unit:"U/L",category:"Toxicologia"},
  {code:"2098-1",display:"Cholinesterase [RBC]",displayPtBR:"Colinesterase eritrocitária",unit:"U/g Hb",category:"Toxicologia"},
];

// =============================================
// NEONATAL E PEDIÁTRICO
// =============================================
export const LOINC_NEONATAL: LoincEntry[] = [
  // Triagem neonatal (Teste do pezinho)
  {code:"73700-1",display:"Newborn screening panel",displayPtBR:"Triagem neonatal (teste do pezinho)",unit:"",category:"Neonatal"},
  {code:"29575-8",display:"Phenylalanine [DBS]",displayPtBR:"Fenilalanina (papel filtro)",unit:"mg/dL",category:"Neonatal"},
  {code:"42906-1",display:"TSH neonatal [DBS]",displayPtBR:"TSH neonatal (papel filtro)",unit:"mIU/L",category:"Neonatal"},
  {code:"73698-7",display:"17-OH Progesterone [DBS]",displayPtBR:"17-OH Progesterona neonatal",unit:"ng/mL",category:"Neonatal"},
  {code:"54078-8",display:"Biotinidase [DBS]",displayPtBR:"Biotinidase (papel filtro)",unit:"",category:"Neonatal"},
  {code:"56478-1",display:"IRT neonatal [DBS]",displayPtBR:"Tripsina imunorreativa (IRT)",unit:"ng/mL",category:"Neonatal"},
  {code:"64115-9",display:"Hemoglobin pattern [DBS]",displayPtBR:"Eletroforese de hemoglobina neonatal",unit:"",category:"Neonatal"},
  {code:"62292-8",display:"Galactose [DBS]",displayPtBR:"Galactose (papel filtro)",unit:"mg/dL",category:"Neonatal"},
  {code:"57700-7",display:"SCID (TREC) [DBS]",displayPtBR:"TREC - Triagem SCID neonatal",unit:"copies/uL",category:"Neonatal"},
  {code:"73699-5",display:"Acylcarnitine panel [DBS]",displayPtBR:"Acilcarnitinas (papel filtro)",unit:"",category:"Neonatal"},
  {code:"62238-1",display:"Amino acids panel [DBS]",displayPtBR:"Aminoácidos (papel filtro)",unit:"",category:"Neonatal"},
  {code:"54081-2",display:"Tandem mass spectrometry [DBS]",displayPtBR:"Espectrometria de massas neonatal",unit:"",category:"Neonatal"},
  // Bilirrubinas neonatais
  {code:"58941-6",display:"Transcutaneous bilirubin",displayPtBR:"Bilirrubina transcutânea",unit:"mg/dL",category:"Neonatal"},
  {code:"1975-2",display:"Total bilirubin [neonatal]",displayPtBR:"Bilirrubina total neonatal",unit:"mg/dL",category:"Neonatal"},
  {code:"1968-7",display:"Direct bilirubin [neonatal]",displayPtBR:"Bilirrubina direta neonatal",unit:"mg/dL",category:"Neonatal"},
  // Outros pediátricos
  {code:"8336-0",display:"Body weight [birth]",displayPtBR:"Peso ao nascer",unit:"g",category:"Neonatal"},
  {code:"8305-5",display:"Body height [birth]",displayPtBR:"Comprimento ao nascer",unit:"cm",category:"Neonatal"},
  {code:"8290-9",display:"Head circumference",displayPtBR:"Perímetro cefálico",unit:"cm",category:"Neonatal"},
  {code:"9843-4",display:"Apgar score 1 min",displayPtBR:"Apgar 1 minuto",unit:"",category:"Neonatal"},
  {code:"9844-2",display:"Apgar score 5 min",displayPtBR:"Apgar 5 minutos",unit:"",category:"Neonatal"},
  {code:"9271-8",display:"Apgar score 10 min",displayPtBR:"Apgar 10 minutos",unit:"",category:"Neonatal"},
  {code:"29463-7",display:"Body weight [percentile]",displayPtBR:"Peso (percentil)",unit:"%",category:"Neonatal"},
  {code:"59576-9",display:"BMI percentile",displayPtBR:"IMC (percentil)",unit:"%",category:"Neonatal"},
  {code:"77606-2",display:"Growth chart tracking",displayPtBR:"Acompanhamento curva de crescimento",unit:"",category:"Neonatal"},
];

// =============================================
// PATOLOGIA E CITOPATOLOGIA
// =============================================
export const LOINC_PATOLOGIA: LoincEntry[] = [
  // Citologia cervical
  {code:"10524-7",display:"Cervical cytology",displayPtBR:"Citologia cervical (Papanicolau)",unit:"",category:"Patologia"},
  {code:"19762-4",display:"Pap smear interpretation",displayPtBR:"Interpretação Papanicolau",unit:"",category:"Patologia"},
  {code:"21440-3",display:"HPV high-risk DNA [cervix]",displayPtBR:"HPV alto risco DNA (colo uterino)",unit:"",category:"Patologia"},
  {code:"59420-0",display:"HPV 16 DNA [cervix]",displayPtBR:"HPV 16 DNA (colo uterino)",unit:"",category:"Patologia"},
  {code:"59263-4",display:"HPV 18 DNA [cervix]",displayPtBR:"HPV 18 DNA (colo uterino)",unit:"",category:"Patologia"},
  {code:"38372-9",display:"Thin prep cytology",displayPtBR:"Citologia em meio líquido",unit:"",category:"Patologia"},
  // Histopatologia
  {code:"22634-0",display:"Histopathology report",displayPtBR:"Laudo histopatológico",unit:"",category:"Patologia"},
  {code:"33717-0",display:"Surgical pathology report",displayPtBR:"Anatomopatológico cirúrgico",unit:"",category:"Patologia"},
  {code:"33718-8",display:"Surgical pathology gross",displayPtBR:"Macroscopia anatomopatológica",unit:"",category:"Patologia"},
  {code:"33719-6",display:"Surgical pathology microscopic",displayPtBR:"Microscopia anatomopatológica",unit:"",category:"Patologia"},
  {code:"33720-4",display:"Surgical pathology diagnosis",displayPtBR:"Diagnóstico anatomopatológico",unit:"",category:"Patologia"},
  {code:"22636-5",display:"Frozen section",displayPtBR:"Biópsia de congelação",unit:"",category:"Patologia"},
  // Imunohistoquímica
  {code:"40684-6",display:"Immunohistochemistry report",displayPtBR:"Relatório de imunohistoquímica",unit:"",category:"Patologia"},
  {code:"31208-2",display:"ER/PR status [tissue]",displayPtBR:"Status ER/PR (tecido)",unit:"",category:"Patologia"},
  {code:"72383-7",display:"HER2 by IHC [tissue]",displayPtBR:"HER2 por imunohistoquímica",unit:"",category:"Patologia"},
  {code:"85318-0",display:"PD-L1 by IHC [tissue]",displayPtBR:"PD-L1 por imunohistoquímica",unit:"%",category:"Patologia"},
  {code:"85337-0",display:"Ki-67 by IHC [tissue]",displayPtBR:"Ki-67 por imunohistoquímica",unit:"%",category:"Patologia"},
  // Citologia geral
  {code:"19766-5",display:"Cytology study",displayPtBR:"Estudo citológico",unit:"",category:"Patologia"},
  {code:"33716-2",display:"Fine needle aspiration cytology",displayPtBR:"Citologia por punção aspirativa (PAAF)",unit:"",category:"Patologia"},
  {code:"24610-8",display:"Urine cytology",displayPtBR:"Citologia urinária (oncótica)",unit:"",category:"Patologia"},
  {code:"19774-9",display:"Pleural fluid cytology",displayPtBR:"Citologia líquido pleural",unit:"",category:"Patologia"},
  {code:"19775-6",display:"Peritoneal fluid cytology",displayPtBR:"Citologia líquido peritoneal/ascítico",unit:"",category:"Patologia"},
  // Autópsia
  {code:"18743-5",display:"Autopsy report",displayPtBR:"Laudo de autópsia/necropsia",unit:"",category:"Patologia"},
];

// =============================================
// ENDOCRINOLOGIA EXPANDIDA
// =============================================
export const LOINC_ENDOCRINOLOGIA: LoincEntry[] = [
  // Pâncreas / Metabolismo
  {code:"20448-7",display:"Insulin [serum]",displayPtBR:"Insulina sérica",unit:"uIU/mL",category:"Endocrinologia"},
  {code:"1986-9",display:"C-peptide [serum]",displayPtBR:"Peptídeo C sérico",unit:"ng/mL",category:"Endocrinologia"},
  {code:"56540-7",display:"HOMA-IR",displayPtBR:"HOMA-IR (resistência insulínica)",unit:"",category:"Endocrinologia"},
  {code:"56541-5",display:"HOMA-beta",displayPtBR:"HOMA-beta (função células beta)",unit:"",category:"Endocrinologia"},
  {code:"2028-9",display:"Fructosamine [serum]",displayPtBR:"Frutosamina sérica",unit:"umol/L",category:"Endocrinologia"},
  {code:"53048-5",display:"Anti-GAD antibodies",displayPtBR:"Anti-GAD (anti-descarboxilase do ácido glutâmico)",unit:"U/mL",category:"Endocrinologia"},
  {code:"56718-9",display:"Anti-IA2 antibodies",displayPtBR:"Anti-IA2 (anti-tirosina fosfatase)",unit:"U/mL",category:"Endocrinologia"},
  {code:"13926-1",display:"Anti-insulin antibodies",displayPtBR:"Anticorpos anti-insulina",unit:"U/mL",category:"Endocrinologia"},
  // Adrenal
  {code:"2143-6",display:"Cortisol [serum AM]",displayPtBR:"Cortisol matinal (8h)",unit:"ug/dL",category:"Endocrinologia"},
  {code:"14675-3",display:"Cortisol [serum PM]",displayPtBR:"Cortisol vespertino (16h)",unit:"ug/dL",category:"Endocrinologia"},
  {code:"2144-4",display:"Cortisol [urine 24h]",displayPtBR:"Cortisol urinário livre 24h",unit:"ug/24h",category:"Endocrinologia"},
  {code:"11050-2",display:"Cortisol [saliva]",displayPtBR:"Cortisol salivar",unit:"ug/dL",category:"Endocrinologia"},
  {code:"2141-0",display:"Cortisol post-dexamethasone",displayPtBR:"Cortisol pós-dexametasona",unit:"ug/dL",category:"Endocrinologia"},
  {code:"2157-6",display:"DHEA-S [serum]",displayPtBR:"DHEA-S (sulfato de DHEA)",unit:"ug/dL",category:"Endocrinologia"},
  {code:"2191-5",display:"ACTH [plasma]",displayPtBR:"ACTH (hormônio adrenocorticotrófico)",unit:"pg/mL",category:"Endocrinologia"},
  {code:"2232-7",display:"Aldosterone [serum]",displayPtBR:"Aldosterona sérica",unit:"ng/dL",category:"Endocrinologia"},
  {code:"2915-7",display:"Renin activity [plasma]",displayPtBR:"Atividade de renina plasmática",unit:"ng/mL/h",category:"Endocrinologia"},
  {code:"48058-2",display:"Aldosterone/Renin ratio",displayPtBR:"Relação Aldosterona/Renina",unit:"",category:"Endocrinologia"},
  {code:"2681-5",display:"Metanephrines [plasma]",displayPtBR:"Metanefrinas plasmáticas",unit:"pg/mL",category:"Endocrinologia"},
  {code:"2668-2",display:"Metanephrines [urine 24h]",displayPtBR:"Metanefrinas urinárias 24h",unit:"ug/24h",category:"Endocrinologia"},
  {code:"2233-5",display:"Catecholamines [urine 24h]",displayPtBR:"Catecolaminas urinárias 24h",unit:"ug/24h",category:"Endocrinologia"},
  {code:"2671-6",display:"Normetanephrine [plasma]",displayPtBR:"Normetanefrina plasmática",unit:"pg/mL",category:"Endocrinologia"},
  {code:"14584-7",display:"VMA [urine 24h]",displayPtBR:"Ácido vanilmandélico (AVM) urina 24h",unit:"mg/24h",category:"Endocrinologia"},
  // Paratireoide e metabolismo ósseo
  {code:"2731-8",display:"PTH intact [serum]",displayPtBR:"PTH intacto (paratormônio)",unit:"pg/mL",category:"Endocrinologia"},
  {code:"1873-9",display:"25-OH Vitamin D [total]",displayPtBR:"Vitamina D total (25-OH)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"49054-0",display:"1,25-dihydroxyvitamin D",displayPtBR:"1,25-dihidroxivitamina D (calcitriol)",unit:"pg/mL",category:"Endocrinologia"},
  {code:"2692-2",display:"Osteocalcin [serum]",displayPtBR:"Osteocalcina sérica",unit:"ng/mL",category:"Endocrinologia"},
  {code:"11053-6",display:"CTx (C-telopeptide)",displayPtBR:"CTx (C-telopeptídeo / CrossLaps)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"56927-6",display:"P1NP [serum]",displayPtBR:"P1NP (propeptídeo N-terminal procolágeno I)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2556-9",display:"Bone-specific ALP",displayPtBR:"Fosfatase alcalina óssea",unit:"U/L",category:"Endocrinologia"},
  {code:"2038-8",display:"Calcitonin [serum]",displayPtBR:"Calcitonina sérica",unit:"pg/mL",category:"Endocrinologia"},
  // Crescimento
  {code:"2484-4",display:"GH [serum]",displayPtBR:"GH (hormônio do crescimento)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2483-6",display:"IGF-1 [serum]",displayPtBR:"IGF-1 (somatomedina C)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2484-4",display:"GH post-stimulation",displayPtBR:"GH pós-estímulo (clonidina/insulina)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2485-1",display:"IGFBP-3 [serum]",displayPtBR:"IGFBP-3",unit:"ng/mL",category:"Endocrinologia"},
  // Hipófise
  {code:"2842-3",display:"Prolactin [serum]",displayPtBR:"Prolactina sérica",unit:"ng/mL",category:"Endocrinologia"},
  {code:"83087-3",display:"Macroprolactin",displayPtBR:"Macroprolactina",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2284-8",display:"FSH [serum]",displayPtBR:"FSH (hormônio folículo estimulante)",unit:"mIU/mL",category:"Endocrinologia"},
  {code:"2503-1",display:"LH [serum]",displayPtBR:"LH (hormônio luteinizante)",unit:"mIU/mL",category:"Endocrinologia"},
  {code:"2243-4",display:"Estradiol [serum]",displayPtBR:"Estradiol (E2)",unit:"pg/mL",category:"Endocrinologia"},
  {code:"2986-8",display:"Testosterone total [serum]",displayPtBR:"Testosterona total",unit:"ng/dL",category:"Endocrinologia"},
  {code:"2991-8",display:"Testosterone free [serum]",displayPtBR:"Testosterona livre",unit:"pg/mL",category:"Endocrinologia"},
  {code:"2779-7",display:"Progesterone [serum]",displayPtBR:"Progesterona sérica",unit:"ng/mL",category:"Endocrinologia"},
  {code:"2039-6",display:"SHBG [serum]",displayPtBR:"SHBG (globulina ligadora de hormônios sexuais)",unit:"nmol/L",category:"Endocrinologia"},
  {code:"15081-3",display:"Androstenedione [serum]",displayPtBR:"Androstenediona sérica",unit:"ng/dL",category:"Endocrinologia"},
  {code:"1668-3",display:"17-OH Progesterone [serum]",displayPtBR:"17-OH Progesterona sérica",unit:"ng/dL",category:"Endocrinologia"},
  {code:"30000-4",display:"AMH [serum]",displayPtBR:"AMH (hormônio anti-Mülleriano)",unit:"ng/mL",category:"Endocrinologia"},
  {code:"83086-5",display:"Inhibin B [serum]",displayPtBR:"Inibina B sérica",unit:"pg/mL",category:"Endocrinologia"},
  // Tireoide expandida
  {code:"3051-0",display:"T3 total [serum]",displayPtBR:"T3 total",unit:"ng/dL",category:"Endocrinologia"},
  {code:"3024-7",display:"T4 total [serum]",displayPtBR:"T4 total",unit:"ug/dL",category:"Endocrinologia"},
  {code:"8099-4",display:"Thyroglobulin [serum]",displayPtBR:"Tireoglobulina sérica",unit:"ng/mL",category:"Endocrinologia"},
  {code:"5765-3",display:"Anti-thyroglobulin Ab",displayPtBR:"Anticorpo anti-tireoglobulina",unit:"IU/mL",category:"Endocrinologia"},
  {code:"56477-3",display:"Anti-TSH receptor Ab (TRAb)",displayPtBR:"TRAb (anticorpo anti-receptor TSH)",unit:"IU/L",category:"Endocrinologia"},
];
