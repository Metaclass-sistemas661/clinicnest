import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { FinanceCharts } from "@/components/financeiro/FinanceCharts";
import { CashFlowTable } from "@/components/financeiro/CashFlowTable";
import { ExportPdfDialog } from "@/components/financeiro/ExportPdfDialog";
import { generateFinancialReport } from "@/utils/financialPdfExport";
import type { FinancialTransaction, TransactionType } from "@/types/database";

const categories = {
  income: ["Serviço", "Venda de Produto", "Outros"],
  expense: ["Fornecedores", "Aluguel", "Funcionários", "Materiais", "Manutenção", "Outros"],
};

export default function Financeiro() {
  const { profile, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("overview");
  const [commissions, setCommissions] = useState<any[]>([]);
  const [isLoadingCommissions, setIsLoadingCommissions] = useState(false);
  const [professionals, setProfessionals] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    type: "income" as TransactionType,
    category: "",
    amount: "",
    description: "",
    transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
  });

  // Calculate stats
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Count linked transactions (from appointments)
  const linkedTransactions = transactions.filter((t) => t.appointment_id).length;

  // Handle PDF export with custom date range
  const handleExportPdf = async (startDate: Date, endDate: Date) => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch transactions for the selected date range
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
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
      fetchProfessionals();
    }
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
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .gte("transaction_date", format(start, "yyyy-MM-dd"))
        .lte("transaction_date", format(end, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions((data as FinancialTransaction[]) || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSaving(true);

    try {
      const { error } = await supabase.from("financial_transactions").insert({
        tenant_id: profile.tenant_id,
        type: formData.type,
        category: formData.category,
        amount: parseFloat(formData.amount),
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
      const { data, error } = await supabase
        .from("commission_payments")
        .select(`
          *,
          professional:profiles!commission_payments_professional_id_fkey(full_name, email)
        `)
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCommissions((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching commissions:", error);
    } finally {
      setIsLoadingCommissions(false);
    }
  };

  const fetchProfessionals = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name");
      setProfessionals((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from("commission_payments")
        .update({
          status: "paid",
          payment_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
          paid_by: profile.user_id,
        })
        .eq("id", commissionId);

      if (error) throw error;

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
        <div className="flex items-center gap-2">
          <ExportPdfDialog onExport={handleExportPdf} isLoading={isLoading} />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
              <DialogDescription>Registre uma entrada ou saída</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="grid gap-4 py-4">
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
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
            title="Vinculados a Agenda"
            value={linkedTransactions}
            icon={LinkIcon}
            description="Transações automáticas de agendamentos concluídos"
          />
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
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
          </TabsList>

          {/* Charts Tab */}
          <TabsContent value="overview" className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma comissão neste período</p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Comissões</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCommissions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : commissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma comissão neste período</p>
                  </div>
                ) : (
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
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma transação neste período</p>
                  </div>
                ) : (
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
    </MainLayout>
  );
}
