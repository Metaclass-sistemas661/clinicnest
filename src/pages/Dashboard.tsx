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
import { Plus, Calendar, Users, Package, DollarSign, Wallet, CreditCard, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUp, ArrowDown, Activity, Stethoscope, TrendingUp, TrendingDown, Clock, Gift, Video, FileText, Star } from "lucide-react";
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
  DashboardTodayAppointments,
  DashboardNextAppointmentCard,
  DashboardLowStockCard,
} from "@/components/dashboard";

export default function Dashboard() {
  const { user, profile, tenant, isAdmin } = useAuth();
  const { enabled: simpleModeEnabled } = useSimpleMode(tenant?.id);
  const { markRefreshed } = useAppStatus();
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
  const [bannerSlide, setBannerSlide] = useState(0);

  // Auto-advance promotional banner carousel
  useEffect(() => {
    const t = setInterval(() => setBannerSlide((p) => (p + 1) % 4), 5000);
    return () => clearInterval(t);
  }, []);

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
        <div className="space-y-6">

          {/* ===== PROMOTIONAL BANNER CAROUSEL ===== */}
          <div className="relative overflow-hidden rounded-2xl shadow-xl">
            {/* Slide track */}
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${bannerSlide * 100}%)` }}
            >
              {/* SLIDE 0 — Indique e Ganhe */}
              <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-600 px-7 py-8 sm:px-10 sm:py-10 text-white">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-10 right-20 h-36 w-36 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute right-6 top-4 h-16 w-16 rounded-full bg-white/5" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
                      <Gift className="h-3.5 w-3.5" />
                      Programa de Indicação
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                      Indique e Ganhe <span className="text-yellow-300">R$50</span>
                    </h2>
                    <p className="text-sm sm:text-base text-violet-100 max-w-sm leading-relaxed">
                      Convide outra clínica ao ClinicNest e ganhe R$50 de desconto direto na sua próxima fatura!
                    </p>
                    <Link
                      to="/assinatura"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-violet-700 shadow-md transition-all hover:bg-yellow-300 hover:text-violet-900"
                    >
                      Quero indicar agora
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="hidden sm:flex shrink-0 h-28 w-28 items-center justify-center rounded-3xl bg-white/15 shadow-lg">
                    <Gift className="h-14 w-14 text-yellow-300 drop-shadow-md" />
                  </div>
                </div>
              </div>

              {/* SLIDE 1 — Teleconsulta */}
              <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-7 py-8 sm:px-10 sm:py-10 text-white">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-10 right-20 h-36 w-36 rounded-full bg-white/5" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
                      <Video className="h-3.5 w-3.5" />
                      Funcionalidade Premium
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                      Teleconsulta <span className="text-cyan-200">Integrada</span>
                    </h2>
                    <p className="text-sm sm:text-base text-blue-100 max-w-sm leading-relaxed">
                      Atenda seus pacientes remotamente com segurança, praticidade e rastreabilidade — tudo no ClinicNest.
                    </p>
                    <Link
                      to="/agenda"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow-md transition-all hover:bg-cyan-200 hover:text-blue-900"
                    >
                      Agendar teleconsulta
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="hidden sm:flex shrink-0 h-28 w-28 items-center justify-center rounded-3xl bg-white/15 shadow-lg">
                    <Video className="h-14 w-14 text-cyan-200 drop-shadow-md" />
                  </div>
                </div>
              </div>

              {/* SLIDE 2 — Prontuário Digital */}
              <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-7 py-8 sm:px-10 sm:py-10 text-white">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-10 right-20 h-36 w-36 rounded-full bg-white/5" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
                      <FileText className="h-3.5 w-3.5" />
                      Em Destaque
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                      Prontuário <span className="text-emerald-200">Digital</span>
                    </h2>
                    <p className="text-sm sm:text-base text-emerald-100 max-w-sm leading-relaxed">
                      Anamneses, prescrições e histórico completo do paciente — seguro, organizado e em conformidade com a LGPD.
                    </p>
                    <Link
                      to="/prontuarios"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-md transition-all hover:bg-emerald-200 hover:text-emerald-900"
                    >
                      Acessar prontuários
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="hidden sm:flex shrink-0 h-28 w-28 items-center justify-center rounded-3xl bg-white/15 shadow-lg">
                    <FileText className="h-14 w-14 text-emerald-200 drop-shadow-md" />
                  </div>
                </div>
              </div>

              {/* SLIDE 3 — ClinicNest Premium */}
              <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-600 px-7 py-8 sm:px-10 sm:py-10 text-white">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 opacity-[0.06]">
                  <svg width="150" height="150" viewBox="0 0 120 120" fill="currentColor">
                    <path d="M50 0h20v50h50v20H70v50H50V70H0V50h50V0z"/>
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
                      <Star className="h-3.5 w-3.5" />
                      ClinicNest Premium
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                      Gestão clínica <span className="text-cyan-200">completa</span>
                    </h2>
                    <p className="text-sm sm:text-base text-teal-100 max-w-sm leading-relaxed">
                      Agenda, financeiro, estoque, equipe e prontuários integrados — tudo que sua clínica precisa para crescer.
                    </p>
                    <Link
                      to="/assinatura"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-teal-700 shadow-md transition-all hover:bg-teal-100 hover:text-teal-900"
                    >
                      Ver planos
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="hidden sm:flex shrink-0 h-28 w-28 items-center justify-center rounded-3xl bg-white/15 shadow-lg">
                    <Stethoscope className="h-14 w-14 text-cyan-200 drop-shadow-md" />
                  </div>
                </div>
              </div>
            </div>

            {/* Prev arrow */}
            <button
              onClick={() => setBannerSlide((p) => (p - 1 + 4) % 4)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-all hover:bg-black/45"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Next arrow */}
            <button
              onClick={() => setBannerSlide((p) => (p + 1) % 4)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-all hover:bg-black/45"
              aria-label="Próximo banner"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Navigation dots */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  onClick={() => setBannerSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerSlide ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                  aria-label={`Ir para banner ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ===== KPI METRICS GRID ===== */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Consultas hoje */}
            <Link to="/agenda" data-tour="dashboard-today-stat-appointments" className="[&:hover]:no-underline">
              <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-teal-200 hover:shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                    <Calendar className="h-5 w-5 text-teal-600" />
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">Hoje</span>
                </div>
                <p className="text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : stats.todayAppointments}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Consultas agendadas</p>
              </div>
            </Link>

            {/* Pendentes */}
            <Link to="/agenda" data-tour="dashboard-today-stat-pending" className="[&:hover]:no-underline">
              <div className={`group rounded-2xl border p-5 transition-all hover:shadow-md ${stats.pendingAppointments > 0 ? "border-amber-200 bg-amber-50" : "bg-card"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stats.pendingAppointments > 0 ? "bg-amber-100" : "bg-muted/50"}`}>
                    <Clock className={`h-5 w-5 ${stats.pendingAppointments > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                  </div>
                  {stats.pendingAppointments > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Atenção</span>
                  )}
                </div>
                <p className={`text-3xl font-extrabold tabular-nums leading-none ${stats.pendingAppointments > 0 ? "text-amber-700" : ""}`}>
                  {isLoading ? "—" : stats.pendingAppointments}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">Pendentes de confirmação</p>
              </div>
            </Link>

            {/* Receita do mês (admin) / Atendimentos do mês (staff) */}
            {isAdmin ? (
              <Link to="/financeiro" data-tour="dashboard-monthly-income" className="[&:hover]:no-underline">
                <div className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition-all hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Mês</span>
                  </div>
                  <p className="text-2xl font-extrabold tabular-nums leading-none text-emerald-700">{isLoading ? "—" : formatCurrency(stats.monthlyIncome)}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Receita do mês</p>
                </div>
              </Link>
            ) : (
              <Link to="/minhas-comissoes" data-tour="dashboard-insights-my-performance" className="[&:hover]:no-underline">
                <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-teal-200 hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                      <Activity className="h-5 w-5 text-teal-600" />
                    </div>
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">Mês</span>
                  </div>
                  <p className="text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : staffCompletedThisMonth}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Atendimentos no mês</p>
                </div>
              </Link>
            )}

            {/* Pacientes (admin) / Pacientes meus (staff) */}
            {isAdmin ? (
              <Link to="/clientes" data-tour="dashboard-insights-clients" className="[&:hover]:no-underline">
                <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-blue-200 hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Total</span>
                  </div>
                  <p className="text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : clientsCount}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Pacientes cadastrados</p>
                </div>
              </Link>
            ) : (
              <div data-tour="dashboard-insights-my-clients" className="rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Meus</span>
                </div>
                <p className="text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : (staffMyClientsCount ?? 0)}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Pacientes atendidos</p>
              </div>
            )}
          </div>

          {/* ===== ORDERED SECTIONS ===== */}
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
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
                          <Activity className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">Atividade recente</CardTitle>
                          <CardDescription className="text-xs">Últimas ações registradas na clínica</CardDescription>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                          {activityOpen ? (
                            <>Ocultar <ChevronUp className="ml-2 h-4 w-4" /></>
                          ) : (
                            <>Ver <ChevronDown className="ml-2 h-4 w-4" /></>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {activityLoading ? (
                          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                            Carregando atividades...
                          </div>
                        ) : activityRows.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Sem atividades recentes.
                          </div>
                        ) : (
                          <div className="relative pl-5">
                            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
                            {activityRows.map((r) => {
                              const et = r.entity_type ?? "";
                              const dotColor =
                                et === "appointment" ? "bg-teal-500" :
                                et === "client" ? "bg-blue-500" :
                                et.includes("financial") ? "bg-emerald-500" :
                                et === "product" ? "bg-amber-500" :
                                et.includes("commission") ? "bg-orange-500" :
                                (et.includes("subscription") || et.includes("checkout")) ? "bg-purple-500" :
                                "bg-gray-400";
                              const actionLabel = r.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                              return (
                                <div key={r.id} className="group relative flex gap-3 py-2">
                                  <div className={`absolute -left-3.5 z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-background shadow-sm ${dotColor}`} />
                                  <div className="min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors group-hover:bg-muted/40">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-sm font-medium">{actionLabel}</p>
                                      <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                                        {formatInAppTz(new Date(r.created_at), "dd/MM HH:mm")}
                                      </p>
                                    </div>
                                    {r.entity_type && (
                                      <p className="truncate text-xs text-muted-foreground">{r.entity_type}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700">
                            <Link to="/auditoria">Ver auditoria completa →</Link>
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
                <div key={sectionKey} className="grid gap-4 md:gap-6 lg:grid-cols-3">
                  {/* Agenda: 2/3 width */}
                  <div className="lg:col-span-2">
                    <DashboardTodayAppointments
                      appointments={myTodayAppointments}
                      isAdmin={isAdmin}
                      getStatusBadge={getStatusBadge}
                    />
                  </div>
                  {/* Right panel: 1/3 width */}
                  <div className="space-y-4">
                    {!isAdmin && nextAppointment && (
                      <DashboardNextAppointmentCard nextAppointment={nextAppointment} getStatusBadge={getStatusBadge} />
                    )}
                    {isAdmin && <DashboardLowStockCard lowStockProducts={lowStockProducts} />}
                  </div>
                </div>
              );
            }

            if (sectionKey === "month") {
              return (
                <Card key={sectionKey}>
                  <CardHeader className="flex flex-row items-center gap-2 pb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
                      <Activity className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Financeiro do mês</CardTitle>
                      <CardDescription className="text-xs">{formatInAppTz(new Date(), "MMMM 'de' yyyy")}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Admin: 3 hero financial cards */}
                    {isAdmin && (
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-income">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 transition-all hover:border-emerald-300 hover:shadow-md">
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                              </div>
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Entradas</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.monthlyIncome)}</p>
                            <p className="mt-1 text-sm text-emerald-600/70">Receitas do mês</p>
                          </div>
                        </Link>
                        <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-expenses">
                          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 transition-all hover:border-red-300 hover:shadow-md">
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                              </div>
                              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Saídas</span>
                            </div>
                            <p className="text-2xl font-bold text-red-700">{formatCurrency(stats.monthlyExpenses)}</p>
                            <p className="mt-1 text-sm text-red-600/70">Despesas do mês</p>
                          </div>
                        </Link>
                        <Link to="/financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-balance">
                          <div className={`rounded-2xl border p-5 transition-all hover:shadow-md ${stats.monthlyBalance >= 0 ? "border-teal-200 bg-teal-50 hover:border-teal-300" : "border-red-200 bg-red-50 hover:border-red-300"}`}>
                            <div className="mb-4 flex items-center justify-between">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stats.monthlyBalance >= 0 ? "bg-teal-100" : "bg-red-100"}`}>
                                <DollarSign className={`h-5 w-5 ${stats.monthlyBalance >= 0 ? "text-teal-600" : "text-red-600"}`} />
                              </div>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stats.monthlyBalance >= 0 ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700"}`}>Saldo</span>
                            </div>
                            <p className={`text-2xl font-bold ${stats.monthlyBalance >= 0 ? "text-teal-700" : "text-red-700"}`}>{formatCurrency(stats.monthlyBalance)}</p>
                            <p className={`mt-1 text-sm ${stats.monthlyBalance >= 0 ? "text-teal-600/70" : "text-red-600/70"}`}>Resultado do mês</p>
                          </div>
                        </Link>
                      </div>
                    )}

                    {/* Secondary stats */}
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                      {isAdmin && !simpleModeEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to="/financeiro?tab=commissions" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-commissions-pending">
                              <StatCard title="Comissões pendentes" value={formatCurrency(commissionsPending)} icon={Wallet} variant={commissionsPending > 0 ? "warning" : "default"} description="Clique para gerenciar" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Comissões geradas no mês e ainda não pagas.</TooltipContent>
                        </Tooltip>
                      )}
                      {isAdmin && !simpleModeEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to="/financeiro?tab=salaries" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-salaries-pending">
                              <StatCard title="Salários a pagar" value={formatCurrency(salariesToPay)} icon={CreditCard} variant={salariesToPay > 0 ? "warning" : "default"} description="Clique para gerenciar" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Salários configurados que ainda não foram pagos no mês.</TooltipContent>
                        </Tooltip>
                      )}
                      {!isAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to="/minhas-comissoes" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-my-commissions">
                              <StatCard title="Minhas comissões (pendentes)" value={formatCurrency(professionalCommissionsToReceive)} icon={Wallet} variant={professionalCommissionsToReceive > 0 ? "warning" : "default"} description="Clique para ver detalhes" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Comissões do mês que ainda não foram pagas para você.</TooltipContent>
                        </Tooltip>
                      )}
                      {!isAdmin && mySalaryAmount !== null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to="/meus-salarios" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-my-salary">
                              <StatCard title="Meu salário" value={formatCurrency(mySalaryAmount)} icon={DollarSign} variant="info" description={lastSalaryPayment ? `Último pagamento: ${formatInAppTz(lastSalaryPayment.date || "", "dd/MM/yyyy")}` : "Salário fixo configurado"} />
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
                    month: "Financeiro do mês",
                    activity_feed: "Atividade recente",
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
