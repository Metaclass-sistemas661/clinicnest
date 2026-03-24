/**
 * Normalização de mensagens de erro para PT-BR
 * Converte mensagens técnicas/inglês em mensagens claras para o usuário.
 */

const ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  // ── Rede / Conexão ──
  { pattern: /failed to fetch|networkerror|net::err|econnrefused|enotfound/i, message: "Erro de conexão. Verifique sua internet e tente novamente." },
  { pattern: /timeout|timed?\s*out|statement timeout|canceling statement/i, message: "O servidor demorou para responder. Tente novamente em instantes." },
  { pattern: /abort|aborted/i, message: "A operação foi interrompida. Tente novamente." },

  // ── Auth / Permissão ──
  { pattern: /jwt|token.*expired|token.*invalid|not authenticated/i, message: "Sua sessão expirou. Faça login novamente." },
  { pattern: /permission denied|forbidden|not authorized|insufficient.*privilege/i, message: "Você não tem permissão para realizar esta ação." },
  { pattern: /row[- ]level security|rls|policy/i, message: "Acesso negado. Verifique suas permissões." },

  // ── Banco de dados ──
  { pattern: /duplicate key|unique.*constraint|already exists|unique_violation|23505/i, message: "Este registro já existe. Verifique os dados e tente novamente." },
  { pattern: /foreign key|fk_|23503/i, message: "Este registro está vinculado a outros dados e não pode ser alterado." },
  { pattern: /not[- ]null|null.*constraint|23502/i, message: "Um campo obrigatório não foi preenchido." },
  { pattern: /check.*constraint|23514/i, message: "Os dados informados estão fora do permitido." },
  { pattern: /relation.*does not exist|column.*does not exist|42P01|42703/i, message: "Erro interno do sistema. Contate o suporte." },

  // ── Arquivo / Upload ──
  { pattern: /file.*too.*large|payload.*too.*large|413/i, message: "O arquivo é muito grande. Reduza o tamanho e tente novamente." },
  { pattern: /unsupported.*media|invalid.*file|mime.*type/i, message: "Formato de arquivo não suportado." },
  { pattern: /storage.*bucket|bucket.*not.*found/i, message: "Erro no armazenamento de arquivos. Contate o suporte." },

  // ── Rate limit ──
  { pattern: /rate.*limit|too many requests|429/i, message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },

  // ── Servidor ──
  { pattern: /internal server error|500/i, message: "Erro interno do servidor. Tente novamente ou contate o suporte." },
  { pattern: /service unavailable|503/i, message: "Serviço temporariamente indisponível. Tente novamente em instantes." },
  { pattern: /bad gateway|502/i, message: "Erro de comunicação com o servidor. Tente novamente." },
];

/**
 * Extrai a mensagem de um erro de qualquer tipo.
 */
function extractMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.error_description === "string") return obj.error_description;
  }
  return String(error);
}

/**
 * Normaliza uma mensagem de erro técnica para PT-BR amigável.
 * Se não encontrar correspondência, retorna o fallback informado.
 */
export function normalizeError(error: unknown, fallback?: string): string {
  const raw = extractMessage(error);
  if (!raw) return fallback || "Ocorreu um erro inesperado. Tente novamente.";

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }

  // Se já está em português (contém acentos comuns), retornar como está
  if (/[àáâãéêíóôõúüç]/i.test(raw)) return raw;

  // Para mensagens em inglês não mapeadas, retornar o fallback
  return fallback || raw;
}

/**
 * Para uso em toast.error com title + description.
 * Retorna a description normalizada.
 */
export function toastError(title: string, error: unknown): { title: string; description: string } {
  return { title, description: normalizeError(error, "Tente novamente ou contate o suporte.") };
}
