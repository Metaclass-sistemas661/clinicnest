import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FinancialTransaction } from "@/types/database";

interface ExportOptions {
  transactions: FinancialTransaction[];
  filterMonth: string;
  tenantName?: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

// Utility to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Get month name in Portuguese
const getMonthName = (filterMonth: string): string => {
  const [year, month] = filterMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return format(date, "MMMM 'de' yyyy", { locale: ptBR });
};

// Group transactions by category
const groupByCategory = (transactions: FinancialTransaction[], type: "income" | "expense") => {
  const filtered = transactions.filter((t) => t.type === type);
  const grouped: Record<string, { total: number; count: number }> = {};

  filtered.forEach((t) => {
    if (!grouped[t.category]) {
      grouped[t.category] = { total: 0, count: 0 };
    }
    grouped[t.category].total += Number(t.amount);
    grouped[t.category].count += 1;
  });

  return Object.entries(grouped)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);
};

export function generateFinancialReport(options: ExportOptions): void {
  const { transactions, filterMonth, tenantName, totalIncome, totalExpense, balance } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [124, 58, 237]; // Purple
  const successColor: [number, number, number] = [34, 197, 94]; // Green
  const dangerColor: [number, number, number] = [239, 68, 68]; // Red
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [243, 244, 246];

  // ==================== HEADER ====================
  // Background header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(tenantName || "Relatório Financeiro", margin, 22);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Financeiro Detalhado", margin, 32);

  // Period badge
  const periodText = getMonthName(filterMonth).toUpperCase();
  doc.setFontSize(10);
  const periodWidth = doc.getTextWidth(periodText) + 16;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - periodWidth, 15, periodWidth, 18, 4, 4, "F");
  doc.setTextColor(...primaryColor);
  doc.text(periodText, pageWidth - margin - periodWidth + 8, 27);

  yPos = 60;

  // ==================== SUMMARY CARDS ====================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo do Período", margin, yPos);
  yPos += 10;

  const cardWidth = (pageWidth - margin * 2 - 20) / 3;
  const cardHeight = 35;
  const cardY = yPos;

  // Balance Card
  const balanceCardColor = balance >= 0 ? successColor : dangerColor;
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 4, 4, "F");
  doc.setDrawColor(...balanceCardColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 4, 4, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("SALDO", margin + 10, cardY + 12);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...balanceCardColor);
  doc.text(formatCurrency(balance), margin + 10, cardY + 26);

  // Income Card
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin + cardWidth + 10, cardY, cardWidth, cardHeight, 4, 4, "F");
  doc.setDrawColor(...successColor);
  doc.roundedRect(margin + cardWidth + 10, cardY, cardWidth, cardHeight, 4, 4, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("RECEITAS", margin + cardWidth + 20, cardY + 12);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...successColor);
  doc.text(formatCurrency(totalIncome), margin + cardWidth + 20, cardY + 26);

  // Expense Card
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin + (cardWidth + 10) * 2, cardY, cardWidth, cardHeight, 4, 4, "F");
  doc.setDrawColor(...dangerColor);
  doc.roundedRect(margin + (cardWidth + 10) * 2, cardY, cardWidth, cardHeight, 4, 4, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("DESPESAS", margin + (cardWidth + 10) * 2 + 10, cardY + 12);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dangerColor);
  doc.text(formatCurrency(totalExpense), margin + (cardWidth + 10) * 2 + 10, cardY + 26);

  yPos = cardY + cardHeight + 20;

  // ==================== CATEGORY BREAKDOWN ====================
  const incomeByCategory = groupByCategory(transactions, "income");
  const expenseByCategory = groupByCategory(transactions, "expense");

  // Income by Category
  if (incomeByCategory.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Receitas por Categoria", margin, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["Categoria", "Qtd", "Total"]],
      body: incomeByCategory.map((item) => [
        item.category,
        item.count.toString(),
        formatCurrency(item.total),
      ]),
      theme: "plain",
      headStyles: {
        fillColor: successColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244], // Light green
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Expense by Category
  if (expenseByCategory.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Despesas por Categoria", margin, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["Categoria", "Qtd", "Total"]],
      body: expenseByCategory.map((item) => [
        item.category,
        item.count.toString(),
        formatCurrency(item.total),
      ]),
      theme: "plain",
      headStyles: {
        fillColor: dangerColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242], // Light red
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // ==================== TRANSACTIONS TABLE (NEW PAGE) ====================
  if (transactions.length > 0) {
    doc.addPage();
    yPos = margin;

    // Page header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Extrato de Transações", margin, 20);

    yPos = 45;

    // Transactions table
    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Tipo", "Categoria", "Descrição", "Origem", "Valor"]],
      body: transactions.map((t) => [
        format(new Date(t.transaction_date), "dd/MM/yyyy"),
        t.type === "income" ? "Entrada" : "Saída",
        t.category,
        t.description || "—",
        t.appointment_id ? "Agenda" : "Manual",
        (t.type === "income" ? "+" : "-") + formatCurrency(t.amount),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 50 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Color the value column based on type
        if (data.section === "body" && data.column.index === 5) {
          const value = String(data.cell.raw);
          if (value.startsWith("+")) {
            data.cell.styles.textColor = successColor;
          } else if (value.startsWith("-")) {
            data.cell.styles.textColor = dangerColor;
          }
        }
        // Color the type column
        if (data.section === "body" && data.column.index === 1) {
          const type = String(data.cell.raw);
          if (type === "Entrada") {
            data.cell.styles.textColor = successColor;
          } else {
            data.cell.styles.textColor = dangerColor;
          }
        }
      },
    });
  }

  // ==================== FOOTER ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 25, pageHeight - 8);
  }

  // Save the PDF
  const fileName = `relatorio-financeiro-${filterMonth}.pdf`;
  doc.save(fileName);
}
