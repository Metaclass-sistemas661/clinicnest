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

// ─── Orders / Checkout RPC results ──────────────────────────

export interface CreateWalkinOrderResult {
  success: boolean;
  order_id: string;
  appointment_id: string;
}

export interface CreateOrderForAppointmentResult {
  success: boolean;
  order_id: string;
}

export interface AddOrderItemResult {
  success: boolean;
  item_id: string;
  subtotal: number;
}

export interface RemoveOrderItemResult {
  success: boolean;
  subtotal: number;
}

export interface SetOrderDiscountResult {
  success: boolean;
  total_amount: number;
}

export interface FinalizeOrderResult {
  success: boolean;
  order_id: string;
  status: string;
}

// ─── Cash Register / Caixa RPC results ──────────────────────

export interface OpenCashSessionResult {
  success: boolean;
  session_id: string;
}

export interface AddCashMovementResult {
  success: boolean;
  movement_id: string;
  session_id: string;
}

export interface CashSessionSummaryResult {
  success: boolean;
  session_id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  reinforcements: number;
  withdrawals: number;
  payments: Array<{
    payment_method_id: string;
    code: string;
    name: string;
    amount: number;
  }>;
  expected_closing_balance: number;
}

export interface OpenCashSessionSummaryResult {
  success: boolean;
  has_open_session: boolean;
  session_id?: string;
  summary?: CashSessionSummaryResult;
  expected_closing_balance?: number;
}

export interface CloseCashSessionResult {
  success: boolean;
  session_id: string;
  status: string;
  expected: number;
  reported: number;
  difference: number;
}

// ─── Agenda Availability / Blocks RPC results ───────────────

export interface UpsertProfessionalWorkingHoursResult {
  success: boolean;
  id: string;
}

export interface CreateScheduleBlockResult {
  success: boolean;
  block_id: string;
}

export interface DeleteScheduleBlockResult {
  success: boolean;
}

// ─── CRM / Timeline / Pacotes (Milestone 5) ────────────────

export interface CreateClientPackageResult {
  success: boolean;
  package_id: string;
}

export interface ClientTimelineEventRow {
  event_at: string;
  kind: string;
  title: string;
  body: string | null;
  meta: Record<string, unknown>;
}

export interface RevertPackageConsumptionResult {
  success: boolean;
  reverted: boolean;
  reason?: string;
  package_id?: string;
  appointment_id?: string;
}

// ─── Cashback / Fidelidade (Milestone 6) ───────────────────

export interface CashbackWalletRow {
  tenant_id: string;
  client_id: string;
  balance: number;
  updated_at: string;
}

export interface CashbackLedgerRow {
  id: string;
  tenant_id: string;
  client_id: string;
  appointment_id: string | null;
  order_id: string | null;
  delta_amount: number;
  reason: "earn" | "redeem" | "adjust" | "revert";
  notes: string | null;
  actor_user_id: string | null;
  created_at: string;
}

// ─── Campanhas (Milestone 6) ──────────────────────────────

export type CampaignStatus = "draft" | "sending" | "sent" | "cancelled";

export interface CampaignRow {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  html: string;
  banner_url?: string | null;
  preheader?: string | null;
  status: CampaignStatus;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
}

export interface CampaignDeliveryRow {
  id: string;
  tenant_id: string;
  campaign_id: string;
  client_id: string;
  to_email: string;
  status: string;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

// ─── Compras / Inventário (Milestone 7) ────────────────────

export interface CreatePurchaseResult {
  success: boolean;
  purchase_id: string;
  total_amount: number;
  financial_transaction_id: string | null;
}

export interface CancelPurchaseResult {
  success: boolean;
  already_cancelled?: boolean;
  purchase_id: string;
  reversal_financial_transaction_id?: string | null;
}

/** Resultado da RPC get_dre_simple_v1 */
export interface DreSimpleResult {
  success: boolean;
  start_date: string;
  end_date: string;
  revenue: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
  gross_margin_pct: number | null;
  net_margin_pct: number | null;
  income_by_category: Array<{ category: string; amount: number }>;
  expense_by_category: Array<{ category: string; amount: number }>;
  cogs_by_product: Array<{ product_id: string; product_name: string; amount: number }>;
}

// ─── Financeiro Avançado — Fase 2 ───────────────────────────

export interface CashFlowSeriesPoint {
  date: string;
  actual_income: number;
  actual_expense: number;
  projected_payable: number;
  projected_receivable: number;
  running_balance: number;
  is_past: boolean;
}

export interface CashFlowProjectionResult {
  success: boolean;
  days: number;
  today: string;
  opening_balance: number;
  projected_payable_window: number;
  projected_receivable_window: number;
  overdue_payable: number;
  overdue_receivable: number;
  series: CashFlowSeriesPoint[];
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
