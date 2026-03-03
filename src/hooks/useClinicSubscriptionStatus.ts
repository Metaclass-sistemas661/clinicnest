import { useState, useEffect, useCallback } from "react";
import { supabasePatient } from "@/integrations/supabase/client";

/**
 * Hook que verifica se a clínica vinculada ao paciente tem assinatura ativa.
 * Se o trial expirou e a clínica não assinou, o portal do paciente é bloqueado.
 *
 * Usa a tabela `patient_profiles` → `tenant_id` → `subscriptions`.
 */
export function useClinicSubscriptionStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [clinicHasAccess, setClinicHasAccess] = useState(true);
  const [clinicName, setClinicName] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) {
        setClinicHasAccess(true); // sem user = não logado, deixa o PatientProtectedRoute cuidar
        setIsLoading(false);
        return;
      }

      // 1. Resolver tenant_id do paciente via patient_profiles
      const { data: link } = await supabasePatient
        .from("patient_profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!link?.tenant_id) {
        // Paciente não está vinculado a nenhuma clínica — permitir acesso (orphan)
        setClinicHasAccess(true);
        setIsLoading(false);
        return;
      }

      // 2. Buscar nome da clínica
      const { data: tenant } = await supabasePatient
        .from("tenants")
        .select("name")
        .eq("id", link.tenant_id)
        .maybeSingle();

      if (tenant?.name) {
        setClinicName(tenant.name);
      }

      // 3. Verificar subscription da clínica
      const { data: sub } = await supabasePatient
        .from("subscriptions")
        .select("status, trial_end, current_period_end, plan")
        .eq("tenant_id", link.tenant_id)
        .maybeSingle();

      if (!sub) {
        // Sem subscription = acesso permitido (pode ser fallback)
        setClinicHasAccess(true);
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;

      const isTrialing = sub.status === "trialing";
      const isActive = sub.status === "active";
      const isInactive = sub.status === "inactive";
      const trialExpired = trialEnd ? now > trialEnd : false;
      const periodNotExpired = periodEnd ? now <= periodEnd : false;

      // Mesma lógica do useSubscription.ts da clínica
      const subscribed = Boolean(periodNotExpired && (isActive || isInactive) && sub.plan);
      const hasAccess = subscribed || (isTrialing && !trialExpired);

      setClinicHasAccess(hasAccess);
    } catch {
      // Em caso de erro, permitir acesso para não bloquear pacientes indevidamente
      setClinicHasAccess(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();

    // Re-check a cada 5 minutos
    const interval = setInterval(() => void check(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [check]);

  return { isLoading, clinicHasAccess, clinicName, refresh: check };
}
