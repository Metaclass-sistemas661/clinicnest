import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./formatCurrency";

export function generateTreatmentPlanPdf(plan: any, items: any[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO ODONTOLÓGICO", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(plan.plan_number || "", pageWidth / 2, 27, { align: "center" });
  
  // Dados do paciente
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PACIENTE", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${plan.client_name || "—"}`, 14, 47);
  doc.text(`CPF: ${plan.client_cpf || "—"}`, 14, 53);
  
  // Dados do profissional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PROFISSIONAL", 110, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Dr(a). ${plan.professional_name || "—"}`, 110, 47);
  if (plan.council_number) {
    doc.text(`CRO: ${plan.council_number}${plan.council_state ? `-${plan.council_state}` : ""}`, 110, 53);
  }
  
  // Linha separadora
  doc.setDrawColor(200);
  doc.line(14, 60, pageWidth - 14, 60);
  
  // Tabela de procedimentos
  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.tooth_number ? `${item.tooth_number}${item.surface ? ` (${item.surface})` : ""}` : "—",
    item.procedure_name,
    item.procedure_code || "—",
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price),
  ]);
  
  autoTable(doc, {
    startY: 65,
    head: [["#", "Dente", "Procedimento", "Código", "Qtd", "Unit.", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 60 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15, halign: "center" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 25, halign: "right" },
    },
    styles: { fontSize: 9 },
  });
  
  // Totais
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.text(`Subtotal:`, pageWidth - 70, finalY);
  doc.text(formatCurrency(plan.total_value), pageWidth - 14, finalY, { align: "right" });
  
  if (plan.discount_percent > 0) {
    doc.text(`Desconto (${plan.discount_percent}%):`, pageWidth - 70, finalY + 6);
    doc.setTextColor(34, 197, 94);
    doc.text(`-${formatCurrency(plan.discount_value || 0)}`, pageWidth - 14, finalY + 6, { align: "right" });
    doc.setTextColor(0);
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`VALOR FINAL:`, pageWidth - 70, finalY + 14);
  doc.text(formatCurrency(plan.final_value), pageWidth - 14, finalY + 14, { align: "right" });
  
  // Condições de pagamento
  if (plan.payment_conditions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Condições de Pagamento:", 14, finalY + 25);
    doc.setFont("helvetica", "normal");
    doc.text(plan.payment_conditions, 14, finalY + 31);
  }
  
  // Validade
  if (plan.valid_until) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Orçamento válido até: ${new Date(plan.valid_until).toLocaleDateString("pt-BR")}`, 14, finalY + 42);
    doc.setTextColor(0);
  }
  
  // Assinaturas
  const sigY = finalY + 60;
  doc.setDrawColor(150);
  doc.line(14, sigY, 80, sigY);
  doc.line(pageWidth - 80, sigY, pageWidth - 14, sigY);
  
  doc.setFontSize(9);
  doc.text("Paciente", 47, sigY + 5, { align: "center" });
  doc.text("Profissional", pageWidth - 47, sigY + 5, { align: "center" });
  
  // Data
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, sigY + 20, { align: "center" });
  
  // Download
  doc.save(`orcamento-${plan.plan_number || "odonto"}.pdf`);
}
