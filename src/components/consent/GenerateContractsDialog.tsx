import { useState, useEffect, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildVariablesFromClientAndTenant,
  replaceVariables,
} from "@/lib/consent-variables";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  CheckCircle2,
  Eye,
  Download,
  ShieldCheck,
  Printer,
} from "lucide-react";
import type { ConsentTemplate, Patient } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onGenerated?: () => void;
}

interface GeneratedDoc {
  template: ConsentTemplate;
  html: string;
}

export function GenerateContractsDialog({ open, onOpenChange, patient, onGenerated }: Props) {
  const { tenant } = useAuth();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDoc[]>([]);
  const [previewDoc, setPreviewDoc] = useState<GeneratedDoc | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!patient?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("consent_templates")
        .select("*")
        .eq("tenant_id", patient.tenant_id)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      setTemplates((data as unknown as ConsentTemplate[]) ?? []);
    } catch (err) {
      logger.error("[GenerateContracts] fetch templates", err);
      toast.error("Erro ao carregar modelos de termos");
    } finally {
      setIsLoading(false);
    }
  }, [patient?.tenant_id]);

  useEffect(() => {
    if (open) {
      setGenerated([]);
      setPreviewDoc(null);
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const vars = buildVariablesFromClientAndTenant(patient, tenant);
      const docs: GeneratedDoc[] = templates.map((t) => ({
        template: t,
        html: replaceVariables(t.body_html, vars),
      }));
      setGenerated(docs);
      toast.success(`${docs.length} documento(s) gerado(s) com sucesso!`);
      onGenerated?.();
    } catch (err) {
      logger.error("[GenerateContracts] generate", err);
      toast.error("Erro ao gerar documentos");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = (doc: GeneratedDoc) => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${doc.template.title} - ${patient.name}</title>
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
    h2 { text-align: center; margin-bottom: 30px; }
    h3 { margin-top: 25px; color: #222; }
    ul { padding-left: 25px; }
    li { margin-bottom: 6px; }
    p { margin: 10px 0; text-align: justify; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>${doc.html}</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => {
        w.print();
      });
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleDownload = (doc: GeneratedDoc) => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${doc.template.title} - ${patient.name}</title>
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
    h2 { text-align: center; margin-bottom: 30px; }
    h3 { margin-top: 25px; color: #222; }
    ul { padding-left: 25px; }
    li { margin-bottom: 6px; }
    p { margin: 10px 0; text-align: justify; }
  </style>
</head>
<body>${doc.html}</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.template.slug}-${patient.name.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={open && !previewDoc} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Gerar Contrato e Termos
            </DialogTitle>
            <DialogDescription>
              Gerar todos os documentos (contratos e termos de consentimento) para <strong>{patient.name}</strong> com os dados preenchidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p>Nenhum modelo de termo ativo.</p>
              <p className="text-xs mt-1">Crie modelos em <strong>Termos e Consentimentos</strong> primeiro.</p>
            </div>
          ) : generated.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                Serão gerados <strong>{templates.length}</strong> documento(s) com os dados de <strong>{patient.name}</strong>:
              </div>
              <div className="space-y-2">
                {templates.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground">{t.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {t.is_required && (
                          <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Obrigatório</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  variant="gradient"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                  ) : (
                    <><FileText className="mr-2 h-4 w-4" />Gerar {templates.length} Documento(s)</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{generated.length} documento(s) gerado(s) com sucesso! Agora você pode visualizar, imprimir ou baixar.</span>
              </div>

              <div className="space-y-2">
                {generated.map((doc) => (
                  <Card key={doc.template.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900 flex-shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.template.title}</p>
                          <p className="text-[11px] text-muted-foreground">Dados preenchidos automaticamente</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewDoc(doc)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(doc)} title="Imprimir">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)} title="Baixar">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Separator />

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {previewDoc?.template.title}
            </DialogTitle>
            <DialogDescription>
              Documento gerado para {patient.name}
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="py-4">
              <div
                className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewDoc.html) }}
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => handlePrint(previewDoc)}>
                  <Printer className="mr-2 h-4 w-4" />Imprimir
                </Button>
                <Button variant="outline" onClick={() => handleDownload(previewDoc)}>
                  <Download className="mr-2 h-4 w-4" />Baixar
                </Button>
                <Button onClick={() => setPreviewDoc(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
