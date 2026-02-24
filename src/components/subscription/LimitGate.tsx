import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { LimitKey, PLAN_CONFIG, UNLIMITED } from '@/types/subscription-plans';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LimitGateProps {
  limit: LimitKey;
  currentValue: number;
  children: ReactNode;
  fallback?: ReactNode;
  showWarningAt?: number;
  className?: string;
}

export function LimitGate({
  limit,
  currentValue,
  children,
  fallback,
  showWarningAt = 0.8,
  className,
}: LimitGateProps) {
  const { isWithinLimit, getLimit, limitLabels, formatLimit, getNextTier } = usePlanFeatures();

  const limitValue = getLimit(limit);
  const isUnlimited = limitValue === UNLIMITED;
  const withinLimit = isWithinLimit(limit, currentValue);
  const limitLabel = limitLabels[limit] || limit;

  if (withinLimit) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const nextTier = getNextTier();
  const nextTierName = nextTier ? PLAN_CONFIG[nextTier].name : null;
  const nextLimit = nextTier ? PLAN_CONFIG[nextTier].limits[limit] : null;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5 p-8 text-center',
      className
    )}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        Limite Atingido
      </h3>
      
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        Você atingiu o limite de{' '}
        <span className="font-semibold text-foreground">{limitLabel.toLowerCase()}</span>{' '}
        do seu plano atual ({formatLimit(limitValue, limit)}).
      </p>

      {nextTierName && nextLimit !== null && (
        <p className="mb-6 text-sm text-muted-foreground">
          Faça upgrade para o plano{' '}
          <span className="font-semibold text-foreground">{nextTierName}</span>{' '}
          e tenha {formatLimit(nextLimit, limit)}.
        </p>
      )}
      
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

interface UsageIndicatorProps {
  limit: LimitKey;
  currentValue: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UsageIndicator({
  limit,
  currentValue,
  showLabel = true,
  showPercentage = true,
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  className,
  size = 'md',
}: UsageIndicatorProps) {
  const { getLimit, limitLabels, formatLimit } = usePlanFeatures();

  const limitValue = getLimit(limit);
  const isUnlimited = limitValue === UNLIMITED;
  const limitLabel = limitLabels[limit] || limit;

  if (isUnlimited) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        {showLabel && <span className="text-sm">{limitLabel}:</span>}
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Ilimitado
        </span>
      </div>
    );
  }

  const percentage = Math.min((currentValue / limitValue) * 100, 100);
  const remaining = Math.max(0, limitValue - currentValue);
  
  const isWarning = percentage >= warningThreshold * 100;
  const isCritical = percentage >= criticalThreshold * 100;
  const isExceeded = currentValue >= limitValue;

  const progressColor = isExceeded
    ? 'bg-destructive'
    : isCritical
    ? 'bg-orange-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-primary';

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        {showLabel && (
          <span className="text-muted-foreground">{limitLabel}</span>
        )}
        <span className={cn(
          'font-medium',
          isExceeded ? 'text-destructive' : isCritical ? 'text-orange-600 dark:text-orange-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
        )}>
          {currentValue.toLocaleString('pt-BR')} / {formatLimit(limitValue, limit)}
          {showPercentage && (
            <span className="ml-1 text-muted-foreground">
              ({Math.round(percentage)}%)
            </span>
          )}
        </span>
      </div>
      
      <div className={cn('relative w-full overflow-hidden rounded-full bg-muted', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-300', progressColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isExceeded && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Limite atingido.{' '}
          <Link to="/assinatura" className="font-medium underline underline-offset-2 hover:text-destructive/80">
            Fazer upgrade
          </Link>
        </p>
      )}
      
      {!isExceeded && isCritical && (
        <p className="text-xs text-orange-600 dark:text-orange-400">
          Apenas {remaining} restantes. Considere fazer upgrade.
        </p>
      )}
    </div>
  );
}
