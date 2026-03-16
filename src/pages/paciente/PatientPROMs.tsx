import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Heart,
  Send,
  CheckCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Questionnaires ──
interface Question {
  id: string;
  text: string;
  options: { value: number; label: string }[];
}

const GENERAL_QUESTIONS: Question[] = [
  {
    id: "overall_health",
    text: "Como você avalia sua saúde geral hoje?",
    options: [
      { value: 5, label: "Excelente" },
      { value: 4, label: "Boa" },
      { value: 3, label: "Regular" },
      { value: 2, label: "Ruim" },
      { value: 1, label: "Muito ruim" },
    ],
  },
  {
    id: "pain_level",
    text: "Qual seu nível de dor nas últimas 24 horas?",
    options: [
      { value: 0, label: "Sem dor (0)" },
      { value: 2, label: "Leve (1-3)" },
      { value: 5, label: "Moderada (4-6)" },
      { value: 8, label: "Forte (7-9)" },
      { value: 10, label: "Insuportável (10)" },
    ],
  },
  {
    id: "sleep_quality",
    text: "Como está a qualidade do seu sono?",
    options: [
      { value: 5, label: "Muito boa" },
      { value: 4, label: "Boa" },
      { value: 3, label: "Regular" },
      { value: 2, label: "Ruim" },
      { value: 1, label: "Muito ruim" },
    ],
  },
  {
    id: "daily_activities",
    text: "Consegue realizar suas atividades diárias normalmente?",
    options: [
      { value: 5, label: "Sem dificuldade" },
      { value: 4, label: "Pouca dificuldade" },
      { value: 3, label: "Dificuldade moderada" },
      { value: 2, label: "Muita dificuldade" },
      { value: 1, label: "Não consigo" },
    ],
  },
  {
    id: "mood",
    text: "Como está seu humor e bem-estar emocional?",
    options: [
      { value: 5, label: "Ótimo" },
      { value: 4, label: "Bom" },
      { value: 3, label: "Regular" },
      { value: 2, label: "Baixo" },
      { value: 1, label: "Muito baixo" },
    ],
  },
];

const MAX_GENERAL_SCORE = 25; // 5 questions x 5 max

interface PromRecord {
  id: string;
  questionnaire: string;
  total_score: number | null;
  max_score: number | null;
  severity: string | null;
  notes: string | null;
  created_at: string;
}

function severityFromScore(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return "minimal";
  if (pct >= 0.6) return "mild";
  if (pct >= 0.4) return "moderate";
  return "severe";
}

function severityLabel(s: string | null): string {
  switch (s) {
    case "minimal": return "Excelente";
    case "mild": return "Bom";
    case "moderate": return "Atenção";
    case "severe": return "Preocupante";
    default: return "—";
  }
}

function severityColor(s: string | null): string {
  switch (s) {
    case "minimal": return "text-green-600 bg-green-50 border-green-200";
    case "mild": return "text-blue-600 bg-blue-50 border-blue-200";
    case "moderate": return "text-amber-600 bg-amber-50 border-amber-200";
    case "severe": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-gray-500 bg-gray-50 border-gray-200";
  }
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

export default function PatientPROMs() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<PromRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return;

      // Get patient link
      const { data: link } = await supabasePatient
        .from("patient_auth_link" as never)
        .select("patient_id, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!link) return;
      const l = link as { patient_id: string; tenant_id: string };
      setPatientId(l.patient_id);
      setTenantId(l.tenant_id);

      // Load history
      const { data: proms } = await supabasePatient
        .from("patient_proms" as never)
        .select("id, questionnaire, total_score, max_score, severity, notes, created_at")
        .eq("patient_id", l.patient_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (proms) setHistory(proms as unknown as PromRecord[]);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allAnswered = GENERAL_QUESTIONS.every((q) => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!patientId || !tenantId || !allAnswered) return;
    setIsSubmitting(true);

    const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
    const severity = severityFromScore(totalScore, MAX_GENERAL_SCORE);

    try {
      const { error } = await supabasePatient
        .from("patient_proms" as never)
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          questionnaire: "general",
          answers,
          total_score: totalScore,
          max_score: MAX_GENERAL_SCORE,
          severity,
          notes: notes.trim() || null,
        } as never);

      if (error) throw error;

      setSubmitted(true);
      toast.success("Respostas enviadas com sucesso! Seu médico será notificado.");
      setAnswers({});
      setNotes("");
      loadData();
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PatientLayout title="Minha Saúde — Questionário" subtitle="Reporte como está se sentindo entre as consultas">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Formulário */}
        {!submitted ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                Questionário de Bem-Estar
              </CardTitle>
              <CardDescription>
                Responda como está se sentindo. As respostas serão enviadas ao seu profissional de saúde.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {GENERAL_QUESTIONS.map((q) => (
                <div key={q.id} className="space-y-3">
                  <Label className="text-sm font-medium">{q.text}</Label>
                  <RadioGroup
                    value={answers[q.id]?.toString()}
                    onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: parseInt(v) }))}
                    className="flex flex-wrap gap-2"
                  >
                    {q.options.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all",
                          answers[q.id] === opt.value
                            ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/30"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <RadioGroupItem value={opt.value.toString()} className="sr-only" />
                        {opt.label}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              ))}

              <div className="space-y-2 pt-2 border-t">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conte algo mais sobre como está se sentindo..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                className="w-full gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-4 w-4" /> Enviar Respostas</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="flex flex-col items-center py-10 gap-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">Obrigado por responder!</p>
              <p className="text-sm text-muted-foreground text-center">
                Suas respostas foram enviadas. Seu profissional será alertado caso haja necessidade de acompanhamento.
              </p>
              <Button variant="outline" onClick={() => setSubmitted(false)} className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Responder novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-teal-600" />
              Histórico de Bem-Estar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum registro ainda. Responda o questionário acima para começar.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((record, idx) => {
                  const prev = history[idx + 1];
                  return (
                    <div
                      key={record.id}
                      className={cn("flex items-center gap-4 p-3 rounded-lg border", severityColor(record.severity))}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {new Date(record.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "short", year: "numeric"
                            })}
                          </span>
                          <Badge variant="outline" className={cn("text-xs", severityColor(record.severity))}>
                            {severityLabel(record.severity)}
                          </Badge>
                        </div>
                        {record.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">
                          {record.total_score}/{record.max_score}
                        </span>
                        {prev?.total_score != null && record.total_score != null && (
                          <TrendIcon current={record.total_score} previous={prev.total_score} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
