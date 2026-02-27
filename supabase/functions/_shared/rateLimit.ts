/**
 * Rate limiting para Edge Functions (Seção 4.5).
 * Usa Upstash Redis (REST API) quando UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 * estão definidos. Quando não configurado, usa fallback in-memory (por isolate).
 * Nunca faz "fail-open" — sem Redis = fallback local, sem fallback = bloqueia.
 */
const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter?: number };

// ── Fallback in-memory (por Deno isolate) ──────────────────────
// Cada edge function roda em isolates separados, então o Map é local,
// mas já bloqueia abuso dentro do mesmo isolate (cold-start compartilhado).
const memStore = new Map<string, { count: number; expiresAt: number }>();
const MEM_CLEANUP_INTERVAL = 60_000; // limpa expirados a cada 60s
let lastCleanup = Date.now();

function memRateLimit(identifier: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();

  // Limpeza periódica de chaves expiradas
  if (now - lastCleanup > MEM_CLEANUP_INTERVAL) {
    for (const [k, v] of memStore) {
      if (v.expiresAt <= now) memStore.delete(k);
    }
    lastCleanup = now;
  }

  const windowSlot = Math.floor(now / (windowSeconds * 1000));
  const key = `rl:${identifier}:${windowSlot}`;
  const entry = memStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    memStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count <= limit) return { allowed: true };
  return { allowed: false, retryAfter: windowSeconds };
}

// ── Upstash Redis ──────────────────────────────────────────────
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
  // Sem Redis → usa fallback in-memory (NUNCA fail-open)
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return memRateLimit(identifier, limit, windowSeconds);
  }

  const windowSlot = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${identifier}:${windowSlot}`;

  try {
    const [incrRes, expireRes] = await Promise.all([
      upstashCommand(["INCR", key]),
      upstashCommand(["EXPIRE", key, String(windowSeconds)]),
    ]);
    // Se Redis retornou erro, usa fallback in-memory
    if (incrRes.error || expireRes.error) {
      return memRateLimit(identifier, limit, windowSeconds);
    }

    const count = Number(incrRes.result ?? 0);
    return count <= limit ? { allowed: true } : { allowed: false, retryAfter: windowSeconds };
  } catch {
    // Redis offline → fallback in-memory em vez de fail-open
    return memRateLimit(identifier, limit, windowSeconds);
  }
}
