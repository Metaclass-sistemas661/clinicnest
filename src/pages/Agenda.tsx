import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useGoalMotivation } from "@/contexts/GoalMotivationContext";
import { supabase } from "@/integrations/supabase/client";
import { createAppointmentV2, deleteAppointmentV2, getGoalsWithProgress, setAppointmentStatusV2, updateAppointmentV2 } from "@/lib/supabase-typed-rpc";
import { Plus, ChevronLeft, ChevronRight, Loader2, CalendarDays, FilterX, Clock, Stethoscope, TrendingUp, ShieldCheck } from "lucide-react";
import { addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, isSameDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { notifyUser } from "@/lib/notifications";
import { toastRpcError } from "@/lib/rpc-error";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { TimeSlotPicker } from "@/components/agenda/TimeSlotPicker";
import { AppointmentsTable, type EditAppointmentData } from "@/components/agenda/AppointmentsTable";
import { CallNextButton } from "@/components/queue/CallNextButton";
import type { Appointment, Patient, Procedure, Profile, AppointmentStatus, Product, InsurancePlan, ConsultationType } from "@/types/database";
import { isAdvancedReportsAllowed, useSubscription } from "@/hooks/useSubscription";
import { Switch } from "@/components/ui/switch";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useLimitCheck } from "@/hooks/useUsageStats";
import { UsageIndicator } from "@/components/subscription/LimitGate";

export default function Agenda() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goalMotivation = useGoalMotivation();
  const subscription = useSubscription();
  const { isWithinLimit } = usePlanFeatures();
  const { currentValue: appointmentsThisMonth } = useLimitCheck('appointmentsPerMonth');
  const { currentValue: teleconsultasThisMonth } = useLimitCheck('teleconsultasPerMonth');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [pendingCancelAppointmentId, setPendingCancelAppointmentId] = useState<string | null>(null);

  // Banner carousel
  const bannerSlides = useMemo(() => [
    {
      img: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&q=80&auto=format&fit=crop",
      icon: CalendarDays,
      title: "Agora ficou mais fácil gerenciar seus agendamentos",
      desc: "ClinicNest veio para inovar a gestão da sua clínica. Organize, confirme e acompanhe tudo em um só lugar.",
    },
    {
      img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80&auto=format&fit=crop",
      icon: Stethoscope,
      title: "Atendimento de excelência começa com organização",
      desc: "Gerencie sua equipe, procedimentos e horários com a praticidade que sua clínica merece.",
    },
    {
      img: "https://images.unsplash.com/photo-1551190822-a9ce113ac100?w=600&q=80&auto=format&fit=crop",
      icon: TrendingUp,
      title: "Acompanhe o crescimento da sua clínica em tempo real",
      desc: "Relatórios inteligentes, metas e comissões — tudo integrado para você focar no que importa.",
    },
  ], []);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bannerTimerRef.current = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % bannerSlides.length);
    }, 5000);
    return () => { if (bannerTimerRef.current) clearInterval(bannerTimerRef.current); };
  }, [bannerSlides.length]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");

  // Staff: default to "my appointments" filter
  useEffect(() => {
    if (!isAdmin && profile?.id) {
      setProfessionalFilter(profile.id);
    }
  }, [isAdmin, profile?.id]);

  // Staff: ao abrir modal novo agendamento, definir profissional como ele mesmo
  useEffect(() => {
    if (isDialogOpen && !isAdmin && profile?.id) {
      setFormData((prev) => ({ ...prev, professional_id: profile.id }));
    }
  }, [isDialogOpen, isAdmin, profile?.id]);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: "",
    procedure_id: "",
    professional_id: "",
    scheduled_at: "",
    scheduled_time: "",
    notes: "",
    status: "pending" as AppointmentStatus,
    telemedicine: false,
    booked_by_id: "",
    consultation_type: "primeira" as ConsultationType,
    insurance_plan_id: "",
    insurance_authorization: "",
  });

  // Auto-preencher convênio do paciente quando selecionado
  useEffect(() => {
    if (!formData.patient_id) return;
    const patient = patients.find((p) => p.id === formData.patient_id);
    if (patient?.insurance_plan_id) {
      setFormData((prev) => ({
        ...prev,
        insurance_plan_id: prev.insurance_plan_id || patient.insurance_plan_id || "",
      }));
    }
  }, [formData.patient_id, patients]);

  // Verificar se convênio selecionado exige autorização
  const selectedInsurancePlan = useMemo(
    () => insurancePlans.find((p) => p.id === formData.insurance_plan_id),
    [insurancePlans, formData.insurance_plan_id]
  );
  const requiresAuthorization = selectedInsurancePlan?.requires_authorization ?? false;

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData();
    }
  }, [profile?.tenant_id, currentDate, viewMode]);

  const fetchData = async () => {
    if (!profile?.tenant_id) return;

    let start: Date, end: Date;
    if (viewMode === "day") {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    } else {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    }

    try {
      const [appointmentsRes, clientsRes, proceduresRes, professionalsRes, productsRes, insurancePlansRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            *,
            patient:patients(id, name, phone),
            procedure:procedures(id, name, duration_minutes, price),
            professional:profiles!professional_id(id, full_name)
          `)
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", start.toISOString())
          .lte("scheduled_at", end.toISOString())
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("patients")
          .select("id,tenant_id,name,phone,email,notes,insurance_plan_id,created_at,updated_at")
          .eq("tenant_id", profile.tenant_id)
          .order("name"),
        supabase
          .from("procedures")
          .select("id,tenant_id,name,description,duration_minutes,price,is_active,created_at,updated_at")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("profiles")
          .select("id,user_id,tenant_id,full_name,email,phone,avatar_url,created_at,updated_at")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("products")
          .select("id, name, cost, quantity, is_active")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("insurance_plans")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
      ]);

      const professionals = (professionalsRes.data as Profile[]) || [];

      setAppointments((appointmentsRes.data as unknown as Appointment[]) || []);
      setAllAppointments((appointmentsRes.data as unknown as Appointment[]) || []);
      setPatients((clientsRes.data as Patient[]) || []);
      setProcedures((proceduresRes.data as Procedure[]) || []);
      setProfessionals(professionals);
      setProducts(((productsRes.data as Product[]) || []).filter((product) => product.is_active));
      setInsurancePlans((insurancePlansRes.data as unknown as InsurancePlan[]) || []);
    } catch (error) {
      logger.error("Error fetching data:", error);
      toast.error("Erro ao carregar agenda. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar todos agendamentos do dia selecionado para validação de conflitos
  const fetchAppointmentsForConflictCheck = async (date: string) => {
    if (!profile?.tenant_id || !date) return;

    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));

    const { data } = await supabase
      .from("appointments")
      .select(`
        *,
        professional:profiles!professional_id(id, full_name)
      `)
      .eq("tenant_id", profile.tenant_id)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .neq("status", "cancelled");

    setAllAppointments((data as unknown as Appointment[]) || []);
  };

  // Quando a data do formulário muda, buscar agendamentos para verificação de conflitos
  useEffect(() => {
    if (formData.scheduled_at) {
      fetchAppointmentsForConflictCheck(formData.scheduled_at);
    }
  }, [formData.scheduled_at, profile?.tenant_id]);

  // Verificar conflito de horário
  const checkConflict = (professionalId: string, scheduledAt: Date, durationMinutes: number) => {
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);

    return allAppointments.some((apt) => {
      if (apt.professional_id !== professionalId) return false;
      if (apt.status === "cancelled") return false;

      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);

      return scheduledAt < aptEnd && endTime > aptStart;
    });
  };

  const handleCreateAppointment = async () => {
    if (!profile?.tenant_id) return;

    // Verificar limite de agendamentos do mês
    if (!isWithinLimit('appointmentsPerMonth', appointmentsThisMonth)) {
      toast.error("Você atingiu o limite de agendamentos do mês. Faça upgrade para continuar.");
      return;
    }

    // Verificar limite de teleconsultas se for teleconsulta
    if (formData.telemedicine && !isWithinLimit('teleconsultasPerMonth', teleconsultasThisMonth)) {
      toast.error("Você atingiu o limite de teleconsultas do mês. Faça upgrade para continuar.");
      return;
    }

    // Verificar autorização do convênio
    if (requiresAuthorization && !formData.insurance_authorization.trim()) {
      toast.error("Este convênio exige número de autorização. Preencha antes de agendar.");
      return;
    }

    setIsSaving(true);

    try {
      const selectedProcedure = procedures.find((s) => s.id === formData.procedure_id);
      const scheduledAt = new Date(`${formData.scheduled_at}T${formData.scheduled_time}`);
      const durationMinutes = selectedProcedure?.duration_minutes || 45;

      // Verificar conflito antes de criar
      if (formData.professional_id && checkConflict(formData.professional_id, scheduledAt, durationMinutes)) {
        toast.error("Conflito de horário! Este profissional já tem agendamento neste período.");
        setIsSaving(false);
        return;
      }

      const professionalId = !isAdmin ? (profile?.id ?? null) : (formData.professional_id || null);
      const { data: rpcData, error } = await createAppointmentV2({
        p_client_id: formData.patient_id || null,
        p_service_id: formData.procedure_id || null,
        p_professional_profile_id: professionalId,
        p_scheduled_at: scheduledAt.toISOString(),
        p_duration_minutes: durationMinutes,
        p_price: selectedProcedure?.price || 0,
        p_status: formData.status,
        p_notes: formData.notes || null,
        p_telemedicine: Boolean(formData.telemedicine),
        p_booked_by_id: formData.booked_by_id || null,
      });
      if (error) {
        toastRpcError(toast, error, "Erro ao criar agendamento");
        return;
      }

      const createdId = String((rpcData as any)?.appointment_id ?? "");
      const createdProfessionalId = professionalId;

      // Salvar campos extras que a RPC não suporta (consultation_type, insurance, etc.)
      if (createdId) {
        const extraFields: Record<string, unknown> = {};
        if (formData.consultation_type) extraFields.consultation_type = formData.consultation_type;
        if (formData.insurance_plan_id) extraFields.insurance_plan_id = formData.insurance_plan_id;
        if (formData.insurance_authorization) extraFields.insurance_authorization = formData.insurance_authorization;
        if (Object.keys(extraFields).length > 0) {
          await supabase
            .from("appointments")
            .update(extraFields)
            .eq("id", createdId);
        }
      }

      // Notificar profissional: quando admin cria para ele OU quando cria o próprio
      if (createdProfessionalId && profile?.user_id) {
        const prof = professionals.find((p) => p.id === professionalId);
        const patient = patients.find((c) => c.id === formData.patient_id);
        const procedure = selectedProcedure;
        const profUserId = prof?.user_id ?? (professionalId === profile.id ? profile.user_id : null);
        if (profUserId) {
          const msg = isAdmin && profUserId !== profile.user_id
            ? "Novo agendamento"
            : "Agendamento criado";
          notifyUser(
            profile.tenant_id,
            profUserId,
            "appointment_created",
            msg,
            `${patient?.name || "Paciente"} • ${procedure?.name || "Procedimento"} em ${formatInAppTz(scheduledAt, "dd/MM 'às' HH:mm")}`,
            {}
          ).catch(() => {});
        }
      }

      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        patient_id: "",
        procedure_id: "",
        professional_id: "",
        scheduled_at: "",
        scheduled_time: "",
        notes: "",
        status: "pending",
        telemedicine: false,
        booked_by_id: "",
        consultation_type: "primeira",
        insurance_plan_id: "",
        insurance_authorization: "",
      });
      fetchData();
    } catch (error) {
      toast.error("Erro ao criar agendamento");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    try {
      if (status === "cancelled") {
        setPendingCancelAppointmentId(id);
        setCancelReason("");
        setIsCancelDialogOpen(true);
        return;
      }

      const apt = appointments.find((a) => a.id === id);
      const { error } = await (async () => {
        const { error } = await setAppointmentStatusV2({
          p_appointment_id: id,
          p_status: status,
        });
        return { error };
      })();

      if (error) {
        logger.error("Error updating appointment status:", error);
        toast.error(`Erro ao atualizar status: ${error.message}`);
        return;
      }

      // Fallback: se 'arrived', garante entrada na fila manualmente (idempotente)
      if (status === "arrived" && apt && profile?.tenant_id && apt.patient_id) {
        const { error: queueError } = await supabase.rpc("add_patient_to_queue", {
          p_tenant_id: profile.tenant_id,
          p_patient_id: apt.patient_id,
          p_appointment_id: id,
          p_triage_id: null,
          p_room_id: null,
          p_professional_id: apt.professional_id || null,
          p_priority: 5,
          p_priority_label: null,
        });
        if (queueError) {
          logger.warn("Fallback add_patient_to_queue falhou:", queueError.message);
        }
        // Invalida cache da fila para que outros componentes atualizem
        queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
        queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
      }

      const statusMessages: Record<string, string> = {
        pending: "Agendamento marcado como pendente",
        confirmed: "Agendamento confirmado!",
        arrived: "Paciente marcado como presente!",
        completed: "Agendamento concluído! Receita registrada.",
        cancelled: "Agendamento cancelado",
      };

      toast.success(statusMessages[status]);
      fetchData();
    } catch (error: any) {
      logger.error("Exception updating appointment status:", error);
      toast.error(`Erro ao atualizar status: ${error?.message || "Erro desconhecido"}`);
    }
  };

  const confirmCancelAppointment = async () => {
    if (!pendingCancelAppointmentId) return;

    const id = pendingCancelAppointmentId;
    const apt = appointments.find((a) => a.id === id);

    try {
      const { error } = await supabase.rpc("cancel_appointment", {
        p_appointment_id: id,
        p_reason: cancelReason || null,
      });

      if (error) {
        logger.error("Error cancelling appointment:", error);
        toast.error(error.message || "Erro ao cancelar agendamento");
        return;
      }

      // Notificar profissional quando agendamento é cancelado
      if (apt?.professional_id && profile?.tenant_id) {
        const prof = professionals.find((p) => p.id === apt.professional_id);
        const patient = apt.patient as { name?: string } | undefined;
        if (prof?.user_id) {
          notifyUser(
            profile.tenant_id,
            prof.user_id,
            "appointment_cancelled",
            "Agendamento cancelado",
            `O agendamento com ${patient?.name || "paciente"} foi cancelado.`,
            {}
          ).catch(() => {});
        }
      }

      toast.success("Agendamento cancelado");
      setIsCancelDialogOpen(false);
      setPendingCancelAppointmentId(null);
      setCancelReason("");
      fetchData();
    } catch (error: any) {
      logger.error("Exception cancelling appointment:", error);
      toast.error(error?.message || "Erro ao cancelar agendamento");
    }
  };

  const editAppointment = async (id: string, data: EditAppointmentData) => {
    try {
      const selectedProcedure = procedures.find((s) => s.id === data.procedure_id);

      const { error } = await updateAppointmentV2({
        p_appointment_id: id,
        p_client_id: data.patient_id,
        p_service_id: data.procedure_id,
        p_professional_profile_id: data.professional_id,
        p_scheduled_at: data.scheduled_at,
        p_duration_minutes: selectedProcedure?.duration_minutes || 45,
        p_price: selectedProcedure?.price || 0,
        p_notes: data.notes,
        p_telemedicine: Boolean(data.telemedicine),
      });
      if (error) {
        toastRpcError(toast, error, "Erro ao atualizar agendamento");
        return;
      }

      // Salvar campos extras que a RPC não suporta
      const extraFields: Record<string, unknown> = {
        consultation_type: data.consultation_type || null,
        insurance_plan_id: data.insurance_plan_id || null,
        insurance_authorization: data.insurance_authorization || null,
      };
      await supabase
        .from("appointments")
        .update(extraFields)
        .eq("id", id);

      toast.success("Agendamento atualizado com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar agendamento");
      logger.error(error);
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const { error } = await deleteAppointmentV2({
        p_appointment_id: id,
        p_reason: null,
      });
      if (error) {
        toastRpcError(toast, error, "Erro ao excluir agendamento");
        return;
      }

      toast.success("Agendamento excluído com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
      logger.error(error);
    }
  };

  const handleCompleteAppointment = async (
    appointment: Appointment,
    sale?: { productId: string; quantity: number }
  ): Promise<
    | { type: "congrats"; commissionAmount: number; serviceName: string; servicePrice: number; completedThisMonth: number; valueGeneratedThisMonth: number }
    | { type: "no_commission" }
    | { type: "goal_motivation" }
    | undefined
  > => {
    if (!profile?.tenant_id) return undefined;

    try {
      // Usar RPC para concluir: atualiza status, registra venda, cria comissão e insere em
      // appointment_completion_summaries (que aciona o popup de lucro do admin via Realtime)
      const { data: rpcData, error } = await supabase.rpc("complete_appointment_with_sale", {
        p_appointment_id: appointment.id,
        p_product_id: sale?.productId ?? null,
        p_quantity: sale?.quantity ?? null,
      });

      if (error) throw error;

      const result = rpcData as {
        commission_amount?: number;
        service_price?: number;
        service_name?: string;
        professional_name?: string;
        service_profit?: number;
        product_sales?: unknown[];
        product_profit_total?: number;
        total_profit?: number;
      } | null;

      const commissionAmount = Number(result?.commission_amount ?? 0);

      if (!isAdmin && profile?.id && profile?.user_id) {
        toast.success(
          sale ? "Agendamento concluído e venda registrada!" : "Agendamento concluído!"
        );
        fetchData();

        // Popup de meta: buscar metas do profissional e mostrar mensagem motivacional + comissão + quanto falta
        try {
          if (!isAdvancedReportsAllowed(subscription.plan)) {
            goalMotivation?.showGoalMotivation({
              commissionAmount,
              goals: [],
            });
            // Popup de meta já foi mostrado; não exibir popup de comissão separado
            return { type: "goal_motivation" };
          }

          const { data: goalsData } = await getGoalsWithProgress({
            p_tenant_id: profile.tenant_id,
            p_include_archived: false,
          });
          const allGoals = (goalsData || []) as { professional_id?: string; id: string; name: string; goal_type: string; target_value: number; current_value: number; progress_pct: number; days_remaining?: number }[];
          const myGoals = allGoals
            .filter((g) => g.professional_id === profile.id)
            .map((g) => ({
              id: g.id,
              name: g.name,
              goal_type: g.goal_type,
              target_value: g.target_value,
              current_value: g.current_value,
              progress_pct: g.progress_pct,
              days_remaining: g.days_remaining,
            }));

          goalMotivation?.showGoalMotivation({
            commissionAmount,
            goals: myGoals,
          });
        } catch (_) {
          goalMotivation?.showGoalMotivation({
            commissionAmount,
            goals: [],
          });
        }

        // Popup de meta já foi mostrado; não exibir popup de comissão separado
        return { type: "goal_motivation" };
      }

      // Admin: popup de lucro vem via Realtime (AdminProfitRealtimeListener) - o RPC já inseriu em appointment_completion_summaries
      // Notificar profissional quando admin conclui atendimento dele
      if (appointment.professional_id && profile?.tenant_id) {
        const prof = professionals.find((p) => p.id === appointment.professional_id);
        const serviceName = (result?.service_name ?? (appointment.procedure as { name?: string })?.name) || "Procedimento";
        if (prof?.user_id) {
          notifyUser(
            profile.tenant_id,
            prof.user_id,
            "appointment_completed",
            "Atendimento concluído",
            `O administrador concluiu o agendamento "${serviceName}".`,
            {}
          ).catch(() => {});
        }
      }

      toast.success(
        sale ? "Agendamento concluído e venda registrada!" : "Agendamento concluído!"
      );
      fetchData();
      return undefined;
    } catch (error: any) {
      const errMsg = error?.message ?? (typeof error === "string" ? error : "Erro desconhecido");
      logger.error("Error completing appointment:", errMsg, error);
      toastRpcError(toast, error, "Erro ao concluir agendamento");
      throw error;
    }
  };

  const handleStartConsultation = useCallback((appointment: any) => {
    const patientId = appointment.patient_id || (appointment.patient as any)?.id;
    if (!patientId) {
      toast.error("Agendamento sem paciente vinculado");
      return;
    }
    const params = new URLSearchParams({
      patient_id: patientId,
      appointment_id: appointment.id,
    });
    navigate(`/prontuarios?new=1&${params.toString()}`);
  }, [navigate]);

  // Memoized filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
      const matchesProfessional =
        professionalFilter === "all" || apt.professional_id === professionalFilter;
      return matchesStatus && matchesProfessional;
    });
  }, [appointments, statusFilter, professionalFilter]);

  const hasActiveFilters = useMemo(() => {
    if (statusFilter !== "all") return true;
    if (isAdmin && professionalFilter !== "all") return true;
    return false;
  }, [statusFilter, professionalFilter, isAdmin]);

  // Appointment counts for filter badges
  const appointmentCounts = useMemo(() => {
    const counts = {
      total: appointments.length,
      pending: 0,
      confirmed: 0,
      arrived: 0,
      completed: 0,
      cancelled: 0,
    };
    appointments.forEach((apt) => {
      const s = apt.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [appointments]);

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getAppointmentsCountForDay = (date: Date) => {
    return filteredAppointments.filter((apt) =>
      isSameDay(new Date(apt.scheduled_at), date)
    ).length;
  };

  return (
    <MainLayout
      title="Agenda"
      subtitle={isAdmin ? "Gerencie os agendamentos da clínica" : "Gerencie seus agendamentos"}
      actions={
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center rounded-lg border border-border bg-card text-foreground">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className={viewMode === "day" ? "gradient-primary text-primary-foreground" : ""}
              data-tour="agenda-view-day"
            >
              Dia
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className={viewMode === "week" ? "gradient-primary text-primary-foreground" : ""}
              data-tour="agenda-view-week"
            >
              Semana
            </Button>
          </div>
                    <div className="flex items-center gap-2">
                      <CallNextButton 
                        professionalId={!isAdmin ? profile?.id : undefined}
                        variant="outline"
                        size="sm"
                      />
                      <Button className="gradient-primary text-primary-foreground text-sm" onClick={() => setIsDialogOpen(true)} data-tour="agenda-new-appointment">
                <Plus className="mr-1 md:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo agendamento</span>
                <span className="sm:hidden">Novo</span>
              </Button>
                    </div>
          <FormDrawer
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title="Novo agendamento"
            description="Preencha os dados do agendamento"
            width="lg"
            onSubmit={handleCreateAppointment}
            isSubmitting={isSaving}
            submitLabel="Criar Agendamento"
          >
            <FormDrawerSection title="Paciente e Procedimento">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Select
                    value={formData.patient_id}
                    onValueChange={(v) => setFormData({ ...formData, patient_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Procedimento</Label>
                  <Select
                    value={formData.procedure_id}
                    onValueChange={(v) => {
                      setFormData({ 
                        ...formData, 
                        procedure_id: v,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o procedimento" />
                    </SelectTrigger>
                    <SelectContent>
                      {procedures.map((procedure) => (
                        <SelectItem key={procedure.id} value={procedure.id}>
                          {procedure.name} - {formatCurrency(procedure.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormDrawerSection>

            <FormDrawerSection title="Profissional">
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select
                    value={formData.professional_id}
                    onValueChange={(v) => {
                      setFormData({ 
                        ...formData, 
                        professional_id: v,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Input
                    value={profile?.full_name ?? "Você"}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Agendamentos são direcionados para você</p>
                </div>
              )}
            </FormDrawerSection>

            <FormDrawerSection title="Data e Horário">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.scheduled_at}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduled_at: e.target.value, scheduled_time: "" })
                    }
                    required
                  />
                </div>
                
                {formData.scheduled_at && (
                  <TimeSlotPicker
                    selectedTime={formData.scheduled_time}
                    onTimeChange={(time) => setFormData({ ...formData, scheduled_time: time })}
                    selectedDate={formData.scheduled_at}
                    selectedProfessional={formData.professional_id}
                    professionals={professionals}
                    existingAppointments={allAppointments}
                    onProfessionalChange={isAdmin ? (profId) => setFormData({ ...formData, professional_id: profId }) : undefined}
                  />
                )}
              </div>
            </FormDrawerSection>

            <FormDrawerSection title="Tipo de Consulta e Convênio">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Consulta</Label>
                  <Select
                    value={formData.consultation_type}
                    onValueChange={(v) => setFormData({ ...formData, consultation_type: v as ConsultationType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeira">Primeira Consulta</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="urgencia">Urgência</SelectItem>
                      <SelectItem value="procedimento">Procedimento</SelectItem>
                      <SelectItem value="exame">Exame</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Convênio / Plano de Saúde <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Select
                    value={formData.insurance_plan_id}
                    onValueChange={(v) => setFormData({ ...formData, insurance_plan_id: v === "none" ? "" : v, insurance_authorization: v === "none" ? "" : formData.insurance_authorization })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Particular (sem convênio)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Particular (sem convênio)</SelectItem>
                      {insurancePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}{plan.ans_code ? ` (ANS: ${plan.ans_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.insurance_plan_id && (
                  <div className="space-y-2">
                    <Label>
                      Nº Autorização do Convênio
                      {requiresAuthorization && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      value={formData.insurance_authorization}
                      onChange={(e) => setFormData({ ...formData, insurance_authorization: e.target.value })}
                      placeholder="Número da autorização emitida pela operadora"
                      className="font-mono"
                    />
                    {requiresAuthorization && (
                      <div className="flex items-center gap-1.5 text-xs text-warning">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Este convênio exige autorização prévia para agendamento
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormDrawerSection>

            <FormDrawerSection title="Opções">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Agendado/Indicado por <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Select
                    value={formData.booked_by_id}
                    onValueChange={(v) => setFormData({ ...formData, booked_by_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Quem agendou ou indicou?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum / Não informado</SelectItem>
                      {professionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.user_id || prof.id}>
                          {prof.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Usado para comissão por captação/indicação
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações opcionais..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex flex-col">
                    <Label>Teleconsulta</Label>
                    <span className="text-xs text-muted-foreground">Atendimento remoto via vídeo</span>
                  </div>
                  <Switch
                    checked={formData.telemedicine}
                    onCheckedChange={(checked) => setFormData({ ...formData, telemedicine: checked })}
                  />
                </div>
              </div>
            </FormDrawerSection>
          </FormDrawer>
        </div>
      }
    >
      {/* Cancel dialog */}
      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          setIsCancelDialogOpen(open);
          if (!open) {
            setPendingCancelAppointmentId(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogDescription>
              Se quiser, informe um motivo. Isso ajuda no controle e na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: paciente pediu para remarcar"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button type="button" className="gradient-primary text-primary-foreground" onClick={confirmCancelAppointment}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Main two-column layout: Content + Banner (right) ═══ */}
      <div className="flex gap-6 items-stretch">

        {/* ── Left: Main agenda content ── */}
        <div className="flex-1 min-w-0">

          {/* Stats overview card — above content, full width */}
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total</span>
              <span className="text-3xl font-bold text-foreground mt-1">{appointmentCounts.total}</span>
              <span className="text-xs text-muted-foreground mt-1">agendamentos</span>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4 flex flex-col">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendentes</span>
              <span className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">{appointmentCounts.pending}</span>
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">aguardando confirmação</span>
            </div>
            <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-4 flex flex-col">
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Confirmados</span>
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{appointmentCounts.confirmed}</span>
              <span className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">prontos para atender</span>
            </div>
            <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5 p-4 flex flex-col">
              <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">Chegou</span>
              <span className="text-3xl font-bold text-violet-700 dark:text-violet-300 mt-1">{appointmentCounts.arrived}</span>
              <span className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-1">aguardando atendimento</span>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 p-4 flex flex-col">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Concluídos</span>
              <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{appointmentCounts.completed}</span>
              <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">atendimentos realizados</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="mb-4 md:mb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))}
                aria-label={viewMode === "day" ? "Dia anterior" : "Semana anterior"}
                data-tour="agenda-prev-period"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm md:text-base font-semibold text-center min-w-0 text-foreground">
                {viewMode === "day"
                  ? formatInAppTz(currentDate, "EEE, d 'de' MMM")
                  : `${formatInAppTz(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} - ${formatInAppTz(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")}`}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? 1 : 7))}
                aria-label={viewMode === "day" ? "Próximo dia" : "Próxima semana"}
                data-tour="agenda-next-period"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCurrentDate(new Date())} data-tour="agenda-today">
              Hoje
            </Button>
          </div>

          {/* Week Overview - Mini Calendar */}
          {viewMode === "week" && (
            <div className="mb-4 md:mb-5 grid grid-cols-7 gap-1.5 md:gap-2">
              {getWeekDays().map((day) => {
                const count = getAppointmentsCountForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, currentDate);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      setCurrentDate(day);
                      setViewMode("day");
                    }}
                    className={`
                      flex flex-col items-center rounded-xl border p-1.5 md:p-3 transition-all hover:border-primary/50 hover:bg-accent
                      ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                      ${isSelected ? "bg-primary/10 border-primary" : "bg-card"}
                    `}
                  >
                    <span className="text-[10px] md:text-xs text-muted-foreground capitalize">
                      {formatInAppTz(day, "EEE").slice(0, 3)}
                    </span>
                    <span className={`text-sm md:text-xl font-bold text-foreground ${isToday ? "text-primary" : ""}`}>
                      {formatInAppTz(day, "d")}
                    </span>
                    {count > 0 && (
                      <span className="mt-0.5 md:mt-1 rounded-full bg-primary/15 px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs font-semibold text-primary">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <div className="mb-5">
            <AgendaFilters
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              professionalFilter={professionalFilter}
              onProfessionalFilterChange={setProfessionalFilter}
              professionals={professionals}
              isAdmin={isAdmin}
              appointmentCounts={appointmentCounts}
            />
          </div>

          {/* Appointments Table */}
          <Card className="border-border text-foreground rounded-xl shadow-sm flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-base font-semibold">
                Agendamentos
                {viewMode === "day" && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatInAppTz(currentDate, "dd 'de' MMMM")}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto max-h-[340px]">
              {!isLoading && filteredAppointments.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={CalendarDays}
                    title="Nenhum agendamento encontrado"
                    description={
                      hasActiveFilters
                        ? "Ajuste os filtros ou crie um novo agendamento."
                        : "Crie seu primeiro agendamento para começar a organizar sua rotina."
                    }
                    action={
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                          className="gradient-primary text-primary-foreground"
                          onClick={() => setIsDialogOpen(true)}
                          data-tour="agenda-empty-new-appointment"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Novo agendamento
                        </Button>
                        {hasActiveFilters ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setStatusFilter("all");
                              if (isAdmin) setProfessionalFilter("all");
                            }}
                            data-tour="agenda-empty-clear-filters"
                          >
                            <FilterX className="mr-2 h-4 w-4" />
                            Limpar filtros
                          </Button>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              ) : (
                <AppointmentsTable
                  appointments={filteredAppointments}
                  clients={patients}
                  procedures={procedures}
                  professionals={professionals}
                  allAppointments={allAppointments}
                  insurancePlans={insurancePlans}
                  onStatusChange={updateAppointmentStatus}
                  currentProfileId={profile?.id}
                  onComplete={handleCompleteAppointment}
                  onEdit={editAppointment}
                  onDelete={deleteAppointment}
                  isLoading={isLoading}
                  isAdmin={isAdmin}
                  products={products}
                  onStartConsultation={handleStartConsultation}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Promotional Banner with auto-carousel (desktop only, stories-width) ── */}
        <aside className="hidden xl:flex w-[280px] shrink-0">
          <div className="w-full">
            <div className="relative h-full min-h-[520px] rounded-2xl overflow-hidden shadow-lg">
              {bannerSlides.map((slide, idx) => {
                const SlideIcon = slide.icon;
                return (
                  <div
                    key={idx}
                    className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                    style={{ opacity: bannerIndex === idx ? 1 : 0, pointerEvents: bannerIndex === idx ? "auto" : "none" }}
                  >
                    <img
                      src={slide.img}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <SlideIcon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">ClinicNest</span>
                      </div>
                      <h3 className="text-white text-lg font-bold leading-snug">
                        {slide.title}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {slide.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Slide indicators (top, like Instagram stories) */}
              <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-10">
                {bannerSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setBannerIndex(idx)}
                    className="flex-1 h-[3px] rounded-full transition-all duration-300"
                    style={{ background: bannerIndex === idx ? "white" : "rgba(255,255,255,0.35)" }}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </MainLayout>
  );
}
