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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { notifyUser } from "@/lib/notifications";
import {
  Wallet,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  Clock,
  TrendingUp,
  Filter,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { CommissionPayment } from "@/utils/financialPdfExport";

export default function RepassesComissoes() {
  const { profile, isAdmin } = useAuth();
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionPayment[]>([]);
  const [professionals, setProfessionals] = useState<{ user_id: string; full_name: string }[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchCommissions = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("commission_payments")
        .select(`*, commission_config:professional_commissions(payment_type)`)
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
        return paymentType === null || paymentType === "commission" || paymentType === undefined;
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

      const uniqueProfessionals = Array.from(
        new Map(
          (profilesData || [])
            .filter((p: ProfileRow) => filteredCommissions.some((c) => c.professional_id === p.user_id))
            .map((p: ProfileRow) => [p.user_id, { user_id: p.user_id, full_name: p.full_name || "—" }])
        ).values()
      );
      setProfessionals(uniqueProfessionals);
    } catch (error) {
      logger.error("Error fetching commissions:", error);
      toast.error("Erro ao carregar comissões");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchCommissions();
    }
  }, [profile?.tenant_id, isAdmin, fetchCommissions]);

  const handleMarkAsPaid = useCallback(async (commissionId: string) => {
    if (!profile?.tenant_id) return;

    const commission = commissions.find((c) => c.id === commissionId);

    try {
      const { error } = await supabase.rpc("mark_commission_paid", {
        p_commission_payment_id: commissionId,
        p_payment_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
      });

      if (error) throw error;

      if (commission?.professional_id) {
        const amount = Number(commission.amount || 0);
        notifyUser(
          profile.tenant_id,
          commission.professional_id,
          "commission_paid",
          "Comissão paga",
          `Sua comissão de ${formatCurrency(amount)} foi paga.`,
          {}
        ).catch(() => {});
      }

      toast.success("Comissão marcada como paga!");
      fetchCommissions();
    } catch (error) {
      logger.error("Error marking commission as paid:", error);
      toastRpcError(toast, error as any, "Erro ao marcar comissão como paga");
    }
  }, [profile?.tenant_id, commissions, fetchCommissions]);

  const filteredCommissions = useMemo(() => {
    let result = commissions;

    if (filterStatus !== "all") {
      result = result.filter((c) => c.status === filterStatus);
    }

    if (filterProfessional !== "all") {
      result = result.filter((c) => c.professional_id === filterProfessional);
    }

    const pending = result.filter((c) => c.status === "pending");
    const paid = result.filter((c) => c.status !== "pending");
    return [...pending, ...paid];
  }, [commissions, filterStatus, filterProfessional]);

  const stats = useMemo(() => {
    const pending = commissions.filter((c) => c.status === "pending");
    const paid = commissions.filter((c) => c.status === "paid");
    return {
      totalPending: pending.reduce((sum, c) => sum + Number(c.amount || 0), 0),
      totalPaid: paid.reduce((sum, c) => sum + Number(c.amount || 0), 0),
      pendingCount: pending.length,
      paidCount: paid.length,
    };
  }, [commissions]);

  if (!isAdmin) {
    return (
      <MainLayout title="Comissões" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar as comissões
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Comissões"
      subtitle="Gerencie comissões baseadas em recebimentos"
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
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 shrink-0 mt-0.5">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400">Nova lógica de comissões</p>
              <p className="text-blue-600/80 dark:text-blue-400/80">
                Comissões são calculadas sobre <strong>pagamentos recebidos</strong>, não sobre atendimentos concluídos.
                Registre o pagamento na Agenda para gerar a comissão do profissional.
              </p>
            </div>
          </CardContent>
        </Card>

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
                description={`${stats.pendingCount} comissões`}
              />
              <StatCard
                title="Pagas (mês)"
                value={formatCurrency(stats.totalPaid)}
                icon={TrendingUp}
                variant="success"
                description={`${stats.paidCount} comissões`}
              />
              <StatCard
                title="Total Gerado"
                value={formatCurrency(stats.totalPending + stats.totalPaid)}
                icon={Wallet}
                description="No período"
              />
              <StatCard
                title="Profissionais"
                value={professionals.length}
                icon={Filter}
                description="Com comissões"
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
                    <SelectItem value="paid">Pagas</SelectItem>
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
                    {professionals.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commissions List */}
        <Card>
          <CardHeader>
            <CardTitle>Comissões do Período</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredCommissions.length} comissões encontradas
            </p>
          </CardHeader>
          <CardContent>
            <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Confirme para marcar esta comissão como paga. Uma despesa será registrada automaticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmId(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (confirmId) handleMarkAsPaid(confirmId);
                      setConfirmId(null);
                    }}
                  >
                    Confirmar Pagamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredCommissions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhuma comissão encontrada"
                description="Ajuste os filtros ou aguarde novos atendimentos serem concluídos."
              />
            ) : (
              <>
                {/* Mobile View */}
                <div className="block md:hidden space-y-3">
                  {filteredCommissions.map((commission) => (
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
                        <span>Procedimento: {formatCurrency(Number(commission.service_price))}</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(Number(commission.amount))}
                        </span>
                      </div>
                      {commission.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmId(commission.id)}
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

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor do Procedimento</TableHead>
                        <TableHead>Comissão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommissions.map((commission) => (
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
                                onClick={() => setConfirmId(commission.id)}
                                className="gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Pagar
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
      </div>
    </MainLayout>
  );
}
