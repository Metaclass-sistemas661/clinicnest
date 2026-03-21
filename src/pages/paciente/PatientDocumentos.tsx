import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  RefreshCw,
  Building2,
  Stethoscope,
  Calendar,
  Download,
  PenTool,
  CheckCircle2,
  ClipboardList,
  Pill,
  Loader2,
  Files,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SignatureMethodSelector, type SignatureMethod } from "@/components/signature/SignatureMethodSelector";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { FacialCapture } from "@/components/consent/FacialCapture";
import {
  generateCertificatePdf,
  generatePrescriptionPdf,
  generateExamPdf,
  generateMedicalReportPdf,
} from "@/utils/patientDocumentPdf";

/* ── Types ── */
type DocCategory = "certificate" | "prescription" | "exam" | "report";

interface UnifiedDocument {
  id: string;
  category: DocCategory;
  title: string;
  subtitle: string;
  date: string;
  professional_name: string;
  clinic_name: string;
  status: string;
  signed: boolean;
  raw: any; // original data for PDF generation
}

/* ── Helpers ── */
const categoryMeta: Record<DocCategory, { label: string; icon: React.ElementType; color: string }> = {
  certificate: { label: "Atestado", icon: ClipboardList, color: "text-amber-500" },
  prescription: { label: "Receita", icon: Pill, color: "text-teal-500" },
  exam: { label: "Exame", icon: FileText, color: "text-blue-500" },
  report: { label: "Laudo", icon: Stethoscope, color: "text-purple-500" },
};

function categoryBadgeVariant(cat: DocCategory) {
  switch (cat) {
    case "certificate": return "secondary" as const;
    case "prescription": return "default" as const;
    case "exam": return "outline" as const;
    case "report": return "secondary" as const;
  }
}

/* ── Component ── */
export default function PatientDocumentos() {
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [signatures, setSignatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Signature dialog state
  const [signTarget, setSignTarget] = useState<UnifiedDocument | null>(null);
  const [signStep, setSignStep] = useState<"choose" | "capture">("choose");
  const [signMethod, setSignMethod] = useState<SignatureMethod | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [manualDataUrl, setManualDataUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [patientName, setPatientName] = useState("Paciente");
  const [clientId, setClientId] = useState<string | null>(null);

  const resolvePatient = useCallback(async () => {
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return;
      const { data } = await supabasePatient
        .from("patients")
        .select("id, name")
        .eq("email", user.email!)
        .limit(1)
        .maybeSingle();
      if (data) {
        setClientId(data.id);
        setPatientName(data.name || "Paciente");
      }
    } catch {
      // silent
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [certsRes, rxRes, examsRes, reportsRes, sigsRes] = await Promise.all([
        (supabasePatient as any).rpc("get_patient_certificates"),
        (supabasePatient as any).rpc("get_patient_prescriptions"),
        (supabasePatient as any).rpc("get_patient_exam_results"),
        (supabasePatient as any).rpc("get_patient_medical_reports"),
        (supabasePatient as any).rpc("get_patient_document_signatures"),
      ]);

      const docs: UnifiedDocument[] = [];

      // Certificates
      for (const c of (certsRes.data ?? []) as any[]) {
        docs.push({
          id: c.id,
          category: "certificate",
          title: certTypeLabel(c.certificate_type),
          subtitle: c.content?.substring(0, 100) || "",
          date: c.issued_at,
          professional_name: c.professional_name ?? "",
          clinic_name: c.clinic_name ?? "",
          status: "emitido",
          signed: false,
          raw: c,
        });
      }

      // Prescriptions
      for (const rx of (rxRes.data ?? []) as any[]) {
        docs.push({
          id: rx.id,
          category: "prescription",
          title: `Receita ${rxTypeLabel(rx.prescription_type)}`,
          subtitle: rx.medications?.substring(0, 100) || "",
          date: rx.issued_at,
          professional_name: rx.professional_name ?? "",
          clinic_name: rx.clinic_name ?? "",
          status: rx.status || "ativo",
          signed: false,
          raw: rx,
        });
      }

      // Exams
      for (const ex of (examsRes.data ?? []) as any[]) {
        docs.push({
          id: ex.id,
          category: "exam",
          title: ex.exam_name || ex.exam_type || "Exame",
          subtitle: ex.interpretation?.substring(0, 100) || "",
          date: ex.performed_at || ex.created_at || "",
          professional_name: ex.requested_by_name ?? "",
          clinic_name: ex.clinic_name ?? "",
          status: ex.status || "pendente",
          signed: false,
          raw: ex,
        });
      }

      // Medical reports
      for (const r of (reportsRes.data ?? []) as any[]) {
        docs.push({
          id: r.id,
          category: "report",
          title: reportTypeLabel(r.tipo),
          subtitle: r.conclusao?.substring(0, 100) || r.diagnostico?.substring(0, 100) || "",
          date: r.created_at,
          professional_name: r.professional_name ?? "",
          clinic_name: r.clinic_name ?? "",
          status: r.status || "finalizado",
          signed: false,
          raw: r,
        });
      }

      // Sort by date desc
      docs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      // Mark signatures
      const sigSet = new Set<string>();
      if (sigsRes.data && Array.isArray(sigsRes.data)) {
        for (const sig of sigsRes.data as any[]) {
          sigSet.add(`${sig.document_type}:${sig.document_id}`);
        }
      }
      setSignatures(sigSet);

      // Update signed flags
      for (const doc of docs) {
        doc.signed = sigSet.has(`${doc.category}:${doc.id}`);
      }

      setDocuments(docs);
    } catch (err) {
      logger.error("PatientDocumentos fetchAll:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void resolvePatient();
    void fetchAll();
  }, [resolvePatient, fetchAll]);

  const filtered = activeTab === "all"
    ? documents
    : documents.filter((d) => d.category === activeTab);

  // ── Signature flow ──

  const openSignDialog = (doc: UnifiedDocument) => {
    setSignTarget(doc);
    setSignStep("choose");
    setSignMethod(null);
    setCapturedBlob(null);
    setManualDataUrl(null);
  };

  const closeSignDialog = () => {
    setSignTarget(null);
    setSignStep("choose");
    setSignMethod(null);
    setCapturedBlob(null);
    setManualDataUrl(null);
  };

  const handleMethodSelect = (method: SignatureMethod) => {
    setSignMethod(method);
    setSignStep("capture");
  };

  const handleSubmitSignature = async () => {
    if (!signTarget || !clientId) return;

    if (signMethod === "facial" && !capturedBlob) {
      toast.error("Capture sua foto facial antes de assinar");
      return;
    }
    if (signMethod === "manual" && !manualDataUrl) {
      toast.error("Desenhe sua assinatura antes de confirmar");
      return;
    }

    setIsSigning(true);
    try {
      let signaturePath: string | null = null;
      let facialPath: string | null = null;

      if (signMethod === "facial" && capturedBlob) {
        const fileName = `${clientId}/${signTarget.category}_${signTarget.id}_${Date.now()}.jpg`;
        const { error } = await supabasePatient.storage
          .from("document-signatures")
          .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        facialPath = fileName;
      } else if (signMethod === "manual" && manualDataUrl) {
        const res = await fetch(manualDataUrl);
        const blob = await res.blob();
        const fileName = `${clientId}/${signTarget.category}_${signTarget.id}_${Date.now()}.png`;
        const { error } = await supabasePatient.storage
          .from("document-signatures")
          .upload(fileName, blob, { contentType: "image/png", upsert: false });
        if (error) throw error;
        signaturePath = fileName;
      }

      const { data, error } = await (supabasePatient as any).rpc("patient_sign_document", {
        p_document_type: signTarget.category,
        p_document_id: signTarget.id,
        p_signature_method: signMethod,
        p_signature_path: signaturePath,
        p_facial_photo_path: facialPath,
        p_user_agent: navigator.userAgent,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success) {
        toast.success(result.message || "Documento assinado com sucesso!");
        setSignatures((prev) => new Set(prev).add(`${signTarget.category}:${signTarget.id}`));
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === signTarget.id && d.category === signTarget.category
              ? { ...d, signed: true }
              : d,
          ),
        );
      } else {
        toast.error(result?.message || "Erro ao assinar documento");
      }

      closeSignDialog();
    } catch (err: any) {
      logger.error("PatientDocumentos sign:", err);
      toast.error(err?.message || "Erro ao assinar documento");
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadPdf = (doc: UnifiedDocument) => {
    switch (doc.category) {
      case "certificate":
        void generateCertificatePdf(doc.raw);
        break;
      case "prescription":
        void generatePrescriptionPdf(doc.raw);
        break;
      case "exam":
        void generateExamPdf(doc.raw);
        break;
      case "report":
        void generateMedicalReportPdf(doc.raw);
        break;
    }
  };

  return (
    <PatientLayout
      title="Documentos"
      subtitle="Todos os seus documentos clínicos em um só lugar"
      actions={
        <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            Todos ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="certificate">
            Atestados ({documents.filter((d) => d.category === "certificate").length})
          </TabsTrigger>
          <TabsTrigger value="prescription">
            Receitas ({documents.filter((d) => d.category === "prescription").length})
          </TabsTrigger>
          <TabsTrigger value="exam">
            Exames ({documents.filter((d) => d.category === "exam").length})
          </TabsTrigger>
          <TabsTrigger value="report">
            Laudos ({documents.filter((d) => d.category === "report").length})
          </TabsTrigger>
        </TabsList>

        {/* All tabs share the same content renderer */}
        {["all", "certificate", "prescription", "exam", "report"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
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
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Files}
                title="Nenhum documento encontrado"
                description="Quando a clínica emitir documentos para você, eles aparecerão aqui."
              />
            ) : (
              <div className="space-y-4">
                {filtered.map((doc) => {
                  const meta = categoryMeta[doc.category];
                  const Icon = meta.icon;
                  return (
                    <Card key={`${doc.category}-${doc.id}`} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            {doc.title}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={categoryBadgeVariant(doc.category)}>
                              {meta.label}
                            </Badge>
                            {doc.signed && (
                              <Badge variant="default" className="bg-green-600 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Assinado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          {doc.date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{format(new Date(doc.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                          )}
                          {doc.professional_name && (
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-3.5 w-3.5" />
                              <span>{doc.professional_name}</span>
                            </div>
                          )}
                          {doc.clinic_name && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{doc.clinic_name}</span>
                            </div>
                          )}
                        </div>

                        {doc.subtitle && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {doc.subtitle}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => handleDownloadPdf(doc)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Baixar PDF
                          </Button>
                          {!doc.signed && (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => openSignDialog(doc)}
                            >
                              <PenTool className="h-3.5 w-3.5" />
                              Assinar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Signature Dialog */}
      <Dialog open={!!signTarget} onOpenChange={(open) => !open && closeSignDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-teal-500" />
              Assinar Documento
            </DialogTitle>
            <DialogDescription>
              {signTarget && (
                <>
                  {categoryMeta[signTarget.category].label}: <strong>{signTarget.title}</strong>
                  {signTarget.date && (
                    <> — {format(new Date(signTarget.date), "dd/MM/yyyy", { locale: ptBR })}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {signStep === "choose" && (
            <SignatureMethodSelector
              onSelect={handleMethodSelect}
              disabled={isSigning}
            />
          )}

          {signStep === "capture" && signMethod === "facial" && (
            <div className="space-y-4">
              <FacialCapture
                onCapture={(blob: Blob) => setCapturedBlob(blob)}
                disabled={isSigning}
              />
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSignStep("choose")}>
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmitSignature}
                  disabled={!capturedBlob || isSigning}
                  className="gap-2"
                >
                  {isSigning && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar Assinatura
                </Button>
              </div>
            </div>
          )}

          {signStep === "capture" && signMethod === "manual" && (
            <div className="space-y-4">
              <SignatureCanvas
                patientName={patientName}
                onComplete={(dataUrl) => setManualDataUrl(dataUrl)}
                onClear={() => setManualDataUrl(null)}
                disabled={isSigning}
              />
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSignStep("choose")}>
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmitSignature}
                  disabled={!manualDataUrl || isSigning}
                  className="gap-2"
                >
                  {isSigning && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar Assinatura
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}

/* ── Label helpers ── */

function certTypeLabel(t: string) {
  switch (t) {
    case "atestado": return "Atestado Médico";
    case "declaracao_comparecimento": return "Declaração de Comparecimento";
    case "laudo": return "Laudo";
    case "relatorio": return "Relatório";
    default: return t || "Atestado";
  }
}

function rxTypeLabel(t: string) {
  switch (t) {
    case "simples": return "Simples";
    case "especial_b": return "Especial B";
    case "especial_a": return "Especial A";
    case "antimicrobiano": return "Antimicrobiano";
    default: return t || "";
  }
}

function reportTypeLabel(t: string) {
  switch (t) {
    case "laudo_medico": return "Laudo Médico";
    case "laudo_pericial": return "Laudo Pericial";
    case "parecer_tecnico": return "Parecer Técnico";
    case "relatorio_medico": return "Relatório Médico";
    case "laudo_complementar": return "Laudo Complementar";
    default: return t?.replace(/_/g, " ") ?? "Laudo";
  }
}
