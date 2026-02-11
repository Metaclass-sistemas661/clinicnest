/**
 * Rate limiting para Edge Functions (Seção 4.5).
 * Usa Upstash Redis (REST API) quando UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 * estão definidos. Se não configurado, permite todas as requisições (graceful degradation).
 * Para habilitar: crie um banco Upstash Redis e defina os secrets nas Edge Functions.
 */
const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter?: number };

async function upstashCommand(cmd: string[]): Promise<{ result?: unknown; error?: string }> {
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  return res.json();
}

/**
 * Verifica rate limit. Retorna { allowed: false } se exceder o limite.
 * @param identifier - Chave única (ex: userId, IP)
 * @param limit - Máximo de requisições por janela
 * @param windowSeconds - Janela em segundos
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { allowed: true };
  }

  const windowSlot = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${identifier}:${windowSlot}`;

  try {
    const [incrRes, expireRes] = await Promise.all([
      upstashCommand(["INCR", key]),
      upstashCommand(["EXPIRE", key, String(windowSeconds)]),
    ]);
    if (incrRes.error || expireRes.error) return { allowed: true };

    const count = Number(incrRes.result ?? 0);
    return count <= limit ? { allowed: true } : { allowed: false, retryAfter: windowSeconds };
  } catch {
    return { allowed: true };
  }
}
