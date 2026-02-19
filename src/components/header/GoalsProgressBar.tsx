import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getGoalsWithProgress } from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { Link } from "react-router-dom";
import type { GoalWithProgress } from "@/lib/goals";
import { getProgressIndicatorClass } from "@/lib/goals";
import { isAdvancedReportsAllowed, useSubscription } from "@/hooks/useSubscription";

function formatValue(g: GoalWithProgress): string {
  const isRevenue =
    g.goal_type === "revenue" ||
    g.goal_type === "product_revenue" ||
    g.goal_type === "ticket_medio";
  if (isRevenue) return formatCurrency(g.current_value);
  return `${Math.round(g.current_value)}`;
}

export function GoalsProgressBar() {
  const { profile, isAdmin } = useAuth();
  const { status: subscription } = useSubscription();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    // Evitar 400 no RPC em planos que não liberam relatórios/metas avançadas
    if (!isAdvancedReportsAllowed(subscription.plan)) {
      setGoals([]);
      return;
    }

    // Staff: só exibir se a preferência show_goals_progress_in_header estiver ativa
    if (!isAdmin && profile.show_goals_progress_in_header === false) {
      setGoals([]);
      return;
    }

    const fetchGoals = async () => {
      try {
        const { data, error } = await getGoalsWithProgress({
          p_tenant_id: profile.tenant_id,
          p_include_archived: false,
        });
        if (error) throw error;

        const all = (data || []) as GoalWithProgress[];
        const active = all.filter((g) => !g.archived_at);

        if (isAdmin) {
          // Admin: metas marcadas para o header
          setGoals(active.filter((g) => g.show_in_header));
        } else {
          // Staff: suas metas (quando optou por exibir) - não exige show_in_header do admin
          const myGoals = active.filter(
            (g) => g.professional_id === null || g.professional_id === profile.id
          );
          setGoals(myGoals);
        }
      } catch {
        setGoals([]);
      }
    };

    fetchGoals();
  }, [profile?.tenant_id, profile?.id, profile?.show_goals_progress_in_header, isAdmin, subscription.plan]);

  if (goals.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={isAdmin ? "/metas" : "/minhas-metas"}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Target className="h-4 w-4" />
          Metas
        </Link>
        {goals
          .sort((a, b) => (b.header_priority ?? 0) - (a.header_priority ?? 0))
          .map((goal) => {
            const pct = Math.min(100, goal.progress_pct);
            const indicatorClass = getProgressIndicatorClass(pct);
            return (
              <div
                key={goal.id}
                className="flex items-center gap-2 min-w-0 flex-1 max-w-xs"
              >
                <span className="text-xs font-medium truncate shrink-0" title={goal.name}>
                  {goal.name}
                </span>
                <div className="flex-1 min-w-0">
                  <Progress value={pct} className={`h-1.5 ${indicatorClass}`} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatValue(goal)} · {Math.round(pct)}%
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
