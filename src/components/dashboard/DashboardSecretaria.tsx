import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, Users, UserCheck, Phone, Bell,
  Plus, ArrowRight, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import type { Appointment } from "@/types/database";
import { CallNextButton } from "@/components/queue/CallNextButton";
import { useWaitingQueue } from "@/hooks/usePatientQueue";

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning border-warning/30", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info border-info/30", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600 border-violet-500/30", label: "Chegou" },
  completed: { className: "bg-success/20 text-success border-success/30", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Cancelado" },
};

export const DashboardSecretaria = memo(function DashboardSecretaria() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();

    try {
      const [aptsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, patient:patients(name, phone), procedure:procedures(name, duration_minutes), professional:profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
      ]);

      setAppointments((aptsRes.data as unknown as Appointment[]) || []);
    } catch (e) {
      logger.error("DashboardSecretaria fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingConfirmation = useMemo(() => appointments.filter((a) => a.status === "pending"), [appointments]);
  const arrivedPatients = useMemo(() => appointments.filter((a) => a.status === "arrived"), [appointments]);
  const confirmedToday = useMemo(() => appointments.filter((a) => a.status === "confirmed"), [appointments]);
  const completedToday = useMemo(() => appointments.filter((a) => a.status === "completed"), [appointments]);

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
            <p className="mt-1.5 text-sm text-muted-foreground">Agendamentos totais</p>
          </div>
        </Link>

        <div className={`rounded-2xl border p-5 ${pendingConfirmation.length > 0 ? "border-amber-200 bg-amber-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${pendingConfirmation.length > 0 ? "bg-amber-100" : "bg-muted/50"}`}>
              <Clock className={`h-5 w-5 ${pendingConfirmation.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
            {pendingConfirmation.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Atenção</span>
            )}
          </div>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${pendingConfirmation.length > 0 ? "text-amber-700" : ""}`}>
            {pendingConfirmation.length}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Pendentes de confirmação</p>
        </div>

        <div className={`rounded-2xl border p-5 ${arrivedPatients.length > 0 ? "border-violet-200 bg-violet-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${arrivedPatients.length > 0 ? "bg-violet-100" : "bg-muted/50"}`}>
              <UserCheck className={`h-5 w-5 ${arrivedPatients.length > 0 ? "text-violet-600" : "text-muted-foreground"}`} />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${arrivedPatients.length > 0 ? "text-violet-700" : ""}`}>
            {arrivedPatients.length}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Check-ins realizados</p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Hoje</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none">{completedToday.length}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Concluídos</p>
        </div>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações rápidas</CardTitle>
          <CardDescription>Atalhos do dia a dia da recepção</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            <CallNextButton className="justify-start" />
            <Button asChild variant="outline" className="justify-start">
              <Link to="/agenda"><Plus className="mr-2 h-4 w-4" />Novo agendamento</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/pacientes"><Users className="mr-2 h-4 w-4" />Novo paciente</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/agenda"><Phone className="mr-2 h-4 w-4" />Confirmar consultas</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/recepcao"><Bell className="mr-2 h-4 w-4" />Recepção</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pendentes de confirmação */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600/10">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Pendentes de confirmação</CardTitle>
                <CardDescription className="text-xs">Aguardando confirmação do paciente</CardDescription>
              </div>
            </div>
            {pendingConfirmation.length > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{pendingConfirmation.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingConfirmation.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/40 mb-2" />
                <p className="text-sm text-muted-foreground">Todos confirmados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingConfirmation.slice(0, 8).map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 hover:bg-amber-50 transition-colors">
                    <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-700">
                      {formatInAppTz(apt.scheduled_at, "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {apt.professional?.full_name && <span className="truncate">{apt.professional.full_name}</span>}
                        {apt.procedure?.name && <span className="truncate">• {apt.procedure.name}</span>}
                      </div>
                    </div>
                    {apt.patient?.phone && (
                      <a href={`tel:${apt.patient.phone}`} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-amber-100 transition-colors">
                        <Phone className="h-4 w-4 text-amber-600" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agenda completa do dia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
                <Calendar className="h-4 w-4 text-teal-600" />
              </div>
              <CardTitle className="text-base font-semibold">Agenda de hoje</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/agenda">Ver tudo →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sem agendamentos hoje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 10).map((apt) => {
                  const st = apt.status || "pending";
                  const sb = statusBadge[st];
                  return (
                    <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${st === "arrived" ? "bg-violet-50 text-violet-700 border-violet-200" : st === "confirmed" ? "bg-teal-50 text-teal-700 border-teal-200" : st === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                        {formatInAppTz(apt.scheduled_at, "HH:mm")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {apt.professional?.full_name && <span className="truncate">{apt.professional.full_name}</span>}
                          {apt.procedure?.name && <span className="truncate">• {apt.procedure.name}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={sb?.className}>{sb?.label}</Badge>
                    </div>
                  );
                })}
                {appointments.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{appointments.length - 10} agendamento{appointments.length - 10 > 1 ? "s" : ""} •{" "}
                    <Link to="/agenda" className="text-teal-600 hover:underline font-medium">ver agenda</Link>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pacientes que chegaram (check-in) */}
      {arrivedPatients.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
                <UserCheck className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Pacientes na recepção</CardTitle>
                <CardDescription className="text-xs">Check-in realizado — aguardando atendimento</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">{arrivedPatients.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {arrivedPatients.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2.5">
                  <span className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700">
                    {formatInAppTz(apt.scheduled_at, "HH:mm")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {apt.professional?.full_name && <span className="truncate">{apt.professional.full_name}</span>}
                      {apt.procedure?.name && <span className="truncate">• {apt.procedure.name}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-violet-500/20 text-violet-600 border-violet-500/30">Chegou</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
