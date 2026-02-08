import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Sparkles, Flame, Award, Zap } from "lucide-react";
import type { GoalWithProgress } from "@/lib/goals";
import { goalTypeLabels, periodLabels } from "@/lib/goals";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
}

interface AchievementRow {
  achievement_type: string;
  goal_id: string;
  goal_name: string | null;
  professional_id: string | null;
  professional_name: string | null;
  achieved_at: string;
  metadata: Record<string, unknown>;
  level_name: string | null;
  streak_count: number | null;
}

interface GoalAchievementsSectionProps {
  completedGoals: GoalWithProgress[];
  professionals: Profile[];
  tenantId: string;
  /** Filtra conquistas por profissional (para Minhas Metas) */
  professionalId?: string | null;
  recordOnLoad?: boolean;
}

const levelConfig: Record<string, { label: string; color: string; icon: typeof Award }> = {
  bronze: { label: "Bronze", color: "bg-amber-700/20 text-amber-800 border-amber-500/50", icon: Award },
  prata: { label: "Prata", color: "bg-gray-400/20 text-gray-700 border-gray-500/50", icon: Zap },
  ouro: { label: "Ouro", color: "bg-amber-400/20 text-amber-900 border-amber-500/50", icon: Trophy },
};

export function GoalAchievementsSection({
  completedGoals,
  professionals,
  tenantId,
  professionalId,
  recordOnLoad = true,
}: GoalAchievementsSectionProps) {
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const fetchAchievements = async () => {
      try {
        if (recordOnLoad) {
          await supabase.rpc("record_goal_achievements_for_tenant", {
            p_tenant_id: tenantId,
          });
        }

        const { data, error } = await supabase.rpc("get_achievements_summary", {
          p_tenant_id: tenantId,
          p_professional_id: professionalId ?? null,
        });

        if (error) throw error;
        setAchievements((data || []) as AchievementRow[]);
      } catch (e) {
        console.error("Erro ao carregar conquistas:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAchievements();
  }, [tenantId, professionalId, recordOnLoad]);

  const goalReached = achievements.filter((a) => a.achievement_type === "goal_reached");
  const streaks = achievements.filter((a) => a.achievement_type === "streak");
  const levels = achievements.filter((a) => a.achievement_type === "level");

  type GoalDisplay = {
    name: string;
    professional_name: string | null;
    goal_type?: string;
    period?: string;
  };
  const goalsToShow: GoalDisplay[] =
    goalReached.length > 0
      ? goalReached.map((a) => ({
          name: a.goal_name ?? "Meta",
          professional_name: a.professional_name ?? null,
        }))
      : completedGoals.map((g) => ({
          name: g.name,
          professional_name: g.professional_id
            ? professionals.find((p) => p.id === g.professional_id)?.full_name ?? null
            : null,
          goal_type: g.goal_type,
          period: g.period,
        }));
  const hasAny = goalsToShow.length > 0 || streaks.length > 0 || levels.length > 0;

  if (isLoading && recordOnLoad) return null;
  if (!hasAny) return null;

  return (
    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-green-600" />
          Conquistas
          <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700">
            {goalsToShow.length} meta{goalsToShow.length !== 1 ? "s" : ""} atingida
            {goalsToShow.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metas atingidas */}
        {goalsToShow.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Metas atingidas
            </p>
            <ul className="space-y-2">
              {goalsToShow.map((item, idx) => {
                const typeLabel = item.goal_type ? goalTypeLabels[item.goal_type as keyof typeof goalTypeLabels] : "";
                const periodLabel = item.period ? periodLabels[item.period as keyof typeof periodLabels] : "";
                return (
                  <li
                    key={idx}
                    className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-sm"
                  >
                    <Sparkles className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{item.name}</span>
                      {item.professional_name && <span className="text-muted-foreground ml-1">· {item.professional_name}</span>}
                    </div>
                    {(typeLabel || periodLabel) && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {typeLabel} {periodLabel && `· ${periodLabel}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Streaks */}
        {streaks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Sequências
            </p>
            <div className="flex flex-wrap gap-2">
              {streaks.map((s, idx) => {
                const count = s.streak_count ?? (s.metadata?.streak_count as number) ?? 0;
                const prof = s.professional_name || "Salão";
                return (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="bg-orange-500/10 text-orange-700 border-orange-500/30 gap-1"
                  >
                    <Flame className="h-3 w-3" />
                    {count}x {prof}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Níveis */}
        {levels.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Award className="h-3.5 w-3.5" />
              Níveis
            </p>
            <div className="flex flex-wrap gap-2">
              {levels.map((l, idx) => {
                const level = (l.level_name || l.metadata?.level) as string;
                const cfg = levelConfig[level] || levelConfig.bronze;
                const total = (l.metadata?.total_goals_reached as number) ?? 0;
                const prof = l.professional_name || "Salão";
                const Icon = cfg.icon;
                return (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={`${cfg.color} border gap-1`}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label} · {prof}
                    {total > 0 && <span className="opacity-80">({total})</span>}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
