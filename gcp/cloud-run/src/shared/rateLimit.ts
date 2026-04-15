/**
 * Rate Limiting — Redis + in-memory fallback
 * Replaces: _shared/rateLimit.ts
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

// In-memory fallback (per-process)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Upstash Redis REST API rate limiter
async function checkRedis(key: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return null;

  try {
    const windowKey = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const res = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', windowKey],
        ['EXPIRE', windowKey, windowSec],
      ]),
    });

    if (!res.ok) return null;
    const data = await res.json() as any[];
    const count = data[0]?.result ?? 1;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit };
  } catch {
    return null;
  }
}

function checkMemory(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / 1000 / windowSec)}`;
  const entry = memoryStore.get(windowKey);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(windowKey, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, limit };
  }

  entry.count++;
  const allowed = entry.count <= limit;
  return { allowed, remaining: Math.max(0, limit - entry.count), limit };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number = 60
): Promise<RateLimitResult> {
  const redisResult = await checkRedis(key, limit, windowSec);
  if (redisResult) return redisResult;
  return checkMemory(key, limit, windowSec);
}

// Rate limit categories (matching Deno original)
export const RATE_LIMITS = {
  navigation: { limit: 40, window: 60 },
  interaction: { limit: 20, window: 60 },
  generation: { limit: 8, window: 60 },
  transcription: { limit: 5, window: 60 },
} as const;

export async function checkAiRateLimit(
  userId: string,
  functionName: string,
  category: keyof typeof RATE_LIMITS,
) {
  const config = RATE_LIMITS[category] || RATE_LIMITS.generation;
  return checkRateLimit(`${functionName}:${userId}`, config.limit, config.window);
}
