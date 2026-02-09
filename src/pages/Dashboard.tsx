import { useEffect, useState, useMemo } from "react";
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
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { fetchClientSpendingByPeriod } from "@/lib/clientSpending";
import { toast } from "sonner";
import type { DashboardStats, Appointment, Product } from "@/types/database";

export default function Dashboard() {
  const { user, profile, tenant, isAdmin } = useAuth();
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
  const [dailyBalance, setDailyBalance] = useState(0);
  const [productLossTotal, setProductLossTotal] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [staffMyClientsCount, setStaffMyClientsCount] = useState<number | null>(null);
  const [commissionsPending, setCommissionsPending] = useState(0);
  const [commissionsPaid, setCommissionsPaid] = useState(0);
  const [professionalCommissionsToReceive, setProfessionalCommissionsToReceive] = useState(0);
  const [professionalCommissionsReceived, setProfessionalCommissionsReceived] = useState(0);
  const [clientRanking, setClientRanking] = useState<
    { client_id: string; client_name: string; today_total: number; month_total: number }[]
  >([]);
  const [staffCompletedThisMonth, setStaffCompletedThisMonth] = useState(0);
  const [staffValueGeneratedThisMonth, setStaffValueGeneratedThisMonth] = useState(0);
  const [professionalGoalsRanking, setProfessionalGoalsRanking] = useState<
    { professional_id: string; professional_name: string; goal_name: string; goal_type: string; current_value: number; target_value: number; progress_pct: number }[]
  >([]);
  const [salariesToPay, setSalariesToPay] = useState(0);
  const [salariesPaid, setSalariesPaid] = useState(0);
  const [mySalaryAmount, setMySalaryAmount] = useState<number | null>(null);
  const [lastSalaryPayment, setLastSalaryPayment] = useState<{ date: string | null; amount: number } | null>(null);

  useEffect(() => {
    const hasStaffId = profile?.user_id ?? user?.id;
    if (profile?.tenant_id && (isAdmin || (hasStaffId && profile?.id))) {
      fetchDashboardData();
    }
  }, [profile?.tenant_id, profile?.user_id, profile?.id, user?.id, isAdmin]);

  // Refetch quando o usuário volta para a página (ex.: após marcar comissão como paga no Financeiro)
  useEffect(() => {
    const onFocus = () => {
      if (profile?.tenant_id) fetchDashboardData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.tenant_id]);

  const fetchCommissionTotals = async (
    tenantId: string,
    asAdmin: boolean,
    professionalUserId: string | null
  ): Promise<{ pending: number; paid: number }> => {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_commission_totals", {
        p_tenant_id: tenantId,
        p_is_admin: asAdmin,
        p_professional_user_id: asAdmin ? null : professionalUserId,
      });
      if (error) throw error;
      const result = data as { pending?: number; paid?: number } | null;
      const p = Number(result?.pending ?? 0);
      const paid = Number(result?.paid ?? 0);
      return { pending: p, paid };
    } catch {
      if (asAdmin) {
        const { data } = await supabase
          .from("commission_payments")
          .select("amount, status")
          .eq("tenant_id", tenantId)
          .gte("created_at", startOfMonth(new Date()).toISOString())
          .lte("created_at", endOfMonth(new Date()).toISOString());
        const rows = data ?? [];
        const s = (c: { status?: string }) => String(c?.status ?? "").toLowerCase();
        return {
          pending: rows.filter((c) => s(c) === "pending").reduce((a, c) => a + Number(c.amount ?? 0), 0),
          paid: rows.filter((c) => s(c) === "paid").reduce((a, c) => a + Number(c.amount ?? 0), 0),
        };
      }
      if (professionalUserId) {
        const { data } = await supabase
          .from("commission_payments")
          .select("amount, status")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalUserId)
          .gte("created_at", startOfMonth(new Date()).toISOString())
          .lte("created_at", endOfMonth(new Date()).toISOString());
        const rows = data ?? [];
        const s = (c: { status?: string }) => String(c?.status ?? "").toLowerCase();
        return {
          pending: rows.filter((c) => s(c) === "pending").reduce((a, c) => a + Number(c.amount ?? 0), 0),
          paid: rows.filter((c) => s(c) === "paid").reduce((a, c) => a + Number(c.amount ?? 0), 0),
        };
      }
    }
    return { pending: 0, paid: 0 };
  };

  const fetchSalaryTotals = async (
    tenantId: string,
    asAdmin: boolean,
    professionalUserId: string | null
  ): Promise<{ pending: number; paid: number }> => {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_salary_totals" as any, {
        p_tenant_id: tenantId,
        p_is_admin: asAdmin,
        p_professional_user_id: asAdmin ? null : professionalUserId,
      });
      if (error) throw error;
      const result = data as { pending?: number; paid?: number } | null;
      const p = Number(result?.pending ?? 0);
      const paid = Number(result?.paid ?? 0);
      return { pending: p, paid };
    } catch (error) {
      console.error("Error fetching salary totals:", error);
      // Fallback: calcular manualmente
      if (asAdmin) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Buscar profissionais com salário configurado
        const { data: professionalsData } = await supabase
          .from("professional_commissions")
          .select("user_id, salary_amount")
          .eq("tenant_id", tenantId)
          .eq("payment_type", "salary")
          .not("salary_amount", "is", null)
          .gt("salary_amount", 0);
        
        // Buscar salários pagos no mês
        const { data: paidSalaries } = await (supabase as any)
          .from("salary_payments")
          .select("professional_id, amount")
          .eq("tenant_id", tenantId)
          .eq("payment_year", currentYear)
          .eq("payment_month", currentMonth)
          .eq("status", "paid");
        
        const paidIds = new Set((paidSalaries || []).map((s: any) => s.professional_id));
        const pending = (professionalsData || [])
          .filter((p: any) => !paidIds.has(p.user_id))
          .reduce((sum: number, p: any) => sum + Number(p.salary_amount || 0), 0);
        const paid = (paidSalaries || [])
          .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
        return { pending, paid };
      } else {
        return { pending: 0, paid: 0 };
      }
    }
  };

  const fetchDashboardData = async () => {
    if (!profile?.tenant_id) return;
    const staffUserId = profile?.user_id ?? user?.id;
    if (!isAdmin && (!staffUserId || !profile?.id)) return;

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
        staffPerformanceResult,
        staffMyClientsResult,
        salaryTotalsResult,
        professionalsWithSalaryResult,
        salariesPaidResult,
        mySalaryConfigResult,
        mySalaryPaymentsResult,
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
        // 4. Contagem de pendentes (admin = todos; staff = só seus)
        isAdmin
          ? supabase
              .from("appointments")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", profile.tenant_id)
              .eq("status", "pending")
          : supabase
              .from("appointments")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.id)
              .eq("status", "pending"),
        // 5. Produtos (admin) para estoque baixo
        isAdmin
          ? supabase
              .from("products")
              .select("id,tenant_id,name,description,cost,quantity,min_quantity,is_active,created_at,updated_at")
              .eq("tenant_id", profile.tenant_id)
              .eq("is_active", true)
          : Promise.resolve({ data: null }),
        // 6. Comissões do mês (RPC com fallback para query direta)
        fetchCommissionTotals(
          profile.tenant_id,
          isAdmin,
          isAdmin ? null : staffUserId ?? null
        ).then((r) => ({ data: r, error: null })),
        // 6.5. Salários do mês (RPC similar ao de comissões)
        isAdmin
          ? fetchSalaryTotals(
              profile.tenant_id,
              isAdmin,
              null
            ).then((r) => ({ data: r, error: null }))
          : Promise.resolve({ data: { pending: 0, paid: 0 }, error: null }),
        // 7. Perdas de produtos (baixas danificadas) do mês
        isAdmin
          ? supabase
              .from("stock_movements")
              .select(
                `
                  id,
                  product_id,
                  quantity,
                  reason,
                  created_at,
                  movement_type,
                  out_reason_type,
                  product:products(name, cost)
                `
              )
              .eq("tenant_id", profile.tenant_id)
              .eq("movement_type", "out")
              .eq("out_reason_type", "damaged")
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: null }),
        // 8. Total de clientes
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id),
        // 9. Staff: desempenho do mês (serviços concluídos, valor gerado)
        !isAdmin && profile?.id
          ? supabase
              .from("appointments")
              .select("id, price, status")
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.id)
              .eq("status", "completed")
              .gte("scheduled_at", monthStart)
              .lte("scheduled_at", monthEnd)
          : Promise.resolve({ data: null }),
        // 10. Staff: clientes únicos que atendeu (distinct client_id dos seus agendamentos)
        !isAdmin && profile?.id
          ? supabase
              .from("appointments")
              .select("client_id")
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.id)
              .not("client_id", "is", null)
          : Promise.resolve({ data: null }),
        // 11. Admin: profissionais com salário fixo configurado (para calcular total a pagar)
        isAdmin
          ? supabase.rpc("get_professionals_with_salary" as any, {
              p_tenant_id: profile.tenant_id,
            })
          : Promise.resolve({ data: null }),
        // 12. Admin: salários pagos no mês
        isAdmin
          ? supabase.rpc("get_salary_payments" as any, {
              p_tenant_id: profile.tenant_id,
              p_professional_id: null,
              p_year: new Date().getFullYear(),
              p_month: new Date().getMonth() + 1,
            })
          : Promise.resolve({ data: null }),
        // 13. Staff: configuração de salário fixo
        !isAdmin && profile?.user_id
          ? supabase
              .from("professional_commissions")
              .select("salary_amount, payment_type")
              .eq("tenant_id", profile.tenant_id)
              .eq("user_id", profile.user_id)
              .eq("payment_type", "salary")
              .maybeSingle()
          : Promise.resolve({ data: null }),
        // 14. Staff: último pagamento de salário
        !isAdmin && profile?.user_id
          ? supabase.rpc("get_salary_payments" as any, {
              p_tenant_id: profile.tenant_id,
              p_professional_id: profile.user_id,
              p_year: null,
              p_month: null,
            })
          : Promise.resolve({ data: null }),
      ]);

      const financialData = financialResult.data;
      const dailyFinancialData = dailyFinancialResult.data;
      const appointmentsData = appointmentsResult.data;
      const pendingCount = pendingResult.count ?? 0;
      const productsData = productsResult.data;
      const commissionsData = commissionsResult.data as { pending?: number; paid?: number } | null;
      const salaryTotalsData = salaryTotalsResult?.data as { pending?: number; paid?: number } | null;
      const productLossesData = productLossesResult.data;
      const clientsCountResult = clientsResult.count ?? 0;
      const staffPerformanceData = (staffPerformanceResult?.data || []) as { id: string; price: number }[];
      const staffMyClientsData = (staffMyClientsResult?.data || []) as { client_id: string }[];
      const professionalsWithSalaryData = Array.isArray(professionalsWithSalaryResult?.data) 
        ? (professionalsWithSalaryResult.data as Array<{
            professional_id: string;
            professional_name: string;
            salary_amount: number;
            salary_payment_day: number;
            default_payment_method: string;
            commission_id: string;
          }>)
        : [];
      const salariesPaidData = Array.isArray(salariesPaidResult?.data)
        ? (salariesPaidResult.data as Array<{
            id: string;
            professional_id: string;
            amount: number;
            status: string;
            payment_date: string | null;
            payment_month: number;
            payment_year: number;
          }>)
        : [];
      const mySalaryConfigData = mySalaryConfigResult?.data as { salary_amount: number } | null;
      const mySalaryPaymentsData = (mySalaryPaymentsResult?.data || []) as Array<{
        id: string;
        amount: number;
        status: string;
        payment_date: string | null;
      }>;

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

      // Comissões: RPC retorna { pending, paid } diretamente
      const pendingCommissions = Number(commissionsData?.pending ?? 0);
      const paidCommissions = Number(commissionsData?.paid ?? 0);
      if (isAdmin) {
        setCommissionsPending(pendingCommissions);
        setCommissionsPaid(paidCommissions);
      } else if (staffUserId) {
        setProfessionalCommissionsToReceive(pendingCommissions);
        setProfessionalCommissionsReceived(paidCommissions);
      }

      setClientsCount(clientsCountResult);

      if (!isAdmin && staffMyClientsData.length > 0) {
        const uniqueClients = new Set(staffMyClientsData.map((r) => r.client_id).filter(Boolean));
        setStaffMyClientsCount(uniqueClients.size);
      } else if (!isAdmin) {
        setStaffMyClientsCount(0);
      } else {
        setStaffMyClientsCount(null);
      }

      // Salários: usar RPC similar ao de comissões (mais confiável)
      if (isAdmin && salaryTotalsData) {
        const pendingSalaries = Number(salaryTotalsData?.pending ?? 0);
        const paidSalaries = Number(salaryTotalsData?.paid ?? 0);
        setSalariesToPay(pendingSalaries);
        setSalariesPaid(paidSalaries);
      } else {
        setSalariesToPay(0);
        setSalariesPaid(0);
      }

      // Salários: Staff - valor do salário configurado
      if (!isAdmin && mySalaryConfigData?.salary_amount) {
        setMySalaryAmount(Number(mySalaryConfigData.salary_amount));
      } else {
        setMySalaryAmount(null);
      }

      // Salários: Staff - último pagamento
      if (!isAdmin && mySalaryPaymentsData.length > 0) {
        const paidSalaries = mySalaryPaymentsData.filter((s) => s.status === "paid");
        if (paidSalaries.length > 0) {
          const lastPaid = paidSalaries.sort((a, b) => {
            const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
            const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
            return dateB - dateA;
          })[0];
          setLastSalaryPayment({
            date: lastPaid.payment_date,
            amount: Number(lastPaid.amount || 0),
          });
        } else {
          setLastSalaryPayment(null);
        }
      } else {
        setLastSalaryPayment(null);
      }

      let lowStockData: Product[] = [];
      if (productsData) {
        lowStockData = (productsData as Product[]).filter(
          (p) => p.quantity <= p.min_quantity
        );
      }

      const apts = (appointmentsData as Appointment[]) || [];
      const myTodayCount = !isAdmin && profile?.id
        ? apts.filter((a) => a.professional_id === profile.id).length
        : apts.length;

      setStats({
        monthlyBalance: monthlyIncome - monthlyExpenses,
        monthlyIncome,
        monthlyExpenses,
        todayAppointments: isAdmin ? apts.length : myTodayCount,
        lowStockProducts: lowStockData.length,
        pendingAppointments: pendingCount,
      });

      setTodayAppointments(apts);
      setLowStockProducts(lowStockData);

      if (!isAdmin && staffPerformanceData?.length) {
        const completed = staffPerformanceData.length;
        const valueGenerated = staffPerformanceData.reduce((sum, a) => sum + Number(a.price || 0), 0);
        setStaffCompletedThisMonth(completed);
        setStaffValueGeneratedThisMonth(valueGenerated);
      } else if (!isAdmin) {
        setStaffCompletedThisMonth(0);
        setStaffValueGeneratedThisMonth(0);
      }

      if (isAdmin) {
        try {
          const ranking = await fetchClientSpendingByPeriod(profile.tenant_id);
          setClientRanking(ranking);
          // Goals functionality disabled - table doesn't exist
          setProfessionalGoalsRanking([]);
        } catch (err) {
          console.error("Error fetching ranking:", err);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar painel. Tente novamente.");
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

  const myTodayAppointments = useMemo(() => {
    if (isAdmin || !profile?.id) return todayAppointments;
    return todayAppointments.filter((a) => a.professional_id === profile.id);
  }, [todayAppointments, isAdmin, profile?.id]);

  const nextAppointment = useMemo(() => {
    if (isAdmin || myTodayAppointments.length === 0) return null;
    const now = new Date();
    const upcoming = myTodayAppointments
      .filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return upcoming[0] ?? myTodayAppointments.find((a) => a.status !== "cancelled") ?? null;
  }, [myTodayAppointments, isAdmin]);

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
            Array.from({ length: isAdmin ? 13 : 7 }).map((_, i) => (
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
                    title="Comissões a Pagar"
                    value={formatCurrency(commissionsPending)}
                    icon={CreditCard}
                    variant="warning"
                    description="Comissões pendentes do mês"
                  />
                  <Link to="/financeiro?tab=commissions">
                    <StatCard
                      title="Comissões Pagas"
                      value={formatCurrency(commissionsPaid)}
                      icon={Wallet}
                      variant="success"
                      description="Comissões pagas no mês"
                    />
                  </Link>
                  <Link to="/financeiro?tab=salaries">
                    <StatCard
                      title="Salários a Pagar"
                      value={formatCurrency(salariesToPay)}
                      icon={CreditCard}
                      variant="warning"
                      description="Total de salários fixos configurados"
                    />
                  </Link>
                  <Link to="/financeiro?tab=salaries">
                    <StatCard
                      title="Salários Pagos"
                      value={formatCurrency(salariesPaid)}
                      icon={DollarSign}
                      variant="success"
                      description="Salários pagos no mês"
                    />
                  </Link>
                </>
              )}
              {!isAdmin && (
                <>
                  <StatCard
                    title="Comissões a Receber"
                    value={formatCurrency(professionalCommissionsToReceive)}
                    icon={CreditCard}
                    variant="warning"
                    description="Comissões pendentes (aguardando pagamento do admin)"
                  />
                  <Link to="/minhas-comissoes" className="block [&:hover]:no-underline">
                    <StatCard
                      title="Comissões Recebidas"
                      value={formatCurrency(professionalCommissionsReceived)}
                      icon={Wallet}
                      variant="success"
                      description="Comissões já pagas neste mês"
                    />
                  </Link>
                  {mySalaryAmount !== null && (
                    <Link to="/meus-salarios" className="block [&:hover]:no-underline">
                      <StatCard
                        title="Meu Salário"
                        value={formatCurrency(mySalaryAmount)}
                        icon={DollarSign}
                        variant="info"
                        description={
                          lastSalaryPayment
                            ? `Último pagamento: ${formatInAppTz(lastSalaryPayment.date || "", "dd/MM/yyyy")}`
                            : "Salário fixo configurado"
                        }
                      />
                    </Link>
                  )}
                  <StatCard
                    title="Meu desempenho"
                    value={staffCompletedThisMonth}
                    icon={TrendingUp}
                    description={`${formatCurrency(staffValueGeneratedThisMonth)} gerados este mês`}
                  />
                  <StatCard
                    title="Clientes que atendi"
                    value={staffMyClientsCount ?? 0}
                    icon={Users}
                    description="Clientes únicos nos seus atendimentos"
                  />
                </>
              )}
              <StatCard
                title="Agendamentos Hoje"
                value={stats.todayAppointments}
                icon={Calendar}
              />
              <StatCard
                title={isAdmin ? "Pendentes" : "Meus pendentes"}
                value={stats.pendingAppointments}
                icon={Clock}
                variant={stats.pendingAppointments > 0 ? "warning" : "default"}
                description={!isAdmin ? "Agendamentos pendentes de confirmação" : undefined}
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
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
                  {clientRanking.slice(0, 10).map((item, index) => {
                    const rank = index + 1;
                    const isPodium = rank <= 3;
                    const podiumStyles = {
                      1: {
                        bg: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700",
                        badge: "bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
                        label: "1º lugar",
                        emoji: "🥇",
                      },
                      2: {
                        bg: "bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600",
                        badge: "bg-slate-400 text-white dark:bg-slate-500 dark:text-white",
                        label: "2º lugar",
                        emoji: "🥈",
                      },
                      3: {
                        bg: "bg-amber-100/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
                        badge: "bg-amber-700 text-amber-100 dark:bg-amber-800 dark:text-amber-100",
                        label: "3º lugar",
                        emoji: "🥉",
                      },
                    };
                    const style = isPodium ? podiumStyles[rank as 1 | 2 | 3] : null;
                    return (
                      <div
                        key={item.client_id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4 ${
                          style ? `${style.bg} border-2` : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div
                            className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full font-bold text-sm shrink-0 ${
                              style ? `${style.badge}` : "bg-primary/10 text-primary"
                            }`}
                            title={style?.label}
                          >
                            {style?.emoji ?? rank}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate">
                              {item.client_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Hoje: {formatCurrency(item.today_total)} · Mês: {formatCurrency(item.month_total)}
                            </p>
                            {style && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {style.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right self-end sm:self-auto">
                          <p className="text-base md:text-lg font-bold text-primary">
                            {formatCurrency(item.month_total)}
                          </p>
                          <p className="text-xs text-muted-foreground">total no mês</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ranking de Metas por Profissional - Admin only */}
        {isAdmin && professionalGoalsRanking.length > 0 && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ranking – Metas por Profissional
                </CardTitle>
                <CardDescription>
                  Profissionais ordenados pelo progresso das metas
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/metas">Ver metas</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {professionalGoalsRanking.map((item, index) => {
                  const rank = index + 1;
                  const isPodium = rank <= 3;
                  const podiumStyles = {
                    1: { bg: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700", emoji: "🥇" },
                    2: { bg: "bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600", emoji: "🥈" },
                    3: { bg: "bg-amber-100/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", emoji: "🥉" },
                  };
                  const style = isPodium ? podiumStyles[rank as 1 | 2 | 3] : null;
                  const isComplete = item.progress_pct >= 100;
                  const formatVal = (v: number) =>
                    item.goal_type === "revenue" || item.goal_type === "product_revenue"
                      ? formatCurrency(v)
                      : String(Math.round(v));
                  return (
                    <div
                      key={`${item.professional_id}-${item.goal_name}`}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4 ${
                        style ? `${style.bg} border-2` : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full font-bold text-sm shrink-0 bg-primary/10 text-primary">
                          {style?.emoji ?? rank}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {item.professional_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{item.goal_name}</p>
                        </div>
                      </div>
                      <div className="text-right self-end sm:self-auto">
                        <p className="text-base md:text-lg font-bold text-primary">
                          {formatVal(item.current_value)} / {formatVal(item.target_value)}
                        </p>
                        <p className={`text-xs ${isComplete ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                          {Math.round(item.progress_pct)}% {isComplete ? "· Meta concluída!" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Today's Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {isAdmin ? "Agenda de Hoje" : "Meus agendamentos hoje"}
                </CardTitle>
                <CardDescription>
                  {formatInAppTz(new Date(), "EEEE, d 'de' MMMM")}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/agenda">Ver tudo</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {myTodayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {isAdmin ? "Nenhum agendamento para hoje" : "Nenhum agendamento seu para hoje"}
                  </p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/agenda">Criar agendamento</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {myTodayAppointments.slice(0, 5).map((appointment) => (
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

          {/* Próximo atendimento - Staff only */}
          {!isAdmin && nextAppointment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Próximo atendimento</CardTitle>
                <CardDescription>
                  Seu próximo agendamento de hoje
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                      <Clock className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">
                        {nextAppointment.client?.name || "Cliente não informado"}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        {nextAppointment.service?.name} •{" "}
                        {formatInAppTz(nextAppointment.scheduled_at, "HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="self-end sm:self-auto">
                    {getStatusBadge(nextAppointment.status)}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="mt-4">
                  <Link to="/agenda">Ver agenda</Link>
                </Button>
              </CardContent>
            </Card>
          )}

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
