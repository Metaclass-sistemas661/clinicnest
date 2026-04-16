/**
 * Subscription Middleware — blocks API access when trial/subscription expired.
 * 
 * After authMiddleware loads the user, this middleware checks the tenant's
 * subscription status. If expired, returns 402 Payment Required.
 * 
 * Exempt paths (always allowed even if expired):
 *  - check-subscription  (needed to display subscription page)
 *  - create-checkout      (needed to purchase)
 *  - cancel-subscription  (needed to manage)
 *  - update-password      (security – always allowed)
 */
import { Request, Response, NextFunction } from 'express';
import { adminQuery } from './db';

const EXEMPT_PATHS = new Set([
  '/api/check-subscription',
  '/api/create-checkout',
  '/api/cancel-subscription',
  '/api/update-password',
]);

interface SubRow {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  plan: string | null;
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
  // Skip exempt paths
  if (EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const user = (req as any).user;
  if (!user?.tenant_id) {
    // No tenant = no subscription to check (authMiddleware handles the 401)
    return next();
  }

  try {
    const result = await adminQuery(
      `SELECT status, trial_end, current_period_end, plan
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [user.tenant_id]
    );
    const sub: SubRow | null = result.rows[0] || null;

    if (!hasActiveAccess(sub)) {
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
