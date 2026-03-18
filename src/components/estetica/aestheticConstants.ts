/**
 * Aesthetic zone constants — procedimentos, cores e zonas faciais/corporais.
 * Baseado no padrão do odontogramConstants.ts.
 */

/* ─── Tipos de Procedimento ─── */

export type AestheticProcedureKey =
  | "toxina_botulinica"
  | "preenchimento_ah"
  | "bioestimulador"
  | "fios_pdo"
  | "peeling"
  | "microagulhamento"
  | "laser"
  | "radiofrequencia"
  | "ultrassom_micro"
  | "skinbooster"
  | "mesoterapia"
  | "criolipolise"
  | "intradermoterapia"
  | "outro";

export interface AestheticProcedure {
  value: AestheticProcedureKey;
  label: string;
  color: string;
  unit: string; // U, ml, sessão, etc.
  category: "injetavel" | "aparelho" | "quimico" | "outro";
}

export const AESTHETIC_PROCEDURES: AestheticProcedure[] = [
  // ── Injetáveis ──
  { value: "toxina_botulinica",  label: "Toxina Botulínica",       color: "#8b5cf6", unit: "U",     category: "injetavel" },
  { value: "preenchimento_ah",   label: "Preenchimento (AH)",      color: "#ec4899", unit: "ml",    category: "injetavel" },
  { value: "bioestimulador",     label: "Bioestimulador",          color: "#f59e0b", unit: "ml",    category: "injetavel" },
  { value: "skinbooster",        label: "Skinbooster",             color: "#06b6d4", unit: "ml",    category: "injetavel" },
  { value: "mesoterapia",        label: "Mesoterapia",             color: "#14b8a6", unit: "ml",    category: "injetavel" },
  { value: "intradermoterapia",  label: "Intradermoterapia",       color: "#10b981", unit: "ml",    category: "injetavel" },

  // ── Fios ──
  { value: "fios_pdo",          label: "Fios de PDO",             color: "#d946ef", unit: "fios",  category: "injetavel" },

  // ── Aparelhos ──
  { value: "laser",             label: "Laser",                   color: "#ef4444", unit: "sessão", category: "aparelho" },
  { value: "radiofrequencia",   label: "Radiofrequência",         color: "#f97316", unit: "sessão", category: "aparelho" },
  { value: "ultrassom_micro",   label: "Ultrassom Microfocado",   color: "#eab308", unit: "sessão", category: "aparelho" },
  { value: "criolipolise",      label: "Criolipólise",            color: "#3b82f6", unit: "sessão", category: "aparelho" },

  // ── Químicos ──
  { value: "peeling",           label: "Peeling Químico",         color: "#a855f7", unit: "sessão", category: "quimico" },
  { value: "microagulhamento",  label: "Microagulhamento",        color: "#e11d48", unit: "sessão", category: "quimico" },

  // ── Outro ──
  { value: "outro",             label: "Outro",                   color: "#6b7280", unit: "sessão", category: "outro" },
];

export const PROCEDURE_CATEGORIES = [
  { key: "injetavel", label: "Injetáveis" },
  { key: "aparelho",  label: "Aparelhos" },
  { key: "quimico",   label: "Químico/Mecânico" },
  { key: "outro",     label: "Outros" },
] as const;

/* ─── Zonas do rosto ─── */

export interface FaceZone {
  id: string;
  label: string;
  group: "upper" | "mid" | "lower" | "periocular" | "contorno";
}

export const FACE_ZONES: FaceZone[] = [
  // Upper
  { id: "frontal",         label: "Frontal",           group: "upper" },
  { id: "glabela",         label: "Glabela",           group: "upper" },
  { id: "temporal_d",      label: "Temporal D",        group: "upper" },
  { id: "temporal_e",      label: "Temporal E",        group: "upper" },

  // Periocular
  { id: "periocular_d",    label: "Periocular D",      group: "periocular" },
  { id: "periocular_e",    label: "Periocular E",      group: "periocular" },

  // Mid
  { id: "nasal",           label: "Nasal",             group: "mid" },
  { id: "malar_d",         label: "Malar D",           group: "mid" },
  { id: "malar_e",         label: "Malar E",           group: "mid" },
  { id: "sulco_ng_d",      label: "Sulco NasoG. D",    group: "mid" },
  { id: "sulco_ng_e",      label: "Sulco NasoG. E",    group: "mid" },

  // Lower
  { id: "labio_superior",  label: "Lábio Superior",    group: "lower" },
  { id: "labio_inferior",  label: "Lábio Inferior",    group: "lower" },
  { id: "comissura_d",     label: "Comissura D",       group: "lower" },
  { id: "comissura_e",     label: "Comissura E",       group: "lower" },
  { id: "mento",           label: "Mento (Queixo)",    group: "lower" },
  { id: "linha_marionete_d", label: "Linha Marionete D", group: "lower" },
  { id: "linha_marionete_e", label: "Linha Marionete E", group: "lower" },

  // Contorno
  { id: "mandibula_d",     label: "Mandíbula D",       group: "contorno" },
  { id: "mandibula_e",     label: "Mandíbula E",       group: "contorno" },
  { id: "submento",        label: "Submento (Papada)", group: "contorno" },
];

export const FACE_ZONE_GROUPS = [
  { key: "upper",      label: "Terço Superior" },
  { key: "periocular", label: "Periocular" },
  { key: "mid",        label: "Terço Médio" },
  { key: "lower",      label: "Terço Inferior" },
  { key: "contorno",   label: "Contorno Facial" },
] as const;

/* ─── Zonas do corpo ─── */

export interface BodyZone {
  id: string;
  label: string;
  group: "face" | "pescoco" | "bracos" | "tronco" | "gluteos" | "pernas" | "maos";
}

export const BODY_ZONES: BodyZone[] = [
  { id: "face",         label: "Face (completa)",   group: "face" },
  { id: "pescoco",      label: "Pescoço",           group: "pescoco" },
  { id: "colo",         label: "Colo",              group: "pescoco" },
  { id: "braco_d",      label: "Braço D",           group: "bracos" },
  { id: "braco_e",      label: "Braço E",           group: "bracos" },
  { id: "antebraco_d",  label: "Antebraço D",       group: "bracos" },
  { id: "antebraco_e",  label: "Antebraço E",       group: "bracos" },
  { id: "mao_d",        label: "Mão D",             group: "maos" },
  { id: "mao_e",        label: "Mão E",             group: "maos" },
  { id: "abdomen",      label: "Abdômen",           group: "tronco" },
  { id: "flancos",      label: "Flancos",           group: "tronco" },
  { id: "costas",       label: "Costas",            group: "tronco" },
  { id: "gluteo_d",     label: "Glúteo D",          group: "gluteos" },
  { id: "gluteo_e",     label: "Glúteo E",          group: "gluteos" },
  { id: "coxa_d",       label: "Coxa D",            group: "pernas" },
  { id: "coxa_e",       label: "Coxa E",            group: "pernas" },
  { id: "joelho_d",     label: "Joelho D",          group: "pernas" },
  { id: "joelho_e",     label: "Joelho E",          group: "pernas" },
];

/* ─── Dados de aplicação por zona ─── */

export interface ZoneApplication {
  zoneId: string;
  procedure: AestheticProcedureKey;
  quantity: number;
  unit: string;
  product?: string;
  batch?: string;
  expiry?: string;
  needle?: string;      // calibre agulha/cânula
  depth?: string;       // profundidade
  notes?: string;
}

/* ─── Escala de Glogau ─── */

export const GLOGAU_SCALE = [
  { value: "I",    label: "Tipo I — Sem rugas",          description: "Pouco fotoenvelhecimento, sem queratoses" },
  { value: "II",   label: "Tipo II — Rugas em movimento", description: "Lentigos senis iniciais, queratoses palpáveis" },
  { value: "III",  label: "Tipo III — Rugas em repouso",  description: "Lentigos, telangiectasias, queratoses visíveis" },
  { value: "IV",   label: "Tipo IV — Só rugas",           description: "Pele amarelada, queratoses + lesões pré-malignas" },
] as const;

export type GlogauType = typeof GLOGAU_SCALE[number]["value"];
