import jsPDF from "jspdf";

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

export function generatePeriogramPdf(data: PeriogramPdfData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let y = 15;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PERIOGRAMA", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.clinic_name, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Patient info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Paciente: ${data.client_name}`, 15, y);
  doc.text(`Data: ${new Date(data.exam_date).toLocaleDateString("pt-BR")}`, pageWidth - 15, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Profissional: ${data.professional_name}`, 15, y);
  y += 10;

  // Indices box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, "FD");
  
  const indicesY = y + 7;
  const colWidth = (pageWidth - 30) / 5;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Índice de Placa", 15 + colWidth * 0.5, indicesY, { align: "center" });
  doc.text("Sangramento", 15 + colWidth * 1.5, indicesY, { align: "center" });
  doc.text("Prof. Média", 15 + colWidth * 2.5, indicesY, { align: "center" });
  doc.text("Sítios >4mm", 15 + colWidth * 3.5, indicesY, { align: "center" });
  doc.text("Sítios >6mm", 15 + colWidth * 4.5, indicesY, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.plaque_index.toFixed(1)}%`, 15 + colWidth * 0.5, indicesY + 8, { align: "center" });
  doc.text(`${data.bleeding_index.toFixed(1)}%`, 15 + colWidth * 1.5, indicesY + 8, { align: "center" });
  doc.text(`${data.avg_probing_depth.toFixed(1)}mm`, 15 + colWidth * 2.5, indicesY + 8, { align: "center" });
  doc.setTextColor(234, 179, 8);
  doc.text(`${data.sites_over_4mm}`, 15 + colWidth * 3.5, indicesY + 8, { align: "center" });
  doc.setTextColor(239, 68, 68);
  doc.text(`${data.sites_over_6mm}`, 15 + colWidth * 4.5, indicesY + 8, { align: "center" });
  doc.setTextColor(0, 0, 0);
  
  y += 28;

  // Periogram chart - Upper arch
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ARCADA SUPERIOR", pageWidth / 2, y, { align: "center" });
  y += 5;

  drawToothRow(doc, UPPER_TEETH, data.measurements, 15, y, pageWidth - 30, true);
  y += 35;

  // Separator
  doc.setDrawColor(150, 150, 150);
  doc.line(15, y, pageWidth - 15, y);
  y += 5;

  // Lower arch
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ARCADA INFERIOR", pageWidth / 2, y, { align: "center" });
  y += 5;

  drawToothRow(doc, LOWER_TEETH, data.measurements, 15, y, pageWidth - 30, false);
  y += 35;

  // Legend
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  
  const legendX = 15;
  doc.setFillColor(34, 197, 94);
  doc.rect(legendX, y, 4, 4, "F");
  doc.text("≤3mm (saudável)", legendX + 6, y + 3);
  
  doc.setFillColor(234, 179, 8);
  doc.rect(legendX + 40, y, 4, 4, "F");
  doc.text("4-5mm (atenção)", legendX + 46, y + 3);
  
  doc.setFillColor(239, 68, 68);
  doc.rect(legendX + 80, y, 4, 4, "F");
  doc.text("≥6mm (crítico)", legendX + 86, y + 3);
  
  doc.setFillColor(239, 68, 68);
  doc.circle(legendX + 120 + 2, y + 2, 2, "F");
  doc.text("Sangramento", legendX + 126, y + 3);
  
  doc.setFillColor(234, 179, 8);
  doc.rect(legendX + 155, y, 4, 4, "F");
  doc.text("Placa", legendX + 161, y + 3);

  // Diagnosis
  if (data.periodontal_diagnosis || data.risk_classification || data.notes) {
    y += 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNÓSTICO E OBSERVAÇÕES", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    
    if (data.periodontal_diagnosis) {
      doc.text(`Diagnóstico: ${formatDiagnosis(data.periodontal_diagnosis)}`, 15, y);
      y += 4;
    }
    if (data.risk_classification) {
      doc.text(`Classificação de Risco: ${data.risk_classification.charAt(0).toUpperCase() + data.risk_classification.slice(1)}`, 15, y);
      y += 4;
    }
    if (data.notes) {
      const lines = doc.splitTextToSize(`Observações: ${data.notes}`, pageWidth - 30);
      doc.text(lines, 15, y);
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${data.total_sites} sítios avaliados`, pageWidth / 2, pageHeight - 8, { align: "center" });

  doc.save(`periograma_${data.client_name.replace(/\s+/g, "_")}_${data.exam_date}.pdf`);
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
