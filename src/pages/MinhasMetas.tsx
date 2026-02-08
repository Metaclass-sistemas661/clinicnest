import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  goalTypeLabels,
  periodLabels,
  getProgressBorderColor,
  getProgressIndicatorClass,
  getProjectedBadgeVariant,
  type GoalWithProgress,
  type GoalType,
  type GoalPeriod,
} from "@/lib/goals";
import { GoalDetailDialog } from "@/components/goals/GoalDetailDialog";
import { GoalAchievementsSection } from "@/components/goals/GoalAchievementsSection";

export default function MinhasMetas() {
  const { profile, isAdmin } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailGoal, setDetailGoal] = useState<GoalWithProgress | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatValue = (g: GoalWithProgress) => {
    if (g.goal_type === "revenue" || g.goal_type === "product_revenue" || g.goal_type === "ticket_medio")
      return `${formatCurrency(g.current_value)} / ${formatCurrency(g.target_value)}`;
    return `${Math.round(g.current_value)} / ${g.target_value}`;
  };

  const fetchData = async () => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return;

    try {
      const { data, error } = await supabase.rpc("get_goals_with_progress", {
        p_tenant_id: profile.tenant_id,
        p_include_archived: false,
      });

      if (error) throw error;

      const allGoals = (data || []) as GoalWithProgress[];
      const myGoals = allGoals.filter((g) => g.professional_id === profile.id);
      setGoals(myGoals);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Erro ao carregar suas metas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id && profile?.id && !isAdmin) {
      fetchData();
    }
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  if (isAdmin) {
    return (
      <MainLayout title="Minhas Metas" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Esta página é para profissionais. Como administrador, acesse Metas.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout title="Minhas Metas" subtitle="Suas metas do salão">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </MainLayout>
    );
  }

  if (goals.length === 0) {
    return (
      <MainLayout title="Minhas Metas" subtitle="Suas metas do salão">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
            <p className="text-muted-foreground text-center mb-2">
              Você ainda não tem metas definidas pelo administrador.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Entre em contato com o administrador do salão para definir suas metas.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Minhas Metas" subtitle="Acompanhe o progresso das suas metas">
      <div className="space-y-6">
        <GoalAchievementsSection
          completedGoals={goals.filter((g) => g.progress_pct >= 100)}
          professionals={[]}
          tenantId={profile!.tenant_id!}
          professionalId={profile!.id}
        />
        <div className="space-y-4">
        {goals.map((goal) => {
          const pct = Math.min(100, goal.progress_pct);
          const indicatorClass = getProgressIndicatorClass(pct);
          const borderColor = getProgressBorderColor(pct);

          return (
            <Card
              key={goal.id}
              className={`overflow-hidden transition-all hover:shadow-md ${borderColor} border-l-4`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{goal.name}</CardTitle>
                <CardDescription className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs">
                  <span>{goalTypeLabels[goal.goal_type as GoalType]}</span>
                  <span>·</span>
                  <span>{periodLabels[goal.period as GoalPeriod]}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium">{formatValue(goal)}</p>
                <Progress value={pct} className={`h-2 ${indicatorClass}`} />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {goal.progress_pct >= 100 ? "Meta concluída!" : `${Math.round(goal.progress_pct)}%`}
                  </span>
                  {goal.days_remaining != null && goal.days_remaining > 0 && (
                    <span className="text-muted-foreground">
                      {goal.days_remaining} dias restantes
                    </span>
                  )}
                  {goal.projected_reach && goal.progress_pct < 100 && (
                    <Badge variant={getProjectedBadgeVariant(goal.projected_reach)}>
                      {goal.projected_reach}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setDetailGoal(goal)}
                >
                  <TrendingUp className="h-4 w-4" />
                  Ver evolução e comparativo
                  <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>

      {detailGoal && (
        <GoalDetailDialog
          goal={detailGoal}
          tenantId={profile!.tenant_id!}
          formatValue={formatValue}
          onClose={() => setDetailGoal(null)}
        />
      )}
    </MainLayout>
  );
}
