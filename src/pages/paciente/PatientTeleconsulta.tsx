import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Video as VideoIcon,
  Clock,
  Stethoscope,
  RefreshCw,
  Calendar,
  Building2,
  History,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VideoRoom } from "@/components/teleconsulta/VideoRoom";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { teleconsultaBanners } from "@/components/patient/patientBannerData";

interface TelemedicineAppt {
  id: string;
  tenant_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  service_name: string;
  professional_name: string;
  clinic_name: string;
}

interface ActiveCall {
  token: string;
  roomName: string;
  identity: string;
  appointmentLabel: string;
  professionalName: string;
}

export default function PatientTeleconsulta() {
  const [appointments, setAppointments] = useState<TelemedicineAppt[]>([]);
  const [pastAppointments, setPastAppointments] = useState<TelemedicineAppt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    void fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await (apiPatient as any).rpc("get_patient_telemedicine_appointments", {
        p_date: today,
      });

      if (error) throw error;
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error("PatientTeleconsulta fetch:", err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPastAppointments = async () => {
    if (pastAppointments.length > 0) return; // já carregou
    setIsLoadingPast(true);
    try {
      // Buscar consultas passadas com telemedicina via get_patient_appointments
      const now = new Date().toISOString();
      const { data, error } = await (apiPatient as any).rpc("get_patient_appointments", {
        p_from: null,
        p_to: now,
        p_status: null,
      });

      if (error) throw error;
      const all = (Array.isArray(data) ? data : []) as Array<TelemedicineAppt & { telemedicine?: boolean }>;
      // Filtrar somente teleconsultas
      const teleconsultas = all.filter((a) => a.telemedicine === true);
      // Ordenar por mais recente primeiro
      teleconsultas.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      setPastAppointments(teleconsultas);
    } catch (err) {
      logger.error("PatientTeleconsulta fetchPast:", err);
      setPastAppointments([]);
    } finally {
      setIsLoadingPast(false);
    }
  };

  const joinCall = async (appt: TelemedicineAppt) => {
    setJoiningId(appt.id);
    try {
      const { data, error } = await apiPatient.functions.invoke("twilio-video-token", {
        body: { appointment_id: appt.id, role: "patient" },
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
        appointmentLabel: `${time} · ${appt.service_name} · ${appt.clinic_name}`,
        professionalName: appt.professional_name || "Profissional",
      });
    } catch (err) {
      logger.error("Patient join Twilio:", err);
      toast.error("Erro ao entrar na teleconsulta");
    } finally {
      setJoiningId(null);
    }
  };

  const handleDisconnect = useCallback(() => {
    setActiveCall(null);
    toast.info("Teleconsulta encerrada");
  }, []);

  if (activeCall) {
    return (
      <PatientLayout title="Teleconsulta" subtitle="Em chamada">
        <VideoRoom
          token={activeCall.token}
          roomName={activeCall.roomName}
          identity={activeCall.identity}
          appointmentLabel={activeCall.appointmentLabel}
          patientName={activeCall.professionalName}
          onDisconnect={handleDisconnect}
        />
      </PatientLayout>
    );
  }

  return (
    <PatientLayout
      title="Teleconsulta"
      subtitle="Suas consultas por vídeo"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <PatientBannerCarousel slides={teleconsultaBanners} />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === "history") void fetchPastAppointments();
        }}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="today" className="gap-1.5">
            <VideoIcon className="h-3.5 w-3.5" />
            Hoje
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Aba: Teleconsultas de hoje */}
        <TabsContent value="today">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
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
              title="Nenhuma teleconsulta para hoje"
              description="Quando sua clínica agendar uma teleconsulta, ela aparecerá aqui."
            />
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const time = format(new Date(appt.scheduled_at), "HH:mm", { locale: ptBR });

                return (
                  <Card key={appt.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {time} · {appt.duration_minutes} min
                        </CardTitle>
                        <Badge variant="secondary">
                          {appt.status === "confirmed" ? "Confirmado" : "Pendente"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Stethoscope className="h-3.5 w-3.5" />
                          <span>{appt.professional_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{appt.service_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{appt.clinic_name || "—"}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => void joinCall(appt)}
                        className="gap-1.5 bg-teal-600 hover:bg-teal-700"
                        disabled={joiningId === appt.id}
                      >
                        <VideoIcon className="h-3.5 w-3.5" />
                        {joiningId === appt.id ? "Entrando..." : "Entrar na Teleconsulta"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba: Histórico de teleconsultas */}
        <TabsContent value="history">
          {isLoadingPast ? (
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
          ) : pastAppointments.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhuma teleconsulta anterior"
              description="Seu histórico de teleconsultas aparecerá aqui quando você tiver consultas realizadas."
            />
          ) : (
            <div className="space-y-4">
              {pastAppointments.map((appt) => {
                const dateStr = format(new Date(appt.scheduled_at), "dd/MM/yyyy", { locale: ptBR });
                const time = format(new Date(appt.scheduled_at), "HH:mm", { locale: ptBR });
                const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                  completed: { label: "Realizada", variant: "default" },
                  confirmed: { label: "Confirmada", variant: "secondary" },
                  cancelled: { label: "Cancelada", variant: "destructive" },
                  pending: { label: "Pendente", variant: "outline" },
                };
                const st = statusMap[appt.status] || { label: appt.status, variant: "secondary" as const };

                return (
                  <Card key={appt.id} className="hover:shadow-sm transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {dateStr} às {time}
                        </CardTitle>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Stethoscope className="h-3.5 w-3.5" />
                          <span>{appt.professional_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <VideoIcon className="h-3.5 w-3.5" />
                          <span>{appt.service_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{appt.clinic_name || "—"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PatientLayout>
  );
}
