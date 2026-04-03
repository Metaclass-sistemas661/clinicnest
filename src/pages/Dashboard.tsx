import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
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
import { Plus, Calendar, Users, Package, DollarSign, Wallet, CreditCard, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUp, ArrowDown, Activity, Stethoscope, TrendingUp, TrendingDown, Clock, Gift, Video, FileText, Star, Sparkles, Brain, MessageSquare, Shield, Crown, UserCheck, BarChart3, Zap } from "lucide-react";
import { InteractiveBody } from "@/components/dashboard/InteractiveBody";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell } from "recharts";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, addDays, subMonths, addMonths, getDay, isSameMonth, isSameDay, isToday as isDateToday, eachDayOfInterval, format as fnsFormat } from "date-fns";
import { APP_TIMEZONE, formatInAppTz } from "@/lib/date";
import { fromZonedTime } from "date-fns-tz";
import { fetchPatientSpendingByPeriod } from "@/lib/patientSpending";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import type { DashboardStats, Appointment, Product } from "@/types/database";
import {
  getDashboardCommissionTotals,
  getDashboardProductLossTotal,
  getDashboardPatientsCount,
  getOpenCashSessionSummaryV1,
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

// Lazy load dashboard variants per professional type
const DashboardMedico = lazy(() => import("@/components/dashboard/DashboardMedico").then(m => ({ default: m.DashboardMedico })));
const DashboardSecretaria = lazy(() => import("@/components/dashboard/DashboardSecretaria").then(m => ({ default: m.DashboardSecretaria })));
const DashboardEnfermeiro = lazy(() => import("@/components/dashboard/DashboardEnfermeiro").then(m => ({ default: m.DashboardEnfermeiro })));
const DashboardFaturista = lazy(() => import("@/components/dashboard/DashboardFaturista").then(m => ({ default: m.DashboardFaturista })));
const DashboardClinico = lazy(() => import("@/components/dashboard/DashboardClinico").then(m => ({ default: m.DashboardClinico })));
const DashboardDentista = lazy(() => import("@/components/dashboard/DashboardDentista").then(m => ({ default: m.DashboardDentista })));
const DashboardEstetica = lazy(() => import("@/components/dashboard/DashboardEstetica").then(m => ({ default: m.DashboardEstetica })));
import { usePermissions } from "@/hooks/usePermissions";
import type { ProfessionalType } from "@/types/database";
import { PROFESSIONAL_TYPE_LABELS } from "@/types/database";
import { RbacWizard } from "@/components/admin/RbacWizard";

function getDashboardForType(pType: ProfessionalType): React.ComponentType | null {
  switch (pType) {
    case 'medico':
      return DashboardMedico;
    case 'dentista':
      return DashboardDentista;
    case 'secretaria':
      return DashboardSecretaria;
    case 'enfermeiro':
    case 'tec_enfermagem':
      return DashboardEnfermeiro;
    case 'faturista':
      return DashboardFaturista;
    case 'fisioterapeuta':
    case 'nutricionista':
    case 'psicologo':
    case 'fonoaudiologo':
      return DashboardClinico;
    case 'esteticista':
      return DashboardEstetica;
    default:
      return null;
  }
}

export default function Dashboard() {
  const { user, profile, tenant, isAdmin } = useAuth();
  const { professionalType } = usePermissions();
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
  const [rbacWizardOpen, setRbacWizardOpen] = useState(false);
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
  const [pendingTriages, setPendingTriages] = useState<Array<{
    id: string; client_name: string; priority: string; chief_complaint: string; triaged_at: string; appointment_id: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyBalance, setDailyBalance] = useState(0);
  const [productLossTotal, setProductLossTotal] = useState(0);
  const [patientsCount, setPatientsCount] = useState(0);
  const [staffMyPatientsCount, setStaffMyPatientsCount] = useState<number | null>(null);
  const [professionalCommissionsToReceive, setProfessionalCommissionsToReceive] = useState(0);
  const [professionalCommissionsReceived, setProfessionalCommissionsReceived] = useState(0);
  const [clientRanking, setClientRanking] = useState<
    { patient_id: string; client_name: string; today_total: number; month_total: number }[]
  >([]);
  const [staffCompletedThisMonth, setStaffCompletedThisMonth] = useState(0);
  const [staffValueGeneratedThisMonth, setStaffValueGeneratedThisMonth] = useState(0);
  const [professionalGoalsRanking, setProfessionalGoalsRanking] = useState<
    { professional_id: string; professional_name: string; goal_name: string; goal_type: string; current_value: number; target_value: number; progress_pct: number }[]
  >([]);
  const [mySalaryAmount, setMySalaryAmount] = useState<number | null>(null);
  const [lastSalaryPayment, setLastSalaryPayment] = useState<{ date: string | null; amount: number } | null>(null);
  const [bannerSlide, setBannerSlide] = useState(0);
  const [financeFilter, setFinanceFilter] = useState<'week' | 'month' | 'year'>('month');
  const [hoveredChart, setHoveredChart] = useState<string | null>(null);

  // Enterprise calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [monthlyAppointmentCounts, setMonthlyAppointmentCounts] = useState<Record<string, { total: number; confirmed: number; pending: number; completed: number }>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const navigate = useNavigate();

  // Banner só aparece para usuários novos (< 7 dias) e que não dispensaram
  const showBanner = useMemo(() => {
    if (!user?.created_at) return false;
    const key = `banner_dismissed_${tenant?.id ?? "global"}`;
    try { if (localStorage.getItem(key)) return false; } catch { /* noop */ }
    const daysSinceCreation = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
    return daysSinceCreation < 7;
  }, [user?.created_at, tenant?.id]);

  // 12G.5 — Check if RBAC wizard should be shown for admin
  useEffect(() => {
    if (isAdmin && tenant?.id) {
      const wizardDone = localStorage.getItem(`rbac_wizard_done_${tenant.id}`);
      if (!wizardDone) {
        setRbacWizardOpen(true);
      }
    }
  }, [isAdmin, tenant?.id]);

  // Auto-advance promotional banner carousel (só se visível)
  useEffect(() => {
    if (!showBanner) return;
    const t = setInterval(() => setBannerSlide((p) => (p + 1) % 5), 5000);
    return () => clearInterval(t);
  }, [showBanner]);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const prefetch = () => {
      void import("@/pages/Agenda");
      void import("@/pages/Produtos");
      void import("@/pages/Pacientes");
      void import("@/pages/Notificacoes");
      void import("@/pages/MinhasConfiguracoes");

      if (isAdmin) {
        void import("@/pages/Financeiro");
        void import("@/pages/Equipe");
        void import("@/pages/Configuracoes");
        void import("@/pages/Assinatura");
      } else {
        void import("@/pages/MeuFinanceiro");
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

  // Enterprise calendar: fetch monthly appointment counts per day
  useEffect(() => {
    if (!profile?.tenant_id) return;
    let cancelled = false;
    const fetchMonthCounts = async () => {
      setCalendarLoading(true);
      try {
        const mStart = startOfMonth(calendarMonth);
        const mEnd = endOfMonth(calendarMonth);
        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at, status")
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", mStart.toISOString())
          .lte("scheduled_at", mEnd.toISOString());
        if (cancelled) return;
        if (error) throw error;
        const counts: Record<string, { total: number; confirmed: number; pending: number; completed: number }> = {};
        (data || []).forEach((apt: { scheduled_at: string; status: string }) => {
          const dateKey = formatInAppTz(new Date(apt.scheduled_at), "yyyy-MM-dd");
          if (!counts[dateKey]) counts[dateKey] = { total: 0, confirmed: 0, pending: 0, completed: 0 };
          counts[dateKey].total++;
          if (apt.status === "confirmed") counts[dateKey].confirmed++;
          else if (apt.status === "pending") counts[dateKey].pending++;
          else if (apt.status === "completed") counts[dateKey].completed++;
        });
        setMonthlyAppointmentCounts(counts);
      } catch (err) {
        if (!cancelled) logger.error("Failed to fetch monthly appointment counts", err);
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    };
    fetchMonthCounts();
    return () => { cancelled = true; };
  }, [profile?.tenant_id, calendarMonth]);

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
        patientsResult,
        staffPerformanceResult,
        staffMypatientsResult,
        mySalaryConfigResult,
        mySalaryPaymentsResult,
        pendingTriagesResult,
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
            patient:patients(name, phone),
            procedure:procedures(name, duration_minutes),
            professional:profiles!professional_id(full_name)
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
        // 6. Comissões do mês (staff only — admin não exibe no dashboard)
        !isAdmin && staffUserId
          ? fetchCommissionTotals(
              profile.tenant_id,
              false,
              staffUserId
            ).then((r) => ({ data: r, error: null }))
          : Promise.resolve({ data: { pending: 0, paid: 0 }, error: null }),
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
        // 8. Total de pacientes - usar processNumericRpc (Seção 2.3)
        (async (): Promise<{ data: number; error: any }> => {
          const val = await processNumericRpc(
            await getDashboardPatientsCount({ p_tenant_id: profile.tenant_id }),
            async () => {
              const { count } = await supabase
                .from("patients")
                .select("id", { count: "exact", head: true })
                .eq("tenant_id", profile.tenant_id);
              return count ?? 0;
            },
            "clients count"
          );
          return { data: val, error: null };
        })(),
        // 9. Staff: desempenho do mês (procedimentos concluídos, valor gerado)
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
        // 11. Staff: pacientes únicos que atendeu (distinct patient_id dos seus agendamentos)
        !isAdmin && profile?.id
          ? supabase
              .from("appointments")
              .select("patient_id")
              .eq("tenant_id", profile.tenant_id)
              .eq("professional_id", profile.id)
              .not("patient_id", "is", null)
          : Promise.resolve({ data: null }),
        // 10. Staff: configuração de salário fixo
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
        // 16. Triagens pendentes (admin: todas; staff: todas — exibir no dashboard)
        supabase
          .from("triage_records")
          .select("id, chief_complaint, priority, triaged_at, appointment_id, patient:patients(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "pendente")
          .order("triaged_at", { ascending: true })
          .limit(10),
      ]);

      const financialData = financialResult.data;
      const dailyFinancialData = dailyFinancialResult.data;
      const appointmentsData = appointmentsResult.data;
      const pendingCount = pendingResult.count ?? 0;
      const productsData = productsResult.data;
      const commissionsData = commissionsResult.data as { pending?: number; paid?: number } | null;
      // Perdas de produtos e pacientes: processNumericRpc já aplica fallback (Seção 2.3)
      const productLossTotalValue = productLossesResult?.data ?? 0;
      const patientsCountResult = patientsResult?.data ?? 0;
      
      const staffPerformanceData = (staffPerformanceResult?.data || []) as { id: string; price: number }[];
      const staffMyClientsData = (staffMypatientsResult?.data || []) as { patient_id: string }[];
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

      // Comissões: staff only (admin não exibe no dashboard)
      if (!isAdmin && staffUserId) {
        const pendingCommissions = Number(commissionsData?.pending ?? 0);
        const paidCommissions = Number(commissionsData?.paid ?? 0);
        setProfessionalCommissionsToReceive(pendingCommissions);
        setProfessionalCommissionsReceived(paidCommissions);
      }

      // Garantir que patientsCount seja um número válido e positivo
      const validPatientsCount = isNaN(patientsCountResult) || patientsCountResult < 0 ? 0 : Math.floor(patientsCountResult);
      setPatientsCount(validPatientsCount);

      if (!isAdmin && staffMyClientsData.length > 0) {
        const uniquePatients = new Set(staffMyClientsData.map((r) => r.patient_id).filter(Boolean));
        setStaffMyPatientsCount(uniquePatients.size);
      } else if (!isAdmin) {
        setStaffMyPatientsCount(0);
      } else {
        setStaffMyPatientsCount(null);
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

      const triagesRaw = (pendingTriagesResult?.data || []) as Array<{
        id: string; chief_complaint: string | null; priority: string; triaged_at: string; appointment_id: string | null;
        client?: { name?: string } | null;
      }>;
      setPendingTriages(triagesRaw.map((t) => ({
        id: t.id,
        client_name: t.patient?.name || "Paciente",
        priority: t.priority,
        chief_complaint: t.chief_complaint || "",
        triaged_at: t.triaged_at,
        appointment_id: t.appointment_id,
      })));

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
          const rawRanking = await fetchPatientSpendingByPeriod(profile.tenant_id);
          setClientRanking(rawRanking.map(r => ({ patient_id: r.patient_id, client_name: r.patient_name, today_total: r.today_total, month_total: r.month_total })));
          // Goals functionality disabled - table doesn't exist
          setProfessionalGoalsRanking([]);
        } catch (err) {
          logger.error("Error fetching ranking:", err);
        }
      }

      didSucceed = true;
    } catch (error) {
      logger.error("Erro ao carregar dados do painel:", error);
      toast.error("Erro ao carregar painel", { description: normalizeError(error, "Não foi possível carregar o painel. Tente novamente.") });
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
    const source = isAdmin ? todayAppointments : myTodayAppointments;
    if (source.length === 0) return null;
    const now = new Date();
    const upcoming = source
      .filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return upcoming[0] ?? source.find((a) => a.status !== "cancelled") ?? null;
  }, [todayAppointments, myTodayAppointments, isAdmin]);

  const miniChartData = useMemo(() => {
    if (!isAdmin) return [];
    const inc = stats.monthlyIncome;
    const exp = stats.monthlyExpenses;
    if (inc === 0 && exp === 0) return [];
    return [
      { name: 'S1', receita: inc * 0.18, despesa: exp * 0.22 },
      { name: 'S2', receita: inc * 0.28, despesa: exp * 0.25 },
      { name: 'S3', receita: inc * 0.30, despesa: exp * 0.28 },
      { name: 'S4', receita: inc * 0.24, despesa: exp * 0.25 },
    ];
  }, [isAdmin, stats.monthlyIncome, stats.monthlyExpenses]);

  const activeTeamToday = useMemo(() => {
    const profMap = new Map<string, { name: string; count: number }>();
    todayAppointments.forEach((a) => {
      const profId = a.professional_id;
      const profName = a.professional?.full_name || "Profissional";
      if (profId) {
        const existing = profMap.get(profId);
        if (existing) existing.count++;
        else profMap.set(profId, { name: profName, count: 1 });
      }
    });
    return Array.from(profMap.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count);
  }, [todayAppointments]);

  // Enterprise monthly calendar grid
  const calendarGrid = useMemo(() => {
    const mStart = startOfMonth(calendarMonth);
    const mEnd = endOfMonth(calendarMonth);
    const startDow = getDay(mStart); // 0 = Sunday
    const allDays = eachDayOfInterval({ start: mStart, end: mEnd });
    // Pad beginning with days from previous month
    const prevPad: (Date | null)[] = Array.from({ length: startDow }, () => null);
    const grid = [...prevPad, ...allDays];
    // Pad end to complete the last row (rows of 7)
    while (grid.length % 7 !== 0) grid.push(null);
    // Split into weeks
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);

  const calendarMonthLabel = useMemo(() => {
    return formatInAppTz(calendarMonth, "MMMM yyyy");
  }, [calendarMonth]);

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

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const todayFormatted = formatInAppTz(new Date(), "EEEE, dd 'de' MMMM");
  const summaryText = stats.todayAppointments > 0
    ? `Você tem ${stats.todayAppointments} consulta${stats.todayAppointments > 1 ? "s" : ""} agendada${stats.todayAppointments > 1 ? "s" : ""} para hoje`
    : "Nenhuma consulta agendada para hoje";

  return (
    <MainLayout>
      {/* Role-based dashboard: non-admin users with a specific type see a tailored view */}
      {(() => {
        if (!isAdmin) {
          const RoleDashboard = getDashboardForType(professionalType);
          if (RoleDashboard) return <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><RoleDashboard /></Suspense>;
        }
        return null;
      })()}

      {/* Admin dashboard (full) — only rendered when no role-specific dashboard was shown */}
      {(isAdmin || !getDashboardForType(professionalType)) && (
      <TooltipProvider>
        <div className="space-y-6">

          {/* ===== HERO BANNER — STICKY HEADER (same teal as sidebar) ===== */}
          <div className="relative overflow-x-clip -mx-4 md:-mx-8 bg-teal-600 dark:bg-teal-700 px-4 pt-8 pb-12 md:px-8 md:pt-6 md:pb-14 lg:px-10 lg:pt-5 lg:pb-16 text-white">
            {/* Decorative shapes — large ambient blobs */}
            <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/[0.04]" />
            <div className="pointer-events-none absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-cyan-300/[0.06]" />
            <div className="pointer-events-none absolute right-1/4 top-6 h-40 w-40 rounded-full bg-emerald-400/[0.05]" />
            <div className="pointer-events-none absolute left-1/3 bottom-2 h-28 w-28 rounded-full bg-teal-200/[0.06]" />
            <div className="pointer-events-none absolute right-1/2 -top-10 h-72 w-72 rounded-full bg-teal-400/[0.03]" />

            {/* Abstract paint-texture overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              }}
            />
            {/* Gradient shimmer band */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-[hero-shimmer_6s_ease-in-out_infinite]" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-teal-100 text-xs sm:text-sm font-medium uppercase tracking-wider mb-1">
                  {todayFormatted}
                </p>
                <h1 className="text-xl sm:text-2xl font-extrabold leading-tight mb-1">
                  Olá, {firstName}! 👋
                </h1>
                <p className="text-sm text-teal-100 max-w-md">
                  {summaryText}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link
                    to="/agenda"
                    data-tour="dashboard-new-appointment"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-md transition-all hover:bg-teal-50 hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    Novo agendamento
                  </Link>
                  <Link
                    to="/pacientes"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25"
                  >
                    <Users className="h-4 w-4" />
                    Pacientes
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ===== PROMOTIONAL BANNER CAROUSEL (only for new users < 7 days) ===== */}
          {showBanner && (
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-xl">
              {/* Slide track */}
              <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${bannerSlide * 100}%)` }}
              >
                {/* SLIDE 0 — Nest IA (NOVIDADE) */}
                <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 px-5 pt-6 pb-8 sm:pl-16 sm:pr-8 sm:pt-10 sm:pb-10 text-white">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                  <div className="pointer-events-none absolute -bottom-10 right-20 h-36 w-36 rounded-full bg-white/5" />
                  <div className="pointer-events-none absolute right-40 top-6 h-20 w-20 rounded-full bg-emerald-400/10" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4 animate-pulse">
                        <Sparkles className="h-3.5 w-3.5" />
                        Novidade
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                        Conheça a <span className="text-emerald-300">Nest</span> — sua IA clínica
                      </h2>
                      <p className="text-sm sm:text-base text-teal-100 max-w-md leading-relaxed">
                        Triagem inteligente, sugestão de CID-10, resumo de prontuários, predição de faltas e muito mais. A Nest é sua assistente de IA integrada ao ClinicNest.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
                          <Brain className="h-3 w-3" /> Triagem por IA
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
                          <MessageSquare className="h-3 w-3" /> Chat inteligente
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
                          <Shield className="h-3 w-3" /> Dados protegidos
                        </span>
                      </div>
                      <Link
                        to="/triagem"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-teal-700 shadow-md transition-all hover:bg-emerald-200 hover:text-teal-900"
                      >
                        Experimentar a Nest
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="hidden sm:flex shrink-0 items-center justify-center">
                      <img
                        src="/nest-avatar.png"
                        alt="Nest IA"
                        className="h-32 w-32 rounded-3xl object-cover ring-4 ring-white/20 shadow-2xl"
                      />
                    </div>
                  </div>
                </div>

                {/* SLIDE 1 — Indique e Ganhe */}
                <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-600 px-5 pt-6 pb-8 sm:pl-16 sm:pr-12 sm:pt-10 sm:pb-10 text-white">
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

                {/* SLIDE 2 — Teleconsulta */}
                <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-5 pt-6 pb-8 sm:pl-16 sm:pr-8 sm:pt-10 sm:pb-10 text-white">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                  <div className="pointer-events-none absolute -bottom-10 right-20 h-36 w-36 rounded-full bg-white/5" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-6">
                    <div className="flex-1 min-w-0 pb-0 sm:pb-2">
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
                    {/* Teleconsulta SVG illustration — laptop with video call */}
                    <div className="hidden sm:block shrink-0 self-end" style={{ width: 200, height: 138 }}>
                      <svg viewBox="0 0 200 138" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
                        {/* Screen frame */}
                        <rect x="8" y="4" width="184" height="112" rx="8" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>
                        {/* Screen inner */}
                        <rect x="16" y="12" width="168" height="96" rx="5" fill="rgba(0,0,0,0.18)"/>
                        {/* Video call – left participant */}
                        <rect x="20" y="16" width="78" height="64" rx="4" fill="rgba(255,255,255,0.07)"/>
                        <circle cx="59" cy="40" r="15" fill="rgba(255,255,255,0.18)"/>
                        {/* Medical cross in left avatar */}
                        <rect x="54.5" y="36.5" width="9" height="2.5" rx="1.2" fill="rgba(255,255,255,0.6)"/>
                        <rect x="57.25" y="34" width="2.5" height="9" rx="1.2" fill="rgba(255,255,255,0.6)"/>
                        <rect x="22" y="64" width="76" height="14" rx="3" fill="rgba(255,255,255,0.05)"/>
                        <rect x="26" y="67" width="40" height="5" rx="2" fill="rgba(255,255,255,0.2)"/>
                        {/* Video call – right participant */}
                        <rect x="102" y="16" width="78" height="64" rx="4" fill="rgba(255,255,255,0.07)"/>
                        <circle cx="141" cy="40" r="15" fill="rgba(255,255,255,0.18)"/>
                        <path d="M136 36 a5 5 0 1 1 10 0" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" strokeLinecap="round"/>
                        <rect x="104" y="64" width="76" height="14" rx="3" fill="rgba(255,255,255,0.05)"/>
                        <rect x="108" y="67" width="36" height="5" rx="2" fill="rgba(255,255,255,0.2)"/>
                        {/* Control bar */}
                        <rect x="16" y="84" width="168" height="20" rx="4" fill="rgba(0,0,0,0.15)"/>
                        <circle cx="76" cy="94" r="7" fill="rgba(255,255,255,0.22)"/>
                        <circle cx="100" cy="94" r="7" fill="rgba(239,68,68,0.6)"/>
                        <circle cx="124" cy="94" r="7" fill="rgba(255,255,255,0.22)"/>
                        {/* Laptop stand */}
                        <rect x="76" y="116" width="48" height="6" rx="3" fill="rgba(255,255,255,0.16)"/>
                        <rect x="56" y="122" width="88" height="5" rx="2.5" fill="rgba(255,255,255,0.11)"/>
                        {/* Online dot */}
                        <circle cx="180" cy="14" r="4.5" fill="rgba(74,222,128,0.9)"/>
                        <circle cx="180" cy="14" r="8" fill="rgba(74,222,128,0.18)"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* SLIDE 3 — Prontuário Digital */}
                <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 pt-6 pb-8 sm:pl-16 sm:pr-12 sm:pt-10 sm:pb-10 text-white">
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

                {/* SLIDE 4 — ClinicNest Premium */}
                <div className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-600 px-5 pt-6 pb-8 sm:pl-16 sm:pr-8 sm:pt-10 sm:pb-10 text-white">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-6">
                    <div className="flex-1 min-w-0 pb-0 sm:pb-2">
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
                    {/* Gestão Clínica SVG illustration — medical dashboard */}
                    <div className="hidden sm:block shrink-0 self-end" style={{ width: 210, height: 138 }}>
                      <svg viewBox="0 0 210 138" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
                        {/* Main card */}
                        <rect x="4" y="6" width="202" height="128" rx="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
                        {/* Header pills */}
                        <rect x="14" y="16" width="58" height="20" rx="6" fill="rgba(255,255,255,0.18)"/>
                        <rect x="80" y="16" width="52" height="20" rx="6" fill="rgba(255,255,255,0.12)"/>
                        <rect x="140" y="16" width="60" height="20" rx="6" fill="rgba(255,255,255,0.12)"/>
                        {/* Chart area */}
                        <rect x="14" y="44" width="114" height="80" rx="6" fill="rgba(0,0,0,0.1)"/>
                        {/* Chart bars */}
                        <rect x="24" y="96" width="14" height="20" rx="3" fill="rgba(255,255,255,0.27)"/>
                        <rect x="45" y="80" width="14" height="36" rx="3" fill="rgba(255,255,255,0.38)"/>
                        <rect x="66" y="88" width="14" height="28" rx="3" fill="rgba(255,255,255,0.32)"/>
                        <rect x="87" y="68" width="14" height="48" rx="3" fill="rgba(255,255,255,0.48)"/>
                        <rect x="108" y="76" width="12" height="40" rx="3" fill="rgba(255,255,255,0.3)"/>
                        {/* Trend line */}
                        <polyline points="31,92 52,76 73,83 94,64 120,72" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="94" cy="64" r="3.5" fill="white"/>
                        <circle cx="120" cy="72" r="3" fill="rgba(255,255,255,0.7)"/>
                        {/* Right panel — patient list */}
                        <rect x="136" y="44" width="64" height="13" rx="4" fill="rgba(255,255,255,0.2)"/>
                        <circle cx="147" cy="50.5" r="5" fill="rgba(255,255,255,0.3)"/>
                        <rect x="136" y="63" width="64" height="13" rx="4" fill="rgba(255,255,255,0.14)"/>
                        <circle cx="147" cy="69.5" r="5" fill="rgba(255,255,255,0.2)"/>
                        <rect x="136" y="82" width="64" height="13" rx="4" fill="rgba(255,255,255,0.14)"/>
                        <circle cx="147" cy="88.5" r="5" fill="rgba(255,255,255,0.2)"/>
                        <rect x="136" y="101" width="46" height="13" rx="4" fill="rgba(255,255,255,0.1)"/>
                        {/* Stethoscope icon bottom right */}
                        <circle cx="190" cy="120" r="10" fill="rgba(255,255,255,0.12)"/>
                        <path d="M185 115 a5 5 0 0 1 10 0 v6 q0 4 -5 4" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="185" cy="125" r="2.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation dots — inside overflow-hidden, sit above slides */}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 z-10">
                {[0, 1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    onClick={() => setBannerSlide(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerSlide ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                    aria-label={`Ir para banner ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Prev arrow — on outer wrapper, never clipped by overflow-hidden */}
            <button
              onClick={() => setBannerSlide((p) => (p - 1 + 5) % 5)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-all hover:bg-black/45"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Next arrow — on outer wrapper, never clipped by overflow-hidden */}
            <button
              onClick={() => setBannerSlide((p) => (p + 1) % 5)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-all hover:bg-black/45"
              aria-label="Próximo banner"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          )}

          {/* ===== MAIN CONTENT: KPIs + Interactive Body ===== */}
          <div className="relative z-20 -mt-10 md:-mt-12 lg:-mt-16 grid gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">

          {/* Left Column: KPIs + Sections */}
          <div className="space-y-6">

          {/* KPI METRICS GRID */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 auto-rows-fr">
            {/* Consultas hoje */}
            <Link to="/agenda" data-tour="dashboard-today-stat-appointments" className="animate-fade-in-up [&:hover]:no-underline" style={{ animationDelay: '0ms' }}>
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white shadow-md transition-all hover:shadow-xl hover:scale-[1.02]">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Hoje</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : stats.todayAppointments}</p>
                <p className="mt-1 text-sm text-teal-100">Consultas agendadas</p>
              </div>
            </Link>

            {/* Pendentes */}
            <Link to="/agenda" data-tour="dashboard-today-stat-pending" className="animate-fade-in-up [&:hover]:no-underline" style={{ animationDelay: '80ms' }}>
              <div className={`group relative overflow-hidden rounded-2xl p-5 text-white shadow-md transition-all hover:shadow-xl hover:scale-[1.02] ${stats.pendingAppointments > 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  {stats.pendingAppointments > 0 && (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">Atenção</span>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">
                  {isLoading ? "—" : stats.pendingAppointments}
                </p>
                <p className="mt-1 text-sm text-white/80">Pendentes</p>
              </div>
            </Link>

            {/* Saldo do mês (admin) / Atendimentos do mês (staff) */}
            {isAdmin ? (
              <Link to="/financeiro" data-tour="dashboard-monthly-balance" className="animate-fade-in-up [&:hover]:no-underline" style={{ animationDelay: '160ms' }}>
                <div className="group relative overflow-hidden rounded-2xl p-5 text-white shadow-md transition-all hover:shadow-xl hover:scale-[1.02] bg-gradient-to-br from-emerald-500 to-teal-500">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Mês</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none truncate">{isLoading ? "—" : formatCurrency(stats.monthlyIncome)}</p>
                  <p className="mt-1 text-sm text-white/80">Receita do mês</p>
                </div>
              </Link>
            ) : (
              <Link to="/meu-financeiro" data-tour="dashboard-insights-my-performance" className="animate-fade-in-up [&:hover]:no-underline" style={{ animationDelay: '160ms' }}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 p-5 text-white shadow-md transition-all hover:shadow-xl hover:scale-[1.02]">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Mês</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : staffCompletedThisMonth}</p>
                  <p className="mt-1 text-sm text-teal-100">Atendimentos no mês</p>
                </div>
              </Link>
            )}

            {/* Pacientes (admin) / Pacientes meus (staff) */}
            {isAdmin ? (
              <Link to="/pacientes" data-tour="dashboard-insights-clients" className="animate-fade-in-up [&:hover]:no-underline" style={{ animationDelay: '240ms' }}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-md transition-all hover:shadow-xl hover:scale-[1.02]">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : patientsCount}</p>
                  <p className="mt-1 text-sm text-blue-100">Pacientes cadastrados</p>
                </div>
              </Link>
            ) : (
              <div data-tour="dashboard-insights-my-clients" className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-md" style={{ animationDelay: '240ms' }}>
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Meus</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{isLoading ? "—" : (staffMyPatientsCount ?? 0)}</p>
                <p className="mt-1 text-sm text-blue-100">Pacientes atendidos</p>
              </div>
            )}
          </div>

          {/* ===== ORDERED SECTIONS (inside left column) ===== */}
          {dashboardPrefs.order.map((sectionKey) => {
            if (!availableSections.includes(sectionKey)) return null;
            if (dashboardPrefs.hidden?.[sectionKey]) return null;

            if (sectionKey === "quick_actions") {
              return (
                <div key={sectionKey} className="animate-fade-in-up space-y-3" style={{ animationDelay: '300ms' }}>
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/20">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Ações rápidas</h3>
                        <p className="text-xs text-muted-foreground">Atalhos para o que você mais faz no dia a dia</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={() => setPrefsOpen(true)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Personalizar
                    </Button>
                  </div>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                      <Link to="/agenda" data-tour="dashboard-quick-new-appointment" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-teal-200 hover:shadow-md hover:scale-[1.03]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                          <Calendar className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Novo agendamento</span>
                      </Link>
                      <Link to="/pacientes" data-tour="dashboard-quick-new-client" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-blue-200 hover:shadow-md hover:scale-[1.03]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                          <Users className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Novo paciente</span>
                      </Link>
                      <Link to="/produtos" data-tour="dashboard-quick-stock" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-amber-200 hover:shadow-md hover:scale-[1.03]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                          <Package className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Movimentar estoque</span>
                      </Link>
                      <Link to="/agenda" data-tour="dashboard-quick-start-visit" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-emerald-200 hover:shadow-md hover:scale-[1.03]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                          <Stethoscope className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Iniciar atendimento</span>
                      </Link>
                      {!isAdmin && (
                        <Link to="/meu-financeiro" data-tour="dashboard-quick-my-commissions" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-purple-200 hover:shadow-md hover:scale-[1.03]">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-semibold text-foreground">Meu financeiro</span>
                        </Link>
                      )}
                      {isAdmin && (
                        <Link to="/financeiro" className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-purple-200 hover:shadow-md hover:scale-[1.03]">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                            <DollarSign className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-semibold text-foreground">Financeiro</span>
                        </Link>
                      )}
                    </div>
                </div>
              );
            }

            if (sectionKey === "activity_feed") {
              return (
                <div key={sectionKey} className="animate-fade-in-up space-y-3" style={{ animationDelay: '600ms' }}>
                  {/* Section Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Atividade recente</h3>
                      <p className="text-xs text-muted-foreground">Últimas ações registradas na clínica</p>
                    </div>
                  </div>
                <Collapsible
                  open={activityOpen}
                  onOpenChange={(o) => {
                    setActivityOpen(o);
                    if (o) fetchActivityFeed();
                  }}
                >
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
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
                </div>
              );
            }

            if (sectionKey === "today") {
              return (
                <div key={sectionKey} className="space-y-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                  {/* Section Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Hoje</h3>
                      <p className="text-xs text-muted-foreground">{todayFormatted}</p>
                    </div>
                  </div>

                  {/* Enterprise Monthly Calendar */}
                  <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-800/80">
                    <CardContent className="p-0">
                      {/* Calendar Header */}
                      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-bold capitalize tracking-tight">{calendarMonthLabel}</h4>
                          {calendarLoading && (
                            <div className="h-4 w-4 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30"
                            onClick={() => setCalendarMonth((prev) => subMonths(prev, 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30"
                            onClick={() => setCalendarMonth(new Date())}
                          >
                            Hoje
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30"
                            onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Day of week headers */}
                      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700/50">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dow) => (
                          <div key={dow} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {dow}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                        {calendarGrid.map((week, wi) => (
                          <div key={wi} className="grid grid-cols-7">
                            {week.map((day, di) => {
                              if (!day) {
                                return <div key={`empty-${wi}-${di}`} className="min-h-[52px] bg-slate-50/50 dark:bg-slate-800/30" />;
                              }
                              const dateKey = formatInAppTz(day, "yyyy-MM-dd");
                              const todayStr = formatInAppTz(new Date(), "yyyy-MM-dd");
                              const isDayToday = dateKey === todayStr;
                              const counts = monthlyAppointmentCounts[dateKey];
                              const hasAppointments = counts && counts.total > 0;
                              const isSelected = selectedCalendarDay === dateKey;
                              const dayNum = fnsFormat(day, "d");
                              const isWeekend = di === 0 || di === 6;

                              return (
                                <button
                                  key={dateKey}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCalendarDay(isSelected ? null : dateKey);
                                    if (hasAppointments) navigate("/agenda");
                                  }}
                                  className={`
                                    group relative min-h-[52px] flex flex-col items-center justify-start pt-1.5 transition-all duration-150
                                    ${isDayToday
                                      ? "bg-teal-50 dark:bg-teal-900/20"
                                      : isSelected
                                        ? "bg-blue-50 dark:bg-blue-900/20"
                                        : isWeekend
                                          ? "bg-slate-25 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                                          : "hover:bg-slate-100 dark:hover:bg-slate-700/30"
                                    }
                                    ${hasAppointments ? "cursor-pointer" : "cursor-default"}
                                  `}
                                >
                                  {/* Day number */}
                                  <span
                                    className={`
                                      flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-all
                                      ${isDayToday
                                        ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                                        : isSelected
                                          ? "bg-blue-600 text-white"
                                          : isWeekend
                                            ? "text-muted-foreground"
                                            : "text-foreground group-hover:bg-slate-200 dark:group-hover:bg-slate-600"
                                      }
                                    `}
                                  >
                                    {dayNum}
                                  </span>

                                  {/* Appointment indicators */}
                                  {hasAppointments && (
                                    <div className="mt-0.5 flex items-center gap-0.5">
                                      {counts.confirmed > 0 && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" title={`${counts.confirmed} confirmado(s)`} />
                                      )}
                                      {counts.pending > 0 && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" title={`${counts.pending} pendente(s)`} />
                                      )}
                                      {counts.completed > 0 && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" title={`${counts.completed} concluído(s)`} />
                                      )}
                                    </div>
                                  )}

                                  {/* Count badge on hover */}
                                  {hasAppointments && (
                                    <div className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                      {counts.total}
                                    </div>
                                  )}

                                  {/* Today pulse ring */}
                                  {isDayToday && (
                                    <div className="absolute inset-0 rounded-none border-2 border-teal-400/40 animate-pulse pointer-events-none" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      {/* Calendar footer legend */}
                      <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmado
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-amber-500" /> Pendente
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-blue-500" /> Concluído
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="h-7 text-[10px] font-semibold text-teal-600 hover:bg-teal-50 hover:text-teal-700">
                          <Link to="/agenda">Abrir agenda →</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Next Appointment Highlight — visible for all */}
                  {nextAppointment && (
                    <DashboardNextAppointmentCard nextAppointment={nextAppointment} getStatusBadge={getStatusBadge} />
                  )}

                  <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <DashboardTodayAppointments
                        appointments={myTodayAppointments}
                        isAdmin={isAdmin}
                        getStatusBadge={getStatusBadge}
                      />
                    </div>
                    <div className="space-y-4">
                      {isAdmin && <DashboardLowStockCard lowStockProducts={lowStockProducts} />}

                      {/* Active Team Today */}
                      {isAdmin && activeTeamToday.length > 0 && (
                        <Card>
                          <CardHeader className="flex flex-row items-center gap-2 pb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/10">
                              <UserCheck className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-base font-semibold">Equipe ativa hoje</CardTitle>
                              <CardDescription className="text-xs">{activeTeamToday.length} profissiona{activeTeamToday.length === 1 ? "l" : "is"}</CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            {activeTeamToday.slice(0, 5).map((prof) => {
                              const initials = prof.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                              const colors = ["bg-teal-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-emerald-500"];
                              const bgColor = colors[prof.name.charCodeAt(0) % colors.length];
                              return (
                                <div key={prof.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors">
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${bgColor}`}>
                                    {initials}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{prof.name}</p>
                                    <p className="text-xs text-muted-foreground">{prof.count} consulta{prof.count > 1 ? "s" : ""}</p>
                                  </div>
                                  <div className="shrink-0">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                                      {prof.count}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  {pendingTriages.length > 0 && (
                    <Card>
                      <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
                          <Stethoscope className="h-4 w-4 text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">Triagens pendentes</CardTitle>
                          <CardDescription className="text-xs">Pacientes aguardando atendimento após triagem</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">
                          {pendingTriages.length}
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {pendingTriages.map((triage) => {
                            const priorityStyles: Record<string, string> = {
                              emergencia: "bg-red-500/10 text-red-600 border-red-500/30",
                              urgente: "bg-orange-500/10 text-orange-600 border-orange-500/30",
                              pouco_urgente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
                              nao_urgente: "bg-blue-500/10 text-blue-600 border-blue-500/30",
                            };
                            const priorityLabels: Record<string, string> = {
                              emergencia: "Emergência",
                              urgente: "Urgente",
                              pouco_urgente: "Pouco Urgente",
                              nao_urgente: "Não Urgente",
                            };
                            return (
                              <div key={triage.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{triage.client_name}</p>
                                  {triage.chief_complaint && (
                                    <p className="text-xs text-muted-foreground truncate">{triage.chief_complaint}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className={priorityStyles[triage.priority] || priorityStyles.nao_urgente}>
                                    {priorityLabels[triage.priority] || triage.priority}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {formatInAppTz(new Date(triage.triaged_at), "HH:mm")}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            }

            if (sectionKey === "month") {
              const CHART_COLORS = ['#14b8a6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
              const pieData = [
                { name: 'Receita', value: stats.monthlyIncome, color: '#10b981' },
                { name: 'Despesa', value: stats.monthlyExpenses, color: '#ef4444' },
              ].filter(d => d.value > 0);
              const barChartData = miniChartData.length > 0 ? miniChartData : [
                { name: 'S1', receita: 0, despesa: 0 },
                { name: 'S2', receita: 0, despesa: 0 },
                { name: 'S3', receita: 0, despesa: 0 },
                { name: 'S4', receita: 0, despesa: 0 },
              ];
              const filterLabels = { week: 'Semana', month: 'Mês', year: 'Ano' } as const;
              return (
                <div key={sectionKey} className="animate-fade-in-up space-y-5" style={{ animationDelay: '500ms', perspective: '1200px' }}>
                  {/* Section Header with Filter Tabs */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
                        <BarChart3 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Painel Financeiro</h3>
                        <p className="text-xs text-muted-foreground">{formatInAppTz(new Date(), "MMMM 'de' yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 backdrop-blur-sm">
                      {(['week', 'month', 'year'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFinanceFilter(f)}
                          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${financeFilter === f ? 'bg-white dark:bg-card text-teal-700 dark:text-teal-400 shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {filterLabels[f]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isAdmin && (
                    <>
                      {/* ── 3D Floating KPI Cards ── */}
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        {[
                          { label: 'Receita', value: stats.monthlyIncome, icon: TrendingUp, color: 'emerald', gradient: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/20', link: '/financeiro', tag: 'Entradas' },
                          { label: 'Despesas', value: stats.monthlyExpenses, icon: TrendingDown, color: 'red', gradient: 'from-rose-500 to-red-400', shadow: 'shadow-rose-500/20', link: '/financeiro', tag: 'Saídas' },
                          { label: 'Saldo', value: stats.monthlyBalance, icon: DollarSign, color: stats.monthlyBalance >= 0 ? 'teal' : 'red', gradient: stats.monthlyBalance >= 0 ? 'from-teal-500 to-cyan-400' : 'from-red-500 to-rose-400', shadow: stats.monthlyBalance >= 0 ? 'shadow-teal-500/20' : 'shadow-red-500/20', link: '/financeiro', tag: 'Resultado' },
                        ].map((card, i) => (
                          <Link key={card.label} to={card.link} className="block [&:hover]:no-underline">
                            <div
                              role="group"
                              className={`finance-3d-card group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 text-white shadow-xl ${card.shadow} transition-all duration-500 hover:shadow-2xl`}
                              style={{
                                transform: hoveredChart === card.label ? 'perspective(800px) rotateY(-5deg) rotateX(3deg) scale(1.03)' : 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)',
                                transformStyle: 'preserve-3d',
                                animationDelay: `${i * 120}ms`,
                              }}
                              onMouseEnter={() => setHoveredChart(card.label)}
                              onMouseLeave={() => setHoveredChart(null)}
                            >
                              {/* 3D Depth layers */}
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-transparent" />
                              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-150" />
                              <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5 transition-transform duration-700 group-hover:translate-x-4 group-hover:translate-y-2" />
                              {/* Reflective shimmer */}
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ transform: 'translateZ(1px)' }} />

                              <div className="relative z-10" style={{ transform: 'translateZ(20px)' }}>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                                    <card.icon className="h-5 w-5 text-white drop-shadow-sm" />
                                  </div>
                                  <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">{card.tag}</span>
                                </div>
                                <p className="text-3xl font-black tabular-nums leading-none tracking-tight drop-shadow-sm">{isLoading ? "—" : formatCurrency(card.value)}</p>
                                <p className="mt-1.5 text-sm font-medium text-white/80">{card.label} do {filterLabels[financeFilter].toLowerCase()}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>

                      {/* ── 3D Chart Cards Grid ── */}
                      <div className="grid gap-5 grid-cols-1 lg:grid-cols-5">
                        {/* Main Bar Chart — spans 3 cols */}
                        <div
                          role="group"
                          className="finance-3d-card lg:col-span-3 relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-lg transition-all duration-500 hover:shadow-xl"
                          style={{
                            transform: hoveredChart === 'bar' ? 'perspective(1000px) rotateX(2deg) translateY(-4px)' : 'perspective(1000px) rotateX(0deg) translateY(0)',
                            transformStyle: 'preserve-3d',
                          }}
                          onMouseEnter={() => setHoveredChart('bar')}
                          onMouseLeave={() => setHoveredChart(null)}
                        >
                          {/* Glass overlay */}
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent" />
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/15 to-cyan-500/15">
                                <BarChart3 className="h-4 w-4 text-teal-600" />
                              </div>
                              <p className="text-sm font-bold tracking-tight">Receita vs Despesa</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-medium">
                              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/30" />Receita</span>
                              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400 shadow-sm shadow-rose-400/30" />Despesa</span>
                            </div>
                          </div>
                          <div className="h-52 w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={barChartData} barGap={6} barCategoryGap="20%">
                                <defs>
                                  <linearGradient id="barReceitaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.7} />
                                  </linearGradient>
                                  <linearGradient id="barDespesaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.7} />
                                  </linearGradient>
                                  <filter id="barShadow">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.2" />
                                  </filter>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={40} />
                                <RechartsTooltip
                                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(12px)', fontSize: '12px' }}
                                  formatter={(value: number) => [formatCurrency(value), '']}
                                />
                                <Bar dataKey="receita" fill="url(#barReceitaGrad)" radius={[8, 8, 2, 2]} filter="url(#barShadow)" animationDuration={1200} animationEasing="ease-out" />
                                <Bar dataKey="despesa" fill="url(#barDespesaGrad)" radius={[8, 8, 2, 2]} animationDuration={1200} animationEasing="ease-out" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Donut Chart — 2 cols */}
                        <div
                          role="group"
                          className="finance-3d-card lg:col-span-2 relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-lg transition-all duration-500 hover:shadow-xl"
                          style={{
                            transform: hoveredChart === 'pie' ? 'perspective(1000px) rotateY(4deg) translateY(-4px)' : 'perspective(1000px) rotateY(0deg) translateY(0)',
                            transformStyle: 'preserve-3d',
                          }}
                          onMouseEnter={() => setHoveredChart('pie')}
                          onMouseLeave={() => setHoveredChart(null)}
                        >
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent" />
                          <div className="flex items-center gap-2.5 mb-3 relative z-10">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-purple-500/15">
                              <Activity className="h-4 w-4 text-violet-600" />
                            </div>
                            <p className="text-sm font-bold tracking-tight">Composição</p>
                          </div>
                          <div className="h-44 w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData.length > 0 ? pieData : [{ name: 'Sem dados', value: 1, color: '#d1d5db' }]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={48}
                                  outerRadius={72}
                                  paddingAngle={4}
                                  dataKey="value"
                                  stroke="none"
                                  animationDuration={1400}
                                  animationEasing="ease-out"
                                >
                                  {(pieData.length > 0 ? pieData : [{ name: 'Sem dados', value: 1, color: '#d1d5db' }]).map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} className="drop-shadow-md" />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: '12px' }}
                                  formatter={(value: number) => [formatCurrency(value), '']}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center label */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-center">
                                <p className="text-lg font-black tabular-nums">{isLoading ? "—" : formatCurrency(stats.monthlyBalance)}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">Saldo</p>
                              </div>
                            </div>
                          </div>
                          {/* Legend */}
                          <div className="flex items-center justify-center gap-5 mt-2 relative z-10">
                            <span className="flex items-center gap-1.5 text-[11px] font-medium"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Receita</span>
                            <span className="flex items-center gap-1.5 text-[11px] font-medium"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Despesa</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Cashflow Area Chart ── */}
                      {miniChartData.length > 0 && (
                        <div
                          role="group"
                          className="finance-3d-card relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-lg transition-all duration-500 hover:shadow-xl"
                          style={{
                            transform: hoveredChart === 'area' ? 'perspective(1000px) rotateX(-2deg) translateY(-3px)' : 'perspective(1000px) rotateX(0deg) translateY(0)',
                            transformStyle: 'preserve-3d',
                          }}
                          onMouseEnter={() => setHoveredChart('area')}
                          onMouseLeave={() => setHoveredChart(null)}
                        >
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent" />
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-blue-500/15">
                                <Zap className="h-4 w-4 text-cyan-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold tracking-tight">Fluxo de Caixa</p>
                                <p className="text-[10px] text-muted-foreground">Tendência semanal</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-medium">
                              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500 shadow-sm shadow-teal-500/30" />Entrada</span>
                              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400 shadow-sm shadow-rose-400/30" />Saída</span>
                            </div>
                          </div>
                          <div className="h-40 w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={miniChartData}>
                                <defs>
                                  <linearGradient id="cashInGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="cashOutGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                                <RechartsTooltip
                                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: '12px' }}
                                  formatter={(value: number) => [formatCurrency(value), '']}
                                />
                                <Area type="monotone" dataKey="receita" stroke="#14b8a6" fill="url(#cashInGrad)" strokeWidth={2.5} dot={{ r: 4, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }} animationDuration={1400} />
                                <Area type="monotone" dataKey="despesa" stroke="#f43f5e" fill="url(#cashOutGrad)" strokeWidth={2.5} dot={{ r: 4, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }} animationDuration={1400} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Patient Ranking — admin only (3D) */}
                  {isAdmin && clientRanking.length > 0 && (
                    <div
                      role="group"
                      className="finance-3d-card relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-lg transition-all duration-500 hover:shadow-xl"
                      style={{
                        transform: hoveredChart === 'ranking' ? 'perspective(1000px) rotateX(2deg) translateY(-3px)' : 'perspective(1000px) rotateX(0deg) translateY(0)',
                        transformStyle: 'preserve-3d',
                      }}
                      onMouseEnter={() => setHoveredChart('ranking')}
                      onMouseLeave={() => setHoveredChart(null)}
                    >
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent" />
                      <div className="flex items-center gap-2.5 mb-4 relative z-10">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/15">
                          <Crown className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="text-sm font-bold tracking-tight">Top Pacientes</p>
                      </div>
                      <div className="space-y-2.5 relative z-10">
                        {clientRanking.slice(0, 5).map((client, index) => {
                          const initials = client.client_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                          const medalColors = ["bg-gradient-to-br from-amber-400 to-yellow-300 text-amber-900 shadow-amber-400/30", "bg-gradient-to-br from-gray-300 to-slate-200 text-gray-700 shadow-gray-300/30", "bg-gradient-to-br from-orange-400 to-amber-300 text-orange-900 shadow-orange-400/30"];
                          const barWidth = clientRanking[0].month_total > 0 ? Math.max(10, (client.month_total / clientRanking[0].month_total) * 100) : 0;
                          return (
                            <div key={client.patient_id} className="flex items-center gap-3 group/row rounded-xl p-1.5 -mx-1.5 transition-colors hover:bg-muted/40">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${index < 3 ? medalColors[index] : "bg-muted text-muted-foreground"}`}>
                                {index < 3 ? index + 1 : initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-sm font-medium truncate">{client.client_name}</p>
                                  <span className="text-xs font-bold text-emerald-600 tabular-nums shrink-0">{formatCurrency(client.month_total)}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-400 transition-all duration-700" style={{ width: `${barWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Secondary stat row */}
                  {!isAdmin && (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to="/meu-financeiro" className="block [&:hover]:no-underline" data-tour="dashboard-monthly-my-commissions">
                            <StatCard title="Meu financeiro (pendente)" value={formatCurrency(professionalCommissionsToReceive + (mySalaryAmount || 0))} icon={Wallet} variant={professionalCommissionsToReceive > 0 ? "warning" : "default"} description="Clique para ver detalhes" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Comissões e salários pendentes.</TooltipContent>
                      </Tooltip>
                  </div>
                  )}
                </div>
              );
            }

            return null;
          })}

          </div>{/* end left column */}

          {/* Right Column: Interactive Body Map */}
          <div className="hidden lg:block">
            <div className="sticky top-4 z-20">
              <Card className="h-[calc(100vh-3rem)] overflow-hidden shadow-2xl border-0 ring-1 ring-black/5 bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80">
                <CardContent className="h-full p-0">
                  <InteractiveBody />
                </CardContent>
              </Card>
            </div>
          </div>

          </div>{/* end main grid */}
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
      )}

      {/* 12G.5 — RBAC Setup Wizard */}
      <RbacWizard
        open={rbacWizardOpen}
        onOpenChange={setRbacWizardOpen}
        onComplete={() => setRbacWizardOpen(false)}
      />
    </MainLayout>
  );
}
