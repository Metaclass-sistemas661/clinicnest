import { useEffect, useState, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Smile, ClipboardList, Calendar, Clock, TrendingUp, FileText, Users, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import { CommissionTierIndicator } from "@/components/commission/CommissionTierIndicator";
import { CallNextButton } from "@/components/queue/CallNextButton";

interface TodayAppointment {
  id: string;
  scheduled_at: string;
  client_name: string;
  service_name: string;
  status: string;
}

interface PendingPlan {
  id: string;
  plan_number: string;
  title: string;
  client_name: string;
  final_value: number;
  items_count: number;
  created_at: string;
}

interface ProcedureStats {
  total_procedures: number;
  total_value: number;
  completed_plans: number;
  pending_plans: number;
}

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600", label: "Chegou" },
  completed: { className: "bg-success/20 text-success", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive", label: "Cancelado" },
};

export const DashboardDentista = memo(function DashboardDentista() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<TodayAppointment[]>([]);
  const [pendingPlans, setPendingPlans] = useState<PendingPlan[]>([]);
  const [stats, setStats] = useState<ProcedureStats>({ total_procedures: 0, total_value: 0, completed_plans: 0, pending_plans: 0 });
  const [topProcedures, setTopProcedures] = useState<{ name: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id) return;
    setIsLoading(true);

    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();
    const monthStart = startOfMonth(today).toISOString();
    const monthEnd = endOfMonth(today).toISOString();

    try {
      // Agendamentos do dia
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, patient:patients(name), procedure:procedures(name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .order("scheduled_at");

      setAppointments(
        (appts || []).map((a: any) => ({
          id: a.id,
          scheduled_at: a.scheduled_at,
          client_name: a.patient?.name || "—",
          service_name: a.procedure?.name || "—",
          status: a.status,
        }))
      );

      // Planos pendentes de aprovação
      const { data: plans } = await supabase
        .from("treatment_plans")
        .select("id, plan_number, title, final_value, created_at, patient:patients(name), treatment_plan_items(id)")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.id)
        .in("status", ["pendente", "apresentado"])
        .order("created_at", { ascending: false })
        .limit(5);

      setPendingPlans(
        (plans || []).map((p: any) => ({
          id: p.id,
          plan_number: p.plan_number,
          title: p.title,
          client_name: p.patient?.name || "—",
          final_value: p.final_value,
          items_count: p.treatment_plan_items?.length || 0,
          created_at: p.created_at,
        }))
      );

      // Estatísticas do mês
      const { data: monthPlans } = await supabase
        .from("treatment_plans")
        .select("id, status, final_value")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.id)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      const { data: monthItems } = await supabase
        .from("treatment_plan_items")
        .select("id, total_price, status, plan_id")
        .in("plan_id", (monthPlans || []).map((p) => p.id));

      const completedItems = (monthItems || []).filter((i) => i.status === "concluido");
      const completedPlans = (monthPlans || []).filter((p) => p.status === "concluido").length;
      const pendingPlansCount = (monthPlans || []).filter((p) => ["pendente", "apresentado"].includes(p.status)).length;

      setStats({
        total_procedures: completedItems.length,
        total_value: completedItems.reduce((sum, i) => sum + (i.total_price || 0), 0),
        completed_plans: completedPlans,
        pending_plans: pendingPlansCount,
      });

      // Top procedimentos (simulado - em produção viria de uma query agregada)
      const { data: recentItems } = await supabase
        .from("treatment_plan_items")
        .select("procedure_name")
        .eq("status", "concluido")
        .in("plan_id", (monthPlans || []).map((p) => p.id))
        .limit(100);

      const procCount: Record<string, number> = {};
      (recentItems || []).forEach((i) => {
        const name = i.procedure_name || "Outros";
        procCount[name] = (procCount[name] || 0) + 1;
      });

      const sorted = Object.entries(procCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      setTopProcedures(sorted);
    } catch (err) {
      console.error("Erro ao carregar dashboard dentista:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedToday = appointments.filter((a) => a.status === "completed").length;
  const pendingToday = appointments.filter((a) => ["pending", "confirmed", "arrived"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{appointments.length}</p>
                <p className="text-xs text-muted-foreground">Agendamentos hoje</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <Badge variant="outline" className="bg-success/10 text-success">{completedToday} concluídos</Badge>
              <Badge variant="outline" className="bg-warning/10 text-warning">{pendingToday} pendentes</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_procedures}</p>
                <p className="text-xs text-muted-foreground">Procedimentos no mês</p>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-green-600">{formatCurrency(stats.total_value)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending_plans}</p>
                <p className="text-xs text-muted-foreground">Planos aguardando aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed_plans}</p>
                <p className="text-xs text-muted-foreground">Planos concluídos no mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Tier Indicator */}
      <CommissionTierIndicator />

      {/* Botão Chamar Próximo */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <Smile className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-teal-900">Chamar próximo paciente</p>
                <p className="text-sm text-teal-700">Chame o próximo da fila de espera</p>
              </div>
            </div>
            <CallNextButton 
              professionalId={profile?.id}
              size="lg"
              variant="gradient"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agenda do Dia */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Smile className="h-4 w-4" />
                Agenda de Hoje
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/agenda">Ver agenda <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento para hoje</p>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 6).map((appt) => {
                  const badge = statusBadge[appt.status] || statusBadge.pending;
                  return (
                    <div key={appt.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-medium">{formatInAppTz(new Date(appt.scheduled_at), "HH:mm")}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{appt.client_name}</p>
                          <p className="text-xs text-muted-foreground">{appt.service_name}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Planos Pendentes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Planos Aguardando Aprovação
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/planos-tratamento">Ver todos <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano pendente</p>
            ) : (
              <div className="space-y-2">
                {pendingPlans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{plan.client_name}</p>
                      <p className="text-xs text-muted-foreground">{plan.plan_number} · {plan.items_count} procedimentos</p>
                    </div>
                    <p className="text-sm font-bold text-primary">{formatCurrency(plan.final_value)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Procedimentos Mais Realizados */}
      {topProcedures.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Procedimentos Mais Realizados (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProcedures.map((proc, idx) => {
                const maxCount = topProcedures[0]?.count || 1;
                const percent = (proc.count / maxCount) * 100;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate max-w-[70%]">{proc.name}</span>
                      <span className="font-medium">{proc.count}x</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links Rápidos */}
      <div className="grid gap-3 md:grid-cols-4">
        <Button variant="outline" className="h-auto py-3 justify-start gap-3" asChild>
          <Link to="/odontograma">
            <Smile className="h-5 w-5 text-blue-500" />
            <div className="text-left">
              <p className="font-medium">Odontograma</p>
              <p className="text-xs text-muted-foreground">Exame clínico</p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start gap-3" asChild>
          <Link to="/planos-tratamento">
            <ClipboardList className="h-5 w-5 text-amber-500" />
            <div className="text-left">
              <p className="font-medium">Planos de Tratamento</p>
              <p className="text-xs text-muted-foreground">Orçamentos</p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start gap-3" asChild>
          <Link to="/receituarios">
            <FileText className="h-5 w-5 text-green-500" />
            <div className="text-left">
              <p className="font-medium">Receituários</p>
              <p className="text-xs text-muted-foreground">Prescrições</p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start gap-3" asChild>
          <Link to="/pacientes">
            <Users className="h-5 w-5 text-violet-500" />
            <div className="text-left">
              <p className="font-medium">Pacientes</p>
              <p className="text-xs text-muted-foreground">Cadastro</p>
            </div>
          </Link>
        </Button>
      </div>
    </div>
  );
});
