import { useState, useEffect } from "react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FlaskConical,
  Plus,
  Loader2,
  Search,
  User,
  Calendar,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Client {
  id: string;
  name: string;
}

interface RecentAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  medical_record_id: string | null;
}

interface Laudo {
  id: string;
  client_id: string;
  client_name: string;
  exam_type: string;
  exam_name: string;
  requested_by: string;
  performed_at: string;
  result: string;
  reference_values: string;
  interpretation: string;
  status: "normal" | "alterado" | "critico" | "pendente";
  lab_name: string;
  notes: string;
  created_at: string;
}


const statusConfig = {
  normal: { label: "Normal", className: "bg-success/20 text-success border-success/30" },
  alterado: { label: "Alterado", className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  critico: { label: "Crítico", className: "bg-destructive/20 text-destructive border-destructive/30" },
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
};

const StatusIcon = ({ status }: { status: Laudo["status"] }) => {
  if (status === "normal") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "alterado") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  if (status === "critico") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <FlaskConical className="h-4 w-4 text-muted-foreground" />;
};

const emptyForm = {
  client_id: "",
  appointment_id: "",
  exam_type: "laboratorial",
  exam_name: "",
  performed_at: "",
  result: "",
  reference_values: "",
  interpretation: "",
  status: "pendente" as Laudo["status"],
  lab_name: "",
  notes: "",
};

export default function Laudos() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | Laudo["status"]>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewLaudo, setViewLaudo] = useState<Laudo | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchLaudos();
    }
  }, [profile?.tenant_id]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (err) {
      logger.error("Error fetching clients:", err);
    }
  };

  const fetchRecentAppointments = async (clientId: string) => {
    if (!profile?.tenant_id || !clientId) { setRecentAppointments([]); return; }
    try {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, services(name), medical_records(id)")
        .eq("tenant_id", profile.tenant_id)
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      setRecentAppointments((data ?? []).map((a: any) => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        service_name: a.services?.name ?? "Consulta",
        medical_record_id: Array.isArray(a.medical_records) ? a.medical_records[0]?.id ?? null : a.medical_records?.id ?? null,
      })));
    } catch { setRecentAppointments([]); }
  };

  const handleClientChange = (clientId: string) => {
    setFormData(f => ({ ...f, client_id: clientId, appointment_id: "" }));
    void fetchRecentAppointments(clientId);
  };

  const fetchLaudos = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_results")
        .select(`*, clients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped: Laudo[] = (data || []).map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.name ?? "—",
        exam_type: r.exam_type,
        exam_name: r.exam_name,
        requested_by: r.profiles?.full_name ?? "—",
        performed_at: r.performed_at ?? "",
        result: r.result_text ?? "",
        reference_values: r.reference_values ?? "",
        interpretation: r.interpretation ?? "",
        status: r.status as Laudo["status"],
        lab_name: r.lab_name ?? "",
        notes: r.notes ?? "",
        created_at: r.created_at,
      }));
      setLaudos(mapped);
    } catch (err) {
      logger.error("Error fetching exam results:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.client_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.exam_name.trim()) { toast.error("Nome do exame é obrigatório"); return; }

    setIsSaving(true);
    try {
      const selectedAppt = recentAppointments.find(a => a.id === formData.appointment_id);
      const { error } = await supabase.from("exam_results").insert({
        tenant_id: profile!.tenant_id,
        client_id: formData.client_id,
        requested_by: profile!.id,
        appointment_id: formData.appointment_id || null,
        medical_record_id: selectedAppt?.medical_record_id || null,
        exam_type: formData.exam_type,
        exam_name: formData.exam_name,
        performed_at: formData.performed_at || null,
        result_text: formData.result || null,
        reference_values: formData.reference_values || null,
        interpretation: formData.interpretation || null,
        status: formData.status,
        lab_name: formData.lab_name || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast.success("Laudo registrado com sucesso!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchLaudos();
    } catch (err) {
      logger.error("Error saving exam result:", err);
      toast.error("Erro ao registrar laudo");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = laudos.filter((l) => {
    const matchSearch =
      l.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.lab_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    normal: laudos.filter((l) => l.status === "normal").length,
    alterado: laudos.filter((l) => l.status === "alterado").length,
    critico: laudos.filter((l) => l.status === "critico").length,
    pendente: laudos.filter((l) => l.status === "pendente").length,
  };

  return (
    <MainLayout
      title="Laudos & Exames"
      subtitle="Resultados de exames laboratoriais e de imagem"
      actions={
        <Button className="gradient-primary text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Laudo
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {(Object.entries(counts) as [Laudo["status"], number][]).map(([status, count]) => (
          <Card
            key={status}
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === status ? "ring-2 ring-primary" : ""}`}
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

      {/* Busca */}
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por paciente, exame ou laboratório..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum laudo encontrado"
          description="Registre laudos de exames laboratoriais e de imagem dos pacientes."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Registrar Laudo
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <Card key={l.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <FlaskConical className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{l.exam_name}</p>
                        <Badge variant="outline" className={statusConfig[l.status].className}>
                          <StatusIcon status={l.status} />
                          <span className="ml-1">{statusConfig[l.status].label}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />{l.client_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(l.performed_at + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {l.lab_name && <span>{l.lab_name}</span>}
                      </div>
                      {l.interpretation && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 bg-muted/50 rounded-lg px-3 py-1.5">
                          {l.interpretation}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewLaudo(l)}
                    className="shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Ver Laudo */}
      {viewLaudo && (
        <Dialog open={!!viewLaudo} onOpenChange={() => setViewLaudo(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewLaudo.exam_name}</DialogTitle>
              <DialogDescription>
                {viewLaudo.client_name} · {new Date(viewLaudo.performed_at + "T12:00:00").toLocaleDateString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Laboratório: {viewLaudo.lab_name || "—"}</span>
                <Badge variant="outline" className={statusConfig[viewLaudo.status].className}>
                  {statusConfig[viewLaudo.status].label}
                </Badge>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Resultado</Label>
                <pre className="mt-1 rounded-lg bg-muted/50 p-3 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                  {viewLaudo.result || "—"}
                </pre>
              </div>
              {viewLaudo.reference_values && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valores de Referência</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{viewLaudo.reference_values}</p>
                </div>
              )}
              {viewLaudo.interpretation && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interpretação Clínica</Label>
                  <p className="mt-1 text-sm">{viewLaudo.interpretation}</p>
                </div>
              )}
              {viewLaudo.notes && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{viewLaudo.notes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewLaudo(null)}>Fechar</Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-1.5" />Exportar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Drawer Registrar */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Registrar Laudo"
        description="Adicione resultado de exame ao prontuário do paciente"
        width="lg"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Salvar Laudo"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.client_id} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recentAppointments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Vincular a consulta (opcional)</Label>
                <Select value={formData.appointment_id || "none"} onValueChange={(v) => setFormData(f => ({ ...f, appointment_id: v === "none" ? "" : v }))}>
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

          <FormDrawerSection title="Dados do Exame">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Exame</Label>
                <Select value={formData.exam_type} onValueChange={(v) => setFormData({ ...formData, exam_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laboratorial">Laboratorial</SelectItem>
                    <SelectItem value="imagem">Imagem</SelectItem>
                    <SelectItem value="eletrocardiograma">ECG</SelectItem>
                    <SelectItem value="biopsia">Biópsia</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Realização</Label>
                <Input
                  type="date"
                  value={formData.performed_at}
                  onChange={(e) => setFormData({ ...formData, performed_at: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome do Exame *</Label>
              <Input
                value={formData.exam_name}
                onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
                placeholder="Ex: Hemograma Completo, Ultrassom Abdominal..."
              />
            </div>
            <div className="space-y-2">
              <Label>Laboratório / Clínica</Label>
              <Input
                value={formData.lab_name}
                onChange={(e) => setFormData({ ...formData, lab_name: e.target.value })}
                placeholder="Nome do laboratório"
              />
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Resultado">
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Textarea
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                placeholder="Valores encontrados, descrição do exame..."
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Interpretação Clínica</Label>
              <Textarea
                value={formData.interpretation}
                onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
                placeholder="Análise dos resultados, correlação clínica..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status do Resultado</Label>
              <Select
                value={formData.status}
                onValueChange={(v: any) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alterado">Alterado</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>
    </MainLayout>
  );
}
