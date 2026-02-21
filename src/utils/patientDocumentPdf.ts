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
