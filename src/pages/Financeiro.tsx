import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
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
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notifications";
import { FinanceCharts } from "@/components/financeiro/FinanceCharts";
import { CashFlowTable } from "@/components/financeiro/CashFlowTable";
import { ExportPdfDialog } from "@/components/financeiro/ExportPdfDialog";
import { generateFinancialReport, DamagedProductLoss } from "@/utils/financialPdfExport";
import type { FinancialTransaction, TransactionType } from "@/types/database";

const categories = {
  income: ["Serviço", "Venda de Produto", "Outros"],
  expense: ["Compra de Produto", "Fornecedores", "Aluguel", "Funcionários", "Materiais", "Manutenção", "Outros"],
};

export default function Financeiro() {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [activeTabState, setActiveTabState] = useState("overview");
  const validTabs = ["overview", "cashflow", "transactions", "commissions", "salaries"];
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
  const [commissions, setCommissions] = useState<any[]>([]);
  const [isLoadingCommissions, setIsLoadingCommissions] = useState(false);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [isLoadingSalaries, setIsLoadingSalaries] = useState(false);
  const [professionals, setProfessionals] = useState<any[]>([]);
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

  // Handle PDF export with custom date range
  const handleExportPdf = async (startDate: Date, endDate: Date) => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch transactions for the selected date range
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id,tenant_id,appointment_id,type,category,amount,description,transaction_date,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
        .lte("transaction_date", format(endDate, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      const reportTransactions = (data as FinancialTransaction[]) || [];

      // Calculate totals for the report
      const reportIncome = reportTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const reportExpense = reportTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const reportBalance = reportIncome - reportExpense;

      const { data: damagedData, error: damagedError } = await supabase
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
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (damagedError) throw damagedError;

      const damagedLosses: DamagedProductLoss[] = (damagedData || []).map((movement: any) => {
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
      const totalProductLoss = damagedLosses.reduce((sum, loss) => sum + loss.totalLoss, 0);

      // Fetch commissions for the selected date range
      const { data: commissionsData } = await supabase
        .from("commission_payments")
        .select(`
          *,
          professional:profiles!commission_payments_professional_id_fkey(full_name, email)
        `)
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      await generateFinancialReport({
        transactions: reportTransactions,
        startDate,
        endDate,
        tenantName: profile?.full_name ? `Relatório de ${profile.full_name}` : undefined,
        totalIncome: reportIncome,
        totalExpense: reportExpense,
        balance: reportBalance,
        commissions: (commissionsData || []) as any[],
        damagedLosses,
        totalProductLoss,
      });

      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar o PDF");
    }
  };

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchTransactions();
      fetchCommissions();
      fetchSalaries();
      fetchProfessionals();
      fetchProductLosses();
    }
  }, [profile?.tenant_id, isAdmin, filterMonth]);

  // Refetch ao voltar para a aba (ex.: após concluir atendimento na Agenda)
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
  }, [profile?.tenant_id, isAdmin, filterMonth]);

  const fetchTransactions = async () => {
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
      console.error("Error fetching transactions:", error);
      toast.error("Erro ao carregar transações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    // Validação manual
    if (!formData.category) {
      toast.error("Selecione uma categoria");
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!formData.transaction_date) {
      toast.error("Selecione uma data");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("financial_transactions").insert({
        tenant_id: profile.tenant_id,
        type: formData.type,
        category: formData.category,
        amount: amount,
        description: formData.description || null,
        transaction_date: formData.transaction_date,
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
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchCommissions = async () => {
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

      // Filtrar apenas comissões (excluir salários)
      const filteredCommissions = (commissionsData || []).filter((c: any) => {
        const paymentType = c.commission_config?.payment_type;
        return paymentType === null || paymentType === 'commission' || paymentType === undefined;
      });

      // Buscar nomes dos profissionais
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("tenant_id", profile.tenant_id);

      // Mapear nomes aos registros de comissão
      const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      const enrichedCommissions = filteredCommissions.map((c: any) => ({
        ...c,
        professional: profilesMap.get(c.professional_id) || { full_name: "Profissional", email: null },
      }));

      setCommissions(enrichedCommissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
    } finally {
      setIsLoadingCommissions(false);
    }
  };

  const fetchSalaries = async () => {
    if (!profile?.tenant_id) return;

    setIsLoadingSalaries(true);
    const [year, month] = filterMonth.split("-").map(Number);

    try {
      // Buscar salários já pagos
      let paidSalaries: any[] = [];
      try {
        const { data, error: paidError } = await supabase.rpc("get_salary_payments" as any, {
          p_tenant_id: profile.tenant_id,
          p_professional_id: null,
          p_year: year,
          p_month: month,
        });

        if (paidError) {
          console.error("Error fetching paid salaries:", paidError);
          // Se o RPC não existe, usar fallback: buscar diretamente da tabela
          if (paidError.code === '42883' || paidError.message?.includes('does not exist')) {
            const { data: fallbackData, error: fallbackError } = await (supabase as any)
              .from("salary_payments")
              .select(`
                id,
                professional_id,
                payment_month,
                payment_year,
                amount,
                status,
                payment_date,
                payment_method,
                payment_reference,
                notes,
                created_at,
                updated_at
              `)
              .eq("tenant_id", profile.tenant_id)
              .eq("payment_year", year)
              .eq("payment_month", month);
            
            if (!fallbackError && fallbackData) {
              // Buscar nomes dos profissionais separadamente
              const professionalIds = [...new Set(fallbackData.map((s: any) => s.professional_id))] as string[];
              const { data: profilesData } = await supabase
                .from("profiles")
                .select("user_id, full_name")
                .in("user_id", professionalIds);
              
              const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
              
              paidSalaries = fallbackData.map((s: any) => ({
                id: s.id,
                professional_id: s.professional_id,
                professional_name: profilesMap.get(s.professional_id) || "—",
                payment_month: s.payment_month,
                payment_year: s.payment_year,
                amount: s.amount,
                status: s.status,
                payment_date: s.payment_date,
                payment_method: s.payment_method,
                payment_reference: s.payment_reference,
                notes: s.notes,
                created_at: s.created_at,
                updated_at: s.updated_at,
              }));
            } else {
              throw paidError;
            }
          } else {
            throw paidError;
          }
        } else {
          paidSalaries = Array.isArray(data) ? data : [];
        }
      } catch (rpcError: any) {
        console.error("RPC get_salary_payments failed, trying direct query:", rpcError);
        // Fallback: buscar diretamente da tabela
        const { data: fallbackData, error: fallbackError } = await (supabase as any)
          .from("salary_payments")
          .select(`
            id,
            professional_id,
            payment_month,
            payment_year,
            amount,
            status,
            payment_date,
            payment_method,
            payment_reference,
            notes,
            created_at,
            updated_at
          `)
          .eq("tenant_id", profile.tenant_id)
          .eq("payment_year", year)
          .eq("payment_month", month);
        
        if (!fallbackError && fallbackData) {
          // Buscar nomes dos profissionais separadamente
          const professionalIds = [...new Set(fallbackData.map((s: any) => s.professional_id))].filter((id: any): id is string => typeof id === 'string');
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", professionalIds);
          
          const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
          
          paidSalaries = fallbackData.map((s: any) => ({
            id: s.id,
            professional_id: s.professional_id,
            professional_name: profilesMap.get(s.professional_id) || "—",
            payment_month: s.payment_month,
            payment_year: s.payment_year,
            amount: s.amount,
            status: s.status,
            payment_date: s.payment_date,
            payment_method: s.payment_method,
            payment_reference: s.payment_reference,
            notes: s.notes,
            created_at: s.created_at,
            updated_at: s.updated_at,
          }));
        } else {
          console.error("Fallback also failed:", fallbackError);
          paidSalaries = [];
        }
      }

      // Buscar profissionais com salário configurado
      let professionalsWithSalary: any[] = [];
      try {
        const { data, error: professionalsError } = await (supabase.rpc as any)("get_professionals_with_salary", {
          p_tenant_id: profile.tenant_id,
        });

        if (professionalsError) {
          console.error("Error fetching professionals with salary:", professionalsError);
          // Se o RPC não existe, usar fallback: buscar diretamente da tabela
          if (professionalsError.code === '42883' || professionalsError.message?.includes('does not exist')) {
            const queryResult = await (supabase.from("professional_commissions") as any)
              .select("user_id, salary_amount, salary_payment_day, default_payment_method, id")
              .eq("tenant_id", profile.tenant_id)
              .eq("payment_type", "salary")
              .not("salary_amount", "is", null)
              .gt("salary_amount", 0);
            const fallbackData = queryResult.data;
            const fallbackError = queryResult.error;
            
            if (!fallbackError && fallbackData) {
              // Buscar nomes dos profissionais separadamente
              const userIds = fallbackData.map((p: any) => p.user_id);
              const { data: profilesData } = await supabase
                .from("profiles")
                .select("user_id, full_name")
                .in("user_id", userIds);
              
              const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
              
              professionalsWithSalary = fallbackData.map((p: any) => ({
                professional_id: p.user_id,
                professional_name: profilesMap.get(p.user_id) || "—",
                salary_amount: p.salary_amount,
                salary_payment_day: p.salary_payment_day,
                default_payment_method: p.default_payment_method,
                commission_id: p.id,
              }));
            } else {
              throw professionalsError;
            }
          } else {
            throw professionalsError;
          }
        } else {
          professionalsWithSalary = Array.isArray(data) ? data : [];
        }
      } catch (rpcError: any) {
        console.error("RPC get_professionals_with_salary failed, trying direct query:", rpcError);
        // Fallback: buscar diretamente da tabela
        const queryResult = await (supabase.from("professional_commissions") as any)
          .select("user_id, salary_amount, salary_payment_day, default_payment_method, id")
          .eq("tenant_id", profile.tenant_id)
          .eq("payment_type", "salary")
          .not("salary_amount", "is", null)
          .gt("salary_amount", 0);
        const fallbackData = queryResult.data;
        const fallbackError = queryResult.error;
        
        if (!fallbackError && fallbackData) {
          // Buscar nomes dos profissionais separadamente
          const userIds = fallbackData.map((p: any) => p.user_id);
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          
          const profilesMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
          
          professionalsWithSalary = fallbackData.map((p: any) => ({
            professional_id: p.user_id,
            professional_name: profilesMap.get(p.user_id) || "—",
            salary_amount: p.salary_amount,
            salary_payment_day: p.salary_payment_day,
            default_payment_method: p.default_payment_method,
            commission_id: p.id,
          }));
        } else {
          console.error("Fallback also failed:", fallbackError);
          professionalsWithSalary = [];
        }
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
      console.error("Error fetching salaries:", error);
      const errorMessage = error?.message || error?.toString() || "Erro desconhecido ao carregar salários";
      console.error("Error details:", {
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
  };

  const fetchProfessionals = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Buscar profissionais com salário configurado
      const { data: salaryData } = await supabase.rpc("get_professionals_with_salary" as any, {
        p_tenant_id: profile.tenant_id,
      });

      // Buscar todos os profissionais para fallback
      const { data: allProfessionals } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name");

      // Combinar dados: profissionais com salário têm informações adicionais
      const professionalsMap = new Map((allProfessionals || []).map((p: any) => [p.user_id, p]));
      const enrichedProfessionals = (salaryData || []).map((sp: any) => ({
        ...professionalsMap.get(sp.professional_id),
        ...sp,
      }));

      setProfessionals(enrichedProfessionals as any[]);
    } catch (error) {
      console.error("Error fetching professionals:", error);
      // Fallback para busca simples
      try {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");
        setProfessionals((data || []) as any[]);
      } catch (fallbackError) {
        console.error("Error in fallback fetch:", fallbackError);
        toast.error("Erro ao carregar profissionais. Tente novamente.");
      }
    }
  };

  const fetchProductLosses = async () => {
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
      console.error("Error fetching product losses:", error);
      toast.error("Erro ao carregar perdas de produtos.");
    } finally {
      setIsLoadingProductLosses(false);
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    if (!profile?.tenant_id) return;

    const commission = commissions.find((c) => c.id === commissionId);

    try {
      const { error } = await supabase
        .from("commission_payments")
        .update({
          status: "paid",
          payment_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", commissionId);

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
      
      // Aguardar um pouco para o trigger criar a transação financeira
      await new Promise(resolve => setTimeout(resolve, 500));
      
      fetchCommissions();
      fetchTransactions(); // Refresh to update totals (inclui a nova despesa)
    } catch (error) {
      console.error("Error marking commission as paid:", error);
      toast.error("Erro ao marcar comissão como paga");
    }
  };

  const handleOpenPaySalaryDialog = (
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
  };

  const handlePaySalary = async () => {
    if (!profile?.tenant_id || !selectedSalaryPayment) return;

    const daysWorkedNum = daysWorked ? parseInt(daysWorked) : null;
    
    if (daysWorkedNum !== null && (daysWorkedNum < 1 || daysWorkedNum > 31)) {
      toast.error("Dias trabalhados deve estar entre 1 e 31");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("pay_salary" as any, {
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
      const amount = Number((data as any)?.amount || 0);
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
      console.error("Error paying salary:", error);
      toast.error(error.message || "Erro ao pagar salário");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

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
          <ExportPdfDialog onExport={handleExportPdf} isLoading={isLoading} />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
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
              <StatCard
                title="Saldo do Período"
                value={formatCurrency(balance)}
                icon={DollarSign}
                variant={balance >= 0 ? "success" : "danger"}
              />
              <StatCard
                title="Receitas"
                value={formatCurrency(totalIncome)}
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                title="Despesas"
                value={formatCurrency(totalExpense)}
                icon={TrendingDown}
                variant="danger"
              />
              <StatCard
                title="Perdas de Produtos"
                value={formatCurrency(totalProductLoss)}
                icon={AlertTriangle}
                variant="danger"
                description="Baixas registradas como danificadas"
              />
              <StatCard
                title="Vinculados a Agenda"
                value={linkedTransactions}
                icon={LinkIcon}
                description="Transações automáticas de agendamentos concluídos"
              />
            </>
          )}
        </div>

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
          />
        </div>

        <Card>
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
              <p className="text-sm text-muted-foreground">
                Nenhuma perda registrada neste período.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground pb-3">
                  <span>Perda total</span>
                  <span className="font-semibold text-destructive">
                    {formatCurrency(totalProductLoss)}
                  </span>
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
                          <TableCell className="font-semibold text-destructive">
                            {formatCurrency(loss.totalLoss)}
                          </TableCell>
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="gap-1 md:gap-2 text-xs md:text-sm py-2">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Gráficos</span>
              <span className="sm:hidden">Gráf.</span>
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-1 md:gap-2 text-xs md:text-sm py-2">
              <ArrowRightLeft className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Fluxo de Caixa</span>
              <span className="sm:hidden">Fluxo</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1 md:gap-2 text-xs md:text-sm py-2">
              <List className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Transações</span>
              <span className="sm:hidden">Trans.</span>
            </TabsTrigger>
            <TabsTrigger value="commissions" className="gap-1 md:gap-2 text-xs md:text-sm py-2">
              <Wallet className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Comissões</span>
              <span className="sm:hidden">Com.</span>
            </TabsTrigger>
            <TabsTrigger value="salaries" className="gap-1 md:gap-2 text-xs md:text-sm py-2">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Salários</span>
              <span className="sm:hidden">Sal.</span>
            </TabsTrigger>
          </TabsList>

          {/* Charts Tab */}
          <TabsContent value="overview" className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-[280px] w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-[200px]" />
                    <Skeleton className="h-[200px]" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <FinanceCharts transactions={transactions} filterMonth={filterMonth} />
            )}
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-40" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <CashFlowTable transactions={transactions} filterMonth={filterMonth} />
            )}
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Comissões</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCommissions ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-10 w-full" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma comissão neste período</p>
                  </div>
                ) : (
                  <>
                    <div className="block md:hidden space-y-3">
                      {commissions.map((commission) => (
                        <div key={commission.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{commission.professional?.full_name || "—"}</p>
                            <Badge
                              variant="outline"
                              className={
                                commission.status === "paid"
                                  ? "bg-success/20 text-success border-success/30"
                                  : "bg-warning/20 text-warning border-warning/30"
                              }
                            >
                              {commission.status === "paid" ? "Paga" : "Pendente"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatInAppTz(commission.created_at, "dd/MM/yyyy")} ·{" "}
                            {commission.commission_type === "percentage" ? "Percentual" : "Fixo"}
                          </p>
                          <div className="flex justify-between text-sm">
                            <span>Serviço: {formatCurrency(Number(commission.service_price))}</span>
                            <span className="font-semibold text-primary">
                              Comissão: {formatCurrency(Number(commission.amount))}
                            </span>
                          </div>
                          {commission.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsPaid(commission.id)}
                              className="w-full gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Marcar como Paga
                            </Button>
                          )}
                          {commission.status === "paid" && commission.payment_date && (
                            <p className="text-xs text-muted-foreground">
                              Paga em {formatInAppTz(commission.payment_date, "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Valor do Serviço</TableHead>
                            <TableHead>Comissão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commissions.map((commission) => (
                            <TableRow key={commission.id}>
                              <TableCell>
                                {formatInAppTz(commission.created_at, "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell className="font-medium">
                                {commission.professional?.full_name || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {commission.commission_type === "percentage" ? "Percentual" : "Fixo"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(Number(commission.service_price))}</TableCell>
                              <TableCell className="font-semibold text-primary">
                                {formatCurrency(Number(commission.amount))}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    commission.status === "paid"
                                      ? "bg-success/20 text-success border-success/30"
                                      : "bg-warning/20 text-warning border-warning/30"
                                  }
                                >
                                  {commission.status === "paid" ? "Paga" : "Pendente"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {commission.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAsPaid(commission.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Marcar como Paga
                                  </Button>
                                )}
                                {commission.status === "paid" && commission.payment_date && (
                                  <span className="text-xs text-muted-foreground">
                                    Paga em {formatInAppTz(commission.payment_date, "dd/MM/yyyy")}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Todas as Transações</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-10 w-full" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma transação neste período</p>
                  </div>
                ) : (
                  <>
                    <div className="block md:hidden space-y-3">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <Badge
                              variant="outline"
                              className={
                                transaction.type === "income"
                                  ? "bg-success/20 text-success border-success/30"
                                  : "bg-destructive/20 text-destructive border-destructive/30"
                              }
                            >
                              {transaction.type === "income" ? "Entrada" : "Saída"}
                            </Badge>
                            <span
                              className={`font-semibold ${
                                transaction.type === "income" ? "text-success" : "text-destructive"
                              }`}
                            >
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(transaction.amount)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{transaction.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatInAppTz(transaction.transaction_date, "dd/MM/yyyy")}
                            {transaction.appointment_id && " · Agenda"}
                          </p>
                          {transaction.description && (
                            <p className="text-sm text-muted-foreground truncate">{transaction.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {formatInAppTz(transaction.transaction_date, "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    transaction.type === "income"
                                      ? "bg-success/20 text-success border-success/30"
                                      : "bg-destructive/20 text-destructive border-destructive/30"
                                  }
                                >
                                  {transaction.type === "income" ? "Entrada" : "Saída"}
                                </Badge>
                              </TableCell>
                              <TableCell>{transaction.category}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {transaction.description || "—"}
                              </TableCell>
                              <TableCell>
                                {transaction.appointment_id ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <LinkIcon className="h-3 w-3" />
                                    Agenda
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">Manual</span>
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold ${
                                  transaction.type === "income" ? "text-success" : "text-destructive"
                                }`}
                              >
                                {transaction.type === "income" ? "+" : "-"}
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Salaries Tab */}
          <TabsContent value="salaries" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Salários</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pagar salários fixos dos profissionais
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingSalaries ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-10 w-full" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : salaries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhum salário registrado neste período</p>
                  </div>
                ) : (
                  <>
                    <div className="block md:hidden space-y-3">
                      {salaries.map((salary: any) => (
                        <div key={salary.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{salary.professional_name || "—"}</p>
                            <Badge
                              variant="outline"
                              className={
                                salary.status === "paid"
                                  ? "bg-success/20 text-success border-success/30"
                                  : "bg-warning/20 text-warning border-warning/30"
                              }
                            >
                              {salary.status === "paid" ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {String(salary.payment_month).padStart(2, "0")}/{salary.payment_year}
                          </p>
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold text-primary">
                              {formatCurrency(Number(salary.amount || salary.salary_amount || 0))}
                            </span>
                            {salary.payment_method && (
                              <Badge variant="outline" className="text-xs">
                                {salary.payment_method === "pix" ? "PIX" : 
                                 salary.payment_method === "deposit" ? "Depósito" :
                                 salary.payment_method === "cash" ? "Espécie" : "Outro"}
                              </Badge>
                            )}
                          </div>
                          {salary.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const professional = professionals.find((p: any) => p.user_id === salary.professional_id);
                                const defaultMethod = professional?.default_payment_method || salary.payment_method || "pix";
                                handleOpenPaySalaryDialog(
                                  salary.professional_id,
                                  salary.professional_name,
                                  salary.payment_month,
                                  salary.payment_year,
                                  Number(salary.amount || salary.salary_amount || 0),
                                  defaultMethod
                                );
                              }}
                              className="w-full gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Pagar Salário
                            </Button>
                          )}
                          {salary.status === "paid" && salary.payment_date && (
                            <p className="text-xs text-muted-foreground">
                              Pago em {formatInAppTz(salary.payment_date, "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salaries.map((salary: any) => (
                            <TableRow key={salary.id}>
                              <TableCell>
                                {String(salary.payment_month).padStart(2, "0")}/{salary.payment_year}
                              </TableCell>
                              <TableCell className="font-medium">
                                {salary.professional_name || "—"}
                              </TableCell>
                              <TableCell className="font-semibold text-primary">
                                {formatCurrency(Number(salary.amount || salary.salary_amount || 0))}
                              </TableCell>
                              <TableCell>
                                {salary.payment_method ? (
                                  <Badge variant="outline">
                                    {salary.payment_method === "pix" ? "PIX" : 
                                     salary.payment_method === "deposit" ? "Depósito" :
                                     salary.payment_method === "cash" ? "Espécie" : "Outro"}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    salary.status === "paid"
                                      ? "bg-success/20 text-success border-success/30"
                                      : "bg-warning/20 text-warning border-warning/30"
                                  }
                                >
                                  {salary.status === "paid" ? "Pago" : "Pendente"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {salary.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const professional = professionals.find((p: any) => p.user_id === salary.professional_id);
                                      const defaultMethod = professional?.default_payment_method || salary.payment_method || "pix";
                                      handleOpenPaySalaryDialog(
                                        salary.professional_id,
                                        salary.professional_name,
                                        salary.payment_month,
                                        salary.payment_year,
                                        Number(salary.amount || salary.salary_amount || 0),
                                        defaultMethod
                                      );
                                    }}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Pagar
                                  </Button>
                                )}
                                {salary.status === "paid" && salary.payment_date && (
                                  <span className="text-xs text-muted-foreground">
                                    Pago em {formatInAppTz(salary.payment_date, "dd/MM/yyyy")}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
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
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handlePaySalary}
              className="gradient-primary text-primary-foreground"
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
