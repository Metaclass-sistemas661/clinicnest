import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Building2, Stethoscope, Calendar, Download } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { examesBanners } from "@/components/patient/patientBannerData";

interface ExamResult {
  id: string;
  exam_type: string;
  exam_name: string;
  performed_at: string | null;
  lab_name: string;
  status: string;
  file_url: string | null;
  file_name: string | null;
  interpretation: string;
  requested_by_name: string;
  clinic_name: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "normal":   return { label: "Normal", variant: "default" as const };
    case "alterado": return { label: "Alterado", variant: "secondary" as const };
    case "critico":  return { label: "Crítico", variant: "destructive" as const };
    default:         return { label: "Pendente", variant: "outline" as const };
  }
}

export default function PatientExames() {
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { void fetchExams(); }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_exam_results");
      if (error) throw error;
      setExams((data ?? []) as ExamResult[]);
    } catch (err) {
      logger.error("PatientExames fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PatientLayout
      title="Exames e Laudos"
      subtitle="Resultados de exames e laudos médicos"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchExams()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <PatientBannerCarousel slides={examesBanners} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="py-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-64" /></CardContent></Card>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum exame disponível"
          description="Quando sua clínica enviar resultados de exames ou laudos, eles aparecerão aqui."
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const { label, variant } = statusBadge(exam.status);
            return (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">{exam.exam_name}</CardTitle>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    {exam.performed_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(exam.performed_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    )}
                    {exam.requested_by_name && (
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>{exam.requested_by_name}</span>
                      </div>
                    )}
                    {exam.clinic_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{exam.clinic_name}</span>
                      </div>
                    )}
                  </div>
                  {exam.interpretation && (
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{exam.interpretation}</p>
                  )}
                  {exam.file_url && (
                    <a href={exam.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        {exam.file_name || "Baixar arquivo"}
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PatientLayout>
  );
}
