import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook para verificar se os pop-ups de gamificação devem ser exibidos.
 * 
 * Retorna true apenas se:
 * 1. O tenant tem gamification_enabled = true (ou não definido)
 * 2. O usuário tem show_gamification_popups = true (ou não definido)
 * 
 * @returns boolean - true se pop-ups devem ser exibidos
 */
export function useGamificationEnabled(): boolean {
  const { profile, tenant } = useAuth();
  
  // Se não tiver dados carregados, assume habilitado (default)
  if (!profile || !tenant) {
    return true;
  }
  
  // Ambos precisam estar habilitados (ou não definidos = default true)
  const tenantEnabled = tenant.gamification_enabled ?? true;
  const userEnabled = profile.show_gamification_popups ?? true;
  
  return tenantEnabled && userEnabled;
}

/**
 * Hook que retorna informações detalhadas sobre o estado da gamificação.
 */
export function useGamificationStatus() {
  const { profile, tenant } = useAuth();
  
  const tenantEnabled = tenant?.gamification_enabled ?? true;
  const userEnabled = profile?.show_gamification_popups ?? true;
  const isEnabled = tenantEnabled && userEnabled;
  
  return {
    isEnabled,
    tenantEnabled,
    userEnabled,
    disabledByTenant: !tenantEnabled,
    disabledByUser: tenantEnabled && !userEnabled,
  };
}
