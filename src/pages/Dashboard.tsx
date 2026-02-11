import { useEffect, useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { fetchClientSpendingByPeriod } from "@/lib/clientSpending";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { DashboardStats, Appointment, Product } from "@/types/database";
import type { SalaryPaymentRow } from "@/types/supabase-extensions";
import { getDashboardSalaryTotals, getDashboardCommissionTotals, getDashboardProductLossTotal, getDashboardClientsCount, getProfessionalsWithSalary, getSalaryPayments } from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { processNumericRpc } from "@/lib/rpc-fallback";
import {
  DashboardStatsGrid,
  DashboardClientRanking,
  DashboardGoalsCard,
  DashboardTodayAppointments,
  DashboardNextAppointmentCard,
  DashboardLowStockCard,
} from "@/components/dashboard";

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
      const { data, error } = await getDashboardCommissionTotals({
        p_tenant_id: tenantId,
        p_is_admin: asAdmin,
        p_professional_user_id: asAdmin ? null : professionalUserId,
      });
      if (error) throw error;
      const result = data;
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
        const rows = Array.isArray(data) ? data : [];
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
        const rows = Array.isArray(data) ? data : [];
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
      const { data, error } = await getDashboardSalaryTotals({
        p_tenant_id: tenantId,
        p_is_admin: asAdmin,
        p_professional_user_id: asAdmin ? null : professionalUserId,
      });
      if (error) throw error;
      
      // Garantir que data seja um objeto válido
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid RPC response format");
      }
      
      const result = data as { pending?: number | string; paid?: number | string } | null;
      const p = Number(result?.pending ?? 0) || 0;
      const paid = Number(result?.paid ?? 0) || 0;
      return { pending: p, paid };
    } catch (error) {
      logger.error("Error fetching salary totals:", error);
      // Fallback: calcular manualmente
      if (asAdmin) {
        try {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          
          // Buscar profissionais com salário configurado
          const profResult = await supabase
            .from("professional_commissions")
            .select("user_id, salary_amount")
            .eq("tenant_id", tenantId)
            .eq("payment_type", "salary")
            .not("salary_amount", "is", null)
            .gt("salary_amount", 0) as { data: Array<{ user_id: string; salary_amount: number }> | null; error: any };
          const professionalsData = profResult.data;
          const profError = profResult.error;
          
          if (profError) throw profError;
          
          // Buscar salários pagos no mês (via RPC tipado)
          const paidResult = await getSalaryPayments({
            p_tenant_id: tenantId,
            p_professional_id: null,
            p_year: currentYear,
            p_month: currentMonth,
          });
          const paidSalaries = paidResult.data;
          const paidError = paidResult.error;
          
          if (paidError) throw paidError;
          
          const paidSalariesArray = Array.isArray(paidSalaries) ? paidSalaries : [];
          const professionalsDataArray = Array.isArray(professionalsData) ? professionalsData : [];
          const paidIds = new Set(paidSalariesArray.map((s: SalaryPaymentRow) => s.professional_id).filter(Boolean));
          const pending = professionalsDataArray
            .filter((p: { user_id: string; salary_amount: number }) => p.user_id && !paidIds.has(p.user_id))
            .reduce((sum: number, p: { user_id: string; salary_amount: number }) => sum + Number(p.salary_amount || 0), 0);
          const paid = paidSalariesArray
            .reduce((sum: number, s: SalaryPaymentRow) => sum + Number(s.amount || 0), 0);
          return { pending, paid };
        } catch (fallbackError) {
          logger.error("Error in salary totals fallback:", fallbackError);
          return { pending: 0, paid: 0 };
        }
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
        salaryTotalsResult,
        staffPerformanceResult,
        staffMyClientsResult,
        _professionalsWithSalaryResult,
        _salariesPaidResult,
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
        // 7. Perdas de produtos (baixas danificadas) do mês - usar processNumericRpc (Seção 2.3)
        isAdmin
          ? (async (): Promise<{ data: number; error: any }> => {
              const val = await processNumericRpc(
                await getDashboardProductLossTotal({
                  p_tenant_id: profile.tenant_id,
                  p_year: null,
                  p_month: null,
                }),
                async () => {
                  const { data: fallbackData } = await supabase
                    .from("stock_movements")
                    .select("quantity, product:products(cost)")
                    .eq("tenant_id", profile.tenant_id)
                    .eq("movement_type", "out")
                    .eq("out_reason_type", "damaged")
                    .gte("created_at", monthStart)
                    .lte("created_at", monthEnd);
                  if (fallbackData && Array.isArray(fallbackData)) {
                    return fallbackData.reduce((sum: number, m: { quantity?: number; product?: { cost?: number } }) => {
                      const qty = Math.abs(Number(m.quantity) || 0);
                      const cost = Number(m.product?.cost || 0);
                      return sum + (qty * cost);
                    }, 0);
                  }
                  return 0;
                },
                "product loss"
              );
              return { data: val, error: null };
            })()
          : Promise.resolve({ data: 0, error: null }),
        // 8. Total de clientes - usar processNumericRpc (Seção 2.3)
        (async (): Promise<{ data: number; error: any }> => {
          const val = await processNumericRpc(
            await getDashboardClientsCount({ p_tenant_id: profile.tenant_id }),
            async () => {
              const { count } = await supabase
                .from("clients")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", profile.tenant_id);
              return count ?? 0;
            },
            "clients count"
          );
          return { data: val, error: null };
        })(),
        // 9. Salários do mês (RPC similar ao de comissões)
        isAdmin
          ? fetchSalaryTotals(
              profile.tenant_id,
              isAdmin,
              null
            ).then((r) => ({ data: r, error: null }))
          : Promise.resolve({ data: { pending: 0, paid: 0 }, error: null }),
        // 10. Staff: desempenho do mês (serviços concluídos, valor gerado)
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
        // 11. Staff: clientes únicos que atendeu (distinct client_id dos seus agendamentos)
        !isAdmin && profile?.id
          ? supabase
              .from("appointments")
              .select("client_id")
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.id)
              .not("client_id", "is", null)
          : Promise.resolve({ data: null }),
        // 12. Admin: profissionais com salário fixo configurado (para calcular total a pagar)
        isAdmin
          ? getProfessionalsWithSalary({
              p_tenant_id: profile.tenant_id,
            })
          : Promise.resolve({ data: null }),
        // 13. Admin: salários pagos no mês
        isAdmin
          ? getSalaryPayments({
              p_tenant_id: profile.tenant_id,
              p_professional_id: null,
              p_year: new Date().getFullYear(),
              p_month: new Date().getMonth() + 1,
            })
          : Promise.resolve({ data: null }),
        // 14. Staff: configuração de salário fixo
        !isAdmin && profile?.user_id
          ? new Promise<{ data: { salary_amount?: number; payment_type?: string } | null; error: unknown }>((resolve) => {
              supabase
                .from("professional_commissions")
                .select("salary_amount, payment_type")
                .eq("tenant_id", profile.tenant_id)
                .eq("user_id", profile.user_id)
                .eq("payment_type", "salary")
                .maybeSingle()
                .then(
                  (r) => resolve({ data: r.data as { salary_amount?: number; payment_type?: string } | null, error: r.error }),
                  () => resolve({ data: null, error: null })
                );
            })
          : Promise.resolve({ data: null, error: null }),
        // 15. Staff: último pagamento de salário
        !isAdmin && profile?.user_id
          ? getSalaryPayments({
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
      // Perdas de produtos e clientes: processNumericRpc já aplica fallback (Seção 2.3)
      const productLossTotalValue = productLossesResult?.data ?? 0;
      const clientsCountResult = clientsResult?.data ?? 0;
      
      const staffPerformanceData = (staffPerformanceResult?.data || []) as { id: string; price: number }[];
      const staffMyClientsData = (staffMyClientsResult?.data || []) as { client_id: string }[];
      const mySalaryConfigData = mySalaryConfigResult?.data as { salary_amount: number } | null;
      const mySalaryPaymentsData = (mySalaryPaymentsResult?.data || []) as Array<{
        id: string;
        amount: number;
        status: string;
        payment_date: string | null;
      }>;

      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      if (financialData && Array.isArray(financialData)) {
        monthlyIncome = financialData
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        monthlyExpenses = financialData
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
      }

      let dailyIncome = 0;
      let dailyExpenses = 0;
      if (dailyFinancialData && Array.isArray(dailyFinancialData)) {
        dailyIncome = dailyFinancialData
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        dailyExpenses = dailyFinancialData
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
      }
      setDailyBalance(dailyIncome - dailyExpenses);

      // Perdas de produtos: já calculado pelo RPC (ou fallback) - garantir que seja número válido
      const validProductLoss = isNaN(productLossTotalValue) || productLossTotalValue < 0 ? 0 : productLossTotalValue;
      setProductLossTotal(validProductLoss);

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

      // Garantir que clientsCount seja um número válido e positivo
      const validClientsCount = isNaN(clientsCountResult) || clientsCountResult < 0 ? 0 : Math.floor(clientsCountResult);
      setClientsCount(validClientsCount);

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

      const apts = (appointmentsData as unknown as Appointment[]) || [];
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

      if (!isAdmin && Array.isArray(staffPerformanceData) && staffPerformanceData.length > 0) {
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
          logger.error("Error fetching ranking:", err);
        }
      }
    } catch (error) {
      logger.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar painel. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
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

  const getStatusBadge = useCallback((status: string) => {
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
  }, []);

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
        <DashboardStatsGrid
          isLoading={isLoading}
          isAdmin={isAdmin}
          dailyBalance={dailyBalance}
          monthlyBalance={stats.monthlyBalance}
          monthlyIncome={stats.monthlyIncome}
          monthlyExpenses={stats.monthlyExpenses}
          productLossTotal={productLossTotal}
          clientsCount={clientsCount}
          commissionsPending={commissionsPending}
          commissionsPaid={commissionsPaid}
          salariesToPay={salariesToPay}
          salariesPaid={salariesPaid}
          professionalCommissionsToReceive={professionalCommissionsToReceive}
          professionalCommissionsReceived={professionalCommissionsReceived}
          mySalaryAmount={mySalaryAmount}
          lastSalaryPayment={lastSalaryPayment}
          staffCompletedThisMonth={staffCompletedThisMonth}
          staffValueGeneratedThisMonth={staffValueGeneratedThisMonth}
          staffMyClientsCount={staffMyClientsCount}
          todayAppointments={stats.todayAppointments}
          pendingAppointments={stats.pendingAppointments}
          lowStockProducts={stats.lowStockProducts}
          formatCurrency={formatCurrency}
        />

        {isAdmin && (
          <DashboardClientRanking clientRanking={clientRanking} formatCurrency={formatCurrency} />
        )}

        {isAdmin && professionalGoalsRanking.length > 0 && (
          <DashboardGoalsCard
            professionalGoalsRanking={professionalGoalsRanking}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <DashboardTodayAppointments
            appointments={myTodayAppointments}
            isAdmin={isAdmin}
            getStatusBadge={getStatusBadge}
          />
          {!isAdmin && nextAppointment && (
            <DashboardNextAppointmentCard
              nextAppointment={nextAppointment}
              getStatusBadge={getStatusBadge}
            />
          )}
          {isAdmin && <DashboardLowStockCard lowStockProducts={lowStockProducts} />}
        </div>
      </div>
    </MainLayout>
  );
}
