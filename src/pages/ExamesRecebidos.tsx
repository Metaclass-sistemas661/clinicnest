import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  Loader2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Types ── */
interface UploadedExam {
  id: string;
  tenant_id: string;
  patient_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  exam_name: string;
  exam_date: string | null;
  notes: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Helpers ── */
function statusConfig(s: string) {
  switch (s) {
    case "aprovado":
      return { label: "Aprovado", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" };
    case "revisado":
      return { label: "Revisado", variant: "secondary" as const, icon: CheckCircle2, color: "text-blue-600" };
    case "rejeitado":
      return { label: "Rejeitado", variant: "destructive" as const, icon: XCircle, color: "text-red-600" };
    default:
      return { label: "Pendente", variant: "outline" as const, icon: Clock, color: "text-amber-600" };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ── Page ── */
export default function ExamesRecebidos() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [exams, setExams] = useState<UploadedExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionExam, setActionExam] = useState<UploadedExam | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchExams = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      let query = api
        .from("patient_uploaded_exams")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExams((data ?? []) as UploadedExam[]);
    } catch (err) {
      logger.error("ExamesRecebidos fetch:", err);
      toast.error("Erro ao carregar exames");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, filterStatus]);

  useEffect(() => { void fetchExams(); }, [fetchExams]);

  const handleStatusChange = async (exam: UploadedExam, newStatus: "aprovado" | "rejeitado") => {
    setIsSaving(true);
    try {
      const { error } = await api
        .from("patient_uploaded_exams")
        .update({
          status: newStatus,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", exam.id);

      if (error) throw error;
      toast.success(`Exame ${newStatus === "aprovado" ? "aprovado" : "rejeitado"} com sucesso!`);
      setExams((prev) => prev.map((e) =>
        e.id === exam.id
          ? { ...e, status: newStatus, reviewed_by: profile?.id ?? null, reviewed_at: new Date().toISOString() }
          : e
      ));
    } catch (err) {
      logger.error("ExamesRecebidos status:", err);
      toast.error("Erro ao atualizar status");
    } finally {
      setIsSaving(false);
      setActionExam(null);
      setActionType(null);
    }
  };

  const handleDownload = async (exam: UploadedExam) => {
    try {
      const { data, error } = await api.storage
        .from("patient-exams")
        .createSignedUrl(exam.file_path, 300);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      logger.error("ExamesRecebidos download:", err);
      toast.error("Erro ao gerar link de download");
    }
  };

  const filtered = exams.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.exam_name.toLowerCase().includes(q) ||
      e.file_name.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: exams.length,
    pendente: exams.filter((e) => e.status === "pendente").length,
    aprovado: exams.filter((e) => e.status === "aprovado").length,
    rejeitado: exams.filter((e) => e.status === "rejeitado").length,
  };

  return (
    <MainLayout
      title="Exames Recebidos"
      subtitle="Revise exames enviados pelos pacientes pelo portal"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-amber-600">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{counts.pendente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-green-600">Aprovados</p>
            <p className="text-2xl font-bold text-green-600">{counts.aprovado}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-red-600">Rejeitados</p>
            <p className="text-2xl font-bold text-red-600">{counts.rejeitado}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do exame ou arquivo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="revisado">Revisado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void fetchExams()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Upload}
                title="Nenhum exame enviado"
                description={search ? "Nenhum resultado encontrado para a busca." : "Quando pacientes enviarem exames pelo portal, eles aparecerão aqui."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exame</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="hidden sm:table-cell">Data do exame</TableHead>
                    <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Enviado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((exam) => {
                    const st = statusConfig(exam.status);
                    return (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {exam.exam_name || "Sem nome"}
                          {exam.notes && (
                            <p className="text-xs text-muted-foreground truncate">{exam.notes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {exam.file_name}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {exam.exam_date
                            ? format(new Date(exam.exam_date), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {formatFileSize(exam.file_size)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant} className="gap-1">
                            <st.icon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {format(new Date(exam.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDownload(exam)}
                              title="Baixar arquivo"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {exam.status === "pendente" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    setActionExam(exam);
                                    setActionType("approve");
                                  }}
                                  title="Aprovar"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setActionExam(exam);
                                    setActionType("reject");
                                  }}
                                  title="Rejeitar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!actionExam && !!actionType} onOpenChange={() => { setActionExam(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Aprovar exame?" : "Rejeitar exame?"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `O exame "${actionExam?.exam_name || actionExam?.file_name}" será marcado como aprovado.`
                : `O exame "${actionExam?.exam_name || actionExam?.file_name}" será marcado como rejeitado.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setActionExam(null); setActionType(null); }}>
              Cancelar
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              disabled={isSaving}
              onClick={() => {
                if (actionExam && actionType) {
                  void handleStatusChange(actionExam, actionType === "approve" ? "aprovado" : "rejeitado");
                }
              }}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Aprovar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
