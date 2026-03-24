import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";

export interface RetentionStatistics {
  total_clients: number;
  clients_with_retention: number;
  expiring_this_year: number;
  expiring_next_year: number;
  already_archived: number;
  deletion_attempts_blocked: number;
}

export interface PatientNearExpiry {
  patient_id: string;
  client_name: string;
  cpf: string | null;
  last_appointment: string;
  retention_expires: string;
  days_until_expiry: number;
  total_records: number;
  total_prescriptions: number;
}

export interface DeletionAttempt {
  id: string;
  attempted_at: string;
  user_email: string;
  table_name: string;
  client_name: string;
  retention_expires: string;
  reason: string;
}

export interface ArchivedPatient {
  archive_id: string;
  client_name: string;
  client_cpf: string | null;
  last_appointment: string;
  archived_at: string;
  has_pdf: boolean;
  has_xml: boolean;
  total_records: number;
  data_hash: string;
}

export function useRetentionStatistics() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["retention-statistics", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_retention_statistics", {
        p_tenant_id: tenantId,
      });

      if (error) throw error;
      return data[0] as RetentionStatistics;
    },
    enabled: !!tenantId,
  });
}

export function usePatientsNearExpiry(monthsAhead: number = 12) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["patients-near-expiry", tenantId, monthsAhead],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_clients_near_retention_expiry", {
        p_tenant_id: tenantId,
        p_months_ahead: monthsAhead,
      });

      if (error) throw error;
      return data as PatientNearExpiry[];
    },
    enabled: !!tenantId,
  });
}

export function useDeletionAttempts(startDate?: string, endDate?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["deletion-attempts", tenantId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_retention_deletion_attempts", {
        p_tenant_id: tenantId,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) throw error;
      return data as DeletionAttempt[];
    },
    enabled: !!tenantId,
  });
}

export function useArchivedPatients(cpf?: string, name?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["archived-patients", tenantId, cpf, name],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_archived_client_data", {
        p_tenant_id: tenantId,
        p_client_cpf: cpf || null,
        p_client_name: name || null,
      });

      if (error) throw error;
      return data as ArchivedPatient[];
    },
    enabled: !!tenantId,
  });
}

export function useArchivePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      pdfUrl,
      xmlUrl,
    }: {
      patientId: string;
      pdfUrl?: string;
      xmlUrl?: string;
    }) => {
      const { data, error } = await supabase.rpc("archive_client_clinical_data", {
        p_client_id: patientId,
        p_export_pdf_url: pdfUrl || null,
        p_export_xml_url: xmlUrl || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retention-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["patients-near-expiry"] });
      queryClient.invalidateQueries({ queryKey: ["archived-patients"] });
      toast.success("Dados arquivados com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao arquivar", { description: normalizeError(error, "Não foi possível arquivar os dados.") });
    },
  });
}

export function useUpdateRetentionYears() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (years: number) => {
      if (years < 20) {
        throw new Error("O período mínimo de retenção é 20 anos (CFM 1.821/2007)");
      }

      const { error } = await supabase
        .from("tenants")
        .update({ retention_years: years })
        .eq("id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      toast.success("Período de retenção atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar retenção", { description: normalizeError(error, "Não foi possível salvar o período de retenção. Tente novamente.") });
    },
  });
}
