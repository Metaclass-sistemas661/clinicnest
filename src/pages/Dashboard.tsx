import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  Clock,
  Plus,
  AlertTriangle,
  Wallet,
  CreditCard,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { fetchClientSpendingByPeriod } from "@/lib/clientSpending";
import type { DashboardStats, Appointment, Product } from "@/types/database";

export default function Dashboard() {
  const { profile, tenant, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    monthlyBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    todayAppointments: 0,
    lowStockProducts: 0,
    pendingAppointments: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commissionsPaid, setCommissionsPaid] = useState(0);
  const [commissionsPending, setCommissionsPending] = useState(0);
  const [commissionsReceived, setCommissionsReceived] = useState(0);
  const [commissionsToReceive, setCommissionsToReceive] = useState(0);
  const [dailyBalance, setDailyBalance] = useState(0);
  const [productLossTotal, setProductLossTotal] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [clientRanking, setClientRanking] = useState<
    { client_id: string; client_name: string; today_total: number; month_total: number }[]
  >([]);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchDashboardData();
    }
  }, [profile?.tenant_id]);

  // Refetch quando o usuário volta para a página (ex.: após marcar comissão como paga no Financeiro)
  useEffect(() => {
    const onFocus = () => {
      if (profile?.tenant_id) fetchDashboardData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.tenant_id]);

  const fetchDashboardData = async () => {
    if (!profile?.tenant_id) return;

    const today = new Date();
    const monthStart = startOfMonth(today).toISOString();
    const monthEnd = endOfMonth(today).toISOString();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();
    const monthStartDate = monthStart.split("T")[0];
    const monthEndDate = monthEnd.split("T")[0];
    const todayDateStr = formatInAppTz(today, "yyyy-MM-dd");

    try {
      // Disparar todas as buscas em paralelo (em vez de uma após a outra)
      const [
        financialResult,
        dailyFinancialResult,
        appointmentsResult,
        pendingResult,
        productsResult,
        commissionsResult,
        productLossesResult,
        clientsResult,
      ] = await Promise.all([
        // 1. Financeiro do mês (admin)
        isAdmin
          ? supabase
              .from("financial_transactions")
              .select("type, amount")
              .eq("tenant_id", profile.tenant_id)
              .gte("transaction_date", monthStartDate)
              .lte("transaction_date", monthEndDate)
          : Promise.resolve({ data: null }),
        // 2. Financeiro do dia (admin) - só transações de hoje; zera à meia-noite
        isAdmin
          ? supabase
              .from("financial_transactions")
              .select("type, amount")
              .eq("tenant_id", profile.tenant_id)
              .eq("transaction_date", todayDateStr)
          : Promise.resolve({ data: null }),
        // 3. Agendamentos de hoje
        supabase
          .from("appointments")
          .select(`
            *,
            client:clients(name, phone),
            service:services(name, duration_minutes),
            professional:profiles(full_name)
          `)
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
        // 4. Contagem de pendentes
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "pending"),
        // 5. Produtos (admin) para estoque baixo
        isAdmin
          ? supabase
              .from("products")
              .select("*")
              .eq("tenant_id", profile.tenant_id)
              .eq("is_active", true)
          : Promise.resolve({ data: null }),
        // 6. Comissões (admin: todas; staff: só do usuário)
        isAdmin
          ? supabase
              .from("commission_payments")
              .select("amount, status, created_at, professional_id")
              .eq("tenant_id", profile.tenant_id)
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd)
          : supabase
              .from("commission_payments")
              .select("amount, status, created_at")
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.user_id)
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd),
        // 7. Perdas de produtos danificados (admin) - mês atual
        isAdmin
          ? supabase
              .from("stock_movements")
              .select("quantity, product:products(cost)")
              .eq("tenant_id", profile.tenant_id)
              .eq("movement_type", "out")
              .eq("out_reason_type", "damaged")
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd)
          : Promise.resolve({ data: null }),
        // 8. Total de clientes
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id),
      ]);

      const financialData = financialResult.data;
      const dailyFinancialData = dailyFinancialResult.data;
      const appointmentsData = appointmentsResult.data;
      const pendingCount = pendingResult.count ?? 0;
      const productsData = productsResult.data;
      const commissionsData = commissionsResult.data;
      const productLossesData = productLossesResult.data;
      const clientsCountResult = clientsResult.count ?? 0;

      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      if (financialData) {
        monthlyIncome = financialData
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        monthlyExpenses = financialData
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
      }

      let dailyIncome = 0;
      let dailyExpenses = 0;
      if (dailyFinancialData) {
        dailyIncome = dailyFinancialData
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        dailyExpenses = dailyFinancialData
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
      }
      setDailyBalance(dailyIncome - dailyExpenses);

      let productLoss = 0;
      if (productLossesData) {
        productLoss = productLossesData.reduce((sum: number, m: any) => {
          const qty = Math.abs(Number(m.quantity) || 0);
          const cost = Number(m.product?.cost) || 0;
          return sum + qty * cost;
        }, 0);
      }
      setProductLossTotal(productLoss);

      setClientsCount(clientsCountResult);

      let lowStockData: Product[] = [];
      if (productsData) {
        lowStockData = (productsData as Product[]).filter(
          (p) => p.quantity <= p.min_quantity
        );
      }

      if (commissionsData) {
        if (isAdmin) {
          const paid = commissionsData
            .filter((c) => c.status === "paid")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          const pending = commissionsData
            .filter((c) => c.status === "pending")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          setCommissionsPaid(paid);
          setCommissionsPending(pending);
        } else {
          const received = commissionsData
            .filter((c) => c.status === "paid")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          const toReceive = commissionsData
            .filter((c) => c.status === "pending")
            .reduce((sum, c) => sum + Number(c.amount), 0);
          setCommissionsReceived(received);
          setCommissionsToReceive(toReceive);
        }
      }

      setStats({
        monthlyBalance: monthlyIncome - monthlyExpenses,
        monthlyIncome,
        monthlyExpenses,
        todayAppointments: appointmentsData?.length || 0,
        lowStockProducts: lowStockData.length,
        pendingAppointments: pendingCount,
      });

      setTodayAppointments((appointmentsData as Appointment[]) || []);
      setLowStockProducts(lowStockData);

      if (isAdmin) {
        try {
          const ranking = await fetchClientSpendingByPeriod(profile.tenant_id);
          setClientRanking(ranking);
        } catch (err) {
          console.error("Error fetching client ranking:", err);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-warning/20 text-warning border-warning/30",
      confirmed: "bg-info/20 text-info border-info/30",
      completed: "bg-success/20 text-success border-success/30",
      cancelled: "bg-destructive/20 text-destructive border-destructive/30",
    };
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <MainLayout
      title={`Olá, ${profile?.full_name?.split(" ")[0] || "Usuário"}!`}
      subtitle={`Bem-vindo ao ${tenant?.name || "seu salão"}`}
      actions={
        <Button asChild className="gradient-primary text-primary-foreground text-sm md:text-base">
          <Link to="/agenda">
            <Plus className="mr-1 md:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Agendar</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        {/* Stats Grid - skeleton enquanto carrega para layout aparecer na hora */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: isAdmin ? 11 : 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-6 flex items-start justify-between gap-3"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-24 sm:h-8 lg:h-9" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              </div>
            ))
          ) : (
            <>
              {isAdmin && (
                <>
                  <StatCard
                    title="Saldo do Dia"
                    value={formatCurrency(dailyBalance)}
                    icon={DollarSign}
                    variant={dailyBalance >= 0 ? "success" : "danger"}
                    description="Só transações de hoje (zera à meia-noite)"
                  />
                  <StatCard
                    title="Saldo do Mês"
                    value={formatCurrency(stats.monthlyBalance)}
                    icon={DollarSign}
                    variant={stats.monthlyBalance >= 0 ? "success" : "danger"}
                  />
                  <StatCard
                    title="Receitas"
                    value={formatCurrency(stats.monthlyIncome)}
                    icon={TrendingUp}
                    variant="success"
                  />
                  <StatCard
                    title="Despesas"
                    value={formatCurrency(stats.monthlyExpenses)}
                    icon={TrendingDown}
                    variant="danger"
                  />
                  <StatCard
                    title="Perdas de Produtos"
                    value={formatCurrency(productLossTotal)}
                    icon={AlertTriangle}
                    variant="danger"
                    description="Baixas danificadas no mês"
                  />
                  <StatCard
                    title="Total de Clientes"
                    value={clientsCount}
                    icon={Users}
                    description="Clientes cadastrados"
                  />
                  <StatCard
                    title="Comissões Pagas"
                    value={formatCurrency(commissionsPaid)}
                    icon={Wallet}
                    variant="success"
                  />
                  <StatCard
                    title="Comissões a Pagar"
                    value={formatCurrency(commissionsPending)}
                    icon={CreditCard}
                    variant="warning"
                  />
                </>
              )}
              {!isAdmin && (
                <>
                  <StatCard
                    title="Comissões Recebidas"
                    value={formatCurrency(commissionsReceived)}
                    icon={Wallet}
                    variant="success"
                  />
                  <StatCard
                    title="Comissões a Receber"
                    value={formatCurrency(commissionsToReceive)}
                    icon={CreditCard}
                    variant="warning"
                  />
                  <StatCard
                    title="Total de Clientes"
                    value={clientsCount}
                    icon={Users}
                    description="Clientes cadastrados"
                  />
                </>
              )}
              <StatCard
                title="Agendamentos Hoje"
                value={stats.todayAppointments}
                icon={Calendar}
              />
              <StatCard
                title="Pendentes"
                value={stats.pendingAppointments}
                icon={Clock}
                variant={stats.pendingAppointments > 0 ? "warning" : "default"}
              />
              {isAdmin && (
                <StatCard
                  title="Estoque Baixo"
                  value={stats.lowStockProducts}
                  icon={Package}
                  variant={stats.lowStockProducts > 0 ? "warning" : "default"}
                />
              )}
            </>
          )}
        </div>

        {/* Top Clientes - Admin only */}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Ranking – Clientes que mais consomem</CardTitle>
                <CardDescription>
                  Gastos de hoje e do mês (atualiza automaticamente)
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/clientes">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {clientRanking.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Nenhum consumo registrado neste mês
                  </p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {clientRanking.slice(0, 10).map((item, index) => (
                    <div
                      key={item.client_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {item.client_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Hoje: {formatCurrency(item.today_total)} · Mês: {formatCurrency(item.month_total)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right self-end sm:self-auto">
                        <p className="text-base md:text-lg font-bold text-primary">
                          {formatCurrency(item.month_total)}
                        </p>
                        <p className="text-xs text-muted-foreground">total no mês</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Today's Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Agenda de Hoje</CardTitle>
                <CardDescription>
                  {formatInAppTz(new Date(), "EEEE, d 'de' MMMM")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/agenda">Ver tudo</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Nenhum agendamento para hoje
                  </p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/agenda">Criar agendamento</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {todayAppointments.slice(0, 5).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 transition-colors hover:bg-muted/50 gap-2 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                          <Clock className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {appointment.client?.name || "Cliente não informado"}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {appointment.service?.name} •{" "}
                            {formatInAppTz(appointment.scheduled_at, "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="self-end sm:self-auto">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alert - Admin Only */}
          {isAdmin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Alertas de Estoque</CardTitle>
                  <CardDescription>
                    Produtos com estoque baixo ou zerado
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/produtos">Ver todos</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      Todos os produtos estão com estoque adequado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3 md:p-4 gap-2"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-warning/20 text-warning shrink-0">
                            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate">{product.name}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              Mínimo: {product.min_quantity} unid.
                            </p>
                          </div>
                        </div>
                        <div className="text-right self-end sm:self-auto">
                          <p className="text-base md:text-lg font-bold text-warning">
                            {product.quantity}
                          </p>
                          <p className="text-xs text-muted-foreground">em estoque</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
