import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PatientPromsViewerProps {
  patientId: string;
}

interface PromRecord {
  id: string;
  questionnaire: string;
  total_score: number | null;
  max_score: number | null;
  severity: string | null;
  notes: string | null;
  answers: Record<string, number>;
  created_at: string;
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
    case "minimal": return "bg-green-100 text-green-700 border-green-300";
    case "mild": return "bg-blue-100 text-blue-700 border-blue-300";
    case "moderate": return "bg-amber-100 text-amber-700 border-amber-300";
    case "severe": return "bg-red-100 text-red-700 border-red-300";
    default: return "bg-gray-100 text-gray-500 border-gray-300";
  }
}

const QUESTION_LABELS: Record<string, string> = {
  overall_health: "Saúde geral",
  pain_level: "Dor",
  sleep_quality: "Sono",
  daily_activities: "Atividades diárias",
  mood: "Humor",
};

export function PatientPromsViewer({ patientId }: PatientPromsViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: proms, isLoading } = useQuery({
    queryKey: ["patient-proms", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_proms" as never)
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as PromRecord[];
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!proms || proms.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-teal-600" />
            PROMs — Desfechos Relatados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum questionário respondido pelo paciente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = proms[0];
  const previous = proms[1];
  const hasWorsened =
    previous &&
    latest.total_score != null &&
    previous.total_score != null &&
    latest.total_score < previous.total_score;

  const displayList = expanded ? proms : proms.slice(0, 3);

  return (
    <Card className={cn(latest.severity === "severe" && "border-red-300")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-teal-600" />
            PROMs — Desfechos Relatados
            {latest.severity === "severe" && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" /> Alerta
              </Badge>
            )}
            {latest.severity === "moderate" && (
              <Badge variant="outline" className="gap-1 text-xs border-amber-400 text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Atenção
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              {latest.total_score}/{latest.max_score}
            </span>
            {hasWorsened && <TrendingDown className="h-5 w-5 text-red-500" />}
            {previous && !hasWorsened && latest.total_score! > previous.total_score! && (
              <TrendingUp className="h-5 w-5 text-green-500" />
            )}
            {previous && latest.total_score === previous.total_score && (
              <Minus className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Latest detail */}
        {latest.answers && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(latest.answers).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {QUESTION_LABELS[key] || key}: {value}
              </Badge>
            ))}
          </div>
        )}

        {hasWorsened && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Piora reportada em relação ao questionário anterior
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2 pt-2 border-t">
          {displayList.map((record, idx) => {
            const prev = proms[idx + 1];
            return (
              <div
                key={record.id}
                className={cn(
                  "flex items-center justify-between text-sm px-2 py-1.5 rounded",
                  severityColor(record.severity)
                )}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {new Date(record.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {severityLabel(record.severity)}
                  </Badge>
                  {record.notes && (
                    <span className="text-xs truncate max-w-[200px]" title={record.notes}>
                      {record.notes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 font-medium">
                  {record.total_score}/{record.max_score}
                  {prev?.total_score != null && record.total_score != null && (
                    record.total_score > prev.total_score ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    ) : record.total_score < prev.total_score ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-gray-400" />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {proms.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            className="w-full text-xs gap-1"
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({proms.length})</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
