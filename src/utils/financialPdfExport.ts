import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** jsPDF com plugin autotable expõe lastAutoTable */
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays, endOfWeek, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import type { FinancialTransaction } from "@/types/database";

export interface CommissionPayment {
  id: string;
  professional_id: string;
  professional?: { full_name: string };
  amount: number;
  service_price: number;
  commission_type: "percentage" | "fixed";
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  payment_date?: string;
}

export interface DamagedProductLoss {
  id: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalLoss: number;
  reason?: string | null;
  created_at: string;
}

interface ExportOptions {
  transactions: FinancialTransaction[];
  startDate: Date;
  endDate: Date;
  tenantName?: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  commissions?: CommissionPayment[];
  damagedLosses?: DamagedProductLoss[];
  totalProductLoss?: number;
}

// Format period string
const formatPeriod = (startDate: Date, endDate: Date): string => {
  return `${formatInAppTz(startDate, "dd/MM/yyyy")} a ${formatInAppTz(endDate, "dd/MM/yyyy")}`;
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

// Generate evolution data based on period
interface EvolutionPoint {
  label: string;
  income: number;
  expense: number;
  balance: number;
}

const downsampleEvolutionData = (data: EvolutionPoint[], maxPoints: number): EvolutionPoint[] => {
  if (!Array.isArray(data) || data.length <= maxPoints) return data;
  const result: EvolutionPoint[] = [];
  const lastIdx = data.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * lastIdx) / (maxPoints - 1));
    result.push(data[idx]);
  }
  // Ensure uniqueness when rounding causes duplicates
  const unique: EvolutionPoint[] = [];
  const seen = new Set<string>();
  for (const p of result) {
    const key = `${p.label}-${p.balance}-${p.income}-${p.expense}`;
    if (!seen.has(key)) {
      unique.push(p);
      seen.add(key);
    }
  }
  return unique.length >= 2 ? unique : [data[0], data[lastIdx]];
};

const generateEvolutionData = (
  transactions: FinancialTransaction[],
  startDate: Date,
  endDate: Date
): EvolutionPoint[] => {
  const daysDiff = differenceInDays(endDate, startDate);
  let intervals: { start: Date; end: Date; label: string }[] = [];

  if (daysDiff <= 31) {
    // Daily grouping for up to 1 month
    intervals = eachDayOfInterval({ start: startDate, end: endDate }).map((date) => ({
      start: date,
      end: date,
      label: format(date, "dd/MM"),
    }));
  } else if (daysDiff <= 90) {
    // Weekly grouping for 1-3 months
    intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { locale: ptBR }).map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { locale: ptBR });
      return {
        start: weekStart,
        end: weekEnd > endDate ? endDate : weekEnd,
        label: formatInAppTz(weekStart, "dd/MM"),
      };
    });
  } else {
    // Monthly grouping for longer periods
    intervals = eachMonthOfInterval({ start: startDate, end: endDate }).map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      return {
        start: monthStart,
        end: monthEnd > endDate ? endDate : monthEnd,
        label: formatInAppTz(monthStart, "MMM/yy"),
      };
    });
  }

  let cumulativeBalance = 0;

  return intervals.map((interval) => {
    const periodTransactions = transactions.filter((t) => {
      const tDate = parseISO(t.transaction_date);
      return isWithinInterval(tDate, { start: interval.start, end: interval.end });
    });

    const income = periodTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = periodTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    cumulativeBalance += income - expense;

    return {
      label: interval.label,
      income,
      expense,
      balance: cumulativeBalance,
    };
  });
};

// Draw a simple bar chart
const drawBarChart = (
  doc: jsPDF,
  data: EvolutionPoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  colors: { income: [number, number, number]; expense: [number, number, number] }
) => {
  const margin = 10;
  const chartWidth = width - margin * 2;
  const chartHeight = height - 40;
  const barGroupWidth = chartWidth / data.length;
  const barWidth = barGroupWidth * 0.35;

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + width / 2, y + 8, { align: "center" });

  // Find max value
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    1
  );

  const chartX = x + margin;
  const chartY = y + 20;
  const chartBottom = chartY + chartHeight;

  // Baseline
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(chartX, chartBottom, chartX + chartWidth, chartBottom);

  const maxLabels = 6;
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  // Draw bars
  data.forEach((point, i) => {
    const groupX = chartX + i * barGroupWidth;

    // Income bar
    const incomeHeight = (point.income / maxValue) * chartHeight;
    doc.setFillColor(...colors.income);
    doc.rect(groupX + 2, chartBottom - incomeHeight, barWidth, incomeHeight, "F");

    // Expense bar
    const expenseHeight = (point.expense / maxValue) * chartHeight;
    doc.setFillColor(...colors.expense);
    doc.rect(groupX + barWidth + 4, chartBottom - expenseHeight, barWidth, expenseHeight, "F");

    // Label (reduce clutter)
    if (i % labelStep === 0 || i === data.length - 1) {
      doc.setFontSize(6);
      doc.setTextColor(107, 114, 128);
      doc.text(point.label, groupX + barGroupWidth / 2, chartBottom + 10, {
        align: "center",
        angle: data.length > 8 ? 45 : 0,
      });
    }
  });

  // Legend
  const legendY = y + height - 8;
  doc.setFillColor(...colors.income);
  doc.rect(x + width / 2 - 50, legendY - 3, 8, 4, "F");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text("Receitas", x + width / 2 - 40, legendY);

  doc.setFillColor(...colors.expense);
  doc.rect(x + width / 2 + 10, legendY - 3, 8, 4, "F");
  doc.text("Despesas", x + width / 2 + 20, legendY);
};

// Draw a line chart for balance evolution
const drawLineChart = (
  doc: jsPDF,
  data: EvolutionPoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  lineColor: [number, number, number]
) => {
  const margin = 10;
  const chartWidth = width - margin * 2;
  const chartHeight = height - 40;

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + width / 2, y + 8, { align: "center" });

  const values = data.map((d) => d.balance);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;

  const chartX = x + margin;
  const chartY = y + 20;
  const chartBottom = chartY + chartHeight;

  // Draw zero line if applicable
  if (minValue < 0 && maxValue > 0) {
    const zeroY = chartBottom - ((0 - minValue) / range) * chartHeight;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(chartX, zeroY, chartX + chartWidth, zeroY);
  }

  // Draw line
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(1.5);

  const pointSpacing = chartWidth / (data.length - 1 || 1);

  const maxLabels = 6;
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  data.forEach((point, i) => {
    const px = chartX + i * pointSpacing;
    const py = chartBottom - ((point.balance - minValue) / range) * chartHeight;

    // Draw point
    doc.setFillColor(...lineColor);
    doc.circle(px, py, 2, "F");

    // Draw line to next point
    if (i < data.length - 1) {
      const nextPx = chartX + (i + 1) * pointSpacing;
      const nextPy = chartBottom - ((data[i + 1].balance - minValue) / range) * chartHeight;
      doc.line(px, py, nextPx, nextPy);
    }

    // Label (reduce clutter)
    if (i % labelStep === 0 || i === data.length - 1) {
      doc.setFontSize(6);
      doc.setTextColor(107, 114, 128);
      doc.text(point.label, px, chartBottom + 10, {
        align: "center",
        angle: data.length > 8 ? 45 : 0,
      });
    }
  });

  // Show final value
  if (data.length > 0) {
    const lastPoint = data[data.length - 1];
    const lastPx = chartX + (data.length - 1) * pointSpacing;
    const lastPy = chartBottom - ((lastPoint.balance - minValue) / range) * chartHeight;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...lineColor);
    doc.text(formatCurrency(lastPoint.balance), lastPx, lastPy - 6, { align: "center" });
  }
};

export async function generateFinancialReport(options: ExportOptions): Promise<void> {
  const {
    transactions,
    startDate,
    endDate,
    tenantName,
    totalIncome,
    totalExpense,
    balance,
    commissions = [],
    damagedLosses = [],
    totalProductLoss,
  } = options;

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

  const headerHeight = 28;
  const footerHeight = 15;
  const contentTop = headerHeight + 14;
  const periodText = formatPeriod(startDate, endDate);

  const drawHeader = (title: string) => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ClinicNest", margin, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (tenantName) {
      doc.text(tenantName, margin, 23);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, pageWidth - margin, 17, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(periodText, pageWidth - margin, 23, { align: "right" });
  };

  const drawFooter = (pageNumber: number, totalPages: number) => {
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);

    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Gerado em ${formatInAppTz(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  };

  const baseTableStyles = {
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.1,
      lineColor: [229, 231, 235] as [number, number, number],
      valign: "middle" as const,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: 9,
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] as [number, number, number],
    },
    margin: { left: margin, right: margin, top: contentTop, bottom: footerHeight },
    tableWidth: pageWidth - margin * 2,
    didDrawPage: () => {
      drawHeader("Relatório Financeiro");
    },
  };

  drawHeader("Relatório Financeiro");
  yPos = contentTop;

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

  const hasDamagedLosses = damagedLosses.length > 0;
  const productLossTotal = totalProductLoss ?? damagedLosses.reduce((sum, item) => sum + item.totalLoss, 0);

  if (hasDamagedLosses) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Perdas por Produtos Danificados", margin, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dangerColor);
    doc.text(`Total de perdas: ${formatCurrency(productLossTotal)}`, margin, yPos);

    yPos += 8;

    autoTable(doc, {
      startY: Math.max(yPos, contentTop),
      head: [["Data", "Produto", "Qtd", "Custo Unit.", "Total Perda", "Motivo"]],
      body: damagedLosses.map((loss) => [
        formatInAppTz(loss.created_at, "dd/MM/yyyy"),
        loss.productName,
        loss.quantity.toString(),
        formatCurrency(loss.unitCost),
        formatCurrency(loss.totalLoss),
        loss.reason || "—",
      ]),
      ...baseTableStyles,
      headStyles: { ...baseTableStyles.headStyles, fillColor: dangerColor },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 45 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 40 },
      },
    });

    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 15;
  }

  // ==================== EVOLUTION CHARTS ====================
  const evolutionData = downsampleEvolutionData(
    generateEvolutionData(transactions, startDate, endDate),
    8
  );

  if (evolutionData.length > 1) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Evolução Financeira", margin, yPos);
    yPos += 8;

    const chartWidth = (pageWidth - margin * 2 - 10) / 2;
    const chartHeight = 70;

    // Bar chart - Income vs Expenses
    drawBarChart(
      doc,
      evolutionData.slice(-12), // Last 12 points max for readability
      margin,
      yPos,
      chartWidth,
      chartHeight,
      "Receitas vs Despesas",
      { income: successColor, expense: dangerColor }
    );

    // Line chart - Balance evolution
    drawLineChart(
      doc,
      evolutionData.slice(-12),
      margin + chartWidth + 10,
      yPos,
      chartWidth,
      chartHeight,
      "Evolução do Saldo",
      primaryColor
    );

    yPos += chartHeight + 15;
  }

  // ==================== CATEGORY BREAKDOWN ====================
  const incomeByCategory = groupByCategory(transactions, "income");
  const expenseByCategory = groupByCategory(transactions, "expense");

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
        fillColor: [240, 253, 244],
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
    });

    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 15;
  }

  // Check if we need a new page
  if (yPos > pageHeight - 80 && expenseByCategory.length > 0) {
    doc.addPage();
    yPos = margin;
  }

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
        fillColor: [254, 242, 242],
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
    });

    yPos = (doc as JsPDFWithAutoTable).lastAutoTable!.finalY + 15;
  }

  // ==================== TRANSACTIONS TABLE (NEW PAGE) ====================
  if (transactions.length > 0) {
    doc.addPage();
    drawHeader("Extrato de Transações");
    yPos = contentTop;

    autoTable(doc, {
      startY: Math.max(yPos, contentTop),
      head: [["Data", "Tipo", "Categoria", "Descrição", "Origem", "Valor"]],
      body: transactions.map((t) => [
        formatInAppTz(t.transaction_date, "dd/MM/yyyy"),
        t.type === "income" ? "Entrada" : "Saída",
        t.category,
        t.description || "—",
        t.appointment_id ? "Agenda" : "Manual",
        (t.type === "income" ? "+" : "-") + formatCurrency(t.amount),
      ]),
      ...baseTableStyles,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 50 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const value = String(data.cell.raw);
          if (value.startsWith("+")) {
            data.cell.styles.textColor = successColor;
          } else if (value.startsWith("-")) {
            data.cell.styles.textColor = dangerColor;
          }
        }
        if (data.section === "body" && data.column.index === 1) {
          const type = String(data.cell.raw);
          if (type === "Entrada") {
            data.cell.styles.textColor = successColor;
          } else {
            data.cell.styles.textColor = dangerColor;
          }
        }
      },
      didDrawPage: () => {
        drawHeader("Extrato de Transações");
      },
    });
  }

  // ==================== COMMISSIONS TABLE (NEW PAGE IF NEEDED) ====================
  if (commissions.length > 0) {
    doc.addPage();
    drawHeader("Comissões");
    yPos = contentTop;

    const paidCommissions = commissions.filter((c) => c.status === "paid");
    const pendingCommissions = commissions.filter((c) => c.status === "pending");
    const totalPaid = paidCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
    const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0);

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo de Comissões", margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...successColor);
    doc.text(`Comissões Pagas: ${formatCurrency(totalPaid)}`, margin, yPos);
    yPos += 7;
    doc.setTextColor(...dangerColor);
    doc.text(`Comissões Pendentes: ${formatCurrency(totalPending)}`, margin, yPos);
    yPos += 15;

    // Commissions table
    autoTable(doc, {
      startY: Math.max(yPos, contentTop),
      head: [["Data", "Profissional", "Tipo", "Valor Procedimento", "Comissão", "Status"]],
      body: commissions.map((c) => [
        formatInAppTz(c.created_at, "dd/MM/yyyy"),
        c.professional?.full_name || "—",
        c.commission_type === "percentage" ? "Percentual" : "Fixo",
        formatCurrency(Number(c.service_price)),
        formatCurrency(Number(c.amount)),
        c.status === "paid" ? "Paga" : "Pendente",
      ]),
      ...baseTableStyles,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 25, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const status = data.cell.text[0];
          if (status === "Paga") {
            data.cell.styles.textColor = successColor;
          } else {
            data.cell.styles.textColor = dangerColor;
          }
        }
      },
      didDrawPage: () => {
        drawHeader("Comissões");
      },
    });
  }

  // ==================== FOOTER ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i === 1) {
      drawHeader("Relatório Financeiro");
    }

    drawFooter(i, totalPages);
  }

  // Save the PDF
  const fileName = `relatorio-financeiro-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
