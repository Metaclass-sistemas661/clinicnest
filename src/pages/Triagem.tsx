import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import {
  Activity,
  Plus,
  Loader2,
  Search,
  User,
  Calendar,
  Heart,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { AiTriageChatbot } from "@/components/ai";

interface Patient {
  id: string;
  name: string;
  phone?: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  client_name: string;
  scheduled_at: string;
  service_name: string;
}

type Priority = "emergencia" | "urgente" | "pouco_urgente" | "nao_urgente";
type TriageStatus = "pendente" | "em_atendimento" | "concluida";

interface Triagem {
  id: string;
  patient_id: string;
  client_name: string;
  performed_by: string;
  triaged_at: string;
  priority: Priority;
  status: TriageStatus;
  appointment_id: string | null;
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  heart_rate: string;
  respiratory_rate: string;
  temperature: string;
  oxygen_saturation: string;
  weight: string;
  height: string;
  chief_complaint: string;
  pain_scale: string;
  allergies: string;
  current_medications: string;
  medical_history: string;
  notes: string;
}


const priorityConfig: Record<Priority, { label: string; color: string; icon: React.ElementType }> = {
  emergencia: { label: "Emergência", color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
  urgente: { label: "Urgente", color: "bg-warning/20 text-warning border-warning/30", icon: AlertTriangle },
  pouco_urgente: { label: "Pouco Urgente", color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
  nao_urgente: { label: "Não Urgente", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
};

const statusConfig: Record<TriageStatus, { label: string; color: string }> = {
  pendente: { label: "Aguardando", color: "bg-warning/20 text-warning border-warning/30" },
  em_atendimento: { label: "Em atendimento", color: "bg-info/20 text-info border-info/30" },
  concluida: { label: "Concluída", color: "bg-success/20 text-success border-success/30" },
};

const emptyForm = {
  patient_id: "",
  appointment_id: "",
  priority: "nao_urgente" as Priority,
  blood_pressure_systolic: "",
  blood_pressure_diastolic: "",
  heart_rate: "",
  respiratory_rate: "",
  temperature: "",
  oxygen_saturation: "",
  weight: "",
  height: "",
  chief_complaint: "",
  pain_scale: "",
  allergies: "",
  current_medications: "",
  medical_history: "",
  notes: "",
};

export default function Triagem() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPatients();
      fetchTriagens();
      fetchTodayAppointments();
    }
  }, [profile?.tenant_id]);

  const fetchPatients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from("patients")
        .select("id, name, phone")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setPatients((data as Patient[]) || []);
    } catch (err) {
      logger.error("Error fetching patients:", err);
    }
  };

  const fetchTriagens = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("triage_records")
        .select(`*, patient:patients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("triaged_at", { ascending: false });
      if (error) throw error;
      const mapped: Triagem[] = (data || []).map((r: any) => ({
        id: r.id,
        patient_id: r.patient_id,
        client_name: r.patient?.name ?? "—",
        performed_by: r.profiles?.full_name ?? "—",
        triaged_at: r.triaged_at,
        priority: r.priority as Priority,
        status: (r.status as TriageStatus) ?? "pendente",
        appointment_id: r.appointment_id ?? null,
        blood_pressure_systolic: r.blood_pressure_systolic?.toString() ?? "",
        blood_pressure_diastolic: r.blood_pressure_diastolic?.toString() ?? "",
        heart_rate: r.heart_rate?.toString() ?? "",
        respiratory_rate: r.respiratory_rate?.toString() ?? "",
        temperature: r.temperature?.toString() ?? "",
        oxygen_saturation: r.oxygen_saturation?.toString() ?? "",
        weight: r.weight_kg?.toString() ?? "",
        height: r.height_cm?.toString() ?? "",
        chief_complaint: r.chief_complaint ?? "",
        pain_scale: r.pain_scale?.toString() ?? "",
        allergies: r.allergies ?? "",
        current_medications: r.current_medications ?? "",
        medical_history: r.medical_history ?? "",
        notes: r.notes ?? "",
      }));
      setTriagens(mapped);
    } catch (err) {
      logger.error("Error fetching triage records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodayAppointments = async () => {
    if (!profile?.tenant_id) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await api
        .from("appointments")
        .select("id, patient_id, scheduled_at, patient:patients(name), procedure:procedures(name)")
        .eq("tenant_id", profile.tenant_id)
        .gte("scheduled_at", `${today}T00:00:00`)
        .lte("scheduled_at", `${today}T23:59:59`)
        .order("scheduled_at");
      if (error) throw error;
      setAppointments(
        (data || []).map((a: any) => ({
          id: a.id,
          patient_id: a.patient_id,
          client_name: a.patient?.name ?? "—",
          scheduled_at: a.scheduled_at,
          service_name: a.procedure?.name ?? "Consulta",
        }))
      );
    } catch (err) {
      logger.error("Error fetching appointments:", err);
    }
  };

  const handleSubmit = async () => {
    if (!formData.patient_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.chief_complaint.trim()) { toast.error("Queixa principal é obrigatória"); return; }

    setIsSaving(true);
    try {
      const { error } = await api.from("triage_records").insert({
        tenant_id: profile!.tenant_id,
        patient_id: formData.patient_id,
        appointment_id: formData.appointment_id && formData.appointment_id !== "none" ? formData.appointment_id : null,
        performed_by: profile!.id,
        priority: formData.priority,
        status: "pendente",
        chief_complaint: formData.chief_complaint,
        blood_pressure_systolic: formData.blood_pressure_systolic ? parseInt(formData.blood_pressure_systolic) : null,
        blood_pressure_diastolic: formData.blood_pressure_diastolic ? parseInt(formData.blood_pressure_diastolic) : null,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
        respiratory_rate: formData.respiratory_rate ? parseInt(formData.respiratory_rate) : null,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        oxygen_saturation: formData.oxygen_saturation ? parseFloat(formData.oxygen_saturation) : null,
        weight_kg: formData.weight ? parseFloat(formData.weight) : null,
        height_cm: formData.height ? parseInt(formData.height) : null,
        pain_scale: formData.pain_scale ? parseInt(formData.pain_scale) : null,
        allergies: formData.allergies || null,
        current_medications: formData.current_medications || null,
        medical_history: formData.medical_history || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast.success("Triagem realizada com sucesso!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchTriagens();
    } catch (err) {
      logger.error("Error saving triage:", err);
      toast.error("Erro ao salvar triagem");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = triagens.filter(
    (t) => {
      const matchSearch = t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    }
  );

  const handleStartAtendimento = async (t: Triagem) => {
    try {
      // Marcar triagem como em_atendimento
      await api
        .from("triage_records")
        .update({ status: "em_atendimento" })
        .eq("id", t.id);
      
      // Navegar para prontuário com dados da triagem
      const params = new URLSearchParams({
        patient_id: t.patient_id,
        triage_id: t.id,
        new: "1",
      });
      if (t.appointment_id) params.set("appointment_id", t.appointment_id);
      navigate(`/prontuarios?${params.toString()}`);
    } catch (err) {
      logger.error("Error starting atendimento:", err);
      toast.error("Erro ao iniciar atendimento");
    }
  };

  const handleMarkConcluida = async (triageId: string) => {
    try {
      const { error } = await api
        .from("triage_records")
        .update({ status: "concluida" })
        .eq("id", triageId);
      if (error) throw error;
      toast.success("Triagem marcada como concluída");
      fetchTriagens();
    } catch (err) {
      logger.error("Error marking triage as concluida:", err);
      toast.error("Erro ao atualizar triagem");
    }
  };

  const imc = (t: Triagem) => {
    const w = parseFloat(t.weight);
    const h = parseFloat(t.height) / 100;
    if (!w || !h) return null;
    return (w / (h * h)).toFixed(1);
  };

  return (
    <MainLayout
      title="Triagem & Anamnese"
      subtitle="Avaliação inicial e sinais vitais dos pacientes"
      actions={
        <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Triagem
        </Button>
      }
    >
      {/* Busca + Filtro de status */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente ou queixa..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Aguardando</SelectItem>
            <SelectItem value="em_atendimento">Em atendimento</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma triagem registrada"
          description="Registre a triagem dos pacientes com sinais vitais e queixas."
          action={
            <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nova Triagem
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => {
            const config = priorityConfig[t.priority];
            const PriorityIcon = config.icon;
            const imcValue = imc(t);
            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{t.client_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(t.triaged_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          <span>·</span>{t.performed_by}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${statusConfig[t.status].color} flex items-center gap-1 text-xs`}>
                        {statusConfig[t.status].label}
                      </Badge>
                      <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
                        <PriorityIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Queixa */}
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">Queixa: </span>{t.chief_complaint}
                    {t.pain_scale && <span className="ml-2 text-muted-foreground">(Dor: {t.pain_scale}/10)</span>}
                  </div>

                  {/* Sinais Vitais */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {t.blood_pressure_systolic && (
                      <div className="rounded-lg border p-2 text-center">
                        <Heart className="h-3.5 w-3.5 text-red-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">PA</p>
                        <p className="text-sm font-semibold">{t.blood_pressure_systolic}/{t.blood_pressure_diastolic}</p>
                        <p className="text-xs text-muted-foreground">mmHg</p>
                      </div>
                    )}
                    {t.heart_rate && (
                      <div className="rounded-lg border p-2 text-center">
                        <Activity className="h-3.5 w-3.5 text-pink-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">FC</p>
                        <p className="text-sm font-semibold">{t.heart_rate}</p>
                        <p className="text-xs text-muted-foreground">bpm</p>
                      </div>
                    )}
                    {t.temperature && (
                      <div className="rounded-lg border p-2 text-center">
                        <Thermometer className="h-3.5 w-3.5 text-orange-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Temp.</p>
                        <p className="text-sm font-semibold">{t.temperature}°C</p>
                      </div>
                    )}
                    {t.oxygen_saturation && (
                      <div className="rounded-lg border p-2 text-center">
                        <Wind className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">SpO₂</p>
                        <p className="text-sm font-semibold">{t.oxygen_saturation}%</p>
                      </div>
                    )}
                    {t.weight && t.height && (
                      <div className="rounded-lg border p-2 text-center">
                        <User className="h-3.5 w-3.5 text-purple-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">IMC</p>
                        <p className="text-sm font-semibold">{imcValue}</p>
                      </div>
                    )}
                    {t.respiratory_rate && (
                      <div className="rounded-lg border p-2 text-center">
                        <Wind className="h-3.5 w-3.5 text-teal-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">FR</p>
                        <p className="text-sm font-semibold">{t.respiratory_rate}</p>
                        <p className="text-xs text-muted-foreground">irpm</p>
                      </div>
                    )}
                  </div>

                  {(t.allergies || t.current_medications || t.medical_history) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      {t.allergies && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                          <p className="font-medium text-destructive text-xs mb-0.5">Alergias</p>
                          <p className="text-muted-foreground">{t.allergies}</p>
                        </div>
                      )}
                      {t.current_medications && (
                        <div className="rounded-lg border px-3 py-2">
                          <p className="font-medium text-xs mb-0.5">Medicamentos</p>
                          <p className="text-muted-foreground">{t.current_medications}</p>
                        </div>
                      )}
                      {t.medical_history && (
                        <div className="rounded-lg border px-3 py-2">
                          <p className="font-medium text-xs mb-0.5">Histórico</p>
                          <p className="text-muted-foreground">{t.medical_history}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Ações da Triagem */}
                  {t.status !== "concluida" && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      {t.status === "pendente" && (
                        <Button
                          size="sm"
                          variant="gradient"
                          onClick={() => handleStartAtendimento(t)}
                        >
                          <Stethoscope className="mr-2 h-4 w-4" />
                          Iniciar Atendimento
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                      {t.status === "em_atendimento" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkConcluida(t.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Marcar Concluída
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const params = new URLSearchParams({
                                patient_id: t.patient_id,
                                triage_id: t.id,
                                new: "1",
                              });
                              if (t.appointment_id) params.set("appointment_id", t.appointment_id);
                              navigate(`/prontuarios?${params.toString()}`);
                            }}
                          >
                            <Stethoscope className="mr-2 h-4 w-4" />
                            Continuar Atendimento
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Nova Triagem"
        description="Registre os sinais vitais e anamnese inicial do paciente"
        width="lg"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Salvar Triagem"
      >
        <Tabs defaultValue="identificacao" className="mt-2 flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            <TabsTrigger value="sinais">Sinais Vitais</TabsTrigger>
            <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
            <TabsTrigger value="ia-triage" className="gap-1"><Sparkles className="h-3 w-3" />IA</TabsTrigger>
          </TabsList>

          {/* Tab 1: Identificação */}
          <TabsContent value="identificacao" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.patient_id} onValueChange={(v) => setFormData({ ...formData, patient_id: v, appointment_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.patient_id && appointments.filter((a) => a.patient_id === formData.patient_id).length > 0 && (
              <div className="space-y-2">
                <Label>Agendamento do Dia (opcional)</Label>
                <Select value={formData.appointment_id} onValueChange={(v) => setFormData({ ...formData, appointment_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Vincular a um agendamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {appointments.filter((a) => a.patient_id === formData.patient_id).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {a.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Prioridade / Classificação de Risco</Label>
              <Select
                value={formData.priority}
                onValueChange={(v: any) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergencia"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 mr-2" />Emergência</SelectItem>
                  <SelectItem value="urgente"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500 mr-2" />Urgente</SelectItem>
                  <SelectItem value="pouco_urgente"><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500 mr-2" />Pouco Urgente</SelectItem>
                  <SelectItem value="nao_urgente"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 mr-2" />Não Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Queixa Principal *</Label>
              <Textarea
                value={formData.chief_complaint}
                onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                placeholder="Motivo da consulta, sintomas principais..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Escala de Dor (0-10)</Label>
              <Input
                type="number"
                min="0"
                max="10"
                value={formData.pain_scale}
                onChange={(e) => setFormData({ ...formData, pain_scale: e.target.value })}
                placeholder="0 = sem dor, 10 = dor máxima"
              />
            </div>
          </TabsContent>

          {/* Tab 2: Sinais Vitais */}
          <TabsContent value="sinais" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pressão Sistólica (mmHg)</Label>
                <Input
                  type="number"
                  value={formData.blood_pressure_systolic}
                  onChange={(e) => setFormData({ ...formData, blood_pressure_systolic: e.target.value })}
                  placeholder="Ex: 120"
                />
              </div>
              <div className="space-y-2">
                <Label>Pressão Diastólica (mmHg)</Label>
                <Input
                  type="number"
                  value={formData.blood_pressure_diastolic}
                  onChange={(e) => setFormData({ ...formData, blood_pressure_diastolic: e.target.value })}
                  placeholder="Ex: 80"
                />
              </div>
              <div className="space-y-2">
                <Label>Freq. Cardíaca (bpm)</Label>
                <Input
                  type="number"
                  value={formData.heart_rate}
                  onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                  placeholder="Ex: 72"
                />
              </div>
              <div className="space-y-2">
                <Label>Freq. Respiratória (irpm)</Label>
                <Input
                  type="number"
                  value={formData.respiratory_rate}
                  onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })}
                  placeholder="Ex: 16"
                />
              </div>
              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  placeholder="Ex: 36.8"
                />
              </div>
              <div className="space-y-2">
                <Label>Saturação O₂ (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.oxygen_saturation}
                  onChange={(e) => setFormData({ ...formData, oxygen_saturation: e.target.value })}
                  placeholder="Ex: 98"
                />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="Ex: 70"
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="Ex: 170"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Anamnese */}
          <TabsContent value="anamnese" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Alergias Conhecidas</Label>
              <Input
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="Medicamentos, alimentos, substâncias..."
              />
            </div>
            <div className="space-y-2">
              <Label>Medicamentos em Uso</Label>
              <Textarea
                value={formData.current_medications}
                onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
                placeholder="Nome, dose e frequência..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Antecedentes Médicos</Label>
              <Textarea
                value={formData.medical_history}
                onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                placeholder="Doenças crônicas, cirurgias anteriores, internações..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações da Triagem</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais do profissional de enfermagem..."
                rows={2}
              />
            </div>
          </TabsContent>

          {/* Tab 4: Triagem IA */}
          <TabsContent value="ia-triage" className="mt-4 flex-1 flex flex-col min-h-0">
            <AiTriageChatbot
              onComplete={(result) => {
                if (result.urgency) {
                  const urgencyMap: Record<string, string> = {
                    EMERGENCIA: "emergencia",
                    URGENTE: "urgente",
                    ROTINA: "nao_urgente",
                  };
                  setFormData((prev: any) => ({
                    ...prev,
                    priority: urgencyMap[result.urgency!] || prev.priority,
                    chief_complaint: prev.chief_complaint || result.messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join(". "),
                  }));
                  toast.success(`Triagem IA: ${result.specialty} — ${result.urgency}`);
                }
              }}
              className="flex-1"
            />
          </TabsContent>
        </Tabs>
      </FormDrawer>
    </MainLayout>
  );
}
