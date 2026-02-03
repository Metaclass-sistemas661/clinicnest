import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { TrialExpiredModal } from "./TrialExpiredModal";

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { has_access, trial_expired, isLoading } = useSubscription();

  // Sempre renderiza o conteúdo; a verificação roda em background sem esconder a tela
  // Só exibe o modal de trial expirado quando aplicável
  if (trial_expired && !has_access && !isLoading) {
    return (
      <>
        <div className="blur-sm pointer-events-none">
          {children}
        </div>
        <TrialExpiredModal open={true} />
      </>
    );
  }

  return <>{children}</>;
}
