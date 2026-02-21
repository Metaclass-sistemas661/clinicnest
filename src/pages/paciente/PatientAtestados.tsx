import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardList, RefreshCw, Building2, Stethoscope, Calendar, Clock } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Certificate {
  id: string;
  certificate_type: string;
  issued_at: string;
  days_off: number | null;
  start_date: string | null;
  end_date: string | null;
  cid_code: string | null;
  content: string;
  notes: string | null;
  professional_name: string;
  clinic_name: string;
}

function typeLabel(t: string) {
  switch (t) {
    case "atestado":                  return "Atestado";
    case "declaracao_comparecimento": return "Declaração de Comparecimento";
    case "laudo":                     return "Laudo";
    case "relatorio":                 return "Relatório";
    default:                          return t;
  }
}

function typeBadgeVariant(t: string) {
  switch (t) {
    case "atestado": return "default" as const;
    case "laudo":    return "secondary" as const;
    default:         return "outline" as const;
  }
}

export default function PatientAtestados() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { void fetchCertificates(); }, []);

  const fetchCertificates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_certificates");
      if (error) throw error;
      setCertificates((data ?? []) as Certificate[]);
    } catch (err) {
      logger.error("PatientAtestados fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PatientLayout
      title="Atestados"
      subtitle="Atestados e declarações médicas"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchCertificates()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
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
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum atestado disponível"
          description="Quando seu médico emitir um atestado, ele aparecerá aqui."
        />
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <Card key={cert.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-teal-500" />
                    {typeLabel(cert.certificate_type)}
                  </CardTitle>
                  <Badge variant={typeBadgeVariant(cert.certificate_type)}>
                    {typeLabel(cert.certificate_type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(cert.issued_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                  {cert.professional_name && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5" />
                      <span>{cert.professional_name}</span>
                    </div>
                  )}
                  {cert.clinic_name && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{cert.clinic_name}</span>
                    </div>
                  )}
                </div>

                {cert.days_off != null && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{cert.days_off} dia(s) de afastamento</span>
                    {cert.start_date && cert.end_date && (
                      <span>
                        · {format(new Date(cert.start_date), "dd/MM", { locale: ptBR })} a{" "}
                        {format(new Date(cert.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                )}

                {cert.cid_code && (
                  <p className="text-xs text-muted-foreground">CID: {cert.cid_code}</p>
                )}

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-foreground whitespace-pre-line">{cert.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PatientLayout>
  );
}
