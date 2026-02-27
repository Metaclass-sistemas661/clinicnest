import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  ChevronRight,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentPayment {
  id: string;
  type: "commission" | "salary";
  amount: number;
  status: string;
  date: string;
  description: string;
}

export function MeuFinanceiroMobile() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [paidThisMonth, setPaidThisMonth] = useState(0);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<RecentPayment | null>(null);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id) {
      fetchData();
    }
  }, [profile?.tenant_id, profile?.user_id]);

  const fetchData = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Comissões pendentes
      const { data: pendingCommissions } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "pending");

      const pending = (pendingCommissions || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );
      setPendingTotal(pending);

      // Recebido este mês
      const { data: paidCommissions } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", monthStart.toISOString())
        .lte("payment_date", monthEnd.toISOString());

      const { data: paidSalaries } = await supabase
        .from("salary_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", monthStart.toISOString())
        .lte("payment_date", monthEnd.toISOString());

      const paidComm = (paidCommissions || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );
      const paidSal = (paidSalaries || []).reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
      );
      setPaidThisMonth(paidComm + paidSal);

      // Últimos pagamentos
      const { data: recentComm } = await supabase
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
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: recentSal } = await supabase
        .from("salary_payments")
        .select("id, amount, status, payment_date, payment_month, payment_year")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(3);

      const payments: RecentPayment[] = [];

      (recentComm || []).forEach((c) => {
        const serviceName = (c.appointment?.procedure as any)?.name || "Serviço";
        payments.push({
          id: c.id,
          type: "commission",
          amount: Number(c.amount || 0),
          status: c.status,
          date: c.payment_date || c.created_at,
          description: serviceName,
        });
      });

      (recentSal || []).forEach((s: any) => {
        const monthLabel = format(
          new Date(s.payment_year, s.payment_month - 1),
          "MMM/yyyy",
          { locale: ptBR }
        );
        payments.push({
          id: s.id,
          type: "salary",
          amount: Number(s.amount || 0),
          status: s.status,
          date: s.payment_date || new Date(s.payment_year, s.payment_month - 1).toISOString(),
          description: `Salário ${monthLabel}`,
        });
      });

      // Ordenar por data
      payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentPayments(payments.slice(0, 6));
    } catch (error) {
      logger.error("Error fetching mobile financial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Cards de resumo - estilo mobile */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-warning/20 to-warning/5 border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">A Receber</span>
            </div>
            <p className="text-xl font-bold text-warning">
              {formatCurrency(pendingTotal)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/20 to-success/5 border-success/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Este Mês</span>
            </div>
            <p className="text-xl font-bold text-success">
              {formatCurrency(paidThisMonth)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta se houver pendências */}
      {pendingTotal > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Comissões pendentes</p>
              <p className="text-xs text-muted-foreground">
                Você tem {formatCurrency(pendingTotal)} aguardando pagamento
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de pagamentos recentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Movimentações Recentes</span>
            <Button variant="ghost" size="sm" className="text-xs h-8">
              Ver tudo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentPayments.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma movimentação recente</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentPayments.map((payment) => (
                <Sheet key={payment.id}>
                  <SheetTrigger asChild>
                    <button
                      className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <div
                        className={`p-2 rounded-full ${
                          payment.type === "commission"
                            ? "bg-primary/10"
                            : "bg-success/10"
                        }`}
                      >
                        {payment.type === "commission" ? (
                          <CreditCard
                            className={`h-4 w-4 ${
                              payment.type === "commission"
                                ? "text-primary"
                                : "text-success"
                            }`}
                          />
                        ) : (
                          <Wallet className="h-4 w-4 text-success" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {payment.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatInAppTz(payment.date, "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            payment.status === "paid"
                              ? "text-success"
                              : "text-warning"
                          }`}
                        >
                          {formatCurrency(payment.amount)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            payment.status === "paid"
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-warning/10 text-warning border-warning/30"
                          }`}
                        >
                          {payment.status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-auto max-h-[70vh]">
                    <SheetHeader>
                      <SheetTitle>Detalhes do Pagamento</SheetTitle>
                    </SheetHeader>
                    {selectedPayment && (
                      <div className="space-y-4 mt-4">
                        <div className="text-center py-4">
                          <p className="text-3xl font-bold text-primary">
                            {formatCurrency(selectedPayment.amount)}
                          </p>
                          <Badge
                            variant="outline"
                            className={`mt-2 ${
                              selectedPayment.status === "paid"
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-warning/10 text-warning border-warning/30"
                            }`}
                          >
                            {selectedPayment.status === "paid" ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                        <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo</span>
                            <span className="font-medium">
                              {selectedPayment.type === "commission"
                                ? "Comissão"
                                : "Salário"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Descrição</span>
                            <span className="font-medium">
                              {selectedPayment.description}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Data</span>
                            <span className="font-medium">
                              {formatInAppTz(selectedPayment.date, "dd/MM/yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs">Ver Relatórios</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <DollarSign className="h-5 w-5" />
          <span className="text-xs">Histórico Completo</span>
        </Button>
      </div>
    </div>
  );
}
