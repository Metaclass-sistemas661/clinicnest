import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Sparkles } from "lucide-react";
import { useGoalMotivation } from "@/contexts/GoalMotivationContext";
import { goalTypeLabels, type GoalType } from "@/lib/goals";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getMotivationalMessage(progressPct: number): string {
  if (progressPct >= 100) return "Meta concluída! Parabéns pelo excelente trabalho!";
  if (progressPct >= 80) return "Quase lá! Você está arrasando!";
  if (progressPct >= 50) return "Ótimo progresso! Continue assim!";
  if (progressPct >= 25) return "Bom começo! Cada atendimento conta!";
  return "Vamos juntos! Cada passo te aproxima da meta!";
}

export function ProfessionalGoalMotivationDialog() {
  const { motivationOpen, motivationData, closeMotivation } = useGoalMotivation() ?? {};

  if (motivationData) {
    console.log("[Popup:Comissão] Dados recebidos:", {
      commissionAmount: motivationData.commissionAmount,
      goalsCount: motivationData.goals?.length ?? 0,
    });
  }

  if (!motivationData) return null;

  const primaryGoal = motivationData.goals[0];
  const hasGoals = motivationData.goals.length > 0;

  return (
    <Dialog open={!!motivationOpen} onOpenChange={(o) => !o && closeMotivation?.()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col rounded-2xl border-0 bg-gradient-to-b from-primary/5 via-card to-card p-0 shadow-xl overflow-hidden">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 px-6 py-6 shrink-0">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-4 ring-primary/30">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              Atendimento concluído!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
              <Sparkles className="h-4 w-4" />
              {getMotivationalMessage(primaryGoal ? primaryGoal.progress_pct : 0)}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4 overflow-y-auto flex-1 min-h-0">
          {/* Comissão que o staff recebeu */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shrink-0">
            <p className="text-sm font-medium text-muted-foreground mb-1">Sua comissão neste atendimento</p>
            {motivationData.commissionAmount > 0 ? (
              <p className="text-xl font-bold text-primary">
                {formatCurrency(motivationData.commissionAmount)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem comissão configurada na Equipe para este serviço.
              </p>
            )}
          </div>

          {/* Metas e quanto falta */}
          {hasGoals ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Suas metas
              </div>
              <ul className="space-y-3">
                {motivationData.goals.map((goal) => {
                  const remaining = Math.max(0, goal.target_value - goal.current_value);
                  const pct = Math.min(100, goal.progress_pct);
                  const isRevenue =
                    goal.goal_type === "revenue" ||
                    goal.goal_type === "product_revenue" ||
                    goal.goal_type === "ticket_medio";
                  const formatVal = (v: number) =>
                    isRevenue ? formatCurrency(v) : `${Math.round(v)}`;

                  return (
                    <li key={goal.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate flex-1 mr-2">
                          {goal.name || goalTypeLabels[goal.goal_type as GoalType]}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {formatVal(goal.current_value)} / {formatVal(goal.target_value)}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {goal.progress_pct >= 100
                          ? "Meta concluída!"
                          : `Faltam ${formatVal(remaining)} para completar${
                              goal.days_remaining != null && goal.days_remaining > 0
                                ? ` · ${goal.days_remaining} dias restantes`
                                : ""
                            }`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sugira uma meta em Minhas Metas para acompanhar seu progresso!
            </p>
          )}

          <Button
            className="w-full gradient-primary text-primary-foreground shrink-0"
            onClick={() => closeMotivation?.()}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
