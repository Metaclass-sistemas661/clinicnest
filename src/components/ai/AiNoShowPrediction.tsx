import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { predictNoShow, NoShowPrediction } from "@/lib/no-show-predictor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AiNoShowPredictionProps {
  appointmentId: string;
  tenantId: string;
  className?: string;
}

export function AiNoShowPrediction({
  appointmentId,
  tenantId,
  className,
}: AiNoShowPredictionProps) {
  const { data: prediction, isLoading, error } = useQuery({
    queryKey: ["no-show-prediction", appointmentId],
    queryFn: () => predictNoShow(appointmentId, tenantId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return null;
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case "alto":
        return "text-red-500";
      case "medio":
        return "text-yellow-500";
      case "baixo":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "alto":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Alto Risco
          </Badge>
        );
      case "medio":
        return (
          <Badge variant="default" className="gap-1 bg-yellow-500">
            <AlertCircle className="h-3 w-3" />
            Risco Médio
          </Badge>
        );
      case "baixo":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500 text-white">
            <CheckCircle className="h-3 w-3" />
            Baixo Risco
          </Badge>
        );
      default:
        return null;
    }
  };

  const probabilityPercent = Math.round(prediction.probability * 100);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Previsão de No-Show
          </CardTitle>
          {getRiskBadge(prediction.risk_level)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Probabilidade de falta</span>
            <span className={cn("font-bold", getRiskColor(prediction.risk_level))}>
              {probabilityPercent}%
            </span>
          </div>
          <Progress
            value={probabilityPercent}
            className={cn(
              "h-2",
              prediction.risk_level === "alto" && "[&>div]:bg-red-500",
              prediction.risk_level === "medio" && "[&>div]:bg-yellow-500",
              prediction.risk_level === "baixo" && "[&>div]:bg-green-500"
            )}
          />
        </div>

        {prediction.risk_factors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Fatores de Risco
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {prediction.risk_factors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {prediction.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Recomendações
            </p>
            <ul className="text-sm space-y-1">
              {prediction.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-yellow-500">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Previsão baseada em análise estatística do histórico do paciente e padrões da clínica.
        </p>
      </CardContent>
    </Card>
  );
}

// Compact version for lists
export function AiNoShowBadge({
  appointmentId,
  tenantId,
}: {
  appointmentId: string;
  tenantId: string;
}) {
  const { data: prediction, isLoading } = useQuery({
    queryKey: ["no-show-prediction", appointmentId],
    queryFn: () => predictNoShow(appointmentId, tenantId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !prediction) return null;

  const probabilityPercent = Math.round(prediction.probability * 100);

  if (prediction.risk_level === "baixo") return null;

  return (
    <Badge
      variant={prediction.risk_level === "alto" ? "destructive" : "default"}
      className={cn(
        "text-xs",
        prediction.risk_level === "medio" && "bg-yellow-500"
      )}
      title={`${probabilityPercent}% chance de falta`}
    >
      {prediction.risk_level === "alto" ? (
        <AlertTriangle className="h-3 w-3 mr-1" />
      ) : (
        <AlertCircle className="h-3 w-3 mr-1" />
      )}
      {probabilityPercent}%
    </Badge>
  );
}
