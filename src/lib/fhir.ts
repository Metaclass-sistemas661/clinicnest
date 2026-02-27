/**
 * HL7 FHIR R4 — Export/Import de dados clínicos padronizados
 *
 * Gera recursos FHIR (Patient, Encounter, Observation, Condition, etc.)
 * a partir dos dados do ClinicNest, e importa recursos FHIR recebidos
 * de outros sistemas.
 *
 * Profiles: RNDS (Rede Nacional de Dados em Saúde) — Ministério da Saúde
 * Referência: https://simplifier.net/redenacionaldedadosemsaude
 */

// ─── RNDS Profile URIs ──────────────────────────────────────────────────────

const RNDS = {
  PATIENT: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0",
  ENCOUNTER: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRContatoAssistencial-1.0",
  OBSERVATION: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRObservacaoDescritiva-1.0",
  CONDITION: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRDiagnosticoClinico-1.0",
  PRACTITIONER: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRProfissional-1.0",
  ORGANIZATION: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BREstabelecimentoSaude-1.0",
} as const;

const BR_NAMING_SYSTEMS = {
  CPF: "http://rnds-fhir.saude.gov.br/NamingSystem/cpf",
  CNS: "http://rnds-fhir.saude.gov.br/NamingSystem/cns",
  CBO: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRCBO",
  CNES: "http://www.saude.gov.br/fhir/r4/CodeSystem/BREstabelecimentoSaude",
  CRM: "http://www.saude.gov.br/fhir/r4/NamingSystem/professional-council",
} as const;

// ─── FHIR Types ──────────────────────────────────────────────────────────────

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: { lastUpdated?: string; profile?: string[] };
  [key: string]: unknown;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: "collection" | "document" | "transaction";
  timestamp: string;
  entry: Array<{ resource: FHIRResource; fullUrl?: string }>;
}

// ─── Internal data shapes ────────────────────────────────────────────────────

export interface PatientData {
  id: string;
  name: string;
  cpf?: string;
  cns?: string;
  birthDate?: string;
  gender?: "male" | "female" | "other" | "unknown";
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface EncounterData {
  id: string;
  patientId: string;
  date: string;
  status: "planned" | "in-progress" | "finished" | "cancelled";
  type?: string;
  professionalName?: string;
  professionalCRM?: string;
  professionalCBO?: string;
  clinicName?: string;
  clinicCNES?: string;
  notes?: string;
}

export interface ObservationData {
  id: string;
  patientId: string;
  encounterId?: string;
  date: string;
  code: string;
  display: string;
  value?: number;
  unit?: string;
  system?: string;
}

export interface ConditionData {
  id: string;
  patientId: string;
  encounterId?: string;
  code: string;
  display: string;
  system?: string;
  onsetDate?: string;
  clinicalStatus: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved";
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildFHIRPatient(p: PatientData): FHIRResource {
  const nameParts = p.name.split(" ");
  const family = nameParts.length > 1 ? nameParts.slice(-1).join(" ") : p.name;
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [p.name];

  const resource: FHIRResource = {
    resourceType: "Patient",
    id: p.id,
    meta: { profile: [RNDS.PATIENT] },
    active: true,
    name: [{ use: "official", family, given }],
    gender: p.gender ?? "unknown",
  };

  if (p.birthDate) resource.birthDate = p.birthDate;

  const identifiers: object[] = [];
  if (p.cpf) {
    identifiers.push({
      system: BR_NAMING_SYSTEMS.CPF,
      value: p.cpf.replace(/\D/g, ""),
    });
  }
  if (p.cns) {
    identifiers.push({
      system: BR_NAMING_SYSTEMS.CNS,
      value: p.cns.replace(/\D/g, ""),
    });
  }
  if (identifiers.length > 0) resource.identifier = identifiers;

  const telecom: object[] = [];
  if (p.phone) telecom.push({ system: "phone", value: p.phone, use: "mobile" });
  if (p.email) telecom.push({ system: "email", value: p.email });
  if (telecom.length > 0) resource.telecom = telecom;

  if (p.address || p.city || p.state) {
    resource.address = [{
      use: "home",
      line: p.address ? [p.address] : undefined,
      city: p.city,
      state: p.state,
      postalCode: p.zipCode,
      country: "BR",
    }];
  }

  return resource;
}

export function buildFHIREncounter(e: EncounterData): FHIRResource {
  const resource: FHIRResource = {
    resourceType: "Encounter",
    id: e.id,
    meta: { profile: [RNDS.ENCOUNTER] },
    status: e.status,
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    subject: { reference: `Patient/${e.patientId}` },
    period: { start: e.date },
  };

  if (e.type) {
    resource.type = [{
      coding: [{ system: "http://www.ans.gov.br/tiss/tuss", display: e.type }],
      text: e.type,
    }];
  }

  if (e.professionalName) {
    const practIdentifiers: object[] = [];
    if (e.professionalCRM) {
      practIdentifiers.push({
        system: BR_NAMING_SYSTEMS.CRM,
        value: e.professionalCRM,
      });
    }
    if (e.professionalCBO) {
      practIdentifiers.push({
        system: BR_NAMING_SYSTEMS.CBO,
        value: e.professionalCBO,
      });
    }

    resource.participant = [{
      individual: {
        display: e.professionalName,
        ...(practIdentifiers.length > 0 ? { identifier: practIdentifiers[0] } : {}),
      },
    }];
  }

  if (e.clinicName) {
    resource.serviceProvider = {
      display: e.clinicName,
      ...(e.clinicCNES ? { identifier: { system: BR_NAMING_SYSTEMS.CNES, value: e.clinicCNES } } : {}),
    };
  }

  return resource;
}

export function buildFHIRObservation(o: ObservationData): FHIRResource {
  const resource: FHIRResource = {
    resourceType: "Observation",
    id: o.id,
    meta: { profile: [RNDS.OBSERVATION] },
    status: "final",
    code: {
      coding: [{
        system: o.system ?? "http://loinc.org",
        code: o.code,
        display: o.display,
      }],
      text: o.display,
    },
    subject: { reference: `Patient/${o.patientId}` },
    effectiveDateTime: o.date,
  };

  if (o.encounterId) resource.encounter = { reference: `Encounter/${o.encounterId}` };

  if (o.value != null) {
    resource.valueQuantity = { value: o.value, unit: o.unit ?? "", system: "http://unitsofmeasure.org" };
  }

  return resource;
}

export function buildFHIRCondition(c: ConditionData): FHIRResource {
  const resource: FHIRResource = {
    resourceType: "Condition",
    id: c.id,
    meta: { profile: [RNDS.CONDITION] },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: c.clinicalStatus }],
    },
    code: {
      coding: [{
        system: c.system ?? "http://hl7.org/fhir/sid/icd-10",
        code: c.code,
        display: c.display,
      }],
      text: c.display,
    },
    subject: { reference: `Patient/${c.patientId}` },
  };

  if (c.encounterId) resource.encounter = { reference: `Encounter/${c.encounterId}` };
  if (c.onsetDate) resource.onsetDateTime = c.onsetDate;

  return resource;
}

// ─── LOINC codes for vital signs ─────────────────────────────────────────────

export const VITAL_SIGNS_LOINC: Record<string, { code: string; display: string; unit: string }> = {
  blood_pressure_systolic:  { code: "8480-6",  display: "Systolic blood pressure",  unit: "mmHg" },
  blood_pressure_diastolic: { code: "8462-4",  display: "Diastolic blood pressure", unit: "mmHg" },
  heart_rate:               { code: "8867-4",  display: "Heart rate",                unit: "bpm" },
  temperature:              { code: "8310-5",  display: "Body temperature",          unit: "Cel" },
  oxygen_saturation:        { code: "2708-6",  display: "Oxygen saturation",         unit: "%" },
  respiratory_rate:         { code: "9279-1",  display: "Respiratory rate",           unit: "/min" },
  weight:                   { code: "29463-7", display: "Body weight",               unit: "kg" },
  height:                   { code: "8302-2",  display: "Body height",               unit: "cm" },
};

// ─── LOINC codes for common laboratory tests ─────────────────────────────────

export interface LoincLabEntry {
  code: string;
  display: string;
  displayPtBR: string;
  unit: string;
  category: string;
}

export const LAB_LOINC: LoincLabEntry[] = [
  // Hematologia
  { code: "58410-2", display: "Complete blood count", displayPtBR: "Hemograma completo", unit: "", category: "Hematologia" },
  { code: "718-7",   display: "Hemoglobin",           displayPtBR: "Hemoglobina",        unit: "g/dL", category: "Hematologia" },
  { code: "4544-3",  display: "Hematocrit",           displayPtBR: "Hematócrito",        unit: "%", category: "Hematologia" },
  { code: "6690-2",  display: "Leukocytes (WBC)",     displayPtBR: "Leucócitos",         unit: "10*3/uL", category: "Hematologia" },
  { code: "26515-7", display: "Platelets",            displayPtBR: "Plaquetas",          unit: "10*3/uL", category: "Hematologia" },
  { code: "789-8",   display: "Erythrocytes (RBC)",   displayPtBR: "Hemácias",           unit: "10*6/uL", category: "Hematologia" },
  { code: "4679-7",  display: "Reticulocytes",        displayPtBR: "Reticulócitos",      unit: "%", category: "Hematologia" },
  // Bioquímica — Glicemia
  { code: "2345-7",  display: "Glucose [fasting]",    displayPtBR: "Glicemia de jejum",  unit: "mg/dL", category: "Bioquímica" },
  { code: "4548-4",  display: "Hemoglobin A1c",       displayPtBR: "Hemoglobina glicada (HbA1c)", unit: "%", category: "Bioquímica" },
  { code: "1558-6",  display: "Glucose [post-meal]",  displayPtBR: "Glicemia pós-prandial", unit: "mg/dL", category: "Bioquímica" },
  // Bioquímica — Lipídios
  { code: "2093-3",  display: "Cholesterol total",    displayPtBR: "Colesterol total",   unit: "mg/dL", category: "Lipídios" },
  { code: "2085-9",  display: "HDL Cholesterol",      displayPtBR: "Colesterol HDL",     unit: "mg/dL", category: "Lipídios" },
  { code: "2089-1",  display: "LDL Cholesterol",      displayPtBR: "Colesterol LDL",     unit: "mg/dL", category: "Lipídios" },
  { code: "2571-8",  display: "Triglycerides",        displayPtBR: "Triglicerídeos",     unit: "mg/dL", category: "Lipídios" },
  // Função Renal
  { code: "2160-0",  display: "Creatinine",           displayPtBR: "Creatinina",         unit: "mg/dL", category: "Função Renal" },
  { code: "3094-0",  display: "Urea nitrogen (BUN)",  displayPtBR: "Ureia",              unit: "mg/dL", category: "Função Renal" },
  { code: "3097-3",  display: "Urea",                 displayPtBR: "Ureia sérica",       unit: "mg/dL", category: "Função Renal" },
  { code: "33914-3", display: "eGFR (CKD-EPI)",       displayPtBR: "Taxa de filtração glomerular estimada", unit: "mL/min/1.73m2", category: "Função Renal" },
  { code: "3084-1",  display: "Uric acid",            displayPtBR: "Ácido úrico",        unit: "mg/dL", category: "Função Renal" },
  // Função Hepática
  { code: "1742-6",  display: "ALT (TGP)",            displayPtBR: "TGP (ALT)",          unit: "U/L", category: "Função Hepática" },
  { code: "1920-8",  display: "AST (TGO)",            displayPtBR: "TGO (AST)",          unit: "U/L", category: "Função Hepática" },
  { code: "6768-6",  display: "Alkaline phosphatase", displayPtBR: "Fosfatase alcalina", unit: "U/L", category: "Função Hepática" },
  { code: "2324-2",  display: "GGT",                  displayPtBR: "Gama-GT (GGT)",      unit: "U/L", category: "Função Hepática" },
  { code: "1975-2",  display: "Total Bilirubin",      displayPtBR: "Bilirrubina total",  unit: "mg/dL", category: "Função Hepática" },
  { code: "1968-7",  display: "Direct Bilirubin",     displayPtBR: "Bilirrubina direta", unit: "mg/dL", category: "Função Hepática" },
  // Tireoide
  { code: "3016-3",  display: "TSH",                  displayPtBR: "TSH",                unit: "mIU/L", category: "Tireoide" },
  { code: "3026-2",  display: "Free T4",              displayPtBR: "T4 livre",           unit: "ng/dL", category: "Tireoide" },
  { code: "3053-6",  display: "Free T3",              displayPtBR: "T3 livre",           unit: "pg/mL", category: "Tireoide" },
  // Coagulação
  { code: "5902-2",  display: "Prothrombin time (PT)", displayPtBR: "Tempo de protrombina (TP)", unit: "s", category: "Coagulação" },
  { code: "6301-6",  display: "INR",                  displayPtBR: "INR",                unit: "", category: "Coagulação" },
  { code: "3173-2",  display: "aPTT",                 displayPtBR: "TTPA",               unit: "s", category: "Coagulação" },
  // Inflamatórios / Outros
  { code: "1988-5",  display: "CRP",                  displayPtBR: "Proteína C-reativa (PCR)", unit: "mg/L", category: "Inflamatórios" },
  { code: "30341-2", display: "ESR",                  displayPtBR: "VHS (velocidade de hemossedimentação)", unit: "mm/h", category: "Inflamatórios" },
  // Eletrólitos
  { code: "2951-2",  display: "Sodium",               displayPtBR: "Sódio",              unit: "mEq/L", category: "Eletrólitos" },
  { code: "2823-3",  display: "Potassium",            displayPtBR: "Potássio",           unit: "mEq/L", category: "Eletrólitos" },
  { code: "17861-6", display: "Calcium",              displayPtBR: "Cálcio",             unit: "mg/dL", category: "Eletrólitos" },
  { code: "2601-3",  display: "Magnesium",            displayPtBR: "Magnésio",           unit: "mg/dL", category: "Eletrólitos" },
  // Urinálise
  { code: "24356-8", display: "Urinalysis complete",  displayPtBR: "Urina tipo I (EAS)", unit: "", category: "Urinálise" },
];

// ─── Lab Observation builder ─────────────────────────────────────────────────

export function buildFHIRLabObservation(
  patientId: string,
  loincCode: string,
  value: number,
  date: string,
  encounterId?: string,
): FHIRResource | null {
  const entry = LAB_LOINC.find(l => l.code === loincCode);
  if (!entry) return null;

  return buildFHIRObservation({
    id: crypto.randomUUID(),
    patientId,
    encounterId,
    date,
    code: entry.code,
    display: entry.display,
    value,
    unit: entry.unit,
    system: "http://loinc.org",
  });
}

// ─── Bundle builder ──────────────────────────────────────────────────────────

export function buildFHIRBundle(resources: FHIRResource[]): FHIRBundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: resources.map(r => ({
      fullUrl: `urn:uuid:${r.id ?? crypto.randomUUID()}`,
      resource: r,
    })),
  };
}

// ─── Export helper ───────────────────────────────────────────────────────────

export function exportFHIRBundleAsJson(bundle: FHIRBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function downloadFHIRBundle(bundle: FHIRBundle, filename: string) {
  const json = exportFHIRBundleAsJson(bundle);
  const blob = new Blob([json], { type: "application/fhir+json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import / Parse ──────────────────────────────────────────────────────────

export interface FHIRImportResult {
  patients: PatientData[];
  encounters: EncounterData[];
  observations: ObservationData[];
  conditions: ConditionData[];
  unknownResources: string[];
  totalParsed: number;
}

function getRef(ref: unknown): string {
  if (typeof ref === "string") return ref.split("/").pop() ?? "";
  if (ref && typeof ref === "object" && "reference" in ref) {
    return String((ref as { reference: string }).reference).split("/").pop() ?? "";
  }
  return "";
}

export function parseFHIRBundle(json: string): FHIRImportResult {
  const data = JSON.parse(json);
  const entries: FHIRResource[] = [];

  if (data.resourceType === "Bundle" && Array.isArray(data.entry)) {
    for (const e of data.entry) {
      if (e.resource) entries.push(e.resource as FHIRResource);
    }
  } else if (data.resourceType) {
    entries.push(data as FHIRResource);
  }

  const result: FHIRImportResult = {
    patients: [], encounters: [], observations: [], conditions: [],
    unknownResources: [], totalParsed: entries.length,
  };

  for (const r of entries) {
    switch (r.resourceType) {
      case "Patient": {
        const names = Array.isArray(r.name) ? r.name : [];
        const firstName = names[0];
        const given = Array.isArray(firstName?.given) ? firstName.given.join(" ") : "";
        const family = firstName?.family ?? "";
        const fullName = `${given} ${family}`.trim() || "Paciente Importado";

        const ids = Array.isArray(r.identifier) ? r.identifier : [];
        const cpfId = ids.find((i: any) =>
          i.system?.includes("cpf") || i.system?.includes("237") || i.type?.coding?.[0]?.code === "TAX"
        );
        const cpf = (cpfId as any)?.value ?? "";

        const telecoms = Array.isArray(r.telecom) ? r.telecom : [];
        const phone = (telecoms.find((t: any) => t.system === "phone") as any)?.value ?? "";
        const email = (telecoms.find((t: any) => t.system === "email") as any)?.value ?? "";

        result.patients.push({
          id: r.id ?? crypto.randomUUID(),
          name: fullName,
          cpf,
          birthDate: typeof r.birthDate === "string" ? r.birthDate : undefined,
          gender: (r.gender as any) ?? "unknown",
          phone, email,
        });
        break;
      }
      case "Encounter": {
        result.encounters.push({
          id: r.id ?? crypto.randomUUID(),
          patientId: getRef(r.subject),
          date: (r.period as any)?.start ?? new Date().toISOString(),
          status: (r.status as any) ?? "finished",
          type: Array.isArray(r.type) ? (r.type[0] as any)?.text : undefined,
          professionalName: Array.isArray(r.participant) ? (r.participant[0] as any)?.individual?.display : undefined,
        });
        break;
      }
      case "Observation": {
        const coding = (r.code as any)?.coding?.[0];
        result.observations.push({
          id: r.id ?? crypto.randomUUID(),
          patientId: getRef(r.subject),
          encounterId: r.encounter ? getRef(r.encounter) : undefined,
          date: typeof r.effectiveDateTime === "string" ? r.effectiveDateTime : new Date().toISOString(),
          code: coding?.code ?? "",
          display: coding?.display ?? (r.code as any)?.text ?? "",
          value: (r.valueQuantity as any)?.value,
          unit: (r.valueQuantity as any)?.unit,
        });
        break;
      }
      case "Condition": {
        const coding = (r.code as any)?.coding?.[0];
        result.conditions.push({
          id: r.id ?? crypto.randomUUID(),
          patientId: getRef(r.subject),
          encounterId: r.encounter ? getRef(r.encounter) : undefined,
          code: coding?.code ?? "",
          display: coding?.display ?? (r.code as any)?.text ?? "",
          onsetDate: typeof r.onsetDateTime === "string" ? r.onsetDateTime : undefined,
          clinicalStatus: (r.clinicalStatus as any)?.coding?.[0]?.code ?? "active",
        });
        break;
      }
      default:
        result.unknownResources.push(r.resourceType);
    }
  }

  return result;
}
