/**
 * Tipos para tabelas e RPCs do Supabase que não estão no types gerado
 * ou que precisam de asserções explícitas (evita "as any" no código).
 */

/**
 * Extensão do tipo professional_commissions para incluir campos de salário
 * que foram adicionados após a geração dos tipos
 */
export interface ProfessionalCommissionWithSalary {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  value: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  salary_amount?: number | null;
  payment_type?: string | null;
}

/** Linha retornada por get_salary_payments */
export interface SalaryPaymentRow {
  id: string;
  professional_id: string;
  professional_name: string;
  payment_month: number;
  payment_year: number;
  amount: number;
  days_worked: number | null;
  days_in_month: number | null;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha retornada por get_professionals_with_salary */
export interface ProfessionalWithSalaryRow {
  professional_id: string;
  professional_name: string;
  salary_amount: number;
  salary_payment_day: number | null;
  default_payment_method: string | null;
  commission_id: string;
}

/** Retorno do RPC get_dashboard_salary_totals */
export interface DashboardSalaryTotals {
  pending?: number;
  paid?: number;
}

/** Retorno do RPC pay_salary */
export interface PaySalaryResult {
  amount?: number;
  id?: string;
  [key: string]: unknown;
}

/** Produto de venda em product_sales (appointment_completion_summaries) */
export interface ProductSaleItem {
  product_name?: string;
  quantity?: number;
  profit?: number;
  [key: string]: unknown;
}

/** Retorno do RPC get_dashboard_commission_totals */
export interface DashboardCommissionTotals {
  pending?: number;
  paid?: number;
}

/** Linha retornada por get_goals_with_progress */
export interface GoalWithProgressRow {
  id: string;
  name: string;
  goal_type: string;
  current_value: number;
  target_value: number;
  progress_pct: number;
  professional_id: string;
  product_id: string;
  period: string;
  show_in_header?: boolean;
  [key: string]: unknown;
}
