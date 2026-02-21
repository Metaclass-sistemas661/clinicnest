import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Video as VideoIcon,
  Clock,
  User,
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VideoRoom } from "@/components/teleconsulta/VideoRoom";

interface TelemedicineAppointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  telemedicine_url: string | null;
  client_name: string;
  professional_name: string;
  service_name: string;
}

function statusLabel(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "confirmed": return { label: "Confirmado", variant: "default" };
    case "pending":   return { label: "Pendente", variant: "secondary" };
    case "completed": return { label: "Concluído", variant: "outline" };
    case "cancelled": return { label: "Cancelado", variant: "destructive" };
    default:          return { label: status, variant: "secondary" };
  }
}

interface ActiveCall {
  token: string;
  roomName: string;
  identity: string;
  appointmentId: string;
  appointmentLabel: string;
  patientName: string;
}

export default function Teleconsulta() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<TelemedicineAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDay, setViewDay] = useState<"today" | "tomorrow">("today");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) void fetchAppointments();
  }, [profile?.tenant_id, viewDay]);

  const fetchAppointments = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const baseDate = viewDay === "today" ? new Date() : addDays(new Date(), 1);
      const from = startOfDay(baseDate).toISOString();
      const to = endOfDay(baseDate).toISOString();

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, scheduled_at, duration_minutes, status, telemedicine_url,
          clients(name),
          profiles!appointments_professional_id_fkey(full_name),
          services(name)
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("telemedicine", true)
        .gte("scheduled_at", from)
        .lte("scheduled_at", to)
        .neq("status", "cancelled")
        .order("scheduled_at");

      if (error) throw error;

      const mapped: TelemedicineAppointment[] = (data ?? []).map((r: any) => ({
        id: r.id,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes,
        status: r.status,
        telemedicine_url: r.telemedicine_url,
        client_name: r.clients?.name ?? "Paciente não informado",
        professional_name: r.profiles?.full_name ?? "—",
        service_name: r.services?.name ?? "—",
      }));

      setAppointments(mapped);
    } catch (err) {
      logger.error("Teleconsulta fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const joinTwilio = async (appt: TelemedicineAppointment) => {
    setJoiningId(appt.id);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-video-token", {
        body: { appointment_id: appt.id, role: "staff" },
      });

      if (error) throw error;
      if (!data?.token || !data?.room_name) {
        throw new Error("Resposta inválida da função");
      }

      const time = format(new Date(appt.scheduled_at), "HH:mm", { locale: ptBR });

      setActiveCall({
        token: data.token,
        roomName: data.room_name,
        identity: data.identity,
        appointmentId: appt.id,
        appointmentLabel: `${time} · ${appt.client_name} · ${appt.service_name}`,
        patientName: appt.client_name,
      });
    } catch (err) {
      logger.error("Join Twilio:", err);
      toast.error("Erro ao entrar na teleconsulta");
    } finally {
      setJoiningId(null);
    }
  };

  const handleDisconnect = useCallback(() => {
    setActiveCall(null);
    toast.info("Teleconsulta encerrada");
  }, []);

  const generateLink = async (apptId: string) => {
    setGeneratingLinkId(apptId);
    try {
      const { data, error } = await (supabase as any).rpc("generate_telemedicine_token", {
        p_appointment_id: apptId,
      });

      if (error) throw error;
      if (!data?.token) throw new Error("Token não gerado");

      const link = `${window.location.origin}/teleconsulta-publica/${data.token}`;

      await navigator.clipboard.writeText(link);
      setCopiedId(apptId);
      setTimeout(() => setCopiedId(null), 3000);

      toast.success("Link copiado!", {
        description: "Envie este link ao paciente por WhatsApp ou e-mail.",
      });
    } catch (err) {
      logger.error("Generate link:", err);
      toast.error("Erro ao gerar link da teleconsulta");
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const todayCount = appointments.filter((a) => isToday(new Date(a.scheduled_at))).length;
  const tomorrowCount = appointments.filter((a) => isTomorrow(new Date(a.scheduled_at))).length;

  // If there's an active call, show the VideoRoom fullscreen-ish
  if (activeCall) {
    return (
      <MainLayout title="Teleconsulta" subtitle="Em chamada">
        <VideoRoom
          token={activeCall.token}
          roomName={activeCall.roomName}
          identity={activeCall.identity}
          appointmentLabel={activeCall.appointmentLabel}
          patientName={activeCall.patientName}
          onDisconnect={handleDisconnect}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Teleconsulta"
      subtitle="Atendimentos remotos via videoconferência"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <div className="flex gap-2 mb-6">
        <Button
          variant={viewDay === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewDay("today")}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Hoje ({todayCount})
        </Button>
        <Button
          variant={viewDay === "tomorrow" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewDay("tomorrow")}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Amanhã ({tomorrowCount})
        </Button>
      </div>

      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Como usar:</strong> Para marcar um agendamento como teleconsulta, ative a opção "Teleconsulta" ao criar o agendamento na Agenda. Clique em "Iniciar Teleconsulta" para entrar na videochamada via Twilio.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title="Nenhuma teleconsulta agendada"
          description={`Não há teleconsultas marcadas para ${viewDay === "today" ? "hoje" : "amanhã"}.`}
        />
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const { label, variant } = statusLabel(appt.status);
            const time = format(new Date(appt.scheduled_at), "HH:mm", { locale: ptBR });
            const isActive = activeCall?.appointmentId === appt.id;

            return (
              <Card key={appt.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {time} · {appt.duration_minutes} min
                    </CardTitle>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>{appt.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Stethoscope className="h-3.5 w-3.5" />
                      <span>{appt.professional_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{appt.service_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => void joinTwilio(appt)}
                      className="gap-1.5"
                      disabled={joiningId === appt.id || appt.status === "completed" || isActive}
                    >
                      <VideoIcon className="h-3.5 w-3.5" />
                      {joiningId === appt.id ? "Entrando..." : "Iniciar Teleconsulta"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void generateLink(appt.id)}
                      className="gap-1.5"
                      disabled={generatingLinkId === appt.id || appt.status === "completed"}
                    >
                      {generatingLinkId === appt.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : copiedId === appt.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5" />
                      )}
                      {copiedId === appt.id ? "Link copiado!" : "Enviar Link ao Paciente"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
