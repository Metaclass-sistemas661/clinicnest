// LOINC - Códigos de Laboratório Expandidos (Parte 6) - Imunologia, Microbiologia Molecular, Radiologia, Documentos Clínicos
import { LoincEntry } from './loinc-laboratorio';

// =============================================
// IMUNOLOGIA EXPANDIDA - Subpopulações e Citocinas
// =============================================
export const LOINC_IMUNOLOGIA: LoincEntry[] = [
  // Subpopulações de linfócitos (citometria de fluxo)
  {code:"8116-6",display:"CD3+ T cells [count]",displayPtBR:"Linfócitos T CD3+ (contagem)",unit:"cells/uL",category:"Imunologia"},
  {code:"8117-4",display:"CD3+ T cells [%]",displayPtBR:"Linfócitos T CD3+ (%)",unit:"%",category:"Imunologia"},
  {code:"8118-2",display:"CD4+ T cells [count]",displayPtBR:"Linfócitos T CD4+ (contagem)",unit:"cells/uL",category:"Imunologia"},
  {code:"8119-0",display:"CD4+ T cells [%]",displayPtBR:"Linfócitos T CD4+ (%)",unit:"%",category:"Imunologia"},
  {code:"8120-8",display:"CD8+ T cells [count]",displayPtBR:"Linfócitos T CD8+ (contagem)",unit:"cells/uL",category:"Imunologia"},
  {code:"8121-6",display:"CD8+ T cells [%]",displayPtBR:"Linfócitos T CD8+ (%)",unit:"%",category:"Imunologia"},
  {code:"54218-0",display:"CD4/CD8 ratio",displayPtBR:"Relação CD4/CD8",unit:"",category:"Imunologia"},
  {code:"8122-4",display:"NK cells (CD16+CD56+) [count]",displayPtBR:"Células NK (CD16+CD56+) contagem",unit:"cells/uL",category:"Imunologia"},
  {code:"8123-2",display:"NK cells (CD16+CD56+) [%]",displayPtBR:"Células NK (CD16+CD56+) %",unit:"%",category:"Imunologia"},
  {code:"8124-0",display:"B cells (CD19+) [count]",displayPtBR:"Linfócitos B CD19+ (contagem)",unit:"cells/uL",category:"Imunologia"},
  {code:"8125-7",display:"B cells (CD19+) [%]",displayPtBR:"Linfócitos B CD19+ (%)",unit:"%",category:"Imunologia"},
  {code:"24110-9",display:"T cell subsets panel",displayPtBR:"Painel subpopulações de linfócitos T",unit:"",category:"Imunologia"},
  // Citocinas
  {code:"26881-3",display:"IL-6 [serum]",displayPtBR:"Interleucina-6 (IL-6)",unit:"pg/mL",category:"Imunologia"},
  {code:"33762-6",display:"IL-1 beta [serum]",displayPtBR:"Interleucina-1 beta (IL-1b)",unit:"pg/mL",category:"Imunologia"},
  {code:"21214-2",display:"IL-2 receptor soluble",displayPtBR:"Receptor solúvel de IL-2 (sIL-2R)",unit:"U/mL",category:"Imunologia"},
  {code:"33763-4",display:"IL-8 [serum]",displayPtBR:"Interleucina-8 (IL-8)",unit:"pg/mL",category:"Imunologia"},
  {code:"33764-2",display:"IL-10 [serum]",displayPtBR:"Interleucina-10 (IL-10)",unit:"pg/mL",category:"Imunologia"},
  {code:"33765-9",display:"TNF-alpha [serum]",displayPtBR:"Fator de necrose tumoral alfa (TNF-a)",unit:"pg/mL",category:"Imunologia"},
  {code:"56777-5",display:"Interferon-gamma [serum]",displayPtBR:"Interferon-gama (IFN-g)",unit:"pg/mL",category:"Imunologia"},
  // Imunodeficiências e complemento
  {code:"4054-3",display:"CH50 [serum]",displayPtBR:"Complemento hemolítico total (CH50)",unit:"U/mL",category:"Imunologia"},
  {code:"4498-2",display:"C1 inhibitor [serum]",displayPtBR:"Inibidor de C1 esterase (quantitativo)",unit:"mg/dL",category:"Imunologia"},
  {code:"4499-0",display:"C1 inhibitor functional",displayPtBR:"Inibidor de C1 esterase (funcional)",unit:"%",category:"Imunologia"},
  {code:"2458-8",display:"IgA [serum]",displayPtBR:"Imunoglobulina A (IgA) sérica",unit:"mg/dL",category:"Imunologia"},
  {code:"2464-6",display:"IgG subclass 1",displayPtBR:"IgG subclasse 1",unit:"mg/dL",category:"Imunologia"},
  {code:"2466-1",display:"IgG subclass 2",displayPtBR:"IgG subclasse 2",unit:"mg/dL",category:"Imunologia"},
  {code:"2468-7",display:"IgG subclass 3",displayPtBR:"IgG subclasse 3",unit:"mg/dL",category:"Imunologia"},
  {code:"2470-3",display:"IgG subclass 4",displayPtBR:"IgG subclasse 4",unit:"mg/dL",category:"Imunologia"},
  {code:"2462-0",display:"IgM [serum]",displayPtBR:"Imunoglobulina M (IgM) sérica",unit:"mg/dL",category:"Imunologia"},
  {code:"19113-0",display:"IgE total [serum]",displayPtBR:"IgE total sérica",unit:"IU/mL",category:"Imunologia"},
  // Testes funcionais imunológicos
  {code:"31208-2",display:"IGRA/Quantiferon TB",displayPtBR:"IGRA / Quantiferon (TB)",unit:"",category:"Imunologia"},
  {code:"71774-8",display:"T-SPOT.TB",displayPtBR:"T-SPOT.TB (ELISPOT)",unit:"",category:"Imunologia"},
  {code:"5090-6",display:"DHR/NBT oxidative burst",displayPtBR:"Burst oxidativo (DHR/NBT)",unit:"%",category:"Imunologia"},
  {code:"30391-7",display:"Lymphocyte proliferation",displayPtBR:"Proliferação linfocitária (mitógenos)",unit:"",category:"Imunologia"},
];

// =============================================
// MICROBIOLOGIA MOLECULAR - PCR para patógenos
// =============================================
export const LOINC_MICROB_MOLECULAR: LoincEntry[] = [
  // Vírus respiratórios
  {code:"94500-6",display:"SARS-CoV-2 RNA [PCR]",displayPtBR:"SARS-CoV-2 PCR (COVID-19)",unit:"",category:"Microbiologia Molecular"},
  {code:"95406-5",display:"SARS-CoV-2 RNA [rapid]",displayPtBR:"SARS-CoV-2 PCR rápido",unit:"",category:"Microbiologia Molecular"},
  {code:"94558-4",display:"SARS-CoV-2 Ag [rapid]",displayPtBR:"SARS-CoV-2 Antígeno rápido",unit:"",category:"Microbiologia Molecular"},
  {code:"94563-4",display:"SARS-CoV-2 IgG",displayPtBR:"SARS-CoV-2 IgG (sorologia)",unit:"",category:"Microbiologia Molecular"},
  {code:"94564-2",display:"SARS-CoV-2 IgM",displayPtBR:"SARS-CoV-2 IgM (sorologia)",unit:"",category:"Microbiologia Molecular"},
  {code:"76078-5",display:"Influenza A RNA [PCR]",displayPtBR:"Influenza A PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"76080-1",display:"Influenza B RNA [PCR]",displayPtBR:"Influenza B PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"92142-9",display:"Influenza A+B RNA [PCR]",displayPtBR:"Influenza A+B PCR combinado",unit:"",category:"Microbiologia Molecular"},
  {code:"88891-7",display:"RSV RNA [PCR]",displayPtBR:"Vírus Sincicial Respiratório (VSR) PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"92131-2",display:"Respiratory panel [PCR]",displayPtBR:"Painel respiratório PCR multiplex",unit:"",category:"Microbiologia Molecular"},
  {code:"92132-0",display:"Adenovirus DNA [PCR]",displayPtBR:"Adenovírus DNA PCR",unit:"",category:"Microbiologia Molecular"},
  // Herpesvírus
  {code:"5000-5",display:"HSV 1 DNA [PCR]",displayPtBR:"HSV-1 (Herpes simplex 1) DNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"5001-3",display:"HSV 2 DNA [PCR]",displayPtBR:"HSV-2 (Herpes simplex 2) DNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"5836-8",display:"VZV DNA [PCR]",displayPtBR:"Varicela-Zóster (VZV) DNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"5000-5",display:"CMV DNA quantitative [PCR]",displayPtBR:"CMV DNA quantitativo (carga viral)",unit:"copies/mL",category:"Microbiologia Molecular"},
  {code:"5003-9",display:"EBV DNA quantitative [PCR]",displayPtBR:"EBV DNA quantitativo (carga viral)",unit:"copies/mL",category:"Microbiologia Molecular"},
  {code:"49349-4",display:"HHV-6 DNA [PCR]",displayPtBR:"HHV-6 DNA PCR",unit:"",category:"Microbiologia Molecular"},
  // Hepatites
  {code:"20416-4",display:"HBV DNA quantitative [PCR]",displayPtBR:"HBV DNA quantitativo (carga viral)",unit:"IU/mL",category:"Microbiologia Molecular"},
  {code:"11259-9",display:"HCV RNA quantitative [PCR]",displayPtBR:"HCV RNA quantitativo (carga viral)",unit:"IU/mL",category:"Microbiologia Molecular"},
  {code:"32286-7",display:"HCV genotype",displayPtBR:"HCV genotipagem",unit:"",category:"Microbiologia Molecular"},
  // HIV
  {code:"20447-9",display:"HIV-1 RNA quantitative [PCR]",displayPtBR:"HIV-1 carga viral (RNA quantitativo)",unit:"copies/mL",category:"Microbiologia Molecular"},
  {code:"25836-8",display:"HIV-1 genotype resistance",displayPtBR:"HIV-1 genotipagem de resistência",unit:"",category:"Microbiologia Molecular"},
  // Micobactérias
  {code:"38375-2",display:"MTB complex DNA [PCR]",displayPtBR:"Mycobacterium tuberculosis PCR (GeneXpert)",unit:"",category:"Microbiologia Molecular"},
  {code:"46244-0",display:"MTB rifampin resistance [PCR]",displayPtBR:"M. tuberculosis resistência a rifampicina",unit:"",category:"Microbiologia Molecular"},
  // ISTs
  {code:"21613-5",display:"Chlamydia trachomatis DNA [PCR]",displayPtBR:"Chlamydia trachomatis PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"21415-5",display:"Neisseria gonorrhoeae DNA [PCR]",displayPtBR:"Neisseria gonorrhoeae PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"21440-3",display:"HPV DNA [PCR]",displayPtBR:"HPV DNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"77379-6",display:"HPV genotyping [PCR]",displayPtBR:"HPV genotipagem PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"21441-1",display:"Trichomonas vaginalis DNA [PCR]",displayPtBR:"Trichomonas vaginalis PCR",unit:"",category:"Microbiologia Molecular"},
  // Arboviroses moleculares
  {code:"86588-7",display:"Dengue virus RNA [PCR]",displayPtBR:"Dengue vírus RNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"86589-5",display:"Zika virus RNA [PCR]",displayPtBR:"Zika vírus RNA PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"86590-3",display:"Chikungunya virus RNA [PCR]",displayPtBR:"Chikungunya vírus RNA PCR",unit:"",category:"Microbiologia Molecular"},
  // Meningite/Encefalite
  {code:"92253-4",display:"Meningitis/Encephalitis panel [PCR]",displayPtBR:"Painel meningite/encefalite PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"49521-8",display:"Enterovirus RNA [CSF PCR]",displayPtBR:"Enterovírus RNA PCR (líquor)",unit:"",category:"Microbiologia Molecular"},
  // GI panel
  {code:"88876-8",display:"GI pathogen panel [PCR]",displayPtBR:"Painel patógenos gastrointestinais PCR",unit:"",category:"Microbiologia Molecular"},
  {code:"82196-3",display:"C. difficile toxin gene [PCR]",displayPtBR:"C. difficile gene de toxina PCR",unit:"",category:"Microbiologia Molecular"},
  // Fungos
  {code:"42176-1",display:"Aspergillus galactomannan",displayPtBR:"Galactomanana (Aspergillus)",unit:"index",category:"Microbiologia Molecular"},
  {code:"31209-0",display:"Beta-D-glucan",displayPtBR:"Beta-D-glucana (fungos)",unit:"pg/mL",category:"Microbiologia Molecular"},
  {code:"43925-0",display:"Cryptococcal antigen",displayPtBR:"Antígeno criptocócico (CrAg)",unit:"",category:"Microbiologia Molecular"},
];

// =============================================
// RADIOLOGIA / ORDENS DE IMAGEM (LOINC)
// =============================================
export const LOINC_RADIOLOGIA: LoincEntry[] = [
  // Radiografia (RX)
  {code:"24642-1",display:"XR Chest PA and lateral",displayPtBR:"RX Tórax PA e perfil",unit:"",category:"Radiologia"},
  {code:"38268-9",display:"XR Chest AP",displayPtBR:"RX Tórax AP",unit:"",category:"Radiologia"},
  {code:"37620-2",display:"XR Abdomen AP",displayPtBR:"RX Abdome AP",unit:"",category:"Radiologia"},
  {code:"36554-4",display:"XR Spine cervical",displayPtBR:"RX Coluna cervical",unit:"",category:"Radiologia"},
  {code:"36572-6",display:"XR Spine lumbar",displayPtBR:"RX Coluna lombar",unit:"",category:"Radiologia"},
  {code:"37436-3",display:"XR Hand",displayPtBR:"RX Mão",unit:"",category:"Radiologia"},
  {code:"37166-6",display:"XR Knee",displayPtBR:"RX Joelho",unit:"",category:"Radiologia"},
  {code:"24558-9",display:"XR Pelvis",displayPtBR:"RX Bacia/Pelve",unit:"",category:"Radiologia"},
  {code:"30746-2",display:"XR Skull",displayPtBR:"RX Crânio",unit:"",category:"Radiologia"},
  {code:"38082-4",display:"XR Panoramic dental",displayPtBR:"Radiografia panorâmica odontológica",unit:"",category:"Radiologia"},
  {code:"38070-9",display:"XR Periapical dental",displayPtBR:"Radiografia periapical odontológica",unit:"",category:"Radiologia"},
  // Tomografia Computadorizada (TC)
  {code:"24725-4",display:"CT Head",displayPtBR:"TC Crânio",unit:"",category:"Radiologia"},
  {code:"24726-2",display:"CT Head with contrast",displayPtBR:"TC Crânio com contraste",unit:"",category:"Radiologia"},
  {code:"24627-2",display:"CT Chest",displayPtBR:"TC Tórax",unit:"",category:"Radiologia"},
  {code:"24628-0",display:"CT Chest with contrast",displayPtBR:"TC Tórax com contraste",unit:"",category:"Radiologia"},
  {code:"24531-6",display:"CT Abdomen",displayPtBR:"TC Abdome",unit:"",category:"Radiologia"},
  {code:"24532-4",display:"CT Abdomen with contrast",displayPtBR:"TC Abdome com contraste",unit:"",category:"Radiologia"},
  {code:"24559-7",display:"CT Pelvis",displayPtBR:"TC Pelve",unit:"",category:"Radiologia"},
  {code:"36813-4",display:"CT Spine cervical",displayPtBR:"TC Coluna cervical",unit:"",category:"Radiologia"},
  {code:"36822-5",display:"CT Spine lumbar",displayPtBR:"TC Coluna lombar",unit:"",category:"Radiologia"},
  {code:"30799-1",display:"CT Angiography chest",displayPtBR:"Angiotomografia de tórax (TEP)",unit:"",category:"Radiologia"},
  {code:"39060-9",display:"CT Coronary calcium score",displayPtBR:"Escore de cálcio coronariano (TC)",unit:"",category:"Radiologia"},
  {code:"36143-2",display:"CT Angiography coronary",displayPtBR:"Angiotomografia coronariana",unit:"",category:"Radiologia"},
  // Ressonância Magnética (RM)
  {code:"24590-2",display:"MR Brain",displayPtBR:"RM Encéfalo/Crânio",unit:"",category:"Radiologia"},
  {code:"24591-0",display:"MR Brain with contrast",displayPtBR:"RM Encéfalo com contraste",unit:"",category:"Radiologia"},
  {code:"36149-9",display:"MR Spine cervical",displayPtBR:"RM Coluna cervical",unit:"",category:"Radiologia"},
  {code:"36150-7",display:"MR Spine thoracic",displayPtBR:"RM Coluna torácica",unit:"",category:"Radiologia"},
  {code:"36151-5",display:"MR Spine lumbar",displayPtBR:"RM Coluna lombar",unit:"",category:"Radiologia"},
  {code:"24566-2",display:"MR Knee",displayPtBR:"RM Joelho",unit:"",category:"Radiologia"},
  {code:"24550-6",display:"MR Shoulder",displayPtBR:"RM Ombro",unit:"",category:"Radiologia"},
  {code:"24556-3",display:"MR Cardiac",displayPtBR:"RM Cardíaca",unit:"",category:"Radiologia"},
  {code:"36813-4",display:"MR Abdomen",displayPtBR:"RM Abdome",unit:"",category:"Radiologia"},
  {code:"36397-8",display:"MR Pelvis",displayPtBR:"RM Pelve",unit:"",category:"Radiologia"},
  {code:"44139-2",display:"MR Breast",displayPtBR:"RM Mama",unit:"",category:"Radiologia"},
  // Ultrassonografia (US)
  {code:"24648-8",display:"US Abdomen complete",displayPtBR:"USG Abdome total",unit:"",category:"Radiologia"},
  {code:"24641-3",display:"US Thyroid",displayPtBR:"USG Tireoide",unit:"",category:"Radiologia"},
  {code:"24606-6",display:"US Breast",displayPtBR:"USG Mama",unit:"",category:"Radiologia"},
  {code:"24649-6",display:"US Pelvis",displayPtBR:"USG Pélvica",unit:"",category:"Radiologia"},
  {code:"11525-3",display:"US Obstetric",displayPtBR:"USG Obstétrica",unit:"",category:"Radiologia"},
  {code:"24620-7",display:"US Doppler carotid",displayPtBR:"Doppler de carótidas",unit:"",category:"Radiologia"},
  {code:"24623-1",display:"US Doppler lower extremity",displayPtBR:"Doppler venoso MMII",unit:"",category:"Radiologia"},
  {code:"24623-1",display:"US Renal with Doppler",displayPtBR:"USG Renal com Doppler",unit:"",category:"Radiologia"},
  {code:"24618-1",display:"US Echocardiogram",displayPtBR:"Ecocardiograma transtorácico",unit:"",category:"Radiologia"},
  // Mamografia
  {code:"24604-1",display:"Mammography bilateral",displayPtBR:"Mamografia bilateral",unit:"",category:"Radiologia"},
  {code:"24605-8",display:"Mammography unilateral",displayPtBR:"Mamografia unilateral",unit:"",category:"Radiologia"},
  {code:"72142-7",display:"Digital breast tomosynthesis",displayPtBR:"Tomossíntese mamária",unit:"",category:"Radiologia"},
  // Densitometria
  {code:"38265-5",display:"DXA Bone density",displayPtBR:"Densitometria óssea (DXA)",unit:"",category:"Radiologia"},
  {code:"38267-1",display:"DXA Spine",displayPtBR:"Densitometria coluna lombar",unit:"g/cm2",category:"Radiologia"},
  {code:"38266-3",display:"DXA Hip",displayPtBR:"Densitometria fêmur/quadril",unit:"g/cm2",category:"Radiologia"},
  // Medicina Nuclear
  {code:"24699-1",display:"Bone scan",displayPtBR:"Cintilografia óssea",unit:"",category:"Radiologia"},
  {code:"24546-4",display:"Thyroid scan",displayPtBR:"Cintilografia de tireoide",unit:"",category:"Radiologia"},
  {code:"39812-3",display:"PET-CT whole body",displayPtBR:"PET-CT corpo inteiro",unit:"",category:"Radiologia"},
  {code:"24700-7",display:"Myocardial perfusion scan",displayPtBR:"Cintilografia miocárdica de perfusão",unit:"",category:"Radiologia"},
  {code:"24547-2",display:"Renal scan (DTPA/DMSA)",displayPtBR:"Cintilografia renal (DTPA/DMSA)",unit:"",category:"Radiologia"},
];

// =============================================
// DOCUMENTOS CLÍNICOS (LOINC document codes)
// =============================================
export const LOINC_DOCUMENTOS: LoincEntry[] = [
  // Resumos e notas
  {code:"11503-0",display:"Medical records",displayPtBR:"Prontuário médico",unit:"",category:"Documentos Clínicos"},
  {code:"34133-9",display:"Summarization of episode note",displayPtBR:"Sumário de atendimento",unit:"",category:"Documentos Clínicos"},
  {code:"18842-5",display:"Discharge summary",displayPtBR:"Resumo de alta hospitalar",unit:"",category:"Documentos Clínicos"},
  {code:"11490-0",display:"Physician discharge summary",displayPtBR:"Sumário de alta médica",unit:"",category:"Documentos Clínicos"},
  {code:"28570-0",display:"Procedure note",displayPtBR:"Nota de procedimento",unit:"",category:"Documentos Clínicos"},
  {code:"11504-8",display:"Surgical operation note",displayPtBR:"Nota operatória / Descrição cirúrgica",unit:"",category:"Documentos Clínicos"},
  {code:"11506-3",display:"Progress note",displayPtBR:"Evolução médica",unit:"",category:"Documentos Clínicos"},
  {code:"34117-2",display:"History and physical note",displayPtBR:"Anamnese e exame físico",unit:"",category:"Documentos Clínicos"},
  {code:"57133-1",display:"Referral note",displayPtBR:"Encaminhamento / Referência",unit:"",category:"Documentos Clínicos"},
  {code:"18761-7",display:"Transfer summary",displayPtBR:"Resumo de transferência",unit:"",category:"Documentos Clínicos"},
  // Consentimentos e planos
  {code:"59284-0",display:"Consent document",displayPtBR:"Documento de consentimento",unit:"",category:"Documentos Clínicos"},
  {code:"57016-8",display:"Privacy consent",displayPtBR:"Consentimento de privacidade (LGPD)",unit:"",category:"Documentos Clínicos"},
  {code:"18776-5",display:"Plan of care note",displayPtBR:"Plano de cuidados",unit:"",category:"Documentos Clínicos"},
  {code:"29545-1",display:"Physical examination",displayPtBR:"Exame físico",unit:"",category:"Documentos Clínicos"},
  // Laudos e relatórios
  {code:"11526-1",display:"Pathology report",displayPtBR:"Laudo anatomopatológico",unit:"",category:"Documentos Clínicos"},
  {code:"18748-4",display:"Diagnostic imaging report",displayPtBR:"Laudo de imagem diagnóstica",unit:"",category:"Documentos Clínicos"},
  {code:"11502-2",display:"Laboratory report",displayPtBR:"Laudo laboratorial",unit:"",category:"Documentos Clínicos"},
  {code:"27898-6",display:"ECG report",displayPtBR:"Laudo de eletrocardiograma",unit:"",category:"Documentos Clínicos"},
  {code:"18745-0",display:"Cardiac catheterization report",displayPtBR:"Laudo de cateterismo cardíaco",unit:"",category:"Documentos Clínicos"},
  {code:"18746-8",display:"Colonoscopy report",displayPtBR:"Laudo de colonoscopia",unit:"",category:"Documentos Clínicos"},
  {code:"18751-8",display:"Endoscopy report",displayPtBR:"Laudo de endoscopia digestiva alta",unit:"",category:"Documentos Clínicos"},
  {code:"18752-6",display:"Exercise stress test report",displayPtBR:"Laudo de teste ergométrico",unit:"",category:"Documentos Clínicos"},
  // Prescrições e medicamentos
  {code:"57833-6",display:"Prescription",displayPtBR:"Prescrição médica",unit:"",category:"Documentos Clínicos"},
  {code:"56445-0",display:"Medication list",displayPtBR:"Lista de medicamentos em uso",unit:"",category:"Documentos Clínicos"},
  {code:"18682-5",display:"Allergy list",displayPtBR:"Lista de alergias",unit:"",category:"Documentos Clínicos"},
  {code:"11369-6",display:"Immunization history",displayPtBR:"Histórico de vacinação",unit:"",category:"Documentos Clínicos"},
  {code:"42348-3",display:"Advance directives",displayPtBR:"Diretivas antecipadas de vontade",unit:"",category:"Documentos Clínicos"},
  // Atestados e declarações (Brasil)
  {code:"64297-5",display:"Death certificate",displayPtBR:"Declaração de óbito (DO)",unit:"",category:"Documentos Clínicos"},
  {code:"46241-6",display:"Hospital notification",displayPtBR:"Notificação hospitalar / compulsória",unit:"",category:"Documentos Clínicos"},
  {code:"28573-4",display:"Medical certificate",displayPtBR:"Atestado médico",unit:"",category:"Documentos Clínicos"},
];
