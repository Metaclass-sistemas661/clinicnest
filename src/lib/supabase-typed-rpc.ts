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
