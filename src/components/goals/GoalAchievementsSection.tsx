// Componente desativado - tabela goals e funções RPC não existem
// TODO: Criar tabela goals no banco de dados para ativar este componente

import type { GoalWithProgress } from "@/lib/goals";

interface Profile {
  id: string;
  full_name: string;
}

interface GoalAchievementsSectionProps {
  completedGoals: GoalWithProgress[];
  professionals: Profile[];
  tenantId: string;
  professionalId?: string | null;
  recordOnLoad?: boolean;
}

export function GoalAchievementsSection(_props: GoalAchievementsSectionProps) {
  return null;
}
