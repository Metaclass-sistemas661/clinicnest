import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trophy,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------
interface MetricData {
  own: number;
  average?: number;
  percentile?: number;
  unit?: string;
}

interface BenchmarkData {
  clinic_count: number;
  period: string;
  metrics: {
    occupancy: MetricData;
    no_show_rate: MetricData;
    avg_ticket: MetricData;
    total_patients: MetricData;
    total_appointments: MetricData;
  };
}

// ---------- Helpers ----------
const formatValue = (value: number, unit?: string) => {
  if (unit === "BRL") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (unit === "%") return `${value}%`;
  return value.toLocaleString("pt-BR");
};

const getPercentileColor = (p: number) => {
  if (p >= 75) return "text-green-600";
  if (p >= 50) return "text-teal-600";
  if (p >= 25) return "text-amber-600";
  return "text-red-600";
};

const getPercentileBg = (p: number) => {
  if (p >= 75) return "bg-green-100 border-green-200";
  if (p >= 50) return "bg-teal-100 border-teal-200";
  if (p >= 25) return "bg-amber-100 border-amber-200";
  return "bg-red-100 border-red-200";
};

const getComparisonIcon = (own: number, avg: number, lowerIsBetter = false) => {
  const better = lowerIsBetter ? own < avg : own > avg;
  const equal = Math.abs(own - avg) < 1;
  if (equal) return <Minus className="h-4 w-4 text-gray-400" />;
  if (better) return <TrendingUp className="h-4 w-4 text-green-600" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
};

// ---------- Component ----------
export function AiBenchmarking() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmark = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "ai-benchmarking",
        { body: {} }
      );
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
      toast.success("Benchmarking atualizado!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar benchmarking";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (!data && !isLoading && !error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1">Benchmarking</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Compare as métricas da sua clínica com a média anônima de todas
              as clínicas no ClinicNest. Descubra onde você se destaca.
            </p>
          </div>
          <Button onClick={fetchBenchmark} className="gap-2 mt-2" variant="outline">
            <BarChart3 className="h-4 w-4" />
            Ver Benchmarking
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-muted-foreground">Agregando métricas anônimas...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={fetchBenchmark} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { metrics } = data;

  const cards: {
    label: string;
    icon: React.ElementType;
    metric: MetricData;
    lowerIsBetter?: boolean;
  }[] = [
    { label: "Ocupação de Agenda", icon: Calendar, metric: metrics.occupancy },
    { label: "Taxa de No-Show", icon: Target, metric: metrics.no_show_rate, lowerIsBetter: true },
    { label: "Ticket Médio", icon: DollarSign, metric: metrics.avg_ticket },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Benchmarking
          </h2>
          <p className="text-sm text-muted-foreground">
            Comparando com {data.clinic_count} clínicas · {data.period}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBenchmark} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const hasComparison = card.metric.average !== undefined;
          const percentile = card.metric.percentile ?? 50;

          return (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium">{card.label}</span>
                  </div>
                  {hasComparison &&
                    getComparisonIcon(card.metric.own, card.metric.average!, card.lowerIsBetter)}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Sua clínica</p>
                    <p className="text-2xl font-bold">
                      {formatValue(card.metric.own, card.metric.unit)}
                    </p>
                  </div>

                  {hasComparison && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Média geral</p>
                        <p className="text-lg font-semibold text-muted-foreground">
                          {formatValue(card.metric.average!, card.metric.unit)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
                          getPercentileBg(percentile)
                        )}
                      >
                        <Trophy className={cn("h-4 w-4", getPercentileColor(percentile))} />
                        <span className={cn("text-sm font-bold", getPercentileColor(percentile))}>
                          Top {100 - percentile}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Percentile bar */}
                  {hasComparison && (
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all",
                          percentile >= 75
                            ? "bg-green-500"
                            : percentile >= 50
                            ? "bg-teal-500"
                            : percentile >= 25
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${percentile}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.total_patients.own.toLocaleString("pt-BR")}</p>
              <p className="text-sm text-muted-foreground">Pacientes cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {metrics.total_appointments.own.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground">Agendamentos no período</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
