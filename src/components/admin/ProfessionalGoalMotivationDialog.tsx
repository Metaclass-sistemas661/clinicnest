import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "vynlobella_professional_goal_popup_last";
const MOTIVATIONAL_MESSAGES = [
  "Você está no caminho certo! Continue assim!",
  "Cada passo conta. Você consegue!",
  "A meta está cada vez mais perto. Vamos lá!",
  "Seu esforço faz a diferença. Parabéns!",
  "Você está fazendo bonito! Continue focando nos resultados.",
  "Acredite no seu potencial. Você está quase lá!",
  "Persistência é a chave. Não desista!",
  "Excelente desempenho! O sucesso é seu.",
  "Cada atendimento te aproxima da meta. Força!",
  "Você tem tudo para chegar lá. Confie em você!",
];

interface GoalWithProgress {
  id: string;
  name: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  professional_id: string | null;
}

function getMotivationalMessage(progressPct: number): string {
  if (progressPct >= 100) return "Parabéns! Você alcançou sua meta! 🎉";
  if (progressPct >= 75) return "Quase lá! Falta pouco para bater sua meta!";
  if (progressPct >= 50) return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
  if (progressPct >= 25) return "Bom começo! Mantenha o ritmo e você chega lá!";
  return "O primeiro passo já foi dado. Continue firme!";
}

export function ProfessionalGoalMotivationDialog() {
  const { profile, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<GoalWithProgress | null>(null);

  const fetchGoal = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return null;

    const { data, error } = await supabase.rpc("get_goals_with_progress", {
      p_tenant_id: profile.tenant_id,
    });
    if (error) return null;

    const goals = (data || []) as GoalWithProgress[];
    const myGoal = goals.find((g) => g.professional_id === profile.id);
    return myGoal || null;
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  useEffect(() => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return;

    const checkAndShow = async () => {
      const myGoal = await fetchGoal();
      if (!myGoal) return;

      setGoal(myGoal);

      const lastShown = localStorage.getItem(STORAGE_KEY);
      const today = new Date().toDateString();

      // Mostrar uma vez por dia
      if (lastShown !== today) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, today);
      }
    };

    checkAndShow();
  }, [profile?.tenant_id, profile?.id, isAdmin, fetchGoal]);

  if (!goal || !profile) return null;

  const fmt = (v: number) => {
    if (goal.goal_type === "revenue" || goal.goal_type === "product_revenue") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    }
    return String(Math.round(v));
  };
  const pct = Math.min(100, goal.progress_pct);
  const isComplete = pct >= 100;
  const remaining = goal.target_value - goal.current_value;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md overflow-hidden rounded-2xl border-0 bg-gradient-to-b from-primary/5 via-card to-card p-0 shadow-xl">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 px-6 py-6">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-4 ring-primary/30">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              Sua meta
            </DialogTitle>
            <DialogDescription>{goal.name}</DialogDescription>
          </div>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          <p className="text-sm text-center text-muted-foreground">
            Você tem uma meta de <strong className="text-foreground">{fmt(goal.target_value)}</strong>.
          </p>
          <p className="text-sm text-center">
            Até o momento você está em{" "}
            <strong className="text-primary">{fmt(goal.current_value)}</strong> da sua meta
            {!isComplete && remaining > 0 && (
              <> — faltam <strong>{fmt(remaining)}</strong></>
            )}
            .
          </p>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {Math.round(pct)}%
          </p>

          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-4 px-4">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-medium text-foreground">
              {getMotivationalMessage(pct)}
            </p>
          </div>

          <Button
            className="w-full gradient-primary text-primary-foreground"
            onClick={() => setOpen(false)}
          >
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
