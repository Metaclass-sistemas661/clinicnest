import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Video as VideoIcon,
  ExternalLink,
  Copy,
  Clock,
  User,
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import TwilioVideo from "twilio-video";
import type { Room, RemoteParticipant, TrackPublication } from "twilio-video";

type AttachableTrack = {
  attach: () => HTMLElement;
  detach: () => HTMLElement[];
};

function isAttachableTrack(track: unknown): track is AttachableTrack {
  if (!track || typeof track !== "object") return false;
  const t = track as Record<string, unknown>;
  return typeof t.attach === "function" && typeof t.detach === "function";
}

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

function generateJitsiUrl(appointmentId: string): string {
  const roomId = appointmentId.replace(/-/g, "").substring(0, 20);
  return `https://meet.jit.si/clinicnest-${roomId}`;
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

export default function Teleconsulta() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<TelemedicineAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [viewDay, setViewDay] = useState<"today" | "tomorrow">("today");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localMediaRef = useRef<HTMLDivElement | null>(null);
  const remoteMediaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) void fetchAppointments();
  }, [profile?.tenant_id, viewDay]);

  useEffect(() => {
    return () => {
      try {
        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }
      } catch (e) {
        void e;
      }
    };
  }, []);

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

  const generateLink = async (appt: TelemedicineAppointment) => {
    setGeneratingId(appt.id);
    try {
      const url = generateJitsiUrl(appt.id);
      const { error } = await supabase
        .from("appointments")
        .update({ telemedicine_url: url })
        .eq("id", appt.id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Link gerado com sucesso");
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, telemedicine_url: url } : a))
      );
    } catch (err) {
      logger.error("Generate link:", err);
      toast.error("Erro ao gerar link");
    } finally {
      setGeneratingId(null);
    }
  };

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const clearMedia = () => {
    if (localMediaRef.current) localMediaRef.current.innerHTML = "";
    if (remoteMediaRef.current) remoteMediaRef.current.innerHTML = "";
  };

  const attachTrack = (track: AttachableTrack, container: HTMLDivElement | null) => {
    if (!container) return;
    const el = track.attach() as HTMLElement;
    el.style.width = "100%";
    el.style.borderRadius = "12px";
    container.appendChild(el);
  };

  const attachLocalParticipant = (room: Room) => {
    const localParticipant = room.localParticipant;
    if (!localParticipant) return;

    localParticipant.tracks.forEach((publication: TrackPublication) => {
      const track = publication.track;
      if (isAttachableTrack(track)) attachTrack(track, localMediaRef.current);
    });
  };

  const attachParticipant = (participant: RemoteParticipant) => {
    participant.tracks.forEach((publication: TrackPublication) => {
      const track = publication.track;
      if (isAttachableTrack(track)) attachTrack(track, remoteMediaRef.current);
    });

    participant.on("trackSubscribed", (track: unknown) => {
      if (isAttachableTrack(track)) attachTrack(track, remoteMediaRef.current);
    });

    participant.on("trackUnsubscribed", (track: unknown) => {
      try {
        if (isAttachableTrack(track)) track.detach().forEach((el) => el.remove());
      } catch (e) {
        void e;
      }
    });
  };

  const leaveCall = () => {
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch (e) {
      void e;
    }
    clearMedia();
    setIsInCall(false);
    setActiveAppointmentId(null);
  };

  const joinTwilio = async (appt: TelemedicineAppointment) => {
    setJoiningId(appt.id);
    try {
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (e) {
          void e;
        }
        roomRef.current = null;
      }

      clearMedia();

      const { data, error } = await supabase.functions.invoke("twilio-video-token", {
        body: { appointment_id: appt.id, role: "staff" },
      });

      if (error) throw error;
      if (!data?.token || !data?.room_name) {
        throw new Error("Resposta inválida da função");
      }

      const room = await TwilioVideo.connect(data.token as string, {
        name: data.room_name,
        audio: true,
        video: { width: 640 },
      });

      roomRef.current = room;
      setActiveAppointmentId(appt.id);
      setIsInCall(true);

      attachLocalParticipant(room);

      room.participants.forEach((p) => attachParticipant(p));

      room.on("participantConnected", (p) => {
        attachParticipant(p as RemoteParticipant);
      });

      room.on("participantDisconnected", (p) => {
        try {
          (p as RemoteParticipant).tracks.forEach((pub: TrackPublication) => {
            const track = pub.track;
            if (isAttachableTrack(track)) {
              try {
                track.detach().forEach((el) => el.remove());
              } catch (e) {
                void e;
              }
            }
          });
        } catch (e) {
          void e;
        }
      });

      room.on("disconnected", () => {
        leaveCall();
      });
    } catch (err) {
      logger.error("Join Twilio:", err);
      toast.error("Erro ao entrar na teleconsulta");
      leaveCall();
    } finally {
      setJoiningId(null);
    }
  };

  const todayCount = appointments.filter((a) => isToday(new Date(a.scheduled_at))).length;
  const tomorrowCount = appointments.filter((a) => isTomorrow(new Date(a.scheduled_at))).length;

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
      {/* Filtro de dia */}
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

      {/* Aviso de como configurar */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Como usar:</strong> Para marcar um agendamento como teleconsulta, ative a opção "Teleconsulta" ao criar o agendamento na Agenda. Um link do Jitsi Meet será gerado automaticamente.
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
            const hasLink = !!appt.telemedicine_url;

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

                  {hasLink ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {appt.telemedicine_url}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void joinTwilio(appt)}
                        className="gap-1.5"
                        disabled={joiningId === appt.id || appt.status === "completed"}
                      >
                        <VideoIcon className="h-3.5 w-3.5" />
                        {joiningId === appt.id ? "Entrando..." : "Entrar (Twilio)"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(appt.telemedicine_url!)}
                        className="gap-1.5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openLink(appt.telemedicine_url!)}
                        className="gap-1.5"
                        disabled={appt.status === "completed"}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Iniciar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void generateLink(appt)}
                      disabled={generatingId === appt.id || appt.status === "completed"}
                      className="gap-1.5"
                    >
                      <VideoIcon className="h-3.5 w-3.5" />
                      {generatingId === appt.id ? "Gerando..." : "Gerar Link Jitsi"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {isInCall && activeAppointmentId ? (
            <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">Teleconsulta em andamento</CardTitle>
                  <Button size="sm" variant="destructive" onClick={leaveCall}>
                    Sair
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Você</div>
                    <div ref={localMediaRef} className="w-full min-h-[180px] bg-muted rounded-xl overflow-hidden" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Paciente</div>
                    <div ref={remoteMediaRef} className="w-full min-h-[180px] bg-muted rounded-xl overflow-hidden" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </MainLayout>
  );
}
