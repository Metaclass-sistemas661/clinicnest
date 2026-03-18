import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionGuardProps {
  children: ReactNode;
}

const ALLOWED_PATHS_WHEN_EXPIRED = ["/assinatura", "/perfil", "/logout"];

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { has_access, trial_expired, isLoading } = useSubscription();
  const { isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) return <>{children}</>;

  if (trial_expired && !has_access) {
    const isAllowed = ALLOWED_PATHS_WHEN_EXPIRED.some(p =>
      location.pathname.startsWith(p)
    );

    if (!isAllowed) {
      return <Navigate to="/assinatura" replace />;
    }
  }

  return <>{children}</>;
}
