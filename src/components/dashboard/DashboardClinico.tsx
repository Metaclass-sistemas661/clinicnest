import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, Stethoscope, FileText, UserCheck,
  ClipboardList, Plus, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import type { Appointment, ProfessionalType } from "@/types/database";
import { PROFESSIONAL_TYPE_LABELS } from "@/types/database";

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning border-warning/30", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info border-info/30", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600 border-violet-500/30", label: "Chegou" },
  completed: { className: "bg-success/20 text-success border-success/30", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Cancelado" },
};

interface PendingEvolution {
  id: string;
  client_name: string;
  scheduled_at: string;
  service_name: string | null;
}

export const DashboardClinico = memo(function DashboardClinico() {
  const { profile, professionalType } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingEvolutions, setPendingEvolutions] = useState<PendingEvolution[]>([]);
  const [monthCompleted, setMonthCompleted] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const typeLabel = PROFESSIONAL_TYPE_LABELS[professionalType] || professionalType;

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id) return;
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    try {
      const [aptsRes, completedRes, completedAptsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, client:clients(name, phone), service:services(name, duration_minutes), professional:profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .eq("status", "completed")
          .gte("scheduled_at", monthStart)
          .lte("scheduled_at", monthEnd),
        supabase
          .from("appointments")
          .select("id, scheduled_at, client:clients(name), service:services(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .eq("status", "completed")
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: false }),
      ]);

      const apts = (aptsRes.data as unknown as Appointment[]) || [];
      setAppointments(apts);
      setMonthCompleted(completedRes.count ?? 0);

      const completedApts = (completedAptsRes.data || []) as any[];
      if (completedApts.length > 0) {
        const completedIds = completedApts.map((a: any) => a.id);
        const { data: evolData } = await supabase
          .from("clinical_evolutions")
          .select("appointment_id")
          .eq("tenant_id", profile.tenant_id)
          .in("appointment_id", completedIds);
        const evolAppIds = new Set((evolData || []).map((e: any) => e.appointment_id));
        const pending = completedApts
          .filter((a: any) => !evolAppIds.has(a.id))
          .map((a: any) => ({
            id: a.id,
            client_name: a.client?.name || "Paciente",
            scheduled_at: a.scheduled_at,
            service_name: a.service?.name || null,
          }));
        setPendingEvolutions(pending);
      }
    } catch (e) {
      logger.error("DashboardClinico fetch error:", e);
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
      ?? appointments.find((a) => a.status !== "cancelled")
      ?? null;
  }, [appointments]);

  const arrivedCount = useMemo(() => appointments.filter((a) => a.status === "arrived").length, [appointments]);
  const inProgressCount = useMemo(() => appointments.filter((a) => a.status === "confirmed" || a.status === "arrived").length, [appointments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link to="/agenda" className="[&:hover]:no-underline">
          <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-teal-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                <Calendar className="h-5 w-5 text-teal-600" />
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">Hoje</span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums leading-none">{appointments.length}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Meus agendamentos</p>
          </div>
        </Link>

        {arrivedCount > 0 && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
                <UserCheck className="h-5 w-5 text-violet-600" />
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Aguardando</span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums leading-none text-violet-700">{arrivedCount}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Pacientes na sala</p>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <Stethoscope className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Mês</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none">{monthCompleted}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Atendimentos concluídos</p>
        </div>

        {pendingEvolutions.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Atenção</span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums leading-none text-amber-700">{pendingEvolutions.length}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Evoluções pendentes</p>
          </div>
        )}
      </div>

      {/* Next appointment hero */}
      {nextAppointment && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-teal-600 to-cyan-500 p-5 text-white">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-100" />
              <span className="text-sm font-medium text-teal-100">Próximo atendimento</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Stethoscope className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-bold leading-tight">{nextAppointment.client?.name || "Paciente"}</p>
                {nextAppointment.service?.name && <p className="mt-0.5 truncate text-sm text-teal-100">{nextAppointment.service.name}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums text-3xl font-bold leading-none">{formatInAppTz(nextAppointment.scheduled_at, "HH:mm")}</p>
                <p className="mt-1 text-xs text-teal-100">hoje</p>
              </div>
            </div>
          </div>
          <CardContent className="flex items-center justify-between p-3">
            <Badge variant="outline" className={statusBadge[nextAppointment.status]?.className}>
              {statusBadge[nextAppointment.status]?.label}
            </Badge>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/agenda">Ver agenda <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agenda do dia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
                <Calendar className="h-4 w-4 text-teal-600" />
              </div>
              <CardTitle className="text-base font-semibold">Minha agenda de hoje</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/agenda">Ver tudo →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento hoje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 8).map((apt) => {
                  const st = apt.status || "pending";
                  const sb = statusBadge[st];
                  return (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${st === "arrived" ? "bg-violet-50 text-violet-700 border-violet-200" : st === "confirmed" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-muted text-muted-foreground border-border"}`}>
                        {formatInAppTz(apt.scheduled_at, "HH:mm")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{apt.client?.name || "Paciente"}</p>
                        {apt.service?.name && <p className="text-xs text-muted-foreground truncate">{apt.service.name}</p>}
                      </div>
                      <Badge variant="outline" className={sb?.className}>{sb?.label}</Badge>
                    </div>
                  );
                })}
                {appointments.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{appointments.length - 8} • <Link to="/agenda" className="text-teal-600 hover:underline font-medium">ver agenda</Link>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evoluções pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600/10">
                <ClipboardList className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Evoluções pendentes</CardTitle>
                <CardDescription className="text-xs">Atendimentos concluídos sem evolução registrada</CardDescription>
              </div>
            </div>
            {pendingEvolutions.length > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{pendingEvolutions.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingEvolutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-10 w-10 text-emerald-500/40 mb-2" />
                <p className="text-sm text-muted-foreground">Todas as evoluções em dia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingEvolutions.map((ev) => (
                  <Link key={ev.id} to={`/evolucoes`} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 hover:bg-amber-50 transition-colors [&:hover]:no-underline">
                    <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-700">
                      {formatInAppTz(new Date(ev.scheduled_at), "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{ev.client_name}</p>
                      {ev.service_name && <p className="text-xs text-muted-foreground truncate">{ev.service_name}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-600 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
