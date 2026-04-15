import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  FileText, RefreshCw, Building2, Stethoscope, Calendar, Download, Eye,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiPatient } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { laudosBanners } from "@/components/patient/patientBannerData";
import { generateMedicalReportPdf } from "@/utils/patientDocumentPdf";
import { toast } from "sonner";

/* ── Types ── */
interface MedicalReport {
  id: string;
  tipo: string;
  finalidade: string | null;
  historia_clinica: string | null;
  exame_fisico: string | null;
  exames_complementares: string | null;
  diagnostico: string | null;
  cid10: string | null;
  conclusao: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  professional_name: string;
  clinic_name: string;
}

/* ── Helpers ── */
function tipoLabel(t: string) {
  switch (t) {
    case "laudo_medico":       return "Laudo Médico";
    case "laudo_pericial":     return "Laudo Pericial";
    case "parecer_tecnico":    return "Parecer Técnico";
    case "relatorio_medico":   return "Relatório Médico";
    case "laudo_complementar": return "Laudo Complementar";
    default:                    return t?.replace(/_/g, " ") ?? "Laudo";
  }
}

function statusBadge(s: string) {
  switch (s) {
    case "assinado":    return { label: "Assinado",    variant: "default" as const };
    case "finalizado":  return { label: "Finalizado",  variant: "secondary" as const };
    default:            return { label: s || "—",      variant: "outline" as const };
  }
}

/* ── Component ── */
export default function PatientLaudos() {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<MedicalReport | null>(null);

  useEffect(() => { void fetchReports(); }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (apiPatient as any).rpc("get_patient_medical_reports");
      if (error) throw error;
      setReports((data ?? []) as MedicalReport[]);
    } catch (err) {
      logger.error("PatientLaudos fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (report: MedicalReport) => {
    try {
      await generateMedicalReportPdf(report);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      logger.error("PatientLaudos PDF error:", err);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <PatientLayout
      title="Laudos Médicos"
      subtitle="Laudos, pareceres e relatórios médicos"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchReports()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <PatientBannerCarousel slides={laudosBanners} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum laudo disponível"
          description="Quando seu médico finalizar um laudo, ele aparecerá aqui."
        />
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const badge = statusBadge(r.status);
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-500" />
                      {tipoLabel(r.tipo)}
                    </CardTitle>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    {r.professional_name && (
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>{r.professional_name}</span>
                      </div>
                    )}
                    {r.clinic_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{r.clinic_name}</span>
                      </div>
                    )}
                  </div>

                  {r.finalidade && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Finalidade:</strong> {r.finalidade}
                    </p>
                  )}

                  {r.conclusao && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap line-clamp-4">{r.conclusao}</p>
                    </div>
                  )}

                  {r.cid10 && (
                    <p className="text-xs text-muted-foreground">CID-10: {r.cid10}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalhes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleDownload(r)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-500" />
                  {tipoLabel(selected.tipo)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Data</p>
                    <p>{format(new Date(selected.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Profissional</p>
                    <p>{selected.professional_name || "—"}</p>
                  </div>
                  {selected.finalidade && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Finalidade</p>
                      <p>{selected.finalidade}</p>
                    </div>
                  )}
                </div>

                {selected.historia_clinica && (
                  <Section title="História Clínica" text={selected.historia_clinica} />
                )}
                {selected.exame_fisico && (
                  <Section title="Exame Físico" text={selected.exame_fisico} />
                )}
                {selected.exames_complementares && (
                  <Section title="Exames Complementares" text={selected.exames_complementares} />
                )}
                {selected.diagnostico && (
                  <Section title="Diagnóstico" text={selected.diagnostico} />
                )}
                {selected.conclusao && (
                  <Section title="Conclusão" text={selected.conclusao} />
                )}
                {selected.observacoes && (
                  <Section title="Observações" text={selected.observacoes} />
                )}
                {selected.cid10 && (
                  <p className="text-xs text-muted-foreground pt-2">CID-10: {selected.cid10}</p>
                )}

                <div className="pt-3 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void handleDownload(selected)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">{title}</p>
      <div className="bg-muted/50 rounded-lg p-3">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
