/**
 * Seção de conquistas de metas (Dashboard).
 * Desativado: requer tabela `goals` e RPCs no banco para ativar.
 * Para ativar: criar migração goals + RPCs e remover o early return null.
 */
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
