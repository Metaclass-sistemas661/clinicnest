import { useState } from "react";
import {
  FileText,
  Pill,
  ClipboardList,
  FileSignature,
  ArrowRightLeft,
  Plus,
  ChevronDown,
  Printer,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface DocumentContext {
  patientId: string;
  clientName: string;
  clientCpf?: string;
  clientBirthDate?: string;
  appointmentId?: string;
  medicalRecordId?: string;
  professionalId?: string;
  professionalName?: string;
  diagnosis?: string;
  cid10?: string;
}

export interface GeneratedDocument {
  id: string;
  type: "receita" | "atestado" | "laudo" | "encaminhamento";
  title: string;
  createdAt: string;
  status: "draft" | "signed" | "printed";
}

interface QuickDocumentActionsProps {
  context: DocumentContext;
  generatedDocuments?: GeneratedDocument[];
  onGenerateReceita?: (context: DocumentContext) => void;
  onGenerateAtestado?: (context: DocumentContext) => void;
  onGenerateLaudo?: (context: DocumentContext) => void;
  onGenerateEncaminhamento?: (context: DocumentContext) => void;
  onViewDocument?: (doc: GeneratedDocument) => void;
  onPrintDocument?: (doc: GeneratedDocument) => void;
}

const DOCUMENT_TYPES = {
  receita: { label: "Receita", icon: Pill, color: "text-blue-600" },
  atestado: { label: "Atestado", icon: FileSignature, color: "text-green-600" },
  laudo: { label: "Laudo", icon: ClipboardList, color: "text-purple-600" },
  encaminhamento: { label: "Encaminhamento", icon: ArrowRightLeft, color: "text-orange-600" },
} as const;

export function QuickDocumentActions({
  context,
  generatedDocuments = [],
  onGenerateReceita,
  onGenerateAtestado,
  onGenerateLaudo,
  onGenerateEncaminhamento,
  onViewDocument,
  onPrintDocument,
}: QuickDocumentActionsProps) {
  const [showDocuments, setShowDocuments] = useState(false);

  const documentCount = generatedDocuments.length;

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Gerar Documento
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => onGenerateReceita?.(context)}
              className="gap-2"
            >
              <Pill className="h-4 w-4 text-blue-600" />
              <span>Receita Médica</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onGenerateAtestado?.(context)}
              className="gap-2"
            >
              <FileSignature className="h-4 w-4 text-green-600" />
              <span>Atestado Médico</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onGenerateLaudo?.(context)}
              className="gap-2"
            >
              <ClipboardList className="h-4 w-4 text-purple-600" />
              <span>Laudo Médico</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onGenerateEncaminhamento?.(context)}
              className="gap-2"
            >
              <ArrowRightLeft className="h-4 w-4 text-orange-600" />
              <span>Encaminhamento</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {documentCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDocuments(true)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span>Documentos</span>
            <Badge variant="secondary">{documentCount}</Badge>
          </Button>
        )}
      </div>

      <Sheet open={showDocuments} onOpenChange={setShowDocuments}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Documentos Gerados</SheetTitle>
            <SheetDescription>
              Documentos criados para {context.clientName}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {generatedDocuments.length > 0 ? (
              generatedDocuments.map((doc) => {
                const docType = DOCUMENT_TYPES[doc.type];
                const Icon = docType.icon;

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${docType.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={
                          doc.status === "signed"
                            ? "default"
                            : doc.status === "printed"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {doc.status === "signed"
                          ? "Assinado"
                          : doc.status === "printed"
                          ? "Impresso"
                          : "Rascunho"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewDocument?.(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPrintDocument?.(doc)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum documento gerado ainda</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
