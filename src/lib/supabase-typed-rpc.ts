/**
 * Wrapper tipado para RPCs do Supabase que não estão no types gerado
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DashboardSalaryTotals,
  DashboardCommissionTotals,
  SalaryPaymentRow,
  ProfessionalWithSalaryRow,
  PaySalaryResult,
  GoalWithProgressRow,
} from "@/types/supabase-extensions";
import type { AppointmentStatus, TransactionType, StockOutReasonType } from "@/types/database";

type RpcFn = <T>(name: string, params?: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>;
const rpc = supabase.rpc.bind(supabase) as RpcFn;

export async function getDashboardSalaryTotals(params: {
  p_tenant_id: string;
  p_is_admin: boolean;
  p_professional_user_id: string | null;
}): Promise<{ data: DashboardSalaryTotals | null; error: unknown }> {
  return rpc<DashboardSalaryTotals>("get_dashboard_salary_totals", params);
}

export async function getSalaryPayments(params: {
  p_tenant_id: string;
  p_professional_id: string | null;
  p_year: number | null;
  p_month: number | null;
}): Promise<{ data: SalaryPaymentRow[] | null; error: unknown }> {
  return rpc<SalaryPaymentRow[]>("get_salary_payments", params);
}

export async function getProfessionalsWithSalary(params: {
  p_tenant_id: string;
}): Promise<{ data: ProfessionalWithSalaryRow[] | null; error: unknown }> {
  return rpc<ProfessionalWithSalaryRow[]>("get_professionals_with_salary", params);
}

export async function paySalary(params: {
  p_tenant_id: string;
  p_professional_id: string;
  p_payment_year: number;
  p_payment_month: number;
  p_days_worked: number;
  p_payment_method: string;
  p_payment_reference?: string;
  p_notes?: string;
}): Promise<{ data: PaySalaryResult | null; error: unknown }> {
  return rpc<PaySalaryResult>("pay_salary", params);
}

export async function getDashboardProductLossTotal(params: {
  p_tenant_id: string;
  p_year: number | null;
  p_month: number | null;
}): Promise<{ data: number | null; error: unknown }> {
  return rpc<number>("get_dashboard_product_loss_total", params);
}

export async function getDashboardClientsCount(params: {
  p_tenant_id: string;
}): Promise<{ data: number | null; error: unknown }> {
  return rpc<number>("get_dashboard_clients_count", params);
}

export async function getDashboardCommissionTotals(params: {
  p_tenant_id: string;
  p_is_admin: boolean;
  p_professional_user_id: string | null;
}): Promise<{ data: DashboardCommissionTotals | null; error: unknown }> {
  return rpc<DashboardCommissionTotals>("get_dashboard_commission_totals", params);
}

export async function getGoalsWithProgress(params: {
  p_tenant_id: string;
  p_include_archived?: boolean;
}): Promise<{ data: GoalWithProgressRow[] | null; error: unknown }> {
  return rpc<GoalWithProgressRow[]>("get_goals_with_progress", params);
}

export type CreateAppointmentV2Result = {
  success: boolean;
  appointment_id: string;
  status: AppointmentStatus;
};

export async function createAppointmentV2(params: {
  p_client_id?: string | null;
  p_service_id?: string | null;
  p_professional_profile_id?: string | null;
  p_scheduled_at?: string | null;
  p_duration_minutes?: number | null;
  p_price?: number | null;
  p_status?: AppointmentStatus;
  p_notes?: string | null;
}): Promise<{ data: CreateAppointmentV2Result | null; error: unknown }> {
  return rpc<CreateAppointmentV2Result>("create_appointment_v2", params);
}

export type UpdateAppointmentV2Result = {
  success: boolean;
  appointment_id: string;
  notes_only: boolean;
};

export async function updateAppointmentV2(params: {
  p_appointment_id: string;
  p_client_id?: string | null;
  p_service_id?: string | null;
  p_professional_profile_id?: string | null;
  p_scheduled_at?: string | null;
  p_duration_minutes?: number | null;
  p_price?: number | null;
  p_notes?: string | null;
}): Promise<{ data: UpdateAppointmentV2Result | null; error: unknown }> {
  return rpc<UpdateAppointmentV2Result>("update_appointment_v2", params);
}

export type DeleteAppointmentV2Result = { success: boolean; appointment_id: string };
export async function deleteAppointmentV2(params: {
  p_appointment_id: string;
  p_reason?: string | null;
}): Promise<{ data: DeleteAppointmentV2Result | null; error: unknown }> {
  return rpc<DeleteAppointmentV2Result>("delete_appointment_v2", params);
}

export type SetAppointmentStatusV2Result = {
  success: boolean;
  appointment_id: string;
  status?: AppointmentStatus;
  unchanged?: boolean;
  already_cancelled?: boolean;
};
export async function setAppointmentStatusV2(params: {
  p_appointment_id: string;
  p_status: AppointmentStatus;
}): Promise<{ data: SetAppointmentStatusV2Result | null; error: unknown }> {
  return rpc<SetAppointmentStatusV2Result>("set_appointment_status_v2", params);
}

export type CreateFinancialTransactionV2Result = { success: boolean; transaction_id: string };
export async function createFinancialTransactionV2(params: {
  p_type: TransactionType;
  p_category: string;
  p_amount: number;
  p_description?: string | null;
  p_transaction_date?: string | null;
}): Promise<{ data: CreateFinancialTransactionV2Result | null; error: unknown }> {
  return rpc<CreateFinancialTransactionV2Result>("create_financial_transaction_v2", params);
}

export type AdjustStockResult = {
  success: boolean;
  product_id: string;
  movement_id: string;
  financial_transaction_id: string | null;
  new_quantity: number;
};
export async function adjustStock(params: {
  p_product_id: string;
  p_movement_type: "in" | "out";
  p_quantity: number;
  p_out_reason_type?: StockOutReasonType | null;
  p_reason?: string | null;
  p_purchased_with_company_cash?: boolean;
}): Promise<{ data: AdjustStockResult | null; error: unknown }> {
  return rpc<AdjustStockResult>("adjust_stock", params as Record<string, unknown>);
}

export type CreateProductV2Result = {
  success: boolean;
  product_id: string;
  financial_transaction_id: string | null;
};
export async function createProductV2(params: {
  p_name: string;
  p_description?: string | null;
  p_cost?: number;
  p_sale_price?: number;
  p_quantity?: number;
  p_min_quantity?: number;
  p_category_id?: string | null;
  p_purchased_with_company_cash?: boolean;
}): Promise<{ data: CreateProductV2Result | null; error: unknown }> {
  return rpc<CreateProductV2Result>("create_product_v2", params as Record<string, unknown>);
}

export type UpsertServiceV2Result = { success: boolean; service_id: string };
export async function upsertServiceV2(params: {
  p_service_id?: string | null;
  p_name: string;
  p_description?: string | null;
  p_duration_minutes: number;
  p_price: number;
  p_is_active?: boolean;
}): Promise<{ data: UpsertServiceV2Result | null; error: unknown }> {
  return rpc<UpsertServiceV2Result>("upsert_service_v2", params as Record<string, unknown>);
}

export type SetServiceActiveV2Result = { success: boolean; service_id: string; is_active: boolean };
export async function setServiceActiveV2(params: {
  p_service_id: string;
  p_is_active: boolean;
}): Promise<{ data: SetServiceActiveV2Result | null; error: unknown }> {
  return rpc<SetServiceActiveV2Result>("set_service_active_v2", params as Record<string, unknown>);
}

export type UpsertClientV2Result = { success: boolean; client_id: string };
export async function upsertClientV2(params: {
  p_client_id?: string | null;
  p_name: string;
  p_phone?: string | null;
  p_email?: string | null;
  p_notes?: string | null;
}): Promise<{ data: UpsertClientV2Result | null; error: unknown }> {
  return rpc<UpsertClientV2Result>("upsert_client_v2", params as Record<string, unknown>);
}

export type CreateProductCategoryV2Result = { success: boolean; category_id: string };
export async function createProductCategoryV2(params: {
  p_name: string;
}): Promise<{ data: CreateProductCategoryV2Result | null; error: unknown }> {
  return rpc<CreateProductCategoryV2Result>("create_product_category_v2", params as Record<string, unknown>);
}

export type UpdateProductPricesV2Result = { success: boolean; product_id: string };
export async function updateProductPricesV2(params: {
  p_product_id: string;
  p_cost: number;
  p_sale_price: number;
  p_category_id?: string | null;
}): Promise<{ data: UpdateProductPricesV2Result | null; error: unknown }> {
  return rpc<UpdateProductPricesV2Result>("update_product_prices_v2", params as Record<string, unknown>);
}

export type CreateGoalV2Result = { success: boolean; goal_id: string };
export async function createGoalV2(params: {
  p_name: string;
  p_goal_type: string;
  p_target_value: number;
  p_period: string;
  p_professional_id?: string | null;
  p_product_id?: string | null;
  p_show_in_header?: boolean;
}): Promise<{ data: CreateGoalV2Result | null; error: unknown }> {
  return rpc<CreateGoalV2Result>("create_goal_v2", params as Record<string, unknown>);
}

export type UpdateGoalV2Result = { success: boolean; goal_id: string };
export async function updateGoalV2(params: {
  p_goal_id: string;
  p_name: string;
  p_target_value: number;
  p_period: string;
  p_professional_id?: string | null;
  p_product_id?: string | null;
  p_show_in_header?: boolean | null;
  p_header_priority?: number | null;
}): Promise<{ data: UpdateGoalV2Result | null; error: unknown }> {
  return rpc<UpdateGoalV2Result>("update_goal_v2", params as Record<string, unknown>);
}

export type ArchiveGoalV2Result = { success: boolean; goal_id: string; archived: boolean };
export async function archiveGoalV2(params: {
  p_goal_id: string;
  p_archived: boolean;
}): Promise<{ data: ArchiveGoalV2Result | null; error: unknown }> {
  return rpc<ArchiveGoalV2Result>("archive_goal_v2", params as Record<string, unknown>);
}

export type CreateGoalTemplateV2Result = { success: boolean; template_id: string };
export async function createGoalTemplateV2(params: {
  p_name: string;
  p_goal_type: string;
  p_target_value: number;
  p_period: string;
}): Promise<{ data: CreateGoalTemplateV2Result | null; error: unknown }> {
  return rpc<CreateGoalTemplateV2Result>("create_goal_template_v2", params as Record<string, unknown>);
}

export type SecurityDiagnosticsV1 = {
  tenant_id: string;
  generated_at: string;
  rls: Array<{ table: string; rls_enabled: boolean; rls_forced: boolean }>;
  triggers: Array<{ name: string; exists: boolean }>;
  functions: Array<{ name: string; exists: boolean }>;
  indexes: Array<{ name: string; exists: boolean }>;
};

export async function getSecurityDiagnosticsV1(): Promise<{ data: SecurityDiagnosticsV1 | null; error: unknown }> {
  return rpc<SecurityDiagnosticsV1>("get_security_diagnostics_v1");
}
