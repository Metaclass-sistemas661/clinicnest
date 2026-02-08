// Componente desativado - tabela goals não existe
// TODO: Criar tabela goals no banco de dados para ativar este componente

import type { GoalWithProgress, GoalType, GoalPeriod } from "@/lib/goals";

interface Profile {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
}

interface GoalCardProps {
  goal: GoalWithProgress;
  professionals: Profile[];
  products: Product[];
  formatCurrency: (v: number) => string;
  formatValue: (g: GoalWithProgress) => string;
  onToggleHeader: (goal: GoalWithProgress) => void;
  onArchive: (goal: GoalWithProgress) => void;
  onDuplicate: (goal: GoalWithProgress) => void;
  onEdit: (goal: GoalWithProgress, data: EditData) => Promise<void>;
  onViewDetail?: (goal: GoalWithProgress) => void;
}

export interface EditData {
  name: string;
  goal_type: GoalType;
  target_value: number;
  period: GoalPeriod;
  professional_id: string | null;
  product_id: string | null;
  show_in_header: boolean;
}

export function GoalCard(_props: GoalCardProps) {
  return null;
}
