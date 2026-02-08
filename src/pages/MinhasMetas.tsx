import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, ChevronDown, Clock, Check, X, LayoutDashboard } from "lucide-react";
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
import { GoalSuggestionForm } from "@/components/goals/GoalSuggestionForm";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface GoalSuggestion {
  id: string;
  name: string | null;
  goal_type: string;
  target_value: number;
  period: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason: string | null;
}

export default function MinhasMetas() {
  const { profile, isAdmin, refreshProfile } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailGoal, setDetailGoal] = useState<GoalWithProgress | null>(null);
  const [showBarInHeader, setShowBarInHeader] = useState(true);
  const [savingBarPref, setSavingBarPref] = useState(false);

  useEffect(() => {
    setShowBarInHeader(profile?.show_goals_progress_in_header !== false);
  }, [profile?.show_goals_progress_in_header]);

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
      const [goalsRes, suggestionsRes] = await Promise.all([
        supabase.rpc("get_goals_with_progress", {
          p_tenant_id: profile.tenant_id,
          p_include_archived: false,
        }),
        supabase
          .from("goal_suggestions")
          .select("id, name, goal_type, target_value, period, status, created_at, rejection_reason")
          .eq("professional_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);

      if (goalsRes.error) throw goalsRes.error;

      const allGoals = (goalsRes.data || []) as GoalWithProgress[];
      const myGoals = allGoals.filter((g) => g.professional_id === profile.id);
      setGoals(myGoals);
      setSuggestions((suggestionsRes.data || []) as GoalSuggestion[]);
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

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  const handleToggleBarInHeader = async (checked: boolean) => {
    if (!profile?.user_id) return;
    setShowBarInHeader(checked);
    setSavingBarPref(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ show_goals_progress_in_header: checked })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      await refreshProfile();
    } catch (e) {
      setShowBarInHeader(!checked);
      toast.error("Erro ao salvar preferência");
    } finally {
      setSavingBarPref(false);
    }
  };

  return (
    <MainLayout title="Minhas Metas" subtitle="Acompanhe o progresso das suas metas">
      <div className="space-y-6">
        {/* Sugerir meta - primeiro bloco, em destaque */}
        <Card className="border-primary/30 bg-primary/5">
          <GoalSuggestionForm
            tenantId={profile!.tenant_id!}
            professionalId={profile!.id}
            onSuccess={fetchData}
          />
        </Card>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="show-bar-header" className="text-sm font-medium cursor-pointer">
              Exibir barra de progresso das metas no topo da página
            </Label>
          </div>
          <Switch
            id="show-bar-header"
            checked={showBarInHeader}
            onCheckedChange={handleToggleBarInHeader}
            disabled={savingBarPref}
          />
        </div>

        {suggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Minhas sugestões</CardTitle>
              <CardDescription>Status das sugestões enviadas ao administrador</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.name || `Meta ${goalTypeLabels[s.goal_type as GoalType]}`}</span>
                      <span className="text-muted-foreground ml-2">
                        {goalTypeLabels[s.goal_type as GoalType]} · {periodLabels[s.period as GoalPeriod]} ·{" "}
                        {s.goal_type === "revenue" || s.goal_type === "ticket_medio"
                          ? formatCurrency(s.target_value)
                          : s.target_value}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          s.status === "approved"
                            ? "default"
                            : s.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {s.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {s.status === "approved" && <Check className="h-3 w-3 mr-1" />}
                        {s.status === "rejected" && <X className="h-3 w-3 mr-1" />}
                        {s.status === "pending" && "Aguardando aprovação"}
                        {s.status === "approved" && "Aprovada"}
                        {s.status === "rejected" && "Rejeitada"}
                      </Badge>
                      {s.status === "rejected" && s.rejection_reason && (
                        <span className="text-xs text-muted-foreground max-w-[200px] text-right">
                          {s.rejection_reason}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {pendingSuggestions.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {pendingSuggestions.length} sugestão(ões) aguardando aprovação do administrador.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <GoalAchievementsSection
          completedGoals={goals.filter((g) => g.progress_pct >= 100)}
          professionals={[]}
          tenantId={profile!.tenant_id!}
          professionalId={profile!.id}
        />

        <div className="space-y-4">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-center">
                Você ainda não tem metas definidas. Sugira uma meta acima ou aguarde o administrador.
              </p>
            </CardContent>
          </Card>
        ) : goals.map((goal) => {
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
