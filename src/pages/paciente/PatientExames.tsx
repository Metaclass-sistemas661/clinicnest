import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, RefreshCw, Building2, Stethoscope, Calendar,
  Download, Upload, Trash2, CheckCircle2, Clock, XCircle, SunMedium,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { examesBanners } from "@/components/patient/patientBannerData";
import { generateExamPdf } from "@/utils/patientDocumentPdf";
import { toast } from "sonner";

const DicomViewer = lazy(() => import("@/components/patient/DicomViewer"));

/* ── Types ── */
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

interface UploadedExam {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  exam_name: string;
  exam_date: string | null;
  notes: string;
  status: string;
  reviewed_by_name: string;
  reviewed_at: string | null;
  created_at: string;
  clinic_name: string;
}

/* ── Helpers ── */
function statusBadge(status: string) {
  switch (status) {
    case "normal":   return { label: "Normal", variant: "default" as const };
    case "alterado": return { label: "Alterado", variant: "secondary" as const };
    case "critico":  return { label: "Crítico", variant: "destructive" as const };
    default:         return { label: "Pendente", variant: "outline" as const };
  }
}

function uploadStatusBadge(status: string) {
  switch (status) {
    case "revisado":  return { label: "Revisado",  variant: "secondary" as const, icon: CheckCircle2 };
    case "aprovado":  return { label: "Aprovado",  variant: "default" as const, icon: CheckCircle2 };
    case "rejeitado": return { label: "Rejeitado", variant: "destructive" as const, icon: XCircle };
    default:          return { label: "Pendente",  variant: "outline" as const, icon: Clock };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
];

/* ── Component ── */
export default function PatientExames() {
  const [activeTab, setActiveTab] = useState("clinica");

  // Clinic exams
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Uploaded exams
  const [uploads, setUploads] = useState<UploadedExam[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(false);

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examNotes, setExamNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DICOM viewer
  const [dicomUrl, setDicomUrl] = useState<string | null>(null);

  useEffect(() => { void fetchExams(); }, []);

  /* ── Clinic exams fetch ── */
  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (apiPatient as any).rpc("get_patient_exam_results");
      if (error) throw error;
      setExams((data ?? []) as ExamResult[]);
    } catch (err) {
      logger.error("PatientExames fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Uploaded exams fetch ── */
  const fetchUploads = async () => {
    setIsLoadingUploads(true);
    try {
      const { data, error } = await (apiPatient as any).rpc("get_patient_uploaded_exams");
      if (error) throw error;
      setUploads((data ?? []) as UploadedExam[]);
    } catch (err) {
      logger.error("PatientExames uploads fetch:", err);
    } finally {
      setIsLoadingUploads(false);
    }
  };

  /* ── Handle file upload ── */
  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      toast.error("Selecione um arquivo para enviar.");
      return;
    }
    if (uploadFile.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo permitido: 10 MB.");
      return;
    }
    if (!ALLOWED_TYPES.includes(uploadFile.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, JPEG, PNG ou WebP.");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await apiPatient.auth.getUser();
      if (!user) throw new Error("not_authenticated");

      const ext = uploadFile.name.split(".").pop() ?? "pdf";
      const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      // 1. Upload to storage
      const { error: storageError } = await apiPatient.storage
        .from("patient-exams")
        .upload(storagePath, uploadFile, {
          contentType: uploadFile.type,
          upsert: false,
        });
      if (storageError) throw storageError;

      // 2. Create DB record via RPC
      const { error: rpcError } = await (apiPatient as any).rpc("patient_upload_exam", {
        p_file_name: uploadFile.name,
        p_file_path: storagePath,
        p_file_size: uploadFile.size,
        p_mime_type: uploadFile.type,
        p_exam_name: examName || uploadFile.name,
        p_exam_date: examDate || null,
        p_notes: examNotes,
      });
      if (rpcError) throw rpcError;

      toast.success("Exame enviado com sucesso!");
      resetUploadForm();
      setShowUpload(false);
      void fetchUploads();
    } catch (err) {
      logger.error("PatientExames upload:", err);
      toast.error("Erro ao enviar exame. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  /* ── Delete uploaded exam ── */
  const handleDeleteUpload = async (examId: string, filePath: string) => {
    try {
      // Delete storage file
      await apiPatient.storage.from("patient-exams").remove([filePath]);
      // Delete DB record
      await (apiPatient as any).rpc("patient_delete_uploaded_exam", { p_exam_id: examId });
      toast.success("Exame removido.");
      void fetchUploads();
    } catch (err) {
      logger.error("PatientExames delete:", err);
      toast.error("Erro ao remover exame.");
    }
  };

  /* ── Download uploaded exam ── */
  const handleDownloadUpload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await apiPatient.storage
        .from("patient-exams")
        .download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("PatientExames download:", err);
      toast.error("Erro ao baixar arquivo.");
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setExamName("");
    setExamDate("");
    setExamNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <PatientLayout
      title="Exames e Laudos"
      subtitle="Resultados e envio de exames"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchExams();
              if (uploads.length > 0 || activeTab === "uploads") void fetchUploads();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      }
    >
      <PatientBannerCarousel slides={examesBanners} />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === "uploads") void fetchUploads();
        }}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="clinica" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Da Clínica
          </TabsTrigger>
          <TabsTrigger value="uploads" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Meus Envios
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Exames da clínica ─── */}
        <TabsContent value="clinica">
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
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateExamPdf(exam)}>
                          <Download className="h-3.5 w-3.5" />
                          Baixar PDF
                        </Button>
                        {exam.file_url && (
                          <a href={exam.file_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Download className="h-3.5 w-3.5" />
                              {exam.file_name || "Baixar arquivo"}
                            </Button>
                          </a>
                        )}
                        {exam.file_url && (exam.file_name?.toLowerCase().endsWith(".dcm") || exam.file_url.toLowerCase().includes("dicom")) && (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDicomUrl(exam.file_url)}>
                            <SunMedium className="h-3.5 w-3.5" />
                            Visualizar DICOM
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

        {/* ─── Tab: Meus Envios (Upload) ─── */}
        <TabsContent value="uploads">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Enviar Exame
            </Button>
          </div>

          {isLoadingUploads ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}><CardContent className="py-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-64" /></CardContent></Card>
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Nenhum exame enviado"
              description="Envie seus exames externos para que a clínica possa visualizá-los."
            />
          ) : (
            <div className="space-y-4">
              {uploads.map((up) => {
                const st = uploadStatusBadge(up.status);
                const StatusIcon = st.icon;
                return (
                  <Card key={up.id} className="hover:shadow-sm transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">{up.exam_name || up.file_name}</CardTitle>
                        <Badge variant={st.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {up.exam_date
                              ? format(new Date(up.exam_date), "dd/MM/yyyy", { locale: ptBR })
                              : format(new Date(up.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{up.file_name} ({formatFileSize(up.file_size)})</span>
                        </div>
                        {up.clinic_name && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{up.clinic_name}</span>
                          </div>
                        )}
                      </div>
                      {up.notes && (
                        <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{up.notes}</p>
                      )}
                      {up.reviewed_by_name && up.reviewed_at && (
                        <p className="text-xs text-muted-foreground">
                          Revisado por {up.reviewed_by_name} em{" "}
                          {format(new Date(up.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void handleDownloadUpload(up.file_path, up.file_name)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar
                        </Button>
                        {up.status === "pendente" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            onClick={() => void handleDeleteUpload(up.id, up.file_path)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
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
      </Tabs>

      {/* ─── Upload Dialog ─── */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Exame</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exam-file">Arquivo (PDF, imagem — máx 10 MB)</Label>
              <Input
                id="exam-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="exam-name">Nome do exame</Label>
              <Input
                id="exam-name"
                placeholder="Ex: Hemograma completo"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="exam-date">Data do exame</Label>
              <Input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="exam-notes">Observações (opcional)</Label>
              <Textarea
                id="exam-notes"
                placeholder="Alguma informação adicional..."
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetUploadForm(); setShowUpload(false); }}>
              Cancelar
            </Button>
            <Button onClick={() => void handleUploadSubmit()} disabled={uploading || !uploadFile} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DICOM Viewer Dialog */}
      <Dialog open={!!dicomUrl} onOpenChange={() => setDicomUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <SunMedium className="h-5 w-5 text-teal-500" />
              Visualizador DICOM
            </DialogTitle>
          </DialogHeader>
          {dicomUrl && (
            <Suspense fallback={<div className="h-[512px] flex items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>}>
              <DicomViewer fileUrl={dicomUrl} height={512} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
