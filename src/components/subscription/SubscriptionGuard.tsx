import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { TrialExpiredModal } from "./TrialExpiredModal";
import { Loader2 } from "lucide-react";

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { has_access, trial_expired, isLoading } = useSubscription();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  // Show trial expired modal if no access and trial expired
  if (trial_expired && !has_access) {
    return (
      <>
        <div className="blur-sm pointer-events-none">
          {children}
        </div>
        <TrialExpiredModal open={true} />
      </>
    );
  }

  // User has access (either subscription or active trial)
  return <>{children}</>;
}
