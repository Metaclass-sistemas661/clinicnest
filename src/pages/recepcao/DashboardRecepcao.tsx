import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { CallNextButton } from "@/components/queue/CallNextButton";
import { useWaitingQueue, useQueueStatistics } from "@/hooks/usePatientQueue";
import type { Appointment } from "@/types/database";

const statusBadge: Record<string, { className: string; label: string }> = {
  pending: { className: "bg-warning/20 text-warning border-warning/30", label: "Pendente" },
  confirmed: { className: "bg-info/20 text-info border-info/30", label: "Confirmado" },
  arrived: { className: "bg-violet-500/20 text-violet-600 border-violet-500/30", label: "Chegou" },
  completed: { className: "bg-success/20 text-success border-success/30", label: "Concluído" },
  cancelled: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Cancelado" },
};

interface ReturnReminder {
  id: string;
  client_id: string;
  return_date: string;
  reason: string | null;
  status: string;
  client?: { name: string; phone: string | null };
  professional?: { full_name: string | null };
}

export default function DashboardRecepcao() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue } = useWaitingQueue();
  const { data: statistics } = useQueueStatistics();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [returns, setReturns] = useState<ReturnReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          .select("*, client:clients(name, phone), service:services(name), professional:profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("return_reminders")
          .select("*, client:clients(name, phone), professional:profiles(full_name)")
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
  const confirmedToday = useMemo(() => 
    appointments.filter((a) => a.status === "confirmed"), [appointments]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchData();
    refetchQueue();
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
              <h1 className="text-2xl font-bold">Recepção</h1>
              <p className="text-muted-foreground">Visão unificada do dia</p>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                  <Calendar className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{appointments.length}</p>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={pendingConfirmation.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pendingConfirmation.length > 0 ? "bg-amber-100" : "bg-muted"}`}>
                  <Clock className={`h-5 w-5 ${pendingConfirmation.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${pendingConfirmation.length > 0 ? "text-amber-700" : ""}`}>
                    {pendingConfirmation.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <UserCheck className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{arrivedPatients.length}</p>
                  <p className="text-xs text-muted-foreground">Check-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
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

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Agenda do Dia */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-base">Agenda do Dia</CardTitle>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/agenda">Ver tudo</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {appointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum agendamento hoje</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {appointments.slice(0, 10).map((apt) => {
                      const st = apt.status || "pending";
                      const sb = statusBadge[st];
                      return (
                        <div key={apt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50">
                          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">
                            {formatInAppTz(apt.scheduled_at, "HH:mm")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{apt.client?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{apt.service?.name}</p>
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

          {/* Fila de Espera */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base">Fila de Espera</CardTitle>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/recepcao/fila">Ver tudo</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {queueLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum paciente na fila</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queue.slice(0, 8).map((item: any) => (
                      <div key={item.call_id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50">
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-sm font-bold text-blue-700">
                          {item.call_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.client_name}</p>
                          <p className="text-xs text-muted-foreground">{item.wait_time_minutes} min</p>
                        </div>
                        {item.wait_time_minutes > 30 && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Retornos do Dia */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-cyan-600" />
                  <CardTitle className="text-base">Retornos do Dia</CardTitle>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/retornos-pendentes">Ver tudo</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {returns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarClock className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum retorno hoje</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {returns.map((ret) => (
                      <div key={ret.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ret.client?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{ret.reason || "Retorno"}</p>
                        </div>
                        <Badge variant="outline" className={
                          ret.status === "scheduled" ? "bg-emerald-100 text-emerald-700" :
                          ret.status === "notified" ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
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
        </div>

        {/* Alertas */}
        {(pendingConfirmation.length > 0 || (statistics?.waiting_count || 0) > 5) && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base text-amber-900">Alertas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingConfirmation.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg bg-amber-100/50 p-3">
                    <Phone className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
                        {pendingConfirmation.length} agendamento(s) pendente(s) de confirmação
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/agenda">Confirmar</Link>
                    </Button>
                  </div>
                )}
                {(statistics?.waiting_count || 0) > 5 && (
                  <div className="flex items-center gap-3 rounded-lg bg-amber-100/50 p-3">
                    <Timer className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
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
