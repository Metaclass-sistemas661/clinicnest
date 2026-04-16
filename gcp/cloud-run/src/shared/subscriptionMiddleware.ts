/**
 * Subscription Middleware — blocks API access when trial/subscription expired.
 * 
 * After authMiddleware loads the user, this middleware checks the tenant's
 * subscription status. If expired, returns 402 Payment Required.
 * 
 * Enterprise features:
 *  - In-memory cache with 60s TTL (avoids DB hit per request)
 *  - Fail-closed: DB errors block access (503)
 *  - Exempt paths for subscription management & patient portal
 */
import { Request, Response, NextFunction } from 'express';
import { adminQuery } from './db';

/** Paths always allowed even when subscription expired */
const EXEMPT_PATHS = new Set([
  '/api/check-subscription',
  '/api/create-checkout',
  '/api/cancel-subscription',
  '/api/update-password',
]);

/** Path prefixes exempt (patient-facing endpoints have their own frontend guard) */
const EXEMPT_PREFIXES = [
  '/api/activate-patient-account',
  '/api/ai-patient-chat',
];

interface SubRow {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  plan: string | null;
}

// ─── In-memory cache (TTL 60s) ──────────────────────────────────────
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { access: boolean; expiresAt: number }>();

function getCached(tenantId: string): boolean | null {
  const entry = cache.get(tenantId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(tenantId);
    return null;
  }
  return entry.access;
}

function setCache(tenantId: string, access: boolean): void {
  cache.set(tenantId, { access, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict stale entries periodically (keep cache bounded)
  if (cache.size > 10_000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

/**
 * Returns true if the tenant has active access (trialing within period, or active/paid subscription).
 */
function hasActiveAccess(sub: SubRow | null): boolean {
  if (!sub) return false;

  const now = new Date();

  // Active trial
  if (sub.status === 'trialing' && sub.trial_end) {
    if (new Date(sub.trial_end) > now) return true;
  }

  // Active subscription
  if (sub.status === 'active') return true;

  // Inactive but within paid period (canceled but not yet expired)
  if ((sub.status === 'active' || sub.status === 'inactive') && sub.current_period_end) {
    if (new Date(sub.current_period_end) > now) return true;
  }

  return false;
}

export async function subscriptionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip exact exempt paths
  if (EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // Skip exempt prefixes (patient-facing endpoints)
  if (EXEMPT_PREFIXES.some(p => req.path.startsWith(p))) {
    return next();
  }

  const user = (req as any).user;
  if (!user?.tenant_id) {
    return next();
  }

  // Check cache first (avoids DB hit per request)
  const cached = getCached(user.tenant_id);
  if (cached !== null) {
    if (!cached) {
      return res.status(402).json({
        error: 'Assinatura expirada. Escolha um plano para continuar usando o sistema.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }
    return next();
  }

  try {
    const result = await adminQuery(
      `SELECT status, trial_end, current_period_end, plan
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [user.tenant_id]
    );
    const sub: SubRow | null = result.rows[0] || null;
    const access = hasActiveAccess(sub);

    setCache(user.tenant_id, access);

    if (!access) {
      return res.status(402).json({
        error: 'Assinatura expirada. Escolha um plano para continuar usando o sistema.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }

    next();
  } catch (err: any) {
    // Fail-closed: if we can't verify subscription, block access
    process.stderr.write(`[subscriptionMiddleware] DB error: ${err.message}\n`);
    return res.status(503).json({
      error: 'Não foi possível verificar a assinatura. Tente novamente.',
      code: 'SUBSCRIPTION_CHECK_FAILED',
    });
  }
}

/** Invalidate cache for a tenant (call after payment webhook updates subscription) */
export function invalidateSubscriptionCache(tenantId: string): void {
  cache.delete(tenantId);
}
