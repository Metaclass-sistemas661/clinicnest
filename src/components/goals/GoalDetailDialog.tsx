// Componente desativado - funções RPC de goals não existem
// TODO: Criar funções RPC no banco de dados para ativar este componente

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
