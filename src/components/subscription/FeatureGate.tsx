import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight, Gift } from 'lucide-react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureKey, PLAN_CONFIG } from '@/types/subscription-plans';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
  inline?: boolean;
  showCourtesyBadge?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  className,
  inline = false,
  showCourtesyBadge = false,
}: FeatureGateProps) {
  const { hasFeature, getMinimumTierForFeature, featureLabels, hasOverride, getOverrideReason } = usePlanFeatures();

  const featureEnabled = hasFeature(feature);
  const isOverride = hasOverride(feature);
  const overrideReason = getOverrideReason(feature);

  if (featureEnabled) {
    if (showCourtesyBadge && isOverride) {
      return (
        <div className="relative">
          {children}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="absolute -top-2 -right-2 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700 gap-1 text-[10px] px-1.5 py-0.5"
                >
                  <Gift className="h-3 w-3" />
                  Cortesia
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">
                  Funcionalidade liberada especialmente para você.
                  {overrideReason && <span className="block text-muted-foreground mt-1">Motivo: {overrideReason}</span>}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const minTier = getMinimumTierForFeature(feature);
  const featureLabel = featureLabels[feature] || feature;
  const tierName = minTier ? PLAN_CONFIG[minTier].name : 'superior';

  if (inline) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-muted-foreground', className)}>
        <Lock className="h-3.5 w-3.5" />
        <span className="text-sm">
          Disponível no plano {tierName}
        </span>
      </span>
    );
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-8 text-center',
      className
    )}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
        <Lock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {featureLabel}
      </h3>
      
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Esta funcionalidade está disponível a partir do plano{' '}
        <span className="font-semibold text-foreground">{tierName}</span>.
        Faça upgrade para desbloquear.
      </p>
      
      <Link to="/assinatura">
        <Button className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
          <Sparkles className="h-4 w-4" />
          Fazer Upgrade
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

interface FeatureGateButtonProps {
  feature: FeatureKey;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function FeatureGateButton({
  feature,
  children,
  onClick,
  className,
  disabled,
}: FeatureGateButtonProps) {
  const { hasFeature, getMinimumTierForFeature } = usePlanFeatures();

  const isLocked = !hasFeature(feature);
  const minTier = getMinimumTierForFeature(feature);
  const tierName = minTier ? PLAN_CONFIG[minTier].name : 'superior';

  if (isLocked) {
    return (
      <Link to="/assinatura" className={className}>
        <Button
          variant="outline"
          className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
          title={`Disponível no plano ${tierName}`}
        >
          <Lock className="h-4 w-4" />
          {children}
          <span className="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase dark:bg-amber-800">
            {tierName}
          </span>
        </Button>
      </Link>
    );
  }

  return (
    <Button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </Button>
  );
}
