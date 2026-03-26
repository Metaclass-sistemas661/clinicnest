import { useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, X, FileText, FileCode, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

type DocType = "pdf" | "html" | "dicom" | "image";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL do documento (PDF, imagem) ou conteúdo HTML inline */
  src: string;
  /** Tipo do documento */
  type?: DocType;
  /** Título exibido no header */
  title?: string;
  /** Subtítulo (ex: data, tipo de documento) */
  subtitle?: string;
  className?: string;
}

function detectType(src: string): DocType {
  const lower = src.toLowerCase();
  if (lower.endsWith(".pdf") || lower.includes("application/pdf") || lower.startsWith("data:application/pdf")) return "pdf";
  if (lower.endsWith(".dcm") || lower.includes("dicom")) return "dicom";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.startsWith("data:image/")) return "image";
  if (lower.startsWith("<") || lower.includes("<!doctype") || lower.includes("<html")) return "html";
  return "pdf";
}

const typeLabels: Record<DocType, { label: string; icon: typeof FileText }> = {
  pdf: { label: "PDF", icon: FileText },
  html: { label: "HTML", icon: FileCode },
  dicom: { label: "DICOM", icon: Scan },
  image: { label: "Imagem", icon: FileText },
};

export function DocumentViewer({
  open,
  onOpenChange,
  src,
  type,
  title = "Visualizar Documento",
  subtitle,
  className,
}: DocumentViewerProps) {
  const resolvedType = type ?? detectType(src);
  const { label, icon: TypeIcon } = typeLabels[resolvedType];
  const [iframeError, setIframeError] = useState(false);

  const handleDownload = () => {
    if (resolvedType === "html") {
      const blob = new Blob([src], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (resolvedType !== "dicom") {
      window.open(src, "_blank");
    }
  };

  const handlePrint = () => {
    if (resolvedType === "html") {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(sanitizeHtml(src));
        w.document.close();
        w.focus();
        w.print();
      }
    } else if (resolvedType === "pdf" || resolvedType === "image") {
      const w = window.open(src, "_blank");
      if (w) {
        w.addEventListener("load", () => w.print());
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0", className)}>
        {/* Toolbar */}
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <TypeIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{label}</Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {resolvedType !== "dicom" && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint} title="Imprimir">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download">
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          {resolvedType === "pdf" && (
            <iframe
              src={`${src}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              title={title}
              onError={() => setIframeError(true)}
            />
          )}

          {resolvedType === "html" && (
            <iframe
              srcDoc={src}
              className="w-full h-full border-0 bg-white"
              title={title}
              sandbox="allow-same-origin allow-popups"
            />
          )}

          {resolvedType === "image" && (
            <div className="flex items-center justify-center h-full p-4">
              <img src={src} alt={title} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
            </div>
          )}

          {resolvedType === "dicom" && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Scan className="h-16 w-16 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">Visualizador DICOM</p>
                <p className="text-xs">Suporte a imagens DICOM será integrado em breve.</p>
                <p className="text-xs mt-1">Formatos suportados: .dcm, séries CT/MR/US</p>
              </div>
            </div>
          )}

          {iframeError && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Não foi possível carregar o documento.</p>
              <Button variant="outline" size="sm" onClick={() => window.open(src, "_blank")}>
                Abrir em nova aba
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
