import { logger } from "@/lib/logger";

type RpcLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined;

export type RpcErrorKind =
  | "slot_conflict"
  | "schedule_blocked"
  | "outside_working_hours"
  | "booking_disabled"
  | "booking_too_soon"
  | "booking_cancel_too_late"
  | "appointment_locked"
  | "appointment_completed_locked"
  | "appointment_delete_pending_only"
  | "appointment_delete_completed_forbidden"
  | "stock_insufficient"
  | "order_not_found"
  | "order_already_finalized"
  | "order_payment_mismatch"
  | "order_empty"
  | "not_found"
  | "forbidden"
  | "unknown";

export function classifyRpcError(error: RpcLikeError): { kind: RpcErrorKind; message: string } {
  const msg = String((error as any)?.message ?? "");
  const detail = String((error as any)?.details ?? "");
  const code = String((error as any)?.code ?? "");
  const lower = msg.toLowerCase();
  const detailUpper = detail.trim().toUpperCase();
  const codeUpper = code.trim().toUpperCase();

  if (!msg) {
    return { kind: "unknown", message: "Erro desconhecido" };
  }

  // Prefer DB-provided machine-readable code in error.details (raise_app_error)
  switch (detailUpper) {
    case "SLOT_CONFLICT":
      return { kind: "slot_conflict", message: "Conflito de horário! Este profissional já tem agendamento neste período." };
    case "SCHEDULE_BLOCKED":
      return { kind: "schedule_blocked", message: "Horário bloqueado na agenda." };
    case "OUTSIDE_WORKING_HOURS":
      return { kind: "outside_working_hours", message: "Fora do horário de trabalho configurado para este profissional." };
    case "BOOKING_DISABLED":
      return { kind: "booking_disabled", message: "Agendamento online indisponível para este salão." };
    case "BOOKING_TOO_SOON":
      return { kind: "booking_too_soon", message: "Este horário não respeita a antecedência mínima para agendamento online." };
    case "BOOKING_CANCEL_TOO_LATE":
      return { kind: "booking_cancel_too_late", message: "Cancelamento fora do prazo permitido." };
    case "APPOINTMENT_DELETE_PENDING_ONLY":
      return { kind: "appointment_delete_pending_only", message: "Somente agendamentos pendentes podem ser excluídos." };
    case "APPOINTMENT_DELETE_COMPLETED_FORBIDDEN":
      return { kind: "appointment_delete_completed_forbidden", message: "Não é permitido excluir um agendamento concluído." };
    case "APPOINTMENT_COMPLETED_LOCKED":
      return { kind: "appointment_completed_locked", message: "Agendamento concluído: não é permitido alterar." };
    case "FORBIDDEN":
      return { kind: "forbidden", message: msg || "Sem permissão" };
    case "NOT_FOUND":
      return { kind: "not_found", message: msg };
    case "UNAUTHENTICATED":
      return { kind: "forbidden", message: "Usuário não autenticado" };
    case "ORDER_NOT_FOUND":
      return { kind: "order_not_found", message: "Comanda não encontrada." };
    case "ORDER_ALREADY_FINALIZED":
      return { kind: "order_already_finalized", message: "Esta comanda já foi finalizada." };
    case "ORDER_PAYMENT_MISMATCH":
      return { kind: "order_payment_mismatch", message: "A soma dos pagamentos não confere com o total da comanda." };
    case "ORDER_EMPTY":
      return { kind: "order_empty", message: "A comanda não possui itens." };
    case "VALIDATION_ERROR":
      return { kind: "unknown", message: msg };
    case "PROFILE_NOT_FOUND":
      return { kind: "unknown", message: msg };
    default:
      break;
  }

  // Some DB errors might carry code in error.code
  if (codeUpper === "PGRST116") {
    return { kind: "not_found", message: msg };
  }

  if (lower.includes("conflito")) {
    return { kind: "slot_conflict", message: "Conflito de horário! Este profissional já tem agendamento neste período." };
  }

  if (lower.includes("confirm") && (lower.includes("trav") || lower.includes("editar") || lower.includes("edi"))) {
    return { kind: "appointment_locked", message: "Agendamento confirmado: somente observações podem ser alteradas." };
  }

  if (lower.includes("conclu") && (lower.includes("editar") || lower.includes("alterar") || lower.includes("status"))) {
    return { kind: "appointment_completed_locked", message: "Agendamento concluído: não é permitido alterar." };
  }

  if (lower.includes("estoque insuficiente")) {
    return { kind: "stock_insufficient", message: "Quantidade insuficiente em estoque" };
  }

  if (lower.includes("não encontrado") || lower.includes("nao encontrado")) {
    return { kind: "not_found", message: msg };
  }

  if (lower.includes("sem permissão") || lower.includes("sem permissao") || lower.includes("apenas admin")) {
    return { kind: "forbidden", message: msg };
  }

  if (lower.includes("pendente") && lower.includes("exclu")) {
    return { kind: "appointment_delete_pending_only", message: "Somente agendamentos pendentes podem ser excluídos." };
  }

  if (lower.includes("conclu") && lower.includes("exclu")) {
    return { kind: "appointment_delete_completed_forbidden", message: "Não é permitido excluir um agendamento concluído." };
  }

  return { kind: "unknown", message: msg };
}

export function toastRpcError(toast: { error: (m: string) => void }, error: RpcLikeError, fallbackMessage?: string) {
  const classified = classifyRpcError(error);
  toast.error(classified.message || fallbackMessage || "Erro");
}

export function logRpcError(context: string, error: unknown) {
  logger.error(context, error);
}
