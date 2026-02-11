/**
 * Diálogo de detalhe da meta.
 * Desativado: requer funções RPC de goals no banco para ativar.
 * Para ativar: criar RPCs e implementar o conteúdo do diálogo.
 */
import type { GoalWithProgress } from "@/lib/goals";

interface GoalDetailDialogProps {
  goal: GoalWithProgress;
  tenantId: string;
  formatValue: (g: GoalWithProgress) => string;
  onClose: () => void;
}

export function GoalDetailDialog({ onClose }: GoalDetailDialogProps) {
  // Fecha imediatamente pois as funções RPC não existem
  onClose();
  return null;
}
