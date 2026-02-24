import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureKey } from '@/types/subscription-plans';
import { FeatureGate } from './FeatureGate';

interface PlanProtectedRouteProps {
  feature: FeatureKey;
  children: ReactNode;
  redirectTo?: string;
  showGate?: boolean;
}

export function PlanProtectedRoute({
  feature,
  children,
  redirectTo,
  showGate = true,
}: PlanProtectedRouteProps) {
  const location = useLocation();
  const { hasFeature, isLoading } = usePlanFeatures();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    if (showGate) {
      return (
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <FeatureGate feature={feature}>
            {children}
          </FeatureGate>
        </div>
      );
    }

    return <Navigate to="/assinatura" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
