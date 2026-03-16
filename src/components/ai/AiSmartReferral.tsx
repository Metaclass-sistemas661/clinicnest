import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Forward,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Clipboard,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AiSmartReferralProps {
  chiefComplaint?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  cidCode?: string;
  patientName?: string;
  allergies?: string;
  className?: string;
}

interface Referral {
  specialty: string;
  reason: string;
  urgency: "routine" | "priority" | "urgent";
  clinical_summary: string;
  questions_for_specialist: string[];
  complementary_exams: string[];
}

interface ReferralResult {
  referrals: Referral[];
  general_notes: string;
}

const URGENCY_STYLES: Record<string, { label: string; color: string }> = {
  routine: { label: "Rotina", color: "bg-green-100 text-green-700 border-green-300" },
  priority: { label: "Prioritário", color: "bg-amber-100 text-amber-700 border-amber-300" },
  urgent: { label: "Urgente", color: "bg-red-100 text-red-700 border-red-300" },
};

export function AiSmartReferral({
  chiefComplaint,
  diagnosis,
  treatmentPlan,
  cidCode,
  patientName,
  allergies,
  className,
}: AiSmartReferralProps) {
  const [result, setResult] = useState<ReferralResult | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const referralMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("ai-smart-referral", {
        body: {
          chief_complaint: chiefComplaint,
          diagnosis,
          treatment_plan: treatmentPlan,
          cid_code: cidCode,
          patient_name: patientName,
          allergies,
        },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao gerar encaminhamento");
      return res.data as ReferralResult;
    },
    onSuccess: (data) => setResult(data),
  });

  const hasContext = !!(diagnosis || chiefComplaint);

  const copyReferralText = (ref: Referral, idx: number) => {
    const urgStyle = URGENCY_STYLES[ref.urgency] || URGENCY_STYLES.routine;
    const text = [
      `ENCAMINHAMENTO — ${ref.specialty}`,
      `Urgência: ${urgStyle.label}`,
      ``,
      `Paciente: ${patientName || "N/I"}`,
      cidCode ? `CID: ${cidCode}` : null,
      ``,
      `Resumo Clínico:`,
      ref.clinical_summary,
      ``,
      `Motivo do Encaminhamento:`,
      ref.reason,
      ref.questions_for_specialist?.length ? `\nPerguntas para o Especialista:\n${ref.questions_for_specialist.map((q) => `• ${q}`).join("\n")}` : null,
      ref.complementary_exams?.length ? `\nExames Complementares:\n${ref.complementary_exams.map((e) => `• ${e}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Encaminhamento copiado!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Forward className="h-4 w-4 text-teal-600" />
            Encaminhamento Inteligente
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => referralMutation.mutate()}
            disabled={referralMutation.isPending || !hasContext}
            className="gap-1.5 text-xs"
          >
            {referralMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
            ) : (
              <><Forward className="h-3.5 w-3.5" /> Sugerir Encaminhamento</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasContext && !result && (
          <p className="text-xs text-muted-foreground">
            Preencha o diagnóstico ou queixa principal para gerar sugestões de encaminhamento.
          </p>
        )}

        {referralMutation.isError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {referralMutation.error.message}
          </p>
        )}

        {result && (
          <div className="space-y-3">
            {result.referrals.map((ref, idx) => {
              const urgStyle = URGENCY_STYLES[ref.urgency] || URGENCY_STYLES.routine;
              const isExpanded = expandedIdx === idx;

              return (
                <div
                  key={idx}
                  className={cn("rounded-lg border p-3 space-y-2", urgStyle.color.split(" ")[0])}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ref.specialty}</span>
                      <Badge variant="outline" className={cn("text-xs gap-1", urgStyle.color)}>
                        <Clock className="h-3 w-3" />
                        {urgStyle.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyReferralText(ref, idx)}
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Clipboard className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm">{ref.reason}</p>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t text-sm">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Resumo Clínico
                        </span>
                        <p className="mt-0.5">{ref.clinical_summary}</p>
                      </div>
                      {ref.questions_for_specialist?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Perguntas para o Especialista:
                          </span>
                          <ul className="list-disc list-inside text-xs mt-0.5 space-y-0.5">
                            {ref.questions_for_specialist.map((q, qi) => (
                              <li key={qi}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ref.complementary_exams?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Exames Complementares:
                          </span>
                          <ul className="list-disc list-inside text-xs mt-0.5 space-y-0.5">
                            {ref.complementary_exams.map((e, ei) => (
                              <li key={ei}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {result.general_notes && (
              <p className="text-xs text-muted-foreground italic">{result.general_notes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
