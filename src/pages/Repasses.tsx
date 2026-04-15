import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { getSalaryPayments, getProfessionalsWithSalary } from "@/lib/typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  Wallet,
  DollarSign,
  Users,
  Clock,
  ArrowRight,
  Calendar,
  TrendingUp,
  AlertCircle,
  Settings2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { CommissionPayment } from "@/utils/financialPdfExport";

export default function Repasses() {
  const { profile, isAdmin } = useAuth();
  const [filterMonth, setFilterMonth] = useState(formatInAppTz(new Date(), "yyyy-MM"));
  const [isLoading, setIsLoading] = useState(true);
  
  const [commissions, setCommissions] = useState<CommissionPayment[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    const [year, month] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    try {
      const [commissionsResult, salariesResult, professionalsResult] = await Promise.all([
        api
          .from("commission_payments")
          .select(`*, commission_config:professional_commissions(payment_type)`)
          .eq("tenant_id", profile.tenant_id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
        getSalaryPayments({
          p_tenant_id: profile.tenant_id,
          p_professional_id: null,
          p_year: year,
          p_month: month,
        }),
        getProfessionalsWithSalary({ p_tenant_id: profile.tenant_id }),
      ]);

      if (commissionsResult.data) {
        const filtered = (commissionsResult.data as any[]).filter((c) => {
          const paymentType = c.commission_config?.payment_type;
          return paymentType === null || paymentType === "commission" || paymentType === undefined;
        });
        setCommissions(filtered as CommissionPayment[]);
      }

      const paidSalaries = Array.isArray(salariesResult.data) ? salariesResult.data : [];
      const professionalsWithSalary = Array.isArray(professionalsResult.data) ? professionalsResult.data : [];
      
      const paidMap = new Map<string, any>();
      paidSalaries.forEach((s: any) => {
        if (s.professional_id && s.payment_month === month && s.payment_year === year) {
          paidMap.set(s.professional_id, s);
        }
      });

      const allSalaries: any[] = [];
      paidSalaries.forEach((s: any) => {
        if (s.payment_month === month && s.payment_year === year) {
          allSalaries.push({ ...s, status: "paid" });
        }
      });

      professionalsWithSalary.forEach((p: any) => {
        if (p.professional_id && !paidMap.has(p.professional_id) && p.salary_amount && Number(p.salary_amount) > 0) {
          allSalaries.push({
            id: `pending-${p.professional_id}-${year}-${month}`,
            professional_id: p.professional_id,
            professional_name: p.professional_name,
            payment_month: month,
            payment_year: year,
            amount: Number(p.salary_amount),
            status: "pending",
          });
        }
      });

      setSalaries(allSalaries);
    } catch (error) {
      logger.error("Error fetching repasses data:", error);
      toast.error("Erro ao carregar dados de repasses");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, filterMonth]);

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchData();
    }
  }, [profile?.tenant_id, isAdmin, fetchData]);

  const stats = useMemo(() => {
    const pendingCommissions = commissions.filter((c) => c.status === "pending");
    const paidCommissions = commissions.filter((c) => c.status === "paid");
    const pendingSalaries = salaries.filter((s) => s.status === "pending");
    const paidSalaries = salaries.filter((s) => s.status === "paid");

    const totalPendingCommissions = pendingCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalPaidCommissions = paidCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalPendingSalaries = pendingSalaries.reduce((sum, s) => sum + Number(s.amount || s.salary_amount || 0), 0);
    const totalPaidSalaries = paidSalaries.reduce((sum, s) => sum + Number(s.amount || s.salary_amount || 0), 0);

    return {
      totalPending: totalPendingCommissions + totalPendingSalaries,
      totalPaid: totalPaidCommissions + totalPaidSalaries,
      pendingCommissionsCount: pendingCommissions.length,
      pendingSalariesCount: pendingSalaries.length,
      totalPendingCommissions,
      totalPendingSalaries,
    };
  }, [commissions, salaries]);

  if (!isAdmin) {
    return (
      <MainLayout title="Repasses" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar os repasses
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Repasses"
      subtitle="Gerencie comissões e salários dos profissionais"
      actions={
        <Button variant="outline" asChild>
          <Link to="/repasses/regras" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configurar Regras
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
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

        {/* Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                title="Total Pendente"
                value={formatCurrency(stats.totalPending)}
                icon={Clock}
                variant="warning"
                description="Comissões + Salários a pagar"
              />
              <StatCard
                title="Total Pago (mês)"
                value={formatCurrency(stats.totalPaid)}
                icon={TrendingUp}
                variant="success"
                description="Já pago neste período"
              />
              <StatCard
                title="Comissões Pendentes"
                value={stats.pendingCommissionsCount}
                icon={Wallet}
                description={formatCurrency(stats.totalPendingCommissions)}
              />
              <StatCard
                title="Salários Pendentes"
                value={stats.pendingSalariesCount}
                icon={Users}
                description={formatCurrency(stats.totalPendingSalaries)}
              />
            </>
          )}
        </div>

        {/* Quick Access Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Comissões Card */}
          <Card className="group hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Comissões</CardTitle>
                  <CardDescription>Geradas por atendimentos concluídos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pendentes</span>
                    <span className="font-semibold text-warning">
                      {stats.pendingCommissionsCount} ({formatCurrency(stats.totalPendingCommissions)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total no período</span>
                    <span className="font-semibold">{commissions.length} comissões</span>
                  </div>
                  {stats.pendingCommissionsCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <AlertCircle className="h-4 w-4" />
                      <span>{stats.pendingCommissionsCount} comissões aguardando pagamento</span>
                    </div>
                  )}
                </>
              )}
              <Button asChild className="w-full gap-2 group-hover:bg-primary">
                <Link to="/repasses/comissoes">
                  Gerenciar Comissões
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Salários Card */}
          <Card className="group hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Salários</CardTitle>
                  <CardDescription>Pagamentos fixos dos profissionais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pendentes</span>
                    <span className="font-semibold text-warning">
                      {stats.pendingSalariesCount} ({formatCurrency(stats.totalPendingSalaries)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total no período</span>
                    <span className="font-semibold">{salaries.length} salários</span>
                  </div>
                  {stats.pendingSalariesCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <AlertCircle className="h-4 w-4" />
                      <span>{stats.pendingSalariesCount} salários aguardando pagamento</span>
                    </div>
                  )}
                </>
              )}
              <Button asChild className="w-full gap-2 group-hover:bg-primary">
                <Link to="/repasses/salarios">
                  Gerenciar Salários
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Integração Automática</p>
              <p className="text-sm text-muted-foreground">
                Comissões são geradas automaticamente quando atendimentos são concluídos na agenda.
                Salários aparecem conforme configuração de cada profissional.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
