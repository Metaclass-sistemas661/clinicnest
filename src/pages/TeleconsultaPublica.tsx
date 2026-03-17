import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Video as VideoIcon,
  Clock,
  Stethoscope,
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VideoRoom } from "@/components/teleconsulta/VideoRoom";

interface AppointmentInfo {
  id: string;
  tenant_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  service_name: string;
  professional_name: string;
  clinic_name: string;
  client_name: string;
}

export default function TeleconsultaPublica() {
  const { token } = useParams<{ token: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    token: string;
    roomName: string;
    identity: string;
    appointmentLabel: string;
    professionalName: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link inválido.");
      setIsLoading(false);
      return;
    }
    void validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "get_appointment_by_telemedicine_token",
        { p_token: token }
      );

      if (rpcError) throw rpcError;

      if (data?.error) {
        setError("Este link de teleconsulta é inválido ou já expirou.");
        return;
      }

      setAppointment(data as AppointmentInfo);
    } catch (err) {
      logger.error("TeleconsultaPublica validate:", err);
      setError("Erro ao validar o link. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const joinCall = async () => {
    if (!appointment || !token) return;
    setIsJoining(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("twilio-video-token", {
        body: {
          appointment_id: appointment.id,
          role: "patient",
          public_token: token,
        },
      });

      if (fnError) throw fnError;
      if (!data?.token || !data?.room_name) {
        throw new Error("Resposta inválida");
      }

      const time = format(new Date(appointment.scheduled_at), "HH:mm", { locale: ptBR });

      setActiveCall({
        token: data.token,
        roomName: data.room_name,
        identity: data.identity,
        appointmentLabel: `${time} · ${appointment.service_name} · ${appointment.clinic_name}`,
        professionalName: appointment.professional_name || "Profissional",
      });
    } catch (err) {
      logger.error("TeleconsultaPublica join:", err);
      toast.error("Erro ao entrar na teleconsulta. Tente novamente.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleDisconnect = useCallback(() => {
    setActiveCall(null);
    toast.info("Teleconsulta encerrada");
  }, []);

  // Active call — show VideoRoom
  if (activeCall) {
    return (
      <div className="min-h-screen bg-gray-950">
        <VideoRoom
          token={activeCall.token}
          roomName={activeCall.roomName}
          identity={activeCall.identity}
          appointmentLabel={activeCall.appointmentLabel}
          patientName={activeCall.professionalName}
          onDisconnect={handleDisconnect}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-50 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600">
            <Heart className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-purple-700 dark:text-purple-400 leading-none">
              ClinicNest
            </div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">
              Teleconsulta
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            <p className="text-sm text-muted-foreground">Validando link...</p>
          </div>
        ) : error ? (
          <Card className="w-full max-w-md">
            <CardContent className="py-10 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Link to="/">
                <Button variant="outline" size="sm">
                  Voltar ao site
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : appointment ? (
          <Card className="w-full max-w-md">
            <CardContent className="py-8 px-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <VideoIcon className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Sua Teleconsulta</h2>
                <p className="text-sm text-muted-foreground">
                  Confira os dados abaixo e clique para entrar na videochamada.
                </p>
              </div>

              <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="font-medium">
                      {format(new Date(appointment.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">{appointment.duration_minutes} minutos</div>
                  </div>
                </div>

                {appointment.professional_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Stethoscope className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{appointment.professional_name}</span>
                  </div>
                )}

                {appointment.service_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{appointment.service_name}</span>
                  </div>
                )}

                {appointment.clinic_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{appointment.clinic_name}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => void joinCall()}
                disabled={isJoining}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-700 hover:to-violet-600 text-white font-semibold shadow-lg shadow-purple-500/25 text-base gap-2"
              >
                {isJoining ? (
                  <>
                    <Spinner size="sm" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <VideoIcon className="h-5 w-5" />
                    Entrar na Teleconsulta
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                <span>Conexão segura e criptografada</span>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ClinicNest by Metaclass · Teleconsulta segura
        </div>
      </footer>
    </div>
  );
}
