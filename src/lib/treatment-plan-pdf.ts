import { formatCurrency } from "./formatCurrency";
import {
  BasePremiumPDFLayout,
  FONT,
  COLORS,
  renderField,
  renderPatientInfoBox,
  renderPremiumTable,
} from "./pdf";

export async function generateTreatmentPlanPdf(plan: any, items: any[]) {
  const layout = new BasePremiumPDFLayout(
    {
      name: plan.clinic_name || "Clínica",
      cnpj: plan.clinic_cnpj ?? null,
      address: plan.clinic_address ?? null,
      phone: plan.clinic_phone ?? null,
      email: plan.clinic_email ?? null,
      logoUrl: plan.logo_url ?? null,
    },
    {
      title: "Orçamento Odontológico",
      subtitle: plan.plan_number || undefined,
      accentColor: "#2563eb",
      showSignatures: true,
      signatureLabels: ["Paciente", "Profissional Responsável"],
    },
  );
  await layout.init();
  const doc = layout.doc;
  let y = layout.contentStartY;

  // ── Dados do paciente ──
  y = renderPatientInfoBox(layout, {
    name: plan.client_name || "—",
    cpf: plan.client_cpf,
  }, y);

  // ── Profissional ──
  const m = layout.margin;
  doc.setFontSize(FONT.LABEL);
  doc.setFont(FONT.FAMILY, "bold");
  doc.setTextColor(...COLORS.TEXT_MUTED);
  doc.text("PROFISSIONAL", m, y + 2);
  doc.setFontSize(FONT.BODY);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text(`Dr(a). ${plan.professional_name || "—"}`, m + 28, y + 2);
  if (plan.council_number) {
    doc.setFontSize(FONT.SMALL);
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text(
      `CRO: ${plan.council_number}${plan.council_state ? `-${plan.council_state}` : ""}`,
      m + 28,
      y + 7,
    );
    y += 12;
  } else {
    y += 8;
  }

  // ── Tabela de procedimentos ──
  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.tooth_number ? `${item.tooth_number}${item.surface ? ` (${item.surface})` : ""}` : "—",
    item.procedure_name,
    item.procedure_code || "—",
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price),
  ]);

  y = renderPremiumTable(layout, {
    startY: y,
    head: ["#", "Dente", "Procedimento", "Código", "Qtd", "Unit.", "Total"],
    body: tableData,
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 60 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15, halign: "center" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 25, halign: "right" },
    },
  });

  // ── Totais ──
  y += 2;
  const rightX = layout.pageW - m;

  doc.setFontSize(FONT.BODY);
  doc.setFont(FONT.FAMILY, "normal");
  doc.setTextColor(...COLORS.TEXT_PRIMARY);
  doc.text("Subtotal:", rightX - 56, y);
  doc.text(formatCurrency(plan.total_value), rightX, y, { align: "right" });

  if (plan.discount_percent > 0) {
    y += 6;
    doc.text(`Desconto (${plan.discount_percent}%):`, rightX - 56, y);
    doc.setTextColor(...COLORS.SUCCESS);
    doc.text(`-${formatCurrency(plan.discount_value || 0)}`, rightX, y, { align: "right" });
    doc.setTextColor(...COLORS.TEXT_PRIMARY);
  }

  y += 8;
  doc.setFont(FONT.FAMILY, "bold");
  doc.setFontSize(12);
  doc.text("VALOR FINAL:", rightX - 56, y);
  doc.setTextColor(...layout.accent);
  doc.text(formatCurrency(plan.final_value), rightX, y, { align: "right" });
  y += 8;

  // ── Condições de pagamento ──
  if (plan.payment_conditions) {
    y = renderField(doc, "Condições de Pagamento", plan.payment_conditions, y, m, layout.contentW);
  }

  // ── Validade ──
  if (plan.valid_until) {
    doc.setFontSize(FONT.SMALL);
    doc.setTextColor(...COLORS.TEXT_SECONDARY);
    doc.text(`Orçamento válido até: ${new Date(plan.valid_until).toLocaleDateString("pt-BR")}`, m, y);
    y += 6;
  }

  // ── Assinaturas ──
  layout.drawSignatures(y);

  layout.finalize(`orcamento-${plan.plan_number || "odonto"}.pdf`);
}
