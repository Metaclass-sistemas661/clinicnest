import { Spinner } from "@/components/ui/spinner";
import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sparkles, Pill, FlaskConical, AlertTriangle, ChevronDown, ChevronRight,
  Loader2, Stethoscope, ArrowRight, Copy, Check, ShieldAlert, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────

interface CidSuggestion {
  code: string;
  description: string;
  confidence: number;
}

interface MedicationSuggestion {
  name: string;
  presentation: string;
  dosage: string;
  indication: string;
}

interface ExamSuggestion {
  name: string;
  justification: string;
  urgency: "rotina" | "urgente";
}

interface ClinicalAlert {
  type: "red_flag" | "interaction" | "allergy" | "contraindication";
  message: string;
}

interface ConductSuggestion {
  text: string;
  type: "referral" | "followup" | "procedure" | "orientation";
}

interface CopilotResponse {
  cid_suggestions: CidSuggestion[];
  medication_suggestions: MedicationSuggestion[];
  exam_suggestions: ExamSuggestion[];
  alerts: ClinicalAlert[];
  conduct_suggestions: ConductSuggestion[];
}

export interface CopilotInput {
  chief_complaint?: string;
  anamnesis?: string;
  physical_exam?: string;
  diagnosis?: string;
  cid_code?: string;
  treatment_plan?: string;
  prescriptions?: string;
  allergies?: string;
  current_medications?: string;
  medical_history?: string;
  vitals?: {
    blood_pressure_systolic?: number | null;
    blood_pressure_diastolic?: number | null;
    heart_rate?: number | null;
    temperature?: number | null;
    oxygen_saturation?: number | null;
  };
  specialty?: string;
}

interface Props {
  input: CopilotInput;
  onSelectCid?: (code: string, description: string) => void;
  onAppendPrescription?: (text: string) => void;
  onAppendExam?: (text: string) => void;
  onAppendPlan?: (text: string) => void;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────

const DEBOUNCE_MS = 2000;

const alertIcon: Record<string, typeof AlertTriangle> = {
  red_flag: ShieldAlert,
  interaction: AlertTriangle,
  allergy: AlertTriangle,
  contraindication: ShieldAlert,
};

const alertColor: Record<string, string> = {
  red_flag: "text-red-600 bg-red-50 border-red-200",
  interaction: "text-orange-600 bg-orange-50 border-orange-200",
  allergy: "text-amber-600 bg-amber-50 border-amber-200",
  contraindication: "text-red-600 bg-red-50 border-red-200",
};

// ── Component ───────────────────────────────────────────────────

export function AiCopilotPanel({
  input,
  onSelectCid,
  onAppendPrescription,
  onAppendExam,
  onAppendPlan,
  className,
}: Props) {
  const [data, setData] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputRef = useRef<string>("");

  const [openSections, setOpenSections] = useState({
    alerts: true,
    cid: true,
    medications: true,
    exams: true,
    conduct: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const fetchSuggestions = useCallback(async (inp: CopilotInput) => {
    const hasContent = inp.chief_complaint || inp.anamnesis || inp.physical_exam || inp.diagnosis;
    if (!hasContent) return;

    const inputKey = JSON.stringify(inp);
    if (inputKey === lastInputRef.current) return;
    lastInputRef.current = inputKey;

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const resp = await supabase.functions.invoke("ai-copilot", {
        body: inp,
      });

      if (resp.error) throw resp.error;

      setData(resp.data as CopilotResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar sugestões";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced auto-fetch when input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(input);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, fetchSuggestions]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const totalSuggestions = data
    ? data.cid_suggestions.length +
      data.medication_suggestions.length +
      data.exam_suggestions.length +
      data.conduct_suggestions.length
    : 0;

  const hasAlerts = (data?.alerts?.length ?? 0) > 0;

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Copilot Clínico
            {totalSuggestions > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {totalSuggestions} sugestões
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => fetchSuggestions(input)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3">
        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Analisando prontuário...</span>
          </div>
        )}

        {error && !data && (
          <p className="text-xs text-destructive py-2">{error}</p>
        )}

        {!loading && !data && !error && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Comece a preencher o prontuário para receber sugestões do Copilot.
          </p>
        )}

        {data && (
          <ScrollArea className="max-h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {/* Alerts — always first */}
              {hasAlerts && (
                <Collapsible open={openSections.alerts} onOpenChange={() => toggleSection("alerts")}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-red-600 py-1">
                    {openSections.alerts ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Alertas ({data.alerts.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pl-5 pb-1">
                    {data.alerts.map((alert, i) => {
                      const Icon = alertIcon[alert.type] || AlertTriangle;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-md border text-xs",
                            alertColor[alert.type] || "text-amber-600 bg-amber-50 border-amber-200",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{alert.message}</span>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* CID Suggestions */}
              {data.cid_suggestions.length > 0 && (
                <Collapsible open={openSections.cid} onOpenChange={() => toggleSection("cid")}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-foreground py-1">
                    {openSections.cid ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Stethoscope className="h-3.5 w-3.5" />
                    CID-10 ({data.cid_suggestions.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-5 pb-1">
                    {data.cid_suggestions.map((cid, i) => (
                      <button
                        key={i}
                        type="button"
                        className="flex items-center gap-2 w-full text-left p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
                        onClick={() => onSelectCid?.(cid.code, cid.description)}
                      >
                        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                          {cid.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex-1 truncate">
                          {cid.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {Math.round(cid.confidence * 100)}%
                        </span>
                        <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Medication Suggestions */}
              {data.medication_suggestions.length > 0 && (
                <Collapsible open={openSections.medications} onOpenChange={() => toggleSection("medications")}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-foreground py-1">
                    {openSections.medications ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Pill className="h-3.5 w-3.5" />
                    Medicamentos ({data.medication_suggestions.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pl-5 pb-1">
                    {data.medication_suggestions.map((med, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-md border border-border/60 bg-muted/30 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{med.name} {med.presentation}</p>
                          <p className="text-[11px] text-muted-foreground">{med.dosage}</p>
                          <p className="text-[10px] text-muted-foreground/70 italic">{med.indication}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Copiar"
                            onClick={() => handleCopy(`${med.name} ${med.presentation} — ${med.dosage}`, `med-${i}`)}
                          >
                            {copiedItem === `med-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          {onAppendPrescription && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Adicionar à prescrição"
                              onClick={() => onAppendPrescription(`${med.name} ${med.presentation} — ${med.dosage}`)}
                            >
                              <ArrowRight className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Exam Suggestions */}
              {data.exam_suggestions.length > 0 && (
                <Collapsible open={openSections.exams} onOpenChange={() => toggleSection("exams")}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-foreground py-1">
                    {openSections.exams ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <FlaskConical className="h-3.5 w-3.5" />
                    Exames ({data.exam_suggestions.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pl-5 pb-1">
                    {data.exam_suggestions.map((exam, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-md border border-border/60 bg-muted/30 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium">{exam.name}</p>
                            {exam.urgency === "urgente" && (
                              <Badge variant="destructive" className="text-[9px] h-4">Urgente</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{exam.justification}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Copiar"
                            onClick={() => handleCopy(exam.name, `exam-${i}`)}
                          >
                            {copiedItem === `exam-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          {onAppendExam && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Adicionar"
                              onClick={() => onAppendExam(exam.name)}
                            >
                              <ArrowRight className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Conduct Suggestions */}
              {data.conduct_suggestions.length > 0 && (
                <Collapsible open={openSections.conduct} onOpenChange={() => toggleSection("conduct")}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-foreground py-1">
                    {openSections.conduct ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <ArrowRight className="h-3.5 w-3.5" />
                    Conduta ({data.conduct_suggestions.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pl-5 pb-1">
                    {data.conduct_suggestions.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-md border border-border/60 bg-muted/30 group"
                      >
                        <span className="text-xs flex-1">{c.text}</span>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Copiar"
                            onClick={() => handleCopy(c.text, `conduct-${i}`)}
                          >
                            {copiedItem === `conduct-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          {onAppendPlan && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Adicionar ao plano"
                              onClick={() => onAppendPlan(c.text)}
                            >
                              <ArrowRight className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {loading && (
                <div className="flex items-center gap-1.5 text-muted-foreground pt-1">
                  <Spinner size="sm" />
                  <span className="text-[10px]">Atualizando...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
