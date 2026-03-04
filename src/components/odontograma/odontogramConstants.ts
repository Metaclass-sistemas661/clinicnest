/**
 * Odontogram Constants — Condições, cores e dados estáticos
 */

export type ToothConditionKey =
  | "healthy" | "caries" | "restored" | "missing" | "crown" | "implant"
  | "endodontic" | "extraction" | "prosthesis" | "fracture"
  | "sealant" | "veneer" | "bridge" | "bridge_abutment" | "temporary"
  | "root_remnant" | "impacted" | "supernumerary" | "diastema" | "rotation"
  | "ectopic" | "abrasion" | "erosion" | "resorption" | "periapical"
  | "mobility" | "recession" | "fistula" | "abscess"
  | "unerupted" | "semi_erupted" | "deciduous" | "agenesis";

export interface ToothCondition {
  value: ToothConditionKey;
  label: string;
  color: string;
  category: "status" | "treatment" | "pathology" | "anomaly" | "prosthetic";
  symbol?: string; // ISO/FDI symbol reference
}

export const TOOTH_CONDITIONS: ToothCondition[] = [
  // ── Status básico ──
  { value: "healthy",        label: "Saudável / Hígido",       color: "#22c55e", category: "status" },
  { value: "missing",        label: "Ausente",                 color: "#6b7280", category: "status" },
  { value: "unerupted",      label: "Não erupcionado",         color: "#a3a3a3", category: "status" },
  { value: "semi_erupted",   label: "Semi-erupcionado",        color: "#d4d4d4", category: "status" },
  { value: "deciduous",      label: "Decíduo presente",        color: "#86efac", category: "status" },
  { value: "agenesis",       label: "Agenesia",                color: "#d1d5db", category: "status" },

  // ── Patologias ──
  { value: "caries",         label: "Cárie",                   color: "#ef4444", category: "pathology" },
  { value: "fracture",       label: "Fratura",                 color: "#f97316", category: "pathology" },
  { value: "abrasion",       label: "Abrasão / Atrição",       color: "#fb923c", category: "pathology" },
  { value: "erosion",        label: "Erosão",                  color: "#fbbf24", category: "pathology" },
  { value: "resorption",     label: "Reabsorção",              color: "#b91c1c", category: "pathology" },
  { value: "periapical",     label: "Lesão periapical",        color: "#991b1b", category: "pathology" },
  { value: "abscess",        label: "Abscesso",                color: "#7f1d1d", category: "pathology" },
  { value: "fistula",        label: "Fístula",                 color: "#881337", category: "pathology" },
  { value: "mobility",       label: "Mobilidade",              color: "#be123c", category: "pathology" },
  { value: "recession",      label: "Recessão gengival",       color: "#e11d48", category: "pathology" },
  { value: "root_remnant",   label: "Resto radicular",         color: "#9f1239", category: "pathology" },

  // ── Tratamentos realizados ──
  { value: "restored",       label: "Restaurado",              color: "#3b82f6", category: "treatment" },
  { value: "endodontic",     label: "Endodontia (canal)",      color: "#ec4899", category: "treatment" },
  { value: "sealant",        label: "Selante",                 color: "#06b6d4", category: "treatment" },
  { value: "temporary",      label: "Restauração provisória",  color: "#a78bfa", category: "treatment" },

  // ── Protéticos ──
  { value: "crown",          label: "Coroa protética",         color: "#f59e0b", category: "prosthetic" },
  { value: "implant",        label: "Implante",                color: "#8b5cf6", category: "prosthetic" },
  { value: "prosthesis",     label: "Prótese",                 color: "#14b8a6", category: "prosthetic" },
  { value: "veneer",         label: "Faceta",                  color: "#0ea5e9", category: "prosthetic" },
  { value: "bridge",         label: "Ponte fixa (pôntico)",    color: "#0d9488", category: "prosthetic" },
  { value: "bridge_abutment",label: "Pilar de ponte",          color: "#0f766e", category: "prosthetic" },

  // ── Indicações ──
  { value: "extraction",     label: "Indicado p/ extração",    color: "#dc2626", category: "treatment", symbol: "X" },

  // ── Anomalias ──
  { value: "supernumerary",  label: "Supranumerário",          color: "#7c3aed", category: "anomaly" },
  { value: "diastema",       label: "Diastema",                color: "#c084fc", category: "anomaly" },
  { value: "rotation",       label: "Giroversão",              color: "#a855f7", category: "anomaly" },
  { value: "ectopic",        label: "Ectopia",                 color: "#9333ea", category: "anomaly" },
  { value: "impacted",       label: "Incluso / Impactado",     color: "#7e22ce", category: "anomaly" },
];

export const CONDITION_CATEGORIES = [
  { key: "status",     label: "Estado" },
  { key: "pathology",  label: "Patologia" },
  { key: "treatment",  label: "Tratamento" },
  { key: "prosthetic", label: "Protético" },
  { key: "anomaly",    label: "Anomalia" },
] as const;

// ── Numeração FDI ──

/** Arcada superior permanente (direito → esquerdo) */
export const UPPER_PERMANENT = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
/** Arcada inferior permanente (direito → esquerdo) */
export const LOWER_PERMANENT = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
/** Arcada superior decídua */
export const UPPER_DECIDUOUS = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65] as const;
/** Arcada inferior decídua */
export const LOWER_DECIDUOUS = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] as const;

export type DentitionType = "permanent" | "deciduous" | "mixed";

/** Retorna os dentes corretos conforme tipo de dentição */
export function getTeethForDentition(type: DentitionType) {
  switch (type) {
    case "permanent":
      return {
        upper: [...UPPER_PERMANENT],
        lower: [...LOWER_PERMANENT],
      };
    case "deciduous":
      return {
        upper: [...UPPER_DECIDUOUS],
        lower: [...LOWER_DECIDUOUS],
      };
    case "mixed":
      return {
        upper: [...UPPER_PERMANENT, ...UPPER_DECIDUOUS],
        lower: [...LOWER_PERMANENT, ...LOWER_DECIDUOUS],
      };
  }
}

// ── Faces por dente ──

export const SURFACES_POSTERIOR = ["V", "L", "M", "D", "O"] as const;
export const SURFACES_ANTERIOR  = ["V", "L", "M", "D", "I"] as const;
export const SURFACES_UPPER_POSTERIOR = ["V", "P", "M", "D", "O"] as const;
export const SURFACES_UPPER_ANTERIOR  = ["V", "P", "M", "D", "I"] as const;

export function getSurfacesForTooth(toothNumber: number): readonly string[] {
  const unit = toothNumber % 10;
  const quadrant = Math.floor(toothNumber / 10);
  const isUpper = quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;
  const isAnterior = quadrant >= 5 ? unit <= 3 : unit <= 3;

  if (isUpper) {
    return isAnterior ? SURFACES_UPPER_ANTERIOR : SURFACES_UPPER_POSTERIOR;
  }
  return isAnterior ? SURFACES_ANTERIOR : SURFACES_POSTERIOR;
}

export const SURFACE_LABELS: Record<string, string> = {
  V: "Vestibular",
  L: "Lingual",
  P: "Palatina",
  M: "Mesial",
  D: "Distal",
  O: "Oclusal",
  I: "Incisal",
  C: "Cervical",
};

// ── Materiais de restauração ──
export const RESTORATION_MATERIALS = [
  { value: "resina_composta", label: "Resina Composta" },
  { value: "amalgama",        label: "Amálgama" },
  { value: "ceramica",        label: "Cerâmica" },
  { value: "ionomero_vidro",  label: "Ionômero de Vidro" },
  { value: "ouro",            label: "Ouro" },
  { value: "zirconia",        label: "Zircônia" },
  { value: "metalica",        label: "Metálica" },
  { value: "provisorio",      label: "Material Provisório" },
] as const;

// ── Graus de mobilidade ──
export const MOBILITY_GRADES = [
  { value: 0, label: "Grau 0 — Firme (normal)" },
  { value: 1, label: "Grau I — Mobilidade leve (< 1mm)" },
  { value: 2, label: "Grau II — Mobilidade moderada (1-2mm)" },
  { value: 3, label: "Grau III — Mobilidade severa (> 2mm ou vertical)" },
] as const;

// ── Prioridade ──
export const PRIORITIES = [
  { value: "normal", label: "Normal",  color: "#6b7280" },
  { value: "low",    label: "Baixa",   color: "#22c55e" },
  { value: "high",   label: "Alta",    color: "#f59e0b" },
  { value: "urgent", label: "Urgente", color: "#dc2626" },
] as const;
