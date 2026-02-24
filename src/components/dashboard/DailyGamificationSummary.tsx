import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Target, Wallet, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";
import { useGamificationStatus } from "@/hooks/useGamificationEnabled";
import { startOfDay, endOfDay } from "date-fns";
import { APP_TIMEZONE } from "@/lib/date";
import { fromZonedTime } from "date-fns-tz";

interface DailySummary {
  appointmentsCompleted: number;
  totalCommission: number;
  totalRevenue: number;
  goalsProgress: Array<{
    name: string;
    current: number;
    target: number;
    progressPct: number;
  }>;
}

/**
 * DailyGamificationSummary — Card de resumo diário de gamificação
 * 
 * Exibe um resumo consolidado do dia quando os pop-ups estão desativados.
 * Mostra: atendimentos concluídos, comissão acumulada, progresso de metas.
 */
export function DailyGamificationSummary() {
  const { profile, isAdmin } = useAuth();
  const { isEnabled, disabledByTenant, disabledByUser } = useGamificationStatus();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id || !profile?.user_id) {
      setIsLoading(false);
      return;
    }

    const fetchDailySummary = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const todayStart = fromZonedTime(startOfDay(now), APP_TIMEZONE);
        const todayEnd = fromZonedTime(endOfDay(now), APP_TIMEZONE);

        // Buscar atendimentos concluídos hoje pelo profissional
        const { data: appointments, error: appError } = await supabase
          .from("appointments")
          .select("id, service_id, services(price)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .eq("status", "completed")
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", todayEnd.toISOString());

        if (appError) throw appError;

        const appointmentsCompleted = appointments?.length ?? 0;
        const totalRevenue = appointments?.reduce((sum, app) => {
          const price = (app.services as any)?.price ?? 0;
          return sum + Number(price);
        }, 0) ?? 0;

        // Buscar comissões do dia
        const { data: commissions, error: commError } = await supabase
          .from("commissions")
          .select("amount")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .gte("created_at", todayStart.toISOString())
          .lte("created_at", todayEnd.toISOString());

        if (commError) throw commError;

        const totalCommission = commissions?.reduce((sum, c) => sum + Number(c.amount ?? 0), 0) ?? 0;

        // Buscar metas do profissional
        const { data: goals, error: goalsError } = await supabase
          .from("professional_goals")
          .select("id, name, goal_type, target_value, current_value")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .eq("status", "active")
          .limit(3);

        if (goalsError) throw goalsError;

        const goalsProgress = (goals ?? []).map((g) => ({
          name: g.name || g.goal_type,
          current: Number(g.current_value ?? 0),
          target: Number(g.target_value ?? 1),
          progressPct: Math.min(100, Math.round((Number(g.current_value ?? 0) / Number(g.target_value ?? 1)) * 100)),
        }));

        setSummary({
          appointmentsCompleted,
          totalCommission,
          totalRevenue,
          goalsProgress,
        });
      } catch (err) {
        logger.error("Error fetching daily gamification summary:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailySummary();
  }, [profile?.tenant_id, profile?.user_id]);

  // Não mostrar se gamificação estiver habilitada (pop-ups já aparecem)
  // Ou se for admin (admin tem seu próprio resumo)
  if (isEnabled || isAdmin) {
    return null;
  }

  // Não mostrar se ainda carregando ou sem dados
  if (isLoading || !summary) {
    return null;
  }

  // Não mostrar se não teve atividade no dia
  if (summary.appointmentsCompleted === 0 && summary.goalsProgress.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
              <Trophy className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Resumo do Dia</CardTitle>
              <CardDescription className="text-xs">
                {disabledByTenant ? "Pop-ups desativados pela clínica" : "Pop-ups desativados"}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Gamificação
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats do dia */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Atendimentos
            </div>
            <p className="text-lg font-bold text-foreground">
              {summary.appointmentsCompleted}
            </p>
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3 w-3" />
              Comissão
            </div>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(summary.totalCommission)}
            </p>
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Faturado
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(summary.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Progresso de metas */}
        {summary.goalsProgress.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="h-3 w-3" />
              Suas Metas
            </div>
            <div className="space-y-2">
              {summary.goalsProgress.map((goal, idx) => (
                <div key={idx} className="rounded-lg bg-white/60 dark:bg-white/5 p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate">{goal.name}</span>
                    <span className="text-muted-foreground">{goal.progressPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${goal.progressPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
