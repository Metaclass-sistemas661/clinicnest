import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/gcp/types";

// ── Types ────────────────────────────────────────────────────────────
export interface HealthCreditRule {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  points: number;
  is_active: boolean;
  description: string;
  expiry_days: number;
  max_per_day: number | null;
  config: Record<string, unknown>;
  created_at: string;
}

export interface HealthCreditLeaderboardEntry {
  patient_id: string;
  patient_name: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  tier: string;
  updated_at: string;
}

export interface HealthCreditTransaction {
  id: string;
  type: "earn" | "redeem" | "expire" | "adjustment";
  amount: number;
  balance_after: number;
  reason: string;
  reference_type: string;
  created_at: string;
  expires_at: string | null;
}

export interface RedemptionConfig {
  id: string;
  tenant_id: string;
  credits_per_real: number;
  min_redeem: number;
  max_discount_percent: number;
  is_active: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  appointment_completed: "Consulta realizada",
  referral: "Indicação de amigo",
  birthday: "Aniversário",
  streak: "Sequência de visitas",
  review: "Avaliação",
  vaccine: "Vacinação",
  checkup: "Check-up preventivo",
};

export function getTriggerLabel(trigger: string) {
  return TRIGGER_LABELS[trigger] ?? trigger;
}

export const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// ── Hook: regras de créditos ─────────────────────────────────────────
export function useHealthCreditRules() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const tenantId = tenant?.id;

  const rulesQuery = useQuery({
    queryKey: ["health-credit-rules", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await api
        .from("health_credits_rules" as never)
        .select("*")
        .eq("tenant_id" as never, tenantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HealthCreditRule[];
    },
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: Partial<HealthCreditRule> & { tenant_id: string }) => {
      const payload = {
        ...rule,
        config: (rule.config ?? {}) as unknown as Json,
      };
      if (rule.id) {
        const { error } = await api
          .from("health_credits_rules" as never)
          .update(payload as never)
          .eq("id" as never, rule.id);
        if (error) throw error;
      } else {
        const { error } = await api
          .from("health_credits_rules" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-credit-rules"] });
      toast.success("Regra salva");
    },
    onError: () => toast.error("Erro ao salvar regra"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api
        .from("health_credits_rules" as never)
        .delete()
        .eq("id" as never, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-credit-rules"] });
      toast.success("Regra removida");
    },
    onError: () => toast.error("Erro ao remover regra"),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await api
        .from("health_credits_rules" as never)
        .update({ is_active } as never)
        .eq("id" as never, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-credit-rules"] });
    },
  });

  return { ...rulesQuery, upsertRule, deleteRule, toggleRule };
}

// ── Hook: leaderboard ────────────────────────────────────────────────
export function useHealthCreditsLeaderboard() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ["health-credits-leaderboard", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await api.rpc("get_health_credits_leaderboard", {
        p_tenant_id: tenantId!,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as unknown as HealthCreditLeaderboardEntry[];
    },
  });
}

// ── Hook: extrato de um paciente ─────────────────────────────────────
export function usePatientCreditsHistory(patientId: string | null) {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ["health-credits-history", tenantId, patientId],
    enabled: !!tenantId && !!patientId,
    queryFn: async () => {
      const { data, error } = await api.rpc("get_patient_credits_history", {
        p_tenant_id: tenantId!,
        p_patient_id: patientId!,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as unknown as HealthCreditTransaction[];
    },
  });
}

// ── Hook: ajuste manual ──────────────────────────────────────────────
export function useAdjustCredits() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tenant_id: string;
      patient_id: string;
      amount: number;
      reason: string;
    }) => {
      const { data, error } = await api.rpc("adjust_health_credits", {
        p_tenant_id: params.tenant_id,
        p_patient_id: params.patient_id,
        p_amount: params.amount,
        p_reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-credits-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["health-credits-history"] });
      toast.success("Ajuste aplicado");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao ajustar créditos"),
  });
}

// ── Hook: config de resgate ──────────────────────────────────────────
export function useRedemptionConfig() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const tenantId = tenant?.id;

  const query = useQuery({
    queryKey: ["health-credits-redemption-config", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await api
        .from("health_credits_redemption_config" as never)
        .select("*")
        .eq("tenant_id" as never, tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RedemptionConfig) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (cfg: Partial<RedemptionConfig>) => {
      const payload = { ...cfg, tenant_id: tenantId!, updated_at: new Date().toISOString() };
      const { error } = await api
        .from("health_credits_redemption_config" as never)
        .upsert(payload as never, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-credits-redemption-config"] });
      toast.success("Configuração de resgate salva");
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  return { ...query, save };
}
