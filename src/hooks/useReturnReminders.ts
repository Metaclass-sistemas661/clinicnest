import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ReturnReminder {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  professional_id: string | null;
  professional_name: string | null;
  service_name: string | null;
  return_days: number;
  return_date: string;
  days_until_return: number;
  days_overdue: number;
  reason: string | null;
  status: string;
  notify_patient: boolean;
  last_notification_at: string | null;
  scheduled_appointment_id: string | null;
  created_at: string;
}

export interface ReturnStatistics {
  total_reminders: number;
  pending_count: number;
  notified_count: number;
  scheduled_count: number;
  completed_count: number;
  expired_count: number;
  overdue_count: number;
  completion_rate: number | null;
  avg_days_to_return: number | null;
}

export interface CreateReturnReminderInput {
  medicalRecordId: string;
  returnDays: number;
  reason?: string;
  notifyPatient?: boolean;
  notifyDaysBefore?: number;
  preferredContact?: "whatsapp" | "email" | "sms" | "phone";
  preSchedule?: boolean;
  serviceId?: string;
}

export const RETURN_DAYS_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 15, label: "15 dias" },
  { value: 30, label: "30 dias (1 mês)" },
  { value: 60, label: "60 dias (2 meses)" },
  { value: 90, label: "90 dias (3 meses)" },
  { value: 180, label: "180 dias (6 meses)" },
  { value: 365, label: "1 ano" },
] as const;

export const RETURN_STATUS_LABELS = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  notified: { label: "Notificado", color: "bg-blue-100 text-blue-800" },
  scheduled: { label: "Agendado", color: "bg-purple-100 text-purple-800" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-800" },
  expired: { label: "Expirado", color: "bg-red-100 text-red-800" },
} as const;

export function usePendingReturns(
  status?: string,
  fromDate?: string,
  toDate?: string,
  professionalId?: string
) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["pending-returns", tenantId, status, fromDate, toDate, professionalId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pending_returns", {
        p_tenant_id: tenantId,
        p_status: status || null,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
        p_professional_id: professionalId || null,
      });

      if (error) throw error;
      return data as ReturnReminder[];
    },
    enabled: !!tenantId,
  });
}

export function useReturnStatistics(fromDate?: string, toDate?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["return-statistics", tenantId, fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_return_statistics", {
        p_tenant_id: tenantId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });

      if (error) throw error;
      return data[0] as ReturnStatistics;
    },
    enabled: !!tenantId,
  });
}

export function useCreateReturnReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReturnReminderInput) => {
      const { data, error } = await supabase.rpc("create_return_reminder", {
        p_medical_record_id: input.medicalRecordId,
        p_return_days: input.returnDays,
        p_reason: input.reason || null,
        p_notify_patient: input.notifyPatient ?? true,
        p_notify_days_before: input.notifyDaysBefore ?? 3,
        p_preferred_contact: input.preferredContact || "whatsapp",
        p_pre_schedule: input.preSchedule ?? false,
        p_service_id: input.serviceId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-returns"] });
      queryClient.invalidateQueries({ queryKey: ["return-statistics"] });
      toast.success("Lembrete de retorno criado");
    },
    onError: (error) => {
      toast.error("Erro ao criar lembrete: " + error.message);
    },
  });
}

export function useLinkAppointmentToReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reminderId,
      appointmentId,
    }: {
      reminderId: string;
      appointmentId: string;
    }) => {
      const { error } = await supabase.rpc("link_appointment_to_return", {
        p_reminder_id: reminderId,
        p_appointment_id: appointmentId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-returns"] });
      toast.success("Agendamento vinculado ao retorno");
    },
    onError: (error) => {
      toast.error("Erro ao vincular: " + error.message);
    },
  });
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reminderId,
      status,
    }: {
      reminderId: string;
      status: string;
    }) => {
      const { error } = await supabase
        .from("return_reminders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", reminderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-returns"] });
      queryClient.invalidateQueries({ queryKey: ["return-statistics"] });
      toast.success("Status atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useReturnsToNotify() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["returns-to-notify", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_returns_to_notify", {
        p_tenant_id: tenantId,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}
