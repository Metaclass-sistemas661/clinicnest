import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  CalendarPlus,
  Clock,
  Stethoscope,
  Building2,
  RefreshCw,
  Video,
  XCircle,
  CalendarClock,
  AlertTriangle,
  Loader2,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, addHours, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { consultasBanners } from "@/components/patient/patientBannerData";
import { SlotPicker } from "@/components/patient/SlotPicker";

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
  procedure_id: string;
  professional_name: string;
  professional_id: string;
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

interface Slot {
  slot_date: string;
  slot_time: string;
  slot_datetime: string;
}

const MIN_HOURS_CANCEL = 24;

function canModify(appt: PatientAppointment): { allowed: boolean; reason?: string } {
  if (appt.status !== "pending" && appt.status !== "confirmed") {
    return { allowed: false, reason: "Só consultas pendentes ou confirmadas podem ser alteradas." };
  }
  const hoursUntil = (new Date(appt.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < MIN_HOURS_CANCEL) {
    return { allowed: false, reason: `Alterações devem ser feitas com pelo menos ${MIN_HOURS_CANCEL}h de antecedência.` };
  }
  return { allowed: true };
}

export default function PatientConsultas() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<PatientAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Check-in
  const [checkinTarget, setCheckinTarget] = useState<PatientAppointment | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Reschedule dialog
  const [rescheduleTarget, setRescheduleTarget] = useState<PatientAppointment | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<Slot | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  useEffect(() => {
    void fetchAppointments();
  }, [filter]);

  // ── Supabase Realtime: escutar alterações de consultas em tempo real ──
  useEffect(() => {
    let channel: ReturnType<typeof supabasePatient.channel> | null = null;

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabasePatient.auth.getUser();
        if (!user) return;

        const { data: link } = await supabasePatient
          .from("patient_profiles")
          .select("client_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!link?.client_id) return;

        channel = supabasePatient
          .channel("patient-appointments-realtime")
          .on(
            "postgres_changes" as any,
            {
              event: "*",
              schema: "public",
              table: "appointments",
              filter: `patient_id=eq.${link.client_id}`,
            },
            () => {
              // Qualquer alteração nos agendamentos — recarregar
              void fetchAppointments();
            }
          )
          .subscribe();
      } catch {
        // Falha no realtime não deve impedir o uso
      }
    };

    void setupRealtime();

    return () => {
      if (channel) {
        void supabasePatient.removeChannel(channel);
      }
    };
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

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("patient_cancel_appointment", {
        p_appointment_id: cancelTarget.id,
        p_reason: cancelReason.trim() || null,
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success) {
        toast.success(result.message || "Consulta cancelada com sucesso");
      }
      setCancelTarget(null);
      setCancelReason("");
      void fetchAppointments();
    } catch (err: any) {
      logger.error("PatientConsultas cancel:", err);
      const msg = err?.message || "Erro ao cancelar consulta";
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Check-in Online ────────────────────────────────────────────────────────
  const canCheckin = (appt: PatientAppointment): boolean => {
    if (appt.status !== "pending" && appt.status !== "confirmed") return false;
    const hoursUntil = (new Date(appt.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil <= 24 && hoursUntil > -2;
  };

  const handleCheckin = async () => {
    if (!checkinTarget) return;
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("patient_online_checkin", {
        p_appointment_id: checkinTarget.id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success) {
        toast.success(result.message || "Check-in realizado com sucesso!");
      } else {
        toast.error(result?.message || "Erro ao fazer check-in");
      }
      setCheckinTarget(null);
      void fetchAppointments();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fazer check-in");
    } finally {
      setIsCheckingIn(false);
    }
  };

  // ── Reschedule ─────────────────────────────────────────────────────────────
  const openRescheduleDialog = (appt: PatientAppointment) => {
    setRescheduleTarget(appt);
    setSelectedRescheduleSlot(null);
    setRescheduleReason("");
    setRescheduleSlots([]);
  };

  const loadRescheduleSlots = useCallback(
    async (startDate: Date, endDate: Date) => {
      if (!rescheduleTarget) return;

      setIsLoadingSlots(true);
      try {
        const { data, error } = await (supabasePatient as any).rpc(
          "get_available_slots_for_patient",
          {
            p_service_id: rescheduleTarget.procedure_id,
            p_professional_id: rescheduleTarget.professional_id,
            p_date_from: format(startDate, "yyyy-MM-dd"),
            p_date_to: format(endDate, "yyyy-MM-dd"),
          }
        );
        if (error) throw error;
        setRescheduleSlots((data as Slot[]) || []);
      } catch (err) {
        logger.error("Error loading reschedule slots:", err);
        toast.error("Erro ao carregar horários disponíveis");
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [rescheduleTarget]
  );

  const handleReschedule = async () => {
    if (!rescheduleTarget || !selectedRescheduleSlot) {
      toast.error("Selecione um novo horário");
      return;
    }

    setIsRescheduling(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("patient_reschedule_appointment", {
        p_appointment_id: rescheduleTarget.id,
        p_new_scheduled_at: selectedRescheduleSlot.slot_datetime,
        p_reason: rescheduleReason.trim() || null,
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success) {
        toast.success(result.message || "Consulta reagendada com sucesso");
      }
      setRescheduleTarget(null);
      void fetchAppointments();
    } catch (err: any) {
      logger.error("PatientConsultas reschedule:", err);
      const msg = err?.message || "Erro ao reagendar consulta";
      toast.error(msg);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <PatientLayout
      title="Minhas Consultas"
      subtitle="Histórico e próximos agendamentos"
      actions={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate("/paciente/agendar")}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Agendar
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchAppointments()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
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
              ? "Você não tem consultas agendadas."
              : "Nenhuma consulta encontrada para o filtro selecionado."
          }
          action={
            <Button onClick={() => navigate("/paciente/agendar")}>
              <CalendarPlus className="h-4 w-4 mr-2" />
              Agendar Nova Consulta
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const { label, variant } = statusLabel(appt.status);
            const date = new Date(appt.scheduled_at);
            const dateStr = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
            const time = format(date, "HH:mm", { locale: ptBR });
            const { allowed: modifiable, reason: modReason } = canModify(appt);

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

                  {/* Action buttons for modifiable appointments */}
                  {(appt.status === "pending" || appt.status === "confirmed") && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-center">
                      {modifiable ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => openRescheduleDialog(appt)}
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Reagendar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={() => { setCancelTarget(appt); setCancelReason(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                          {canCheckin(appt) && (
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => setCheckinTarget(appt)}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Check-in Online
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {modReason}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Cancelar Consulta ──────────────────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancelar Consulta
            </DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  {format(new Date(cancelTarget.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {cancelTarget.service_name} com {cancelTarget.professional_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive mb-1">Atenção</p>
            <p className="text-muted-foreground text-xs">
              O cancelamento é permanente. Caso deseje outro horário, utilize a opção "Reagendar".
            </p>
          </div>

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => void handleCancel()}
              disabled={isCancelling}
            >
              {isCancelling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando...</> : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reagendar Consulta ─────────────────────────────────────── */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => { if (!open) setRescheduleTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Reagendar Consulta
            </DialogTitle>
            <DialogDescription>
              {rescheduleTarget && (
                <>
                  Atual: {format(new Date(rescheduleTarget.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {rescheduleTarget.service_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="text-muted-foreground text-xs">
                Escolha um novo horário disponível. A consulta voltará ao status "Pendente" e a clínica será notificada do reagendamento.
              </p>
            </div>

            <SlotPicker
              slots={rescheduleSlots}
              isLoading={isLoadingSlots}
              selectedSlot={selectedRescheduleSlot}
              onSelectSlot={setSelectedRescheduleSlot}
              onWeekChange={loadRescheduleSlots}
              minDate={addHours(new Date(), 2)}
              maxDate={addDays(new Date(), 60)}
            />

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Ex: Conflito de horário, viagem..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Voltar</Button>
            <Button
              onClick={() => void handleReschedule()}
              disabled={isRescheduling || !selectedRescheduleSlot}
            >
              {isRescheduling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reagendando...</> : "Confirmar Reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Check-in Online ────────────────────────────────────────── */}
      <Dialog open={!!checkinTarget} onOpenChange={(open) => { if (!open) setCheckinTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Check-in Online
            </DialogTitle>
            <DialogDescription>
              {checkinTarget && (
                <>
                  {format(new Date(checkinTarget.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {checkinTarget.service_name} com {checkinTarget.professional_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm space-y-2">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">Confirme sua presença</p>
            <p className="text-xs text-muted-foreground">
              Ao fazer check-in, você confirma que comparecerá à consulta. O profissional será notificado.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinTarget(null)}>Voltar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => void handleCheckin()}
              disabled={isCheckingIn}
            >
              {isCheckingIn ? <><Loader2 className="h-4 w-4 animate-spin" />Confirmando...</> : <><ClipboardCheck className="h-4 w-4" />Fazer Check-in</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
