/**
 * Fuso horário padrão do sistema: Brasil (São Paulo).
 * Use formatInAppTz para exibir datas/horas sempre nesse fuso.
 */
import { formatInTimeZone } from "date-fns-tz/formatInTimeZone";
import { ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";

export const APP_TIMEZONE = "America/Sao_Paulo" as const;

type FormatOptions = {
  locale?: Locale;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  [key: string]: unknown;
};

/**
 * Formata data/hora no fuso America/Sao_Paulo (pt-BR).
 * Use em todo o sistema para exibição consistente.
 */
export function formatInAppTz(
  date: Date | string | number,
  formatStr: string,
  options?: FormatOptions
): string {
  return formatInTimeZone(date, APP_TIMEZONE, formatStr, {
    locale: ptBR,
    ...options,
  });
}
