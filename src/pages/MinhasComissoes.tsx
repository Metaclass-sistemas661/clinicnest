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
import { Wallet, CreditCard, Calendar, Loader2, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type CommissionStatus = "pending" | "paid";
type CommissionPayment = {
  id: string;
  amount: number;
  service_price: number;
  status: CommissionStatus;
  payment_date: string | null;
  created_at: string;
  notes: string | null;
  appointment?: { id: string } | null;
};

export default function MinhasComissoes() {
  const { profile, isAdmin } = useAuth();
  const [filterMonth, setFilterMonth] = useState<string>(formatInAppTz(new Date(), "yyyy-MM"));
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [commissions, setCommissions] = useState<CommissionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id && !isAdmin) {
      fetchCommissions();
    }
  }, [profile?.tenant_id, profile?.user_id, isAdmin, filterMonth, showAllPeriods]);

  const fetchCommissions = async () => {
    if (!profile?.tenant_id || !profile?.user_id || isAdmin) return;

    setIsLoading(true);

    try {
      let query = supabase
        .from("commission_payments")
        .select(`
          id,
          amount,
          service_price,
          status,
          payment_date,
          notes,
          created_at,
          appointment:appointments(id)
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id);

      if (!showAllPeriods) {
        const [year, month] = filterMonth.split("-").map(Number);
        const start = startOfMonth(new Date(year, month - 1));
        const end = endOfMonth(new Date(year, month - 1));
        query = query
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setCommissions((data || []) as CommissionPayment[]);
    } catch (error) {
      console.error("Error fetching commissions:", error);
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

  const pendingTotal = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const paidTotal = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

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
    const headers = ["Data", "Valor do serviço", "Comissão", "Status", "Pagamento"];
    const rows = commissions.map((c) => [
      formatInAppTz(c.created_at, "dd/MM/yyyy HH:mm"),
      Number(c.service_price || 0).toFixed(2).replace(".", ","),
      Number(c.amount || 0).toFixed(2).replace(".", ","),
      c.status === "paid" ? "Pago" : "Pendente",
      c.status === "paid" && c.payment_date
        ? format(new Date(c.payment_date), "dd/MM/yyyy")
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
    a.download = `minhas-comissoes-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isAdmin) {
    return (
      <MainLayout title="Minhas Comissões" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Administradores acessam comissões pelo painel Financeiro
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Minhas Comissões"
      subtitle="Histórico de comissões pendentes e pagas"
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
            disabled={isLoading || commissions.length === 0}
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
                <Wallet className="h-4 w-4" />
                Pagas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-success">{formatCurrency(paidTotal)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Comissões já pagas neste período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de comissões */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              {showAllPeriods ? "Todas as comissões" : "Comissões do mês selecionado"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : commissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Nenhuma comissão registrada neste período
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor do serviço</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {formatInAppTz(c.created_at, "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{formatCurrency(Number(c.service_price || 0))}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(Number(c.amount || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              c.status === "paid"
                                ? "bg-success/20 text-success border-success/30"
                                : "bg-warning/20 text-warning border-warning/30"
                            }
                          >
                            {c.status === "paid" ? "Pago" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.status === "paid" && c.payment_date
                            ? format(new Date(c.payment_date), "dd/MM/yyyy")
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
