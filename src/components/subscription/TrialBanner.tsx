import { Link } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { trialing, days_remaining, isLoading } = useSubscription();

  if (isLoading || !trialing) return null;

  const isUrgent = days_remaining <= 2;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
        isUrgent
          ? "bg-red-500/10 text-red-700 border-b border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-800"
          : "bg-amber-500/10 text-amber-700 border-b border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-800"
      )}
    >
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span>
        {days_remaining === 0
          ? "Seu trial expira hoje!"
          : days_remaining === 1
          ? "Seu trial expira amanhã!"
          : `${days_remaining} dias restantes no seu teste grátis`}
      </span>
      <Link
        to="/assinatura"
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors",
          isUrgent
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-amber-600 text-white hover:bg-amber-700"
        )}
      >
        <Zap className="h-3 w-3" />
        Assinar agora
      </Link>
    </div>
  );
}
