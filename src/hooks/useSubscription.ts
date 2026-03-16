import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionStatus {
  subscribed: boolean;
  trialing: boolean;
  trial_expired: boolean;
  days_remaining: number;
  plan: string | null;
  subscription_end: string | null;
  has_access: boolean;
  isLoading: boolean;
  error: string | null;
}

export type SubscriptionTier = "free" | "starter" | "solo" | "clinica" | "premium";
export type SubscriptionInterval = "monthly" | "annual";

export function normalizePlanKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  return s ? s : null;
}

export function parsePlanKey(planKey: unknown): { tier: SubscriptionTier; interval: SubscriptionInterval } | null {
  const key = normalizePlanKey(planKey);
  if (!key) return null;

  // Legado: só interval sem tier → solo/monthly
  if (key === "monthly" || key === "annual") {
    return { tier: "solo", interval: key };
  }
  // Legado: quarterly → solo/monthly
  if (key === "quarterly") {
    return { tier: "solo", interval: "monthly" };
  }
  // Free plan (sem interval)
  if (key === "free") {
    return { tier: "free", interval: "monthly" };
  }

  const [tierRaw, intervalRaw] = key.split("_");
  const interval: SubscriptionInterval | null =
    intervalRaw === "monthly" ? "monthly" :
    intervalRaw === "annual"  ? "annual"  :
    intervalRaw === "quarterly" ? "monthly" : // legado
    null;
  if (!interval) return null;

  // Novos nomes
  if (tierRaw === "free" || tierRaw === "starter" || tierRaw === "solo" || tierRaw === "clinica" || tierRaw === "premium") {
    return { tier: tierRaw, interval: interval ?? "monthly" };
  }
  // Legado: basic → solo, pro → clinica
  if (tierRaw === "basic") return { tier: "solo", interval };
  if (tierRaw === "pro")   return { tier: "clinica", interval };

  return null;
}

export function isAdvancedReportsAllowed(planKey: unknown): boolean {
  const parsed = parsePlanKey(planKey);
  if (!parsed) return false;
  return parsed.tier === "clinica" || parsed.tier === "premium";
}

export function useSubscription() {
  const { session, user } = useAuth();
  const hasLoadedOnce = useRef(false);
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    trialing: false,
    trial_expired: false,
    days_remaining: 0,
    plan: null,
    subscription_end: null,
    has_access: true,
    isLoading: true,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token || !user) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const isBackgroundRefresh = hasLoadedOnce.current;
    if (!isBackgroundRefresh) {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));
    }

    const applyResult = (result: Partial<SubscriptionStatus>) => {
      hasLoadedOnce.current = true;
      setStatus(prev => ({
        ...prev,
        ...result,
        isLoading: false,
      }));
    };

    try {
      // Consulta direto no banco (evita depender da Edge Function check-subscription)
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) {
        applyResult({
          subscribed: false,
          trialing: false,
          trial_expired: false,
          days_remaining: 0,
          plan: null,
          subscription_end: null,
          has_access: false,
          error: null,
        });
        return;
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      const now = new Date();
      const trialEnd = sub?.trial_end ? new Date(sub.trial_end) : null;
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const isTrialing = sub?.status === 'trialing';
      const isActive = sub?.status === 'active';
      const trialExpired = trialEnd ? now > trialEnd : false;
      const daysRemaining = trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Policy (2): if the user paid for a period, allow access until current_period_end,
      // even if the subscription has been canceled/inactivated.
      const periodNotExpired = periodEnd ? now <= periodEnd : false;
      const isInactive = sub?.status === 'inactive';
      const subscribed = Boolean(periodNotExpired && (isActive || isInactive) && sub?.plan);
      const hasAccess = !sub || subscribed || (isTrialing && !trialExpired);

      applyResult({
        subscribed,
        trialing: isTrialing && !trialExpired,
        trial_expired: isTrialing && trialExpired,
        days_remaining: daysRemaining,
        plan: sub?.plan || null,
        subscription_end: periodEnd?.toISOString() || null,
        has_access: hasAccess,
        error: null,
      });
    } catch {
      hasLoadedOnce.current = true;
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        has_access: true,
        error: null,
      }));
    }
  }, [session?.access_token, user]);

  const createCheckout = async (
    input:
      | { tier: SubscriptionTier; interval: SubscriptionInterval }
      | SubscriptionInterval
  ) => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const payload = (() => {
      // Backward compat: createCheckout('monthly')
      if (typeof input === "string") {
        return { planKey: input };
      }

      const { tier, interval } = input;
      return { tier, interval };
    })();

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (data?.url) {
      window.open(data.url, '_blank');
      return;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (error) {
      throw error;
    }

    throw new Error('Checkout indisponível.');
  };



  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [checkSubscription]);

  return {
    ...status,
    checkSubscription,
    createCheckout,
  };
}
