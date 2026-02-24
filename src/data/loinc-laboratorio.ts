// LOINC - Códigos de Laboratório Expandidos
export interface LoincEntry {
  code: string;
  display: string;
  displayPtBR: string;
  unit: string;
  category: string;
}

// Hematologia Completa
export const LOINC_HEMATOLOGIA: LoincEntry[] = [
  {code:"58410-2",display:"Complete blood count",displayPtBR:"Hemograma completo",unit:"",category:"Hematologia"},
  {code:"718-7",display:"Hemoglobin",displayPtBR:"Hemoglobina",unit:"g/dL",category:"Hematologia"},
  {code:"4544-3",display:"Hematocrit",displayPtBR:"Hematócrito",unit:"%",category:"Hematologia"},
  {code:"6690-2",display:"Leukocytes (WBC)",displayPtBR:"Leucócitos",unit:"10*3/uL",category:"Hematologia"},
  {code:"26515-7",display:"Platelets",displayPtBR:"Plaquetas",unit:"10*3/uL",category:"Hematologia"},
  {code:"789-8",display:"Erythrocytes (RBC)",displayPtBR:"Hemácias",unit:"10*6/uL",category:"Hematologia"},
  {code:"4679-7",display:"Reticulocytes",displayPtBR:"Reticulócitos",unit:"%",category:"Hematologia"},
  {code:"787-2",display:"MCV",displayPtBR:"Volume corpuscular médio (VCM)",unit:"fL",category:"Hematologia"},
  {code:"785-6",display:"MCH",displayPtBR:"Hemoglobina corpuscular média (HCM)",unit:"pg",category:"Hematologia"},
  {code:"786-4",display:"MCHC",displayPtBR:"Concentração de hemoglobina corpuscular média (CHCM)",unit:"g/dL",category:"Hematologia"},
  {code:"788-0",display:"RDW",displayPtBR:"Amplitude de distribuição eritrocitária (RDW)",unit:"%",category:"Hematologia"},
  {code:"32623-1",display:"MPV",displayPtBR:"Volume plaquetário médio (VPM)",unit:"fL",category:"Hematologia"},
  {code:"751-8",display:"Neutrophils %",displayPtBR:"Neutrófilos %",unit:"%",category:"Hematologia"},
  {code:"26499-4",display:"Neutrophils #",displayPtBR:"Neutrófilos absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"736-9",display:"Lymphocytes %",displayPtBR:"Linfócitos %",unit:"%",category:"Hematologia"},
  {code:"26474-7",display:"Lymphocytes #",displayPtBR:"Linfócitos absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"5905-5",display:"Monocytes %",displayPtBR:"Monócitos %",unit:"%",category:"Hematologia"},
  {code:"26484-6",display:"Monocytes #",displayPtBR:"Monócitos absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"713-8",display:"Eosinophils %",displayPtBR:"Eosinófilos %",unit:"%",category:"Hematologia"},
  {code:"26449-9",display:"Eosinophils #",displayPtBR:"Eosinófilos absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"706-2",display:"Basophils %",displayPtBR:"Basófilos %",unit:"%",category:"Hematologia"},
  {code:"26444-0",display:"Basophils #",displayPtBR:"Basófilos absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"30180-4",display:"Bands %",displayPtBR:"Bastões %",unit:"%",category:"Hematologia"},
  {code:"35332-6",display:"Bands #",displayPtBR:"Bastões absolutos",unit:"10*3/uL",category:"Hematologia"},
  {code:"731-0",display:"Lymphocytes atypical %",displayPtBR:"Linfócitos atípicos %",unit:"%",category:"Hematologia"},
  {code:"30433-7",display:"Metamyelocytes %",displayPtBR:"Metamielócitos %",unit:"%",category:"Hematologia"},
  {code:"30446-9",display:"Myelocytes %",displayPtBR:"Mielócitos %",unit:"%",category:"Hematologia"},
  {code:"34926-6",display:"Promyelocytes %",displayPtBR:"Promielócitos %",unit:"%",category:"Hematologia"},
  {code:"30376-8",display:"Blasts %",displayPtBR:"Blastos %",unit:"%",category:"Hematologia"},
  {code:"4633-4",display:"Nucleated RBC %",displayPtBR:"Eritroblastos %",unit:"%",category:"Hematologia"},
];

// Coagulação
export const LOINC_COAGULACAO: LoincEntry[] = [
  {code:"5902-2",display:"Prothrombin time (PT)",displayPtBR:"Tempo de protrombina (TP)",unit:"s",category:"Coagulação"},
  {code:"6301-6",display:"INR",displayPtBR:"INR",unit:"",category:"Coagulação"},
  {code:"3173-2",display:"aPTT",displayPtBR:"TTPA",unit:"s",category:"Coagulação"},
  {code:"3255-7",display:"Fibrinogen",displayPtBR:"Fibrinogênio",unit:"mg/dL",category:"Coagulação"},
  {code:"3243-3",display:"Thrombin time",displayPtBR:"Tempo de trombina",unit:"s",category:"Coagulação"},
  {code:"27811-9",display:"D-dimer",displayPtBR:"D-dímero",unit:"ng/mL",category:"Coagulação"},
  {code:"3184-9",display:"Antithrombin III activity",displayPtBR:"Antitrombina III",unit:"%",category:"Coagulação"},
  {code:"27816-8",display:"Protein C activity",displayPtBR:"Proteína C",unit:"%",category:"Coagulação"},
  {code:"27820-0",display:"Protein S activity",displayPtBR:"Proteína S",unit:"%",category:"Coagulação"},
  {code:"13590-5",display:"Factor V Leiden",displayPtBR:"Fator V de Leiden",unit:"",category:"Coagulação"},
  {code:"3209-4",display:"Factor VIII activity",displayPtBR:"Fator VIII",unit:"%",category:"Coagulação"},
  {code:"3212-8",display:"Factor IX activity",displayPtBR:"Fator IX",unit:"%",category:"Coagulação"},
  {code:"6012-8",display:"von Willebrand factor",displayPtBR:"Fator de von Willebrand",unit:"%",category:"Coagulação"},
  {code:"5894-1",display:"Prothrombin time activity",displayPtBR:"Atividade de protrombina",unit:"%",category:"Coagulação"},
  {code:"34714-6",display:"Lupus anticoagulant",displayPtBR:"Anticoagulante lúpico",unit:"",category:"Coagulação"},
];

// Bioquímica - Glicemia e Diabetes
export const LOINC_GLICEMIA: LoincEntry[] = [
  {code:"2345-7",display:"Glucose [fasting]",displayPtBR:"Glicemia de jejum",unit:"mg/dL",category:"Glicemia"},
  {code:"4548-4",display:"Hemoglobin A1c",displayPtBR:"Hemoglobina glicada (HbA1c)",unit:"%",category:"Glicemia"},
  {code:"1558-6",display:"Glucose [post-meal]",displayPtBR:"Glicemia pós-prandial",unit:"mg/dL",category:"Glicemia"},
  {code:"2339-0",display:"Glucose [random]",displayPtBR:"Glicemia casual",unit:"mg/dL",category:"Glicemia"},
  {code:"1521-4",display:"Glucose tolerance test",displayPtBR:"Teste de tolerância à glicose (TOTG)",unit:"mg/dL",category:"Glicemia"},
  {code:"1504-0",display:"Glucose 1h post 75g",displayPtBR:"Glicemia 1h pós 75g",unit:"mg/dL",category:"Glicemia"},
  {code:"1518-0",display:"Glucose 2h post 75g",displayPtBR:"Glicemia 2h pós 75g",unit:"mg/dL",category:"Glicemia"},
  {code:"2340-8",display:"Glucose [urine]",displayPtBR:"Glicosúria",unit:"mg/dL",category:"Glicemia"},
  {code:"1753-3",display:"Fructosamine",displayPtBR:"Frutosamina",unit:"umol/L",category:"Glicemia"},
  {code:"2885-2",display:"Insulin",displayPtBR:"Insulina",unit:"uIU/mL",category:"Glicemia"},
  {code:"1986-9",display:"C-peptide",displayPtBR:"Peptídeo C",unit:"ng/mL",category:"Glicemia"},
  {code:"56540-8",display:"HOMA-IR",displayPtBR:"HOMA-IR",unit:"",category:"Glicemia"},
  {code:"53049-3",display:"Glucose average (estimated)",displayPtBR:"Glicemia média estimada",unit:"mg/dL",category:"Glicemia"},
];

// Lipídios
export const LOINC_LIPIDIOS: LoincEntry[] = [
  {code:"2093-3",display:"Cholesterol total",displayPtBR:"Colesterol total",unit:"mg/dL",category:"Lipídios"},
  {code:"2085-9",display:"HDL Cholesterol",displayPtBR:"Colesterol HDL",unit:"mg/dL",category:"Lipídios"},
  {code:"2089-1",display:"LDL Cholesterol",displayPtBR:"Colesterol LDL",unit:"mg/dL",category:"Lipídios"},
  {code:"2571-8",display:"Triglycerides",displayPtBR:"Triglicerídeos",unit:"mg/dL",category:"Lipídios"},
  {code:"13457-7",display:"VLDL Cholesterol",displayPtBR:"Colesterol VLDL",unit:"mg/dL",category:"Lipídios"},
  {code:"9830-1",display:"Cholesterol/HDL ratio",displayPtBR:"Relação colesterol total/HDL",unit:"",category:"Lipídios"},
  {code:"13458-5",display:"LDL/HDL ratio",displayPtBR:"Relação LDL/HDL",unit:"",category:"Lipídios"},
  {code:"43396-1",display:"Non-HDL Cholesterol",displayPtBR:"Colesterol não-HDL",unit:"mg/dL",category:"Lipídios"},
  {code:"35198-1",display:"Apolipoprotein A-I",displayPtBR:"Apolipoproteína A-I",unit:"mg/dL",category:"Lipídios"},
  {code:"35199-9",display:"Apolipoprotein B",displayPtBR:"Apolipoproteína B",unit:"mg/dL",category:"Lipídios"},
  {code:"43583-4",display:"Lipoprotein(a)",displayPtBR:"Lipoproteína(a)",unit:"nmol/L",category:"Lipídios"},
  {code:"2091-7",display:"LDL Cholesterol (direct)",displayPtBR:"Colesterol LDL direto",unit:"mg/dL",category:"Lipídios"},
];

// Função Renal
export const LOINC_RENAL: LoincEntry[] = [
  {code:"2160-0",display:"Creatinine",displayPtBR:"Creatinina",unit:"mg/dL",category:"Função Renal"},
  {code:"3094-0",display:"Urea nitrogen (BUN)",displayPtBR:"Ureia",unit:"mg/dL",category:"Função Renal"},
  {code:"33914-3",display:"eGFR (CKD-EPI)",displayPtBR:"Taxa de filtração glomerular estimada",unit:"mL/min/1.73m2",category:"Função Renal"},
  {code:"3084-1",display:"Uric acid",displayPtBR:"Ácido úrico",unit:"mg/dL",category:"Função Renal"},
  {code:"2161-8",display:"Creatinine [urine]",displayPtBR:"Creatinina urinária",unit:"mg/dL",category:"Função Renal"},
  {code:"14959-1",display:"Microalbumin [urine]",displayPtBR:"Microalbuminúria",unit:"mg/L",category:"Função Renal"},
  {code:"14958-3",display:"Albumin/Creatinine ratio",displayPtBR:"Relação albumina/creatinina",unit:"mg/g",category:"Função Renal"},
  {code:"2888-6",display:"Protein [urine]",displayPtBR:"Proteinúria",unit:"mg/dL",category:"Função Renal"},
  {code:"2889-4",display:"Protein [24h urine]",displayPtBR:"Proteinúria 24h",unit:"mg/24h",category:"Função Renal"},
  {code:"1755-8",display:"Creatinine clearance",displayPtBR:"Clearance de creatinina",unit:"mL/min",category:"Função Renal"},
  {code:"2164-2",display:"Creatinine [24h urine]",displayPtBR:"Creatinina urinária 24h",unit:"mg/24h",category:"Função Renal"},
  {code:"21482-5",display:"Cystatin C",displayPtBR:"Cistatina C",unit:"mg/L",category:"Função Renal"},
  {code:"50561-0",display:"eGFR (Cystatin C)",displayPtBR:"TFG estimada (Cistatina C)",unit:"mL/min/1.73m2",category:"Função Renal"},
  {code:"2965-2",display:"Specific gravity [urine]",displayPtBR:"Densidade urinária",unit:"",category:"Função Renal"},
  {code:"2756-5",display:"pH [urine]",displayPtBR:"pH urinário",unit:"",category:"Função Renal"},
];

// Função Hepática
export const LOINC_HEPATICA: LoincEntry[] = [
  {code:"1742-6",display:"ALT (TGP)",displayPtBR:"TGP (ALT)",unit:"U/L",category:"Função Hepática"},
  {code:"1920-8",display:"AST (TGO)",displayPtBR:"TGO (AST)",unit:"U/L",category:"Função Hepática"},
  {code:"6768-6",display:"Alkaline phosphatase",displayPtBR:"Fosfatase alcalina",unit:"U/L",category:"Função Hepática"},
  {code:"2324-2",display:"GGT",displayPtBR:"Gama-GT (GGT)",unit:"U/L",category:"Função Hepática"},
  {code:"1975-2",display:"Total Bilirubin",displayPtBR:"Bilirrubina total",unit:"mg/dL",category:"Função Hepática"},
  {code:"1968-7",display:"Direct Bilirubin",displayPtBR:"Bilirrubina direta",unit:"mg/dL",category:"Função Hepática"},
  {code:"1971-1",display:"Indirect Bilirubin",displayPtBR:"Bilirrubina indireta",unit:"mg/dL",category:"Função Hepática"},
  {code:"1751-7",display:"Albumin",displayPtBR:"Albumina",unit:"g/dL",category:"Função Hepática"},
  {code:"2885-2",display:"Total Protein",displayPtBR:"Proteínas totais",unit:"g/dL",category:"Função Hepática"},
  {code:"10834-0",display:"Globulin",displayPtBR:"Globulinas",unit:"g/dL",category:"Função Hepática"},
  {code:"1759-0",display:"Albumin/Globulin ratio",displayPtBR:"Relação albumina/globulina",unit:"",category:"Função Hepática"},
  {code:"1825-9",display:"Ammonia",displayPtBR:"Amônia",unit:"umol/L",category:"Função Hepática"},
  {code:"1916-6",display:"AST/ALT ratio",displayPtBR:"Relação TGO/TGP",unit:"",category:"Função Hepática"},
  {code:"2532-0",display:"LDH",displayPtBR:"Desidrogenase láctica (LDH)",unit:"U/L",category:"Função Hepática"},
  {code:"1798-8",display:"Amylase",displayPtBR:"Amilase",unit:"U/L",category:"Função Hepática"},
  {code:"2519-7",display:"Lipase",displayPtBR:"Lipase",unit:"U/L",category:"Função Hepática"},
];

// Tireoide
export const LOINC_TIREOIDE: LoincEntry[] = [
  {code:"3016-3",display:"TSH",displayPtBR:"TSH",unit:"mIU/L",category:"Tireoide"},
  {code:"3026-2",display:"Free T4",displayPtBR:"T4 livre",unit:"ng/dL",category:"Tireoide"},
  {code:"3053-6",display:"Free T3",displayPtBR:"T3 livre",unit:"pg/mL",category:"Tireoide"},
  {code:"3024-7",display:"Total T4",displayPtBR:"T4 total",unit:"ug/dL",category:"Tireoide"},
  {code:"3051-0",display:"Total T3",displayPtBR:"T3 total",unit:"ng/dL",category:"Tireoide"},
  {code:"3013-0",display:"T3 uptake",displayPtBR:"Captação de T3",unit:"%",category:"Tireoide"},
  {code:"5385-0",display:"Anti-TPO antibodies",displayPtBR:"Anticorpos anti-TPO",unit:"IU/mL",category:"Tireoide"},
  {code:"5382-7",display:"Anti-thyroglobulin antibodies",displayPtBR:"Anticorpos anti-tireoglobulina",unit:"IU/mL",category:"Tireoide"},
  {code:"3019-7",display:"Thyroglobulin",displayPtBR:"Tireoglobulina",unit:"ng/mL",category:"Tireoide"},
  {code:"5379-3",display:"TSH receptor antibodies",displayPtBR:"Anticorpos anti-receptor de TSH (TRAb)",unit:"IU/L",category:"Tireoide"},
  {code:"14933-6",display:"Reverse T3",displayPtBR:"T3 reverso",unit:"ng/dL",category:"Tireoide"},
  {code:"5384-3",display:"Calcitonin",displayPtBR:"Calcitonina",unit:"pg/mL",category:"Tireoide"},
];

// Eletrólitos e Minerais
export const LOINC_ELETROLITOS: LoincEntry[] = [
  {code:"2951-2",display:"Sodium",displayPtBR:"Sódio",unit:"mEq/L",category:"Eletrólitos"},
  {code:"2823-3",display:"Potassium",displayPtBR:"Potássio",unit:"mEq/L",category:"Eletrólitos"},
  {code:"17861-6",display:"Calcium",displayPtBR:"Cálcio total",unit:"mg/dL",category:"Eletrólitos"},
  {code:"1994-3",display:"Ionized Calcium",displayPtBR:"Cálcio iônico",unit:"mmol/L",category:"Eletrólitos"},
  {code:"2601-3",display:"Magnesium",displayPtBR:"Magnésio",unit:"mg/dL",category:"Eletrólitos"},
  {code:"2777-1",display:"Phosphorus",displayPtBR:"Fósforo",unit:"mg/dL",category:"Eletrólitos"},
  {code:"2075-0",display:"Chloride",displayPtBR:"Cloreto",unit:"mEq/L",category:"Eletrólitos"},
  {code:"1963-8",display:"Bicarbonate",displayPtBR:"Bicarbonato",unit:"mEq/L",category:"Eletrólitos"},
  {code:"33037-3",display:"Anion gap",displayPtBR:"Ânion gap",unit:"mEq/L",category:"Eletrólitos"},
  {code:"2947-0",display:"Sodium [urine]",displayPtBR:"Sódio urinário",unit:"mEq/L",category:"Eletrólitos"},
  {code:"2828-2",display:"Potassium [urine]",displayPtBR:"Potássio urinário",unit:"mEq/L",category:"Eletrólitos"},
  {code:"6298-4",display:"Potassium [24h urine]",displayPtBR:"Potássio urinário 24h",unit:"mEq/24h",category:"Eletrólitos"},
  {code:"2955-3",display:"Sodium [24h urine]",displayPtBR:"Sódio urinário 24h",unit:"mEq/24h",category:"Eletrólitos"},
];

// Marcadores Inflamatórios
export const LOINC_INFLAMATORIOS: LoincEntry[] = [
  {code:"1988-5",display:"CRP",displayPtBR:"Proteína C-reativa (PCR)",unit:"mg/L",category:"Inflamatórios"},
  {code:"30522-7",display:"CRP high sensitivity",displayPtBR:"PCR ultrassensível",unit:"mg/L",category:"Inflamatórios"},
  {code:"30341-2",display:"ESR",displayPtBR:"VHS (velocidade de hemossedimentação)",unit:"mm/h",category:"Inflamatórios"},
  {code:"26881-3",display:"Interleukin-6",displayPtBR:"Interleucina-6 (IL-6)",unit:"pg/mL",category:"Inflamatórios"},
  {code:"33762-6",display:"Procalcitonin",displayPtBR:"Procalcitonina",unit:"ng/mL",category:"Inflamatórios"},
  {code:"4537-8",display:"Ferritin",displayPtBR:"Ferritina",unit:"ng/mL",category:"Inflamatórios"},
  {code:"2276-4",display:"Ferritin [mass]",displayPtBR:"Ferritina sérica",unit:"ug/L",category:"Inflamatórios"},
  {code:"33959-8",display:"TNF-alpha",displayPtBR:"Fator de necrose tumoral alfa (TNF-α)",unit:"pg/mL",category:"Inflamatórios"},
  {code:"26499-4",display:"Fibrinogen",displayPtBR:"Fibrinogênio (marcador inflamatório)",unit:"mg/dL",category:"Inflamatórios"},
];
