import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSalaryPayments, getProfessionalsWithSalary, paySalary } from "@/lib/supabase-typed-rpc";
import { financialTransactionFormSchema, paySalaryDaysWorkedSchema } from "@/lib/validation";
import type { SalaryPaymentRow, ProfessionalWithSalaryRow, PaySalaryResult } from "@/types/supabase-extensions";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Loader2, 
  Calendar, 
  BarChart3, 
  List, 
  ArrowRightLeft,
  Link as LinkIcon,
  Wallet,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notifications";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import { ExportPdfDialog } from "@/components/financeiro/ExportPdfDialog";
import {
  FinanceiroOverviewTab,
  FinanceiroCashFlowTab,
  FinanceiroCommissionsTab,
  FinanceiroTransactionsTab,
  FinanceiroSalariesTab,
  type SalaryRow,
  type ProfessionalForSalary,
} from "@/components/financeiro/tabs";
import { DamagedProductLoss, type CommissionPayment, generateFinancialReport } from "@/utils/financialPdfExport";
import type { FinancialTransaction, TransactionType } from "@/types/database";
import { useSimpleMode } from "@/lib/simple-mode";

const categories = {
  income: ["Serviço", "Venda de Produto", "Outros"],
  expense: ["Compra de Produto", "Fornecedores", "Aluguel", "Funcionários", "Materiais", "Manutenção", "Outros"],
};

export default function Financeiro() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const { enabled: simpleModeEnabled } = useSimpleMode(profile?.tenant_id);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [activeTabState, setActiveTabState] = useState("overview");
  const validTabs = simpleModeEnabled
    ? ["overview", "transactions"]
    : ["overview", "cashflow", "transactions", "commissions", "salaries"];
  const activeTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : activeTabState;
  const setActiveTab = (v: string) => {
    setActiveTabState(v);
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      if (v === "overview") next.delete("tab");
      else next.set("tab", v);
      return next;
    });
  };
  const [commissions, setCommissions] = useState<CommissionPayment[]>([]);
  const [isLoadingCommissions, setIsLoadingCommissions] = useState(false);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [isLoadingSalaries, setIsLoadingSalaries] = useState(false);
  const [professionals, setProfessionals] = useState<ProfessionalForSalary[]>([]);
  const [isPaySalaryDialogOpen, setIsPaySalaryDialogOpen] = useState(false);
  const [selectedSalaryPayment, setSelectedSalaryPayment] = useState<{
    professionalId: string;
    professionalName: string;
    paymentMonth: number;
    paymentYear: number;
    salaryAmount: number;
    defaultPaymentMethod: string;
  } | null>(null);
  const [daysWorked, setDaysWorked] = useState<string>("");
  const [productLosses, setProductLosses] = useState<DamagedProductLoss[]>([]);
  const [isLoadingProductLosses, setIsLoadingProductLosses] = useState(true);

  useEffect(() => {
    if (!validTabs.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, validTabs]);

  const [formData, setFormData] = useState({
    type: "income" as TransactionType,
    category: "",
    amount: "",
    description: "",
    transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
  });

  // Calculate stats (memoized to avoid recalc on every render)
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );
  const totalExpense = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );
  const balance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);
  const totalProductLoss = useMemo(
    () => productLosses.reduce((sum, loss) => sum + Number(loss.totalLoss), 0),
    [productLosses]
  );

  // Count linked transactions (from appointments)
  const linkedTransactions = useMemo(
    () => transactions.filter((t) => t.appointment_id).length,
    [transactions]
  );


  // Handle PDF export — geração client-side via jsPDF (sem dependência de servidor)
  const handleExportPdf = useCallback(async (startDate: Date, endDate: Date) => {
    if (!profile?.tenant_id) {
      toast.error("Perfil não encontrado.");
      return;
    }
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr   = format(endDate,   "yyyy-MM-dd");

      // Buscar transações no período escolhido
      const { data: txData, error: txError } = await supabase
        .from("financial_transactions")
        .select("id,tenant_id,appointment_id,type,category,amount,description,transaction_date,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr)
        .order("transaction_date", { ascending: true });

      if (txError) throw txError;

      // Buscar comissões no período
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: commData } = await supabase
        .from("commission_payments")
        .select("id,professional_id,appointment_id,amount,service_price,commission_type,status,created_at,payment_date")
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: true });

      // Nome do tenant para o cabeçalho do PDF
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", profile.tenant_id)
        .maybeSingle();

      const txArr = (txData || []) as FinancialTransaction[];
      const totalInc = txArr.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const totalExp = txArr.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

      await generateFinancialReport({
        transactions: txArr,
        startDate,
        endDate,
        tenantName: (tenantData as { name?: string } | null)?.name ?? undefined,
        totalIncome: totalInc,
        totalExpense: totalExp,
        balance: totalInc - totalExp,
        commissions: (commData || []) as CommissionPayment[],
        damagedLosses: productLosses,
        totalProductLoss,
      });

      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      logger.error("Error generating PDF:", error);
      const msg = error instanceof Error ? error.message : "Erro ao gerar o PDF";
      toast.error(msg || "Erro ao gerar o PDF");
    }
  }, [profile?.tenant_id, productLosses, totalProductLoss]);

  const fetchTransactions = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id,tenant_id,appointment_id,type,category,amount,description,transaction_date,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .gte("transaction_date", format(start, "yyyy-MM-dd"))
        .lte("transaction_date", format(end, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions((data as FinancialTransaction[]) || []);
    } catch (error) {
      logger.error("Error fetching transactions:", error);
      toast.error("Erro ao carregar transações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const parsed = financialTransactionFormSchema.safeParse(formData);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = first.category?.[0] ?? first.amount?.[0] ?? first.transaction_date?.[0] ?? "Preencha os campos corretamente";
      toast.error(msg);
      return;
    }
    const amount = parseFloat(parsed.data.amount);

    setIsSaving(true);

    try {
      const { error } = await supabase.rpc("create_financial_transaction_v2", {
        p_type: parsed.data.type,
        p_category: parsed.data.category,
        p_amount: amount,
        p_description: parsed.data.description || null,
        p_transaction_date: parsed.data.transaction_date,
      });

      if (error) throw error;

      toast.success("Transação registrada com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        type: "income",
        category: "",
        amount: "",
        description: "",
        transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
      });
      fetchTransactions();
    } catch (error) {
      toast.error("Erro ao registrar transação");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchCommissions = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoadingCommissions(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      // Buscar comissões APENAS de profissionais com payment_type = 'commission' ou NULL
      // JOIN com professional_commissions para filtrar salários
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("commission_payments")
        .select(`
          *,
          commission_config:professional_commissions(payment_type)
        `)
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (commissionsError) throw commissionsError;

      type CommissionRow = { professional_id: string; commission_config?: { payment_type?: string | null } | null };
      type ProfileRow = { user_id: string; full_name: string | null; email: string | null };
      const commissionsList = (commissionsData || []) as CommissionRow[];
      const filteredCommissions = commissionsList.filter((c) => {
        const paymentType = c.commission_config?.payment_type;
        return paymentType === null || paymentType === 'commission' || paymentType === undefined;
      });

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("tenant_id", profile.tenant_id);

      const profilesMap = new Map((profilesData || []).map((p: ProfileRow) => [p.user_id, p]));
      const enrichedCommissions = filteredCommissions.map((c) => ({
        ...c,
        professional: profilesMap.get(c.professional_id) || { full_name: "Profissional", email: null },
      }));

      setCommissions(enrichedCommissions as CommissionPayment[]);
    } catch (error) {
      logger.error("Error fetching commissions:", error);
    } finally {
      setIsLoadingCommissions(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  const fetchSalaries = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoadingSalaries(true);
    const [year, month] = filterMonth.split("-").map(Number);

    try {
      // Executar ambas as queries em paralelo (evita N+1 / chamadas sequenciais)
      const [paidResult, professionalsResult] = await Promise.all([
        getSalaryPayments({
          p_tenant_id: profile.tenant_id,
          p_professional_id: null,
          p_year: year,
          p_month: month,
        }),
        getProfessionalsWithSalary({
          p_tenant_id: profile.tenant_id,
        }),
      ]);

      // Processar salários pagos (com fallback se RPC falhar)
      let paidSalaries: SalaryPaymentRow[] = [];
      const { data: paidData, error: paidError } = paidResult;
      if (paidError) {
        logger.error("Error fetching paid salaries:", paidError);
        const err = paidError as { code?: string; message?: string };
        if (err.code === "42883" || err.message?.includes("does not exist")) {
          const fallback = await getSalaryPayments({
            p_tenant_id: profile.tenant_id,
            p_professional_id: null,
            p_year: year,
            p_month: month,
          });
          paidSalaries = Array.isArray(fallback.data) ? fallback.data : [];
        }
      } else {
        paidSalaries = Array.isArray(paidData) ? paidData : [];
      }

      // Processar profissionais com salário (com fallback se RPC falhar)
      let professionalsWithSalary: ProfessionalWithSalaryRow[] = [];
      const { data: professionalsData, error: professionalsError } = professionalsResult;
      if (professionalsError) {
        logger.error("Error fetching professionals with salary:", professionalsError);
        const err = professionalsError as { code?: string; message?: string };
        if (err.code === "42883" || err.message?.includes("does not exist")) {
          const queryResult = await (supabase
            .from("professional_commissions")
            .select("user_id, salary_amount, salary_payment_day, default_payment_method, id")
            .eq("tenant_id", profile.tenant_id)
            .eq("payment_type", "salary")
            .not("salary_amount", "is", null)
            .gt("salary_amount", 0)) as { data: unknown; error: { message: string } | null };
          type ProfessionalCommissionRow = { user_id: string; salary_amount: number; salary_payment_day: number | null; default_payment_method: string | null; id: string };
          const fallbackData = queryResult.data as unknown as ProfessionalCommissionRow[] | null;
          if (!queryResult.error && fallbackData?.length) {
            const userIds = fallbackData.map((p) => p.user_id);
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("user_id, full_name")
              .in("user_id", userIds);
            const profilesMap = new Map((profilesData || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name]));
            professionalsWithSalary = fallbackData.map((p) => ({
              professional_id: p.user_id,
              professional_name: profilesMap.get(p.user_id) || "—",
              salary_amount: p.salary_amount,
              salary_payment_day: p.salary_payment_day,
              default_payment_method: p.default_payment_method,
              commission_id: p.id,
            }));
          }
        }
      } else {
        professionalsWithSalary = Array.isArray(professionalsData) ? professionalsData : [];
      }

      // Criar lista combinada: salários pagos + profissionais com salário configurado (pendentes)
      // Criar mapa de profissionais pagos no mês/ano específico
      const paidMap = new Map<string, any>();
      (paidSalaries || []).forEach((s: any) => {
        if (s.professional_id && s.payment_month === month && s.payment_year === year) {
          paidMap.set(s.professional_id, s);
        }
      });
      
      const allSalaries: any[] = [];

      // Adicionar salários pagos do período
      (paidSalaries || []).forEach((s: any) => {
        if (s.payment_month === month && s.payment_year === year) {
          allSalaries.push({
            ...s,
            status: "paid",
          });
        }
      });

      // Adicionar profissionais com salário configurado que ainda não foram pagos neste período
      (professionalsWithSalary || []).forEach((p: any) => {
        if (p.professional_id && !paidMap.has(p.professional_id) && p.salary_amount && Number(p.salary_amount) > 0) {
          // Calcular dias do mês
          const daysInMonth = new Date(year, month, 0).getDate();
          allSalaries.push({
            id: `pending-${p.professional_id}-${year}-${month}`,
            professional_id: p.professional_id,
            professional_name: p.professional_name,
            payment_month: month,
            payment_year: year,
            amount: Number(p.salary_amount),
            days_in_month: daysInMonth,
            status: "pending",
            payment_method: p.default_payment_method || null,
            salary_amount: Number(p.salary_amount),
          });
        }
      });

      setSalaries(allSalaries);
    } catch (error: any) {
      logger.error("Error fetching salaries:", error);
      const errorMessage = error?.message || error?.toString() || "Erro desconhecido ao carregar salários";
      logger.error("Error details:", {
        message: errorMessage,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      toast.error(`Erro ao carregar salários: ${errorMessage}`);
      setSalaries([]); // Limpar lista em caso de erro
    } finally {
      setIsLoadingSalaries(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  const fetchProfessionals = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Uma única chamada: getProfessionalsWithSalary já retorna dados com JOIN em profiles (evita N+1)
      const { data: salaryData } = await getProfessionalsWithSalary({
        p_tenant_id: profile.tenant_id,
      });

      const enrichedProfessionals: ProfessionalForSalary[] = (salaryData || []).map((sp) => ({
        user_id: sp.professional_id,
        default_payment_method: sp.default_payment_method ?? null,
      }));

      setProfessionals(enrichedProfessionals);
    } catch (error) {
      logger.error("Error fetching professionals:", error);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");
        setProfessionals((data || []).map((p: { user_id: string }) => ({ user_id: p.user_id, default_payment_method: null })));
      } catch (fallbackError) {
        logger.error("Error in fallback fetch:", fallbackError);
        toast.error("Erro ao carregar profissionais. Tente novamente.");
      }
    }
  }, [profile?.tenant_id]);

  const fetchProductLosses = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoadingProductLosses(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          id,
          product_id,
          quantity,
          reason,
          created_at,
          product:products(name, cost)
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("movement_type", "out")
        .eq("out_reason_type", "damaged")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: DamagedProductLoss[] = (data || []).map((movement: any) => {
        const quantity = Math.abs(Number(movement.quantity) || 0);
        const unitCost = Number(movement.product?.cost) || 0;
        return {
          id: movement.id,
          productName: movement.product?.name || "Produto removido",
          quantity,
          unitCost,
          totalLoss: unitCost * quantity,
          reason: movement.reason,
          created_at: movement.created_at,
        };
      });

      setProductLosses(mapped);
    } catch (error) {
      logger.error("Error fetching product losses:", error);
      toast.error("Erro ao carregar perdas de produtos.");
    } finally {
      setIsLoadingProductLosses(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchTransactions();
      fetchCommissions();
      fetchSalaries();
      fetchProfessionals();
      fetchProductLosses();
    }
  }, [profile?.tenant_id, isAdmin, filterMonth, fetchTransactions, fetchCommissions, fetchSalaries, fetchProfessionals, fetchProductLosses]);

  useEffect(() => {
    const onFocus = () => {
      if (profile?.tenant_id && isAdmin) {
        fetchTransactions();
        fetchCommissions();
        fetchSalaries();
        fetchProfessionals();
        fetchProductLosses();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.tenant_id, isAdmin, filterMonth, fetchTransactions, fetchCommissions, fetchSalaries, fetchProfessionals, fetchProductLosses]);

  const handleMarkAsPaid = useCallback(async (commissionId: string) => {
    if (!profile?.tenant_id) return;

    const commission = commissions.find((c) => c.id === commissionId);

    try {
      const { error } = await supabase.rpc("mark_commission_paid", {
        p_commission_payment_id: commissionId,
        p_payment_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
      });

      if (error) throw error;

      // Notificar profissional que a comissão foi paga
      if (commission?.professional_id) {
        const amount = Number(commission.amount || 0);
        notifyUser(
          profile.tenant_id,
          commission.professional_id,
          "commission_paid",
          "Comissão paga",
          `Sua comissão de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)} foi paga.`,
          {}
        ).catch(() => {});
      }

      toast.success("Comissão marcada como paga! Despesa registrada automaticamente.");

      fetchCommissions();
      fetchTransactions(); // Refresh to update totals (inclui a nova despesa)
    } catch (error) {
      logger.error("Error marking commission as paid:", error);
      toastRpcError(toast, error as any, "Erro ao marcar comissão como paga");
    }
  }, [profile?.tenant_id, commissions, fetchCommissions, fetchTransactions]);

  const handleOpenPaySalaryDialog = useCallback((
    professionalId: string,
    professionalName: string,
    paymentMonth: number,
    paymentYear: number,
    salaryAmount: number,
    defaultPaymentMethod: string
  ) => {
    setSelectedSalaryPayment({
      professionalId,
      professionalName,
      paymentMonth,
      paymentYear,
      salaryAmount,
      defaultPaymentMethod,
    });
    setDaysWorked("");
    setIsPaySalaryDialogOpen(true);
  }, []);

  const handlePaySalary = useCallback(async () => {
    if (!profile?.tenant_id || !selectedSalaryPayment) return;

    const daysInMonth = new Date(selectedSalaryPayment.paymentYear, selectedSalaryPayment.paymentMonth, 0).getDate();
    const daysWorkedParsed = paySalaryDaysWorkedSchema.safeParse(daysWorked);
    if (!daysWorkedParsed.success) {
      toast.error(daysWorkedParsed.error.message ?? "Dias trabalhados inválido");
      return;
    }
    const daysWorkedNum = daysWorked.trim() === "" ? null : parseInt(daysWorked, 10);
    if (daysWorkedNum !== null && daysWorkedNum > daysInMonth) {
      toast.error(`Dias trabalhados não pode ser maior que ${daysInMonth} (dias do mês)`);
      return;
    }

    try {
      const { data, error } = await paySalary({
        p_tenant_id: profile.tenant_id,
        p_professional_id: selectedSalaryPayment.professionalId,
        p_payment_month: selectedSalaryPayment.paymentMonth,
        p_payment_year: selectedSalaryPayment.paymentYear,
        p_payment_method: selectedSalaryPayment.defaultPaymentMethod,
        p_days_worked: daysWorkedNum,
        p_payment_reference: null,
        p_notes: null,
      });

      if (error) throw error;

      // Notificar profissional que o salário foi pago
      const amount = Number((data as PaySalaryResult)?.amount || 0);
      await notifyUser(
        profile.tenant_id,
        selectedSalaryPayment.professionalId,
        "salary_paid",
        "Salário pago",
        `Seu salário de ${formatCurrency(amount)} foi pago.`,
        {}
      ).catch(() => {});

      toast.success("Salário pago com sucesso! Despesa registrada automaticamente.");
      
      setIsPaySalaryDialogOpen(false);
      setSelectedSalaryPayment(null);
      setDaysWorked("");
      
      // Aguardar um pouco para garantir que a transação financeira foi criada
      await new Promise(resolve => setTimeout(resolve, 500));
      
      fetchSalaries();
      fetchTransactions();
    } catch (error: any) {
      logger.error("Error paying salary:", error);
      toast.error(error.message || "Erro ao pagar salário");
    }
  }, [profile?.tenant_id, selectedSalaryPayment, daysWorked, formatCurrency, fetchSalaries, fetchTransactions]);

  if (!isAdmin) {
    return (
      <MainLayout title="Financeiro" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar o financeiro
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Financeiro"
      subtitle="Controle completo de receitas e despesas"
      actions={
        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
          <div data-tour="finance-export-pdf">
            <ExportPdfDialog onExport={handleExportPdf} isLoading={isLoading} />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground" data-tour="finance-new-transaction">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
              <DialogDescription>Registre uma entrada ou saída</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, type: v as TransactionType, category: "" })
                    }
                  >
                    <SelectTrigger data-tour="finance-transaction-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-tour="finance-transaction-category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[formData.type].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    data-tour="finance-transaction-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) =>
                      setFormData({ ...formData, transaction_date: e.target.value })
                    }
                    required
                    data-tour="finance-transaction-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional..."
                    data-tour="finance-transaction-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-tour="finance-cancel-transaction"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="finance-save-transaction">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Registrar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats - skeleton enquanto carrega */}
        <TooltipProvider>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-6 flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-28 sm:h-8" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              </div>
            ))
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="finance-stat-balance">
                    <StatCard
                      title="Saldo do período"
                      value={formatCurrency(balance)}
                      icon={DollarSign}
                      variant={balance >= 0 ? "success" : "danger"}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Saldo = receitas - despesas no período filtrado.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="finance-stat-income">
                    <StatCard
                      title="Receitas"
                      value={formatCurrency(totalIncome)}
                      icon={TrendingUp}
                      variant="success"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Soma das entradas (receitas) no período.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="finance-stat-expense">
                    <StatCard
                      title="Despesas"
                      value={formatCurrency(totalExpense)}
                      icon={TrendingDown}
                      variant="danger"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Soma das saídas (despesas) no período.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="finance-stat-product-loss">
                    <StatCard
                      title="Perdas de produtos"
                      value={formatCurrency(totalProductLoss)}
                      icon={AlertTriangle}
                      variant="danger"
                      description="Baixas registradas como danificadas"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Total de baixas de estoque marcadas como danificadas no período.</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-tour="finance-stat-linked-transactions">
                    <StatCard
                      title="Geradas pela agenda"
                      value={linkedTransactions}
                      icon={LinkIcon}
                      description="Criadas automaticamente ao concluir atendimentos"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Transações criadas automaticamente ao finalizar agendamentos.</TooltipContent>
              </Tooltip>
            </>
          )}
          </div>
        </TooltipProvider>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label>Período:</Label>
          </div>
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full sm:w-48"
            data-tour="finance-filter-month"
          />
        </div>

        <Card data-tour="finance-product-losses-card">
          <CardHeader>
            <CardTitle>Perdas de Produtos (danificados)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Itens retirados do estoque como baixa danificada no período selecionado.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingProductLosses ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : productLosses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma perda registrada neste período.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground pb-3">
                  <span>Perda total</span>
                  <span className="font-semibold text-destructive">{formatCurrency(totalProductLoss)}</span>
                </div>

                <div className="block md:hidden space-y-3">
                  {productLosses.map((loss) => (
                    <div key={loss.id} className="rounded-lg border p-4 space-y-1">
                      <p className="font-medium">{loss.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatInAppTz(loss.created_at, "dd/MM/yyyy")} · Qtd: {loss.quantity}
                      </p>
                      <p className="font-semibold text-destructive">{formatCurrency(loss.totalLoss)}</p>
                      {loss.reason && <p className="text-sm">{loss.reason}</p>}
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead>Custo Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productLosses.map((loss) => (
                        <TableRow key={loss.id}>
                          <TableCell>{formatInAppTz(loss.created_at, "dd/MM/yyyy")}</TableCell>
                          <TableCell>{loss.productName}</TableCell>
                          <TableCell className="text-center">{loss.quantity}</TableCell>
                          <TableCell>{formatCurrency(loss.unitCost)}</TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(loss.totalLoss)}</TableCell>
                          <TableCell>{loss.reason || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={
              simpleModeEnabled
                ? "grid w-full grid-cols-2 h-auto gap-1 p-1"
                : "grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-1 p-1"
            }
          >
            <TabsTrigger value="overview" className="gap-1 md:gap-2 text-xs md:text-sm py-2" data-tour="finance-tab-overview">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Gráficos</span>
              <span className="sm:hidden">Gráf.</span>
            </TabsTrigger>
            {!simpleModeEnabled ? (
              <TabsTrigger value="cashflow" className="gap-1 md:gap-2 text-xs md:text-sm py-2" data-tour="finance-tab-cashflow">
                <ArrowRightLeft className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Fluxo de Caixa</span>
                <span className="sm:hidden">Fluxo</span>
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="transactions" className="gap-1 md:gap-2 text-xs md:text-sm py-2" data-tour="finance-tab-transactions">
              <List className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Transações</span>
              <span className="sm:hidden">Trans.</span>
            </TabsTrigger>
            {!simpleModeEnabled ? (
              <TabsTrigger value="commissions" className="gap-1 md:gap-2 text-xs md:text-sm py-2" data-tour="finance-tab-commissions">
                <Wallet className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Comissões</span>
                <span className="sm:hidden">Com.</span>
              </TabsTrigger>
            ) : null}
            {!simpleModeEnabled ? (
              <TabsTrigger value="salaries" className="gap-1 md:gap-2 text-xs md:text-sm py-2" data-tour="finance-tab-salaries">
                <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Salários</span>
                <span className="sm:hidden">Sal.</span>
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Visão geral do caixa e tendências do período selecionado.</p>
              <FinanceiroOverviewTab
                isLoading={isLoading}
                transactions={transactions}
                filterMonth={filterMonth}
              />
            </div>
          </TabsContent>

          {!simpleModeEnabled ? (
            <TabsContent value="cashflow" className="mt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Entradas e saídas detalhadas, organizadas por categoria.</p>
              <FinanceiroCashFlowTab
                isLoading={isLoading}
                transactions={transactions}
                formatCurrency={formatCurrency}
                filterMonth={filterMonth}
              />
            </div>
          </TabsContent>
          ) : null}

          {!simpleModeEnabled ? (
            <TabsContent value="commissions" className="mt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Comissões geradas por atendimentos concluídos. Pendentes aparecem primeiro.</p>
                <FinanceiroCommissionsTab
                  isLoading={isLoadingCommissions}
                  commissions={commissions}
                  onMarkAsPaid={handleMarkAsPaid}
                  formatCurrency={formatCurrency}
                />
              </div>
            </TabsContent>
          ) : null}

          <TabsContent value="transactions" className="mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Registros manuais e automáticos do financeiro no período.</p>
              <FinanceiroTransactionsTab
                isLoading={isLoading}
                transactions={transactions}
                formatCurrency={formatCurrency}
                onNewTransaction={() => setIsDialogOpen(true)}
              />
            </div>
          </TabsContent>

          {!simpleModeEnabled ? (
            <TabsContent value="salaries" className="mt-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pagamentos de salários fixos dos profissionais no período.</p>
                <FinanceiroSalariesTab
                  isLoading={isLoadingSalaries}
                  salaries={salaries}
                  professionals={professionals}
                  onOpenPaySalary={handleOpenPaySalaryDialog}
                  formatCurrency={formatCurrency}
                />
              </div>
            </TabsContent>
          ) : null}
        </Tabs>

        {/* Info about automatic transactions */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Integração com Agenda</p>
              <p className="text-sm text-muted-foreground">
                Receitas são geradas automaticamente quando um agendamento é marcado como "Concluído"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para pagar salário com dias trabalhados */}
      <Dialog open={isPaySalaryDialogOpen} onOpenChange={setIsPaySalaryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Salário</DialogTitle>
            <DialogDescription>
              {selectedSalaryPayment && (
                <>
                  Pagar salário para <strong>{selectedSalaryPayment.professionalName}</strong>
                  <br />
                  Período: {String(selectedSalaryPayment.paymentMonth).padStart(2, "0")}/{selectedSalaryPayment.paymentYear}
                  <br />
                  Salário mensal: {formatCurrency(selectedSalaryPayment.salaryAmount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="days_worked">
                Quantos dias este funcionário trabalhou neste mês?
              </Label>
              <Input
                id="days_worked"
                type="number"
                min="1"
                max="31"
                value={daysWorked}
                onChange={(e) => setDaysWorked(e.target.value)}
                placeholder="Deixe em branco para pagar o mês completo"
                data-tour="finance-salary-days-worked"
              />
              <p className="text-xs text-muted-foreground">
                {selectedSalaryPayment && (
                  <>
                    {(() => {
                      const daysInMonth = new Date(selectedSalaryPayment.paymentYear, selectedSalaryPayment.paymentMonth, 0).getDate();
                      const daysWorkedNum = daysWorked ? parseInt(daysWorked) : daysInMonth;
                      const calculatedAmount = (selectedSalaryPayment.salaryAmount / daysInMonth) * daysWorkedNum;
                      return `Valor a pagar: ${formatCurrency(calculatedAmount)} (${daysWorkedNum}/${daysInMonth} dias)`;
                    })()}
                  </>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPaySalaryDialogOpen(false);
                setSelectedSalaryPayment(null);
                setDaysWorked("");
              }}
              data-tour="finance-cancel-salary-payment"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handlePaySalary}
              className="gradient-primary text-primary-foreground"
              data-tour="finance-confirm-salary-payment"
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );

}
