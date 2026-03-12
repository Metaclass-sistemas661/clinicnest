/**
 * odontogramPdf — Geração de PDF profissional do odontograma
 * 
 * Gera um PDF em formato paisagem A4 com:
 * - Header com dados do paciente e clínica
 * - Mapa dental estilizado (representação das condições por dente)
 * - Tabela de registros detalhada
 * - Legenda de condições
 * - Estatísticas resumidas
 */
import jsPDF from "jspdf";
import {
  TOOTH_CONDITIONS,
  UPPER_PERMANENT,
  LOWER_PERMANENT,
  UPPER_DECIDUOUS,
  LOWER_DECIDUOUS,
} from "@/components/odontograma/odontogramConstants";

interface OdontogramPdfData {
  patient_name: string;
  exam_date: string;
  professional_name: string;
  clinic_name: string;
  dentition_type: string;
  notes: string | null;
  teeth: Array<{
    tooth_number: number;
    condition: string;
    surfaces?: string;
    notes?: string;
    mobility_grade?: number | null;
    priority?: string;
  }>;
}

function getConditionInfo(condition: string) {
  return TOOTH_CONDITIONS.find(c => c.value === condition) ?? TOOTH_CONDITIONS[0];
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [100, 100, 100];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

export function generateOdontogramPdf(data: OdontogramPdfData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ODONTOGRAMA", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.clinic_name, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Patient info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Paciente: ${data.patient_name}`, 15, y);
  doc.text(`Data: ${new Date(data.exam_date).toLocaleDateString("pt-BR")}`, pageWidth - 15, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Profissional: ${data.professional_name}`, 15, y);
  doc.text(`Dentição: ${data.dentition_type === "permanent" ? "Permanente" : data.dentition_type === "deciduous" ? "Decídua" : "Mista"}`, pageWidth - 15, y, { align: "right" });
  y += 10;

  // ── Dental Map ──
  const teethMap = new Map(data.teeth.map(t => [t.tooth_number, t]));
  const toothW = 14;
  const toothH = 12;

  // Determine which arches to render based on dentition_type
  const upperPermanent = data.dentition_type !== "deciduous" ? [...UPPER_PERMANENT] : [];
  const lowerPermanent = data.dentition_type !== "deciduous" ? [...LOWER_PERMANENT] : [];
  const upperDeciduous = data.dentition_type !== "permanent" ? [...UPPER_DECIDUOUS] : [];
  const lowerDeciduous = data.dentition_type !== "permanent" ? [...LOWER_DECIDUOUS] : [];

  /** Helper: renders a single arch row */
  const renderArch = (teethArr: number[], archLabel: string) => {
    if (teethArr.length === 0) return;
    const archStartX = (pageWidth - teethArr.length * toothW) / 2;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(archLabel, pageWidth / 2, y, { align: "center" });
    y += 4;

    for (let i = 0; i < teethArr.length; i++) {
      const num = teethArr[i];
      const x = archStartX + i * toothW;
      const tooth = teethMap.get(num);
      const info = getConditionInfo(tooth?.condition ?? "healthy");
      const [r, g, b] = hexToRgb(info.color);

      if (tooth?.condition === "missing") {
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1, 1], 0);
        doc.rect(x, y, toothW - 1, toothH);
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(180, 180, 180);
        doc.line(x + 1, y + 1, x + toothW - 2, y + toothH - 1);
        doc.line(x + toothW - 2, y + 1, x + 1, y + toothH - 1);
      } else {
        doc.setFillColor(r, g, b);
        doc.setDrawColor(100, 100, 100);
        doc.roundedRect(x, y, toothW - 1, toothH, 1, 1, "FD");
      }

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(tooth?.condition === "missing" ? 150 : 255, tooth?.condition === "missing" ? 150 : 255, tooth?.condition === "missing" ? 150 : 255);
      doc.text(num.toString(), x + (toothW - 1) / 2, y + toothH / 2 + 2, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
    y += toothH + 4;
  };

  // Upper permanent arch
  renderArch(upperPermanent, "Arcada Superior (Permanente)");

  // Upper deciduous arch
  if (upperDeciduous.length > 0) {
    renderArch(upperDeciduous, data.dentition_type === "mixed" ? "Arcada Superior (Decídua)" : "Arcada Superior");
  }

  // Separator
  doc.setDrawColor(200, 200, 200);
  const sepWidth = Math.max(upperPermanent.length, upperDeciduous.length, lowerPermanent.length, lowerDeciduous.length) * toothW;
  const sepStartX = (pageWidth - sepWidth) / 2;
  doc.line(sepStartX, y, sepStartX + sepWidth - 1, y);
  y += 4;

  // Lower permanent arch
  renderArch(lowerPermanent, "Arcada Inferior (Permanente)");

  // Lower deciduous arch
  if (lowerDeciduous.length > 0) {
    renderArch(lowerDeciduous, data.dentition_type === "mixed" ? "Arcada Inferior (Decídua)" : "Arcada Inferior");
  }

  y += 4;

  // ── Legend ──
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Legenda:", 15, y);
  y += 4;

  const usedConditions = new Set(data.teeth.map(t => t.condition));
  usedConditions.add("healthy");
  const legendItems = TOOTH_CONDITIONS.filter(c => usedConditions.has(c.value));
  const cols = 6;
  const colW = (pageWidth - 30) / cols;

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  legendItems.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const lx = 15 + col * colW;
    const ly = y + row * 4;
    const [r, g, b] = hexToRgb(item.color);
    doc.setFillColor(r, g, b);
    doc.roundedRect(lx, ly - 2.5, 3, 3, 0.5, 0.5, "F");
    doc.text(item.label, lx + 4, ly);
  });

  y += Math.ceil(legendItems.length / cols) * 4 + 4;

  // ── Records Table ──
  const registeredTeeth = data.teeth.filter(t => t.condition !== "healthy").sort((a, b) => a.tooth_number - b.tooth_number);

  if (registeredTeeth.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Registros Detalhados (${registeredTeeth.length})`, 15, y);
    y += 5;

    // Table header
    const colWidths = [15, 35, 25, 18, 18, pageWidth - 30 - 15 - 35 - 25 - 18 - 18];
    const headers = ["Dente", "Condição", "Faces", "Mob.", "Prior.", "Observações"];

    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 3, pageWidth - 30, 5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    let hx = 15;
    headers.forEach((h, i) => {
      doc.text(h, hx + 1, y);
      hx += colWidths[i];
    });
    y += 4;

    doc.setFont("helvetica", "normal");
    for (const tooth of registeredTeeth) {
      if (y > 185) {
        doc.addPage();
        y = 15;
      }

      const info = getConditionInfo(tooth.condition);
      let tx = 15;

      doc.setFontSize(7);
      doc.text(tooth.tooth_number.toString(), tx + 1, y);
      tx += colWidths[0];

      // Condition with color dot
      const [cr, cg, cb] = hexToRgb(info.color);
      doc.setFillColor(cr, cg, cb);
      doc.circle(tx + 2, y - 1.2, 1.2, "F");
      doc.text(info.label, tx + 5, y);
      tx += colWidths[1];

      doc.text(tooth.surfaces || "—", tx + 1, y);
      tx += colWidths[2];

      doc.text(tooth.mobility_grade != null && tooth.mobility_grade > 0 ? `Grau ${tooth.mobility_grade}` : "—", tx + 1, y);
      tx += colWidths[3];

      const prioLabel = tooth.priority === "urgent" ? "Urgente" : tooth.priority === "high" ? "Alta" : tooth.priority === "low" ? "Baixa" : "—";
      doc.text(prioLabel, tx + 1, y);
      tx += colWidths[4];

      doc.text((tooth.notes || "—").substring(0, 60), tx + 1, y);
      y += 4;
    }
  }

  // ── Stats Summary ──
  y += 4;
  if (y > 175) {
    doc.addPage();
    y = 15;
  }

  const totalRegistered = data.teeth.length;
  const caries = data.teeth.filter(t => t.condition === "caries").length;
  const missing = data.teeth.filter(t => t.condition === "missing").length;
  const restored = data.teeth.filter(t => t.condition === "restored").length;
  const urgent = data.teeth.filter(t => t.priority === "urgent").length;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo:", 15, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Total registrado: ${totalRegistered} dente(s) | Cárie: ${caries} | Ausentes: ${missing} | Restaurados: ${restored} | Urgentes: ${urgent}`, 15, y);

  if (data.notes) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 15, y);
    y += 3;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - 30);
    doc.text(noteLines, 15, y);
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")} — Página ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`odontograma_${data.patient_name.replace(/\s+/g, "_")}_${data.exam_date}.pdf`);
}
