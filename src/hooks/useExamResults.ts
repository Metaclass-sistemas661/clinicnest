import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

// ─── Interfaces ───────────────────────────────────────────
export interface ExamResult {
  id: string;
  tenant_id: string;
  patient_id: string;
  patient_name: string;
  appointment_id: string | null;
  medical_record_id: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  performed_by: string | null;
  exam_type: string;
  exam_category: string | null;
  exam_name: string;
  tuss_code: string | null;
  performed_at: string | null;
  lab_name: string | null;
  result_text: string | null;
  reference_values: string | null;
  interpretation: string | null;
  status: "pendente" | "normal" | "alterado" | "critico";
  priority: "normal" | "urgente";
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  source: string | null;
  result_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ExamResultInsert {
  patient_id: string;
  appointment_id?: string | null;
  medical_record_id?: string | null;
  exam_type: string;
  exam_category?: string | null;
  exam_name: string;
  tuss_code?: string | null;
  performed_at?: string | null;
  lab_name?: string | null;
  result_text?: string | null;
  reference_values?: string | null;
  interpretation?: string | null;
  status?: "pendente" | "normal" | "alterado" | "critico";
  priority?: "normal" | "urgente";
  notes?: string | null;
  file?: File | null;
}

export interface ExamResultUpdate extends Partial<ExamResultInsert> {
  id: string;
  file?: File | null;
  // If we need to remove the file
  removeFile?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────
export function useExamResults(options?: {
  patientId?: string;
  status?: string;
  examType?: string;
}) {
  const { profile, tenantId } = useAuth();
  const queryClient = useQueryClient();

  // ─── Listar exames ──────────────────────────────────────
  const queryKey = ["exam-results", tenantId, options?.patientId, options?.status, options?.examType];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ExamResult[]> => {
      let q = (supabase as any)
        .from("exam_results")
        .select(`
          *,
          patient:patients(name),
          requester:profiles!exam_results_requested_by_fkey(full_name)
        `)
        .eq("tenant_id", tenantId!);

      if (options?.patientId) q = q.eq("patient_id", options.patientId);
      if (options?.status) q = q.eq("status", options.status);
      if (options?.examType) q = q.eq("exam_type", options.examType);

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        patient_id: r.patient_id,
        patient_name: r.patient?.name ?? "—",
        appointment_id: r.appointment_id,
        medical_record_id: r.medical_record_id,
        requested_by: r.requested_by,
        requested_by_name: r.requester?.full_name ?? null,
        performed_by: r.performed_by,
        exam_type: r.exam_type,
        exam_category: r.exam_category,
        exam_name: r.exam_name,
        tuss_code: r.tuss_code,
        performed_at: r.performed_at,
        lab_name: r.lab_name,
        result_text: r.result_text,
        reference_values: r.reference_values,
        interpretation: r.interpretation,
        status: r.status,
        priority: r.priority ?? "normal",
        file_url: r.file_url,
        file_name: r.file_name,
        notes: r.notes,
        source: r.source,
        result_data: r.result_data,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    },
    enabled: !!tenantId,
  });

  // ─── Upload de arquivo ──────────────────────────────────
  const uploadFile = async (file: File, examId: string): Promise<{ url: string; name: string }> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${tenantId}/${examId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("exam-files")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      // Tenta criar o bucket se não existir (apenas em dev)
      if (uploadError.message?.includes("not found")) {
        logger.warn("Bucket exam-files não encontrado, upload sem arquivo");
        throw new Error("Bucket de armazenamento não configurado. Entre em contato com o suporte.");
      }
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("exam-files")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, name: file.name };
  };

  // ─── Criar exame ────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: ExamResultInsert) => {
      const { file, ...rest } = input;

      const insertData: Record<string, unknown> = {
        tenant_id: tenantId,
        patient_id: rest.patient_id,
        requested_by: profile?.id,
        appointment_id: rest.appointment_id || null,
        medical_record_id: rest.medical_record_id || null,
        exam_type: rest.exam_type,
        exam_category: rest.exam_category || null,
        exam_name: rest.exam_name,
        tuss_code: rest.tuss_code || null,
        performed_at: rest.performed_at || null,
        result_text: rest.result_text || null,
        reference_values: rest.reference_values || null,
        interpretation: rest.interpretation || null,
        status: rest.status || "pendente",
        priority: rest.priority || "normal",
        lab_name: rest.lab_name || null,
        notes: rest.notes || null,
      };

      const { data, error } = await (supabase as any)
        .from("exam_results")
        .insert(insertData)
        .select("id")
        .single();

      if (error) throw error;

      // Upload file if provided
      if (file && data?.id) {
        try {
          const { url, name } = await uploadFile(file, (data as any).id);
          await (supabase as any)
            .from("exam_results")
            .update({ file_url: url, file_name: name })
            .eq("id", (data as any).id);
        } catch (uploadErr) {
          logger.error("Erro ao fazer upload do arquivo:", uploadErr);
          // Não falha a criação do exame por causa do upload
          toast.warning("Exame salvo, mas houve erro no upload do arquivo.");
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Exame registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
    },
    onError: (err) => {
      logger.error("Erro ao registrar exame:", err);
      toast.error("Erro ao registrar exame");
    },
  });

  // ─── Atualizar exame ────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (input: ExamResultUpdate) => {
      const { id, file, removeFile, ...rest } = input;

      const updateData: Record<string, unknown> = {};
      if (rest.patient_id !== undefined) updateData.patient_id = rest.patient_id;
      if (rest.appointment_id !== undefined) updateData.appointment_id = rest.appointment_id || null;
      if (rest.medical_record_id !== undefined) updateData.medical_record_id = rest.medical_record_id || null;
      if (rest.exam_type !== undefined) updateData.exam_type = rest.exam_type;
      if (rest.exam_category !== undefined) updateData.exam_category = rest.exam_category || null;
      if (rest.exam_name !== undefined) updateData.exam_name = rest.exam_name;
      if (rest.tuss_code !== undefined) updateData.tuss_code = rest.tuss_code || null;
      if (rest.performed_at !== undefined) updateData.performed_at = rest.performed_at || null;
      if (rest.result_text !== undefined) updateData.result_text = rest.result_text || null;
      if (rest.reference_values !== undefined) updateData.reference_values = rest.reference_values || null;
      if (rest.interpretation !== undefined) updateData.interpretation = rest.interpretation || null;
      if (rest.status !== undefined) updateData.status = rest.status;
      if (rest.priority !== undefined) updateData.priority = rest.priority;
      if (rest.lab_name !== undefined) updateData.lab_name = rest.lab_name || null;
      if (rest.notes !== undefined) updateData.notes = rest.notes || null;

      // Handle file removal
      if (removeFile) {
        updateData.file_url = null;
        updateData.file_name = null;
      }

      // Handle file upload
      if (file) {
        try {
          const { url, name } = await uploadFile(file, id);
          updateData.file_url = url;
          updateData.file_name = name;
        } catch (uploadErr) {
          logger.error("Erro ao fazer upload:", uploadErr);
          toast.warning("Erro no upload do arquivo, mas os dados serão salvos.");
        }
      }

      if (Object.keys(updateData).length === 0) return;

      const { error } = await (supabase as any)
        .from("exam_results")
        .update(updateData)
        .eq("id", id)
        .eq("tenant_id", tenantId!);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exame atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
    },
    onError: (err) => {
      logger.error("Erro ao atualizar exame:", err);
      toast.error("Erro ao atualizar exame");
    },
  });

  // ─── Deletar exame ──────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("exam_results")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exame excluído!");
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
    },
    onError: (err) => {
      logger.error("Erro ao excluir exame:", err);
      toast.error("Erro ao excluir exame");
    },
  });

  return {
    // Query
    examResults: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,

    // Mutations
    createExam: createMutation.mutateAsync,
    updateExam: updateMutation.mutateAsync,
    deleteExam: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
