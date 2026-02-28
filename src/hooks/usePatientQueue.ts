import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface PatientCall {
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
  is_triaged: boolean;
  triage_priority: string | null;
}

export interface CurrentCall {
  call_id: string;
  patient_id: string;
  client_name: string;
  call_number: number;
  room_name: string | null;
  professional_name: string | null;
  times_called: number;
  last_called_at: string;
  priority: number;
  priority_label: string | null;
}

export interface QueueStatistics {
  total_today: number;
  waiting_count: number;
  calling_count: number;
  in_service_count: number;
  completed_count: number;
  no_show_count: number;
  avg_wait_time_minutes: number | null;
}

export function useWaitingQueue(limit: number = 10) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["waiting-queue", tenantId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waiting_queue", {
        p_tenant_id: tenantId,
        p_limit: limit,
      });

      if (error) throw error;
      return data as PatientCall[];
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });
}

export function useCurrentCall() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["current-call", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_call", {
        p_tenant_id: tenantId,
      });

      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as CurrentCall | null;
    },
    enabled: !!tenantId,
    refetchInterval: 3000, // Atualiza a cada 3 segundos
  });
}

export function useQueueStatistics() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["queue-statistics", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_queue_statistics", {
        p_tenant_id: tenantId,
      });

      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as QueueStatistics | null;
    },
    enabled: !!tenantId,
    refetchInterval: 10000,
  });
}

export function useCallNextPatient() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      professionalId,
    }: {
      roomId?: string;
      professionalId?: string;
    } = {}) => {
      const { data, error } = await supabase.rpc("call_next_patient", {
        p_tenant_id: tenantId,
        p_room_id: roomId || null,
        p_professional_id: professionalId || null,
      });

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
      queryClient.invalidateQueries({ queryKey: ["current-call"] });
      queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
      if (data) {
        toast.success(`Chamando: ${data.client_name}`);
      } else {
        toast.info("Não há pacientes na fila");
      }
    },
    onError: (error) => {
      toast.error("Erro ao chamar paciente: " + error.message);
    },
  });
}

export function useRecallPatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase.rpc("recall_patient", {
        p_call_id: callId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-call"] });
      toast.success("Paciente rechamado");
    },
    onError: (error) => {
      toast.error("Erro ao rechamar: " + error.message);
    },
  });
}

export function useStartService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase.rpc("start_patient_service", {
        p_call_id: callId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
      queryClient.invalidateQueries({ queryKey: ["current-call"] });
      queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
      toast.success("Atendimento iniciado");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useCompleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase.rpc("complete_patient_service", {
        p_call_id: callId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
    },
  });
}

export function useMarkNoShow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase.rpc("mark_patient_no_show", {
        p_call_id: callId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
      queryClient.invalidateQueries({ queryKey: ["current-call"] });
      queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
      toast.info("Paciente marcado como não compareceu");
    },
  });
}

export function useAddToQueue() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      appointmentId,
      triageId,
      roomId,
      professionalId,
      priority = 5,
      priorityLabel,
    }: {
      patientId: string;
      appointmentId?: string;
      triageId?: string;
      roomId?: string;
      professionalId?: string;
      priority?: number;
      priorityLabel?: string;
    }) => {
      const { data, error } = await supabase.rpc("add_patient_to_queue", {
        p_tenant_id: tenantId,
        p_patient_id: patientId,
        p_appointment_id: appointmentId || null,
        p_triage_id: triageId || null,
        p_room_id: roomId || null,
        p_professional_id: professionalId || null,
        p_priority: priority,
        p_priority_label: priorityLabel || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
      queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
      toast.success("Paciente adicionado à fila");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar à fila: " + error.message);
    },
  });
}

// Hook para Realtime
export function useQueueRealtime() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel("patient_calls_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_calls",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["waiting-queue"] });
          queryClient.invalidateQueries({ queryKey: ["current-call"] });
          queryClient.invalidateQueries({ queryKey: ["queue-statistics"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}

export const PRIORITY_COLORS = {
  1: { bg: "bg-red-500", text: "text-white", label: "Emergência" },
  2: { bg: "bg-orange-500", text: "text-white", label: "Muito Urgente" },
  3: { bg: "bg-yellow-500", text: "text-black", label: "Urgente" },
  4: { bg: "bg-green-500", text: "text-white", label: "Pouco Urgente" },
  5: { bg: "bg-blue-500", text: "text-white", label: "Normal" },
} as const;
