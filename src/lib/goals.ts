// Tipos e constantes compartilhados para metas

export type GoalType =
  | "revenue"
  | "services_count"
  | "product_quantity"
  | "product_revenue"
  | "clientes_novos"
  | "ticket_medio";

export type GoalPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

export const goalTypeLabels: Record<GoalType, string> = {
  revenue: "Receita",
  services_count: "Serviços concluídos",
  product_quantity: "Quantidade vendida (produtos)",
  product_revenue: "Receita de produtos",
  clientes_novos: "Novos clientes",
  ticket_medio: "Ticket médio",
};

export const periodLabels: Record<GoalPeriod, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export interface GoalWithProgress {
  id: string;
  name: string;
  goal_type: GoalType;
  target_value: number;
  period: GoalPeriod;
  professional_id: string | null;
  product_id: string | null;
  show_in_header: boolean;
  header_priority?: number;
  custom_start?: string | null;
  custom_end?: string | null;
  archived_at?: string | null;
  current_value: number;
  progress_pct: number;
  days_remaining?: number;
  period_elapsed_pct?: number;
  projected_reach?: string;
  period_start?: string;
  period_end?: string;
}

export function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 80) return "bg-green-500/80";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-amber-500/80";
  return "bg-red-500";
}

/** Classes para a barra de progresso (indicador interno) - uso em Progress */
export function getProgressIndicatorClass(pct: number): string {
  if (pct >= 100) return "[&>div]:bg-green-500";
  if (pct >= 80) return "[&>div]:bg-green-500/80";
  if (pct >= 50) return "[&>div]:bg-amber-500";
  if (pct >= 25) return "[&>div]:bg-amber-500/80";
  return "[&>div]:bg-red-500";
}

export function getProgressBorderColor(pct: number): string {
  if (pct >= 100) return "border-green-500/30";
  if (pct >= 50) return "border-amber-500/30";
  return "border-red-500/30";
}

export function getProjectedBadgeVariant(
  projected?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (!projected) return "secondary";
  if (projected === "Meta atingida!" || projected === "No prazo") return "default";
  if (projected === "Atenção") return "secondary";
  return "destructive";
}
