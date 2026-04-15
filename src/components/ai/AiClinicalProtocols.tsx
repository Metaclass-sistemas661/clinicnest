import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  FlaskConical,
  Pill,
  Calendar,
  AlertTriangle,
  Stethoscope,
  Users,
  Loader2,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------
interface Exam {
  name: string;
  justification: string;
  urgency: "rotina" | "urgente";
}

interface Medication {
  name: string;
  presentation: string;
  dosage: string;
  duration: string;
  notes: string;
}

interface FollowUp {
  return_days: number;
  monitoring: string[];
  reassessment_criteria: string;
}

interface RedFlag {
  sign: string;
  action: string;
}

interface Referral {
  specialty: string;
  criteria: string;
}

interface Protocol {
  initial_exams: Exam[];
  first_line_medications: Medication[];
  follow_up: FollowUp;
  red_flags: RedFlag[];
  referrals: Referral[];
  patient_guidelines: string[];
}

interface ProtocolData {
  cid_code: string;
  cid_description: string;
  protocol: Protocol;
  evidence_level: string;
  source_guidelines: string[];
}

// ---------- Component ----------
interface AiClinicalProtocolsProps {
  cidCode: string;
  cidDescription?: string;
  patientAge?: number;
  patientGender?: string;
  allergies?: string;
  currentMedications?: string;
  compact?: boolean;
}

export function AiClinicalProtocols({
  cidCode,
  cidDescription,
  patientAge,
  patientGender,
  allergies,
  currentMedications,
  compact = false,
}: AiClinicalProtocolsProps) {
  const [data, setData] = useState<ProtocolData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  const fetchProtocol = useCallback(async () => {
    if (!cidCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await api.functions.invoke(
        "ai-clinical-protocols",
        {
          body: {
            cid_code: cidCode,
            cid_description: cidDescription,
            patient_age: patientAge,
            patient_gender: patientGender,
            allergies,
            current_medications: currentMedications,
          },
        }
      );
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
      setExpanded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar protocolo";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [cidCode, cidDescription, patientAge, patientGender, allergies, currentMedications]);

  if (!cidCode) return null;

  if (!data && !isLoading && !error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={fetchProtocol}
        className="gap-2 text-teal-700 border-teal-200 hover:bg-teal-50"
      >
        <ClipboardList className="h-4 w-4" />
        Protocolo Clínico
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando protocolo para {cidCode}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500 py-2">
        <AlertCircle className="h-4 w-4" />
        {error}
        <Button variant="ghost" size="sm" onClick={fetchProtocol}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data?.protocol) return null;

  const { protocol } = data;

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader className="pb-2 cursor-pointer" role="button" tabIndex={0} onClick={() => setExpanded(!expanded)} onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-teal-600" />
            Protocolo: {data.cid_code} — {data.cid_description}
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.evidence_level && (
              <Badge variant="outline" className="text-[10px]">
                {data.evidence_level}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Exames */}
          {protocol.initial_exams?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                <FlaskConical className="h-3.5 w-3.5" /> Exames Iniciais
              </h4>
              <div className="space-y-1.5">
                {protocol.initial_exams.map((exam, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{exam.name}</span>
                      {exam.urgency === "urgente" && (
                        <Badge variant="destructive" className="ml-2 text-[9px] px-1 py-0">
                          Urgente
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">{exam.justification}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medicamentos */}
          {protocol.first_line_medications?.length > 0 && (
            <div>
              <Separator className="mb-3" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                <Pill className="h-3.5 w-3.5" /> Medicamentos 1ª Linha
              </h4>
              <div className="space-y-2">
                {protocol.first_line_medications.map((med, i) => (
                  <div key={i} className="rounded-lg bg-white border p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{med.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{med.presentation}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {med.dosage} · {med.duration}
                    </p>
                    {med.notes && (
                      <p className="text-xs text-amber-600 mt-1">{med.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {protocol.follow_up && (
            <div>
              <Separator className="mb-3" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5" /> Acompanhamento
              </h4>
              <p className="text-sm">
                Retorno em <strong>{protocol.follow_up.return_days} dias</strong>
              </p>
              {protocol.follow_up.monitoring?.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {protocol.follow_up.monitoring.map((m, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-teal-400" />
                      {m}
                    </li>
                  ))}
                </ul>
              )}
              {protocol.follow_up.reassessment_criteria && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Reavaliar: {protocol.follow_up.reassessment_criteria}
                </p>
              )}
            </div>
          )}

          {/* Red Flags */}
          {protocol.red_flags?.length > 0 && (
            <div>
              <Separator className="mb-3" />
              <h4 className="text-xs font-semibold uppercase text-red-600 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" /> Red Flags
              </h4>
              <div className="space-y-1.5">
                {protocol.red_flags.map((rf, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-red-700">{rf.sign}</span>
                      <p className="text-xs text-muted-foreground">{rf.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Encaminhamentos */}
          {protocol.referrals?.length > 0 && (
            <div>
              <Separator className="mb-3" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                <Stethoscope className="h-3.5 w-3.5" /> Encaminhamentos
              </h4>
              <div className="space-y-1">
                {protocol.referrals.map((ref, i) => (
                  <p key={i} className="text-sm">
                    <strong>{ref.specialty}</strong>
                    <span className="text-xs text-muted-foreground ml-1">— {ref.criteria}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Guidelines fonte */}
          {data.source_guidelines?.length > 0 && (
            <div className="pt-2">
              <Separator className="mb-3" />
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                Fontes: {data.source_guidelines.join(" · ")}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
