import { useEffect, useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStatus } from "@/contexts/AppStatusContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar, Users, Package, DollarSign, Wallet, CreditCard, ChevronDown, ChevronUp, SlidersHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, addDays } from "date-fns";
import { APP_TIMEZONE, formatInAppTz } from "@/lib/date";
import { fromZonedTime } from "date-fns-tz";
import { fetchClientSpendingByPeriod } from "@/lib/clientSpending";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { DashboardStats, Appointment, Product } from "@/types/database";
import type { SalaryPaymentRow } from "@/types/supabase-extensions";
import {
  getDashboardSalaryTotals,
  getDashboardCommissionTotals,
  getDashboardProductLossTotal,
  getDashboardClientsCount,
  getOpenCashSessionSummaryV1,
  getProfessionalsWithSalary,
  getSalaryPayments,
} from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { processNumericRpc } from "@/lib/rpc-fallback";
import { useSimpleMode } from "@/lib/simple-mode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  defaultDashboardPreferences,
  getDashboardPreferences,
  normalizeDashboardPreferences,
  setDashboardPreferences,
  type DashboardPreferences,
  type DashboardSectionKey,
} from "@/lib/dashboard-preferences";
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
  const { enabled: simpleModeEnabled } = useSimpleMode(tenant?.id);
  const { markRefreshed } = useAppStatus();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityRows, setActivityRows] = useState<
    Array<{
      id: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      actor_user_id: string | null;
      created_at: string;
    }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dashboardPrefs, setDashboardPrefsState] = useState<DashboardPreferences>(() =>
    defaultDashboardPreferences(Boolean(isAdmin))
  );
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
    if (!profile?.tenant_id) return;

    const prefetch = () => {
      void import("@/pages/Agenda");
      void import("@/pages/Produtos");
      void import("@/pages/Servicos");
      void import("@/pages/Clientes");
      void import("@/pages/Notificacoes");
      void import("@/pages/MinhasConfiguracoes");

      if (isAdmin) {
        void import("@/pages/Financeiro");
        void import("@/pages/Equipe");
        void import("@/pages/Configuracoes");
        void import("@/pages/Assinatura");
        void import("@/pages/Metas");
      } else {
        void import("@/pages/MinhasComissoes");
        void import("@/pages/MeusSalarios");
        void import("@/pages/MinhasMetas");
      }

      return undefined;
    };

    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(prefetch, { timeout: 800 });
      return () => (window as any).cancelIdleCallback?.(id);
    }

    const t = window.setTimeout(prefetch, 0);
    return () => window.clearTimeout(t);
  }, [profile?.tenant_id, isAdmin]);

  const fetchActivityFeed = useCallback(async () => {
    if (!isAdmin || simpleModeEnabled || !profile?.tenant_id) return;
    setActivityLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,entity_type,entity_id,actor_user_id,created_at")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setActivityRows((Array.isArray(data) ? (data as any[]) : []) as any);
    } catch (e) {
      logger.error("Error fetching activity feed:", e);
    } finally {
      setActivityLoading(false);
    }
  }, [isAdmin, simpleModeEnabled, profile?.tenant_id]);

  useEffect(() => {
    if (!isAdmin || simpleModeEnabled) return;
    fetchActivityFeed();
  }, [isAdmin, simpleModeEnabled, fetchActivityFeed]);

  const persistPrefs = useCallback(
    (next: DashboardPreferences) => {
      const tenantId = tenant?.id ?? profile?.tenant_id ?? null;
      const userId = user?.id ?? null;
      setDashboardPreferences(tenantId, userId, next);
      setDashboardPrefsState(next);
    },
    [tenant?.id, profile?.tenant_id, user?.id]
  );

  const moveSection = useCallback(
    (key: DashboardSectionKey, dir: "up" | "down") => {
      const idx = dashboardPrefs.order.indexOf(key);
      if (idx < 0) return;
      const next = [...dashboardPrefs.order];
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return;
      const tmp = next[idx];
      next[idx] = next[swapWith];
      next[swapWith] = tmp;
      persistPrefs({ ...dashboardPrefs, order: next });
    },
    [dashboardPrefs, persistPrefs]
  );

  const toggleSection = useCallback(
    (key: DashboardSectionKey, hidden: boolean) => {
      persistPrefs({
        ...dashboardPrefs,
        hidden: {
          ...dashboardPrefs.hidden,
          [key]: hidden,
        },
      });
    },
    [dashboardPrefs, persistPrefs]
  );

  useEffect(() => {
    const hasStaffId = profile?.user_id ?? user?.id;
    if (profile?.tenant_id && (isAdmin || (hasStaffId && profile?.id))) {
      fetchDashboardData();
    }
  }, [profile?.tenant_id, profile?.user_id, profile?.id, user?.id, isAdmin]);

  const availableSections = useMemo(() => {
    const keys: DashboardSectionKey[] = ["quick_actions", "today", "month"];
    if (isAdmin && !simpleModeEnabled) keys.push("activity_feed");
    if (!simpleModeEnabled) keys.push("insights");
    return keys;
  }, [isAdmin, simpleModeEnabled]);

  useEffect(() => {
    const tenantId = tenant?.id ?? profile?.tenant_id ?? null;
    const userId = user?.id ?? null;
    const base = getDashboardPreferences(tenantId, userId) ?? defaultDashboardPreferences(Boolean(isAdmin));
    const normalized = normalizeDashboardPreferences(base, availableSections);
    setDashboardPrefsState(normalized);
  }, [tenant?.id, profile?.tenant_id, user?.id, isAdmin, availableSections]);

  // Refetch quando o usuário volta para a página (ex.: após marcar comissão como paga no Financeiro)
  useEffect(() => {
    const onFocus = () => {
      if (profile?.tenant_id) fetchDashboardData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (simpleModeEnabled) setInsightsOpen(false);
  }, [simpleModeEnabled]);

  // Garantir que o "Saldo do Dia" zere à meia-noite, mesmo com a página aberta.
  // Sem isso, o card pode ficar mostrando o dia anterior até o usuário dar refresh ou mudar de página.
  useEffect(() => {
    const hasStaffId = profile?.user_id ?? user?.id;
    const canFetch = profile?.tenant_id && (isAdmin || (hasStaffId && profile?.id));
    if (!canFetch) return;

    let timeoutId: number | undefined;

    const schedule = () => {
      const now = new Date();
      const tomorrowStr = formatInAppTz(addDays(now, 1), "yyyy-MM-dd");
      const nextMidnight = fromZonedTime(`${tomorrowStr}T00:00:00`, APP_TIMEZONE);
      const ms = nextMidnight.getTime() - now.getTime();

      timeoutId = window.setTimeout(() => {
        fetchDashboardData();
        schedule();
      }, Math.max(1000, ms));
    };

    schedule();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [profile?.tenant_id, profile?.user_id, profile?.id, user?.id, isAdmin]);

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

    let didSucceed = false;
    try {
      // Disparar todas as buscas em paralelo (em vez de uma após a outra)
      const [
        financialResult,
        dailyFinancialResult,
        openCashSummaryResult,
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
        // 2b. Caixa aberto (admin) - saldo do dia baseado no caixa
        isAdmin ? getOpenCashSessionSummaryV1() : Promise.resolve({ data: null, error: null }),
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

      const openCashData = openCashSummaryResult?.data as
        | { has_open_session?: boolean; expected_closing_balance?: number }
        | null
        | undefined;
      const hasOpenSession = Boolean(openCashData?.has_open_session);
      const cashExpected = Number(openCashData?.expected_closing_balance ?? 0);

      // "Saldo do Dia" deve refletir o movimento do dia (transações financeiras),
      // independentemente de ter caixa aberto (que depende de payments).
      setDailyBalance(isAdmin ? dailyIncome - dailyExpenses : 0);

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

      didSucceed = true;
    } catch (error) {
      logger.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar painel. Tente novamente.");
    } finally {
      setIsLoading(false);
      if (didSucceed) markRefreshed("dashboard");
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
      subtitle={`Bem-vindo ao ${tenant?.name || "ClinicNest"}`}
      actions={
        <Button asChild className="gradient-primary text-primary-foreground text-sm md:text-base">
          <Link to="/agenda" data-tour="dashboard-new-appointment">
            <Plus className="mr-1 md:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo agendamento</span>
            <span className="sm:hidden">Agendar</span>
          </Link>
        </Button>
      }
    >
      <TooltipProvider>
        <div className="space-y-8">
          {dashboardPrefs.order.map((sectionKey) => {
            if (!availableSections.includes(sectionKey)) return null;
            if (dashboardPrefs.hidden?.[sectionKey]) return null;

            if (sectionKey === "quick_actions") {
              return (
                <Card key={sectionKey}>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Ações rápidas</CardTitle>
                      <CardDescription>Atalhos para o que você mais faz no dia a dia</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => setPrefsOpen(true)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Personalizar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                      <Button asChild variant="outline" className="justify-start">
                        <Link to="/agenda" data-tour="dashboard-quick-new-appointment">
                          <Calendar className="mr-2 h-4 w-4" />
                          Novo agendamento
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="justify-start">
                        <Link to="/clientes" data-tour="dashboard-quick-new-client">
                          <Users className="mr-2 h-4 w-4" />
                          Novo cliente
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="justify-start">
                        <Link to="/produtos" data-tour="dashboard-quick-stock">
                          <Package className="mr-2 h-4 w-4" />
                          Movimentar estoque
                        </Link>
                      </Button>
                      {isAdmin && !simpleModeEnabled && (
                        <Button asChild variant="outline" className="justify-start">
                          <Link to="/financeiro?tab=transactions" data-tour="dashboard-quick-new-transaction">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Nova transação
                          </Link>
                        </Button>
                      )}
                      {isAdmin && !simpleModeEnabled && (
                        <Button asChild variant="outline" className="justify-start">
                          <Link to="/financeiro?tab=commissions" data-tour="dashboard-quick-pay-commissions">
                            <Wallet className="mr-2 h-4 w-4" />
                            Comissões
                            {commissionsPending > 0 ? (
                              <span className="ml-2 inline-flex items-center rounded-md bg-warning/20 px-2 py-0.5 text-xs text-warning">
                                {Math.round(commissionsPending)}
                              </span>
                            ) : null}
                          </Link>
                        </Button>
                      )}
                      {isAdmin && !simpleModeEnabled && (
                        <Button asChild variant="outline" className="justify-start">
                          <Link to="/financeiro?tab=salaries" data-tour="dashboard-quick-pay-salaries">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Salários
                            {salariesToPay > 0 ? (
                              <span className="ml-2 inline-flex items-center rounded-md bg-warning/20 px-2 py-0.5 text-xs text-warning">
                                {Math.round(salariesToPay)}
                              </span>
                            ) : null}
                          </Link>
                        </Button>
                      )}
                      {!isAdmin && (
                        <Button asChild variant="outline" className="justify-start">
                          <Link to="/minhas-comissoes" data-tour="dashboard-quick-my-commissions">
                            <Wallet className="mr-2 h-4 w-4" />
                            Minhas comissões
                          </Link>
                        </Button>
                      )}
                      {!isAdmin && (
                        <Button asChild variant="outline" className="justify-start">
                          <Link to="/meus-salarios" data-tour="dashboard-quick-my-salary">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Meu salário
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (sectionKey === "activity_feed") {
              return (
                <Collapsible
                  key={sectionKey}
                  open={activityOpen}
                  onOpenChange={(o) => {
                    setActivityOpen(o);
                    if (o) fetchActivityFeed();
                  }}
                >
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Atividade</CardTitle>
                        <CardDescription>Últimas ações registradas</CardDescription>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                          {activityOpen ? (
                            <>
                              Ocultar <ChevronUp className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Ver <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-2">
                        {activityLoading ? (
                          <div className="text-sm text-muted-foreground">Carregando...</div>
                        ) : activityRows.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem atividades recentes.</div>
                        ) : (
                          <div className="space-y-2">
                            {activityRows.map((r) => (
                              <div key={r.id} className="rounded-lg border border-border/70 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{r.action}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(r.entity_type ?? "").toString()}
                                      {r.entity_id ? ` (${String(r.entity_id).slice(0, 8)}...)` : ""}
                                    </p>
                                  </div>
                                  <p className="whitespace-nowrap text-xs text-muted-foreground">
                                    {formatInAppTz(new Date(r.created_at), "dd/MM HH:mm")}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to="/auditoria">Ver auditoria</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            }

            if (sectionKey === "today") {
              return (
                <Card key={sectionKey}>
                  <CardHeader>
                    <CardTitle className="text-lg">Hoje</CardTitle>
                    <CardDescription>{formatInAppTz(new Date(), "EEEE, d 'de' MMMM")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="dashboard-today-stat-appointments">
                    <StatCard title="Agendamentos" value={stats.todayAppointments} icon={Calendar} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Total de agendamentos marcados para hoje.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="dashboard-today-stat-pending">
                    <StatCard
                      title={isAdmin ? "Pendentes" : "Meus pendentes"}
                      value={stats.pendingAppointments}
                      icon={Wallet}
                      variant={stats.pendingAppointments > 0 ? "warning" : "default"}
                      description={isAdmin ? "Aguardando confirmação" : "Aguardando confirmação do admin"}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Agendamentos que ainda não foram confirmados.</TooltipContent>
              </Tooltip>
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div data-tour="dashboard-today-stat-low-stock">
                      <StatCard
                        title="Estoque baixo"
                        value={stats.lowStockProducts}
                        icon={Package}
                        variant={stats.lowStockProducts > 0 ? "warning" : "default"}
                        description="Produtos abaixo do mínimo"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Produtos abaixo do estoque mínimo configurado.</TooltipContent>
                </Tooltip>
              )}
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div data-tour="dashboard-today-stat-daily-balance">
                      <StatCard
                        title="Saldo do dia"
                        value={formatCurrency(dailyBalance)}
                        icon={DollarSign}
                        variant={dailyBalance >= 0 ? "success" : "danger"}
                        description="Zera à meia-noite"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Saldo do dia = receitas - despesas registradas hoje.</TooltipContent>
                </Tooltip>
              )}
                    </div>

                    <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              <DashboardTodayAppointments
                appointments={myTodayAppointments}
                isAdmin={isAdmin}
                getStatusBadge={getStatusBadge}
              />
              {!isAdmin && nextAppointment && (
                <DashboardNextAppointmentCard nextAppointment={nextAppointment} getStatusBadge={getStatusBadge} />
              )}
              {isAdmin && <DashboardLowStockCard lowStockProducts={lowStockProducts} />}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (sectionKey === "month") {
              return (
                <Card key={sectionKey}>
                  <CardHeader>
                    <CardTitle className="text-lg">Mês atual</CardTitle>
                    <CardDescription>{formatInAppTz(new Date(), "MMMM 'de' yyyy")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-balance">
                    <StatCard
                      title="Saldo do mês"
                      value={formatCurrency(stats.monthlyBalance)}
                      icon={DollarSign}
                      variant={stats.monthlyBalance >= 0 ? "success" : "danger"}
                      description="Receitas - despesas"
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">Saldo do mês = receitas - despesas do mês atual.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-income">
                    <StatCard title="Receitas" value={formatCurrency(stats.monthlyIncome)} icon={DollarSign} variant="success" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">Soma das entradas (receitas) no mês atual.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-expenses">
                    <StatCard title="Despesas" value={formatCurrency(stats.monthlyExpenses)} icon={DollarSign} variant="danger" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">Soma das saídas (despesas) no mês atual.</TooltipContent>
              </Tooltip>
              {isAdmin && !simpleModeEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/financeiro?tab=commissions" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-commissions-pending">
                      <StatCard
                        title="Comissões pendentes"
                        value={formatCurrency(commissionsPending)}
                        icon={Wallet}
                        variant={commissionsPending > 0 ? "warning" : "default"}
                        description="Clique para gerenciar"
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Comissões geradas no mês e ainda não pagas.</TooltipContent>
                </Tooltip>
              )}
              {isAdmin && !simpleModeEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/financeiro?tab=salaries" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-salaries-pending">
                      <StatCard
                        title="Salários a pagar"
                        value={formatCurrency(salariesToPay)}
                        icon={CreditCard}
                        variant={salariesToPay > 0 ? "warning" : "default"}
                        description="Clique para gerenciar"
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Salários configurados que ainda não foram pagos no mês.</TooltipContent>
                </Tooltip>
              )}
              {!isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/minhas-comissoes" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-my-commissions">
                      <StatCard
                        title="Minhas comissões (pendentes)"
                        value={formatCurrency(professionalCommissionsToReceive)}
                        icon={Wallet}
                        variant={professionalCommissionsToReceive > 0 ? "warning" : "default"}
                        description="Clique para ver detalhes"
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Comissões do mês que ainda não foram pagas para você.</TooltipContent>
                </Tooltip>
              )}
              {!isAdmin && mySalaryAmount !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/meus-salarios" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-my-salary">
                      <StatCard
                        title="Meu salário"
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
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Seu salário configurado + histórico de pagamento.</TooltipContent>
                </Tooltip>
              )}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (sectionKey === "insights") {
              if (simpleModeEnabled) return null;
              return (
                <Collapsible key={sectionKey} open={insightsOpen} onOpenChange={setInsightsOpen}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Insights</CardTitle>
                        <CardDescription>Otimizações, rankings e indicadores detalhados</CardDescription>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" data-tour="dashboard-insights-toggle">
                          {insightsOpen ? (
                            <>
                              Ocultar <ChevronUp className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Ver insights <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-6">
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    {isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to="/produtos" className="block [&:hover]:no-underline" data-tour="dashboard-insights-product-loss">
                            <StatCard
                              title="Perdas (danificados)"
                              value={formatCurrency(productLossTotal)}
                              icon={Package}
                              variant={productLossTotal > 0 ? "warning" : "default"}
                              description="Total no mês"
                            />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Total de baixas danificadas registradas no mês.</TooltipContent>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to="/clientes" className="block [&:hover]:no-underline" data-tour="dashboard-insights-clients">
                            <StatCard
                              title="Clientes cadastrados"
                              value={clientsCount}
                              icon={Users}
                              description="Total da clínica"
                            />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Quantidade total de clientes cadastrados.</TooltipContent>
                      </Tooltip>
                    )}
                    {!isAdmin && (
                      <div data-tour="dashboard-insights-my-performance">
                        <StatCard
                          title="Meu desempenho"
                          value={staffCompletedThisMonth}
                          icon={Calendar}
                          description={`${formatCurrency(staffValueGeneratedThisMonth)} gerados no mês`}
                        />
                      </div>
                    )}
                    {!isAdmin && (
                      <div data-tour="dashboard-insights-my-clients">
                        <StatCard
                          title="Clientes que atendi"
                          value={staffMyClientsCount ?? 0}
                          icon={Users}
                          description="Clientes únicos no mês"
                        />
                      </div>
                    )}
                        </div>

                        {isAdmin && (
                          <DashboardClientRanking clientRanking={clientRanking} formatCurrency={formatCurrency} />
                        )}

                        {isAdmin && professionalGoalsRanking.length > 0 && (
                          <DashboardGoalsCard professionalGoalsRanking={professionalGoalsRanking} formatCurrency={formatCurrency} />
                        )}

                        <div data-tour="dashboard-insights-all-kpis">
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
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            }

            return null;
          })}
        </div>

        <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Personalizar Dashboard</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {dashboardPrefs.order
                .filter((k) => availableSections.includes(k))
                .map((key) => {
                  const isHidden = Boolean(dashboardPrefs.hidden?.[key]);
                  const idx = dashboardPrefs.order.indexOf(key);
                  const canUp = idx > 0;
                  const canDown = idx >= 0 && idx < dashboardPrefs.order.length - 1;

                  const labelByKey: Record<DashboardSectionKey, string> = {
                    quick_actions: "Ações rápidas",
                    today: "Hoje",
                    month: "Mês atual",
                    activity_feed: "Atividade",
                    insights: "Insights",
                  };

                  return (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{labelByKey[key] ?? key}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Switch checked={!isHidden} onCheckedChange={(checked) => toggleSection(key, !checked)} />
                        </div>
                        <Button variant="outline" size="icon" disabled={!canUp} onClick={() => moveSection(key, "up")}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" disabled={!canDown} onClick={() => moveSection(key, "down")}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </MainLayout>
  );
}
