import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionGuardProps {
  children: ReactNode;
}

const ALLOWED_PATHS_WHEN_EXPIRED = ["/assinatura", "/minhas-configuracoes", "/logout"];

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { has_access, isLoading } = useSubscription();
  const location = useLocation();

  if (isLoading) return <>{children}</>;

  if (!has_access) {
    const isAllowed = ALLOWED_PATHS_WHEN_EXPIRED.some(p =>
      location.pathname.startsWith(p)
    );

    if (!isAllowed) {
      return <Navigate to="/assinatura" replace />;
    }
  }

  return <>{children}</>;
}
