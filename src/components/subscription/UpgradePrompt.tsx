import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Check, Zap } from 'lucide-react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { PLAN_CONFIG, FeatureKey, FEATURE_LABELS } from '@/types/subscription-plans';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  feature?: FeatureKey;
  title?: string;
  description?: string;
  variant?: 'card' | 'banner' | 'inline';
  className?: string;
}

export function UpgradePrompt({
  feature,
  title,
  description,
  variant = 'card',
  className,
}: UpgradePromptProps) {
  const { getNextTier, currentTier, getMinimumTierForFeature, featureLabels } = usePlanFeatures();

  const nextTier = getNextTier();
  if (!nextTier) return null;

  const nextPlan = PLAN_CONFIG[nextTier];
  const currentPlan = PLAN_CONFIG[currentTier];

  const featureLabel = feature ? featureLabels[feature] : null;
  const minTier = feature ? getMinimumTierForFeature(feature) : null;
  const requiredTierName = minTier ? PLAN_CONFIG[minTier].name : nextPlan.name;

  const defaultTitle = feature
    ? `Desbloqueie ${featureLabel}`
    : `Upgrade para ${nextPlan.name}`;

  const defaultDescription = feature
    ? `${featureLabel} está disponível no plano ${requiredTierName}. Faça upgrade e aproveite todos os recursos.`
    : `Aproveite mais recursos com o plano ${nextPlan.name}. ${nextPlan.tagline}.`;

  const highlightFeatures = Object.entries(nextPlan.features)
    .filter(([key, value]) => value && !currentPlan.features[key as FeatureKey])
    .slice(0, 4)
    .map(([key]) => FEATURE_LABELS[key as FeatureKey] || key);

  if (variant === 'inline') {
    return (
      <Link
        to="/assinatura"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm font-medium text-amber-700 transition-all hover:from-amber-100 hover:to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 dark:text-amber-400 dark:hover:from-amber-950/50 dark:hover:to-orange-950/50',
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        {title || defaultTitle}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={cn(
        'flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white shadow-lg',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{title || defaultTitle}</p>
            <p className="text-sm text-white/80">{description || defaultDescription}</p>
          </div>
        </div>
        <Link to="/assinatura">
          <Button variant="secondary" className="gap-2 bg-white text-amber-700 hover:bg-white/90">
            Fazer Upgrade
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(
      'overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-950/30 dark:to-orange-950/30',
      className
    )}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {title || defaultTitle}
            </h3>
            <p className="text-sm text-muted-foreground">
              {description || defaultDescription}
            </p>
          </div>
        </div>

        {highlightFeatures.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Novos recursos incluídos:
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {highlightFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground">
              R$ {nextPlan.price.monthly.toFixed(2).replace('.', ',')}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ou R$ {nextPlan.price.annual.toFixed(2).replace('.', ',')} /ano
            </p>
          </div>
          <Link to="/assinatura">
            <Button className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
              Fazer Upgrade
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
