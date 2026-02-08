import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Target } from "lucide-react";

interface GoalProgress {
  id: string;
  name: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  professional_id: string | null;
  show_in_header?: boolean;
  header_priority?: number;
}

export function GoalsProgressBar() {
  const { profile, isAdmin } = useAuth();
  const [goals, setGoals] = useState<GoalProgress[]>([]);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchHeaderGoals = async () => {
      const { data, error } = await supabase.rpc("get_goals_with_progress", {
        p_tenant_id: profile.tenant_id,
        p_include_archived: false,
      });
      if (error) return;

      const allGoals = (data || []) as Array<GoalProgress & { show_in_header?: boolean; header_priority?: number }>;

      let headerGoals: GoalProgress[];

      if (isAdmin) {
        // Admin: metas gerais (sem profissional) com show_in_header ou header_priority > 0
        headerGoals = allGoals
          .filter((g) => !g.professional_id && (g.show_in_header || (g.header_priority ?? 0) > 0))
          .sort((a, b) => (b.header_priority ?? 0) - (a.header_priority ?? 0));
      } else if (profile?.id) {
        // Profissional: sua meta (professional_id = profile.id)
        headerGoals = allGoals.filter((g) => g.professional_id === profile.id);
      } else {
        headerGoals = [];
      }

      setGoals(headerGoals);
    };

    fetchHeaderGoals();
    const interval = setInterval(fetchHeaderGoals, 60000);
    const onFocus = () => fetchHeaderGoals();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  if (goals.length === 0) return null;

  const formatValue = (goal: GoalProgress) => {
    if (
      goal.goal_type === "revenue" ||
      goal.goal_type === "product_revenue" ||
      goal.goal_type === "ticket_medio"
    ) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(goal.current_value);
    }
    return String(Math.round(goal.current_value));
  };

  const content = (
    <div className="space-y-3 max-w-4xl mx-auto">
      {goals.map((goal) => {
        const pct = Math.min(100, goal.progress_pct);
        const isComplete = pct >= 100;

        return (
          <div key={goal.id} className="flex items-center gap-3">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-foreground truncate">{goal.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {formatValue(goal)} {isComplete ? "· Meta concluída!" : `· ${Math.round(pct)}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return isAdmin ? (
    <Link
      to="/metas"
      className="block border-b border-border bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      {content}
    </Link>
  ) : (
    <Link
      to="/minhas-metas"
      className="block border-b border-border bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      {content}
    </Link>
  );
}
