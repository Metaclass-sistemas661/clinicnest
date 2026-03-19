/**
 * ClinicNest — Geradores de PDF Clínicos (Premium)
 *
 * Todos utilizam o Motor Universal (BasePremiumPDFLayout) para
 * garantir header, watermark, footer e design premium padronizado.
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateQRCodeDataUrl, getVerificationUrl } from "@/components/signature/DocumentQRCode";
import { logger } from "@/lib/logger";
import {
  BasePremiumPDFLayout,
  FONT,
  COLORS,
  drawLine,
  renderField,
  renderPatientInfoBox,
  renderSignatureBlock,
  renderDigitalSeal,
  renderSoapSection,
  renderVitalsGrid,
} from "@/lib/pdf";

// ─── Cores por tipo de documento ────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  atestado: "#2563eb",
  declaracao_comparecimento: "#059669",
  laudo: "#d97706",
  relatorio: "#7c3aed",
};

async function safeQrDataUrl(hash: string): Promise<string | null> {
  try { return await generateQRCodeDataUrl(hash, 80); }
  catch (e) { logger.error("Error generating QR code for PDF:", e); return null; }
}

async function generateContentHash(content: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(content);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 40);
  } catch { return btoa(content).substring(0, 40); }
}

// ══════════════════════════════════════════════════════════════
// Atestados / Declarações / Laudos / Relatórios
// ══════════════════════════════════════════════════════════════

interface CertificateData {
  certificate_type: string;
  issued_at: string;
  days_off: number | null;
  start_date: string | null;
  end_date: string | null;
  cid_code: string | null;
  content: string;
  notes: string | null;
  professional_name: string;
  professional_crm?: string | null;
  professional_uf?: string | null;
  professional_specialty?: string | null;
  clinic_name: string;
  clinic_address?: string | null;
  clinic_phone?: string | null;
  clinic_cnpj?: string | null;
  clinic_email?: string | null;
  logo_url?: string | null;
  patient_name?: string | null;
  patient_cpf?: string | null;
  patient_birth_date?: string | null;
  digital_signature?: string | null;
  signed_at?: string | null;
}

function certTypeLabel(t: string): string {
  switch (t) {
    case "atestado": return "Atestado Médico";
    case "declaracao_comparecimento": return "Declaração de Comparecimento";
    case "laudo": return "Laudo Médico";
    case "relatorio": return "Relatório Médico";
    default: return "Documento Médico";
  }
}

export async function generateCertificatePdf(cert: CertificateData) {
  const title = certTypeLabel(cert.certificate_type);
  const accentColor = TYPE_COLORS[cert.certificate_type] || "#2563eb";

  const layout = new BasePremiumPDFLayout(
    {
      name: cert.clinic_name || "Clínica",
      cnpj: cert.clinic_cnpj,
      address: cert.clinic_address,
      phone: cert.clinic_phone,
      email: cert.clinic_email,
      logoUrl: cert.logo_url,
    },
    { title, accentColor },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  // ── Dados do paciente ──
  if (cert.patient_name) {
    y = renderPatientInfoBox(layout, {
      name: cert.patient_name,
      cpf: cert.patient_cpf,
      birthDate: cert.patient_birth_date,
    }, y);
  }

  // ── Campos ──
  y = renderField(doc, "Data de Emissão",
    format(new Date(cert.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y, m, layout.contentW);

  if (cert.days_off != null && cert.days_off > 0) {
    let afastamento = `${cert.days_off} dia(s)`;
    if (cert.start_date && cert.end_date) {
      afastamento += ` — de ${format(new Date(cert.start_date), "dd/MM/yyyy")} a ${format(new Date(cert.end_date), "dd/MM/yyyy")}`;
    }
    y = renderField(doc, "Período de Afastamento", afastamento, y, m, layout.contentW);
  }

  if (cert.cid_code) {
    y = renderField(doc, "CID-10", cert.cid_code + " (com autorização do paciente)", y, m, layout.contentW);
  }

  // ── Separador + conteúdo ──
  y += 2;
  drawLine(doc, y, COLORS.BORDER, m, layout.contentW);
  y += 6;

  y = renderField(doc, "Conteúdo", cert.content, y, m, layout.contentW);
  if (cert.notes) {
    y = renderField(doc, "Observações", cert.notes, y, m, layout.contentW);
  }

  // ── Assinatura profissional ──
  y = renderSignatureBlock(layout, {
    professionalName: cert.professional_name,
    councilNumber: cert.professional_crm,
    councilState: cert.professional_uf,
    specialty: cert.professional_specialty,
  }, y);

  // ── Selo digital / QR ──
  if (cert.digital_signature) {
    const qr = await safeQrDataUrl(cert.digital_signature);
    y = renderDigitalSeal(layout, {
      hash: cert.digital_signature,
      signedAt: cert.signed_at,
      qrDataUrl: qr,
      verificationUrl: getVerificationUrl(cert.digital_signature),
    }, y);
  } else {
    const hashContent = `${cert.certificate_type}|${cert.patient_name || ""}|${cert.content}|${cert.issued_at}|${cert.professional_name}`;
    const docHash = await generateContentHash(hashContent);
    const qr = await safeQrDataUrl(docHash);
    y = renderDigitalSeal(layout, {
      hash: docHash,
      qrDataUrl: qr,
      verificationUrl: getVerificationUrl(docHash),
    }, y);
  }

  const filename = `${title.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(cert.issued_at), "yyyy-MM-dd")}.pdf`;
  layout.finalize(filename);
}

// ══════════════════════════════════════════════════════════════
// Receitas Médicas
// ══════════════════════════════════════════════════════════════

interface PrescriptionData {
  prescription_type: string;
  issued_at: string;
  validity_days: number | null;
  expires_at: string | null;
  medications: string;
  instructions: string;
  professional_name: string;
  professional_crm?: string | null;
  professional_uf?: string | null;
  clinic_name: string;
  patient_name?: string;
  patient_cpf?: string | null;
  digital_hash?: string | null;
  signed_at?: string | null;
}

function rxTypeLabel(t: string): string {
  switch (t) {
    case "simples": return "Receita Simples";
    case "especial_b": return "Receita Especial B";
    case "especial_a": return "Receita Especial A";
    case "antimicrobiano": return "Receita de Antimicrobiano";
    default: return "Receituário";
  }
}

export async function generatePrescriptionPdf(rx: PrescriptionData) {
  const title = rxTypeLabel(rx.prescription_type);

  const layout = new BasePremiumPDFLayout(
    { name: rx.clinic_name },
    { title, accentColor: "#0d9488" },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  y = renderField(doc, "Data de Emissão",
    format(new Date(rx.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y, m, layout.contentW);

  if (rx.validity_days) {
    let validade = `${rx.validity_days} dias`;
    if (rx.expires_at) validade += ` — válida até ${format(new Date(rx.expires_at), "dd/MM/yyyy")}`;
    y = renderField(doc, "Validade", validade, y, m, layout.contentW);
  }

  if (rx.patient_name) {
    y = renderPatientInfoBox(layout, {
      name: rx.patient_name,
      cpf: rx.patient_cpf,
    }, y);
  }

  drawLine(doc, y, COLORS.BORDER, m, layout.contentW);
  y += 6;

  y = renderField(doc, "Medicamentos", rx.medications, y, m, layout.contentW);
  if (rx.instructions) {
    y = renderField(doc, "Instruções de Uso", rx.instructions, y, m, layout.contentW);
  }

  // ── Assinatura ──
  y = renderSignatureBlock(layout, {
    professionalName: rx.professional_name,
    councilNumber: rx.professional_crm,
    councilState: rx.professional_uf,
  }, y);

  // ── Selo digital ──
  if (rx.digital_hash) {
    const qr = await safeQrDataUrl(rx.digital_hash);
    y = renderDigitalSeal(layout, {
      hash: rx.digital_hash,
      signedAt: rx.signed_at,
      qrDataUrl: qr,
      verificationUrl: getVerificationUrl(rx.digital_hash),
    }, y);
  }

  layout.finalize(`receita_${rx.prescription_type}_${format(new Date(rx.issued_at), "yyyy-MM-dd")}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// Exames
// ══════════════════════════════════════════════════════════════

interface ExamData {
  exam_name: string;
  exam_type: string;
  performed_at: string | null;
  lab_name: string;
  status: string;
  interpretation: string;
  requested_by_name: string;
  clinic_name: string;
}

function examStatusLabel(s: string): string {
  switch (s) {
    case "normal": return "Normal";
    case "alterado": return "Alterado";
    case "critico": return "Crítico";
    default: return "Pendente";
  }
}

export async function generateExamPdf(exam: ExamData) {
  const layout = new BasePremiumPDFLayout(
    { name: exam.clinic_name },
    { title: exam.exam_name || "Resultado de Exame", accentColor: "#0d9488" },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  y = renderField(doc, "Tipo de Exame", exam.exam_type || "—", y, m, layout.contentW);
  if (exam.performed_at) {
    y = renderField(doc, "Data de Realização",
      format(new Date(exam.performed_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y, m, layout.contentW);
  }
  if (exam.lab_name) y = renderField(doc, "Laboratório", exam.lab_name, y, m, layout.contentW);
  y = renderField(doc, "Status", examStatusLabel(exam.status), y, m, layout.contentW);
  if (exam.requested_by_name) y = renderField(doc, "Solicitado por", exam.requested_by_name, y, m, layout.contentW);

  drawLine(doc, y, COLORS.BORDER, m, layout.contentW);
  y += 6;

  if (exam.interpretation) {
    y = renderField(doc, "Interpretação / Resultado", exam.interpretation, y, m, layout.contentW);
  }

  const filename = `exame_${(exam.exam_name || "resultado").toLowerCase().replace(/\s+/g, "_")}_${exam.performed_at ? format(new Date(exam.performed_at), "yyyy-MM-dd") : "sem_data"}.pdf`;
  layout.finalize(filename);
}

// ══════════════════════════════════════════════════════════════
// Prontuário Médico
// ══════════════════════════════════════════════════════════════

interface MedicalRecordPdfData {
  client_name: string;
  record_date: string;
  professional_name: string;
  clinic_name: string;
  chief_complaint: string;
  anamnesis: string;
  physical_exam: string;
  diagnosis: string;
  cid_code: string;
  treatment_plan: string;
  prescriptions: string;
  notes: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  pain_scale: number | null;
  allergies: string;
  current_medications: string;
  medical_history: string;
  digital_hash: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  signed_by_uf?: string | null;
}

export async function generateMedicalRecordPdf(r: MedicalRecordPdfData) {
  const layout = new BasePremiumPDFLayout(
    { name: r.clinic_name },
    { title: "Prontuário Médico", accentColor: "#0d9488" },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  y = renderPatientInfoBox(layout, { name: r.client_name }, y);

  doc.setFontSize(FONT.SMALL);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_SECONDARY);
  doc.text(`Data: ${format(new Date(r.record_date), "dd/MM/yyyy", { locale: ptBR })}`, layout.pageW - m, y - 2, { align: "right" });

  // ── Sinais vitais ──
  const vitals: string[] = [];
  if (r.blood_pressure_systolic != null) vitals.push(`PA: ${r.blood_pressure_systolic}/${r.blood_pressure_diastolic} mmHg`);
  if (r.heart_rate != null) vitals.push(`FC: ${r.heart_rate} bpm`);
  if (r.temperature != null) vitals.push(`Temp: ${r.temperature}°C`);
  if (r.oxygen_saturation != null) vitals.push(`SpO₂: ${r.oxygen_saturation}%`);
  if (r.respiratory_rate != null) vitals.push(`FR: ${r.respiratory_rate} irpm`);
  if (r.weight_kg != null) vitals.push(`Peso: ${r.weight_kg} kg`);
  if (r.height_cm != null) vitals.push(`Alt: ${r.height_cm} cm`);
  if (r.pain_scale != null) vitals.push(`Dor: ${r.pain_scale}/10`);
  y = renderVitalsGrid(layout, vitals, y);

  const fields: [string, string][] = [
    ["Alergias", r.allergies],
    ["Medicamentos em Uso", r.current_medications],
    ["Histórico Médico", r.medical_history],
    ["Queixa Principal", r.chief_complaint],
    ["Anamnese", r.anamnesis],
    ["Exame Físico", r.physical_exam],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    y = layout.ensureSpace(y, 15);
    y = renderField(doc, label, value, y, m, layout.contentW);
  }

  if (r.diagnosis || r.cid_code) {
    y = layout.ensureSpace(y, 12);
    const diag = [r.diagnosis, r.cid_code ? `CID-10: ${r.cid_code}` : ""].filter(Boolean).join(" — ");
    y = renderField(doc, "Diagnóstico", diag, y, m, layout.contentW);
  }

  if (r.treatment_plan) { y = layout.ensureSpace(y, 15); y = renderField(doc, "Plano Terapêutico", r.treatment_plan, y, m, layout.contentW); }
  if (r.prescriptions) { y = layout.ensureSpace(y, 15); y = renderField(doc, "Prescrições", r.prescriptions, y, m, layout.contentW); }
  if (r.notes) { y = layout.ensureSpace(y, 12); y = renderField(doc, "Observações", r.notes, y, m, layout.contentW); }

  if (r.digital_hash) {
    const qr = await safeQrDataUrl(r.digital_hash);
    y = renderDigitalSeal(layout, {
      hash: r.digital_hash,
      signedAt: r.signed_at,
      signerName: r.signed_by_name,
      signerCrm: r.signed_by_crm,
      signerUf: r.signed_by_uf,
      qrDataUrl: qr,
      verificationUrl: getVerificationUrl(r.digital_hash),
    }, y);
  }

  layout.finalize(`prontuario_${r.client_name.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(r.record_date), "yyyy-MM-dd")}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// Evolução Clínica (SOAP)
// ══════════════════════════════════════════════════════════════

interface EvolutionPdfData {
  clinicName: string;
  professionalName: string;
  patientName: string;
  evolutionDate: string;
  evolutionType: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  cidCode: string | null;
  notes: string | null;
  signedByName: string | null;
  signedByCrm: string | null;
  signedByUf?: string | null;
  signedAt: string | null;
  digitalHash: string | null;
}

export async function generateEvolutionPdf(e: EvolutionPdfData) {
  const layout = new BasePremiumPDFLayout(
    { name: e.clinicName },
    { title: "Evolução Clínica (SOAP)", accentColor: "#7c3aed", subtitle: `${e.evolutionType} — ${format(new Date(e.evolutionDate), "dd/MM/yyyy", { locale: ptBR })}` },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  y = renderPatientInfoBox(layout, { name: e.patientName }, y);

  if (e.subjective) y = renderSoapSection(layout, "S", e.subjective, y);
  if (e.objective) y = renderSoapSection(layout, "O", e.objective, y);
  if (e.assessment) y = renderSoapSection(layout, "A", e.assessment, y);
  if (e.plan) y = renderSoapSection(layout, "P", e.plan, y);

  if (e.cidCode) {
    y = layout.ensureSpace(y, 12);
    y = renderField(doc, "CID-10", e.cidCode, y, m, layout.contentW);
  }
  if (e.notes) {
    y = layout.ensureSpace(y, 12);
    y = renderField(doc, "Observações", e.notes, y, m, layout.contentW);
  }

  if (e.signedByName) {
    y = renderSignatureBlock(layout, {
      professionalName: e.signedByName,
      councilNumber: e.signedByCrm,
      councilState: e.signedByUf,
    }, y);
  }

  if (e.digitalHash) {
    const qr = await safeQrDataUrl(e.digitalHash);
    y = renderDigitalSeal(layout, {
      hash: e.digitalHash,
      signedAt: e.signedAt,
      signerName: e.signedByName,
      signerCrm: e.signedByCrm,
      signerUf: e.signedByUf,
      qrDataUrl: qr,
      verificationUrl: getVerificationUrl(e.digitalHash),
    }, y);
  }

  layout.finalize(`evolucao_${e.patientName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(e.evolutionDate), "yyyy-MM-dd")}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// Laudos Médicos (Medical Reports)
// ══════════════════════════════════════════════════════════════

interface MedicalReportPdfInput {
  tipo: string;
  finalidade?: string | null;
  historia_clinica?: string | null;
  exame_fisico?: string | null;
  exames_complementares?: string | null;
  diagnostico?: string | null;
  cid10?: string | null;
  conclusao?: string | null;
  observacoes?: string | null;
  created_at: string;
  professional_name: string;
  clinic_name: string;
}

function reportTypeLabel(t: string): string {
  switch (t) {
    case "laudo_medico": return "Laudo Médico";
    case "laudo_pericial": return "Laudo Pericial";
    case "parecer_tecnico": return "Parecer Técnico";
    case "relatorio_medico": return "Relatório Médico";
    case "laudo_complementar": return "Laudo Complementar";
    default: return t?.replace(/_/g, " ") ?? "Laudo Médico";
  }
}

export async function generateMedicalReportPdf(r: MedicalReportPdfInput) {
  const layout = new BasePremiumPDFLayout(
    { name: r.clinic_name },
    {
      title: reportTypeLabel(r.tipo),
      accentColor: "#d97706",
      subtitle: `Emitido em ${format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  let y = layout.contentStartY;

  const sections: [string, string | null | undefined][] = [
    ["Finalidade", r.finalidade],
    ["História Clínica", r.historia_clinica],
    ["Exame Físico", r.exame_fisico],
    ["Exames Complementares", r.exames_complementares],
    ["Diagnóstico", r.diagnostico],
    ["CID-10", r.cid10],
    ["Conclusão", r.conclusao],
    ["Observações", r.observacoes],
  ];

  for (const [label, value] of sections) {
    if (!value) continue;
    y = layout.ensureSpace(y, 15);
    y = renderField(doc, label, value, y, m, layout.contentW);
  }

  y = renderSignatureBlock(layout, {
    professionalName: r.professional_name,
  }, y);

  layout.finalize(`laudo_${format(new Date(r.created_at), "yyyy-MM-dd")}.pdf`);
}
