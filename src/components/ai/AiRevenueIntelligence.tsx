import { Spinner } from "@/components/ui/spinner";
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  DollarSign,
  Calendar,
  Users,
  Target,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------
interface RevenueForecast {
  next_month_estimate: number;
  trend: "up" | "down" | "stable";
  confidence: number;
  reasoning: string;
}

interface ScheduleOptimization {
  day_of_week: string;
  idle_slots: number;
  suggestion: string;
}

interface TopProcedure {
  name: string;
  count: number;
  revenue: number;
  avg_ticket: number;
  trend: "up" | "down" | "stable";
}

interface PatientInsights {
  retention_rate: number;
  avg_return_days: number;
  at_risk_count: number;
  suggestion: string;
}

interface PricingSuggestion {
  procedure: string;
  current_price: number;
  suggested_price: number;
  reasoning: string;
}

interface ActionItem {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  expected_impact: string;
}

interface RevenueIntelligenceData {
  revenue_forecast?: RevenueForecast;
  schedule_optimization?: ScheduleOptimization[];
  top_procedures?: TopProcedure[];
  patient_insights?: PatientInsights;
  pricing_suggestions?: PricingSuggestion[];
  action_items?: ActionItem[];
}

// ---------- Helpers ----------
const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const trendIcon = (t: string) => {
  if (t === "up") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (t === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

// ---------- Component ----------
export function AiRevenueIntelligence() {
  const [data, setData] = useState<RevenueIntelligenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "ai-revenue-intelligence",
        { body: {} }
      );
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
      toast.success("Análise de receita gerada com sucesso!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar análise";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (!data && !isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
            <Brain className="h-8 w-8 text-teal-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1">Revenue Intelligence</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Análise preditiva com IA sobre receita, ocupação de agenda, procedimentos
              mais rentáveis e ações para otimizar seu faturamento.
            </p>
          </div>
          <Button onClick={fetchInsights} className="gap-2 mt-2">
            <Brain className="h-4 w-4" />
            Gerar Análise
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4">
          <Spinner size="lg" className="text-teal-600" />
          <p className="text-sm text-muted-foreground">Analisando dados dos últimos 3 meses...</p>
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
          <Button variant="outline" onClick={fetchInsights} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-600" />
            Revenue Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">Insights baseados nos últimos 3 meses</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInsights} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Revenue Forecast */}
      {data.revenue_forecast && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-teal-600" />
              Previsão de Receita — Próximo Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl font-bold">
                {formatBRL(data.revenue_forecast.next_month_estimate)}
              </span>
              {trendIcon(data.revenue_forecast.trend)}
              <Badge variant="secondary" className="text-xs">
                {Math.round(data.revenue_forecast.confidence * 100)}% confiança
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.revenue_forecast.reasoning}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Procedures */}
        {data.top_procedures && data.top_procedures.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-teal-600" />
                Procedimentos Mais Rentáveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.top_procedures.slice(0, 5).map((proc, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{proc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proc.count}x · Ticket médio {formatBRL(proc.avg_ticket || proc.revenue / proc.count)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{formatBRL(proc.revenue)}</span>
                      {trendIcon(proc.trend)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient Insights */}
        {data.patient_insights && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                Retenção de Pacientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">
                    {Math.round(data.patient_insights.retention_rate * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Retenção</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {data.patient_insights.avg_return_days}d
                  </p>
                  <p className="text-xs text-muted-foreground">Retorno médio</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {data.patient_insights.at_risk_count}
                  </p>
                  <p className="text-xs text-muted-foreground">Em risco</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{data.patient_insights.suggestion}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Schedule Optimization */}
      {data.schedule_optimization && data.schedule_optimization.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-600" />
              Otimização de Agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.schedule_optimization.map((opt, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                  <Badge variant="outline" className="capitalize whitespace-nowrap">
                    {opt.day_of_week}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {opt.idle_slots} horários ociosos
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Suggestions */}
      {data.pricing_suggestions && data.pricing_suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              Sugestões de Precificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.pricing_suggestions.map((ps, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ps.procedure}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ps.reasoning}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-muted-foreground line-through">
                      {formatBRL(ps.current_price)}
                    </span>
                    <ArrowUp className="h-3 w-3 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">
                      {formatBRL(ps.suggested_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {data.action_items && data.action_items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-teal-600" />
              Ações Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase whitespace-nowrap", priorityColor[item.priority])}
                  >
                    {item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    <p className="text-xs text-teal-600 mt-1 font-medium">
                      Impacto esperado: {item.expected_impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
