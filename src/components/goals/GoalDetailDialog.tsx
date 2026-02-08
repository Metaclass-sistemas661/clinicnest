import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import type { GoalWithProgress } from "@/lib/goals";

interface HistoryPoint {
  day_date: string;
  cumulative_value: number;
  progress_pct: number;
}

interface GoalDetailDialogProps {
  goal: GoalWithProgress;
  tenantId: string;
  formatValue: (g: GoalWithProgress) => string;
  onClose: () => void;
}

export function GoalDetailDialog({ goal, tenantId, formatValue, onClose }: GoalDetailDialogProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const [historyRes, previousRes] = await Promise.all([
          supabase.rpc("get_goal_progress_history", {
            p_goal_id: goal.id,
            p_tenant_id: tenantId,
          }),
          supabase.rpc("get_goal_previous_period_value", {
            p_goal_id: goal.id,
            p_tenant_id: tenantId,
          }),
        ]);

        if (historyRes.data) {
          const data = historyRes.data as HistoryPoint[];
          setHistory(
            data.map((d) => ({
              ...d,
              day_date: typeof d.day_date === "string" ? d.day_date : (d.day_date as unknown as string),
            }))
          );
        }
        if (previousRes.data !== null) {
          setPreviousValue(Number(previousRes.data));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [goal.id, tenantId]);

  const chartData = history.map((h) => ({
    date: h.day_date,
    label: format(new Date(h.day_date), "dd/MM", { locale: ptBR }),
    valor: Number(h.cumulative_value),
    progresso: Number(h.progress_pct),
  }));

  const formatChartValue = (v: number) => {
    if (goal.goal_type === "revenue" || goal.goal_type === "product_revenue" || goal.goal_type === "ticket_medio") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
    }
    return String(Math.round(v));
  };

  const diffFromPrevious =
    previousValue !== null && previousValue > 0
      ? ((goal.current_value - previousValue) / previousValue) * 100
      : null;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {goal.name}
          </DialogTitle>
          <DialogDescription>
            Evolução e comparativo com período anterior
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Valor atual</p>
                <p className="text-lg font-bold">{formatValue(goal)}</p>
              </CardContent>
            </Card>
            {previousValue !== null && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Período anterior</p>
                  <p className="text-lg font-bold">
                    {goal.goal_type === "revenue" || goal.goal_type === "product_revenue" || goal.goal_type === "ticket_medio"
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(previousValue)
                      : Math.round(previousValue)}
                  </p>
                  {diffFromPrevious !== null && (
                    <p
                      className={`text-sm mt-1 ${
                        diffFromPrevious > 0 ? "text-green-600" : diffFromPrevious < 0 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {diffFromPrevious > 0 ? "+" : ""}
                      {diffFromPrevious.toFixed(1)}% em relação ao período anterior
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-4">Evolução do progresso</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatChartValue(v)}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                        formatter={(value: number) => [formatChartValue(value), "Valor"]}
                        labelFormatter={(label) => `Dia ${label}`}
                      />
                      <ReferenceLine
                        y={goal.target_value}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Ainda não há dados suficientes para exibir o gráfico de evolução.
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
