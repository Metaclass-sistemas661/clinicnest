// Tipos de exame completos — alinhados com TUSS e CFM
// Cada tipo mapeia para categorias TUSS e sugestões de exames comuns

export interface ExamTypeConfig {
  value: string;
  label: string;
  group: string;
  icon: string; // lucide icon name
  description: string;
  commonExams: string[]; // sugestões de nomes de exames para autocomplete
}

export const EXAM_TYPE_GROUPS = [
  { key: "laboratorio", label: "Laboratoriais" },
  { key: "imagem", label: "Diagnóstico por Imagem" },
  { key: "cardiologia", label: "Cardiologia" },
  { key: "neurofisiologia", label: "Neurofisiologia" },
  { key: "endoscopia", label: "Endoscopia" },
  { key: "anatomopatologia", label: "Anatomopatologia" },
  { key: "funcional", label: "Provas Funcionais" },
  { key: "outros", label: "Outros" },
] as const;

export const EXAM_TYPES: ExamTypeConfig[] = [
  // ─── Laboratoriais ──────────────────────────────────────
  {
    value: "laboratorial",
    label: "Laboratorial",
    group: "laboratorio",
    icon: "FlaskConical",
    description: "Exames de sangue, urina, fezes, bioquímica, hematologia",
    commonExams: [
      "Hemograma completo",
      "Glicemia de jejum",
      "Hemoglobina glicada (HbA1c)",
      "Colesterol total e frações",
      "Triglicerídeos",
      "TSH",
      "T4 livre",
      "Creatinina",
      "Ureia",
      "TGO (AST)",
      "TGP (ALT)",
      "Gama GT",
      "Ácido úrico",
      "VHS",
      "PCR (Proteína C Reativa)",
      "PSA total e livre",
      "Vitamina D (25-OH)",
      "Vitamina B12",
      "Ferro sérico",
      "Ferritina",
      "Cálcio sérico",
      "Potássio",
      "Sódio",
      "Magnésio",
      "Fósforo",
      "Bilirrubinas",
      "Fosfatase alcalina",
      "Coagulograma completo",
      "INR",
      "EAS (Urina tipo I)",
      "Urocultura",
      "Parasitológico de fezes",
      "Beta-HCG",
      "Hormônio luteinizante (LH)",
      "FSH",
      "Estradiol",
      "Progesterona",
      "Testosterona",
      "Cortisol",
      "Insulina basal",
      "HOMA-IR",
      "Albumina",
      "Proteínas totais e frações",
    ],
  },
  {
    value: "microbiologia",
    label: "Microbiologia",
    group: "laboratorio",
    icon: "Bug",
    description: "Culturas, antibiogramas, pesquisas microbiológicas",
    commonExams: [
      "Hemocultura",
      "Urocultura com antibiograma",
      "Cultura de secreção",
      "Cultura de escarro",
      "BAAR (Baciloscopia)",
      "Pesquisa de fungos",
      "Coprocultura",
      "Swab nasal",
      "Swab orofaríngeo",
    ],
  },
  {
    value: "genetico",
    label: "Genético / Molecular",
    group: "laboratorio",
    icon: "Dna",
    description: "Exames genéticos, biologia molecular, farmacogenética",
    commonExams: [
      "Cariótipo",
      "PCR para COVID-19",
      "PCR para HPV",
      "Genotipagem de hepatite C",
      "Teste genético BRCA1/BRCA2",
      "Painel de trombofilia",
      "Estudo molecular de leucemia",
      "Farmacogenética",
    ],
  },

  // ─── Diagnóstico por Imagem ─────────────────────────────
  {
    value: "radiografia",
    label: "Radiografia (Raio-X)",
    group: "imagem",
    icon: "Scan",
    description: "Radiografias simples e contrastadas",
    commonExams: [
      "RX Tórax PA e Perfil",
      "RX Coluna Cervical",
      "RX Coluna Lombar",
      "RX Mãos e Punhos",
      "RX Joelhos",
      "RX Bacia",
      "RX Seios da Face",
      "RX Abdômen",
      "RX Crânio",
      "Panorâmica dento-maxilar",
    ],
  },
  {
    value: "ultrassonografia",
    label: "Ultrassonografia",
    group: "imagem",
    icon: "Radio",
    description: "Ultrassom convencional e com Doppler",
    commonExams: [
      "US Abdômen total",
      "US Abdômen superior",
      "US Pélvica / Transvaginal",
      "US Obstétrica",
      "US Obstétrica morfológica",
      "US Tireoide",
      "US Mamas",
      "US Próstata (transretal)",
      "US Rins e vias urinárias",
      "US Articular",
      "Doppler de carótidas e vertebrais",
      "Doppler venoso de MMII",
      "Doppler arterial de MMII",
      "US Bolsa escrotal",
      "US Partes moles",
      "Elastografia hepática",
    ],
  },
  {
    value: "tomografia",
    label: "Tomografia (TC)",
    group: "imagem",
    icon: "CircleDot",
    description: "Tomografia computadorizada com ou sem contraste",
    commonExams: [
      "TC Crânio",
      "TC Tórax",
      "TC Abdômen e pelve",
      "TC Coluna lombar",
      "TC Coluna cervical",
      "TC Seios da face",
      "Angiotomografia de coronárias",
      "Angiotomografia de aorta",
      "Angiotomografia pulmonar",
      "TC Ossos temporais",
      "Escore de cálcio coronariano",
    ],
  },
  {
    value: "ressonancia",
    label: "Ressonância Magnética",
    group: "imagem",
    icon: "Magnet",
    description: "RM com ou sem contraste (gadolínio)",
    commonExams: [
      "RM Crânio",
      "RM Coluna cervical",
      "RM Coluna lombar",
      "RM Joelho",
      "RM Ombro",
      "RM Pelve",
      "RM Mamas",
      "RM Cardíaca",
      "RM Abdômen",
      "RM Hipófise",
      "Colangio-RM",
      "Uro-RM",
      "Angio-RM cerebral",
    ],
  },
  {
    value: "mamografia",
    label: "Mamografia",
    group: "imagem",
    icon: "ScanHeart",
    description: "Mamografia digital, tomossíntese",
    commonExams: [
      "Mamografia bilateral",
      "Mamografia unilateral",
      "Tomossíntese mamária",
      "Mamografia de rastreamento",
    ],
  },
  {
    value: "densitometria",
    label: "Densitometria Óssea",
    group: "imagem",
    icon: "Bone",
    description: "Densitometria óssea (DEXA)",
    commonExams: [
      "Densitometria óssea (coluna + fêmur)",
      "Densitometria corpo inteiro",
      "Composição corporal por DEXA",
    ],
  },
  {
    value: "cintilografia",
    label: "Cintilografia",
    group: "imagem",
    icon: "Atom",
    description: "Medicina nuclear diagnóstica",
    commonExams: [
      "Cintilografia de tireoide",
      "Cintilografia óssea",
      "Cintilografia miocárdica",
      "Cintilografia renal (DMSA / DTPA)",
      "Cintilografia pulmonar (V/Q)",
    ],
  },
  {
    value: "pet_ct",
    label: "PET-CT",
    group: "imagem",
    icon: "Zap",
    description: "Tomografia por emissão de pósitrons",
    commonExams: [
      "PET-CT com FDG (corpo inteiro)",
      "PET-CT cerebral",
      "PET-CT com colina",
      "PET-CT com PSMA",
    ],
  },
  {
    value: "imagem",
    label: "Outro exame de imagem",
    group: "imagem",
    icon: "ImageIcon",
    description: "Outros exames de diagnóstico por imagem",
    commonExams: [],
  },

  // ─── Cardiologia ────────────────────────────────────────
  {
    value: "eletrocardiograma",
    label: "Eletrocardiograma (ECG)",
    group: "cardiologia",
    icon: "HeartPulse",
    description: "ECG de repouso, 12 derivações",
    commonExams: [
      "ECG de repouso 12 derivações",
      "ECG de esforço",
      "ECG de alta resolução",
    ],
  },
  {
    value: "ecocardiograma",
    label: "Ecocardiograma",
    group: "cardiologia",
    icon: "Heart",
    description: "Ecocardiograma transtorácico / transesofágico",
    commonExams: [
      "Ecocardiograma transtorácico",
      "Ecocardiograma com Doppler",
      "Ecocardiograma transesofágico",
      "Ecocardiograma de estresse",
      "Ecocardiograma fetal",
    ],
  },
  {
    value: "holter",
    label: "Holter 24h",
    group: "cardiologia",
    icon: "Activity",
    description: "Monitorização eletrocardiográfica contínua",
    commonExams: [
      "Holter 24 horas",
      "Holter 48 horas",
      "Holter 7 dias",
    ],
  },
  {
    value: "mapa",
    label: "MAPA",
    group: "cardiologia",
    icon: "Gauge",
    description: "Monitorização Ambulatorial da Pressão Arterial",
    commonExams: [
      "MAPA 24 horas",
      "MRPA (Monitorização Residencial da PA)",
    ],
  },
  {
    value: "teste_ergometrico",
    label: "Teste Ergométrico",
    group: "cardiologia",
    icon: "Footprints",
    description: "Teste de esforço em esteira ou bicicleta",
    commonExams: [
      "Teste ergométrico (Bruce)",
      "Teste ergométrico (Rampa)",
      "Ergoespirometria (VO2 máx)",
      "Teste cardiopulmonar de exercício",
    ],
  },
  {
    value: "cateterismo",
    label: "Cateterismo Cardíaco",
    group: "cardiologia",
    icon: "Syringe",
    description: "Cateterismo / hemodinâmica",
    commonExams: [
      "Cateterismo cardíaco diagnóstico",
      "Cineangiocoronariografia",
      "Estudo eletrofisiológico",
    ],
  },

  // ─── Neurofisiologia ───────────────────────────────────
  {
    value: "eletroencefalograma",
    label: "Eletroencefalograma (EEG)",
    group: "neurofisiologia",
    icon: "BrainCircuit",
    description: "EEG de rotina e prolongado",
    commonExams: [
      "EEG de rotina",
      "EEG com privação de sono",
      "Vídeo-EEG prolongado",
      "EEG neonatal",
    ],
  },
  {
    value: "eletroneuromiografia",
    label: "Eletroneuromiografia (ENMG)",
    group: "neurofisiologia",
    icon: "Zap",
    description: "Eletroneuromiografia / velocidade de condução nervosa",
    commonExams: [
      "ENMG de membros superiores",
      "ENMG de membros inferiores",
      "ENMG 4 membros",
      "Velocidade de condução nervosa",
      "Potencial evocado somatossensitivo",
      "Potencial evocado visual",
      "Potencial evocado auditivo (BERA)",
    ],
  },
  {
    value: "polissonografia",
    label: "Polissonografia",
    group: "neurofisiologia",
    icon: "Moon",
    description: "Estudo do sono",
    commonExams: [
      "Polissonografia basal",
      "Polissonografia com titulação de CPAP",
      "Polissonografia split-night",
      "Teste de latências múltiplas do sono",
    ],
  },

  // ─── Endoscopia ─────────────────────────────────────────
  {
    value: "endoscopia",
    label: "Endoscopia Digestiva Alta",
    group: "endoscopia",
    icon: "Tv",
    description: "EDA com ou sem biópsia",
    commonExams: [
      "Endoscopia digestiva alta (EDA)",
      "EDA com biópsia",
      "EDA com pesquisa de H. pylori",
      "EDA com cromoscopia",
    ],
  },
  {
    value: "colonoscopia",
    label: "Colonoscopia",
    group: "endoscopia",
    icon: "Tv",
    description: "Colonoscopia com ou sem polipectomia",
    commonExams: [
      "Colonoscopia",
      "Colonoscopia com biópsia",
      "Colonoscopia com polipectomia",
      "Retossigmoidoscopia",
    ],
  },
  {
    value: "broncoscopia",
    label: "Broncoscopia",
    group: "endoscopia",
    icon: "Wind",
    description: "Broncoscopia diagnóstica/terapêutica",
    commonExams: [
      "Broncoscopia flexível",
      "Broncoscopia com lavado broncoalveolar",
      "Broncoscopia com biópsia",
    ],
  },
  {
    value: "cistoscopia",
    label: "Cistoscopia",
    group: "endoscopia",
    icon: "Tv",
    description: "Cistoscopia diagnóstica",
    commonExams: ["Cistoscopia diagnóstica", "Cistoscopia com biópsia"],
  },
  {
    value: "histeroscopia",
    label: "Histeroscopia",
    group: "endoscopia",
    icon: "Tv",
    description: "Histeroscopia diagnóstica/cirúrgica",
    commonExams: [
      "Histeroscopia diagnóstica",
      "Histeroscopia cirúrgica",
    ],
  },
  {
    value: "laringoscopia",
    label: "Laringoscopia",
    group: "endoscopia",
    icon: "Mic",
    description: "Videolaringoscopia / nasofibrolaringoscopia",
    commonExams: [
      "Videolaringoscopia",
      "Nasofibrolaringoscopia",
      "Estroboscopia laríngea",
    ],
  },

  // ─── Anatomopatologia ──────────────────────────────────
  {
    value: "anatomopatologico",
    label: "Anatomopatológico",
    group: "anatomopatologia",
    icon: "Microscope",
    description: "Exame anatomopatológico de peça / fragmento",
    commonExams: [
      "Anatomopatológico de pele",
      "Anatomopatológico de útero",
      "Anatomopatológico de mama",
      "Anatomopatológico de próstata",
      "Anatomopatológico de pólipo",
      "Congelação intraoperatória",
    ],
  },
  {
    value: "citologico",
    label: "Citologia",
    group: "anatomopatologia",
    icon: "Microscope",
    description: "Citologia oncótica e não-oncótica",
    commonExams: [
      "Citologia oncótica cervicovaginal (Papanicolau)",
      "Citologia de líquido ascítico",
      "Citologia de líquido pleural",
      "Citologia de escarro",
      "PAAF (Punção aspirativa por agulha fina)",
    ],
  },
  {
    value: "biopsia",
    label: "Biópsia",
    group: "anatomopatologia",
    icon: "Microscope",
    description: "Biópsia de tecidos diversos",
    commonExams: [
      "Biópsia de pele",
      "Biópsia endometrial",
      "Biópsia renal",
      "Biópsia hepática",
      "Biópsia de medula óssea",
      "Biópsia de linfonodo",
      "Biópsia muscular",
    ],
  },
  {
    value: "imunohistoquimica",
    label: "Imunohistoquímica",
    group: "anatomopatologia",
    icon: "Microscope",
    description: "Painel de marcadores imunohistoquímicos",
    commonExams: [
      "Painel imunohistoquímico (4 marcadores)",
      "Painel imunohistoquímico (8+ marcadores)",
      "HER2 (imunohistoquímica)",
      "Ki-67",
      "Receptores hormonais (RE/RP)",
    ],
  },

  // ─── Provas Funcionais ─────────────────────────────────
  {
    value: "espirometria",
    label: "Espirometria",
    group: "funcional",
    icon: "Wind",
    description: "Prova de função pulmonar",
    commonExams: [
      "Espirometria simples",
      "Espirometria com broncodilatador",
      "Pletismografia pulmonar",
      "Difusão de CO (DLCO)",
    ],
  },
  {
    value: "audiometria",
    label: "Audiometria",
    group: "funcional",
    icon: "Ear",
    description: "Audiometria tonal e vocal",
    commonExams: [
      "Audiometria tonal limiar",
      "Audiometria vocal",
      "Imitanciometria (timpanometria)",
      "Emissões otoacústicas",
      "BERA (potencial evocado auditivo)",
      "Vectoeletronistagmografia (VENG)",
    ],
  },
  {
    value: "campimetria",
    label: "Campimetria",
    group: "funcional",
    icon: "Eye",
    description: "Campimetria visual computadorizada",
    commonExams: [
      "Campimetria computadorizada (Humphrey)",
      "Campimetria de confrontação",
      "Campimetria cinética (Goldmann)",
    ],
  },
  {
    value: "colposcopia",
    label: "Colposcopia",
    group: "funcional",
    icon: "Search",
    description: "Colposcopia + vulvoscopia",
    commonExams: [
      "Colposcopia",
      "Vulvoscopia",
      "Colposcopia com biópsia",
    ],
  },
  {
    value: "urodinamica",
    label: "Urodinâmica",
    group: "funcional",
    icon: "Activity",
    description: "Estudo urodinâmico completo",
    commonExams: [
      "Estudo urodinâmico completo",
      "Urofluxometria",
      "Cistometria",
    ],
  },
  {
    value: "funcional",
    label: "Outra Prova Funcional",
    group: "funcional",
    icon: "Activity",
    description: "Provas funcionais diversas",
    commonExams: [
      "Teste de caminhada de 6 minutos",
      "Teste de função hepática",
      "Prova de função renal (clearance)",
    ],
  },

  // ─── Outros ─────────────────────────────────────────────
  {
    value: "outro",
    label: "Outro",
    group: "outros",
    icon: "FileText",
    description: "Tipo de exame não listado",
    commonExams: [],
  },
];

// Mapa rápido para lookup
export const EXAM_TYPE_MAP = new Map(
  EXAM_TYPES.map((t) => [t.value, t])
);

// Obter label do tipo
export function getExamTypeLabel(value: string): string {
  return EXAM_TYPE_MAP.get(value)?.label ?? value;
}

// Obter grupo do tipo  
export function getExamTypeGroup(value: string): string {
  return EXAM_TYPE_MAP.get(value)?.group ?? "outros";
}

// Buscar sugestões de nomes de exames para um tipo
export function getCommonExams(examType: string): string[] {
  return EXAM_TYPE_MAP.get(examType)?.commonExams ?? [];
}

// Todos os tipos agrupados (para Select com grupos)
export function getGroupedExamTypes() {
  return EXAM_TYPE_GROUPS.map((g) => ({
    ...g,
    types: EXAM_TYPES.filter((t) => t.group === g.key),
  }));
}

// Status do resultado
export const EXAM_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "muted" },
  { value: "normal", label: "Normal", color: "success" },
  { value: "alterado", label: "Alterado", color: "warning" },
  { value: "critico", label: "Crítico", color: "destructive" },
] as const;

// Tipos de laudo médico (para LaudoDrawer)
export const LAUDO_TIPOS = [
  { value: "medico", label: "Laudo Médico" },
  { value: "pericial", label: "Laudo Pericial" },
  { value: "aptidao", label: "Laudo de Aptidão" },
  { value: "capacidade", label: "Laudo de Capacidade" },
  { value: "complementar", label: "Laudo Complementar" },
  { value: "psicologico", label: "Laudo Psicológico" },
  { value: "neuropsicologico", label: "Avaliação Neuropsicológica" },
  { value: "ocupacional", label: "Laudo Ocupacional (NR-7)" },
  { value: "outro", label: "Outro" },
] as const;
