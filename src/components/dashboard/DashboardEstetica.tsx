/**
 * DashboardEstetica — R19: Dashboard dedicado para profissionais de estética.
 * Métricas: ml preenchimento/mês, U toxina/mês, ticket médio, sessões realizadas.
 */
import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, Sparkles, Syringe, Droplets, TrendingUp,
  Plus, ArrowRight, Camera,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import type { Appointment } from "@/types/database";
import { CallNextButton } from "@/components/queue/CallNextButton";

export const DashboardEstetica = memo(function DashboardEstetica() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthCompleted, setMonthCompleted] = useState(0);
  const [monthToxina, setMonthToxina] = useState(0);
  const [monthPreench, setMonthPreench] = useState(0);
  const [monthSessions, setMonthSessions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id) return;
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    try {
      const [aptsRes, completedRes, sessionsRes] = await Promise.all([
        api
          .from("appointments")
          .select("*, patient:patients(name, phone), procedure:procedures(name, duration_minutes)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
        api
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .eq("status", "completed")
          .gte("scheduled_at", monthStart)
          .lte("scheduled_at", monthEnd),
        api
          .from("aesthetic_sessions")
          .select("applications")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .gte("session_date", monthStart)
          .lte("session_date", monthEnd),
      ]);

      setAppointments((aptsRes.data as unknown as Appointment[]) || []);
      setMonthCompleted(completedRes.count ?? 0);

      // Calculate totals from aesthetic sessions
      const sessions = sessionsRes.data || [];
      setMonthSessions(sessions.length);
      let toxina = 0;
      let preench = 0;
      for (const s of sessions) {
        const apps = (s as any).applications;
        if (Array.isArray(apps)) {
          for (const a of apps) {
            if (a.procedure === "toxina_botulinica") toxina += a.quantity || 0;
            if (a.unit === "ml") preench += a.quantity || 0;
          }
        }
      }
      setMonthToxina(toxina);
      setMonthPreench(preench);
    } catch (e) {
      logger.error("DashboardEstetica fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => a.status !== "cancelled" && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
      ?? null;
  }, [appointments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header CTA */}
      <Card className="border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-pink-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-100">
                <Sparkles className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div>
                <p className="font-semibold text-fuchsia-900">Novo Mapeamento Estético</p>
                <p className="text-sm text-fuchsia-700">Iniciar sessão com mapeamento facial/corporal</p>
              </div>
            </div>
            <Button asChild className="bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white">
              <Link to="/estetica/mapeamento">
                <Plus className="mr-2 h-4 w-4" /> Nova Sessão
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-100">
              <Calendar className="h-5 w-5 text-fuchsia-600" />
            </div>
            <span className="rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-700">Hoje</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none">{appointments.length}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Agendamentos</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100">
              <Syringe className="h-5 w-5 text-purple-600" />
            </div>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">Mês</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none text-purple-700">{monthToxina}U</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Toxina aplicada</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100">
              <Droplets className="h-5 w-5 text-pink-600" />
            </div>
            <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-700">Mês</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none text-pink-700">{monthPreench.toFixed(1)}ml</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Preenchimento</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Mês</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none">{monthSessions}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Sessões estéticas</p>
        </div>
      </div>

      {/* Next appointment + Quick links */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Next Appointment */}
        {nextAppointment ? (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-fuchsia-600 to-pink-500 p-5 text-white">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-fuchsia-100" />
                <span className="text-sm font-medium text-fuchsia-100">Próximo atendimento</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold">{nextAppointment.patient?.name || "Paciente"}</p>
                  {nextAppointment.procedure?.name && <p className="mt-0.5 truncate text-sm text-fuchsia-100">{nextAppointment.procedure.name}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-3xl font-bold">{formatInAppTz(nextAppointment.scheduled_at, "HH:mm")}</p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground">
              <Calendar className="mx-auto h-8 w-8 opacity-30 mb-2" />
              <p className="text-sm">Nenhum agendamento próximo</p>
            </div>
          </Card>
        )}

        {/* Quick links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link to="/estetica/mapeamento">
                <Sparkles className="h-5 w-5 text-fuchsia-600" />
                <span className="text-xs">Mapeamento</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link to="/estetica/galeria">
                <Camera className="h-5 w-5 text-pink-600" />
                <span className="text-xs">Galeria</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link to="/prontuarios">
                <Syringe className="h-5 w-5 text-purple-600" />
                <span className="text-xs">Prontuários</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link to="/agenda">
                <Calendar className="h-5 w-5 text-teal-600" />
                <span className="text-xs">Agenda</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-fuchsia-600" />
            Agenda de hoje
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs text-fuchsia-600">
            <Link to="/agenda">Ver tudo <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhum agendamento hoje</p>
          ) : (
            <div className="space-y-2">
              {appointments.slice(0, 6).map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <span className="shrink-0 rounded-md bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-2 py-0.5 text-xs font-bold tabular-nums">
                    {formatInAppTz(apt.scheduled_at, "HH:mm")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                    {apt.procedure?.name && <p className="text-xs text-muted-foreground truncate">{apt.procedure.name}</p>}
                  </div>
                  <Badge variant="outline" className={
                    apt.status === "completed" ? "bg-success/10 text-success border-success/30" :
                    apt.status === "arrived" ? "bg-violet-500/10 text-violet-600 border-violet-500/30" :
                    "bg-muted"
                  }>
                    {apt.status === "completed" ? "Concluído" : apt.status === "arrived" ? "Chegou" : apt.status === "confirmed" ? "Confirmado" : "Pendente"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});
