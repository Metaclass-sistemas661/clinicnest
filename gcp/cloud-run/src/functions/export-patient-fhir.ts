/**
 * export-patient-fhir — Cloud Run handler */

import { Request, Response } from 'express';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
/**
 * Edge Function: export-patient-fhir
 *
 * Exporta todos os dados clínicos de um paciente como FHIR R4 Bundle (JSON).
 * Inclui: dados cadastrais, prontuários, prescrições, atestados, exames,
 * encaminhamentos e evoluções clínicas.
 *
 * Segurança: somente admin do tenant ou o próprio paciente (via portal).
 * Compliance: LGPD Art. 18 (portabilidade), RNDS interoperabilidade.
 */

const log = createLogger("EXPORT-PATIENT-FHIR");
// ─── RNDS Profile URIs ──────────────────────────────────────────────────────
const RNDS_PATIENT = "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0";
const RNDS_ENCOUNTER = "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRContatoAssistencial-1.0";
const RNDS_CONDITION = "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRDiagnosticoClinico-1.0";
const BR_CPF = "http://rnds-fhir.saude.gov.br/NamingSystem/cpf";
const BR_CRM = "http://www.saude.gov.br/fhir/r4/NamingSystem/professional-council";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fhirId(): string {
  return crypto.randomUUID();
}

function buildPatientResource(p: Record<string, unknown>): Record<string, unknown> {
  const nameParts = String(p.name ?? "").split(" ");
  const family = nameParts.length > 1 ? nameParts.slice(-1).join(" ") : nameParts[0];
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [nameParts[0]];

  const resource: Record<string, unknown> = {
    resourceType: "Patient",
    id: String(p.id),
    meta: { profile: [RNDS_PATIENT] },
    active: true,
    name: [{ use: "official", family, given }],
    gender: "unknown",
  };

  if (p.date_of_birth) resource.birthDate = String(p.date_of_birth);

  const identifiers: Record<string, unknown>[] = [];
  if (p.cpf) identifiers.push({ system: BR_CPF, value: String(p.cpf).replace(/\D/g, "") });
  if (identifiers.length > 0) resource.identifier = identifiers;

  const telecom: Record<string, unknown>[] = [];
  if (p.phone) telecom.push({ system: "phone", value: String(p.phone), use: "mobile" });
  if (p.email) telecom.push({ system: "email", value: String(p.email) });
  if (telecom.length > 0) resource.telecom = telecom;

  if (p.street || p.city || p.state) {
    resource.address = [{
      use: "home",
      line: p.street ? [`${p.street}${p.street_number ? `, ${p.street_number}` : ""}`] : undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      postalCode: p.zip_code ?? undefined,
      country: "BR",
    }];
  }

  if (p.allergies) {
    resource.extension = [{
      url: "http://clinicaflow.com/fhir/extension/allergies",
      valueString: String(p.allergies),
    }];
  }

  return resource;
}

function buildEncounterResource(
  rec: Record<string, unknown>,
  patientId: string,
  clinicName?: string): Record<string, unknown> {
  const resource: Record<string, unknown> = {
    resourceType: "Encounter",
    id: String(rec.id),
    meta: { profile: [RNDS_ENCOUNTER] },
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    subject: { reference: `Patient/${patientId}` },
    period: { start: String(rec.record_date ?? rec.created_at) },
  };

  if (rec.chief_complaint) {
    resource.type = [{ text: String(rec.chief_complaint) }];
  }

  if (rec.professional_name) {
    resource.participant = [{
      individual: { display: String(rec.professional_name) },
    }];
  }

  if (clinicName) {
    resource.serviceProvider = { display: clinicName };
  }

  // Embed clinical details as text narrative
  const textParts: string[] = [];
  if (rec.anamnesis) textParts.push(`Anamnese: ${rec.anamnesis}`);
  if (rec.physical_exam) textParts.push(`Exame Físico: ${rec.physical_exam}`);
  if (rec.diagnosis) textParts.push(`Diagnóstico: ${rec.diagnosis}`);
  if (rec.treatment_plan) textParts.push(`Plano: ${rec.treatment_plan}`);
  if (rec.notes) textParts.push(`Notas: ${rec.notes}`);
  if (textParts.length > 0) {
    resource.text = { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">${textParts.map(t => `<p>${escapeHtml(t)}</p>`).join("")}</div>` };
  }

  return resource;
}

function buildConditionResource(
  rec: Record<string, unknown>,
  patientId: string): Record<string, unknown> | null {
  if (!rec.cid_code) return null;
  return {
    resourceType: "Condition",
    id: fhirId(),
    meta: { profile: [RNDS_CONDITION] },
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    code: {
      coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: String(rec.cid_code), display: String(rec.diagnosis ?? "") }],
      text: String(rec.diagnosis ?? rec.cid_code),
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${rec.id}` },
    onsetDateTime: String(rec.record_date ?? rec.created_at),
  };
}

function buildMedicationRequest(
  rx: Record<string, unknown>,
  patientId: string): Record<string, unknown> {
  const statusMap: Record<string, string> = { ativo: "active", expirado: "completed", cancelado: "cancelled" };
  return {
    resourceType: "MedicationRequest",
    id: String(rx.id),
    status: statusMap[String(rx.status ?? "ativo")] ?? "unknown",
    intent: "order",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category", code: "outpatient" }] }],
    subject: { reference: `Patient/${patientId}` },
    authoredOn: String(rx.issued_at),
    note: [
      { text: String(rx.medications ?? "") },
      ...(rx.instructions ? [{ text: String(rx.instructions) }] : []),
    ],
    extension: [{
      url: "http://clinicaflow.com/fhir/extension/prescription-type",
      valueString: String(rx.prescription_type ?? "simples"),
    }],
    ...(rx.professional_name ? {
      requester: { display: String(rx.professional_name) },
    } : {}),
  };
}

function buildDocumentReference(
  doc: Record<string, unknown>,
  patientId: string,
  docType: string,
  title: string,
  content: string): Record<string, unknown> {
  const typeCodeMap: Record<string, { code: string; display: string }> = {
    atestado: { code: "11488-4", display: "Consultation note" },
    declaracao_comparecimento: { code: "11488-4", display: "Consultation note" },
    laudo: { code: "18842-5", display: "Discharge summary" },
    relatorio: { code: "28570-0", display: "Provider-unspecified Procedure note" },
    encaminhamento: { code: "57133-1", display: "Referral note" },
    evolucao: { code: "11506-3", display: "Provider-unspecified Progress note" },
    exame: { code: "26436-6", display: "Laboratory studies" },
  };
  const tInfo = typeCodeMap[docType] ?? { code: "55188-7", display: "Patient data Document" };

  return {
    resourceType: "DocumentReference",
    id: String(doc.id),
    status: "current",
    type: {
      coding: [{ system: "http://loinc.org", code: tInfo.code, display: tInfo.display }],
      text: title,
    },
    subject: { reference: `Patient/${patientId}` },
    date: String(doc.issued_at ?? doc.created_at ?? doc.evolution_date ?? new Date().toISOString()),
    content: [{
      attachment: {
        contentType: "text/plain",
        data: btoa(unescape(encodeURIComponent(content))),
        title,
      },
    }],
    ...(doc.professional_name ? { author: [{ display: String(doc.professional_name) }] } : {}),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const tenantId = user.tenant_id;
    const body = req.body || {};
    const patientId = String(body.patient_id ?? "").trim();
        if (!patientId) {
          return res.status(400).json({ error: "patient_id é obrigatório" });
        }

        // ── Authorization: admin do tenant OU o próprio paciente ──
        const { data: adminCheck } = await db.rpc("is_tenant_admin", {
          p_user_id: user.id,
          p_tenant_id: tenantId,
        });
        const isAdmin = adminCheck === true;

        // Check if user IS the patient (portal access)
        const { data: patientSelf } = await db.from("patients")
          .select("id")
          .eq("id", patientId)
          .eq("tenant_id", tenantId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isAdmin && !patientSelf) {
          return res.status(403).json({ error: "Acesso negado. Somente admin ou o próprio paciente." });
        }

        // ── Fetch patient ──
        const { data: patient, error: pErr } = await db.from("patients")
          .select("id, name, cpf, date_of_birth, email, phone, allergies, street, street_number, city, state, zip_code, notes, created_at")
          .eq("id", patientId)
          .eq("tenant_id", tenantId)
          .single();

        if (pErr || !patient) {
          return res.status(404).json({ error: "Paciente não encontrado" });
        }

        // ── Fetch clinic name ──
        const { data: tenantRow } = await db.from("tenants")
          .select("name")
          .eq("id", tenantId)
          .single();
        const clinicName = tenantRow?.name ?? "Clínica";

        // ── Fetch all clinical data in parallel ──
        const [
          { data: records },
          { data: prescriptions },
          { data: certificates },
          { data: exams },
          { data: referrals },
          { data: evolutions },
        ] = await Promise.all([
          db.from("medical_records")
            .select("id, record_date, chief_complaint, anamnesis, physical_exam, diagnosis, cid_code, treatment_plan, prescriptions, notes, created_at, professional:profiles(full_name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("record_date", { ascending: false })
            .limit(500),
          db.from("prescriptions")
            .select("id, issued_at, prescription_type, medications, instructions, status, professional:profiles(full_name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("issued_at", { ascending: false })
            .limit(500),
          db.from("medical_certificates")
            .select("id, issued_at, certificate_type, content, cid_code, days_off, professional:profiles(full_name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("issued_at", { ascending: false })
            .limit(500),
          db.from("exam_results")
            .select("id, created_at, exam_name, exam_type, result_text, interpretation, status, lab_name")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(500),
          db.from("referrals")
            .select("id, created_at, reason, clinical_summary, status, priority, from_prof:profiles!from_professional(full_name), to_spec:specialties(name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(500),
          db.from("clinical_evolutions")
            .select("id, evolution_date, evolution_type, subjective, objective, assessment, plan, notes, professional:profiles(full_name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("evolution_date", { ascending: false })
            .limit(500),
        ]);

        // ── Build FHIR Bundle ──
        const resources: Record<string, unknown>[] = [];

        // Patient
        resources.push(buildPatientResource(patient));

        // Medical Records → Encounter + Condition
        for (const rec of (records ?? [])) {
          const r = rec as Record<string, unknown>;
          const profName = (r.professional as Record<string, unknown>)?.full_name;
          resources.push(buildEncounterResource({ ...r, professional_name: profName }, patientId, clinicName));
          const condition = buildConditionResource(r, patientId);
          if (condition) resources.push(condition);
        }

        // Prescriptions → MedicationRequest
        for (const rx of (prescriptions ?? [])) {
          const r = rx as Record<string, unknown>;
          const profName = (r.professional as Record<string, unknown>)?.full_name;
          resources.push(buildMedicationRequest({ ...r, professional_name: profName }, patientId));
        }

        // Medical Certificates → DocumentReference
        for (const cert of (certificates ?? [])) {
          const c = cert as Record<string, unknown>;
          const profName = (c.professional as Record<string, unknown>)?.full_name;
          const certType = String(c.certificate_type ?? "atestado");
          const title = certType === "atestado" ? "Atestado Médico"
            : certType === "declaracao_comparecimento" ? "Declaração de Comparecimento"
            : certType === "laudo" ? "Laudo Médico" : "Relatório Médico";
          const content = [
            String(c.content ?? ""),
            c.cid_code ? `CID: ${c.cid_code}` : "",
            c.days_off ? `Dias de afastamento: ${c.days_off}` : "",
          ].filter(Boolean).join("\n");
          resources.push(buildDocumentReference({ ...c, professional_name: profName }, patientId, certType, title, content));
        }

        // Exam Results → DocumentReference
        for (const exam of (exams ?? [])) {
          const e = exam as Record<string, unknown>;
          const content = [
            `Exame: ${e.exam_name}`,
            e.result_text ? `Resultado: ${e.result_text}` : "",
            e.interpretation ? `Interpretação: ${e.interpretation}` : "",
            e.lab_name ? `Laboratório: ${e.lab_name}` : "",
            `Status: ${e.status}`,
          ].filter(Boolean).join("\n");
          resources.push(buildDocumentReference(e, patientId, "exame", String(e.exam_name ?? "Exame"), content));
        }

        // Referrals → DocumentReference
        for (const ref of (referrals ?? [])) {
          const r = ref as Record<string, unknown>;
          const fromProf = (r.from_prof as Record<string, unknown>)?.full_name;
          const toSpec = (r.to_spec as Record<string, unknown>)?.name;
          const title = `Encaminhamento${toSpec ? ` — ${toSpec}` : ""}`;
          const content = [
            `Motivo: ${r.reason}`,
            r.clinical_summary ? `Resumo clínico: ${r.clinical_summary}` : "",
            `Prioridade: ${r.priority}`,
            `Status: ${r.status}`,
          ].filter(Boolean).join("\n");
          resources.push(buildDocumentReference({ ...r, professional_name: fromProf }, patientId, "encaminhamento", title, content));
        }

        // Clinical Evolutions → DocumentReference
        for (const evo of (evolutions ?? [])) {
          const e = evo as Record<string, unknown>;
          const profName = (e.professional as Record<string, unknown>)?.full_name;
          const content = [
            e.subjective ? `S: ${e.subjective}` : "",
            e.objective ? `O: ${e.objective}` : "",
            e.assessment ? `A: ${e.assessment}` : "",
            e.plan ? `P: ${e.plan}` : "",
            e.notes ? `Notas: ${e.notes}` : "",
          ].filter(Boolean).join("\n");
          resources.push(buildDocumentReference(
            { ...e, professional_name: profName },
            patientId, "evolucao",
            `Evolução ${String(e.evolution_type ?? "SOAP")} — ${String(e.evolution_date ?? "")}`,
            content));
        }

        const bundle = {
          resourceType: "Bundle",
          type: "collection",
          timestamp: new Date().toISOString(),
          meta: {
            tag: [{
              system: "http://clinicaflow.com/fhir/tag",
              code: "lgpd-portability-export",
              display: "LGPD Art. 18 — Portabilidade de dados",
            }],
          },
          total: resources.length,
          entry: resources.map(r => ({
            fullUrl: `urn:uuid:${r.uid ?? fhirId()}`,
            resource: r,
          })),
        };

        // ── Audit log ──
        await db.rpc("log_tenant_action", {
          p_tenant_id: tenantId,
          p_actor_user_id: user.id,
          p_action: "lgpd_fhir_export",
          p_entity_type: "patients",
          p_entity_id: patientId,
          p_metadata: { resources_count: resources.length, format: "fhir_r4_json" },
        }).catch(() => { /* non-blocking */ });

        log("FHIR Bundle gerado", { patientId, resources: resources.length });

        return res.status(200).json(bundle);
  } catch (err: any) {
    console.error(`[export-patient-fhir] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
