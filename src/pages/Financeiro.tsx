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
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "@/integrations/gcp/client";
import { financialTransactionFormSchema } from "@/lib/validation";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Loader2,
  Calendar,
  BarChart3,
  List,
  Link as LinkIcon,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { ExportPdfDialog } from "@/components/financeiro/ExportPdfDialog";
import {
  FinanceiroOverviewTab,
  FinanceiroTransactionsTab,
  FinanceiroProjectionTab,
} from "@/components/financeiro/tabs";
import { DamagedProductLoss, type CommissionPayment, generateFinancialReport } from "@/utils/financialPdfExport";
import type { FinancialTransaction, TransactionType } from "@/types/database";
import { useSimpleMode } from "@/lib/simple-mode";

const categories = {
  income: ["Procedimento", "Venda de Produto", "Outros"],
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
    : ["overview", "transactions", "projection"];
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
      const { data: txData, error: txError } = await api
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

      const { data: commData } = await api
        .from("commission_payments")
        .select("id,professional_id,appointment_id,amount,service_price,commission_type,status,created_at,payment_date")
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: true });

      // Nome do tenant para o cabeçalho do PDF
      const { data: tenantData } = await api
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
        damagedLosses: [],
        totalProductLoss: 0,
      });

      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      logger.error("Error generating PDF:", error);
      const msg = error instanceof Error ? error.message : "Erro ao gerar o PDF";
      toast.error(msg || "Erro ao gerar o PDF");
    }
  }, [profile?.tenant_id]);

  const fetchTransactions = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      const { data, error } = await api
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
      const { error } = await api.rpc("create_financial_transaction_v2", {
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

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchTransactions();
    }
  }, [profile?.tenant_id, isAdmin, filterMonth, fetchTransactions]);

  useEffect(() => {
    const onFocus = () => {
      if (profile?.tenant_id && isAdmin) {
        fetchTransactions();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.tenant_id, isAdmin, filterMonth, fetchTransactions]);

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
              <Button variant="gradient" data-tour="finance-new-transaction">
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
                <Button type="submit" disabled={isSaving} variant="gradient" data-tour="finance-save-transaction">
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={
              simpleModeEnabled
                ? "grid w-full grid-cols-2 h-auto gap-1 p-1"
                : "grid w-full grid-cols-3 h-auto gap-3 p-2"
            }
          >
            <TabsTrigger value="overview" className="gap-1 md:gap-2 text-xs md:text-sm py-2 px-6 w-full justify-center" data-tour="finance-tab-overview">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1 md:gap-2 text-xs md:text-sm py-2 px-6 w-full justify-center" data-tour="finance-tab-transactions">
              <List className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Transações</span>
              <span className="sm:hidden">Trans.</span>
            </TabsTrigger>
            {!simpleModeEnabled ? (
              <TabsTrigger value="projection" className="gap-1 md:gap-2 text-xs md:text-sm py-2 px-6 w-full justify-center">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Projeção</span>
                <span className="sm:hidden">Proj.</span>
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Gráficos, fluxo de caixa e tendências do período selecionado.</p>
              <FinanceiroOverviewTab
                isLoading={isLoading}
                transactions={transactions}
                filterMonth={filterMonth}
              />
            </div>
          </TabsContent>

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
            <TabsContent value="projection" className="mt-6">
              <FinanceiroProjectionTab />
            </TabsContent>
          ) : null}
        </Tabs>

        {/* Quick Access Cards */}
        {!simpleModeEnabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/contas-pagar" className="block">
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
                    <ArrowDownCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">Contas a Pagar</p>
                    <p className="text-sm text-muted-foreground">
                      Gerencie despesas, fornecedores e obrigações
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/contas-receber" className="block">
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600">
                    <ArrowUpCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-700 dark:text-blue-400">Contas a Receber</p>
                    <p className="text-sm text-muted-foreground">
                      Gerencie valores a receber de pacientes
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Info about payment registration */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Fluxo de Pagamentos</p>
              <p className="text-sm text-muted-foreground">
                Receitas são geradas quando você registra o pagamento de um atendimento concluído na Agenda
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );

}
