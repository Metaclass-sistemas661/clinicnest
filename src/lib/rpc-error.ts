import { logger } from "@/lib/logger";

type RpcLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined;

export type RpcErrorKind =
  | "slot_conflict"
  | "appointment_locked"
  | "appointment_completed_locked"
  | "appointment_delete_pending_only"
  | "appointment_delete_completed_forbidden"
  | "stock_insufficient"
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
