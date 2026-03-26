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
  ArrowRightLeft, Plus, Loader2, Search, User, Calendar,
  AlertTriangle, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Patient { id: string; name: string; }
interface Professional { id: string; full_name: string; }
interface Specialty { id: string; name: string; }
interface RecentAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  medical_record_id: string | null;
}

interface Referral {
  id: string;
  client_name: string;
  from_name: string;
  to_name: string | null;
  specialty_name: string | null;
  status: string;
  priority: string;
  reason: string;
  clinical_summary: string | null;
  notes: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  aceito: { label: "Aceito", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: CheckCircle2 },
  recusado: { label: "Recusado", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
  concluido: { label: "Concluído", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  urgente: { label: "Urgente", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  emergencia: { label: "Emergência", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const emptyForm = {
  patient_id: "",
  appointment_id: "",
  to_professional: "",
  to_specialty_id: "",
  priority: "normal",
  reason: "",
  clinical_summary: "",
  notes: "",
};

export default function Encaminhamentos() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterStatus, setFilterStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchAll();
    }
  }, [profile?.tenant_id]);

  const fetchRecentAppointments = async (patientId: string) => {
    if (!profile?.tenant_id || !patientId) { setRecentAppointments([]); return; }
    try {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, procedure:procedures(name), medical_records(id)")
        .eq("tenant_id", profile.tenant_id)
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
  };

  const handlePatientChange = (patientId: string) => {
    setFormData(f => ({ ...f, patient_id: patientId, appointment_id: "" }));
    void fetchRecentAppointments(patientId);
  };

  const fetchAll = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [cRes, pRes, sRes, rRes] = await Promise.all([
        supabase.from("patients").select("id, name").eq("tenant_id", profile.tenant_id).order("name").limit(500),
        supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).order("full_name").limit(200),
        supabase.from("specialties").select("id, name").eq("tenant_id", profile.tenant_id).order("name").limit(100),
        supabase.from("referrals")
          .select("*, patient:patients(name), from:profiles!referrals_from_professional_fkey(full_name), to:profiles!referrals_to_professional_fkey(full_name), specialties(name)")
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      setPatients((cRes.data as Patient[]) || []);
      setProfessionals((pRes.data as Professional[]) || []);
      setSpecialties((sRes.data as Specialty[]) || []);
      setReferrals((rRes.data || []).map((r: any) => ({
        id: r.id,
        client_name: r.patient?.name ?? "—",
        from_name: r.from?.full_name ?? "—",
        to_name: r.to?.full_name ?? null,
        specialty_name: r.specialties?.name ?? null,
        status: r.status,
        priority: r.priority,
        reason: r.reason,
        clinical_summary: r.clinical_summary,
        notes: r.notes,
        created_at: r.created_at,
      })));
    } catch (err) {
      logger.error("Fetch referrals data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.patient_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.reason.trim()) { toast.error("Informe o motivo do encaminhamento"); return; }
    if (!formData.to_professional && !formData.to_specialty_id) {
      toast.error("Selecione o profissional ou especialidade de destino"); return;
    }

    setIsSaving(true);
    try {
      const selectedAppt = recentAppointments.find(a => a.id === formData.appointment_id);
      const { error } = await supabase.from("referrals").insert({
        tenant_id: profile!.tenant_id,
        patient_id: formData.patient_id,
        from_professional: profile!.id,
        to_professional: formData.to_professional || null,
        to_specialty_id: formData.to_specialty_id || null,
        appointment_id: formData.appointment_id || null,
        medical_record_id: selectedAppt?.medical_record_id || null,
        priority: formData.priority,
        reason: formData.reason,
        clinical_summary: formData.clinical_summary || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast.success("Encaminhamento criado!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchAll();
    } catch (err) {
      logger.error("Save referral:", err);
      toast.error("Erro ao criar encaminhamento");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === "aceito" || status === "recusado") updates.responded_at = new Date().toISOString();
      if (status === "concluido") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("referrals").update(updates).eq("id", id);
      if (error) throw error;
      toast.success(`Encaminhamento ${statusConfig[status]?.label?.toLowerCase() || status}`);
      fetchAll();
    } catch (err) {
      logger.error("Update referral:", err);
      toast.error("Erro ao atualizar");
    }
  };

  const filtered = referrals.filter((r) => {
    const matchSearch =
      r.client_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      r.reason.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (r.from_name || "").toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <MainLayout
      title="Encaminhamentos"
      subtitle="Encaminhamento entre profissionais e especialidades"
      actions={
        <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Novo Encaminhamento
        </Button>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente ou motivo..." className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aceito">Aceito</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="Nenhum encaminhamento"
          description="Crie encaminhamentos entre profissionais e especialidades."
          action={
            <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Novo Encaminhamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const sc = statusConfig[r.status] || statusConfig.pendente;
            const pc = priorityConfig[r.priority] || priorityConfig.normal;
            const SIcon = sc.icon;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{r.client_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          <span>·</span>
                          <span className="font-medium">{r.from_name}</span>
                          <ArrowRightLeft className="h-3 w-3" />
                          <span className="font-medium">{r.to_name || r.specialty_name || "—"}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`${sc.color} gap-1`}>
                        <SIcon className="h-3 w-3" />{sc.label}
                      </Badge>
                      {r.priority !== "normal" && (
                        <Badge variant="outline" className={pc.color}>{pc.label}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <span className="font-medium">Motivo:</span> {r.reason}
                  </div>
                  {r.clinical_summary && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Resumo clínico:</span> {r.clinical_summary}
                    </div>
                  )}
                  {r.status === "pendente" && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateStatus(r.id, "aceito")}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Aceitar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateStatus(r.id, "recusado")}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />Recusar
                      </Button>
                    </div>
                  )}
                  {r.status === "aceito" && (
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => updateStatus(r.id, "concluido")}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Concluir
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
        title="Novo Encaminhamento"
        description="Encaminhe um paciente para outro profissional ou especialidade"
        width="md"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Criar Encaminhamento"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.patient_id || undefined} onValueChange={handlePatientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

          <FormDrawerSection title="Destino">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profissional Destino</Label>
                <Select value={formData.to_professional || undefined} onValueChange={(v) => setFormData({ ...formData, to_professional: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {professionals.filter((p) => p.id !== profile?.id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Especialidade Destino</Label>
                <Select value={formData.to_specialty_id || undefined} onValueChange={(v) => setFormData({ ...formData, to_specialty_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="emergencia">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Informações Clínicas">
            <div className="space-y-2">
              <Label>Motivo do Encaminhamento *</Label>
              <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Descreva o motivo do encaminhamento..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Resumo Clínico</Label>
              <Textarea value={formData.clinical_summary} onChange={(e) => setFormData({ ...formData, clinical_summary: e.target.value })}
                placeholder="Resumo do quadro clínico do paciente..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais..." rows={2} />
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>
    </MainLayout>
  );
}
