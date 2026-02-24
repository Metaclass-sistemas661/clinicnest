import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getSalaryPayments, getProfessionalsWithSalary, paySalary } from "@/lib/supabase-typed-rpc";
import { paySalaryDaysWorkedSchema } from "@/lib/validation";
import type { SalaryPaymentRow, ProfessionalWithSalaryRow, PaySalaryResult } from "@/types/supabase-extensions";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notifications";
import {
  DollarSign,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  Clock,
  TrendingUp,
  Filter,
  Users,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface SalaryRow {
  id: string;
  professional_id: string;
  professional_name: string;
  payment_month: number;
  payment_year: number;
  amount?: number;
  salary_amount?: number;
  status: string;
  payment_date?: string | null;
  payment_method?: string | null;
  days_worked?: number | null;
  days_in_month?: number | null;
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Outro";
  if (method === "pix") return "PIX";
  if (method === "deposit") return "Depósito";
  if (method === "cash") return "Espécie";
  return "Outro";
}

export default function RepassesSalarios() {
  const { profile, isAdmin } = useAuth();
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalWithSalaryRow[]>([]);
  
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<{
    professionalId: string;
    professionalName: string;
    paymentMonth: number;
    paymentYear: number;
    salaryAmount: number;
    defaultPaymentMethod: string;
  } | null>(null);
  const [daysWorked, setDaysWorked] = useState<string>("");

  const fetchSalaries = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    const [year, month] = filterMonth.split("-").map(Number);

    try {
      const [paidResult, professionalsResult] = await Promise.all([
        getSalaryPayments({
          p_tenant_id: profile.tenant_id,
          p_professional_id: null,
          p_year: year,
          p_month: month,
        }),
        getProfessionalsWithSalary({ p_tenant_id: profile.tenant_id }),
      ]);

      let paidSalaries: SalaryPaymentRow[] = [];
      if (!paidResult.error) {
        paidSalaries = Array.isArray(paidResult.data) ? paidResult.data : [];
      }

      let professionalsWithSalary: ProfessionalWithSalaryRow[] = [];
      if (!professionalsResult.error) {
        professionalsWithSalary = Array.isArray(professionalsResult.data) ? professionalsResult.data : [];
      }

      setProfessionals(professionalsWithSalary);

      const paidMap = new Map<string, any>();
      paidSalaries.forEach((s: any) => {
        if (s.professional_id && s.payment_month === month && s.payment_year === year) {
          paidMap.set(s.professional_id, s);
        }
      });

      const allSalaries: SalaryRow[] = [];

      paidSalaries.forEach((s: any) => {
        if (s.payment_month === month && s.payment_year === year) {
          allSalaries.push({ ...s, status: "paid" });
        }
      });

      professionalsWithSalary.forEach((p: any) => {
        if (p.professional_id && !paidMap.has(p.professional_id) && p.salary_amount && Number(p.salary_amount) > 0) {
          const daysInMonth = new Date(year, month, 0).getDate();
          allSalaries.push({
            id: `pending-${p.professional_id}-${year}-${month}`,
            professional_id: p.professional_id,
            professional_name: p.professional_name,
            payment_month: month,
            payment_year: year,
            amount: Number(p.salary_amount),
            salary_amount: Number(p.salary_amount),
            days_in_month: daysInMonth,
            status: "pending",
            payment_method: p.default_payment_method || null,
          });
        }
      });

      setSalaries(allSalaries);
    } catch (error) {
      logger.error("Error fetching salaries:", error);
      toast.error("Erro ao carregar salários");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchSalaries();
    }
  }, [profile?.tenant_id, isAdmin, fetchSalaries]);

  const handleOpenPayDialog = useCallback((salary: SalaryRow) => {
    const professional = professionals.find((p) => p.professional_id === salary.professional_id);
    const defaultMethod = professional?.default_payment_method || salary.payment_method || "pix";
    const amount = Number(salary.amount ?? salary.salary_amount ?? 0);
    
    setSelectedSalary({
      professionalId: salary.professional_id,
      professionalName: salary.professional_name,
      paymentMonth: salary.payment_month,
      paymentYear: salary.payment_year,
      salaryAmount: amount,
      defaultPaymentMethod: defaultMethod,
    });
    setDaysWorked("");
    setIsPayDialogOpen(true);
  }, [professionals]);

  const handlePaySalary = useCallback(async () => {
    if (!profile?.tenant_id || !selectedSalary) return;

    const daysInMonth = new Date(selectedSalary.paymentYear, selectedSalary.paymentMonth, 0).getDate();
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
        p_professional_id: selectedSalary.professionalId,
        p_payment_month: selectedSalary.paymentMonth,
        p_payment_year: selectedSalary.paymentYear,
        p_payment_method: selectedSalary.defaultPaymentMethod,
        p_days_worked: daysWorkedNum,
        p_payment_reference: null,
        p_notes: null,
      });

      if (error) throw error;

      const amount = Number((data as PaySalaryResult)?.amount || 0);
      await notifyUser(
        profile.tenant_id,
        selectedSalary.professionalId,
        "salary_paid",
        "Salário pago",
        `Seu salário de ${formatCurrency(amount)} foi pago.`,
        {}
      ).catch(() => {});

      toast.success("Salário pago com sucesso!");
      setIsPayDialogOpen(false);
      setSelectedSalary(null);
      setDaysWorked("");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchSalaries();
    } catch (error: any) {
      logger.error("Error paying salary:", error);
      toast.error(error.message || "Erro ao pagar salário");
    }
  }, [profile?.tenant_id, selectedSalary, daysWorked, fetchSalaries]);

  const filteredSalaries = useMemo(() => {
    let result = salaries;

    if (filterStatus !== "all") {
      result = result.filter((s) => s.status === filterStatus);
    }

    if (filterProfessional !== "all") {
      result = result.filter((s) => s.professional_id === filterProfessional);
    }

    const pending = result.filter((s) => s.status === "pending");
    const paid = result.filter((s) => s.status !== "pending");
    return [...pending, ...paid];
  }, [salaries, filterStatus, filterProfessional]);

  const stats = useMemo(() => {
    const pending = salaries.filter((s) => s.status === "pending");
    const paid = salaries.filter((s) => s.status === "paid");
    return {
      totalPending: pending.reduce((sum, s) => sum + Number(s.amount || s.salary_amount || 0), 0),
      totalPaid: paid.reduce((sum, s) => sum + Number(s.amount || s.salary_amount || 0), 0),
      pendingCount: pending.length,
      paidCount: paid.length,
    };
  }, [salaries]);

  const uniqueProfessionals = useMemo(() => {
    return Array.from(
      new Map(
        salaries.map((s) => [s.professional_id, { id: s.professional_id, name: s.professional_name }])
      ).values()
    );
  }, [salaries]);

  if (!isAdmin) {
    return (
      <MainLayout title="Salários" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar os salários
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Salários"
      subtitle="Gerencie pagamentos de salários fixos"
      actions={
        <Button variant="outline" asChild>
          <Link to="/repasses" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Repasses
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                title="Pendentes"
                value={formatCurrency(stats.totalPending)}
                icon={Clock}
                variant="warning"
                description={`${stats.pendingCount} salários`}
              />
              <StatCard
                title="Pagos (mês)"
                value={formatCurrency(stats.totalPaid)}
                icon={TrendingUp}
                variant="success"
                description={`${stats.paidCount} salários`}
              />
              <StatCard
                title="Total do Período"
                value={formatCurrency(stats.totalPending + stats.totalPaid)}
                icon={DollarSign}
                description="Pendentes + Pagos"
              />
              <StatCard
                title="Profissionais"
                value={uniqueProfessionals.length}
                icon={Users}
                description="Com salário configurado"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Período
                </Label>
                <Input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueProfessionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salaries List */}
        <Card>
          <CardHeader>
            <CardTitle>Salários do Período</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredSalaries.length} salários encontrados
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredSalaries.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Nenhum salário encontrado"
                description="Configure salários fixos na página de Equipe para que apareçam aqui."
              />
            ) : (
              <>
                {/* Mobile View */}
                <div className="block md:hidden space-y-3">
                  {filteredSalaries.map((salary) => (
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
                          {formatCurrency(Number(salary.amount ?? salary.salary_amount ?? 0))}
                        </span>
                        {salary.payment_method && (
                          <Badge variant="outline" className="text-xs">
                            {paymentMethodLabel(salary.payment_method)}
                          </Badge>
                        )}
                      </div>
                      {salary.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPayDialog(salary)}
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

                {/* Desktop View */}
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
                      {filteredSalaries.map((salary) => (
                        <TableRow key={salary.id}>
                          <TableCell>
                            {String(salary.payment_month).padStart(2, "0")}/{salary.payment_year}
                          </TableCell>
                          <TableCell className="font-medium">
                            {salary.professional_name || "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(Number(salary.amount ?? salary.salary_amount ?? 0))}
                          </TableCell>
                          <TableCell>
                            {salary.payment_method ? (
                              <Badge variant="outline">
                                {paymentMethodLabel(salary.payment_method)}
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
                                onClick={() => handleOpenPayDialog(salary)}
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
      </div>

      {/* Pay Salary Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Salário</DialogTitle>
            <DialogDescription>
              {selectedSalary && (
                <>
                  Pagar salário para <strong>{selectedSalary.professionalName}</strong>
                  <br />
                  Período: {String(selectedSalary.paymentMonth).padStart(2, "0")}/{selectedSalary.paymentYear}
                  <br />
                  Salário mensal: {formatCurrency(selectedSalary.salaryAmount)}
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
                {selectedSalary && (
                  <>
                    {(() => {
                      const daysInMonth = new Date(selectedSalary.paymentYear, selectedSalary.paymentMonth, 0).getDate();
                      const daysWorkedNum = daysWorked ? parseInt(daysWorked) : daysInMonth;
                      const calculatedAmount = (selectedSalary.salaryAmount / daysInMonth) * daysWorkedNum;
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
                setIsPayDialogOpen(false);
                setSelectedSalary(null);
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
