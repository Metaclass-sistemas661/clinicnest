import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getSalaryPayments } from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { Calendar, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type SalaryPayment = {
  id: string;
  professional_id: string;
  professional_name: string;
  payment_month: number;
  payment_year: number;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
};

export function MeuFinanceiroSalarios() {
  const { profile } = useAuth();
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id) {
      fetchSalaries();
    }
  }, [profile?.tenant_id, profile?.user_id, filterYear]);

  const fetchSalaries = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsLoading(true);

    try {
      const { data, error } = await getSalaryPayments({
        p_tenant_id: profile.tenant_id,
        p_professional_id: profile.user_id,
        p_year: parseInt(filterYear),
        p_month: null,
      });

      if (error) throw error;
      setSalaries((data || []) as SalaryPayment[]);
    } catch (error) {
      logger.error("Error fetching salaries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const pendingTotal = salaries
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const paidTotal = salaries
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const yearOptions = (() => {
    const options: string[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 3; i++) {
      options.push(String(currentYear - i));
    }
    return options;
  })();

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "pix": return "PIX";
      case "deposit": return "Depósito";
      case "cash": return "Espécie";
      case "transfer": return "Transferência";
      default: return method || "—";
    }
  };

  const exportCsv = () => {
    const headers = ["Período", "Valor", "Status", "Método", "Data Pagamento", "Referência"];
    const rows = salaries.map((s) => [
      `${String(s.payment_month).padStart(2, "0")}/${s.payment_year}`,
      Number(s.amount || 0).toFixed(2).replace(".", ","),
      s.status === "paid" ? "Pago" : s.status === "pending" ? "Pendente" : "Cancelado",
      getPaymentMethodLabel(s.payment_method),
      s.payment_date ? formatInAppTz(s.payment_date, "dd/MM/yyyy") : "—",
      s.payment_reference || "—",
    ]);
    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salarios-${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePaymentReceipt = async (salary: SalaryPayment) => {
    if (salary.status !== "paid") return;

    // Buscar dados da clínica
    let tenantName = "Clínica";
    let tenantCnpj = "";
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, cnpj")
        .eq("id", profile.tenant_id)
        .maybeSingle();
      if (tenant) {
        tenantName = tenant.name || "Clínica";
        tenantCnpj = tenant.cnpj || "";
      }
    }

    const monthLabel = format(
      new Date(salary.payment_year, salary.payment_month - 1),
      "MMMM 'de' yyyy",
      { locale: ptBR }
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprovante de Pagamento</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #007bff; margin: 0; font-size: 24px; }
          .header p { margin: 10px 0 0 0; color: #666; }
          .info-section { margin: 25px 0; }
          .info-section h3 { color: #444; font-size: 14px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #eee; }
          .info-label { color: #666; }
          .info-value { font-weight: bold; }
          .amount-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
          .amount-box .label { font-size: 12px; color: #666; text-transform: uppercase; }
          .amount-box .value { font-size: 32px; font-weight: bold; color: #28a745; margin-top: 5px; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
          .stamp { border: 2px solid #28a745; color: #28a745; padding: 10px 20px; display: inline-block; border-radius: 5px; font-weight: bold; transform: rotate(-5deg); margin: 20px 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>COMPROVANTE DE PAGAMENTO</h1>
          <p>${tenantName}</p>
          ${tenantCnpj ? `<p style="font-size: 12px;">CNPJ: ${tenantCnpj}</p>` : ""}
        </div>

        <div class="info-section">
          <h3>Dados do Beneficiário</h3>
          <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value">${profile?.full_name || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">CPF:</span>
            <span class="info-value">${profile?.cpf || "—"}</span>
          </div>
        </div>

        <div class="info-section">
          <h3>Dados do Pagamento</h3>
          <div class="info-row">
            <span class="info-label">Referência:</span>
            <span class="info-value">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Data do Pagamento:</span>
            <span class="info-value">${salary.payment_date ? formatInAppTz(salary.payment_date, "dd/MM/yyyy") : "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Forma de Pagamento:</span>
            <span class="info-value">${getPaymentMethodLabel(salary.payment_method)}</span>
          </div>
          ${salary.payment_reference ? `
            <div class="info-row">
              <span class="info-label">Comprovante/Referência:</span>
              <span class="info-value">${salary.payment_reference}</span>
            </div>
          ` : ""}
        </div>

        <div class="amount-box">
          <div class="label">Valor Pago</div>
          <div class="value">${formatCurrency(Number(salary.amount || 0))}</div>
        </div>

        <div style="text-align: center;">
          <div class="stamp">PAGO</div>
        </div>

        <div class="footer">
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          <p>Este comprovante é válido como recibo de pagamento.</p>
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
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={salaries.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold text-warning">{formatCurrency(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(paidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Salários</CardTitle>
          <CardDescription>
            {salaries.length} registro(s) em {filterYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : salaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Nenhum salário registrado em {filterYear}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries.map((s) => {
                    const monthLabel = format(
                      new Date(s.payment_year, s.payment_month - 1),
                      "MMMM 'de' yyyy",
                      { locale: ptBR }
                    );
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(Number(s.amount || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              s.status === "paid"
                                ? "bg-success/20 text-success border-success/30"
                                : s.status === "pending"
                                ? "bg-warning/20 text-warning border-warning/30"
                                : "bg-destructive/20 text-destructive border-destructive/30"
                            }
                          >
                            {s.status === "paid" ? "Pago" : s.status === "pending" ? "Pendente" : "Cancelado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.payment_method ? (
                            <Badge variant="outline">
                              {getPaymentMethodLabel(s.payment_method)}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.payment_date
                            ? formatInAppTz(s.payment_date, "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {s.status === "paid" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => generatePaymentReceipt(s)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Gerar comprovante</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
