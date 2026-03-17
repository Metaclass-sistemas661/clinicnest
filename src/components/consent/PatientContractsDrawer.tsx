import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PatientConsent, ConsentTemplate } from "@/types/database";
import { useConsentRealtime } from "@/hooks/useConsentRealtime";
import {
  ShieldCheck,
  FileSignature,
  MessageCircle,
  Clock,
  Camera,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  FileText,
  Inbox,
} from "lucide-react";

interface PatientContractsDrawerProps {
  patientId: string;
  patientName: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateContracts?: () => void;
  onSendLink?: () => void;
}

interface ConsentWithTemplate extends PatientConsent {
  template_title: string;
  template_slug: string;
  signature_method?: string | null;
  manual_signature_path?: string | null;
  sealed_pdf_path?: string | null;
  sealed_at?: string | null;
}

export function PatientContractsDrawer({
  patientId,
  patientName,
  tenantId,
  open,
  onOpenChange,
  onGenerateContracts,
  onSendLink,
}: PatientContractsDrawerProps) {
  const [consents, setConsents] = useState<ConsentWithTemplate[]>([]);
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Realtime: recarrega quando um consent é selado
  useConsentRealtime({
    tenantId,
    enabled: open,
    onSealed: () => fetchData(),
    showToast: true,
  });

  const fetchData = useCallback(async () => {
    if (!patientId || !tenantId) return;
    setIsLoading(true);
    try {
      const [consentsRes, templatesRes] = await Promise.all([
        (supabase as any)
          .from("patient_consents")
          .select("*")
          .eq("patient_id", patientId)
          .order("signed_at", { ascending: false }),
        (supabase as any)
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
      logger.error("[PatientContractsDrawer] fetch error", err);
      toast.error("Erro ao carregar termos do paciente");
    } finally {
      setIsLoading(false);
    }
  }, [patientId, tenantId]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const signedTemplateIds = new Set(consents.map((c) => c.template_id));
  const pendingTemplates = templates.filter((t) => t.is_required && !signedTemplateIds.has(t.id));
  const signedCount = consents.length;
  const pendingCount = pendingTemplates.length;

  const handleExportPdf = (consent: ConsentWithTemplate) => {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante - ${consent.template_title}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333}
    h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:10px}
    .meta{background:#f5f5f5;padding:15px;border-radius:8px;margin:20px 0}
    .meta p{margin:5px 0;font-size:13px}
    .meta strong{display:inline-block;width:140px}
    .term-content{border:1px solid #ddd;padding:20px;border-radius:8px;margin:20px 0}
    .stamp{background:#e8f5e9;border:1px solid #4caf50;padding:10px;border-radius:8px;text-align:center;color:#2e7d32;font-weight:bold;margin:20px 0}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:11px;color:#888}
  </style>
</head>
<body>
  <h1>Comprovante de Assinatura Digital</h1>
  <div class="stamp">TERMO ASSINADO DIGITALMENTE</div>
  <div class="meta">
    <p><strong>Paciente:</strong> ${patientName}</p>
    <p><strong>Termo:</strong> ${consent.template_title}</p>
    <p><strong>Data/Hora:</strong> ${format(new Date(consent.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
    <p><strong>Método:</strong> ${consent.signature_method === "manual" ? "Assinatura Manual" : "Reconhecimento Facial"}</p>
    <p><strong>IP:</strong> ${consent.ip_address || "N/A"}</p>
    <p><strong>ID:</strong> ${consent.id}</p>
  </div>
  <h2>Conteúdo do Termo</h2>
  <div class="term-content">${consent.template_snapshot_html || "<p>Conteúdo não disponível</p>"}</div>
  <div class="footer">
    <p>Documento gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
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

  const getMethodIcon = (method?: string | null) => {
    return method === "manual"
      ? <PenTool className="h-3 w-3" />
      : <Camera className="h-3 w-3" />;
  };

  const getMethodLabel = (method?: string | null) => {
    return method === "manual" ? "Assinatura manual" : "Reconhecimento facial";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Termos e Contratos
          </SheetTitle>
          <SheetDescription>{patientName}</SheetDescription>
        </SheetHeader>

        {/* Quick actions */}
        <div className="flex gap-2 mb-4">
          {onGenerateContracts && (
            <Button size="sm" variant="gradient" className="flex-1" onClick={onGenerateContracts}>
              <FileSignature className="mr-2 h-4 w-4" />
              Gerar Contrato
            </Button>
          )}
          {onSendLink && (
            <Button size="sm" variant="outline" className="flex-1" onClick={onSendLink}>
              <MessageCircle className="mr-2 h-4 w-4 text-success" />
              Enviar Link
            </Button>
          )}
        </div>

        <Separator className="mb-4" />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-6 w-32 mt-4" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary badges */}
            <div className="flex gap-2">
              {signedCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {signedCount} assinado{signedCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
                  <AlertCircle className="h-3 w-3" />
                  {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {signedCount === 0 && pendingCount === 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Inbox className="h-3 w-3" />
                  Nenhum modelo ativo
                </Badge>
              )}
            </div>

            {/* Pending section */}
            {pendingCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Pendentes ({pendingCount})
                </h4>
                {pendingTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900 flex-shrink-0">
                      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground">Aguardando assinatura do paciente</p>
                    </div>
                    {t.is_required && (
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive shrink-0">
                        Obrigatório
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Signed section */}
            {signedCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Assinados ({signedCount})
                </h4>
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.template_title}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(c.signed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1 text-success">
                          {getMethodIcon(c.signature_method)}
                          {getMethodLabel(c.signature_method)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalhes">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleExportPdf(c)}
                        title="Exportar comprovante"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {signedCount === 0 && pendingCount === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nenhum termo encontrado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gere contratos e termos para este paciente assinar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
