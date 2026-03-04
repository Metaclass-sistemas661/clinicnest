import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateQRCodeDataUrl, getVerificationUrl } from "@/components/signature/DocumentQRCode";
import { logger } from "@/lib/logger";

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers para conversão de cor hex → RGB ────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ─── Cores por tipo de documento ────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  atestado: "#2563eb",
  declaracao_comparecimento: "#059669",
  laudo: "#d97706",
  relatorio: "#7c3aed",
};

// ─── Carrega imagem de URL como base64 para jsPDF ───────────
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

/**
 * Desenha o cabeçalho profissional com logo, nome da clínica, dados e faixa colorida.
 * Retorna a posição Y após o cabeçalho.
 */
async function addProfessionalHeader(
  doc: jsPDF,
  cert: CertificateData,
  accentColor: string,
): Promise<number> {
  const [r, g, b] = hexToRgb(accentColor);
  let y = MARGIN;

  // ── Logo + Nome da clínica (lado a lado) ──
  let logoEndX = MARGIN;
  if (cert.logo_url) {
    try {
      const logoB64 = await loadImageAsBase64(cert.logo_url);
      if (logoB64) {
        doc.addImage(logoB64, "PNG", MARGIN, y - 2, 18, 18);
        logoEndX = MARGIN + 22;
      }
    } catch {
      // sem logo — segue sem imagem
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(r, g, b);
  doc.text(cert.clinic_name || "Clínica", logoEndX, y + 5);

  // Subtitle: endereço · telefone · CNPJ · email
  const infoParts: string[] = [];
  if (cert.clinic_address) infoParts.push(cert.clinic_address);
  if (cert.clinic_phone) infoParts.push(`Tel: ${cert.clinic_phone}`);
  if (cert.clinic_cnpj) infoParts.push(`CNPJ: ${cert.clinic_cnpj}`);
  if (cert.clinic_email) infoParts.push(cert.clinic_email);
  if (infoParts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    const infoLines = doc.splitTextToSize(infoParts.join("  ·  "), CONTENT_W - (logoEndX - MARGIN));
    doc.text(infoLines, logoEndX, y + 10);
    y += 10 + infoLines.length * 3;
  } else {
    y += 12;
  }

  y = Math.max(y, MARGIN + 18);

  // ── Linha separadora sutil ──
  y += 3;
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setLineWidth(0.2);

  return y + 4;
}

/**
 * Desenha a marca-d'água centralizada com o nome da clínica em diagonal.
 */
function addWatermark(doc: jsPDF, clinicName: string, accentColor: string) {
  const [r, g, b] = hexToRgb(accentColor);
  // @ts-expect-error — GState é suportado pelo jsPDF mas tipos podem não estar declarados
  const gs = new doc.GState({ opacity: 0.04 });
  doc.saveGraphicsState();
  doc.setGState(gs);
  doc.setFontSize(54);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(r, g, b);

  // Texto centralizado e rotacionado -35°
  const cx = PAGE_W / 2;
  const cy = PAGE_H / 2;
  doc.text(clinicName.toUpperCase(), cx, cy, {
    align: "center",
    angle: -35,
  });

  doc.restoreGraphicsState();
}

/**
 * Rodapé profissional com cor do tipo de documento.
 */
function addProfessionalFooter(doc: jsPDF, accentColor: string) {
  const [r, g, b] = hexToRgb(accentColor);
  const y = PAGE_H - 18;

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setLineWidth(0.2);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `Documento gerado digitalmente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    MARGIN,
    y + 5,
  );
  doc.text(
    "Este documento não substitui o original assinado pelo profissional de saúde.",
    MARGIN,
    y + 9,
  );

  // Faixa fina de cor na base
  doc.setFillColor(r, g, b);
  doc.rect(0, PAGE_H - 3, PAGE_W, 3, "F");
}

export async function generateCertificatePdf(cert: CertificateData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = certTypeLabel(cert.certificate_type);
  const accentColor = TYPE_COLORS[cert.certificate_type] || "#2563eb";
  const [ar, ag, ab] = hexToRgb(accentColor);

  // ── Marca-d'água ──
  addWatermark(doc, cert.clinic_name, accentColor);

  // ── Cabeçalho profissional com logo ──
  let y = await addProfessionalHeader(doc, cert, accentColor);

  // ── Faixa com tipo de documento ──
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), PAGE_W / 2, y + 6.3, { align: "center" });
  y += 14;

  // ── Dados do paciente ──
  if (cert.patient_name) {
    // Borda lateral colorida
    doc.setFillColor(ar, ag, ab);
    const patientBoxH = (cert.patient_cpf || cert.patient_birth_date) ? 18 : 12;
    doc.rect(MARGIN, y - 2, 1.2, patientBoxH, "F");

    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN + 1.2, y - 2, CONTENT_W - 1.2, patientBoxH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(ar, ag, ab);
    doc.text("PACIENTE", MARGIN + 4, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(cert.patient_name, MARGIN + 26, y + 3);

    if (cert.patient_cpf || cert.patient_birth_date) {
      const patientDetails: string[] = [];
      if (cert.patient_cpf) patientDetails.push(`CPF: ${cert.patient_cpf}`);
      if (cert.patient_birth_date) {
        patientDetails.push(`Nascimento: ${format(new Date(cert.patient_birth_date), "dd/MM/yyyy")}`);
      }
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(patientDetails.join("     "), MARGIN + 26, y + 9);
    }
    y += patientBoxH + 4;
  }

  // ── Campos ──
  y = addField(doc, "Data de Emissão",
    format(new Date(cert.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), y);

  if (cert.days_off != null && cert.days_off > 0) {
    let afastamento = `${cert.days_off} dia(s)`;
    if (cert.start_date && cert.end_date) {
      afastamento += ` — de ${format(new Date(cert.start_date), "dd/MM/yyyy")} a ${format(new Date(cert.end_date), "dd/MM/yyyy")}`;
    }
    y = addField(doc, "Período de Afastamento", afastamento, y);
  }

  if (cert.cid_code) {
    y = addField(doc, "CID-10", cert.cid_code + " (com autorização do paciente)", y);
  }

  // ── Separador ──
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Conteúdo principal ──
  y = addField(doc, "Conteúdo", cert.content, y);

  if (cert.notes) {
    y = addField(doc, "Observações", cert.notes, y);
  }

  // ── Área de assinatura ──
  y = Math.max(y, PAGE_H - 75);
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  const sigX = PAGE_W / 2;
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.4);
  doc.line(sigX - 40, y + 15, sigX + 40, y + 15);
  doc.setLineWidth(0.2);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(cert.professional_name, sigX, y + 21, { align: "center" });

  if (cert.professional_crm) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const crmText = cert.professional_uf
      ? `${cert.professional_crm}/${cert.professional_uf}`
      : cert.professional_crm;
    doc.text(crmText, sigX, y + 26, { align: "center" });
  }

  if (cert.professional_specialty) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(cert.professional_specialty, sigX, y + 31, { align: "center" });
  }

  // ── Assinatura digital com QR Code ──
  if (cert.digital_signature && cert.signed_at) {
    y += 40;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(MARGIN, y - 2, CONTENT_W, 28, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("DOCUMENTO ASSINADO DIGITALMENTE", MARGIN + 3, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Assinado em: ${format(new Date(cert.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, MARGIN + 3, y + 8);

    doc.setFontSize(5);
    doc.text(`Hash: ${cert.digital_signature}`, MARGIN + 3, y + 11);

    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text("Verifique a autenticidade:", MARGIN + 3, y + 16);
    doc.setTextColor(ar, ag, ab);
    doc.text(getVerificationUrl(cert.digital_signature), MARGIN + 3, y + 20);

    try {
      const qrDataUrl = await generateQRCodeDataUrl(cert.digital_signature, 60);
      doc.addImage(qrDataUrl, "PNG", PAGE_W - MARGIN - 22, y - 1, 20, 20);
    } catch (e) {
      logger.error("Error generating QR code for PDF:", e);
    }
  }

  // ── Rodapé profissional ──
  addProfessionalFooter(doc, accentColor);

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

  if (rx.patient_name) {
    y = addField(doc, "Paciente", rx.patient_name + (rx.patient_cpf ? ` (CPF: ${rx.patient_cpf})` : ""), y);
  }

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  y = addField(doc, "Medicamentos", rx.medications, y);

  if (rx.instructions) {
    y = addField(doc, "Instruções de Uso", rx.instructions, y);
  }

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(rx.professional_name, PAGE_W / 2, y, { align: "center" });
  y += 5;

  if (rx.professional_crm) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const crmText = rx.professional_uf 
      ? `CRM: ${rx.professional_crm}/${rx.professional_uf}` 
      : `CRM: ${rx.professional_crm}`;
    doc.text(crmText, PAGE_W / 2, y, { align: "center" });
    y += 5;
  }

  if (rx.signed_at && rx.digital_hash) {
    y += 5;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, 28, 2, 2, "F");
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("DOCUMENTO ASSINADO DIGITALMENTE", MARGIN + 3, y + 5);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Assinado em: ${format(new Date(rx.signed_at), "dd/MM/yyyy 'às' HH:mm")}`, MARGIN + 3, y + 10);
    doc.setFontSize(5);
    doc.text(`Hash: ${rx.digital_hash.substring(0, 48)}...`, MARGIN + 3, y + 14);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text("Verifique a autenticidade:", MARGIN + 3, y + 19);
    doc.setTextColor(13, 148, 136);
    doc.text(getVerificationUrl(rx.digital_hash), MARGIN + 3, y + 23);
    
    try {
      const qrDataUrl = await generateQRCodeDataUrl(rx.digital_hash, 60);
      doc.addImage(qrDataUrl, "PNG", PAGE_W - MARGIN - 22, y + 2, 20, 20);
    } catch (e) {
      logger.error("Error generating QR code for PDF:", e);
    }
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
  signed_by_uf?: string | null;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 25) {
    doc.addPage();
    return 15;
  }
  return y;
}

export async function generateMedicalRecordPdf(r: MedicalRecordPdfData) {
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

  // Assinatura digital com QR Code (somente com certificado ICP)
  if (r.digital_hash && r.signed_at && r.signed_by_name) {
    y = checkPageBreak(doc, y, 35);
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(MARGIN, y - 2, CONTENT_W, 28, 2, 2, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 148, 136);
    doc.text("ASSINATURA DIGITAL", MARGIN + 3, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const crmText = r.signed_by_crm 
      ? (r.signed_by_uf ? `${r.signed_by_crm}/${r.signed_by_uf}` : r.signed_by_crm)
      : "";
    if (r.signed_by_name) doc.text(`Profissional: ${r.signed_by_name}${crmText ? ` — ${crmText}` : ""}`, MARGIN + 3, y + 8);
    doc.text(`Assinado em: ${format(new Date(r.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, MARGIN + 3, y + 12);
    
    doc.setFontSize(5);
    doc.setTextColor(140, 140, 140);
    doc.text(`SHA-256: ${r.digital_hash}`, MARGIN + 3, y + 16);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text("Verifique:", MARGIN + 3, y + 21);
    doc.setTextColor(13, 148, 136);
    doc.text(getVerificationUrl(r.digital_hash), MARGIN + 18, y + 21);
    
    try {
      const qrDataUrl = await generateQRCodeDataUrl(r.digital_hash, 60);
      doc.addImage(qrDataUrl, "PNG", PAGE_W - MARGIN - 22, y, 20, 20);
    } catch (e) {
      logger.error("Error generating QR code for PDF:", e);
    }
  } else if (r.digital_hash && !r.signed_at) {
    // Hash de integridade apenas (sem certificado)
    y = checkPageBreak(doc, y, 15);
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text("Registro de integridade", MARGIN + 3, y + 3);
    doc.setFontSize(5);
    doc.text(`SHA-256: ${r.digital_hash}`, MARGIN + 3, y + 7);
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
  signedByUf?: string | null;
  signedAt: string | null;
  digitalHash: string | null;
}

export async function generateEvolutionPdf(e: EvolutionPdfData) {
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

  if (e.signedByName && e.signedAt) {
    // Assinatura digital real (ICP-Brasil)
    if (y > pageH - 45) { doc.addPage(); y = 20; }
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
      const crmText = e.signedByUf ? `CRM: ${e.signedByCrm}/${e.signedByUf}` : `CRM: ${e.signedByCrm}`;
      doc.text(crmText, MARGIN, y);
    }
    y += 4;
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Assinado em: ${format(new Date(e.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, y);
    if (e.digitalHash) {
      y += 6;
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(MARGIN, y - 2, CONTENT_W, 22, 2, 2, "F");
      
      doc.setFontSize(6);
      doc.setTextColor(140, 140, 140);
      doc.text(`SHA-256: ${e.digitalHash}`, MARGIN + 3, y + 3);
      
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.text("Verifique a autenticidade:", MARGIN + 3, y + 8);
      doc.setTextColor(13, 148, 136);
      doc.text(getVerificationUrl(e.digitalHash), MARGIN + 3, y + 12);
      
      try {
        const qrDataUrl = await generateQRCodeDataUrl(e.digitalHash, 50);
        doc.addImage(qrDataUrl, "PNG", PAGE_W - MARGIN - 18, y - 1, 16, 16);
      } catch (err) {
        logger.error("Error generating QR code for PDF:", err);
      }
    }
  } else if (e.digitalHash && !e.signedAt) {
    // Apenas hash de integridade (sem certificado)
    if (y > pageH - 25) { doc.addPage(); y = 20; }
    y += 5;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(MARGIN, y - 2, CONTENT_W, 14, 2, 2, "F");
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
    doc.text("Registro de integridade (sem assinatura digital)", MARGIN + 3, y + 3);
    doc.text(`SHA-256: ${e.digitalHash}`, MARGIN + 3, y + 7);
  }

  addFooter(doc);

  const filename = `evolucao_${e.patientName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(e.evolutionDate), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

// ─── Laudos Médicos (Medical Reports) ──────────────────────

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
    case "laudo_medico":       return "Laudo Médico";
    case "laudo_pericial":     return "Laudo Pericial";
    case "parecer_tecnico":    return "Parecer Técnico";
    case "relatorio_medico":   return "Relatório Médico";
    case "laudo_complementar": return "Laudo Complementar";
    default:                    return t?.replace(/_/g, " ") ?? "Laudo Médico";
  }
}

export async function generateMedicalReportPdf(r: MedicalReportPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();

  addHeader(doc, r.clinic_name, r.professional_name);

  let y = 38;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(reportTypeLabel(r.tipo), MARGIN, y);
  y += 8;

  // Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Emitido em ${format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    MARGIN,
    y
  );
  y += 8;

  // Fields
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
    if (y > pageH - 30) {
      addFooter(doc);
      doc.addPage();
      y = 20;
    }
    y = addField(doc, label, value, y);
  }

  addFooter(doc);

  const filename = `laudo_${format(new Date(r.created_at), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
