import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export type GoalRankingItem = {
  professional_id: string;
  professional_name: string;
  goal_name: string;
  goal_type: string;
  current_value: number;
  target_value: number;
  progress_pct: number;
};

type DashboardGoalsCardProps = {
  professionalGoalsRanking: GoalRankingItem[];
  formatCurrency: (value: number) => string;
};

const podiumStyles = {
  1: { bg: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700", emoji: "🥇" },
  2: { bg: "bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600", emoji: "🥈" },
  3: { bg: "bg-amber-100/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", emoji: "🥉" },
} as const;

export const DashboardGoalsCard = memo(function DashboardGoalsCard({ professionalGoalsRanking, formatCurrency }: DashboardGoalsCardProps) {
  if (professionalGoalsRanking.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Ranking – Metas por Profissional
          </CardTitle>
          <CardDescription>
            Profissionais ordenados pelo progresso das metas
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/metas">Ver metas</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 md:space-y-3">
          {professionalGoalsRanking.map((item, index) => {
            const rank = index + 1;
            const isPodium = rank <= 3;
            const style = isPodium ? podiumStyles[rank as 1 | 2 | 3] : null;
            const isComplete = item.progress_pct >= 100;
            const formatVal = (v: number) =>
              item.goal_type === "revenue" || item.goal_type === "product_revenue"
                ? formatCurrency(v)
                : String(Math.round(v));
            return (
              <div
                key={`${item.professional_id}-${item.goal_name}`}
                className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4 ${
                  style ? `${style.bg} border-2` : ""
                }`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full font-bold text-sm shrink-0 bg-primary/10 text-primary">
                    {style?.emoji ?? rank}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">
                      {item.professional_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.goal_name}</p>
                  </div>
                </div>
                <div className="text-right self-end sm:self-auto">
                  <p className="text-base md:text-lg font-bold text-primary">
                    {formatVal(item.current_value)} / {formatVal(item.target_value)}
                  </p>
                  <p className={`text-xs ${isComplete ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {Math.round(item.progress_pct)}% {isComplete ? "· Meta concluída!" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
