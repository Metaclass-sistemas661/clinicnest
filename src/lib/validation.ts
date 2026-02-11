/**
 * Utilitários de validação compartilhados para evitar código duplicado.
 * Schemas Zod para validação client-side em formulários (Seção 4.1).
 */
import { z } from "zod";

/** Schema para nova transação financeira (entrada/saída) */
export const financialTransactionFormSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Selecione uma categoria"),
  amount: z.string().refine((v) => {
    const n = Number(v);
    return !Number.isNaN(n) && n > 0;
  }, "Valor deve ser maior que zero"),
  description: z.string().optional(),
  transaction_date: z.string().min(1, "Selecione uma data"),
});

/** Schema para pagamento de salário (dias trabalhados). Valida 1..maxDays no componente. */
export const paySalaryDaysWorkedSchema = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (v === undefined || v === null || v.trim() === "") return true;
      const n = parseInt(v, 10);
      return !Number.isNaN(n) && n >= 1;
    },
    { message: "Dias trabalhados deve ser pelo menos 1" }
  );

export type FinancialTransactionFormInput = z.infer<typeof financialTransactionFormSchema>;

/**
 * Converte um valor para número de forma segura, retornando um valor padrão se inválido
 */
export function safeNumber(value: unknown, defaultValue = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Garante que um valor seja um array, retornando um array padrão se não for
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}

/**
 * Valida se um número é válido e não negativo
 */
export function isValidPositiveNumber(value: unknown): boolean {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Extrai número de um objeto com fallback
 */
export function extractNumber(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue = 0
): number {
  if (!obj || typeof obj !== 'object') return defaultValue;
  return safeNumber(obj[key], defaultValue);
}
