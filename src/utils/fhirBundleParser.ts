/**
 * FHIR Bundle Parser — Extrai recursos de bundles FHIR R4 recebidos.
 *
 * Suporta:
 * - Patient (extrai dados demográficos, CPF)
 * - Condition (diagnósticos, CID-10)
 * - Observation (sinais vitais, resultados de exames)
 * - MedicationRequest (prescrições)
 * - AllergyIntolerance (alergias)
 * - Procedure (procedimentos)
 * - Encounter (encontros/atendimentos)
 *
 * Referência: https://hl7.org/fhir/R4/bundle.html
 */

// ── Tipos FHIR simplificados ────────────────────────────────────

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface FhirBundleEntry {
  resource?: FhirResource;
  fullUrl?: string;
}

export interface FhirBundle {
  resourceType: "Bundle";
  id?: string;
  type?: string;
  timestamp?: string;
  entry?: FhirBundleEntry[];
}

// ── Recursos extraídos ──────────────────────────────────────────

export interface ExtractedPatient {
  name?: string;
  cpf?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
  email?: string;
}

export interface ExtractedCondition {
  code?: string;          // CID-10
  codeSystem?: string;
  display?: string;
  clinicalStatus?: string;
  recordedDate?: string;
}

export interface ExtractedObservation {
  code?: string;
  codeSystem?: string;
  display?: string;
  value?: string | number;
  unit?: string;
  effectiveDate?: string;
  category?: string;
}

export interface ExtractedMedication {
  name?: string;
  dosage?: string;
  status?: string;
  authoredOn?: string;
}

export interface ExtractedAllergy {
  substance?: string;
  clinicalStatus?: string;
  category?: string;
  criticality?: string;
}

export interface ExtractedProcedure {
  code?: string;
  display?: string;
  performedDate?: string;
  status?: string;
}

export interface ParsedBundle {
  bundleId?: string;
  bundleType?: string;
  timestamp?: string;
  patient?: ExtractedPatient;
  conditions: ExtractedCondition[];
  observations: ExtractedObservation[];
  medications: ExtractedMedication[];
  allergies: ExtractedAllergy[];
  procedures: ExtractedProcedure[];
  resourceTypes: string[];
  resourceCount: number;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────

function extractCoding(concept?: FhirCodeableConcept): { code?: string; system?: string; display?: string } {
  if (!concept) return {};
  const coding = concept.coding?.[0];
  return {
    code: coding?.code,
    system: coding?.system,
    display: coding?.display || concept.text,
  };
}

function extractCPF(resource: FhirResource): string | undefined {
  const identifiers = resource.identifier as Array<{ system?: string; value?: string }> | undefined;
  if (!identifiers) return undefined;

  for (const id of identifiers) {
    // CPF system in RNDS
    if (
      id.system === "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf" ||
      id.system === "urn:oid:2.16.840.1.113883.13.237" ||
      id.system?.includes("cpf")
    ) {
      return id.value;
    }
  }
  return undefined;
}

function extractPatientName(resource: FhirResource): string | undefined {
  const names = resource.name as Array<{ text?: string; given?: string[]; family?: string }> | undefined;
  if (!names || names.length === 0) return undefined;
  const name = names[0];
  if (name.text) return name.text;
  const parts = [...(name.given || []), name.family].filter(Boolean);
  return parts.join(" ") || undefined;
}

// ── Resource Extractors ─────────────────────────────────────────

function extractPatient(resource: FhirResource): ExtractedPatient {
  const telecom = resource.telecom as Array<{ system?: string; value?: string }> | undefined;

  return {
    name: extractPatientName(resource),
    cpf: extractCPF(resource),
    birthDate: resource.birthDate as string | undefined,
    gender: resource.gender as string | undefined,
    phone: telecom?.find((t) => t.system === "phone")?.value,
    email: telecom?.find((t) => t.system === "email")?.value,
  };
}

function extractCondition(resource: FhirResource): ExtractedCondition {
  const { code, system, display } = extractCoding(resource.code as FhirCodeableConcept | undefined);
  const clinicalCoding = extractCoding(resource.clinicalStatus as FhirCodeableConcept | undefined);

  return {
    code,
    codeSystem: system,
    display,
    clinicalStatus: clinicalCoding.code,
    recordedDate: resource.recordedDate as string | undefined,
  };
}

function extractObservation(resource: FhirResource): ExtractedObservation {
  const { code, system, display } = extractCoding(resource.code as FhirCodeableConcept | undefined);

  let value: string | number | undefined;
  let unit: string | undefined;

  const valueQuantity = resource.valueQuantity as { value?: number; unit?: string } | undefined;
  if (valueQuantity) {
    value = valueQuantity.value;
    unit = valueQuantity.unit;
  } else if (resource.valueString != null) {
    value = String(resource.valueString);
  } else if (resource.valueBoolean != null) {
    value = (resource.valueBoolean as boolean) ? "Sim" : "Não";
  }

  const categoryArr = resource.category as FhirCodeableConcept[] | undefined;
  const category = categoryArr?.[0]?.coding?.[0]?.code;

  return {
    code,
    codeSystem: system,
    display,
    value,
    unit,
    effectiveDate: (resource.effectiveDateTime || (resource.effectivePeriod as Record<string, unknown> | undefined)?.start) as string | undefined,
    category,
  };
}

function extractMedication(resource: FhirResource): ExtractedMedication {
  const medConcept = resource.medicationCodeableConcept as FhirCodeableConcept | undefined;
  const { display } = extractCoding(medConcept);

  const dosageInst = (resource.dosageInstruction as Array<{ text?: string }> | undefined)?.[0];

  return {
    name: display,
    dosage: dosageInst?.text,
    status: resource.status as string | undefined,
    authoredOn: resource.authoredOn as string | undefined,
  };
}

function extractAllergy(resource: FhirResource): ExtractedAllergy {
  const { display } = extractCoding(resource.code as FhirCodeableConcept | undefined);
  const clinicalCoding = extractCoding(resource.clinicalStatus as FhirCodeableConcept | undefined);

  return {
    substance: display,
    clinicalStatus: clinicalCoding.code,
    category: (resource.category as string[])?.[0],
    criticality: resource.criticality as string | undefined,
  };
}

function extractProcedure(resource: FhirResource): ExtractedProcedure {
  const { code, display } = extractCoding(resource.code as FhirCodeableConcept | undefined);

  return {
    code,
    display,
    performedDate: (resource.performedDateTime || (resource.performedPeriod as Record<string, unknown> | undefined)?.start) as string | undefined,
    status: resource.status as string | undefined,
  };
}

// ── Main Parser ─────────────────────────────────────────────────

export function parseFhirBundle(bundle: FhirBundle): ParsedBundle {
  const result: ParsedBundle = {
    bundleId: bundle.id,
    bundleType: bundle.type,
    timestamp: bundle.timestamp,
    conditions: [],
    observations: [],
    medications: [],
    allergies: [],
    procedures: [],
    resourceTypes: [],
    resourceCount: 0,
    errors: [],
  };

  if (bundle.resourceType !== "Bundle") {
    result.errors.push(`Esperado resourceType "Bundle", recebido "${bundle.resourceType}"`);
    return result;
  }

  if (!bundle.entry || !Array.isArray(bundle.entry)) {
    result.errors.push("Bundle não contém entries");
    return result;
  }

  const typeSet = new Set<string>();

  for (const entry of bundle.entry) {
    if (!entry.resource) continue;

    const { resourceType } = entry.resource;
    typeSet.add(resourceType);
    result.resourceCount++;

    try {
      switch (resourceType) {
        case "Patient":
          result.patient = extractPatient(entry.resource);
          break;
        case "Condition":
          result.conditions.push(extractCondition(entry.resource));
          break;
        case "Observation":
          result.observations.push(extractObservation(entry.resource));
          break;
        case "MedicationRequest":
          result.medications.push(extractMedication(entry.resource));
          break;
        case "AllergyIntolerance":
          result.allergies.push(extractAllergy(entry.resource));
          break;
        case "Procedure":
          result.procedures.push(extractProcedure(entry.resource));
          break;
        // Skip known non-clinical resources silently
        case "Organization":
        case "Practitioner":
        case "PractitionerRole":
        case "Location":
        case "Encounter":
          break;
        default:
          // Log unknown but don't error
          break;
      }
    } catch (err) {
      result.errors.push(`Erro ao processar ${resourceType}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  result.resourceTypes = Array.from(typeSet).sort();

  return result;
}

/**
 * Valida se um objeto JSON é um FHIR Bundle válido (validação básica).
 */
export function isValidFhirBundle(data: unknown): data is FhirBundle {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return obj.resourceType === "Bundle" && Array.isArray(obj.entry);
}
