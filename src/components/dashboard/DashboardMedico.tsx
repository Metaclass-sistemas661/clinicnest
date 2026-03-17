import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, Stethoscope, FileText, Users, UserCheck,
  ClipboardList, AlertTriangle, Plus, ArrowRight, Megaphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { CommissionTierIndicator } from "@/components/commission/CommissionTierIndicator";
import { CallNextButton } from "@/components/queue/CallNextButton";
import type { Appointment } from "@/types/database";

interface TriageItem {
  id: string;
  client_name: string;
  priority: string;
  chief_complaint: string;
  triaged_at: string;
  appointment_id: string | null;
}

interface RecentRecord {
  id: string;
  client_name: string;
  template_type: string | null;
  created_at: string;
}

interface WaitlistItem {
  id: string;
  client_name: string;
  priority: string;
  preferred_period: string | null;
  created_at: string;
}

const priorityStyles: Record<string, string> = {
  emergencia: "bg-red-500/10 text-red-600 border-red-500/30",
  urgente: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  pouco_urgente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  nao_urgente: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  alta: "bg-red-500/10 text-red-600 border-red-500/30",
  media: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  baixa: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  normal: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};
const priorityLabels: Record<string, string> = {
  emergencia: "Emergência",
  urgente: "Urgente",
  pouco_urgente: "Pouco Urgente",
  nao_urgente: "Não Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  normal: "Normal",
};

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning border-warning/30", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info border-info/30", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600 border-violet-500/30", label: "Chegou" },
  completed: { className: "bg-success/20 text-success border-success/30", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Cancelado" },
};

export const DashboardMedico = memo(function DashboardMedico() {
  const { profile, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingTriages, setPendingTriages] = useState<TriageItem[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [waitlistItems, setWaitlistItems] = useState<WaitlistItem[]>([]);
  const [monthCompleted, setMonthCompleted] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id) return;
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    try {
      const [aptsRes, triagesRes, recordsRes, waitlistRes, completedRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, patient:patients(name, phone), procedure:procedures(name, duration_minutes), professional:profiles!professional_id(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("triage_records")
          .select("id, chief_complaint, priority, triaged_at, appointment_id, patient:patients(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "pendente")
          .order("triaged_at", { ascending: true })
          .limit(8),
        supabase
          .from("medical_records")
          .select("id, template_type, created_at, patient:patients(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("waitlist")
          .select("id, priority, preferred_period, created_at, patient:patients(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "waiting")
          .order("created_at", { ascending: true })
          .limit(5),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .eq("status", "completed")
          .gte("scheduled_at", monthStart)
          .lte("scheduled_at", monthEnd),
      ]);

      setAppointments((aptsRes.data as unknown as Appointment[]) || []);
      const triagesRaw = (triagesRes.data || []) as any[];
      setPendingTriages(triagesRaw.map((t) => ({
        id: t.id,
        client_name: t.patient?.name || "Paciente",
        priority: t.priority,
        chief_complaint: t.chief_complaint || "",
        triaged_at: t.triaged_at,
        appointment_id: t.appointment_id,
      })));
      const recordsRaw = (recordsRes.data || []) as any[];
      setRecentRecords(recordsRaw.map((r) => ({
        id: r.id,
        client_name: r.patient?.name || "Paciente",
        template_type: r.template_type,
        created_at: r.created_at,
      })));
      const waitlistRaw = (waitlistRes.data || []) as any[];
      setWaitlistItems(waitlistRaw.map((w) => ({
        id: w.id,
        client_name: w.patient?.name || "Paciente",
        priority: w.priority || "normal",
        preferred_period: w.preferred_period,
        created_at: w.created_at,
      })));
      setMonthCompleted(completedRes.count ?? 0);
    } catch (e) {
      logger.error("DashboardMedico fetch error:", e);
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

        {pendingTriages.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Atenção</span>
            </div>
            <p className="text-3xl font-extrabold tabular-nums leading-none text-amber-700">{pendingTriages.length}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Triagens pendentes</p>
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
                <p className="truncate text-xl font-bold leading-tight">{nextAppointment.patient?.name || "Paciente"}</p>
                {nextAppointment.procedure?.name && <p className="mt-0.5 truncate text-sm text-teal-100">{nextAppointment.procedure.name}</p>}
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
              <Link to={`/prontuarios?new=1&patient_id=${nextAppointment.patient_id}&appointment_id=${nextAppointment.id}`}>
                Iniciar atendimento <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Commission Tier Indicator */}
      <CommissionTierIndicator />

      {/* Botão Chamar Próximo - destaque para médico */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <Megaphone className="h-5 w-5 text-teal-600" />
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
                <Button variant="link" asChild className="mt-1 h-auto p-0 text-teal-600 text-xs">
                  <Link to="/agenda"><Plus className="mr-1 h-3 w-3" />Criar agendamento</Link>
                </Button>
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
                        <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                        {apt.procedure?.name && <p className="text-xs text-muted-foreground truncate">{apt.procedure.name}</p>}
                      </div>
                      <Badge variant="outline" className={sb?.className}>{sb?.label}</Badge>
                    </div>
                  );
                })}
                {appointments.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{appointments.length - 8} agendamento{appointments.length - 8 > 1 ? "s" : ""} •{" "}
                    <Link to="/agenda" className="text-teal-600 hover:underline font-medium">ver agenda</Link>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Triagens pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
                <ClipboardList className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Triagens pendentes</CardTitle>
                <CardDescription className="text-xs">Pacientes aguardando atendimento</CardDescription>
              </div>
            </div>
            {pendingTriages.length > 0 && (
              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">{pendingTriages.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {pendingTriages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sem triagens pendentes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTriages.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.client_name}</p>
                      {t.chief_complaint && <p className="text-xs text-muted-foreground truncate">{t.chief_complaint}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={priorityStyles[t.priority] || priorityStyles.nao_urgente}>
                        {priorityLabels[t.priority] || t.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatInAppTz(new Date(t.triaged_at), "HH:mm")}</span>
                      <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50 h-7 px-2">
                        <Link to={`/prontuarios?new=1&patient_id=${t.patient_id}&triage_id=${t.id}${t.appointment_id ? `&appointment_id=${t.appointment_id}` : ""}`}>
                          Atender <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Últimos prontuários */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base font-semibold">Últimos prontuários</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/prontuarios">Ver todos →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum prontuário registrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRecords.map((r) => (
                  <Link key={r.id} to={`/prontuarios/${r.id}`} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 hover:bg-muted/40 transition-colors [&:hover]:no-underline">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.client_name}</p>
                      {r.template_type && <p className="text-xs text-muted-foreground truncate capitalize">{r.template_type.replace(/_/g, " ")}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatInAppTz(new Date(r.created_at), "dd/MM HH:mm")}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de espera */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base font-semibold">Lista de espera</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/lista-espera">Ver todos →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {waitlistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum paciente em espera</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waitlistItems.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{w.client_name}</p>
                      {w.preferred_period && <p className="text-xs text-muted-foreground truncate capitalize">{w.preferred_period}</p>}
                    </div>
                    <Badge variant="outline" className={priorityStyles[w.priority] || priorityStyles.normal}>
                      {priorityLabels[w.priority] || w.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
