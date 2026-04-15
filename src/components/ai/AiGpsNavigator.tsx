import { useState, useCallback, useEffect } from "react";
import { api } from "@/integrations/gcp/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, ChevronRight, CheckCircle2, CircleDot } from "lucide-react";
import type { CopilotInput } from "./AiCopilotPanel";
import { useAiActivity } from "@/contexts/AiActivityContext";

// ── GPS Steps ──────────────────────────────────────────────────

const GPS_STEPS = [
  { key: "queixa", label: "Queixa Principal", field: "chief_complaint" },
  { key: "anamnese", label: "Anamnese", field: "anamnesis" },
  { key: "exame_fisico", label: "Exame Físico", field: "physical_exam" },
  { key: "hipotese", label: "Hipótese Diagnóstica", field: "diagnosis" },
  { key: "exames_complementares", label: "Exames Complementares", field: "exams_requested" },
  { key: "diagnostico", label: "Diagnóstico (CID)", field: "cid_code" },
  { key: "plano", label: "Plano Terapêutico", field: "treatment_plan" },
  { key: "prescricao", label: "Prescrição", field: "prescriptions" },
] as const;

type StepKey = (typeof GPS_STEPS)[number]["key"];

// ── Types ──────────────────────────────────────────────────────

interface GpsEvaluation {
  etapa_atual: string;
  proxima_etapa: string;
  justificativa_clinica: string;
  sugestao_acao: string;
  foco_exame: string;
  confidence_score: number;
  alertas: string[];
  progresso_geral: string;
  interaction_id?: string;
}

interface Props {
  input: CopilotInput;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────

export function AiGpsNavigator({ input, className }: Props) {
  const [evaluation, setEvaluation] = useState<GpsEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ai = useAiActivity();

  // Compute which steps are filled
  const filledSteps = new Set<StepKey>();
  GPS_STEPS.forEach((step) => {
    const value = (input as Record<string, unknown>)[step.field];
    if (typeof value === "string" && value.trim().length > 2) {
      filledSteps.add(step.key);
    }
  });

  const currentStepIndex = GPS_STEPS.findIndex((s) => !filledSteps.has(s.key));
  const progress = Math.round((filledSteps.size / GPS_STEPS.length) * 100);

  const fetchGps = useCallback(async () => {
    const hasContent = input.chief_complaint || input.anamnesis || input.physical_exam;
    if (!hasContent) return;

    setLoading(true);
    setError(null);
    ai.start("gps");

    try {
      const resp = await api.functions.invoke("ai-gps-evaluate", {
        body: {
          chief_complaint: input.chief_complaint,
          anamnesis: input.anamnesis,
          physical_exam: input.physical_exam,
          diagnosis: input.diagnosis,
          cid_code: input.cid_code,
          treatment_plan: input.treatment_plan,
          prescriptions: input.prescriptions,
          specialty: input.specialty,
        },
      });

      if (resp.error) throw resp.error;
      setEvaluation(resp.data as GpsEvaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao avaliar GPS");
    } finally {
      setLoading(false);
      ai.end("gps");
    }
  }, [input]);

  // Auto-fetch when enough content is present (debounced via parent)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.chief_complaint && (input.anamnesis || input.physical_exam)) {
        fetchGps();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [input.chief_complaint, input.anamnesis, input.physical_exam, input.diagnosis]); // eslint-disable-line react-hooks/exhaustive-deps

  const confidenceColor = (score: number) => {
    if (score >= 80) return "bg-success";
    if (score >= 50) return "bg-warning";
    return "bg-destructive";
  };

  const confidenceLabel = (score: number) => {
    if (score >= 80) return "Alta";
    if (score >= 50) return "Média";
    return "Baixa";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">GPS Clínico</span>
          {evaluation && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-5 text-white border-none",
                confidenceColor(evaluation.confidence_score),
              )}
            >
              {confidenceLabel(evaluation.confidence_score)} — {evaluation.confidence_score}%
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={fetchGps}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Avaliar
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Progresso da consulta</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progress >= 80 ? "bg-success" : progress >= 40 ? "bg-warning" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0.5">
        {GPS_STEPS.map((step, i) => {
          const isFilled = filledSteps.has(step.key);
          const isCurrent = i === currentStepIndex;
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 py-1 px-2 rounded-md text-xs transition-colors",
                isCurrent && "bg-primary/10 text-primary font-medium",
                isFilled && "text-muted-foreground",
                !isFilled && !isCurrent && "text-muted-foreground/50",
              )}
            >
              {isFilled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : isCurrent ? (
                <CircleDot className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
              )}
              <span className="truncate">{step.label}</span>
              {isCurrent && <ChevronRight className="h-3 w-3 ml-auto text-primary" />}
            </div>
          );
        })}
      </div>

      {/* AI Suggestion Card */}
      {evaluation && !loading && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-medium text-primary">
            {evaluation.sugestao_acao}
          </p>
          {evaluation.justificativa_clinica && (
            <p className="text-[11px] text-muted-foreground">
              {evaluation.justificativa_clinica}
            </p>
          )}
          {evaluation.foco_exame && (
            <p className="text-[11px] text-muted-foreground italic">
              Foco: {evaluation.foco_exame}
            </p>
          )}
          {evaluation.alertas?.length > 0 && (
            <div className="space-y-1 pt-1">
              {evaluation.alertas.map((alerta, i) => (
                <p key={i} className="text-[10px] text-amber-600 flex items-start gap-1">
                  <span className="text-amber-500">⚠</span>
                  {alerta}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
