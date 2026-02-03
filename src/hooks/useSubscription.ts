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
        .single();

      const now = new Date();
      const trialEnd = sub?.trial_end ? new Date(sub.trial_end) : null;
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const isTrialing = sub?.status === 'trialing';
      const isActive = sub?.status === 'active';
      const trialExpired = trialEnd ? now > trialEnd : false;
      const daysRemaining = trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const hasAccess = isActive || (isTrialing && !trialExpired);

      applyResult({
        subscribed: isActive,
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

  const createCheckout = async (planKey: 'monthly' | 'quarterly' | 'annual') => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planKey },
        headers: { Authorization: `Bearer ${session.access_token}` },
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
    } catch (err) {
      if (err instanceof Error && err.message !== 'Checkout indisponível. Configure a Edge Function create-checkout ou as variáveis VITE_STRIPE_LINK_* no Vercel.') {
        throw err;
      }
      // Edge Function falhou sem mensagem útil, tenta Payment Link
    }

    const paymentLinks: Record<string, string> = {
      monthly: import.meta.env.VITE_STRIPE_LINK_MONTHLY || '',
      quarterly: import.meta.env.VITE_STRIPE_LINK_QUARTERLY || '',
      annual: import.meta.env.VITE_STRIPE_LINK_ANNUAL || '',
    };

    const link = paymentLinks[planKey];
    if (link) {
      window.open(link, '_blank');
      return;
    }

    throw new Error('Checkout indisponível. Configure a Edge Function create-checkout ou as variáveis VITE_STRIPE_LINK_* no Vercel.');
  };

  const openCustomerPortal = async () => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      window.open(data.url, '_blank');
    }
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
    openCustomerPortal,
  };
}
