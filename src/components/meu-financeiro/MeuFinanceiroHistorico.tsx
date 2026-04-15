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
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { getSalaryPayments } from "@/lib/typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { Calendar, Download, Wallet, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type TimelineItem = {
  id: string;
  type: "commission" | "salary";
  amount: number;
  status: "pending" | "paid" | "cancelled";
  date: string;
  description: string;
  paymentDate: string | null;
};

export function MeuFinanceiroHistorico() {
  const { profile } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id) {
      fetchTimeline();
    }
  }, [profile?.tenant_id, profile?.user_id]);

  const fetchTimeline = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsLoading(true);

    try {
      const sixMonthsAgo = subMonths(new Date(), 6);

      // Buscar comissões
      const { data: commissions } = await api
        .from("commission_payments")
        .select(`
          id,
          amount,
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
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: false });

      // Buscar salários
      const { data: salaries } = await getSalaryPayments({
        p_tenant_id: profile.tenant_id,
        p_professional_id: profile.user_id,
        p_year: null,
        p_month: null,
      });

      const items: TimelineItem[] = [];

      // Mapear comissões
      (commissions || []).forEach((c: any) => {
        const serviceName = c.appointment?.procedure?.name || "Procedimento";
        const clientName = c.appointment?.patient?.name || "";
        items.push({
          id: `comm-${c.id}`,
          type: "commission",
          amount: Number(c.amount || 0),
          status: c.status,
          date: c.created_at,
          description: clientName ? `${serviceName} - ${clientName}` : serviceName,
          paymentDate: c.payment_date,
        });
      });

      // Mapear salários (filtrar últimos 6 meses)
      const sixMonthsAgoDate = sixMonthsAgo.getTime();
      (salaries || []).forEach((s: any) => {
        const salaryDate = new Date(s.payment_year, s.payment_month - 1, 1);
        if (salaryDate.getTime() >= sixMonthsAgoDate) {
          const monthLabel = format(salaryDate, "MMMM 'de' yyyy", { locale: ptBR });
          items.push({
            id: `sal-${s.id}`,
            type: "salary",
            amount: Number(s.amount || 0),
            status: s.status,
            date: s.created_at || salaryDate.toISOString(),
            description: `Salário ${monthLabel}`,
            paymentDate: s.payment_date,
          });
        }
      });

      // Ordenar por data
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTimeline(items);
    } catch (error) {
      logger.error("Error fetching timeline:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTimeline = timeline.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const totalPending = filteredTimeline
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = filteredTimeline
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const exportCsv = () => {
    const headers = ["Data", "Tipo", "Descrição", "Valor", "Status", "Data Pagamento"];
    const rows = filteredTimeline.map((item) => [
      formatInAppTz(item.date, "dd/MM/yyyy"),
      item.type === "commission" ? "Comissão" : "Salário",
      item.description,
      item.amount.toFixed(2).replace(".", ","),
      item.status === "paid" ? "Pago" : item.status === "pending" ? "Pendente" : "Cancelado",
      item.paymentDate ? formatInAppTz(item.paymentDate, "dd/MM/yyyy") : "—",
    ]);
    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-financeiro.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="commission">Comissões</SelectItem>
                  <SelectItem value="salary">Salários</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredTimeline.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <ArrowUpRight className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <ArrowDownRight className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Recebido</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline Financeira</CardTitle>
          <CardDescription>
            Últimos 6 meses • {filteredTimeline.length} movimentação(ões)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTimeline.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      item.type === "commission"
                        ? "bg-primary/10 text-primary"
                        : "bg-success/10 text-success"
                    }`}
                  >
                    {item.type === "commission" ? (
                      <Wallet className="h-5 w-5" />
                    ) : (
                      <DollarSign className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatInAppTz(item.date, "dd/MM/yyyy")}
                      {item.paymentDate && item.status === "paid" && (
                        <span> • Pago em {formatInAppTz(item.paymentDate, "dd/MM/yyyy")}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(item.amount)}</p>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "paid"
                          ? "bg-success/20 text-success border-success/30"
                          : item.status === "pending"
                          ? "bg-warning/20 text-warning border-warning/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      }
                    >
                      {item.status === "paid" ? "Pago" : item.status === "pending" ? "Pendente" : "Cancelado"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
