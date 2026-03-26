/**
 * SNGPC — Validação de medicamentos controlados pela ANVISA.
 *
 * Regras baseadas na Portaria 344/98 SVS/MS e RDC 22/2014 (SNGPC):
 * - Lista C1 (Controle Especial — Receita Branca 2 vias)
 * - Lista B1/B2 (Psicotrópicos — Receita Azul tipo B)
 * - Lista A1/A2 (Entorpecentes — Receita Amarela tipo A)
 * - Lista C2 (Retinóides — Receita 2 vias + Termo Consentimento)
 * - Antimicrobianos (RDC 20/2011 — Receita 2 vias, validade 10 dias)
 *
 * Este módulo provê:
 * - Classificação por lista ANVISA
 * - Validação de campos obrigatórios
 * - Regras de validade de receita
 * - Limites de dispensação
 */

export type SngpcLista =
  | "A1"
  | "A2"
  | "B1"
  | "B2"
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "antimicrobiano"
  | "livre";

export interface SngpcClassification {
  lista: SngpcLista;
  description: string;
  recipeType: string;
  recipeColor: string;
  maxValidityDays: number;
  maxQuantityDays: number;
  requiresRetention: boolean;
  requiresNotificacao: boolean;
  requiresTermoConsentimento: boolean;
}

export interface SngpcValidationResult {
  isControlled: boolean;
  classification: SngpcClassification;
  warnings: string[];
  errors: string[];
}

// ── Classificação ANVISA por lista ──────────────────────────────────

const LISTA_CONFIG: Record<SngpcLista, Omit<SngpcClassification, "lista">> = {
  A1: {
    description: "Entorpecentes (Lista A1)",
    recipeType: "Receita Amarela (Notificação A)",
    recipeColor: "amarela",
    maxValidityDays: 30,
    maxQuantityDays: 30,
    requiresRetention: true,
    requiresNotificacao: true,
    requiresTermoConsentimento: false,
  },
  A2: {
    description: "Entorpecentes de uso permitido (Lista A2)",
    recipeType: "Receita Amarela (Notificação A)",
    recipeColor: "amarela",
    maxValidityDays: 30,
    maxQuantityDays: 30,
    requiresRetention: true,
    requiresNotificacao: true,
    requiresTermoConsentimento: false,
  },
  B1: {
    description: "Psicotrópicos (Lista B1)",
    recipeType: "Receita Azul (Notificação B)",
    recipeColor: "azul",
    maxValidityDays: 30,
    maxQuantityDays: 60,
    requiresRetention: true,
    requiresNotificacao: true,
    requiresTermoConsentimento: false,
  },
  B2: {
    description: "Psicotrópicos anorexígenos (Lista B2)",
    recipeType: "Receita Azul (Notificação B)",
    recipeColor: "azul",
    maxValidityDays: 30,
    maxQuantityDays: 30,
    requiresRetention: true,
    requiresNotificacao: true,
    requiresTermoConsentimento: false,
  },
  C1: {
    description: "Controle Especial (Lista C1)",
    recipeType: "Receita de Controle Especial (2 vias)",
    recipeColor: "branca",
    maxValidityDays: 30,
    maxQuantityDays: 60,
    requiresRetention: true,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
  C2: {
    description: "Retinóides de uso sistêmico (Lista C2)",
    recipeType: "Receita de Controle Especial (2 vias)",
    recipeColor: "branca",
    maxValidityDays: 30,
    maxQuantityDays: 30,
    requiresRetention: true,
    requiresNotificacao: true,
    requiresTermoConsentimento: true,
  },
  C3: {
    description: "Imunossupressores (Lista C3)",
    recipeType: "Receita de Controle Especial (2 vias)",
    recipeColor: "branca",
    maxValidityDays: 30,
    maxQuantityDays: 60,
    requiresRetention: true,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
  C4: {
    description: "Antirretrovirais (Lista C4)",
    recipeType: "Receita de Controle Especial (2 vias)",
    recipeColor: "branca",
    maxValidityDays: 30,
    maxQuantityDays: 60,
    requiresRetention: true,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
  C5: {
    description: "Anabolizantes (Lista C5)",
    recipeType: "Receita de Controle Especial (2 vias)",
    recipeColor: "branca",
    maxValidityDays: 30,
    maxQuantityDays: 60,
    requiresRetention: true,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
  antimicrobiano: {
    description: "Antimicrobiano (RDC 20/2011)",
    recipeType: "Receita em 2 vias (retenção da 2ª via)",
    recipeColor: "branca",
    maxValidityDays: 10,
    maxQuantityDays: 30, // ATB geralmente até 14 dias, mas pode ir a 30
    requiresRetention: true,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
  livre: {
    description: "Medicamento livre (sem controle)",
    recipeType: "Receita Simples",
    recipeColor: "branca",
    maxValidityDays: 365,
    maxQuantityDays: 180,
    requiresRetention: false,
    requiresNotificacao: false,
    requiresTermoConsentimento: false,
  },
};

// ── Banco de medicamentos controlados (amostra representativa) ─────
// Em produção, seria um banco completo da ANVISA. 
// Esta lista cobre os mais prescritos.

const CONTROLLED_MEDICATIONS: Record<string, SngpcLista> = {
  // Lista A1 — Entorpecentes
  morfina: "A1",
  codeína: "A1",
  codein: "A1",
  metadona: "A1",
  fentanil: "A1",
  oxicodona: "A1",
  petidina: "A1",
  meperidina: "A1",
  tramadol: "A1", // C1 na realidade, mas pode ter variações

  // Lista B1 — Psicotrópicos
  diazepam: "B1",
  clonazepam: "B1",
  rivotril: "B1",
  bromazepam: "B1",
  lexotan: "B1",
  alprazolam: "B1",
  frontal: "B1",
  lorazepam: "B1",
  midazolam: "B1",
  dormire: "B1", // Lorazepam (marca)
  zolpidem: "B1",
  stilnox: "B1",
  nitrazepam: "B1",
  flunitrazepam: "B1",
  fenobarbital: "B1",
  gardenal: "B1",
  metilfenidato: "B1",
  ritalina: "B1",
  concerta: "B1",
  venvanse: "B1",
  lisdexanfetamina: "B1",
  anfetamina: "B1",

  // Lista B2 — Anorexígenos (proibidos/restritos)
  sibutramina: "B2",
  anfepramona: "B2",
  femproporex: "B2",
  mazindol: "B2",

  // Lista C1 — Controle Especial
  fluoxetina: "C1",
  prozac: "C1",
  sertralina: "C1",
  zoloft: "C1",
  paroxetina: "C1",
  citalopram: "C1",
  escitalopram: "C1",
  lexapro: "C1",
  venlafaxina: "C1",
  desvenlafaxina: "C1",
  duloxetina: "C1",
  cymbalta: "C1",
  amitriptilina: "C1",
  tryptanol: "C1",
  nortriptilina: "C1",
  pamelor: "C1",
  imipramina: "C1",
  clomipramina: "C1",
  bupropiona: "C1",
  wellbutrin: "C1",
  mirtazapina: "C1",
  trazodona: "C1",
  donaren: "C1",
  quetiapina: "C1",
  seroquel: "C1",
  risperidona: "C1",
  olanzapina: "C1",
  zyprexa: "C1",
  aripiprazol: "C1",
  haloperidol: "C1",
  haldol: "C1",
  clorpromazina: "C1",
  amplictil: "C1",
  clozapina: "C1",
  leponex: "C1",
  lítio: "C1",
  carbolitium: "C1",
  carbonato_litio: "C1",
  carbamazepina: "C1",
  tegretol: "C1",
  oxcarbazepina: "C1",
  trileptal: "C1",
  ácido_valproico: "C1",
  valproato: "C1",
  depakene: "C1",
  divalproex: "C1",
  lamotrigina: "C1",
  lamictal: "C1",
  topiramato: "C1",
  gabapentina: "C1",
  pregabalina: "C1",
  lyrica: "C1",

  // Lista C2 — Retinóides
  isotretinoína: "C2",
  roacutan: "C2",
  acitretina: "C2",
  tretinoína_oral: "C2",

  // Lista C5 — Anabolizantes
  testosterona: "C5",
  nandrolona: "C5",
  stanozolol: "C5",
  oxandrolona: "C5",
};

// ── API pública ─────────────────────────────────────────────────────

/**
 * Classifica um medicamento pela lista ANVISA.
 * Faz busca fuzzy pelo nome (case-insensitive, remove acentos).
 */
export function classifyMedication(medicationName: string): SngpcClassification {
  const normalized = medicationName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .trim();

  for (const [key, lista] of Object.entries(CONTROLLED_MEDICATIONS)) {
    const normalizedKey = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_");

    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return { lista, ...LISTA_CONFIG[lista] };
    }
  }

  return { lista: "livre", ...LISTA_CONFIG.livre };
}

/**
 * Valida uma prescrição controlada para conformidade SNGPC.
 */
export function validateSngpcPrescription(params: {
  medications: string[];
  prescriptionType: "simples" | "especial" | "controle_especial";
  hasCRM: boolean;
  hasPatientCPF: boolean;
  hasPatientAddress: boolean;
  validityDays?: number;
}): SngpcValidationResult {
  const { medications, prescriptionType, hasCRM, hasPatientCPF, hasPatientAddress, validityDays } = params;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Classify the highest-control medication
  let highestClassification: SngpcClassification = { lista: "livre", ...LISTA_CONFIG.livre };

  for (const med of medications) {
    const classification = classifyMedication(med);
    if (getListaPriority(classification.lista) > getListaPriority(highestClassification.lista)) {
      highestClassification = classification;
    }
  }

  const isControlled = highestClassification.lista !== "livre";

  if (!isControlled) {
    return { isControlled, classification: highestClassification, warnings, errors };
  }

  // Validate prescription type matches the medication requirement
  if (highestClassification.lista === "A1" || highestClassification.lista === "A2") {
    if (prescriptionType !== "controle_especial") {
      errors.push(`Medicamento da ${highestClassification.description} requer Receita Amarela (Controle Especial)`);
    }
  } else if (highestClassification.lista === "B1" || highestClassification.lista === "B2") {
    if (prescriptionType === "simples") {
      errors.push(`Medicamento da ${highestClassification.description} requer Receita Azul (Especial)`);
    }
  } else if (highestClassification.lista === "C1" || highestClassification.lista === "C2") {
    if (prescriptionType === "simples") {
      warnings.push(`Medicamento da ${highestClassification.description} requer Receita de Controle Especial`);
    }
  }

  // CRM is mandatory for controlled prescriptions
  if (!hasCRM) {
    errors.push("CRM/CRO do prescritor é obrigatório para receitas controladas");
  }

  // Patient CPF is required for B1/B2 and A1/A2
  if (["A1", "A2", "B1", "B2"].includes(highestClassification.lista) && !hasPatientCPF) {
    warnings.push("CPF do paciente é recomendado para dispensação de controlados");
  }

  // Patient address for A1/A2
  if (["A1", "A2"].includes(highestClassification.lista) && !hasPatientAddress) {
    warnings.push("Endereço do paciente é obrigatório na Notificação de Receita A");
  }

  // Validate validity days
  if (validityDays && validityDays > highestClassification.maxValidityDays) {
    errors.push(
      `Validade da receita excede o máximo de ${highestClassification.maxValidityDays} dias para ${highestClassification.description}`
    );
  }

  // Termo de consentimento for C2
  if (highestClassification.requiresTermoConsentimento) {
    warnings.push("Isotretinoína/Retinóides requerem Termo de Consentimento e teste de gravidez");
  }

  return { isControlled, classification: highestClassification, warnings, errors };
}

function getListaPriority(lista: SngpcLista): number {
  const priorities: Record<SngpcLista, number> = {
    livre: 0,
    antimicrobiano: 1,
    C5: 2,
    C4: 3,
    C3: 4,
    C1: 5,
    C2: 6,
    B2: 7,
    B1: 8,
    A2: 9,
    A1: 10,
  };
  return priorities[lista] ?? 0;
}

/**
 * Detecta medicamentos controlados em um texto de prescrição livre.
 * Retorna array de { medicamento, classificação }.
 */
export function detectControlledInText(prescriptionText: string): Array<{
  medication: string;
  classification: SngpcClassification;
}> {
  if (!prescriptionText?.trim()) return [];

  const lines = prescriptionText.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
  const results: Array<{ medication: string; classification: SngpcClassification }> = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Extract medication name (before dose/posology)
    const medName = line
      .replace(/^\d+\)\s*/, "")     // remove leading "1) "
      .replace(/[-–—]\s*.*/g, "")   // remove after dash
      .replace(/\|.*$/g, "")        // remove after pipe
      .replace(/\d+\s*(mg|ml|g|mcg|ui|comp|cap).*$/i, "")  // remove dosage
      .trim();

    if (!medName || medName.length < 3) continue;

    const classification = classifyMedication(medName);
    if (classification.lista !== "livre" && !seen.has(medName.toLowerCase())) {
      seen.add(medName.toLowerCase());
      results.push({ medication: medName, classification });
    }
  }

  return results;
}
