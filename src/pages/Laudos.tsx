import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { useExamResults, type ExamResult } from "@/hooks/useExamResults";
import {
  EXAM_TYPES,
  getGroupedExamTypes,
  getExamTypeLabel,
  getCommonExams,
  EXAM_STATUS_OPTIONS,
} from "@/data/exam-types";
import { searchTuss, type TussEntry } from "@/data/tuss-index";
import {
  FlaskConical,
  Plus,
  Search,
  User,
  Calendar,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Trash2,
  Upload,
  FileText,
  X,
  ChevronsUpDown,
  Check,
  Stethoscope,
  HeartPulse,
  Microscope,
  Radio,
  Activity,
  Paperclip,
  ExternalLink,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

// ─── Interfaces ───────────────────────────────────────────────
interface Patient {
  id: string;
  name: string;
}

interface RecentAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  medical_record_id: string | null;
}

// ─── Status Config ────────────────────────────────────────────
const statusConfig = {
  normal: { label: "Normal", className: "bg-success/20 text-success border-success/30" },
  alterado: { label: "Alterado", className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  critico: { label: "Crítico", className: "bg-destructive/20 text-destructive border-destructive/30" },
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
};

const StatusIcon = ({ status }: { status: ExamResult["status"] }) => {
  if (status === "normal") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "alterado") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  if (status === "critico") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const ExamTypeIcon = ({ examType }: { examType: string }) => {
  const typeConfig = EXAM_TYPES.find((t) => t.value === examType);
  const iconName = typeConfig?.icon;
  switch (iconName) {
    case "HeartPulse": case "Heart": return <HeartPulse className="h-4 w-4" />;
    case "Microscope": return <Microscope className="h-4 w-4" />;
    case "Radio": return <Radio className="h-4 w-4" />;
    case "Activity": return <Activity className="h-4 w-4" />;
    case "Zap": return <Zap className="h-4 w-4" />;
    case "Stethoscope": return <Stethoscope className="h-4 w-4" />;
    default: return <FlaskConical className="h-4 w-4" />;
  }
};

// ─── Empty form ───────────────────────────────────────────────
const emptyForm = {
  patient_id: "",
  appointment_id: "",
  exam_type: "laboratorial",
  exam_category: "",
  exam_name: "",
  tuss_code: "",
  performed_at: "",
  result: "",
  reference_values: "",
  interpretation: "",
  status: "pendente" as ExamResult["status"],
  priority: "normal" as "normal" | "urgente",
  lab_name: "",
  notes: "",
  file: null as File | null,
};

type FormData = typeof emptyForm;

// ─── Component ────────────────────────────────────────────────
export default function Laudos() {
  const { profile, tenantId } = useAuth();
  const { examResults, isLoading, createExam, updateExam, deleteExam, isCreating, isUpdating } = useExamResults();

  // State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterStatus, setFilterStatus] = useState<"" | ExamResult["status"]>("");
  const [filterType, setFilterType] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamResult | null>(null);
  const [viewExam, setViewExam] = useState<ExamResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamResult | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);

  // TUSS search
  const [tussQuery, setTussQuery] = useState("");
  const [tussResults, setTussResults] = useState<TussEntry[]>([]);
  const [tussOpen, setTussOpen] = useState(false);

  // Exam name suggestions
  const [examNameOpen, setExamNameOpen] = useState(false);
  const examNameSuggestions = useMemo(() => getCommonExams(formData.exam_type), [formData.exam_type]);

  // File input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch Patients ─────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    api
      .from("patients")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name")
      .then(({ data }) => setPatients((data as Patient[]) || []));
  }, [tenantId]);

  // ─── Fetch recent appointments for selected patient ─────────
  const fetchRecentAppointments = useCallback(async (patientId: string) => {
    if (!tenantId || !patientId) { setRecentAppointments([]); return; }
    try {
      const { data } = await api
        .from("appointments")
        .select("id, scheduled_at, procedure:procedures(name), medical_records(id)")
        .eq("tenant_id", tenantId)
        .eq("patient_id", patientId)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      setRecentAppointments((data ?? []).map((a: any) => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        service_name: a.procedure?.name ?? "Consulta",
        medical_record_id: Array.isArray(a.medical_records) ? a.medical_records[0]?.id ?? null : a.medical_records?.id ?? null,
      })));
    } catch { setRecentAppointments([]); }
  }, [tenantId]);

  // ─── TUSS search ────────────────────────────────────────────
  useEffect(() => {
    if (tussQuery.length >= 2) {
      setTussResults(searchTuss(tussQuery, 20));
    } else {
      setTussResults([]);
    }
  }, [tussQuery]);

  // ─── Form helpers ───────────────────────────────────────────
  const handlePatientChange = (patientId: string) => {
    setFormData(f => ({ ...f, patient_id: patientId, appointment_id: "" }));
    void fetchRecentAppointments(patientId);
  };

  const handleExamTypeChange = (value: string) => {
    setFormData(f => ({ ...f, exam_type: value, exam_name: "", tuss_code: "" }));
  };

  const handleTussSelect = (entry: TussEntry) => {
    setFormData(f => ({ ...f, tuss_code: entry.code, exam_name: entry.description }));
    setTussOpen(false);
    setTussQuery("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) { toast.error("Arquivo muito grande. Máximo 20MB."); return; }
      setFormData(f => ({ ...f, file }));
    }
  };

  const openNew = () => {
    setEditingExam(null);
    setFormData(emptyForm);
    setIsDrawerOpen(true);
  };

  const openEdit = (exam: ExamResult) => {
    setEditingExam(exam);
    setFormData({
      patient_id: exam.patient_id,
      appointment_id: exam.appointment_id || "",
      exam_type: exam.exam_type,
      exam_category: exam.exam_category || "",
      exam_name: exam.exam_name,
      tuss_code: exam.tuss_code || "",
      performed_at: exam.performed_at || "",
      result: exam.result_text || "",
      reference_values: exam.reference_values || "",
      interpretation: exam.interpretation || "",
      status: exam.status,
      priority: exam.priority,
      lab_name: exam.lab_name || "",
      notes: exam.notes || "",
      file: null,
    });
    void fetchRecentAppointments(exam.patient_id);
    setIsDrawerOpen(true);
  };

  // ─── Submit (create or update) ──────────────────────────────
  const handleSubmit = async () => {
    if (!formData.patient_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.exam_name.trim()) { toast.error("Nome do exame é obrigatório"); return; }

    const selectedAppt = recentAppointments.find(a => a.id === formData.appointment_id);

    const payload = {
      patient_id: formData.patient_id,
      appointment_id: formData.appointment_id || null,
      medical_record_id: selectedAppt?.medical_record_id || null,
      exam_type: formData.exam_type,
      exam_category: formData.exam_category || null,
      exam_name: formData.exam_name,
      tuss_code: formData.tuss_code || null,
      performed_at: formData.performed_at || null,
      result_text: formData.result || null,
      reference_values: formData.reference_values || null,
      interpretation: formData.interpretation || null,
      status: formData.status,
      priority: formData.priority,
      lab_name: formData.lab_name || null,
      notes: formData.notes || null,
      file: formData.file,
    };

    if (editingExam) {
      await updateExam({ id: editingExam.id, ...payload });
    } else {
      await createExam(payload);
    }

    setIsDrawerOpen(false);
    setFormData(emptyForm);
    setEditingExam(null);
  };

  // ─── Delete ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteExam(deleteTarget.id);
    setDeleteTarget(null);
    setViewExam(null);
  };

  // ─── Filtering ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return examResults.filter((l) => {
      const q = debouncedSearch.toLowerCase();
      const matchSearch = !q ||
        l.patient_name.toLowerCase().includes(q) ||
        l.exam_name.toLowerCase().includes(q) ||
        (l.lab_name?.toLowerCase().includes(q) ?? false) ||
        (l.tuss_code?.includes(q) ?? false);
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchType = !filterType || l.exam_type === filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [examResults, debouncedSearch, filterStatus, filterType]);

  // ─── Counts ─────────────────────────────────────────────────
  const counts = useMemo(() => ({
    normal: examResults.filter((l) => l.status === "normal").length,
    alterado: examResults.filter((l) => l.status === "alterado").length,
    critico: examResults.filter((l) => l.status === "critico").length,
    pendente: examResults.filter((l) => l.status === "pendente").length,
  }), [examResults]);

  // ─── Grouped exam types for Select ─────────────────────────
  const groupedTypes = useMemo(() => getGroupedExamTypes(), []);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <MainLayout
      title="Laudos & Exames"
      subtitle="Resultados de exames — TUSS integrado, com upload e edição"
      actions={
        <Button variant="gradient" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Exame
        </Button>
      }
    >
      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {(Object.entries(counts) as [ExamResult["status"], number][]).map(([status, count]) => (
          <Card
            key={status}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterStatus === status && "ring-2 ring-primary"
            )}
            onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <StatusIcon status={status} />
              <div>
                <p className="text-xs text-muted-foreground capitalize">{statusConfig[status].label}</p>
                <p className="text-xl font-bold">{count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filtros ──────────────────────────────────────── */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente, exame, código TUSS ou laboratório..."
            className="pl-10"
          />
        </div>
        <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo de exame" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {groupedTypes.map((group) => (
              <SelectGroup key={group.key}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Lista ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum exame encontrado"
          description="Registre resultados de exames com código TUSS, upload de arquivos e interpretação clínica."
          action={
            <Button variant="gradient" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />Registrar Exame
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((exam) => (
            <Card key={exam.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <ExamTypeIcon examType={exam.exam_type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{exam.exam_name}</p>
                        <Badge variant="outline" className={statusConfig[exam.status].className}>
                          <StatusIcon status={exam.status} />
                          <span className="ml-1">{statusConfig[exam.status].label}</span>
                        </Badge>
                        {exam.priority === "urgente" && (
                          <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                        )}
                        {exam.tuss_code && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            TUSS {exam.tuss_code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />{exam.patient_name}
                        </span>
                        {exam.performed_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(exam.performed_at + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground/70">
                          {getExamTypeLabel(exam.exam_type)}
                        </span>
                        {exam.lab_name && <span>{exam.lab_name}</span>}
                        {exam.file_url && (
                          <span className="flex items-center gap-1 text-primary">
                            <Paperclip className="h-3.5 w-3.5" />Arquivo
                          </span>
                        )}
                      </div>
                      {exam.interpretation && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 bg-muted/50 rounded-lg px-3 py-1.5">
                          {exam.interpretation}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(exam)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setViewExam(exam)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Modal Ver Exame ──────────────────────────────── */}
      {viewExam && (
        <Dialog open={!!viewExam} onOpenChange={() => setViewExam(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ExamTypeIcon examType={viewExam.exam_type} />
                {viewExam.exam_name}
              </DialogTitle>
              <DialogDescription>
                {viewExam.patient_name}
                {viewExam.performed_at && ` · ${new Date(viewExam.performed_at + "T12:00:00").toLocaleDateString("pt-BR")}`}
                {viewExam.tuss_code && ` · TUSS ${viewExam.tuss_code}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getExamTypeLabel(viewExam.exam_type)}
                  </Badge>
                  {viewExam.priority === "urgente" && (
                    <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                  )}
                </div>
                <Badge variant="outline" className={statusConfig[viewExam.status].className}>
                  {statusConfig[viewExam.status].label}
                </Badge>
              </div>

              {viewExam.lab_name && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Laboratório</Label>
                  <p className="mt-1 text-sm">{viewExam.lab_name}</p>
                </div>
              )}

              {viewExam.requested_by_name && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Solicitante</Label>
                  <p className="mt-1 text-sm">{viewExam.requested_by_name}</p>
                </div>
              )}

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Resultado</Label>
                <pre className="mt-1 rounded-lg bg-muted/50 p-3 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                  {viewExam.result_text || "Aguardando resultado..."}
                </pre>
              </div>

              {viewExam.reference_values && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valores de Referência</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{viewExam.reference_values}</p>
                </div>
              )}

              {viewExam.interpretation && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interpretação Clínica</Label>
                  <p className="mt-1 text-sm">{viewExam.interpretation}</p>
                </div>
              )}

              {viewExam.notes && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{viewExam.notes}</p>
                </div>
              )}

              {viewExam.file_url && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Arquivo Anexo</Label>
                  <a
                    href={viewExam.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {viewExam.file_name || "Ver arquivo"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Criado em {new Date(viewExam.created_at).toLocaleString("pt-BR")}
                {viewExam.source && viewExam.source !== "manual" && ` · Fonte: ${viewExam.source}`}
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteTarget(viewExam)}
              >
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
              <Button variant="outline" onClick={() => { setViewExam(null); openEdit(viewExam); }}>
                <Pencil className="h-4 w-4 mr-1" />Editar
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-1" />Exportar
              </Button>
              <Button variant="outline" onClick={() => setViewExam(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── AlertDialog Excluir ──────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
            <AlertDialogDescription>
              O exame &quot;{deleteTarget?.exam_name}&quot; de {deleteTarget?.patient_name} será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Drawer Registrar/Editar ──────────────────────── */}
      <FormDrawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          setIsDrawerOpen(open);
          if (!open) { setEditingExam(null); setFormData(emptyForm); }
        }}
        title={editingExam ? "Editar Exame" : "Registrar Exame"}
        description={editingExam
          ? "Atualize os dados do resultado de exame"
          : "Registre resultado de exame com código TUSS e upload de arquivo"
        }
        width="lg"
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        submitLabel={editingExam ? "Salvar Alterações" : "Registrar Exame"}
      >
        <div className="space-y-4">
          {/* ── Paciente ───────────────────────────────────── */}
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.patient_id} onValueChange={handlePatientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recentAppointments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Vincular a consulta (opcional)</Label>
                <Select
                  value={formData.appointment_id || "none"}
                  onValueChange={(v) => setFormData(f => ({ ...f, appointment_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {recentAppointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {new Date(a.scheduled_at).toLocaleDateString("pt-BR")} — {a.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormDrawerSection>

          {/* ── Dados do Exame ─────────────────────────────── */}
          <FormDrawerSection title="Dados do Exame">
            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de exame — agrupado */}
              <div className="space-y-2">
                <Label>Tipo de Exame *</Label>
                <Select value={formData.exam_type} onValueChange={handleExamTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {groupedTypes.map((group) => (
                      <SelectGroup key={group.key}>
                        <SelectLabel className="font-bold text-xs uppercase tracking-wider">
                          {group.label}
                        </SelectLabel>
                        {group.types.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label>Data de Realização</Label>
                <Input
                  type="date"
                  value={formData.performed_at}
                  onChange={(e) => setFormData(f => ({ ...f, performed_at: e.target.value }))}
                />
              </div>
            </div>

            {/* Nome do exame com sugestões */}
            <div className="space-y-2">
              <Label>Nome do Exame *</Label>
              <Popover open={examNameOpen} onOpenChange={setExamNameOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {formData.exam_name || "Selecione ou digite o nome do exame..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar exame..."
                      value={formData.exam_name}
                      onValueChange={(v) => setFormData(f => ({ ...f, exam_name: v }))}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <span className="text-xs text-muted-foreground">
                          Digite o nome do exame manualmente
                        </span>
                      </CommandEmpty>
                      {examNameSuggestions.length > 0 && (
                        <CommandGroup heading="Sugestões para este tipo">
                          {examNameSuggestions
                            .filter(s => s.toLowerCase().includes((formData.exam_name || "").toLowerCase()))
                            .map((s) => (
                              <CommandItem
                                key={s}
                                value={s}
                                onSelect={() => {
                                  setFormData(f => ({ ...f, exam_name: s }));
                                  setExamNameOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.exam_name === s ? "opacity-100" : "opacity-0")} />
                                {s}
                              </CommandItem>
                            ))
                          }
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Código TUSS */}
            <div className="space-y-2">
              <Label>Código TUSS (opcional)</Label>
              <Popover open={tussOpen} onOpenChange={setTussOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {formData.tuss_code
                      ? `${formData.tuss_code} — ${formData.exam_name}`
                      : "Buscar código TUSS..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite código ou nome do procedimento TUSS..."
                      value={tussQuery}
                      onValueChange={setTussQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {tussQuery.length < 2
                          ? "Digite pelo menos 2 caracteres"
                          : "Nenhum procedimento TUSS encontrado"
                        }
                      </CommandEmpty>
                      {tussResults.length > 0 && (
                        <CommandGroup heading={`${tussResults.length} resultados`}>
                          {tussResults.map((t) => (
                            <CommandItem
                              key={t.code}
                              value={t.code}
                              onSelect={() => handleTussSelect(t)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.tuss_code === t.code ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono text-xs mr-2 text-muted-foreground">{t.code}</span>
                              <span className="truncate">{t.description}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Laboratório / Clínica</Label>
                <Input
                  value={formData.lab_name}
                  onChange={(e) => setFormData(f => ({ ...f, lab_name: e.target.value }))}
                  placeholder="Nome do laboratório"
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(v: "normal" | "urgente") => setFormData(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormDrawerSection>

          {/* ── Resultado ──────────────────────────────────── */}
          <FormDrawerSection title="Resultado">
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Textarea
                value={formData.result}
                onChange={(e) => setFormData(f => ({ ...f, result: e.target.value }))}
                placeholder="Valores encontrados, descrição do resultado..."
                rows={5}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Valores de Referência</Label>
              <Textarea
                value={formData.reference_values}
                onChange={(e) => setFormData(f => ({ ...f, reference_values: e.target.value }))}
                placeholder="Ex: Glicemia jejum: 70-99 mg/dL"
                rows={2}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Interpretação Clínica</Label>
              <Textarea
                value={formData.interpretation}
                onChange={(e) => setFormData(f => ({ ...f, interpretation: e.target.value }))}
                placeholder="Análise dos resultados, correlação clínica, recomendações..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status do Resultado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData(f => ({ ...f, status: v as ExamResult["status"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXAM_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas adicionais"
                />
              </div>
            </div>
          </FormDrawerSection>

          {/* ── Upload de Arquivo ──────────────────────────── */}
          <FormDrawerSection title="Arquivo Anexo">
            <div className="space-y-3">
              {editingExam?.file_url && !formData.file && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <FileText className="h-5 w-5 text-primary" />
                  <a
                    href={editingExam.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex-1 truncate"
                  >
                    {editingExam.file_name || "Arquivo anexo"}
                  </a>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              {formData.file && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="text-sm flex-1 truncate">{formData.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(formData.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setFormData(f => ({ ...f, file: null }))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {formData.file || editingExam?.file_url ? "Substituir arquivo" : "Enviar PDF, imagem ou DICOM"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Formatos: PDF, JPEG, PNG, WebP, DICOM · Máx: 20MB
              </p>
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>
    </MainLayout>
  );
}
