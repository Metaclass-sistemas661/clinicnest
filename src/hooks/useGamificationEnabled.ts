import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook para verificar se os pop-ups de gamificação devem ser exibidos.
 * 
 * NOTA: Gamificação está desabilitada por padrão no ClinicaFlow (sistema clínico).
 * Retorna true apenas se explicitamente habilitado pelo tenant E pelo usuário.
 * 
 * @returns boolean - true se pop-ups devem ser exibidos
 */
export function useGamificationEnabled(): boolean {
  const { profile, tenant } = useAuth();
  
  // Se não tiver dados carregados, assume desabilitado (default para clínicas)
  if (!profile || !tenant) {
    return false;
  }
  
  // Ambos precisam estar explicitamente habilitados
  const tenantEnabled = tenant.gamification_enabled ?? false;
  const userEnabled = profile.show_gamification_popups ?? false;
  
  return tenantEnabled && userEnabled;
}

/**
 * Hook que retorna informações detalhadas sobre o estado da gamificação.
 */
export function useGamificationStatus() {
  const { profile, tenant } = useAuth();
  
  const tenantEnabled = tenant?.gamification_enabled ?? false;
  const userEnabled = profile?.show_gamification_popups ?? false;
  const isEnabled = tenantEnabled && userEnabled;
  
  return {
    isEnabled,
    tenantEnabled,
    userEnabled,
    disabledByTenant: !tenantEnabled,
    disabledByUser: tenantEnabled && !userEnabled,
  };
}
