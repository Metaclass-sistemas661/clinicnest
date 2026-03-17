import { Spinner } from "@/components/ui/spinner";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle, Phone, MessageSquare, Mail, CalendarClock,
  Video, Users, Loader2, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PreventiveAction {
  action: string;
  timing: string;
  priority: "alta" | "media" | "baixa";
  message_suggestion: string;
}

interface PredictionResult {
  probability: number;
  risk_level: "baixo" | "medio" | "alto";
  risk_factors: string[];
  preventive_actions: PreventiveAction[];
  confidence?: number;
}

interface Props {
  appointmentId: string;
  compact?: boolean;
  className?: string;
}

const actionIcons: Record<string, typeof Phone> = {
  send_whatsapp_reminder: MessageSquare,
  send_sms_reminder: Mail,
  call_patient: Phone,
  overbook_slot: Users,
  offer_reschedule: CalendarClock,
  offer_teleconsulta: Video,
};

const priorityStyles: Record<string, string> = {
  alta: "border-red-200 bg-red-50 text-red-700",
  media: "border-amber-200 bg-amber-50 text-amber-700",
  baixa: "border-blue-200 bg-blue-50 text-blue-700",
};

export function AiCancelPrediction({ appointmentId, compact, className }: Props) {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await supabase.functions.invoke("ai-cancel-prediction", {
        body: { appointment_id: appointmentId },
      });
      if (resp.error) throw resp.error;
      setPrediction(resp.data as PredictionResult);
      setExpanded(true);
    } catch {
      // Silent fail for optional feature
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  // Compact badge format for agenda list
  if (compact && !prediction) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-6 text-[10px] gap-1 px-1.5", className)}
        onClick={analyze}
        disabled={loading}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <><Sparkles className="h-3 w-3" /> Risco IA</>
        )}
      </Button>
    );
  }

  if (compact && prediction) {
    const prob = Math.round(prediction.probability * 100);
    if (prediction.risk_level === "baixo") return null;
    return (
      <Badge
        variant={prediction.risk_level === "alto" ? "destructive" : "default"}
        className={cn(
          "text-[10px] h-5 gap-1 cursor-pointer",
          prediction.risk_level === "medio" && "bg-amber-500 hover:bg-amber-600",
          className,
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <AlertTriangle className="h-3 w-3" />
        {prob}% risco
      </Badge>
    );
  }

  // Full card format
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardContent className="pt-4 pb-3 space-y-3">
        {!prediction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs w-full"
            onClick={analyze}
            disabled={loading}
          >
            {loading ? (
              <><Spinner size="sm" /> Analisando risco...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Analisar Risco de Cancelamento com IA</>
            )}
          </Button>
        )}

        {prediction && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Predição IA</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={prediction.risk_level === "alto" ? "destructive" : prediction.risk_level === "medio" ? "default" : "secondary"}
                  className={cn(prediction.risk_level === "medio" && "bg-amber-500")}
                >
                  {Math.round(prediction.probability * 100)}% risco
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {expanded && (
              <div className="space-y-3">
                {prediction.risk_factors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Fatores de risco:</p>
                    <ul className="space-y-0.5">
                      {prediction.risk_factors.map((f, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-destructive mt-0.5">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {prediction.preventive_actions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Ações preventivas sugeridas:</p>
                    {prediction.preventive_actions.map((action, i) => {
                      const Icon = actionIcons[action.action] || CalendarClock;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-md border text-xs",
                            priorityStyles[action.priority] || priorityStyles.media,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{action.timing}</span>
                              <Badge variant="outline" className="text-[9px] h-4">
                                {action.priority}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-0.5">{action.message_suggestion}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
