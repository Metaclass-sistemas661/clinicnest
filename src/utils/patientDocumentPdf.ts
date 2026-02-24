import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addHeader(doc: jsPDF, clinicName: string, professionalName: string) {
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 0, PAGE_W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(clinicName || "Clínica", MARGIN, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Profissional: ${professionalName || "—"}`, MARGIN, 21);

  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, pageH - 18, PAGE_W - MARGIN, pageH - 18);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `Documento gerado digitalmente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    MARGIN,
    pageH - 12
  );
  doc.text(
    "Este documento não substitui o original assinado pelo profissional de saúde.",
    MARGIN,
    pageH - 8
  );
}

function addField(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text(label.toUpperCase(), MARGIN, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(value || "—", CONTENT_W);
  doc.text(lines, MARGIN, y + 5);

  return y + 5 + lines.length * 4.5 + 4;
}

// ─── Atestados / Laudos ────────────────────────────────────

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
  clinic_name: string;
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

export function generateCertificatePdf(cert: CertificateData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = certTypeLabel(cert.certificate_type);

  addHeader(doc, cert.clinic_name, cert.professional_name);

  let y = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(title, MARGIN, y);
  y += 10;

  y = addField(doc, "Data de Emissão",
    format(new Date(cert.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y);

  if (cert.days_off != null) {
    let afastamento = `${cert.days_off} dia(s)`;
    if (cert.start_date && cert.end_date) {
      afastamento += ` — de ${format(new Date(cert.start_date), "dd/MM/yyyy")} a ${format(new Date(cert.end_date), "dd/MM/yyyy")}`;
    }
    y = addField(doc, "Período de Afastamento", afastamento, y);
  }

  if (cert.cid_code) {
    y = addField(doc, "CID-10", cert.cid_code, y);
  }

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  y = addField(doc, "Conteúdo", cert.content, y);

  if (cert.notes) {
    y = addField(doc, "Observações", cert.notes, y);
  }

  addFooter(doc);

  const filename = `${title.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(cert.issued_at), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

// ─── Receitas ──────────────────────────────────────────────

interface PrescriptionData {
  prescription_type: string;
  issued_at: string;
  validity_days: number | null;
  expires_at: string | null;
  medications: string;
  instructions: string;
  professional_name: string;
  clinic_name: string;
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

export function generatePrescriptionPdf(rx: PrescriptionData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = rxTypeLabel(rx.prescription_type);

  addHeader(doc, rx.clinic_name, rx.professional_name);

  let y = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(title, MARGIN, y);
  y += 10;

  y = addField(doc, "Data de Emissão",
    format(new Date(rx.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y);

  if (rx.validity_days) {
    let validade = `${rx.validity_days} dias`;
    if (rx.expires_at) {
      validade += ` — válida até ${format(new Date(rx.expires_at), "dd/MM/yyyy")}`;
    }
    y = addField(doc, "Validade", validade, y);
  }

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  y = addField(doc, "Medicamentos", rx.medications, y);

  if (rx.instructions) {
    y = addField(doc, "Instruções de Uso", rx.instructions, y);
  }

  addFooter(doc);

  const filename = `receita_${rx.prescription_type}_${format(new Date(rx.issued_at), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

// ─── Exames / Laudos ──────────────────────────────────────

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

export function generateExamPdf(exam: ExamData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  addHeader(doc, exam.clinic_name, exam.requested_by_name);

  let y = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(exam.exam_name || "Resultado de Exame", MARGIN, y);
  y += 10;

  y = addField(doc, "Tipo de Exame", exam.exam_type || "—", y);

  if (exam.performed_at) {
    y = addField(doc, "Data de Realização",
      format(new Date(exam.performed_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y);
  }

  if (exam.lab_name) {
    y = addField(doc, "Laboratório", exam.lab_name, y);
  }

  y = addField(doc, "Status", examStatusLabel(exam.status), y);

  if (exam.requested_by_name) {
    y = addField(doc, "Solicitado por", exam.requested_by_name, y);
  }

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  if (exam.interpretation) {
    y = addField(doc, "Interpretação / Resultado", exam.interpretation, y);
  }

  addFooter(doc);

  const filename = `exame_${(exam.exam_name || "resultado").toLowerCase().replace(/\s+/g, "_")}_${exam.performed_at ? format(new Date(exam.performed_at), "yyyy-MM-dd") : "sem_data"}.pdf`;
  doc.save(filename);
}

// ─── Prontuário Médico ────────────────────────────────────

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
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 25) {
    doc.addPage();
    return 15;
  }
  return y;
}

export function generateMedicalRecordPdf(r: MedicalRecordPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  addHeader(doc, r.clinic_name, r.professional_name);

  let y = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text("Prontuário Médico", MARGIN, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Paciente: ${r.client_name}`, MARGIN, y);
  doc.text(`Data: ${format(new Date(r.record_date), "dd/MM/yyyy", { locale: ptBR })}`, PAGE_W - MARGIN, y, { align: "right" });
  y += 8;

  // Sinais vitais em grid compacto
  const vitals: string[] = [];
  if (r.blood_pressure_systolic != null) vitals.push(`PA: ${r.blood_pressure_systolic}/${r.blood_pressure_diastolic} mmHg`);
  if (r.heart_rate != null) vitals.push(`FC: ${r.heart_rate} bpm`);
  if (r.temperature != null) vitals.push(`Temp: ${r.temperature}°C`);
  if (r.oxygen_saturation != null) vitals.push(`SpO₂: ${r.oxygen_saturation}%`);
  if (r.respiratory_rate != null) vitals.push(`FR: ${r.respiratory_rate} irpm`);
  if (r.weight_kg != null) vitals.push(`Peso: ${r.weight_kg} kg`);
  if (r.height_cm != null) vitals.push(`Alt: ${r.height_cm} cm`);
  if (r.pain_scale != null) vitals.push(`Dor: ${r.pain_scale}/10`);

  if (vitals.length > 0) {
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(MARGIN, y - 3, CONTENT_W, 12, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("SINAIS VITAIS", MARGIN + 3, y + 2);
    doc.setFont("helvetica", "normal");
    doc.text(vitals.join("  ·  "), MARGIN + 32, y + 2);
    y += 14;
  }

  if (r.allergies) { y = checkPageBreak(doc, y, 12); y = addField(doc, "Alergias", r.allergies, y); }
  if (r.current_medications) { y = checkPageBreak(doc, y, 12); y = addField(doc, "Medicamentos em Uso", r.current_medications, y); }
  if (r.medical_history) { y = checkPageBreak(doc, y, 12); y = addField(doc, "Histórico Médico", r.medical_history, y); }

  y = checkPageBreak(doc, y, 12);
  y = addField(doc, "Queixa Principal", r.chief_complaint, y);

  if (r.anamnesis) { y = checkPageBreak(doc, y, 15); y = addField(doc, "Anamnese", r.anamnesis, y); }
  if (r.physical_exam) { y = checkPageBreak(doc, y, 15); y = addField(doc, "Exame Físico", r.physical_exam, y); }

  if (r.diagnosis || r.cid_code) {
    y = checkPageBreak(doc, y, 12);
    const diag = [r.diagnosis, r.cid_code ? `CID-10: ${r.cid_code}` : ""].filter(Boolean).join(" — ");
    y = addField(doc, "Diagnóstico", diag, y);
  }

  if (r.treatment_plan) { y = checkPageBreak(doc, y, 15); y = addField(doc, "Plano Terapêutico", r.treatment_plan, y); }
  if (r.prescriptions) { y = checkPageBreak(doc, y, 15); y = addField(doc, "Prescrições", r.prescriptions, y); }
  if (r.notes) { y = checkPageBreak(doc, y, 12); y = addField(doc, "Observações", r.notes, y); }

  // Assinatura digital
  if (r.digital_hash && r.signed_at) {
    y = checkPageBreak(doc, y, 25);
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 148, 136);
    doc.text("ASSINATURA DIGITAL", MARGIN, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    if (r.signed_by_name) doc.text(`Profissional: ${r.signed_by_name}${r.signed_by_crm ? ` — ${r.signed_by_crm}` : ""}`, MARGIN, y);
    y += 4;
    doc.text(`Assinado em: ${format(new Date(r.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, MARGIN, y);
    y += 4;
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
    doc.text(`SHA-256: ${r.digital_hash}`, MARGIN, y);
  }

  addFooter(doc);

  const filename = `prontuario_${r.client_name.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(r.record_date), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

// ── Evolution SOAP PDF ──────────────────────────────────────

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
  signedAt: string | null;
  digitalHash: string | null;
}

export function generateEvolutionPdf(e: EvolutionPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  addHeader(doc, e.clinicName, e.professionalName);

  let y = 38;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Evolução Clínica (SOAP)", MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Tipo: ${e.evolutionType}`, MARGIN, y);
  y += 5;
  doc.text(`Data: ${format(new Date(e.evolutionDate), "dd/MM/yyyy", { locale: ptBR })}`, MARGIN, y);
  y += 5;
  doc.text(`Paciente: ${e.patientName}`, MARGIN, y);
  y += 8;

  doc.setTextColor(0, 0, 0);

  const soapSections: Array<{ label: string; code: string; value: string | null; color: [number, number, number] }> = [
    { label: "SUBJETIVO", code: "S", value: e.subjective, color: [59, 130, 246] },
    { label: "OBJETIVO", code: "O", value: e.objective, color: [16, 185, 129] },
    { label: "AVALIAÇÃO", code: "A", value: e.assessment, color: [245, 158, 11] },
    { label: "PLANO", code: "P", value: e.plan, color: [139, 92, 246] },
  ];

  for (const s of soapSections) {
    if (!s.value) continue;
    if (y > pageH - 40) { doc.addPage(); y = 20; }

    doc.setFillColor(...s.color);
    doc.roundedRect(MARGIN, y - 4, 8, 8, 1, 1, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(s.code, MARGIN + 2.8, y + 1.5);

    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.setFontSize(9);
    doc.text(s.label, MARGIN + 11, y + 1);
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(s.value, CONTENT_W);
    for (const line of lines) {
      if (y > pageH - 25) { doc.addPage(); y = 20; }
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 4;
  }

  if (e.cidCode) {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    y = addField(doc, "CID-10", e.cidCode, y);
  }
  if (e.notes) {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    y = addField(doc, "Observações", e.notes, y);
  }

  if (e.signedByName) {
    if (y > pageH - 35) { doc.addPage(); y = 20; }
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, MARGIN + 70, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(e.signedByName, MARGIN, y);
    if (e.signedByCrm) {
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.text(`CRM: ${e.signedByCrm}`, MARGIN, y);
    }
    if (e.signedAt) {
      y += 4;
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Assinado em: ${format(new Date(e.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, y);
    }
    if (e.digitalHash) {
      y += 4;
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 140);
      doc.text(`SHA-256: ${e.digitalHash}`, MARGIN, y);
    }
  }

  addFooter(doc);

  const filename = `evolucao_${e.patientName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(e.evolutionDate), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
