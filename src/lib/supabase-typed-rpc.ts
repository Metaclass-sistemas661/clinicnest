/**
 * Wrapper tipado para RPCs do Supabase que não estão no types gerado.
 * Cada função mapeia 1:1 para uma RPC SECURITY DEFINER no Supabase.
 * O tenant_id é deduzido automaticamente pelo contexto JWT via get_my_context().
 * @module supabase-typed-rpc
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DashboardSalaryTotals,
  DashboardCommissionTotals,
  SalaryPaymentRow,
  ProfessionalWithSalaryRow,
  PaySalaryResult,
  GoalWithProgressRow,
  CreateWalkinOrderResult,
  CreateOrderForAppointmentResult,
  AddOrderItemResult,
  RemoveOrderItemResult,
  SetOrderDiscountResult,
  FinalizeOrderResult,
  OpenCashSessionResult,
  AddCashMovementResult,
  CashSessionSummaryResult,
  OpenCashSessionSummaryResult,
  CloseCashSessionResult,
  UpsertProfessionalWorkingHoursResult,
  CreateScheduleBlockResult,
  DeleteScheduleBlockResult,
  CreateClientPackageResult,
  PatientTimelineEventRow,
  ClientTimelineEventRow,
  RevertPackageConsumptionResult,
  CreatePurchaseResult,
  CancelPurchaseResult,
  DreSimpleResult,
  CashFlowProjectionResult,
} from "@/types/supabase-extensions";
import type { AppointmentStatus, TransactionType, StockOutReasonType } from "@/types/database";

type RpcFn = <T>(name: string, params?: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>;
const rpc = supabase.rpc.bind(supabase) as RpcFn;

/**
 * Retorna totais de salários do dashboard (pendentes, pagos no mês).
 * Admins veem todos os profissionais; profissionais veem apenas seus dados.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_is_admin - Se o usuário é admin
 * @param params.p_professional_user_id - UUID do profissional (null se admin)
 * @returns Totais de salários por período
 */
export async function getDashboardSalaryTotals(params: {
  p_tenant_id: string;
  p_is_admin: boolean;
  p_professional_user_id: string | null;
}): Promise<{ data: DashboardSalaryTotals | null; error: unknown }> {
  return rpc<DashboardSalaryTotals>("get_dashboard_salary_totals", params);
}

/**
 * Lista pagamentos de salário filtrados por profissional e período.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_professional_id - Filtro por profissional (null = todos)
 * @param params.p_year - Ano filtro (null = todos)
 * @param params.p_month - Mês filtro (null = todos)
 * @returns Array de registros de pagamento
 */
export async function getSalaryPayments(params: {
  p_tenant_id: string;
  p_professional_id: string | null;
  p_year: number | null;
  p_month: number | null;
}): Promise<{ data: SalaryPaymentRow[] | null; error: unknown }> {
  return rpc<SalaryPaymentRow[]>("get_salary_payments", params);
}

/**
 * Lista todos os profissionais com configuração salarial do tenant.
 * @param params.p_tenant_id - UUID do tenant
 * @returns Array de profissionais com dados de salário
 */
export async function getProfessionalsWithSalary(params: {
  p_tenant_id: string;
}): Promise<{ data: ProfessionalWithSalaryRow[] | null; error: unknown }> {
  return rpc<ProfessionalWithSalaryRow[]>("get_professionals_with_salary", params);
}

/**
 * Registra pagamento de salário para um profissional.
 * Cria transação financeira automática e registra no histórico.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_professional_id - UUID do profissional
 * @param params.p_payment_year - Ano de competência
 * @param params.p_payment_month - Mês de competência
 * @param params.p_days_worked - Dias trabalhados para cálculo proporcional
 * @param params.p_payment_method - Método de pagamento (pix, transferencia, etc.)
 * @returns Resultado do pagamento com ID da transação
 */
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

/**
 * Retorna total de perdas de produtos (avarias, vencidos) no período.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_year - Ano (null = todos)
 * @param params.p_month - Mês (null = todos)
 * @returns Total monetário de perdas
 */
export async function getDashboardProductLossTotal(params: {
  p_tenant_id: string;
  p_year: number | null;
  p_month: number | null;
}): Promise<{ data: number | null; error: unknown }> {
  return rpc<number>("get_dashboard_product_loss_total", params);
}

/**
 * Conta total de pacientes ativos do tenant.
 * @param params.p_tenant_id - UUID do tenant
 * @returns Contagem de pacientes
 */
export async function getDashboardPatientsCount(params: {
  p_tenant_id: string;
}): Promise<{ data: number | null; error: unknown }> {
  return rpc<number>("get_dashboard_clients_count", params);
}

/** @deprecated Use getDashboardPatientsCount instead */
export const getDashboardClientsCount = getDashboardPatientsCount;

/**
 * Retorna totais de comissões (a pagar, pagas, a receber).
 * Admins veem todas; profissionais veem apenas suas comissões.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_is_admin - Se o usuário é admin
 * @param params.p_professional_user_id - UUID do profissional (null se admin)
 * @returns Totais de comissões por status
 */
export async function getDashboardCommissionTotals(params: {
  p_tenant_id: string;
  p_is_admin: boolean;
  p_professional_user_id: string | null;
}): Promise<{ data: DashboardCommissionTotals | null; error: unknown }> {
  return rpc<DashboardCommissionTotals>("get_dashboard_commission_totals", params);
}

/**
 * Lista metas (goals) com progresso calculado automaticamente.
 * @param params.p_tenant_id - UUID do tenant
 * @param params.p_include_archived - Incluir metas arquivadas (default: false)
 * @returns Array de metas com valores atuais e % de progresso
 */
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

/**
 * Cria agendamento com validações de conflito de horário e disponibilidade.
 * Infere tenant_id do JWT. Valida status e profissional automaticamente.
 * @param params.p_client_id - UUID do paciente (opcional para encaixe)
 * @param params.p_service_id - UUID do procedimento
 * @param params.p_professional_profile_id - UUID do profissional
 * @param params.p_scheduled_at - Data/hora ISO do agendamento
 * @param params.p_duration_minutes - Duração em minutos
 * @param params.p_price - Valor da consulta
 * @returns ID do agendamento criado e status
 */
export async function createAppointmentV2(params: {
  p_client_id?: string | null;
  p_service_id?: string | null;
  p_professional_profile_id?: string | null;
  p_scheduled_at?: string | null;
  p_duration_minutes?: number | null;
  p_price?: number | null;
  p_status?: AppointmentStatus;
  p_notes?: string | null;
  p_telemedicine?: boolean;
  p_booked_by_id?: string | null;
}): Promise<{ data: CreateAppointmentV2Result | null; error: unknown }> {
  return rpc<CreateAppointmentV2Result>("create_appointment_v2", params);
}

export type UpdateAppointmentV2Result = {
  success: boolean;
  appointment_id: string;
  notes_only: boolean;
};

/**
 * Atualiza agendamento existente. Verifica conflitos de horário.
 * Se apenas `p_notes` mudar, marca `notes_only: true` no resultado.
 * @param params.p_appointment_id - UUID do agendamento
 * @returns Resultado com flag notes_only
 */
export async function updateAppointmentV2(params: {
  p_appointment_id: string;
  p_client_id?: string | null;
  p_service_id?: string | null;
  p_professional_profile_id?: string | null;
  p_scheduled_at?: string | null;
  p_duration_minutes?: number | null;
  p_price?: number | null;
  p_notes?: string | null;
  p_telemedicine?: boolean | null;
  p_booked_by_id?: string | null;
}): Promise<{ data: UpdateAppointmentV2Result | null; error: unknown }> {
  return rpc<UpdateAppointmentV2Result>("update_appointment_v2", params);
}

export type DeleteAppointmentV2Result = { success: boolean; appointment_id: string };
/**
 * Exclui agendamento (soft delete ou hard delete conforme configuração do tenant).
 * @param params.p_appointment_id - UUID do agendamento
 * @param params.p_reason - Motivo do cancelamento (opcional)
 */
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
/**
 * Altera status de agendamento (pending, confirmed, completed, cancelled, no_show).
 * Não permite alterar agendamentos já cancelados.
 * @param params.p_appointment_id - UUID do agendamento
 * @param params.p_status - Novo status
 * @returns Resultado com flags unchanged/already_cancelled
 */
export async function setAppointmentStatusV2(params: {
  p_appointment_id: string;
  p_status: AppointmentStatus;
}): Promise<{ data: SetAppointmentStatusV2Result | null; error: unknown }> {
  return rpc<SetAppointmentStatusV2Result>("set_appointment_status_v2", params);
}

export type CreateFinancialTransactionV2Result = { success: boolean; transaction_id: string };
/**
 * Cria transação financeira manual (receita ou despesa).
 * tenant_id inferido do JWT.
 * @param params.p_type - 'income' | 'expense'
 * @param params.p_category - Categoria da transação
 * @param params.p_amount - Valor em BRL
 * @param params.p_description - Descrição opcional
 * @param params.p_transaction_date - Data ISO (default: hoje)
 * @returns ID da transação criada
 */
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
/**
 * Ajusta estoque de produto (entrada ou saída).
 * Cria movimentação de estoque + transação financeira se comprado com caixa.
 * @param params.p_product_id - UUID do produto
 * @param params.p_movement_type - 'in' (entrada) | 'out' (saída)
 * @param params.p_quantity - Quantidade movimentada
 * @param params.p_out_reason_type - Motivo da saída (venda, perda, etc.)
 * @returns Novo saldo, IDs da movimentação e transação
 */
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
/**
 * Cria produto no estóque com preço de custo, venda e quantidade inicial.
 * @param params.p_name - Nome do produto
 * @param params.p_cost - Preço de custo
 * @param params.p_sale_price - Preço de venda
 * @param params.p_quantity - Quantidade inicial em estoque
 * @param params.p_min_quantity - Quantidade mínima para alerta
 * @param params.p_category_id - UUID da categoria (opcional)
 * @returns ID do produto criado
 */
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

export type UpsertProcedureV2Result = { success: boolean; procedure_id: string };
/** @deprecated Use UpsertProcedureV2Result instead */
export type UpsertServiceV2Result = UpsertProcedureV2Result;

/**
 * Cria ou atualiza procedimento clínico.
 * Se p_procedure_id fornecido, atualiza; senão, cria novo.
 * @param params.p_name - Nome do procedimento
 * @param params.p_duration_minutes - Duração padrão em minutos
 * @param params.p_price - Preço padrão
 * @returns ID do procedimento
 */
export async function upsertProcedureV2(params: {
  p_procedure_id?: string | null;
  p_name: string;
  p_description?: string | null;
  p_duration_minutes: number;
  p_price: number;
  p_is_active?: boolean;
}): Promise<{ data: UpsertProcedureV2Result | null; error: unknown }> {
  return rpc<UpsertProcedureV2Result>("upsert_service_v2", params as Record<string, unknown>);
}

/** @deprecated Use upsertProcedureV2 instead */
export const upsertServiceV2 = upsertProcedureV2;

export type SetProcedureActiveV2Result = { success: boolean; procedure_id: string; is_active: boolean };
/** @deprecated Use SetProcedureActiveV2Result instead */
export type SetServiceActiveV2Result = SetProcedureActiveV2Result;

/**
 * Ativa/desativa procedimento. Procedimentos inativos não aparecem na agenda.
 * @param params.p_procedure_id - UUID do procedimento
 * @param params.p_is_active - true para ativar, false para desativar
 */
export async function setProcedureActiveV2(params: {
  p_procedure_id: string;
  p_is_active: boolean;
}): Promise<{ data: SetProcedureActiveV2Result | null; error: unknown }> {
  return rpc<SetProcedureActiveV2Result>("set_service_active_v2", params as Record<string, unknown>);
}

/** @deprecated Use setProcedureActiveV2 instead */
export const setServiceActiveV2 = setProcedureActiveV2;

export type UpsertPatientV2Result = { success: boolean; patient_id: string; access_code?: string };
/** @deprecated Use UpsertPatientV2Result instead */
export type UpsertClientV2Result = UpsertPatientV2Result;

/**
 * Cria ou atualiza paciente com dados completos (CPF, endereço, alergias).
 * Se p_patient_id fornecido, atualiza; senão, cria e gera access_code.
 * @param params.p_name - Nome completo do paciente
 * @param params.p_cpf - CPF (validado no banco)
 * @returns ID do paciente e access_code (para novos)
 */
export async function upsertPatientV2(params: {
  p_patient_id?: string | null;
  p_name: string;
  p_phone?: string | null;
  p_email?: string | null;
  p_notes?: string | null;
  p_cpf?: string | null;
  p_date_of_birth?: string | null;
  p_marital_status?: string | null;
  p_zip_code?: string | null;
  p_street?: string | null;
  p_street_number?: string | null;
  p_complement?: string | null;
  p_neighborhood?: string | null;
  p_city?: string | null;
  p_state?: string | null;
  p_allergies?: string | null;
}): Promise<{ data: UpsertPatientV2Result | null; error: unknown }> {
  return rpc<UpsertPatientV2Result>("upsert_client_v2", params as Record<string, unknown>);
}

/** @deprecated Use upsertPatientV2 instead */
export const upsertClientV2 = upsertPatientV2;

/**
 * Cria pacote de sessões para paciente (ex: 10 sessões de fisioterapia).
 * @param params.p_patient_id - UUID do paciente
 * @param params.p_service_id - UUID do procedimento vinculado
 * @param params.p_total_sessions - Número total de sessões
 * @param params.p_expires_at - Data de expiração ISO (opcional)
 */
export async function createPatientPackageV1(params: {
  p_patient_id: string;
  p_service_id: string;
  p_total_sessions: number;
  p_expires_at?: string | null;
  p_notes?: string | null;
}): Promise<{ data: CreateClientPackageResult | null; error: unknown }> {
  return rpc<CreateClientPackageResult>("create_client_package_v1", params as Record<string, unknown>);
}

/** @deprecated Use createPatientPackageV1 instead */
export const createClientPackageV1 = createPatientPackageV1;

/**
 * Retorna timeline completa do paciente (consultas, exames, prescrições, etc.).
 * @param params.p_patient_id - UUID do paciente
 * @param params.p_limit - Máximo de eventos (default: 50)
 * @returns Array de eventos ordenados por data desc
 */
export async function getPatientTimelineV1(params: {
  p_patient_id: string;
  p_limit?: number;
}): Promise<{ data: PatientTimelineEventRow[] | null; error: unknown }> {
  return rpc<PatientTimelineEventRow[]>("get_client_timeline_v1", params as Record<string, unknown>);
}

/** @deprecated Use getPatientTimelineV1 instead */
export const getClientTimelineV1 = getPatientTimelineV1;

/**
 * Reverte consumo de pacote vinculado a um agendamento cancelado.
 * Restaura a sessão consumida ao saldo do pacote.
 * @param params.p_appointment_id - UUID do agendamento cancelado
 * @param params.p_reason - Motivo da reversão
 */
export async function revertPackageConsumptionForAppointmentV1(params: {
  p_appointment_id: string;
  p_reason?: string | null;
}): Promise<{ data: RevertPackageConsumptionResult | null; error: unknown }> {
  return rpc<RevertPackageConsumptionResult>(
    "revert_package_consumption_for_appointment_v1",
    params as Record<string, unknown>
  );
}

/**
 * Registra compra de fornecedor com múltiplos itens.
 * Cria movimentações de entrada no estoque + transações financeiras.
 * @param params.p_items - Array de {product_id, quantity, unit_cost}
 * @param params.p_purchased_with_company_cash - Se saiu do caixa da empresa
 */
export async function createPurchaseV1(params: {
  p_supplier_id?: string | null;
  p_purchased_at?: string | null;
  p_invoice_number?: string | null;
  p_notes?: string | null;
  p_purchased_with_company_cash?: boolean;
  p_items: Array<{ product_id: string; quantity: number; unit_cost: number }>;
}): Promise<{ data: CreatePurchaseResult | null; error: unknown }> {
  return rpc<CreatePurchaseResult>("create_purchase_v1", {
    ...params,
    p_items: params.p_items as unknown,
  } as Record<string, unknown>);
}

/**
 * Cancela compra e reverte movimentações de estoque + transações.
 * @param params.p_purchase_id - UUID da compra
 * @param params.p_reason - Motivo do cancelamento
 */
export async function cancelPurchaseV1(params: {
  p_purchase_id: string;
  p_reason?: string | null;
}): Promise<{ data: CancelPurchaseResult | null; error: unknown }> {
  return rpc<CancelPurchaseResult>("cancel_purchase_v1", params as Record<string, unknown>);
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

// ─── Orders / Checkout RPCs ──────────────────────────────────

/**
 * Cria comanda/pedido avulso (walk-in, sem agendamento prévio).
 * @param params.p_client_id - UUID do paciente (opcional)
 * @param params.p_professional_id - UUID do profissional (opcional)
 * @returns ID do pedido criado
 */
export async function createWalkinOrderV1(params: {
  p_client_id?: string | null;
  p_professional_id?: string | null;
  p_notes?: string | null;
}): Promise<{ data: CreateWalkinOrderResult | null; error: unknown }> {
  return rpc<CreateWalkinOrderResult>("create_walkin_order_v1", params as Record<string, unknown>);
}

/**
 * Cria comanda vinculada a um agendamento existente.
 * Herda paciente, profissional e procedimento do agendamento.
 * @param params.p_appointment_id - UUID do agendamento
 */
export async function createOrderForAppointmentV1(params: {
  p_appointment_id: string;
}): Promise<{ data: CreateOrderForAppointmentResult | null; error: unknown }> {
  return rpc<CreateOrderForAppointmentResult>("create_order_for_appointment_v1", params as Record<string, unknown>);
}

/**
 * Adiciona item (procedimento ou produto) a um pedido aberto.
 * @param params.p_order_id - UUID do pedido
 * @param params.p_kind - 'service' | 'product'
 * @param params.p_unit_price - Preço unitário
 * @param params.p_quantity - Quantidade (default: 1)
 */
export async function addOrderItemV1(params: {
  p_order_id: string;
  p_kind: "service" | "product";
  p_service_id?: string | null;
  p_product_id?: string | null;
  p_quantity?: number;
  p_unit_price: number;
  p_professional_id?: string | null;
}): Promise<{ data: AddOrderItemResult | null; error: unknown }> {
  return rpc<AddOrderItemResult>("add_order_item_v1", params as Record<string, unknown>);
}

/**
 * Remove item de um pedido aberto.
 * @param params.p_order_item_id - UUID do item
 */
export async function removeOrderItemV1(params: {
  p_order_item_id: string;
}): Promise<{ data: RemoveOrderItemResult | null; error: unknown }> {
  return rpc<RemoveOrderItemResult>("remove_order_item_v1", params as Record<string, unknown>);
}

/**
 * Aplica desconto fixo ao pedido.
 * @param params.p_order_id - UUID do pedido
 * @param params.p_discount_amount - Valor absoluto do desconto em BRL
 */
export async function setOrderDiscountV1(params: {
  p_order_id: string;
  p_discount_amount: number;
}): Promise<{ data: SetOrderDiscountResult | null; error: unknown }> {
  return rpc<SetOrderDiscountResult>("set_order_discount_v1", params as Record<string, unknown>);
}

export type FinalizePaymentInput = {
  payment_method_id: string;
  amount: number;
};

/**
 * Finaliza pedido com pagamento(s). Aceita split de pagamento (múltiplos métodos).
 * Gera transações financeiras, baixa estoque, calcula comissões.
 * @param params.p_order_id - UUID do pedido
 * @param params.p_payments - Array de {payment_method_id, amount}
 */
export async function finalizeOrderV1(params: {
  p_order_id: string;
  p_payments: FinalizePaymentInput[];
}): Promise<{ data: FinalizeOrderResult | null; error: unknown }> {
  return rpc<FinalizeOrderResult>("finalize_order_v1", params as Record<string, unknown>);
}

// ─── Cash Register / Caixa RPCs ─────────────────────────────

/**
 * Abre sessão de caixa do dia. Apenas 1 sessão aberta por vez por usuário.
 * @param params.p_opening_balance - Saldo de abertura em BRL
 * @param params.p_notes - Observações
 * @returns ID da sessão
 */
export async function openCashSessionV1(params: {
  p_opening_balance?: number;
  p_notes?: string | null;
}): Promise<{ data: OpenCashSessionResult | null; error: unknown }> {
  return rpc<OpenCashSessionResult>("open_cash_session_v1", params as Record<string, unknown>);
}

/**
 * Registra reforço ou sangria no caixa.
 * @param params.p_type - 'reinforcement' (reforço) | 'withdrawal' (sangria)
 * @param params.p_amount - Valor em BRL
 * @param params.p_reason - Motivo (obrigatório para sangria)
 */
export async function addCashMovementV1(params: {
  p_type: "reinforcement" | "withdrawal";
  p_amount: number;
  p_reason?: string | null;
}): Promise<{ data: AddCashMovementResult | null; error: unknown }> {
  return rpc<AddCashMovementResult>("add_cash_movement_v1", params as Record<string, unknown>);
}

/**
 * Retorna resumo da sessão de caixa (entradas, saídas, saldo).
 * @param params.p_session_id - UUID da sessão
 */
export async function getCashSessionSummaryV1(params: {
  p_session_id: string;
}): Promise<{ data: CashSessionSummaryResult | null; error: unknown }> {
  return rpc<CashSessionSummaryResult>("get_cash_session_summary_v1", params as Record<string, unknown>);
}

/**
 * Retorna resumo da sessão de caixa atualmente aberta (se houver).
 * @returns Dados da sessão aberta ou null
 */
export async function getOpenCashSessionSummaryV1(): Promise<{
  data: OpenCashSessionSummaryResult | null;
  error: unknown;
}> {
  return rpc<OpenCashSessionSummaryResult>("get_open_cash_session_summary_v1");
}

/**
 * Fecha sessão de caixa, comparando saldo informado vs calculado.
 * @param params.p_session_id - UUID da sessão
 * @param params.p_reported_balance - Saldo contado fisicamente
 * @param params.p_notes - Observações de fechamento
 * @returns Resultado com diferença entre informado e calculado
 */
export async function closeCashSessionV1(params: {
  p_session_id: string;
  p_reported_balance: number;
  p_notes?: string | null;
}): Promise<{ data: CloseCashSessionResult | null; error: unknown }> {
  return rpc<CloseCashSessionResult>("close_cash_session_v1", params as Record<string, unknown>);
}

// ─── Agenda Availability / Blocks RPCs ──────────────────────

/**
 * Configura horário de trabalho de profissional (dia da semana + faixa).
 * @param params.p_professional_id - UUID do profissional
 * @param params.p_day_of_week - 0 (dom) a 6 (sáb)
 * @param params.p_start_time - Início (HH:mm)
 * @param params.p_end_time - Fim (HH:mm)
 * @param params.p_is_active - Se o horário está ativo
 */
export async function upsertProfessionalWorkingHoursV1(params: {
  p_professional_id: string;
  p_day_of_week: number;
  p_start_time: string;
  p_end_time: string;
  p_is_active?: boolean;
}): Promise<{ data: UpsertProfessionalWorkingHoursResult | null; error: unknown }> {
  return rpc<UpsertProfessionalWorkingHoursResult>("upsert_professional_working_hours_v1", params as Record<string, unknown>);
}

/**
 * Cria bloqueio de agenda (férias, feriado, etc.).
 * @param params.p_professional_id - UUID do profissional (null = todos)
 * @param params.p_start_at - Início ISO do bloqueio
 * @param params.p_end_at - Fim ISO do bloqueio
 * @param params.p_reason - Motivo do bloqueio
 */
export async function createScheduleBlockV1(params: {
  p_professional_id?: string | null;
  p_start_at: string;
  p_end_at: string;
  p_reason?: string | null;
}): Promise<{ data: CreateScheduleBlockResult | null; error: unknown }> {
  return rpc<CreateScheduleBlockResult>("create_schedule_block_v1", params as Record<string, unknown>);
}

/**
 * Remove bloqueio de agenda.
 * @param params.p_block_id - UUID do bloqueio
 */
export async function deleteScheduleBlockV1(params: {
  p_block_id: string;
}): Promise<{ data: DeleteScheduleBlockResult | null; error: unknown }> {
  return rpc<DeleteScheduleBlockResult>("delete_schedule_block_v1", params as Record<string, unknown>);
}

// ─── BI / DRE RPCs ──────────────────────────────────

/**
 * Gera DRE (Demonstrativo de Resultado do Exercício) simplificado.
 * Agrupa receitas e despesas por categoria no período.
 * @param params.p_start_date - Data início ISO (YYYY-MM-DD)
 * @param params.p_end_date - Data fim ISO (YYYY-MM-DD)
 * @returns Receitas, despesas e resultado líquido por categoria
 */
export async function getDreSimpleV1(params: {
  p_start_date: string;
  p_end_date: string;
}): Promise<{ data: DreSimpleResult | null; error: unknown }> {
  return rpc<DreSimpleResult>("get_dre_simple_v1", params as Record<string, unknown>);
}

// ─── Financeiro Avançado — Fase 2 ───────────────────────────

/**
 * Retorna projeção de fluxo de caixa para os próximos N dias.
 * Baseada em agendamentos confirmados + recorrências.
 * @param params.p_days - Número de dias para projetar (default: 30)
 */
export async function getCashFlowProjectionV1(params: {
  p_days?: number;
}): Promise<{ data: CashFlowProjectionResult | null; error: unknown }> {
  return rpc<CashFlowProjectionResult>("get_cash_flow_projection_v1", params as Record<string, unknown>);
}

// ─── Consent System ──────────────────────────────────────────────────────────

export type UpsertConsentTemplateResult = { success: boolean; template_id: string };
/**
 * Cria ou atualiza template de termo de consentimento.
 * Suporta HTML editado no TipTap ou PDF uploadado.
 * @param params.p_title - Título do template
 * @param params.p_slug - Slug único para URL
 * @param params.p_body_html - Conteúdo HTML do template
 * @param params.p_is_required - Se é obrigatório antes da consulta
 * @param params.p_template_type - 'html' | 'pdf'
 * @returns ID do template
 */
export async function upsertConsentTemplate(params: {
  p_title: string;
  p_slug: string;
  p_body_html: string;
  p_is_required?: boolean;
  p_is_active?: boolean;
  p_sort_order?: number;
  p_template_id?: string | null;
  p_template_type?: "html" | "pdf";
  p_pdf_storage_path?: string | null;
  p_pdf_original_filename?: string | null;
  p_pdf_file_size?: number | null;
}): Promise<{ data: UpsertConsentTemplateResult | null; error: unknown }> {
  return rpc<UpsertConsentTemplateResult>("upsert_consent_template", params as Record<string, unknown>);
}

export type SignConsentResult = { success: boolean; consent_id?: string; message?: string; template_title?: string };
/**
 * Registra assinatura de termo de consentimento pelo paciente.
 * Grava IP, User-Agent e foto facial (se configurado).
 * @param params.p_client_id - UUID do paciente
 * @param params.p_template_id - UUID do template assinado
 * @param params.p_facial_photo_path - Caminho no storage (opcional)
 * @returns ID do consentimento assinado
 */
export async function signConsent(params: {
  p_client_id: string;
  p_template_id: string;
  p_facial_photo_path?: string | null;
  p_ip_address?: string | null;
  p_user_agent?: string | null;
}): Promise<{ data: SignConsentResult | null; error: unknown }> {
  return rpc<SignConsentResult>("sign_consent", params as Record<string, unknown>);
}
