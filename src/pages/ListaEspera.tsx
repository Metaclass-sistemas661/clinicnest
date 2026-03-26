import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ClockArrowUp, Plus, Loader2, Search, User, Calendar,
  Bell, CheckCircle2, XCircle, CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Patient { id: string; name: string; phone?: string; }
interface ProcedureOption { id: string; name: string; }
interface Professional { id: string; full_name: string; }

interface WaitlistEntry {
  id: string;
  patient_id: string;
  client_name: string;
  client_phone: string;
  service_name: string | null;
  professional_name: string | null;
  priority: string;
  status: string;
  reason: string | null;
  preferred_periods: string[] | null;
  notified_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  notificado: { label: "Notificado", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  agendado: { label: "Agendado", color: "bg-success/20 text-success border-success/30" },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
  expirado: { label: "Expirado", color: "bg-muted text-muted-foreground" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  alta: { label: "Alta", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  urgente: { label: "Urgente", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const periodLabels: Record<string, string> = {
  manha: "Manhã", tarde: "Tarde", noite: "Noite",
};

const emptyForm = {
  patient_id: "",
  procedure_id: "",
  professional_id: "",
  priority: "normal",
  reason: "",
  preferred_periods: [] as string[],
};

export default function ListaEspera() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterStatus, setFilterStatus] = useState("aguardando");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (profile?.tenant_id) fetchAll();
  }, [profile?.tenant_id]);

  const fetchAll = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [cRes, sRes, pRes, wRes] = await Promise.all([
        supabase.from("patients").select("id, name, phone").eq("tenant_id", profile.tenant_id).order("name").limit(500),
        supabase.from("procedures").select("id, name").eq("tenant_id", profile.tenant_id).order("name").limit(200),
        supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).order("full_name").limit(200),
        supabase.from("waitlist")
          .select("*, patient:patients(name, phone), procedure:procedures(name), profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      setPatients((cRes.data as Patient[]) || []);
      setProcedures((sRes.data as ProcedureOption[]) || []);
      setProfessionals((pRes.data as Professional[]) || []);
      setEntries((wRes.data || []).map((r: any) => ({
        id: r.id,
        patient_id: r.patient_id,
        client_name: r.patient?.name ?? "—",
        client_phone: r.patient?.phone ?? "",
        service_name: r.procedure?.name ?? null,
        professional_name: r.profiles?.full_name ?? null,
        priority: r.priority,
        status: r.status,
        reason: r.reason,
        preferred_periods: r.preferred_periods,
        notified_at: r.notified_at,
        created_at: r.created_at,
      })));
    } catch (err) {
      logger.error("Fetch waitlist:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.patient_id) { toast.error("Selecione um paciente"); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("waitlist").insert({
        tenant_id: profile!.tenant_id,
        patient_id: formData.patient_id,
        procedure_id: formData.procedure_id || null,
        professional_id: formData.professional_id || null,
        priority: formData.priority,
        reason: formData.reason || null,
        preferred_periods: formData.preferred_periods.length > 0 ? formData.preferred_periods : null,
      });
      if (error) throw error;
      toast.success("Paciente adicionado à lista de espera!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchAll();
    } catch (err) {
      logger.error("Save waitlist:", err);
      toast.error("Erro ao adicionar à lista");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === "notificado") updates.notified_at = new Date().toISOString();
      if (status === "agendado") updates.scheduled_at = new Date().toISOString();
      const { error } = await supabase.from("waitlist").update(updates).eq("id", id);
      if (error) throw error;

      // If notifying, send real WhatsApp/email via notify-patient-events
      if (status === "notificado") {
        const entry = entries.find((e) => e.id === id);
        if (entry?.patient_id) {
          supabase.functions.invoke("notify-patient-events", {
            body: {
              event_type: "waitlist_slot_available",
              patient_id: entry.patient_id,
              tenant_id: profile?.tenant_id,
              metadata: {
                waitlist_id: id,
                service_name: entry.service_name || "Consulta",
                professional_name: entry.professional_name || "",
              },
            },
          }).catch((err) => logger.warn("Waitlist notify dispatch:", err));
        }
        toast.success("Paciente notificado por WhatsApp/e-mail!");
      } else {
        toast.success(`Status atualizado para ${statusConfig[status]?.label || status}`);
      }
      fetchAll();
    } catch (err) {
      logger.error("Update waitlist:", err);
      toast.error("Erro ao atualizar");
    }
  };

  const togglePeriod = (period: string) => {
    setFormData((f) => ({
      ...f,
      preferred_periods: f.preferred_periods.includes(period)
        ? f.preferred_periods.filter((p) => p !== period)
        : [...f.preferred_periods, period],
    }));
  };

  const filtered = entries.filter((e) => {
    const matchSearch = e.client_name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const waitingCount = entries.filter((e) => e.status === "aguardando").length;

  return (
    <MainLayout
      title="Lista de Espera"
      subtitle={`${waitingCount} paciente(s) aguardando vaga`}
      actions={
        <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Adicionar à Lista
        </Button>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar paciente..." className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="notificado">Notificado</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClockArrowUp}
          title="Lista de espera vazia"
          description="Adicione pacientes que aguardam vaga para atendimento."
          action={
            <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Adicionar
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const sc = statusConfig[entry.status] || statusConfig.aguardando;
            const pc = priorityConfig[entry.priority] || priorityConfig.normal;
            return (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{entry.client_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Calendar className="h-3.5 w-3.5" />
                          Na fila desde {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                          {entry.service_name && <><span>·</span>{entry.service_name}</>}
                          {entry.professional_name && <><span>·</span>{entry.professional_name}</>}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
                      {entry.priority !== "normal" && (
                        <Badge variant="outline" className={pc.color}>{pc.label}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}
                  {entry.preferred_periods && entry.preferred_periods.length > 0 && (
                    <div className="flex gap-1.5">
                      <span className="text-xs text-muted-foreground">Preferência:</span>
                      {entry.preferred_periods.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px]">{periodLabels[p] || p}</Badge>
                      ))}
                    </div>
                  )}
                  {entry.notified_at && (
                    <p className="text-xs text-muted-foreground">
                      Notificado em {new Date(entry.notified_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {entry.status === "aguardando" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => updateStatus(entry.id, "notificado")}>
                        <Bell className="h-3.5 w-3.5 mr-1.5" />Notificar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => updateStatus(entry.id, "agendado")}>
                        <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />Agendar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateStatus(entry.id, "cancelado")}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancelar
                      </Button>
                    </div>
                  )}
                  {entry.status === "notificado" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => updateStatus(entry.id, "agendado")}>
                        <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />Agendar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Adicionar à Lista de Espera"
        description="O paciente será notificado quando houver vaga disponível."
        width="md"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Adicionar à Lista"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.patient_id || undefined} onValueChange={(v) => setFormData({ ...formData, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Preferências">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Procedimento</Label>
                <Select value={formData.procedure_id || undefined} onValueChange={(v) => setFormData({ ...formData, procedure_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {procedures.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={formData.professional_id || undefined} onValueChange={(v) => setFormData({ ...formData, professional_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Períodos Preferidos</Label>
              <div className="flex gap-2">
                {(["manha", "tarde", "noite"] as const).map((p) => (
                  <Button key={p} type="button" variant={formData.preferred_periods.includes(p) ? "default" : "outline"}
                    size="sm" onClick={() => togglePeriod(p)}>
                    {periodLabels[p]}
                  </Button>
                ))}
              </div>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Observações">
            <div className="space-y-2">
              <Label>Motivo / Observações</Label>
              <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Por que o paciente está na fila..." rows={3} />
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>
    </MainLayout>
  );
}
