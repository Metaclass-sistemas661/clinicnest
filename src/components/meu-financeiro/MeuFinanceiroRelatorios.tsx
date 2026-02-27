import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getSalaryPayments } from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Download, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReportType = "commissions" | "salaries" | "both" | "annual_ir";
type ExportFormat = "csv" | "pdf";

export function MeuFinanceiroRelatorios() {
  const { profile } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("both");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear() - 1));
  const [isGenerating, setIsGenerating] = useState(false);

  const yearOptions = (() => {
    const options: string[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      options.push(String(currentYear - i));
    }
    return options;
  })();

  const generateReport = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsGenerating(true);

    try {
      // Para relatório anual IR, usar ano completo
      let start: Date;
      let end: Date;

      if (reportType === "annual_ir") {
        const year = parseInt(selectedYear);
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59, 999);
      } else {
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }

      let commissions: any[] = [];
      let salaries: any[] = [];

      // Buscar comissões
      if (reportType === "commissions" || reportType === "both" || reportType === "annual_ir") {
        const { data } = await supabase
          .from("commission_payments")
          .select(`
            id,
            amount,
            service_price,
            status,
            created_at,
            payment_date,
            appointment:appointments(
              procedure:procedures(name),
              patient:patients(name)
            )
          `)
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .eq("status", "paid")
          .gte("payment_date", start.toISOString())
          .lte("payment_date", end.toISOString())
          .order("payment_date", { ascending: true });

        commissions = data || [];
      }

      // Buscar salários
      if (reportType === "salaries" || reportType === "both" || reportType === "annual_ir") {
        const { data } = await getSalaryPayments({
          p_tenant_id: profile.tenant_id,
          p_professional_id: profile.user_id,
          p_year: null,
          p_month: null,
        });

        // Filtrar por período e status pago
        salaries = (data || []).filter((s: any) => {
          if (s.status !== "paid") return false;
          const salaryDate = new Date(s.payment_year, s.payment_month - 1, 15);
          return salaryDate >= start && salaryDate <= end;
        });
      }

      if (commissions.length === 0 && salaries.length === 0) {
        toast.error("Nenhum dado encontrado no período selecionado");
        return;
      }

      if (exportFormat === "csv") {
        if (reportType === "annual_ir") {
          generateAnnualIRReport(commissions, salaries, start, end);
        } else {
          generateCsv(commissions, salaries, start, end);
        }
      } else {
        if (reportType === "annual_ir") {
          generateAnnualIRPdf(commissions, salaries, start, end);
        } else {
          generatePdf(commissions, salaries, start, end);
        }
      }

      toast.success("Relatório gerado com sucesso!");
    } catch (error) {
      logger.error("Error generating report:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAnnualIRReport = (commissions: any[], salaries: any[], start: Date, end: Date) => {
    const year = start.getFullYear();
    const lines: string[] = [];
    
    lines.push("INFORME DE RENDIMENTOS PARA DECLARAÇÃO DE IMPOSTO DE RENDA");
    lines.push(`Ano-calendário: ${year}`);
    lines.push(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`);
    lines.push("");
    lines.push("DADOS DO BENEFICIÁRIO");
    lines.push(`Nome: ${profile?.full_name || "—"}`);
    lines.push(`CPF: ${profile?.cpf || "—"}`);
    lines.push("");

    // Agrupar por mês
    const monthlyData: Record<number, { comissoes: number; salarios: number }> = {};
    for (let m = 0; m < 12; m++) {
      monthlyData[m] = { comissoes: 0, salarios: 0 };
    }

    commissions.forEach((c) => {
      const month = new Date(c.payment_date).getMonth();
      monthlyData[month].comissoes += Number(c.amount || 0);
    });

    salaries.forEach((s) => {
      const month = s.payment_month - 1;
      monthlyData[month].salarios += Number(s.amount || 0);
    });

    lines.push("RENDIMENTOS RECEBIDOS POR MÊS");
    lines.push("Mês;Comissões;Salários;Total");

    let totalComissoes = 0;
    let totalSalarios = 0;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    monthNames.forEach((name, idx) => {
      const data = monthlyData[idx];
      const total = data.comissoes + data.salarios;
      totalComissoes += data.comissoes;
      totalSalarios += data.salarios;
      lines.push([
        name,
        data.comissoes.toFixed(2).replace(".", ","),
        data.salarios.toFixed(2).replace(".", ","),
        total.toFixed(2).replace(".", ","),
      ].join(";"));
    });

    lines.push("");
    lines.push(`TOTAL COMISSÕES;${totalComissoes.toFixed(2).replace(".", ",")}`);
    lines.push(`TOTAL SALÁRIOS;${totalSalarios.toFixed(2).replace(".", ",")}`);
    lines.push(`TOTAL GERAL;${(totalComissoes + totalSalarios).toFixed(2).replace(".", ",")}`);

    const csvContent = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-rendimentos-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateAnnualIRPdf = (commissions: any[], salaries: any[], start: Date, end: Date) => {
    const year = start.getFullYear();

    // Agrupar por mês
    const monthlyData: Record<number, { comissoes: number; salarios: number }> = {};
    for (let m = 0; m < 12; m++) {
      monthlyData[m] = { comissoes: 0, salarios: 0 };
    }

    commissions.forEach((c) => {
      const month = new Date(c.payment_date).getMonth();
      monthlyData[month].comissoes += Number(c.amount || 0);
    });

    salaries.forEach((s) => {
      const month = s.payment_month - 1;
      monthlyData[month].salarios += Number(s.amount || 0);
    });

    let totalComissoes = 0;
    let totalSalarios = 0;
    Object.values(monthlyData).forEach((d) => {
      totalComissoes += d.comissoes;
      totalSalarios += d.salarios;
    });

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Informe de Rendimentos ${year}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; margin: 0 auto; }
          h1 { color: #1a1a1a; border-bottom: 3px solid #007bff; padding-bottom: 15px; font-size: 20px; }
          h2 { color: #444; margin-top: 30px; font-size: 16px; }
          .header-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .header-info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #007bff; color: white; font-weight: bold; }
          .text-right { text-align: right; }
          .total-row { background: #f8f9fa; font-weight: bold; }
          .grand-total { background: #007bff; color: white; font-weight: bold; font-size: 16px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>INFORME DE RENDIMENTOS PARA DECLARAÇÃO DE IMPOSTO DE RENDA</h1>
        
        <div class="header-info">
          <p><strong>Ano-calendário:</strong> ${year}</p>
          <p><strong>Beneficiário:</strong> ${profile?.full_name || "—"}</p>
          <p><strong>CPF:</strong> ${profile?.cpf || "—"}</p>
          <p><strong>Gerado em:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        </div>

        <h2>RENDIMENTOS RECEBIDOS POR MÊS</h2>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th class="text-right">Comissões</th>
              <th class="text-right">Salários</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${monthNames.map((name, idx) => {
              const data = monthlyData[idx];
              const total = data.comissoes + data.salarios;
              return `
                <tr>
                  <td>${name}</td>
                  <td class="text-right">${formatCurrency(data.comissoes)}</td>
                  <td class="text-right">${formatCurrency(data.salarios)}</td>
                  <td class="text-right">${formatCurrency(total)}</td>
                </tr>
              `;
            }).join("")}
            <tr class="total-row">
              <td>SUBTOTAIS</td>
              <td class="text-right">${formatCurrency(totalComissoes)}</td>
              <td class="text-right">${formatCurrency(totalSalarios)}</td>
              <td class="text-right">${formatCurrency(totalComissoes + totalSalarios)}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tr class="grand-total">
            <td>TOTAL DE RENDIMENTOS NO ANO</td>
            <td class="text-right" style="font-size: 18px;">${formatCurrency(totalComissoes + totalSalarios)}</td>
          </tr>
        </table>

        <div class="footer">
          <p>Este documento é um informe de rendimentos para fins de declaração de Imposto de Renda.</p>
          <p>Os valores apresentados referem-se aos pagamentos efetivamente recebidos no ano-calendário ${year}.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const generateCsv = (commissions: any[], salaries: any[], start: Date, end: Date) => {
    const lines: string[] = [];
    
    lines.push("RELATÓRIO FINANCEIRO PESSOAL");
    lines.push(`Período: ${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`);
    lines.push(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`);
    lines.push("");

    if (commissions.length > 0) {
      lines.push("=== COMISSÕES ===");
      lines.push("Data;Paciente;Serviço;Valor Serviço;Comissão;Status;Data Pagamento");
      
      let totalPending = 0;
      let totalPaid = 0;

      commissions.forEach((c) => {
        const amount = Number(c.amount || 0);
        if (c.status === "pending") totalPending += amount;
        else if (c.status === "paid") totalPaid += amount;

        lines.push([
          formatInAppTz(c.created_at, "dd/MM/yyyy"),
          c.appointment?.patient?.name || "—",
          c.appointment?.procedure?.name || "—",
          Number(c.service_price || 0).toFixed(2).replace(".", ","),
          amount.toFixed(2).replace(".", ","),
          c.status === "paid" ? "Pago" : "Pendente",
          c.payment_date ? formatInAppTz(c.payment_date, "dd/MM/yyyy") : "—",
        ].join(";"));
      });

      lines.push("");
      lines.push(`Total Pendente;${totalPending.toFixed(2).replace(".", ",")}`);
      lines.push(`Total Pago;${totalPaid.toFixed(2).replace(".", ",")}`);
      lines.push("");
    }

    if (salaries.length > 0) {
      lines.push("=== SALÁRIOS ===");
      lines.push("Período;Valor;Status;Método;Data Pagamento");

      let totalPending = 0;
      let totalPaid = 0;

      salaries.forEach((s) => {
        const amount = Number(s.amount || 0);
        if (s.status === "pending") totalPending += amount;
        else if (s.status === "paid") totalPaid += amount;

        const monthLabel = format(
          new Date(s.payment_year, s.payment_month - 1),
          "MMMM/yyyy",
          { locale: ptBR }
        );

        lines.push([
          monthLabel,
          amount.toFixed(2).replace(".", ","),
          s.status === "paid" ? "Pago" : s.status === "pending" ? "Pendente" : "Cancelado",
          s.payment_method || "—",
          s.payment_date ? formatInAppTz(s.payment_date, "dd/MM/yyyy") : "—",
        ].join(";"));
      });

      lines.push("");
      lines.push(`Total Pendente;${totalPending.toFixed(2).replace(".", ",")}`);
      lines.push(`Total Pago;${totalPaid.toFixed(2).replace(".", ",")}`);
    }

    const csvContent = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${format(start, "yyyy-MM-dd")}-${format(end, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePdf = (commissions: any[], salaries: any[], start: Date, end: Date) => {
    // Gerar HTML para impressão/PDF
    let totalCommPending = 0;
    let totalCommPaid = 0;
    let totalSalPending = 0;
    let totalSalPaid = 0;

    commissions.forEach((c) => {
      const amount = Number(c.amount || 0);
      if (c.status === "pending") totalCommPending += amount;
      else if (c.status === "paid") totalCommPaid += amount;
    });

    salaries.forEach((s) => {
      const amount = Number(s.amount || 0);
      if (s.status === "pending") totalSalPending += amount;
      else if (s.status === "paid") totalSalPaid += amount;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório Financeiro</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          h2 { color: #444; margin-top: 30px; }
          .info { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .status-paid { color: #28a745; }
          .status-pending { color: #ffc107; }
          .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .summary-item { display: inline-block; margin-right: 30px; }
          .summary-label { font-size: 12px; color: #666; }
          .summary-value { font-size: 18px; font-weight: bold; }
          .summary-value.pending { color: #ffc107; }
          .summary-value.paid { color: #28a745; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Relatório Financeiro Pessoal</h1>
        <p class="info">
          <strong>Período:</strong> ${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}<br>
          <strong>Gerado em:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm")}
        </p>

        ${commissions.length > 0 ? `
          <h2>Comissões</h2>
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Pendente</div>
              <div class="summary-value pending">${formatCurrency(totalCommPending)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Pago</div>
              <div class="summary-value paid">${formatCurrency(totalCommPaid)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Serviço</th>
                <th class="text-right">Valor</th>
                <th class="text-right">Comissão</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${commissions.map((c) => `
                <tr>
                  <td>${formatInAppTz(c.created_at, "dd/MM/yyyy")}</td>
                  <td>${c.appointment?.patient?.name || "—"}</td>
                  <td>${c.appointment?.procedure?.name || "—"}</td>
                  <td class="text-right">${formatCurrency(Number(c.service_price || 0))}</td>
                  <td class="text-right">${formatCurrency(Number(c.amount || 0))}</td>
                  <td class="${c.status === "paid" ? "status-paid" : "status-pending"}">
                    ${c.status === "paid" ? "Pago" : "Pendente"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        ${salaries.length > 0 ? `
          <h2>Salários</h2>
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Pendente</div>
              <div class="summary-value pending">${formatCurrency(totalSalPending)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Pago</div>
              <div class="summary-value paid">${formatCurrency(totalSalPaid)}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th class="text-right">Valor</th>
                <th>Status</th>
                <th>Método</th>
                <th>Data Pagamento</th>
              </tr>
            </thead>
            <tbody>
              ${salaries.map((s) => {
                const monthLabel = format(
                  new Date(s.payment_year, s.payment_month - 1),
                  "MMMM/yyyy",
                  { locale: ptBR }
                );
                return `
                  <tr>
                    <td>${monthLabel}</td>
                    <td class="text-right">${formatCurrency(Number(s.amount || 0))}</td>
                    <td class="${s.status === "paid" ? "status-paid" : "status-pending"}">
                      ${s.status === "paid" ? "Pago" : s.status === "pending" ? "Pendente" : "Cancelado"}
                    </td>
                    <td>${s.payment_method || "—"}</td>
                    <td>${s.payment_date ? formatInAppTz(s.payment_date, "dd/MM/yyyy") : "—"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        ` : ""}

        <div class="summary" style="margin-top: 30px;">
          <h3 style="margin: 0 0 10px 0;">Resumo Geral</h3>
          <div class="summary-item">
            <div class="summary-label">Total Pendente</div>
            <div class="summary-value pending">${formatCurrency(totalCommPending + totalSalPending)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Pago</div>
            <div class="summary-value paid">${formatCurrency(totalCommPaid + totalSalPaid)}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gerar Relatório</CardTitle>
          <CardDescription>
            Selecione o período e tipo de relatório desejado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de relatório */}
          <div className="space-y-3">
            <Label>Tipo de Relatório</Label>
            <RadioGroup
              value={reportType}
              onValueChange={(v) => setReportType(v as ReportType)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="cursor-pointer flex-1">Comissões + Salários</Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="commissions" id="commissions" />
                <Label htmlFor="commissions" className="cursor-pointer flex-1">Apenas Comissões</Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="salaries" id="salaries" />
                <Label htmlFor="salaries" className="cursor-pointer flex-1">Apenas Salários</Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer">
                <RadioGroupItem value="annual_ir" id="annual_ir" />
                <Label htmlFor="annual_ir" className="cursor-pointer flex-1">
                  <span className="font-medium">Informe Anual (IR)</span>
                  <span className="block text-xs text-muted-foreground">Para declaração de Imposto de Renda</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Período - condicional */}
          {reportType === "annual_ir" ? (
            <div className="space-y-2">
              <Label>Ano-calendário</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o ano para gerar o informe de rendimentos
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Formato */}
          <div className="space-y-3">
            <Label>Formato de Exportação</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as ExportFormat)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="cursor-pointer flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV (Excel)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF (Impressão)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Botão */}
          <Button
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
