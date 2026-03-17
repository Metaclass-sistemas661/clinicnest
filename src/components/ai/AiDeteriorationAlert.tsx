import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  Loader2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AiDeteriorationAlertProps {
  patientId: string;
  className?: string;
}

interface Alert {
  type: string;
  description: string;
  evidence: string;
  recommendation: string;
}

interface DeteriorationResult {
  risk_level: "low" | "moderate" | "high" | "critical";
  alerts: Alert[];
  summary: string;
  trend: "improving" | "stable" | "declining";
}

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  low: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", label: "Baixo" },
  moderate: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "Moderado" },
  high: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", label: "Alto" },
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Crítico" },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  worsening_symptoms: "Piora de Sintomas",
  new_symptoms: "Novos Sintomas",
  treatment_failure: "Falha Terapêutica",
  proms_decline: "PROMs em Declínio",
  escalating_diagnosis: "Diagnóstico Agravado",
};

export function AiDeteriorationAlert({ patientId, className }: AiDeteriorationAlertProps) {
  const [result, setResult] = useState<DeteriorationResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("ai-deterioration-alert", {
        body: { patient_id: patientId },
      });

      if (res.error) throw new Error(res.error.message || "Erro na análise");
      return res.data as DeteriorationResult;
    },
    onSuccess: (data) => setResult(data),
  });

  const riskStyle = result ? RISK_STYLES[result.risk_level] || RISK_STYLES.low : null;

  return (
    <Card className={cn(
      result?.risk_level === "critical" && "border-red-300",
      result?.risk_level === "high" && "border-orange-300",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            Análise de Deterioração Clínica
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
            className="gap-1.5 text-xs"
          >
            {analysisMutation.isPending ? (
              <><Spinner size="sm" /> Analisando...</>
            ) : (
              <><ShieldCheck className="h-3.5 w-3.5" /> Analisar</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {analysisMutation.isError && (
          <p className="text-sm text-red-600">{analysisMutation.error.message}</p>
        )}

        {result && riskStyle && (
          <div className="space-y-3">
            {/* Risk badge + trend */}
            <div className="flex items-center gap-3">
              <Badge className={cn("gap-1", riskStyle.bg, riskStyle.text, riskStyle.border)}>
                {(result.risk_level === "high" || result.risk_level === "critical") && (
                  <AlertTriangle className="h-3 w-3" />
                )}
                Risco: {riskStyle.label}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                {result.trend === "declining" && <><TrendingDown className="h-4 w-4 text-red-500" /> Em declínio</>}
                {result.trend === "stable" && <><Minus className="h-4 w-4 text-gray-400" /> Estável</>}
                {result.trend === "improving" && <><TrendingUp className="h-4 w-4 text-green-500" /> Melhorando</>}
              </div>
            </div>

            {/* Summary */}
            <p className="text-sm">{result.summary}</p>

            {/* Alerts */}
            {result.alerts.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="w-full text-xs gap-1 justify-start"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {result.alerts.length} alerta{result.alerts.length > 1 ? "s" : ""} identificado{result.alerts.length > 1 ? "s" : ""}
                </Button>
                {expanded && result.alerts.map((alert, i) => (
                  <div key={i} className={cn("p-3 rounded-lg border text-sm space-y-1", riskStyle.bg, riskStyle.border)}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn("h-3.5 w-3.5", riskStyle.text)} />
                      <span className="font-medium">{ALERT_TYPE_LABELS[alert.type] || alert.type}</span>
                    </div>
                    <p>{alert.description}</p>
                    {alert.evidence && (
                      <p className="text-xs text-muted-foreground"><strong>Evidência:</strong> {alert.evidence}</p>
                    )}
                    {alert.recommendation && (
                      <p className="text-xs"><strong>Recomendação:</strong> {alert.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!result && !analysisMutation.isPending && !analysisMutation.isError && (
          <p className="text-sm text-muted-foreground">
            Clique em "Analisar" para verificar sinais de deterioração com base no histórico de prontuários.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
