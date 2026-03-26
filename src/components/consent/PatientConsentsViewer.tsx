import { useEffect, useState, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { PatientConsent, ConsentTemplate } from "@/types/database";
import {
  ShieldCheck,
  FileText,
  Camera,
  Clock,
  Globe,
  Monitor,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientConsentsViewerProps {
  patientId: string;
  patientName: string;
  tenantId: string;
}

interface ConsentWithTemplate extends PatientConsent {
  template_title?: string;
  template_slug?: string;
}

export function PatientConsentsViewer({ patientId, patientName, tenantId }: PatientConsentsViewerProps) {
  const [consents, setConsents] = useState<ConsentWithTemplate[]>([]);
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewConsent, setViewConsent] = useState<ConsentWithTemplate | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [consentsRes, templatesRes] = await Promise.all([
        supabase
          .from("patient_consents")
          .select("*")
          .eq("patient_id", patientId)
          .order("signed_at", { ascending: false }),
        supabase
          .from("consent_templates")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      if (consentsRes.error) throw consentsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const tMap = new Map<string, ConsentTemplate>();
      ((templatesRes.data ?? []) as unknown as ConsentTemplate[]).forEach((t) => tMap.set(t.id, t));

      const enriched: ConsentWithTemplate[] = ((consentsRes.data ?? []) as unknown as ConsentWithTemplate[]).map((c) => ({
        ...c,
        template_title: tMap.get(c.template_id)?.title ?? "Termo removido",
        template_slug: tMap.get(c.template_id)?.slug ?? "",
      }));

      setConsents(enriched);
      setTemplates((templatesRes.data ?? []) as unknown as ConsentTemplate[]);
    } catch (err) {
      logger.error("[PatientConsentsViewer] fetch error", err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load photo when viewing a consent
  useEffect(() => {
    if (!viewConsent?.facial_photo_path) {
      setViewPhotoUrl(null);
      return;
    }
    const loadPhoto = async () => {
      const { data } = await supabase.storage
        .from("consent-photos")
        .createSignedUrl(viewConsent.facial_photo_path!, 300); // 5 min
      setViewPhotoUrl(data?.signedUrl ?? null);
    };
    loadPhoto();
  }, [viewConsent]);

  const signedTemplateIds = new Set(consents.map((c) => c.template_id));
  const pendingTemplates = templates.filter((t) => t.is_required && !signedTemplateIds.has(t.id));

  const handleExportPdf = (consent: ConsentWithTemplate) => {
    // Generate a printable HTML document with all legal proof
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Assinatura - ${consent.template_title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 16px; color: #555; margin-top: 30px; }
    .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .meta p { margin: 5px 0; font-size: 13px; }
    .meta strong { display: inline-block; width: 140px; }
    .term-content { border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .photo-section { text-align: center; margin: 20px 0; }
    .photo-section img { max-width: 200px; border-radius: 8px; border: 2px solid #ddd; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
    .stamp { background: #e8f5e9; border: 1px solid #4caf50; padding: 10px 15px; border-radius: 8px; text-align: center; color: #2e7d32; font-weight: bold; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>📋 Comprovante de Assinatura Digital</h1>
  
  <div class="stamp">✅ TERMO ASSINADO DIGITALMENTE COM RECONHECIMENTO FACIAL</div>

  <div class="meta">
    <p><strong>Paciente:</strong> ${patientName}</p>
    <p><strong>Termo:</strong> ${consent.template_title}</p>
    <p><strong>Data/Hora:</strong> ${format(new Date(consent.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
    <p><strong>Endereço IP:</strong> ${consent.ip_address || "Não registrado"}</p>
    <p><strong>Navegador:</strong> ${consent.user_agent || "Não registrado"}</p>
    <p><strong>ID da Assinatura:</strong> ${consent.id}</p>
  </div>

  <h2>Conteúdo do Termo (versão assinada)</h2>
  <div class="term-content">
    ${consent.template_snapshot_html || "<p>Conteúdo não disponível</p>"}
  </div>

  <div class="footer">
    <p>Este documento é um comprovante digital de assinatura com reconhecimento facial.</p>
    <p>A foto facial do paciente está armazenada no sistema e pode ser consultada a qualquer momento.</p>
    <p>Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-${consent.template_slug || "termo"}-${patientName.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Termos e Consentimentos
        </h3>
        {pendingTemplates.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {pendingTemplates.length} pendente(s)
          </Badge>
        )}
      </div>

      {/* Pending */}
      {pendingTemplates.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  Termos pendentes de assinatura
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pendingTemplates.map((t) => (
                    <Badge key={t.id} variant="outline" className="text-[10px] border-amber-300">
                      {t.title}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 mt-1">
                  O paciente será solicitado a assinar ao acessar o portal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signed consents */}
      {consents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum termo assinado por este paciente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consents.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900 flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.template_title}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(c.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {c.facial_photo_path && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Camera className="h-3 w-3" />
                            Com foto facial
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewConsent(c)} title="Ver detalhes">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExportPdf(c)} title="Exportar comprovante">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!viewConsent} onOpenChange={() => setViewConsent(null)}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Comprovante de Assinatura
            </DialogTitle>
            <DialogDescription>
              Detalhes da assinatura digital com reconhecimento facial
            </DialogDescription>
          </DialogHeader>

          {viewConsent && (
            <div className="space-y-5 py-2">
              {/* Metadata */}
              <Card className="bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="py-4 px-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Termo</p>
                        <p className="font-medium">{viewConsent.template_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Data/Hora</p>
                        <p className="font-medium">
                          {format(new Date(viewConsent.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Endereço IP</p>
                        <p className="font-medium font-mono text-xs">{viewConsent.ip_address || "Não registrado"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Navegador</p>
                        <p className="font-medium text-xs truncate max-w-[250px]">{viewConsent.user_agent || "Não registrado"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Facial photo */}
              {viewConsent.facial_photo_path && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Foto Facial (momento da assinatura)
                  </h4>
                  <div className="flex justify-center">
                    {viewPhotoUrl ? (
                      <img
                        src={viewPhotoUrl}
                        alt="Foto facial do paciente no momento da assinatura"
                        className="max-w-[200px] rounded-xl border-2 border-green-200 dark:border-green-800 shadow-md"
                      />
                    ) : (
                      <div className="w-[200px] h-[150px] bg-muted rounded-xl flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Term snapshot */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Conteúdo do Termo (versão assinada)
                </h4>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card max-h-[40vh] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewConsent.template_snapshot_html || "<p>Conteúdo não disponível</p>") }}
                />
              </div>

              {/* Export */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExportPdf(viewConsent)}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Comprovante
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
