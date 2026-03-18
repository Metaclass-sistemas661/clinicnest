/**
 * F8: Exportação HL7 FHIR R4 do Odontograma
 * 
 * Serializa dados do odontograma e periograma em recursos FHIR:
 * - Condition (condições por dente)
 * - Observation (medições periodontais)
 * - CarePlan (plano de tratamento)
 * 
 * Referências:
 * - https://hl7.org/fhir/R4/condition.html
 * - https://hl7.org/fhir/R4/observation.html
 * - https://hl7.org/fhir/R4/careplan.html
 * - SNOMED CT dental codes
 */
import type { ToothRecord } from "@/components/odontograma/OdontogramChart";
import type { ToothConditionKey } from "@/components/odontograma/odontogramConstants";

// SNOMED CT mappings for dental conditions
const CONDITION_SNOMED: Partial<Record<ToothConditionKey, { code: string; display: string }>> = {
  caries:       { code: "80967001", display: "Dental caries" },
  missing:      { code: "27355003", display: "Tooth loss" },
  restored:     { code: "82212003", display: "Dental restoration present" },
  fracture:     { code: "52515009", display: "Tooth fracture" },
  extraction:   { code: "234975001", display: "Post-extraction state" },
  crown:        { code: "90534002", display: "Dental crown present" },
  bridge:       { code: "87365002", display: "Fixed dental prosthesis" },
  implant:      { code: "398041002", display: "Dental implant present" },
  abscess:      { code: "196381000", display: "Dental abscess" },
  periapical:   { code: "84489001", display: "Periapical pathology" },
  mobility:     { code: "59819007", display: "Tooth mobility" },
  recession:    { code: "81608004", display: "Gingival recession" },
  erosion:      { code: "52031007", display: "Dental erosion" },
  sealant:      { code: "84755001", display: "Dental sealant" },
  root_canal:   { code: "234947007", display: "Root canal treated tooth" },
  veneer:       { code: "131159009", display: "Dental veneer" },
  impacted:     { code: "196523005", display: "Impacted tooth" },
  agenesis:     { code: "37320007", display: "Tooth agenesis" },
};

// FDI tooth to FHIR body site
function toothToBodySite(toothNumber: number) {
  return {
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/tooth-numbering-fdi",
      code: toothNumber.toString(),
      display: `Tooth ${toothNumber} (FDI)`,
    }],
    text: `Dente ${toothNumber}`,
  };
}

interface FhirExportOptions {
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  organizationName: string;
  examDate: string;
}

/**
 * Exporta teeth records como FHIR Bundle (Condition resources)
 */
export function exportOdontogramFhir(
  teeth: ToothRecord[],
  options: FhirExportOptions,
): object {
  const bundle: any = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    meta: {
      profile: ["http://hl7.org/fhir/R4/StructureDefinition/Bundle"],
    },
    entry: [] as any[],
  };

  // Patient reference
  const patientRef = {
    reference: `Patient/${options.patientId}`,
    display: options.patientName,
  };

  // Practitioner reference
  const practitionerRef = {
    reference: `Practitioner/${options.practitionerId}`,
    display: options.practitionerName,
  };

  // Add Condition resources for each tooth
  for (const tooth of teeth) {
    if (tooth.condition === "healthy") continue;

    const snomedMapping = CONDITION_SNOMED[tooth.condition];
    const condition: any = {
      resourceType: "Condition",
      id: `tooth-${tooth.tooth_number}-condition`,
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        }],
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
        }],
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis",
        }],
      }],
      code: snomedMapping
        ? {
            coding: [{
              system: "http://snomed.info/sct",
              code: snomedMapping.code,
              display: snomedMapping.display,
            }],
            text: snomedMapping.display,
          }
        : { text: tooth.condition },
      bodySite: [toothToBodySite(tooth.tooth_number)],
      subject: patientRef,
      recorder: practitionerRef,
      recordedDate: options.examDate,
    };

    // Priority mapped to severity
    if (tooth.priority === "urgent") {
      condition.severity = {
        coding: [{ system: "http://snomed.info/sct", code: "24484000", display: "Severe" }],
      };
    } else if (tooth.priority === "high") {
      condition.severity = {
        coding: [{ system: "http://snomed.info/sct", code: "6736007", display: "Moderate" }],
      };
    }

    // Mobility as extension
    if (tooth.mobility_grade != null && tooth.mobility_grade > 0) {
      condition.extension = [{
        url: "http://clinicaflow.com/fhir/extension/mobility-grade",
        valueInteger: tooth.mobility_grade,
      }];
    }

    // Surfaces as note
    if (tooth.surfaces) {
      condition.note = [{ text: `Faces afetadas: ${tooth.surfaces}` }];
    }

    bundle.entry.push({ resource: condition });
  }

  return bundle;
}

/**
 * Exporta medições periodontais como FHIR Observation Bundle
 */
export function exportPeriogramFhir(
  measurements: Array<{
    tooth_number: number;
    site: string;
    probing_depth: number | null;
    recession: number | null;
    bleeding: boolean;
    plaque: boolean;
  }>,
  options: FhirExportOptions,
): object {
  const bundle: any = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [] as any[],
  };

  const patientRef = {
    reference: `Patient/${options.patientId}`,
    display: options.patientName,
  };

  for (const m of measurements) {
    if (m.probing_depth == null) continue;

    const observation: any = {
      resourceType: "Observation",
      id: `perio-${m.tooth_number}-${m.site}`,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "exam",
          display: "Exam",
        }],
      }],
      code: {
        coding: [{
          system: "http://loinc.org",
          code: "LP35025-0",
          display: "Periodontal probing depth",
        }],
        text: `Profundidade de sondagem - Dente ${m.tooth_number} (${m.site})`,
      },
      subject: patientRef,
      effectiveDateTime: options.examDate,
      valueQuantity: {
        value: m.probing_depth,
        unit: "mm",
        system: "http://unitsofmeasure.org",
        code: "mm",
      },
      bodySite: toothToBodySite(m.tooth_number),
      component: [] as any[],
    };

    if (m.recession != null) {
      observation.component.push({
        code: { text: "Recessão gengival" },
        valueQuantity: { value: m.recession, unit: "mm", system: "http://unitsofmeasure.org", code: "mm" },
      });
    }

    if (m.bleeding) {
      observation.component.push({
        code: { coding: [{ system: "http://snomed.info/sct", code: "86616005", display: "Bleeding on probing" }] },
        valueBoolean: true,
      });
    }

    if (m.plaque) {
      observation.component.push({
        code: { text: "Presença de placa" },
        valueBoolean: true,
      });
    }

    bundle.entry.push({ resource: observation });
  }

  return bundle;
}

/**
 * Download FHIR bundle as JSON file
 */
export function downloadFhirBundle(bundle: object, filename: string): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/fhir+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
