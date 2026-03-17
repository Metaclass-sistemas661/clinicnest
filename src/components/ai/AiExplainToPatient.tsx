import { Spinner } from "@/components/ui/spinner";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquareText, Loader2, Copy, Check, Send, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExplainResult {
  explanation: string;
  key_points: string[];
  patient_actions: string[];
}

interface Props {
  medicalText: string;
  context?: "diagnosis" | "prescription" | "treatment_plan" | "exam_result" | "general";
  patientName?: string;
  label?: string;
  className?: string;
}

export function AiExplainToPatient({
  medicalText,
  context = "general",
  patientName,
  label = "Explicar ao Paciente",
  className,
}: Props) {
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const explain = useCallback(async () => {
    if (!medicalText.trim()) {
      toast.error("Nenhum texto para traduzir.");
      return;
    }

    setLoading(true);
    try {
      const resp = await supabase.functions.invoke("ai-explain-patient", {
        body: { medical_text: medicalText, context, patient_name: patientName },
      });

      if (resp.error) throw resp.error;
      setResult(resp.data as ExplainResult);
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar explicação");
    } finally {
      setLoading(false);
    }
  }, [medicalText, context, patientName]);

  const fullText = result
    ? [
        result.explanation,
        result.key_points.length > 0 ? "\n📌 Pontos importantes:\n" + result.key_points.map((p) => `• ${p}`).join("\n") : "",
        result.patient_actions.length > 0 ? "\n✅ O que você precisa fazer:\n" + result.patient_actions.map((a) => `• ${a}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Texto copiado!");
  };

  if (!medicalText.trim()) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5 text-xs h-7", className)}
        onClick={explain}
        disabled={loading}
      >
        {loading ? (
          <><Spinner size="sm" /> Traduzindo...</>
        ) : (
          <><MessageSquareText className="h-3 w-3" /> {label}</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Explicação para o Paciente
            </DialogTitle>
          </DialogHeader>

          {result && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {result.explanation}
                </p>

                {result.key_points.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">📌 Pontos importantes:</p>
                    <ul className="space-y-1">
                      {result.key_points.map((p, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.patient_actions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">✅ O que você precisa fazer:</p>
                    <ul className="space-y-1">
                      {result.patient_actions.map((a, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-600">→</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado!" : "Copiar texto"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground flex-1">
                    Gerado por IA — revise antes de compartilhar com o paciente.
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
