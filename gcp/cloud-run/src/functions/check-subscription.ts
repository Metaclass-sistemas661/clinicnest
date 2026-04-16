/**
 * check-subscription — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const logStep = createLogger("CHECK-SUBSCRIPTION");

export async function checkSubscription(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      const user = (req as any).user;

      try {
        logStep("Function started");

        if (!user?.email) throw new Error("User not authenticated or email not available");
        logStep("User authenticated", { userId: user.id, email: user.email });

        // DB accessed via shared/db module
        const rl = await checkRateLimit(`check-sub:${user.id}`, 30, 60);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Too many requests" });
        }

        // Get subscription from database first
        const { data: profileData } = await db.from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!profileData?.tenant_id) {
          logStep("No tenant found for user");
          return res.json({
            subscribed: false,
            trialing: false,
            trial_expired: false,
            days_remaining: 0,
          });
        }

        const { data: subscriptionData } = await db.from("subscriptions")
          .select("*")
          .eq("tenant_id", profileData.tenant_id)
          .single();

        logStep("Subscription data from DB", subscriptionData);

        // Check trial status
        const now = new Date();
        const trialEnd = subscriptionData?.trial_end ? new Date(subscriptionData.trial_end) : null;
        const periodEnd = subscriptionData?.current_period_end ? new Date(subscriptionData.current_period_end) : null;
        const isTrialing = subscriptionData?.status === 'trialing';
        const isActive = subscriptionData?.status === 'active';
        const isInactive = subscriptionData?.status === 'inactive';
        const trialExpired = trialEnd ? now > trialEnd : false;
        const daysRemaining = trialEnd
          ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const periodNotExpired = periodEnd ? now <= periodEnd : false;
        const subscribed = Boolean(periodNotExpired && (isActive || isInactive) && subscriptionData?.plan);
        // No free plan — must be subscribed or in active trial
        const hasAccess = subscribed || (isTrialing && !trialExpired);

        logStep("Access check complete", {
          subscribed,
          isTrialing,
          trialExpired,
          daysRemaining,
          hasAccess,
        });

        return res.json({
          subscribed,
          trialing: isTrialing && !trialExpired,
          trial_expired: isTrialing && trialExpired,
          days_remaining: daysRemaining,
          plan: subscriptionData?.plan ?? null,
          subscription_end: periodEnd?.toISOString() ?? null,
          has_access: hasAccess,
        });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("ERROR", { message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }
  } catch (err: any) {
    console.error(`[check-subscription] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

