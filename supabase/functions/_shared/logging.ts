/**
 * Sistema de logging compartilhado para Edge Functions (Seção 4.3).
 * Mascara dados sensíveis (PII, valores monetários, tokens) antes de logar.
 * Use LOG_SENSITIVE=true em desenvolvimento para desativar o mascaramento.
 */

const SENSITIVE_KEYS = new Set([
  "email",
  "to",
  "from",
  "userId",
  "user_id",
  "password",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "full_name",
  "name",
  "phone",
  "amount",
  "value",
  "price",
  "salary",
  "total",
  "profit",
  "link",
  "magicLink",
  "action_link",
  "resetUrl",
  "url",
]);

const MASK = "[REDACTED]";
const MASK_MONETARY = "[MASKED]";

const MONETARY_KEYS = new Set([
  "amount",
  "value",
  "price",
  "salary",
  "total",
  "profit",
]);

function maskValue(key: string): string {
  const keyLower = key.toLowerCase();
  return MONETARY_KEYS.has(keyLower) ? MASK_MONETARY : MASK;
}

function maskSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower)) {
      result[key] = maskValue(key);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = maskSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function createLogger(functionName: string) {
  const isDev = Deno.env.get("LOG_SENSITIVE") === "true";

  return (step: string, details?: unknown) => {
    let detailsStr = "";
    if (details !== undefined) {
      const safe = isDev ? details : maskSensitiveData(details);
      detailsStr = ` - ${JSON.stringify(safe)}`;
    }
    console.log(`[${functionName}] ${step}${detailsStr}`);
  };
}
