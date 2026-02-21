import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardList, Plus, Search, User, Calendar,
  FileText, AlertCircle, Pill, Heart,
  ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle2, Stethoscope,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { ProntuarioForm } from "@/components/prontuario/ProntuarioForm";
import type { TriageData } from "@/components/prontuario/TriageContextCard";
import type { TemplateField } from "@/components/prontuario/DynamicFieldsRenderer";

interface Client { id: string; name: string; phone?: string; email?: string; }
interface Template { id: string; name: string; specialty_id: string | null; fields: TemplateField[]; is_default: boolean; }

interface MedicalRecord {
  id: string; client_id: string; client_name: string; appointment_date: string;
  professional_name: string; chief_complaint: string; anamnesis: string;
  physical_exam: string; diagnosis: string; cid_code: string;
  treatment_plan: string; prescriptions: string; notes: string; created_at: string;
}

interface PendingTriage {
  id: string; client_id: string; client_name: string; priority: string;
  chief_complaint: string; triaged_at: string; appointment_id: string | null;
  raw: TriageData;
}

const priorityConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  emergencia: { label: "Emergência", color: "bg-red-500/20 text-red-600 border-red-500/30", icon: AlertTriangle },
  urgente: { label: "Urgente", color: "bg-orange-500/20 text-orange-600 border-orange-500/30", icon: AlertTriangle },
  pouco_urgente: { label: "Pouco Urgente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30", icon: Clock },
  nao_urgente: { label: "Não Urgente", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
};

export default function Prontuarios() {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pendingTriages, setPendingTriages] = useState<PendingTriage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Panel state: null = list view, object = form open
  const [formState, setFormState] = useState<{
    clientId?: string; appointmentId?: string; triage?: TriageData | null;
  } | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchRecords();
      fetchTemplates();
      fetchPendingTriages();
    }
  }, [profile?.tenant_id]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase.from("clients")
        .select("id, name, phone, email").eq("tenant_id", profile.tenant_id).order("name");
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (err) { logger.error("Fetch clients:", err); }
  };

  const fetchRecords = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("medical_records")
        .select("*, clients(name), profiles(full_name)")
        .eq("tenant_id", profile.tenant_id).order("record_date", { ascending: false });
      if (error) throw error;
      setRecords((data || []).map((r: any) => ({
        id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? "—",
        appointment_date: r.record_date, professional_name: r.profiles?.full_name ?? "—",
        chief_complaint: r.chief_complaint ?? "", anamnesis: r.anamnesis ?? "",
        physical_exam: r.physical_exam ?? "", diagnosis: r.diagnosis ?? "",
        cid_code: r.cid_code ?? "", treatment_plan: r.treatment_plan ?? "",
        prescriptions: r.prescriptions ?? "", notes: r.notes ?? "", created_at: r.created_at,
      })));
    } catch (err) { logger.error("Fetch records:", err); }
    finally { setIsLoading(false); }
  };

  const fetchTemplates = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase.from("record_field_templates")
        .select("id, name, specialty_id, fields, is_default")
        .eq("tenant_id", profile.tenant_id).order("name");
      if (error) throw error;
      setTemplates((data ?? []).map((r: any) => ({
        id: r.id, name: r.name, specialty_id: r.specialty_id,
        fields: (r.fields as TemplateField[]) ?? [], is_default: r.is_default,
      })));
    } catch (err) { logger.error("Fetch templates:", err); }
  };

  const fetchPendingTriages = async () => {
    if (!profile?.tenant_id) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.from("triage_records")
        .select("*, clients(name)")
        .eq("tenant_id", profile.tenant_id).eq("status", "pendente")
        .gte("triaged_at", `${today}T00:00:00`)
        .order("triaged_at", { ascending: true });
      if (error) throw error;
      setPendingTriages((data || []).map((r: any) => ({
        id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? "—",
        priority: r.priority, chief_complaint: r.chief_complaint,
        triaged_at: r.triaged_at, appointment_id: r.appointment_id ?? null,
        raw: {
          id: r.id, priority: r.priority, triaged_at: r.triaged_at, performed_by: "",
          blood_pressure_systolic: r.blood_pressure_systolic,
          blood_pressure_diastolic: r.blood_pressure_diastolic,
          heart_rate: r.heart_rate, respiratory_rate: r.respiratory_rate,
          temperature: r.temperature, oxygen_saturation: r.oxygen_saturation,
          weight_kg: r.weight_kg, height_cm: r.height_cm,
          chief_complaint: r.chief_complaint, pain_scale: r.pain_scale,
          allergies: r.allergies, current_medications: r.current_medications,
          medical_history: r.medical_history, notes: r.notes,
        },
      })));
    } catch (err) { logger.error("Fetch pending triages:", err); }
  };

  const openFormFromTriage = (t: PendingTriage) => {
    setFormState({ clientId: t.client_id, appointmentId: t.appointment_id ?? undefined, triage: t.raw });
  };

  const onFormSaved = () => {
    setFormState(null);
    fetchRecords();
    fetchPendingTriages();
  };

  const filteredRecords = records.filter((r) =>
    r.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.cid_code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const clientRecords = selectedClientId !== "all"
    ? filteredRecords.filter((r) => r.client_id === selectedClientId) : filteredRecords;

  // ── FORM VIEW ──
  if (formState) {
    return (
      <MainLayout title="Novo Prontuário" subtitle="Registro clínico do atendimento">
        <div className="max-w-4xl mx-auto">
          <ProntuarioForm
            tenantId={profile!.tenant_id}
            professionalId={profile!.id}
            clients={clients}
            templates={templates}
            initialClientId={formState.clientId}
            initialAppointmentId={formState.appointmentId}
            initialTriage={formState.triage}
            onSaved={onFormSaved}
            onCancel={() => setFormState(null)}
          />
        </div>
      </MainLayout>
    );
  }

  // ── LIST VIEW ──
  return (
    <MainLayout
      title="Prontuários Eletrônicos"
      subtitle="Histórico clínico completo dos pacientes"
      actions={
        <Button className="gradient-primary text-primary-foreground" onClick={() => setFormState({})}>
          <Plus className="mr-2 h-4 w-4" /> Novo Prontuário
        </Button>
      }
    >
      {/* Fila de Atendimento */}
      {pendingTriages.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Aguardando Atendimento ({pendingTriages.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTriages.map((t) => {
              const pc = priorityConfig[t.priority] || priorityConfig.nao_urgente;
              const PIcon = pc.icon;
              return (
                <Card key={t.id} className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                  onClick={() => openFormFromTriage(t)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.triaged_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${pc.color} text-xs flex items-center gap-1`}>
                        <PIcon className="h-3 w-3" />{pc.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.chief_complaint}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Busca + Filtro */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente, diagnóstico ou CID..." className="pl-10" />
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Filtrar por paciente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pacientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Prontuários */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : clientRecords.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum prontuário encontrado"
          description="Crie o primeiro prontuário clínico ou atenda uma triagem pendente."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={() => setFormState({})}>
              <Plus className="mr-2 h-4 w-4" /> Novo Prontuário
            </Button>
          } />
      ) : (
        <div className="space-y-3">
          {clientRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{record.client_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(record.appointment_date).toLocaleDateString("pt-BR")}
                        <span>·</span>{record.professional_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.cid_code && (
                      <Badge variant="outline" className="text-xs font-mono">CID: {record.cid_code}</Badge>
                    )}
                    <Button variant="ghost" size="sm"
                      onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}>
                      {expandedRecord === record.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium text-muted-foreground">Queixa: </span>{record.chief_complaint}
                </div>
                {expandedRecord === record.id && (
                  <Tabs defaultValue="anamnese" className="mt-4">
                    <TabsList className="grid w-full grid-cols-4 h-auto gap-1 p-1">
                      <TabsTrigger value="anamnese" className="text-xs py-2"><FileText className="h-3 w-3 mr-1" />Anamnese</TabsTrigger>
                      <TabsTrigger value="exame" className="text-xs py-2"><Heart className="h-3 w-3 mr-1" />Exame</TabsTrigger>
                      <TabsTrigger value="diagnostico" className="text-xs py-2"><AlertCircle className="h-3 w-3 mr-1" />Diagnóstico</TabsTrigger>
                      <TabsTrigger value="prescricao" className="text-xs py-2"><Pill className="h-3 w-3 mr-1" />Prescrição</TabsTrigger>
                    </TabsList>
                    <TabsContent value="anamnese" className="mt-3 text-sm">
                      <p className="text-muted-foreground">{record.anamnesis || "—"}</p>
                    </TabsContent>
                    <TabsContent value="exame" className="mt-3 text-sm">
                      <p className="text-muted-foreground">{record.physical_exam || "—"}</p>
                    </TabsContent>
                    <TabsContent value="diagnostico" className="mt-3 text-sm space-y-2">
                      <div><span className="font-medium">Diagnóstico: </span>{record.diagnosis || "—"}</div>
                      <div><span className="font-medium">Plano terapêutico: </span>{record.treatment_plan || "—"}</div>
                      {record.notes && <div><span className="font-medium">Observações: </span>{record.notes}</div>}
                    </TabsContent>
                    <TabsContent value="prescricao" className="mt-3 text-sm">
                      <p className="text-muted-foreground whitespace-pre-line">{record.prescriptions || "Nenhuma prescrição registrada."}</p>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
