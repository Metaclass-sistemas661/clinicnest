import { useState, useEffect } from "react";
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
  Phone,
  Play,
  RotateCcw,
  XCircle,
  ExternalLink,
  RefreshCw,
  Megaphone,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatInAppTz } from "@/lib/date";
import { toast } from "sonner";
import { CallNextButton } from "@/components/queue/CallNextButton";
import { useWaitingQueue, useCurrentCall, useQueueStatistics, useQueueRealtime } from "@/hooks/usePatientQueue";

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

const priorityColors: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-blue-500 text-white",
  5: "bg-slate-500 text-white",
};

const priorityLabels: Record<number, string> = {
  1: "Emergência",
  2: "Prioritário",
  3: "Idoso 60+",
  4: "Preferencial",
  5: "Normal",
};

export default function FilaAtendimento() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: queue = [], isLoading, refetch } = useWaitingQueue(20);
  const { data: currentCall, refetch: refetchCurrent } = useCurrentCall();
  const { data: statistics } = useQueueStatistics();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Realtime: atualiza fila instantaneamente
  useQueueRealtime();

  const handleRecall = async (callId: string) => {
    if (!profile?.tenant_id) return;
    setActionLoading(callId);
    try {
      const { error } = await supabase.rpc("recall_patient", {
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
        p_call_id: callId,
      });
      if (error) throw error;
      toast.success("Atendimento iniciado");
      refetch();
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
        p_call_id: callId,
      });
      if (error) throw error;
      toast.success("Paciente marcado como não compareceu");
      refetch();
      refetchCurrent();
    } catch (e: any) {
      toast.error(e.message || "Erro ao marcar não comparecimento");
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Fila de Atendimento</h1>
              <p className="text-muted-foreground">
                Gerencie a fila de pacientes aguardando
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/painel-chamada" target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Painel TV
              </Link>
            </Button>
            <CallNextButton className="gradient-primary text-primary-foreground" />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <Timer className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics?.avg_wait_time_minutes ? Math.round(statistics.avg_wait_time_minutes) : 0} min</p>
                  <p className="text-sm text-muted-foreground">Tempo médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current Call */}
          <Card className="border-amber-200 bg-amber-50/50">
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
                      <p className="text-3xl font-bold text-amber-700">
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
                      Não Compareceu
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Megaphone className="h-12 w-12 text-amber-300 mb-3" />
                  <p className="text-muted-foreground">Nenhum paciente sendo chamado</p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Chamar Próximo" para iniciar
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
              {isLoading ? (
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
                          index === 0 ? "border-blue-200 bg-blue-50/50" : "hover:bg-muted/50"
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
                            {item.professional_name && <span>• {item.professional_name}</span>}
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
      </div>
    </MainLayout>
  );
}
