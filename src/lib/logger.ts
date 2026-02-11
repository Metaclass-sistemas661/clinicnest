/**
 * Sistema de logging centralizado para o frontend (Seção 3.1, 4.3).
 * Controla o nível de log baseado em variável de ambiente (VITE_LOG_LEVEL).
 * Em produção (LOG_LEVEL=error): debug/info não são logados.
 * Não logue dados sensíveis (IDs, valores monetários, perfis). Use maskSensitive quando necessário.
 */
export function maskSensitive(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const s = String(value);
  if (s.length <= 4) return "****";
  return s.slice(0, 2) + "****" + s.slice(-2);
}
const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'error';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const shouldLog = (level: LogLevel): boolean => {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  const currentLevel = levels[LOG_LEVEL as LogLevel] ?? levels.error;
  const messageLevel = levels[level];
  
  return messageLevel >= currentLevel;
};

export const logger = {
  /**
   * Log de debug - apenas em desenvolvimento
   */
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log de informação - apenas em desenvolvimento
   */
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Log de aviso - sempre logado
   */
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Log de erro - sempre logado
   */
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};
