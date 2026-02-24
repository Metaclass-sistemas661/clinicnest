import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSubscription, parsePlanKey } from './useSubscription';
import { supabase } from '@/integrations/supabase/client';
import {
  SubscriptionTier,
  FeatureKey,
  LimitKey,
  PLAN_CONFIG,
  UNLIMITED,
  getMinimumTierForFeature,
  getNextTier,
  FEATURE_LABELS,
  LIMIT_LABELS,
  formatLimit,
} from '@/types/subscription-plans';

interface FeatureOverride {
  id: string;
  feature_key: string;
  is_enabled: boolean;
  reason: string | null;
  expires_at: string | null;
}

interface LimitOverride {
  id: string;
  limit_key: string;
  custom_value: number;
  reason: string | null;
  expires_at: string | null;
}

interface TenantOverrides {
  features: FeatureOverride[];
  limits: LimitOverride[];
}

export interface UsePlanFeaturesReturn {
  currentTier: SubscriptionTier;
  isLoading: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  getLimit: (limit: LimitKey) => number;
  isWithinLimit: (limit: LimitKey, currentValue: number) => boolean;
  getRemainingLimit: (limit: LimitKey, currentValue: number) => number;
  getMinimumTierForFeature: (feature: FeatureKey) => SubscriptionTier | null;
  getNextTier: () => SubscriptionTier | null;
  getUpgradeMessage: (feature: FeatureKey) => string;
  getLimitMessage: (limit: LimitKey, currentValue: number) => string;
  planConfig: typeof PLAN_CONFIG[SubscriptionTier];
  featureLabels: typeof FEATURE_LABELS;
  limitLabels: typeof LIMIT_LABELS;
  formatLimit: typeof formatLimit;
  hasOverride: (feature: FeatureKey) => boolean;
  getOverrideReason: (feature: FeatureKey) => string | null;
}

export function usePlanFeatures(): UsePlanFeaturesReturn {
  const { plan, isLoading: subscriptionLoading, has_access } = useSubscription();
  const [overrides, setOverrides] = useState<TenantOverrides>({ features: [], limits: [] });
  const [overridesLoading, setOverridesLoading] = useState(true);

  // Carregar overrides do tenant
  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const { data, error } = await supabase.rpc('get_tenant_overrides');
        if (error) {
          console.warn('Failed to load tenant overrides:', error);
          setOverrides({ features: [], limits: [] });
        } else if (data) {
          setOverrides(data as TenantOverrides);
        }
      } catch (err) {
        console.warn('Error loading tenant overrides:', err);
        setOverrides({ features: [], limits: [] });
      } finally {
        setOverridesLoading(false);
      }
    };

    loadOverrides();
  }, []);

  const isLoading = subscriptionLoading || overridesLoading;

  const currentTier = useMemo<SubscriptionTier>(() => {
    if (!plan) return 'starter';
    
    const parsed = parsePlanKey(plan);
    if (!parsed) return 'starter';
    
    const { tier } = parsed;
    if (tier === 'solo' || tier === 'clinica' || tier === 'premium') {
      return tier;
    }
    
    return 'starter';
  }, [plan]);

  const planConfig = useMemo(() => {
    return PLAN_CONFIG[currentTier];
  }, [currentTier]);

  // Verificar se um override de feature está ativo (não expirado)
  const getActiveFeatureOverride = useCallback((feature: FeatureKey): FeatureOverride | null => {
    const override = overrides.features.find(o => o.feature_key === feature);
    if (!override) return null;
    
    // Verificar expiração
    if (override.expires_at && new Date(override.expires_at) <= new Date()) {
      return null;
    }
    
    return override;
  }, [overrides.features]);

  // Verificar se um override de limite está ativo (não expirado)
  const getActiveLimitOverride = useCallback((limit: LimitKey): LimitOverride | null => {
    const override = overrides.limits.find(o => o.limit_key === limit);
    if (!override) return null;
    
    // Verificar expiração
    if (override.expires_at && new Date(override.expires_at) <= new Date()) {
      return null;
    }
    
    return override;
  }, [overrides.limits]);

  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    if (!has_access) return false;
    
    // 1. Verificar override de funcionalidade (prioridade máxima)
    const featureOverride = getActiveFeatureOverride(feature);
    if (featureOverride) {
      return featureOverride.is_enabled;
    }
    
    // 2. Fallback para configuração do plano
    return planConfig.features[feature] ?? false;
  }, [planConfig, has_access, getActiveFeatureOverride]);

  const getLimit = useCallback((limit: LimitKey): number => {
    // 1. Verificar override de limite (prioridade máxima)
    const limitOverride = getActiveLimitOverride(limit);
    if (limitOverride) {
      return limitOverride.custom_value;
    }
    
    // 2. Fallback para configuração do plano
    return planConfig.limits[limit] ?? 0;
  }, [planConfig, getActiveLimitOverride]);

  // Verificar se uma feature tem override ativo
  const hasOverride = useCallback((feature: FeatureKey): boolean => {
    return getActiveFeatureOverride(feature) !== null;
  }, [getActiveFeatureOverride]);

  // Obter razão do override
  const getOverrideReason = useCallback((feature: FeatureKey): string | null => {
    const override = getActiveFeatureOverride(feature);
    return override?.reason ?? null;
  }, [getActiveFeatureOverride]);

  const isWithinLimit = useCallback((limit: LimitKey, currentValue: number): boolean => {
    const limitValue = getLimit(limit);
    if (limitValue === UNLIMITED) return true;
    return currentValue < limitValue;
  }, [getLimit]);

  const getRemainingLimit = useCallback((limit: LimitKey, currentValue: number): number => {
    const limitValue = getLimit(limit);
    if (limitValue === UNLIMITED) return UNLIMITED;
    return Math.max(0, limitValue - currentValue);
  }, [getLimit]);

  const getMinTierForFeature = useCallback((feature: FeatureKey): SubscriptionTier | null => {
    return getMinimumTierForFeature(feature);
  }, []);

  const getNextTierFn = useCallback((): SubscriptionTier | null => {
    return getNextTier(currentTier);
  }, [currentTier]);

  const getUpgradeMessage = useCallback((feature: FeatureKey): string => {
    const minTier = getMinimumTierForFeature(feature);
    if (!minTier) return 'Esta funcionalidade não está disponível.';
    
    const featureLabel = FEATURE_LABELS[feature] || feature;
    const tierName = PLAN_CONFIG[minTier].name;
    
    return `${featureLabel} está disponível a partir do plano ${tierName}.`;
  }, []);

  const getLimitMessage = useCallback((limit: LimitKey, currentValue: number): string => {
    const limitValue = getLimit(limit);
    const limitLabel = LIMIT_LABELS[limit] || limit;
    
    if (limitValue === UNLIMITED) {
      return `${limitLabel}: Ilimitado`;
    }
    
    const remaining = Math.max(0, limitValue - currentValue);
    
    if (remaining === 0) {
      const nextTier = getNextTier(currentTier);
      if (nextTier) {
        const nextLimit = PLAN_CONFIG[nextTier].limits[limit];
        const nextTierName = PLAN_CONFIG[nextTier].name;
        return `Limite de ${limitLabel.toLowerCase()} atingido (${currentValue}/${limitValue}). Faça upgrade para o plano ${nextTierName} para ter ${formatLimit(nextLimit, limit)}.`;
      }
      return `Limite de ${limitLabel.toLowerCase()} atingido (${currentValue}/${limitValue}).`;
    }
    
    return `${limitLabel}: ${currentValue}/${limitValue} (${remaining} restantes)`;
  }, [getLimit, currentTier]);

  return {
    currentTier,
    isLoading,
    hasFeature,
    getLimit,
    isWithinLimit,
    getRemainingLimit,
    getMinimumTierForFeature: getMinTierForFeature,
    getNextTier: getNextTierFn,
    getUpgradeMessage,
    getLimitMessage,
    planConfig,
    featureLabels: FEATURE_LABELS,
    limitLabels: LIMIT_LABELS,
    formatLimit,
    hasOverride,
    getOverrideReason,
  };
}
