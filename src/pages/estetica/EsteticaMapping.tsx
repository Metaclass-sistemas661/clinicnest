/**
 * EsteticaMapping — Página principal do módulo estética.
 * R13: Face/Body Mapping interativo com zonas clicáveis + quantidades.
 * Compõe AestheticChart + BeforeAfterGallery + ProductUsagePanel.
 * Inclui busca de paciente, histórico de sessões, anamnese estética,
 * protocolo de tratamento e alerta de retoque.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  MapPin,
  Camera,
  Package,
  Search,
  History,
  ClipboardList,
  CalendarClock,
  AlertTriangle,
  User,
  Calendar,
  Loader2,
} from "lucide-react";
import { AestheticChart } from "@/components/estetica/AestheticChart";
import { BeforeAfterGallery } from "@/components/estetica/BeforeAfterGallery";
import { ProductUsagePanel, type ProductUsageRecord } from "@/components/estetica/ProductUsagePanel";
import {
  GLOGAU_SCALE,
  AESTHETIC_PROCEDURES,
  type ZoneApplication,
  type GlogauType,
} from "@/components/estetica/aestheticConstants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

interface PatientOption {
  id: string;
  name: string;
  phone?: string | null;
}

interface SessionRecord {
  id: string;
  session_date: string;
  professional_name?: string;
  glogau_type?: string | null;
  clinical_notes?: string | null;
  applications: ZoneApplication[];
  product_usages: ProductUsageRecord[];
}

interface AestheticAnamnesis {
  fitzpatrick: string;
  skin_type: string;
  allergies: string;
  isotretinoin: boolean;
  pregnant: boolean;
  previous_procedures: string;
  expectations: string;
}

interface TreatmentProtocol {
  id: string;
  name: string;
  procedure: string;
  total_sessions: number;
  completed_sessions: number;
  interval_days: number;
  next_session_date: string | null;
  notes: string;
}

const DEFAULT_ANAMNESIS: AestheticAnamnesis = {
  fitzpatrick: "",
  skin_type: "",
  allergies: "",
  isotretinoin: false,
  pregnant: false,
  previous_procedures: "",
  expectations: "",
};

const FITZPATRICK_SCALE = [
  { value: "I", label: "Tipo I — Pele muito clara, sempre queima" },
  { value: "II", label: "Tipo II — Pele clara, queima facilmente" },
  { value: "III", label: "Tipo III — Pele morena clara, queima moderadamente" },
  { value: "IV", label: "Tipo IV — Pele morena, raramente queima" },
  { value: "V", label: "Tipo V — Pele morena escura, muito raramente queima" },
  { value: "VI", label: "Tipo VI — Pele negra, nunca queima" },
];

const SKIN_TYPES = [
  { value: "normal", label: "Normal" },
  { value: "seca", label: "Seca" },
  { value: "oleosa", label: "Oleosa" },
  { value: "mista", label: "Mista" },
  { value: "sensivel", label: "Sensível" },
];

export default function EsteticaMapping() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get("paciente");

  // ── Patient search ──
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState(patientIdFromUrl || "");
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [searchingPatients, setSearchingPatients] = useState(false);

  // ── Session state ──
  const [applications, setApplications] = useState<ZoneApplication[]>([]);
  const [glogau, setGlogau] = useState<GlogauType | "">("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [productUsages, setProductUsages] = useState<ProductUsageRecord[]>([]);

  // ── History ──
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Anamnesis ──
  const [anamnesis, setAnamnesis] = useState<AestheticAnamnesis>(DEFAULT_ANAMNESIS);
  const [savingAnamnesis, setSavingAnamnesis] = useState(false);

  // ── Protocols ──
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [newProtocol, setNewProtocol] = useState({
    name: "", procedure: "", total_sessions: 4, interval_days: 30, notes: "",
  });

  // ── Patient search with debounce ──
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(() => {
      searchPatientsDb();
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, profile?.tenant_id]);

  const searchPatientsDb = async () => {
    if (!profile?.tenant_id) return;
    setSearchingPatients(true);
    try {
      const { data } = await (supabase
        .from("patients") as any)
        .select("id, name, phone")
        .eq("tenant_id", profile.tenant_id)
        .ilike("name", `%${patientSearch}%`)
        .limit(20);
      setPatients((data ?? []) as PatientOption[]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = useCallback(async (pid: string) => {
    setSelectedPatient(pid);
    const found = patients.find(p => p.id === pid);
    if (found) setSelectedPatientName(found.name);
    setSearchParams({ paciente: pid });

    // Load history + anamnesis + protocols
    if (profile?.tenant_id) {
      loadSessionHistory(pid);
      loadAnamnesis(pid);
      loadProtocols(pid);
    }
  }, [patients, profile?.tenant_id]);

  // ── Load initial patient if from URL ──
  useEffect(() => {
    if (patientIdFromUrl && profile?.tenant_id) {
      setSelectedPatient(patientIdFromUrl);
      loadSessionHistory(patientIdFromUrl);
      loadAnamnesis(patientIdFromUrl);
      loadProtocols(patientIdFromUrl);
      // Fetch patient name
      supabase.from("patients").select("name").eq("id", patientIdFromUrl).single()
        .then(({ data }) => {
          if (data) setSelectedPatientName((data as any).name);
        });
    }
  }, [patientIdFromUrl, profile?.tenant_id]);

  // ── Session history ──
  const loadSessionHistory = async (pid: string) => {
    if (!profile?.tenant_id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await (supabase
        .from("aesthetic_sessions") as any)
        .select("id, session_date, glogau_type, clinical_notes, applications, product_usages, profiles!aesthetic_sessions_professional_id_fkey(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("patient_id", pid)
        .order("session_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      setSessionHistory(
        ((data as any[]) || []).map((s: any) => ({
          id: s.id,
          session_date: s.session_date,
          professional_name: s.profiles?.full_name || "—",
          glogau_type: s.glogau_type,
          clinical_notes: s.clinical_notes,
          applications: s.applications || [],
          product_usages: s.product_usages || [],
        }))
      );
    } catch {
      setSessionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Anamnesis CRUD ──
  const loadAnamnesis = async (pid: string) => {
    if (!profile?.tenant_id) return;
    try {
      const { data } = await (supabase
        .from("aesthetic_anamnesis") as any)
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("patient_id", pid)
        .single();
      if (data) {
        setAnamnesis({
          fitzpatrick: (data as any).fitzpatrick || "",
          skin_type: (data as any).skin_type || "",
          allergies: (data as any).allergies || "",
          isotretinoin: (data as any).isotretinoin || false,
          pregnant: (data as any).pregnant || false,
          previous_procedures: (data as any).previous_procedures || "",
          expectations: (data as any).expectations || "",
        });
      } else {
        setAnamnesis(DEFAULT_ANAMNESIS);
      }
    } catch {
      setAnamnesis(DEFAULT_ANAMNESIS);
    }
  };

  const saveAnamnesis = async () => {
    if (!profile?.tenant_id || !selectedPatient) return;
    setSavingAnamnesis(true);
    try {
      const { error } = await (supabase
        .from("aesthetic_anamnesis") as any)
        .upsert({
          tenant_id: profile.tenant_id,
          patient_id: selectedPatient,
          ...anamnesis,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,patient_id" });
      if (error) throw error;
      toast.success("Anamnese estética salva!");
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSavingAnamnesis(false);
    }
  };

  // ── Protocols CRUD ──
  const loadProtocols = async (pid: string) => {
    if (!profile?.tenant_id) return;
    try {
      const { data } = await (supabase
        .from("aesthetic_protocols") as any)
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("patient_id", pid)
        .order("created_at", { ascending: false });
      setProtocols((data || []) as TreatmentProtocol[]);
    } catch {
      setProtocols([]);
    }
  };

  const addProtocol = async () => {
    if (!profile?.tenant_id || !selectedPatient || !newProtocol.name) {
      toast.error("Preencha o nome do protocolo");
      return;
    }
    try {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + newProtocol.interval_days);
      const { error } = await (supabase
        .from("aesthetic_protocols") as any)
        .insert({
          tenant_id: profile.tenant_id,
          patient_id: selectedPatient,
          name: newProtocol.name,
          procedure: newProtocol.procedure,
          total_sessions: newProtocol.total_sessions,
          completed_sessions: 0,
          interval_days: newProtocol.interval_days,
          next_session_date: nextDate.toISOString(),
          notes: newProtocol.notes,
        });
      if (error) throw error;
      toast.success("Protocolo criado!");
      setNewProtocol({ name: "", procedure: "", total_sessions: 4, interval_days: 30, notes: "" });
      loadProtocols(selectedPatient);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const markProtocolSession = async (protocol: TreatmentProtocol) => {
    try {
      const completed = protocol.completed_sessions + 1;
      const nextDate = completed < protocol.total_sessions
        ? new Date(Date.now() + protocol.interval_days * 86400000).toISOString()
        : null;
      const { error } = await (supabase
        .from("aesthetic_protocols") as any)
        .update({
          completed_sessions: completed,
          next_session_date: nextDate,
        })
        .eq("id", protocol.id);
      if (error) throw error;
      toast.success(`Sessão ${completed}/${protocol.total_sessions} registrada!`);
      loadProtocols(selectedPatient);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  // ── Retouch alerts ──
  const retouchAlerts = useMemo(() => {
    if (!sessionHistory.length) return [];
    const alerts: Array<{ procedure: string; lastDate: string; daysAgo: number; alertLevel: "ok" | "warning" | "overdue" }> = [];
    const toxinaThreshold = 120; // 4 months
    const preenchThreshold = 365; // 12 months

    const procedureLastDate: Record<string, string> = {};
    for (const session of sessionHistory) {
      for (const app of session.applications) {
        if (!procedureLastDate[app.procedure]) {
          procedureLastDate[app.procedure] = session.session_date;
        }
      }
    }

    for (const [proc, dateStr] of Object.entries(procedureLastDate)) {
      const daysAgo = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
      const threshold = proc === "toxina_botulinica" ? toxinaThreshold : preenchThreshold;
      const label = AESTHETIC_PROCEDURES.find(p => p.value === proc)?.label ?? proc;
      let alertLevel: "ok" | "warning" | "overdue" = "ok";
      if (daysAgo >= threshold) alertLevel = "overdue";
      else if (daysAgo >= threshold * 0.8) alertLevel = "warning";

      if (alertLevel !== "ok") {
        alerts.push({ procedure: label, lastDate: dateStr, daysAgo, alertLevel });
      }
    }
    return alerts;
  }, [sessionHistory]);

  // ── Save session ──
  const handleSave = useCallback(async () => {
    if (!profile?.tenant_id || !selectedPatient) {
      toast.error("Selecione um paciente para salvar o mapeamento");
      return;
    }
    if (applications.length === 0) {
      toast.error("Adicione pelo menos uma aplicação");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase.from("aesthetic_sessions") as any).insert({
        tenant_id: profile.tenant_id,
        patient_id: selectedPatient,
        professional_id: profile.id,
        applications,
        product_usages: productUsages,
        glogau_type: glogau || null,
        clinical_notes: clinicalNotes || null,
        session_date: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Sessão estética salva com sucesso!");
      setApplications([]);
      setProductUsages([]);
      setGlogau("");
      setClinicalNotes("");
      loadSessionHistory(selectedPatient);
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [profile, selectedPatient, applications, productUsages, glogau, clinicalNotes]);

  return (
    <MainLayout
      title="Mapeamento Estético"
      subtitle={selectedPatientName ? `Paciente: ${selectedPatientName}` : "Selecione um paciente"}
      actions={
        <Button onClick={handleSave} disabled={saving || applications.length === 0 || !selectedPatient}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Sessão"}
        </Button>
      }
    >
    <div className="space-y-6">
      {/* ── Patient search bar ── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs font-medium">Buscar Paciente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Digite o nome do paciente..."
                  className="pl-10"
                />
                {searchingPatients && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            {patients.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Paciente</Label>
                <Select value={selectedPatient} onValueChange={handleSelectPatient}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.phone ? ` • ${p.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedPatientName && (
              <Badge variant="secondary" className="gap-1.5 py-1.5">
                <User className="h-3 w-3" />
                {selectedPatientName}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Retouch alerts ── */}
      {retouchAlerts.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Alertas de Retoque</span>
            </div>
            <div className="space-y-1">
              {retouchAlerts.map((a) => (
                <div key={a.procedure} className={cn(
                  "flex items-center justify-between text-xs px-3 py-1.5 rounded-lg",
                  a.alertLevel === "overdue" ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                )}>
                  <span>{a.procedure}</span>
                  <span className="font-medium">
                    {a.alertLevel === "overdue" ? "Vencido" : "Próximo"} — {a.daysAgo} dias atrás
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main tabs ── */}
      <Tabs defaultValue="mapeamento" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="mapeamento" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Mapeamento
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Anamnese
          </TabsTrigger>
          <TabsTrigger value="fotos" className="gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Fotos
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="protocolos" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Protocolos
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 – Mapeamento de zonas */}
        <TabsContent value="mapeamento" className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Label className="text-sm text-muted-foreground">Classificação Glogau:</Label>
            <Select value={glogau} onValueChange={(v) => setGlogau(v as GlogauType)}>
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="Selecionar tipo…" />
              </SelectTrigger>
              <SelectContent>
                {GLOGAU_SCALE.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AestheticChart
            applications={applications}
            onApplicationsChange={setApplications}
            showStats
            showLegend
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Observações Clínicas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Orientações pós-procedimento, reações observadas, próximos passos…"
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2 – Anamnese Estética */}
        <TabsContent value="anamnese" className="space-y-4">
          {!selectedPatient ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ClipboardList className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Selecione um paciente para preencher a anamnese estética</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Anamnese Estética</CardTitle>
                <CardDescription className="text-xs">Dados clínicos do paciente para procedimentos estéticos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fitzpatrick */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fototipo (Fitzpatrick)</Label>
                    <Select value={anamnesis.fitzpatrick} onValueChange={(v) => setAnamnesis(a => ({ ...a, fitzpatrick: v }))}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecionar fototipo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {FITZPATRICK_SCALE.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Skin Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Pele</Label>
                    <Select value={anamnesis.skin_type} onValueChange={(v) => setAnamnesis(a => ({ ...a, skin_type: v }))}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecionar tipo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKIN_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anamnesis.isotretinoin}
                      onChange={(e) => setAnamnesis(a => ({ ...a, isotretinoin: e.target.checked }))}
                      className="rounded"
                    />
                    Uso de Isotretinoína (últimos 6 meses)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anamnesis.pregnant}
                      onChange={(e) => setAnamnesis(a => ({ ...a, pregnant: e.target.checked }))}
                      className="rounded"
                    />
                    Gestante / Lactante
                  </label>
                </div>

                {/* Allergies */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Alergias</Label>
                  <Textarea
                    value={anamnesis.allergies}
                    onChange={(e) => setAnamnesis(a => ({ ...a, allergies: e.target.value }))}
                    placeholder="Alergia a lidocaína, látex, ácido hialurônico..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Previous procedures */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Procedimentos Estéticos Anteriores</Label>
                  <Textarea
                    value={anamnesis.previous_procedures}
                    onChange={(e) => setAnamnesis(a => ({ ...a, previous_procedures: e.target.value }))}
                    placeholder="Toxina há 6 meses, preenchimento labial há 1 ano..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Expectations */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Expectativas do Paciente</Label>
                  <Textarea
                    value={anamnesis.expectations}
                    onChange={(e) => setAnamnesis(a => ({ ...a, expectations: e.target.value }))}
                    placeholder="Descreva as expectativas e objetivos..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <Button onClick={saveAnamnesis} disabled={savingAnamnesis} className="gap-2">
                  {savingAnamnesis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Anamnese
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3 – Fotos Antes/Depois */}
        <TabsContent value="fotos">
          {selectedPatient ? (
            <BeforeAfterGallery pairs={[]} onPairsChange={() => {}} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Camera className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Selecione um paciente para gerenciar fotos antes/depois</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 4 – Produtos utilizados */}
        <TabsContent value="produtos">
          <ProductUsagePanel
            usages={productUsages}
            products={[]}
            onUsagesChange={setProductUsages}
          />
        </TabsContent>

        {/* Tab 5 – Protocolos de Tratamento */}
        <TabsContent value="protocolos" className="space-y-4">
          {!selectedPatient ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarClock className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Selecione um paciente para gerenciar protocolos</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Existing protocols */}
              {protocols.length > 0 && (
                <div className="space-y-3">
                  {protocols.map((p) => {
                    const progress = p.total_sessions > 0
                      ? Math.round((p.completed_sessions / p.total_sessions) * 100)
                      : 0;
                    const isComplete = p.completed_sessions >= p.total_sessions;
                    const procLabel = AESTHETIC_PROCEDURES.find(pr => pr.value === p.procedure)?.label || p.procedure;
                    return (
                      <Card key={p.id} className={cn(isComplete && "opacity-60")}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{procLabel} • {p.interval_days} dias entre sessões</p>
                            </div>
                            <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                              {p.completed_sessions}/{p.total_sessions} sessões
                            </Badge>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-muted rounded-full mb-2">
                            <div
                              className={cn("h-2 rounded-full transition-all", isComplete ? "bg-green-500" : "bg-primary")}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            {p.next_session_date && !isComplete ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Próxima: {new Date(p.next_session_date).toLocaleDateString("pt-BR")}
                              </span>
                            ) : (
                              <span>{isComplete ? "✓ Protocolo concluído" : ""}</span>
                            )}
                            {!isComplete && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markProtocolSession(p)}>
                                Registrar sessão
                              </Button>
                            )}
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">{p.notes}</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* New protocol form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Novo Protocolo de Tratamento</CardTitle>
                  <CardDescription className="text-xs">Planeje sessões recorrentes para o paciente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do Protocolo</Label>
                      <Input
                        value={newProtocol.name}
                        onChange={(e) => setNewProtocol(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ex: Rejuvenescimento facial"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Procedimento Principal</Label>
                      <Select
                        value={newProtocol.procedure}
                        onValueChange={(v) => setNewProtocol(p => ({ ...p, procedure: v }))}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {AESTHETIC_PROCEDURES.map(pr => (
                            <SelectItem key={pr.value} value={pr.value}>{pr.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total de Sessões</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={newProtocol.total_sessions}
                        onChange={(e) => setNewProtocol(p => ({ ...p, total_sessions: parseInt(e.target.value) || 1 }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo (dias)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={newProtocol.interval_days}
                        onChange={(e) => setNewProtocol(p => ({ ...p, interval_days: parseInt(e.target.value) || 30 }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={newProtocol.notes}
                      onChange={(e) => setNewProtocol(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Instruções especiais, cuidados pré/pós..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <Button onClick={addProtocol} className="gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Criar Protocolo
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 6 – Histórico de Sessões */}
        <TabsContent value="historico" className="space-y-4">
          {!selectedPatient ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Selecione um paciente para ver o histórico</p>
              </CardContent>
            </Card>
          ) : loadingHistory ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : sessionHistory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Nenhuma sessão registrada para este paciente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessionHistory.map((session) => {
                const totalApps = session.applications.length;
                const procedures = [...new Set(session.applications.map(a => a.procedure))];
                const procLabels = procedures.map(p => AESTHETIC_PROCEDURES.find(pr => pr.value === p)?.label ?? p);
                return (
                  <Card key={session.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {new Date(session.session_date).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "long", year: "numeric",
                              })}
                            </span>
                          </div>
                          {session.professional_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">Por: {session.professional_name}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {session.glogau_type && (
                            <Badge variant="outline" className="text-[10px]">Glogau {session.glogau_type}</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">{totalApps} aplicações</Badge>
                        </div>
                      </div>
                      {/* Procedures summary */}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {procLabels.map(label => (
                          <Badge key={label} variant="outline" className="text-[10px] font-normal">{label}</Badge>
                        ))}
                      </div>
                      {session.clinical_notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">{session.clinical_notes}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  );
}
