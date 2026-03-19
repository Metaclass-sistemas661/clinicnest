import jsPDF from "jspdf";
import {
  BasePremiumPDFLayout,
  FONT,
  COLORS,
  renderPatientInfoBox,
  renderSummaryCards,
  renderField,
  type RGB,
} from "@/lib/pdf";

interface PeriogramPdfData {
  client_name: string;
  exam_date: string;
  professional_name: string;
  clinic_name: string;
  plaque_index: number;
  bleeding_index: number;
  avg_probing_depth: number;
  sites_over_4mm: number;
  sites_over_6mm: number;
  total_sites: number;
  periodontal_diagnosis: string | null;
  risk_classification: string | null;
  notes: string | null;
  measurements: Array<{
    tooth_number: number;
    site: string;
    probing_depth: number | null;
    recession: number | null;
    bleeding: boolean;
    plaque: boolean;
  }>;
}

const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const SITES = ["MV", "V", "DV", "ML", "L", "DL"];

function getDepthColor(depth: number | null): [number, number, number] {
  if (depth === null) return [200, 200, 200];
  if (depth <= 3) return [34, 197, 94];
  if (depth <= 5) return [234, 179, 8];
  return [239, 68, 68];
}

export async function generatePeriogramPdf(data: PeriogramPdfData) {
  const layout = new BasePremiumPDFLayout(
    { name: data.clinic_name },
    { title: "Periograma", accentColor: "#0d9488", orientation: "landscape" },
  );
  await layout.init();
  const doc = layout.doc;
  const m = layout.margin;
  const pageWidth = layout.pageW;
  let y = layout.contentStartY;

  // Patient info
  y = renderPatientInfoBox(layout, { name: data.client_name }, y);
  doc.setFontSize(FONT.SMALL);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_SECONDARY);
  doc.text(`Data: ${new Date(data.exam_date).toLocaleDateString("pt-BR")}`, pageWidth - m, y - 20, { align: "right" });
  doc.text(`Profissional: ${data.professional_name}`, pageWidth - m, y - 15, { align: "right" });

  // Indices summary cards
  y = renderSummaryCards(layout, [
    { label: "Placa", value: `${data.plaque_index.toFixed(1)}%`, color: COLORS.TEXT_PRIMARY },
    { label: "Sangramento", value: `${data.bleeding_index.toFixed(1)}%`, color: COLORS.DANGER },
    { label: "Prof. Média", value: `${data.avg_probing_depth.toFixed(1)}mm`, color: COLORS.TEXT_PRIMARY },
    { label: "Sítios >4mm", value: `${data.sites_over_4mm}`, color: COLORS.WARNING },
    { label: "Sítios >6mm", value: `${data.sites_over_6mm}`, color: COLORS.DANGER },
  ], y);

  // Periogram chart - Upper arch
  doc.setFontSize(FONT.SMALL + 1);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text("ARCADA SUPERIOR", pageWidth / 2, y, { align: "center" });
  y += 5;

  drawToothRow(doc, UPPER_TEETH, data.measurements, m, y, layout.contentW, true);
  y += 35;

  // Separator
  doc.setDrawColor(...COLORS.BORDER);
  doc.line(m, y, pageWidth - m, y);
  y += 5;

  // Lower arch
  doc.setFontSize(FONT.SMALL + 1);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text("ARCADA INFERIOR", pageWidth / 2, y, { align: "center" });
  y += 5;

  drawToothRow(doc, LOWER_TEETH, data.measurements, m, y, layout.contentW, false);
  y += 35;

  // Legend
  y += 5;
  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  
  doc.setFillColor(34, 197, 94);
  doc.rect(m, y, 4, 4, "F");
  doc.text("≤3mm (saudável)", m + 6, y + 3);
  
  doc.setFillColor(234, 179, 8);
  doc.rect(m + 40, y, 4, 4, "F");
  doc.text("4-5mm (atenção)", m + 46, y + 3);
  
  doc.setFillColor(239, 68, 68);
  doc.rect(m + 80, y, 4, 4, "F");
  doc.text("≥6mm (crítico)", m + 86, y + 3);
  
  doc.setFillColor(239, 68, 68);
  doc.circle(m + 120 + 2, y + 2, 2, "F");
  doc.text("Sangramento", m + 126, y + 3);
  
  doc.setFillColor(234, 179, 8);
  doc.rect(m + 155, y, 4, 4, "F");
  doc.text("Placa", m + 161, y + 3);

  // Diagnosis
  if (data.periodontal_diagnosis || data.risk_classification || data.notes) {
    y += 12;
    if (data.periodontal_diagnosis) {
      y = renderField(doc, "Diagnóstico", formatDiagnosis(data.periodontal_diagnosis), y, m, layout.contentW);
    }
    if (data.risk_classification) {
      y = renderField(doc, "Classificação de Risco", data.risk_classification.charAt(0).toUpperCase() + data.risk_classification.slice(1), y, m, layout.contentW);
    }
    if (data.notes) {
      y = renderField(doc, "Observações", data.notes, y, m, layout.contentW);
    }
  }

  layout.finalize(`periograma_${data.client_name.replace(/\s+/g, "_")}_${data.exam_date}.pdf`);
}

function drawToothRow(
  doc: jsPDF, 
  teeth: number[], 
  measurements: PeriogramPdfData["measurements"], 
  x: number, 
  y: number, 
  width: number,
  isUpper: boolean
) {
  const toothWidth = width / teeth.length;
  const cellHeight = 4;
  const sites = isUpper ? ["MV", "V", "DV", "ML", "L", "DL"] : ["ML", "L", "DL", "MV", "V", "DV"];

  teeth.forEach((tooth, i) => {
    const toothX = x + i * toothWidth;
    
    // Tooth number
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(tooth.toString(), toothX + toothWidth / 2, y, { align: "center" });
    
    // Sites
    sites.forEach((site, j) => {
      const m = measurements.find(m => m.tooth_number === tooth && m.site === site);
      const depth = m?.probing_depth;
      const cellY = y + 2 + j * cellHeight;
      
      // Depth cell
      const [r, g, b] = getDepthColor(depth);
      doc.setFillColor(r, g, b);
      doc.rect(toothX + 2, cellY, toothWidth - 8, cellHeight - 1, "F");
      
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(depth !== null ? depth.toString() : "-", toothX + toothWidth / 2 - 2, cellY + 3, { align: "center" });
      doc.setTextColor(0, 0, 0);
      
      // Bleeding indicator
      if (m?.bleeding) {
        doc.setFillColor(239, 68, 68);
        doc.circle(toothX + toothWidth - 4, cellY + 1.5, 1, "F");
      }
      
      // Plaque indicator
      if (m?.plaque) {
        doc.setFillColor(234, 179, 8);
        doc.rect(toothX + toothWidth - 6.5, cellY + 0.5, 2, 2, "F");
      }
    });
  });
}

function formatDiagnosis(diagnosis: string): string {
  const map: Record<string, string> = {
    saude_periodontal: "Saúde Periodontal",
    gengivite: "Gengivite",
    periodontite_leve: "Periodontite Leve",
    periodontite_moderada: "Periodontite Moderada",
    periodontite_severa: "Periodontite Severa",
  };
  return map[diagnosis] || diagnosis;
}
