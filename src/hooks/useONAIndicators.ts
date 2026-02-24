import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ONAIndicators {
  id: string;
  tenant_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  tipo_periodo: string;
  tempo_espera_medio: number | null;
  tempo_espera_min: number | null;
  tempo_espera_max: number | null;
  tempo_espera_p90: number | null;
  total_atendimentos_espera: number | null;
  taxa_cancelamento: number | null;
  taxa_noshow: number | null;
  total_agendamentos: number | null;
  total_cancelados: number | null;
  total_noshow: number | null;
  total_realizados: number | null;
  completude_prontuario: number | null;
  total_prontuarios: number | null;
  prontuarios_completos: number | null;
  campos_obrigatorios_faltantes: Record<string, number> | null;
  taxa_ocupacao_salas: number | null;
  horas_disponiveis: number | null;
  horas_ocupadas: number | null;
  ocupacao_por_sala: Record<string, { nome: string; taxa: number; horas: number }> | null;
  taxa_retorno_nao_programado: number | null;
  total_retornos_7dias: number | null;
  total_atendimentos_periodo: number | null;
  nps_score: number | null;
  nps_promotores: number | null;
  nps_neutros: number | null;
  nps_detratores: number | null;
  total_respostas_nps: number | null;
  total_eventos_adversos: number | null;
  eventos_por_severidade: Record<string, number> | null;
  eventos_por_tipo: Record<string, number> | null;
  calculado_em: string;
}

export interface AdverseEvent {
  id: string;
  numero_notificacao: string;
  data_evento: string;
  data_notificacao: string;
  tipo: string;
  tipo_outro?: string;
  severidade: string;
  client_id?: string;
  professional_id?: string;
  setor?: string;
  local_evento?: string;
  descricao: string;
  circunstancias?: string;
  testemunhas?: string;
  status: string;
  notificado_por?: string;
  responsavel_investigacao?: string;
  causa_raiz?: string;
  fatores_contribuintes?: string[];
  acoes_imediatas?: string;
  acoes_corretivas?: string;
  acoes_preventivas?: string;
  prazo_acoes?: string;
  data_encerramento?: string;
  conclusao?: string;
  licoes_aprendidas?: string;
  notificado_anvisa: boolean;
  data_notificacao_anvisa?: string;
  protocolo_anvisa?: string;
  created_at: string;
  updated_at: string;
  client?: { name: string };
  professional?: { name: string };
}

export interface CreateAdverseEventInput {
  data_evento: string;
  tipo: string;
  tipo_outro?: string;
  severidade: string;
  client_id?: string;
  professional_id?: string;
  setor?: string;
  local_evento?: string;
  descricao: string;
  circunstancias?: string;
  testemunhas?: string;
  acoes_imediatas?: string;
}

export function useONAIndicators(periodoInicio?: string, periodoFim?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["ona-indicators", tenantId, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("ona_indicators")
        .select("*")
        .order("periodo_fim", { ascending: false });

      if (periodoInicio && periodoFim) {
        query = query
          .gte("periodo_inicio", periodoInicio)
          .lte("periodo_fim", periodoFim);
      }

      const { data, error } = await query.limit(12);

      if (error) throw error;
      return data as ONAIndicators[];
    },
    enabled: !!tenantId,
  });
}

export function useLatestONAIndicators() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["ona-indicators-latest", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ona_indicators")
        .select("*")
        .order("periodo_fim", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as ONAIndicators | null;
    },
    enabled: !!tenantId,
  });
}

export function useCalculateONAIndicators() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inicio,
      fim,
      tipoPeriodo = "MENSAL",
    }: {
      inicio: string;
      fim: string;
      tipoPeriodo?: string;
    }) => {
      const { data, error } = await supabase.rpc("calcular_indicadores_ona", {
        p_tenant_id: tenantId,
        p_inicio: inicio,
        p_fim: fim,
        p_tipo_periodo: tipoPeriodo,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ona-indicators"] });
      queryClient.invalidateQueries({ queryKey: ["ona-indicators-latest"] });
      toast.success("Indicadores calculados com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao calcular indicadores: " + error.message);
    },
  });
}

export function useAdverseEvents(status?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["adverse-events", tenantId, status],
    queryFn: async () => {
      let query = supabase
        .from("adverse_events")
        .select(`
          *,
          client:clients(name),
          professional:professionals(name)
        `)
        .order("data_evento", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AdverseEvent[];
    },
    enabled: !!tenantId,
  });
}

export function useAdverseEvent(id: string) {
  return useQuery({
    queryKey: ["adverse-event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adverse_events")
        .select(`
          *,
          client:clients(name),
          professional:professionals(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as AdverseEvent;
    },
    enabled: !!id,
  });
}

export function useCreateAdverseEvent() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAdverseEventInput) => {
      const { data: numero } = await supabase.rpc("generate_adverse_event_number", {
        p_tenant_id: tenantId,
      });

      const { data, error } = await supabase
        .from("adverse_events")
        .insert({
          tenant_id: tenantId,
          numero_notificacao: numero,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adverse-events"] });
      toast.success("Evento adverso notificado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao notificar evento: " + error.message);
    },
  });
}

export function useUpdateAdverseEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<AdverseEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from("adverse_events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adverse-events"] });
      queryClient.invalidateQueries({ queryKey: ["adverse-event", variables.id] });
      toast.success("Evento atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar evento: " + error.message);
    },
  });
}

export const ADVERSE_EVENT_TYPES = {
  QUEDA: "Queda",
  ERRO_MEDICACAO: "Erro de Medicação",
  LESAO_PRESSAO: "Lesão por Pressão",
  INFECCAO: "Infecção",
  IDENTIFICACAO_INCORRETA: "Identificação Incorreta",
  FALHA_COMUNICACAO: "Falha de Comunicação",
  FALHA_EQUIPAMENTO: "Falha de Equipamento",
  REACAO_ADVERSA: "Reação Adversa",
  EXTRAVIO_MATERIAL: "Extravio de Material",
  OUTRO: "Outro",
} as const;

export const ADVERSE_EVENT_SEVERITIES = {
  NEAR_MISS: { label: "Near Miss", color: "bg-blue-100 text-blue-800" },
  LEVE: { label: "Leve", color: "bg-green-100 text-green-800" },
  MODERADO: { label: "Moderado", color: "bg-yellow-100 text-yellow-800" },
  GRAVE: { label: "Grave", color: "bg-orange-100 text-orange-800" },
  OBITO: { label: "Óbito", color: "bg-red-100 text-red-800" },
} as const;

export const ADVERSE_EVENT_STATUSES = {
  NOTIFICADO: { label: "Notificado", color: "bg-gray-100 text-gray-800" },
  EM_ANALISE: { label: "Em Análise", color: "bg-blue-100 text-blue-800" },
  ACAO_CORRETIVA: { label: "Ação Corretiva", color: "bg-yellow-100 text-yellow-800" },
  ENCERRADO: { label: "Encerrado", color: "bg-green-100 text-green-800" },
  REABERTO: { label: "Reaberto", color: "bg-purple-100 text-purple-800" },
} as const;
