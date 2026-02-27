import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  Clock,
  UserCheck,
  Calendar,
  CalendarClock,
  ExternalLink,
  RefreshCw,
  Megaphone,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Bell,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { CallNextButton } from "@/components/queue/CallNextButton";
import { useWaitingQueue, useCurrentCall, useQueueStatistics } from "@/hooks/usePatientQueue";
import type { Appointment } from "@/types/database";

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning border-warning/30", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info border-info/30", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600 border-violet-500/30", label: "Chegou" },
  completed: { className: "bg-success/20 text-success border-success/30", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Cancelado" },
};

const priorityColors: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-blue-500 text-white",
  5: "bg-slate-500 text-white",
};

const priorityLabels: Record<number, string> = {
  1: "Emergencia",
  2: "Prioritario",
  3: "Idoso 60+",
  4: "Preferencial",
  5: "Normal",
};

interface QueueItem {
  call_id: string;
  patient_id: string;
  client_name: string;
  call_number: number;
  priority: number;
  priority_label: string | null;
  room_name: string | null;
  professional_name: string | null;
  checked_in_at: string;
  wait_time_minutes: number;
  queue_position: number;
  appointment_id: string | null;
  service_name: string | null;
}

interface ReturnReminder {
  id: string;
  patient_id: string;
  return_date: string;
  reason: string | null;
  status: string;
  patient?: { name: string; phone: string | null };
  professional?: { full_name: string | null };
}

export default function DashboardRecepcao() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue } = useWaitingQueue();
  const { data: currentCall, refetch: refetchCurrent } = useCurrentCall();
  const { data: statistics } = useQueueStatistics();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [returns, setReturns] = useState<ReturnReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeTab = searchParams.get("tab") || "agenda";

  const fetchData = async () => {
    if (!profile?.tenant_id) return;
    
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const todayStr = now.toISOString().split("T")[0];

    try {
      const [aptsRes, returnsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, patient:patients(name, phone), procedure:procedures(name), professional:profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("return_reminders")
          .select("*, patient:patients(name, phone), professional:profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("return_date", todayStr)
          .in("status", ["pending", "notified", "scheduled"])
          .order("return_date", { ascending: true }),
      ]);

      setAppointments((aptsRes.data as unknown as Appointment[]) || []);
      setReturns((returnsRes.data as unknown as ReturnReminder[]) || []);
    } catch (e) {
      logger.error("Dashboard fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [profile?.tenant_id]);

  const pendingConfirmation = useMemo(() => 
    appointments.filter((a) => a.status === "pending"), [appointments]);
  const arrivedPatients = useMemo(() => 
    appointments.filter((a) => a.status === "arrived"), [appointments]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchData();
    refetchQueue();
    refetchCurrent();
  };

  /* ── Queue actions (from FilaAtendimento) ── */
  const handleRecall = async (callId: string) => {
    if (!profile?.tenant_id) return;
    setActionLoading(callId);
    try {
      const { error } = await supabase.rpc("recall_patient", {
        p_tenant_id: profile.tenant_id,
        p_call_id: callId,
      });
      if (error) throw error;
      toast.success("Paciente rechamado");
      refetchCurrent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao rechamar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartService = async (callId: string) => {
    if (!profile?.tenant_id) return;
    setActionLoading(callId);
    try {
      const { error } = await supabase.rpc("start_patient_service", {
        p_tenant_id: profile.tenant_id,
        p_call_id: callId,
      });
      if (error) throw error;
      toast.success("Atendimento iniciado");
      refetchQueue();
      refetchCurrent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar atendimento");
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (callId: string) => {
    if (!profile?.tenant_id) return;
    setActionLoading(callId);
    try {
      const { error } = await supabase.rpc("mark_patient_no_show", {
        p_tenant_id: profile.tenant_id,
        p_call_id: callId,
      });
      if (error) throw error;
      toast.success("Paciente marcado como nao compareceu");
      refetchQueue();
      refetchCurrent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao marcar nao comparecimento");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Recepcao</h1>
              <p className="text-muted-foreground">Visao unificada do dia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/painel-chamada" target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Painel TV
              </Link>
            </Button>
            <CallNextButton className="gradient-primary text-primary-foreground" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
                  <Calendar className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{appointments.length}</p>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={pendingConfirmation.length > 0 ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pendingConfirmation.length > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
                  <Clock className={`h-5 w-5 ${pendingConfirmation.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${pendingConfirmation.length > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {pendingConfirmation.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setSearchParams({ tab: "fila" })}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics?.waiting_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Na Fila</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
                  <UserCheck className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{arrivedPatients.length}</p>
                  <p className="text-xs text-muted-foreground">Check-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-cyan-300 transition-colors" onClick={() => setSearchParams({ tab: "retornos" })}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                  <CalendarClock className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{returns.length}</p>
                  <p className="text-xs text-muted-foreground">Retornos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agenda" className="gap-2">
              <Calendar className="h-4 w-4" />
              Agenda do Dia
            </TabsTrigger>
            <TabsTrigger value="fila" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Fila de Chamada
              {(statistics?.waiting_count || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {statistics?.waiting_count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="retornos" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Retornos
              {returns.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {returns.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Agenda do Dia ── */}
          <TabsContent value="agenda" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-teal-600" />
                    <CardTitle className="text-base">Agenda do Dia</CardTitle>
                    <Badge variant="outline">{appointments.length} agendamentos</Badge>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/agenda">Abrir Agenda</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px]">
                  {appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Nenhum agendamento hoje</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {appointments.map((apt) => {
                        const st = apt.status || "pending";
                        const sb = statusBadge[st];
                        return (
                          <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                            <span className="shrink-0 rounded bg-muted px-2.5 py-1 text-xs font-bold tabular-nums">
                              {formatInAppTz(apt.scheduled_at, "HH:mm")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{apt.patient?.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {apt.procedure?.name}
                                {apt.professional?.full_name && ` - ${apt.professional.full_name}`}
                              </p>
                            </div>
                            <Badge variant="outline" className={`text-[10px] ${sb?.className}`}>{sb?.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Fila de Chamada ── */}
          <TabsContent value="fila" className="space-y-4">
            {/* Queue Statistics */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statistics?.waiting_count || 0}</p>
                      <p className="text-sm text-muted-foreground">Aguardando</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                      <Megaphone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statistics?.calling_count || 0}</p>
                      <p className="text-sm text-muted-foreground">Sendo chamados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statistics?.in_service_count || 0}</p>
                      <p className="text-sm text-muted-foreground">Em atendimento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
                      <Timer className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{statistics?.avg_wait_minutes || 0} min</p>
                      <p className="text-sm text-muted-foreground">Tempo medio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Current Call */}
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-amber-600" />
                    <CardTitle>Chamada Atual</CardTitle>
                  </div>
                  <CardDescription>Paciente sendo chamado agora</CardDescription>
                </CardHeader>
                <CardContent>
                  {currentCall ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                            Senha {currentCall.call_number}
                          </p>
                          <p className="text-lg font-semibold">{currentCall.client_name}</p>
                          {currentCall.room_name && (
                            <p className="text-muted-foreground">
                              Sala: {currentCall.room_name}
                            </p>
                          )}
                        </div>
                        <Badge className={priorityColors[currentCall.priority] || priorityColors[5]}>
                          {currentCall.priority_label || priorityLabels[currentCall.priority] || "Normal"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecall(currentCall.call_id)}
                          disabled={actionLoading === currentCall.call_id}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Rechamar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleStartService(currentCall.call_id)}
                          disabled={actionLoading === currentCall.call_id}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Atendimento
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleNoShow(currentCall.call_id)}
                          disabled={actionLoading === currentCall.call_id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Nao Compareceu
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Megaphone className="h-12 w-12 text-amber-300 mb-3" />
                      <p className="text-muted-foreground">Nenhum paciente sendo chamado</p>
                      <p className="text-sm text-muted-foreground">
                        Clique em "Chamar" para iniciar
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Waiting Queue */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <CardTitle>Fila de Espera</CardTitle>
                    </div>
                    <Badge variant="outline">{queue.length} pacientes</Badge>
                  </div>
                  <CardDescription>Pacientes aguardando atendimento</CardDescription>
                </CardHeader>
                <CardContent>
                  {queueLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Nenhum paciente na fila</p>
                      <p className="text-sm text-muted-foreground">
                        Pacientes entram na fila ao fazer check-in
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {queue.map((item: QueueItem, index: number) => (
                          <div
                            key={item.call_id}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                              index === 0 ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30" : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-bold">
                              {item.call_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{item.client_name}</p>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${priorityColors[item.priority] || ""}`}
                                >
                                  {item.priority_label || priorityLabels[item.priority] || "Normal"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {item.service_name && <span>{item.service_name}</span>}
                                {item.professional_name && <span>- {item.professional_name}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                <span className={item.wait_time_minutes > 30 ? "text-red-600 font-medium" : ""}>
                                  {item.wait_time_minutes} min
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatInAppTz(item.checked_in_at, "HH:mm")}
                              </p>
                            </div>
                            {item.wait_time_minutes > 30 && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB: Retornos ── */}
          <TabsContent value="retornos" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-cyan-600" />
                    <CardTitle className="text-base">Retornos do Dia</CardTitle>
                    <Badge variant="outline">{returns.length} retornos</Badge>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/retornos-pendentes">Ver todos</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px]">
                  {returns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CalendarClock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Nenhum retorno hoje</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {returns.map((ret) => (
                        <div key={ret.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ret.patient?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {ret.reason || "Retorno"}
                              {ret.professional?.full_name && ` - ${ret.professional.full_name}`}
                            </p>
                          </div>
                          <Badge variant="outline" className={
                            ret.status === "scheduled" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                            ret.status === "notified" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          }>
                            {ret.status === "scheduled" ? "Confirmado" : 
                             ret.status === "notified" ? "Notificado" : "Pendente"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Alertas */}
        {(pendingConfirmation.length > 0 || (statistics?.waiting_count || 0) > 5) && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base text-amber-900 dark:text-amber-400">Alertas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingConfirmation.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 p-3">
                    <Phone className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                        {pendingConfirmation.length} agendamento(s) pendente(s) de confirmacao
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/agenda">Confirmar</Link>
                    </Button>
                  </div>
                )}
                {(statistics?.waiting_count || 0) > 5 && (
                  <div className="flex items-center gap-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 p-3">
                    <Timer className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                        Fila com {statistics?.waiting_count} pacientes aguardando
                      </p>
                    </div>
                    <CallNextButton size="sm" variant="outline" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
