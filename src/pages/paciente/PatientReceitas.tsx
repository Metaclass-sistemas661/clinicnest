import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pill, RefreshCw, Building2, Stethoscope, Calendar, Clock, Download, Send } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { receitasBanners } from "@/components/patient/patientBannerData";
import { generatePrescriptionPdf } from "@/utils/patientDocumentPdf";

interface Prescription {
  id: string;
  prescription_type: string;
  issued_at: string;
  validity_days: number | null;
  expires_at: string | null;
  medications: string;
  instructions: string;
  status: string;
  professional_name: string;
  clinic_name: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "ativo":    return { label: "Ativa", variant: "default" as const };
    case "expirado": return { label: "Expirada", variant: "secondary" as const };
    case "cancelado": return { label: "Cancelada", variant: "destructive" as const };
    default:         return { label: status, variant: "outline" as const };
  }
}

function typeLabel(t: string) {
  switch (t) {
    case "simples":        return "Simples";
    case "especial_b":     return "Especial B";
    case "especial_a":     return "Especial A";
    case "antimicrobiano": return "Antimicrobiano";
    default:               return t;
  }
}

export default function PatientReceitas() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { void fetchPrescriptions(); }, []);

  const fetchPrescriptions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_prescriptions");
      if (error) throw error;
      setPrescriptions((data ?? []) as Prescription[]);
    } catch (err) {
      logger.error("PatientReceitas fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PatientLayout
      title="Receitas"
      subtitle="Receituários digitais emitidos para você"
      actions={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate("/paciente/renovar-receita")} className="gap-1.5">
            <Send className="h-4 w-4" />
            Solicitar Renovação
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchPrescriptions()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      }
    >
      <PatientBannerCarousel slides={receitasBanners} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="py-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-64" /></CardContent></Card>
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="Nenhuma receita disponível"
          description="Quando seu médico emitir uma receita digital, ela aparecerá aqui."
        />
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => {
            const { label, variant } = statusBadge(rx.status);
            return (
              <Card key={rx.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4 text-teal-500" />
                      Receita {typeLabel(rx.prescription_type)}
                    </CardTitle>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(rx.issued_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    {rx.professional_name && (
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>{rx.professional_name}</span>
                      </div>
                    )}
                    {rx.clinic_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{rx.clinic_name}</span>
                      </div>
                    )}
                  </div>
                  {rx.validity_days && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Validade: {rx.validity_days} dias</span>
                      {rx.expires_at && <span>· Expira em {format(new Date(rx.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>}
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Medicamentos:</p>
                    <p className="text-sm text-foreground whitespace-pre-line">{rx.medications}</p>
                    {rx.instructions && (
                      <>
                        <p className="text-sm font-medium text-foreground mt-2">Instruções:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{rx.instructions}</p>
                      </>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => generatePrescriptionPdf(rx)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar PDF
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PatientLayout>
  );
}
