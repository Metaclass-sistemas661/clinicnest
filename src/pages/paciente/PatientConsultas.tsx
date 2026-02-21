import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  RefreshCw,
  Video,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { consultasBanners } from "@/components/patient/patientBannerData";

interface PatientAppointment {
  id: string;
  tenant_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  telemedicine: boolean;
  client_name: string;
  service_name: string;
  professional_name: string;
  clinic_name: string;
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

export default function PatientConsultas() {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    void fetchAppointments();
  }, [filter]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const params: Record<string, string | null> = {
        p_from: filter === "past" ? null : now,
        p_to: filter === "upcoming" ? null : (filter === "past" ? now : null),
        p_status: null,
      };

      const { data, error } = await (supabasePatient as any).rpc("get_patient_appointments", params);

      if (error) throw error;

      const list = (Array.isArray(data) ? data : []) as PatientAppointment[];

      // Sort: upcoming = asc, past = desc
      if (filter === "upcoming") {
        list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      }

      setAppointments(list);
    } catch (err) {
      logger.error("PatientConsultas fetch:", err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PatientLayout
      title="Minhas Consultas"
      subtitle="Histórico e próximos agendamentos"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <PatientBannerCarousel slides={consultasBanners} />

      <div className="flex gap-2 mb-6">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f === "upcoming" ? "Próximas" : f === "past" ? "Anteriores" : "Todas"}
          </Button>
        ))}
      </div>

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
          icon={Calendar}
          title="Nenhuma consulta encontrada"
          description={
            filter === "upcoming"
              ? "Você não tem consultas agendadas. Quando sua clínica vincular seu cadastro, suas consultas aparecerão aqui."
              : "Nenhuma consulta encontrada para o filtro selecionado."
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const { label, variant } = statusLabel(appt.status);
            const date = new Date(appt.scheduled_at);
            const dateStr = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
            const time = format(date, "HH:mm", { locale: ptBR });

            return (
              <Card key={appt.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{dateStr}</span>
                        <span className="text-muted-foreground">às</span>
                        <span>{time}</span>
                        {appt.telemedicine && (
                          <Badge variant="outline" className="text-teal-600 border-teal-200 text-[10px] px-1.5 py-0">
                            <Video className="h-3 w-3 mr-1" />
                            Teleconsulta
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {appt.duration_minutes} min
                      </div>
                    </div>
                    <Badge variant={variant}>{label}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Stethoscope className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{appt.professional_name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{appt.service_name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{appt.clinic_name || "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PatientLayout>
  );
}
