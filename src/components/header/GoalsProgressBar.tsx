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
}

export function GoalsProgressBar() {
  const { profile, isAdmin } = useAuth();
  const [goal, setGoal] = useState<GoalProgress | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;

    const fetchHeaderGoal = async () => {
      const { data, error } = await supabase.rpc("get_goals_with_progress", {
        p_tenant_id: profile.tenant_id,
      });
      if (error) return;
      const goals = (data || []) as Array<GoalProgress & { show_in_header: boolean }>;
      const headerGoal = goals.find((g) => g.show_in_header);
      setGoal(headerGoal || null);
    };

    fetchHeaderGoal();
    const interval = setInterval(fetchHeaderGoal, 60000);
    const onFocus = () => fetchHeaderGoal();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [profile?.tenant_id, isAdmin]);

  if (!isAdmin || !goal) return null;

  const pct = Math.min(100, goal.progress_pct);
  const isComplete = pct >= 100;

  const formatValue = () => {
    if (goal.goal_type === "revenue" || goal.goal_type === "product_revenue") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(goal.current_value);
    }
    return String(goal.current_value);
  };

  return (
    <Link
      to="/metas"
      className="block border-b border-border bg-muted/30 px-4 py-2 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-foreground truncate">{goal.name}</span>
            <span className="text-muted-foreground shrink-0 ml-2">
              {formatValue()} {isComplete ? "· Meta concluída!" : `· ${Math.round(pct)}%`}
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
    </Link>
  );
}
