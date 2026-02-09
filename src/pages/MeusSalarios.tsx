import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, CreditCard, Calendar, Download } from "lucide-react";
import { format } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type SalaryStatus = "pending" | "paid" | "cancelled";

type SalaryPayment = {
  id: string;
  professional_id: string;
  professional_name: string;
  payment_month: number;
  payment_year: number;
  amount: number;
  status: SalaryStatus;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function MeusSalarios() {
  const { profile, isAdmin } = useAuth();
  const [filterMonth, setFilterMonth] = useState<string>(formatInAppTz(new Date(), "yyyy-MM"));
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id && !isAdmin) {
      fetchSalaries();
    }
  }, [profile?.tenant_id, profile?.user_id, isAdmin, filterMonth, showAllPeriods]);

  const fetchSalaries = async () => {
    if (!profile?.tenant_id || !profile?.user_id || isAdmin) return;

    setIsLoading(true);

    try {
      const [year, month] = filterMonth.split("-").map(Number);
      
      const { data, error } = await supabase.rpc("get_salary_payments", {
        p_tenant_id: profile.tenant_id,
        p_professional_id: showAllPeriods ? null : profile.user_id,
        p_year: showAllPeriods ? null : year,
        p_month: showAllPeriods ? null : month,
      });

      if (error) throw error;

      // Filtrar apenas os salários do profissional atual se showAllPeriods estiver ativo
      const filteredSalaries = showAllPeriods
        ? ((data || []) as SalaryPayment[]).filter((s) => s.professional_id === profile.user_id)
        : ((data || []) as SalaryPayment[]);

      setSalaries(filteredSalaries);
    } catch (error) {
      console.error("Error fetching salaries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const pendingTotal = salaries
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const paidTotal = salaries
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const monthOptions = (() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(format(d, "yyyy-MM"));
    }
    return options;
  })();

  const exportCsv = () => {
    const headers = ["Período", "Valor", "Status", "Método", "Data de Pagamento"];
    const rows = salaries.map((s) => [
      `${String(s.payment_month).padStart(2, "0")}/${s.payment_year}`,
      Number(s.amount || 0).toFixed(2).replace(".", ","),
      s.status === "paid" ? "Pago" : s.status === "pending" ? "Pendente" : "Cancelado",
      s.payment_method === "pix" ? "PIX" : 
       s.payment_method === "deposit" ? "Depósito" :
       s.payment_method === "cash" ? "Espécie" : s.payment_method || "—",
      s.status === "paid" && s.payment_date
        ? formatInAppTz(s.payment_date, "dd/MM/yyyy")
        : "—",
    ]);
    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meus-salarios-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isAdmin) {
    return (
      <MainLayout title="Meus Salários" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Administradores gerenciam salários pelo painel Financeiro
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Meus Salários"
      subtitle="Histórico de salários pendentes e pagos"
      actions={
        <div className="flex flex-wrap gap-2 justify-end items-center">
          <div className="flex items-center gap-2">
            <Switch
              id="show-all"
              checked={showAllPeriods}
              onCheckedChange={setShowAllPeriods}
            />
            <Label htmlFor="show-all" className="text-sm cursor-pointer">Todos os períodos</Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={isLoading || salaries.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          {!showAllPeriods && (
          <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => {
              const [year, month] = m.split("-").map(Number);
              const label = format(new Date(year, month - 1), "MMMM 'de' yyyy", { locale: ptBR });
              return (
                <SelectItem key={m} value={m}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </SelectItem>
              );
            })}
          </SelectContent>
          </Select>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Resumo */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                A receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-warning">{formatCurrency(pendingTotal)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando pagamento do administrador
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Pagos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-success">{formatCurrency(paidTotal)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Salários já pagos neste período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de salários */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              {showAllPeriods ? "Todos os salários" : "Salários do mês selecionado"}
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
                  Nenhum salário registrado neste período
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Data de Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaries.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          {String(s.payment_month).padStart(2, "0")}/{s.payment_year}
                        </TableCell>
                        <TableCell className="font-medium">
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
                              {s.payment_method === "pix" ? "PIX" : 
                               s.payment_method === "deposit" ? "Depósito" :
                               s.payment_method === "cash" ? "Espécie" : "Outro"}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.status === "paid" && s.payment_date
                            ? formatInAppTz(s.payment_date, "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
