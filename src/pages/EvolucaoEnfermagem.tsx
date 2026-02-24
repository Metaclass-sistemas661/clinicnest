import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clipboard, Plus, RefreshCw, Search, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NANDA_DIAGNOSES, NIC_INTERVENTIONS, NOC_OUTCOMES } from "@/data/nanda-nic-noc";
import { NandaNicNocCombobox } from "@/components/ui/nanda-nic-noc-combobox";

interface NursingEvolution {
  id: string;
  client_name: string;
  professional_name: string;
  evolution_date: string;
  nanda_code: string | null;
  nanda_diagnosis: string;
  nic_code: string | null;
  nic_intervention: string | null;
  nic_activities: string | null;
  noc_code: string | null;
  noc_outcome: string | null;
  noc_score_initial: number | null;
  noc_score_current: number | null;
  noc_score_target: number | null;
  notes: string | null;
  status: string;
}

interface ClientOption { id: string; name: string; }

interface RecentAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  medical_record_id: string | null;
}


const emptyForm = {
  client_id: "",
  appointment_id: "",
  nanda_code: "",
  nanda_diagnosis: "",
  nic_code: "",
  nic_intervention: "",
  nic_activities: "",
  noc_code: "",
  noc_outcome: "",
  noc_score_initial: "3",
  noc_score_current: "3",
  noc_score_target: "5",
  notes: "",
};

export default function EvolucaoEnfermagem() {
  const { profile } = useAuth();
  const [evolutions, setEvolutions] = useState<NursingEvolution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);

  useEffect(() => {
    if (profile?.tenant_id) void fetchEvolutions();
  }, [profile?.tenant_id, filterClient]);

  useEffect(() => {
    if (profile?.tenant_id && clientSearch.length >= 2) void searchClients();
  }, [clientSearch]);

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

  const handleNursingClientChange = (clientId: string) => {
    setForm(f => ({ ...f, client_id: clientId, appointment_id: "" }));
    void fetchRecentAppointments(clientId);
  };

  const searchClients = async () => {
    if (!profile?.tenant_id) return;
    const { data } = await supabase
      .from("clients").select("id, name")
      .eq("tenant_id", profile.tenant_id)
      .ilike("name", `%${clientSearch}%`).limit(20);
    setClients((data ?? []) as ClientOption[]);
  };

  const fetchEvolutions = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      let q = supabase
        .from("nursing_evolutions")
        .select("*, clients(name), profiles(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .order("evolution_date", { ascending: false })
        .limit(200);

      if (filterClient !== "all") q = q.eq("client_id", filterClient);

      const { data, error } = await q;
      if (error) throw error;

      setEvolutions(((data ?? []) as any[]).map(r => ({
        id: r.id,
        client_name: r.clients?.name ?? "—",
        professional_name: r.profiles?.full_name ?? "—",
        evolution_date: r.evolution_date,
        nanda_code: r.nanda_code,
        nanda_diagnosis: r.nanda_diagnosis,
        nic_code: r.nic_code,
        nic_intervention: r.nic_intervention,
        nic_activities: r.nic_activities,
        noc_code: r.noc_code,
        noc_outcome: r.noc_outcome,
        noc_score_initial: r.noc_score_initial,
        noc_score_current: r.noc_score_current,
        noc_score_target: r.noc_score_target,
        notes: r.notes,
        status: r.status,
      })));
    } catch (err) {
      logger.error("EvolucaoEnfermagem fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setForm(emptyForm);
    setDialog(true);
  };

  const handleSelectNanda = (code: string, label: string) => {
    setForm(f => ({ ...f, nanda_code: code, nanda_diagnosis: label }));
  };

  const handleSelectNic = (code: string, label: string) => {
    setForm(f => ({ ...f, nic_code: code, nic_intervention: label }));
  };

  const handleSelectNoc = (code: string, label: string) => {
    setForm(f => ({ ...f, noc_code: code, noc_outcome: label }));
  };

  const handleSubmit = async () => {
    if (!form.client_id || !form.nanda_diagnosis.trim()) {
      toast.error("Paciente e diagnóstico NANDA são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      const selectedAppt = recentAppointments.find(a => a.id === form.appointment_id);
      const { error } = await supabase.from("nursing_evolutions").insert({
        tenant_id: profile!.tenant_id,
        client_id: form.client_id,
        professional_id: profile!.id,
        appointment_id: form.appointment_id || null,
        medical_record_id: selectedAppt?.medical_record_id || null,
        nanda_code: form.nanda_code || null,
        nanda_diagnosis: form.nanda_diagnosis,
        nic_code: form.nic_code || null,
        nic_intervention: form.nic_intervention || null,
        nic_activities: form.nic_activities || null,
        noc_code: form.noc_code || null,
        noc_outcome: form.noc_outcome || null,
        noc_score_initial: form.noc_score_initial ? Number(form.noc_score_initial) : null,
        noc_score_current: form.noc_score_current ? Number(form.noc_score_current) : null,
        noc_score_target: form.noc_score_target ? Number(form.noc_score_target) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Evolução de enfermagem registrada");
      setDialog(false);
      void fetchEvolutions();
    } catch (err) {
      logger.error("EvolucaoEnfermagem save:", err);
      toast.error("Erro ao salvar evolução");
    } finally {
      setIsSaving(false);
    }
  };

  function nocTrend(initial: number | null, current: number | null) {
    if (initial == null || current == null) return null;
    if (current > initial) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
    if (current < initial) return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <MainLayout
      title="Evolução de Enfermagem"
      subtitle="Registro NANDA/NIC/NOC — classificação padronizada"
      actions={
        <Button className="gradient-primary text-primary-foreground gap-2" onClick={handleOpen}>
          <Plus className="h-4 w-4" /> Nova Evolução
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="space-y-1 flex-1 min-w-[200px] max-w-xs">
          <Label className="text-xs">Buscar Paciente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Nome do paciente..." className="pl-10" />
          </div>
        </div>
        {clients.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Filtrar paciente</Label>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => void fetchEvolutions()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evoluções Registradas ({evolutions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : evolutions.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Clipboard} title="Nenhuma evolução registrada" description="Registre evoluções de enfermagem com classificação NANDA/NIC/NOC." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Diagnóstico (NANDA)</TableHead>
                    <TableHead>Intervenção (NIC)</TableHead>
                    <TableHead>Resultado (NOC)</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Profissional</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evolutions.map(evo => (
                    <TableRow key={evo.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(evo.evolution_date), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{evo.client_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {evo.nanda_code && <Badge variant="outline" className="text-[10px] mr-1">{evo.nanda_code}</Badge>}
                          {evo.nanda_diagnosis}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                        {evo.nic_intervention || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {evo.noc_outcome || "—"}
                      </TableCell>
                      <TableCell>
                        {evo.noc_score_current != null ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono">{evo.noc_score_initial}→{evo.noc_score_current}/{evo.noc_score_target}</span>
                            {nocTrend(evo.noc_score_initial, evo.noc_score_current)}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{evo.professional_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer */}
      <FormDrawer
        open={dialog}
        onOpenChange={setDialog}
        title="Nova Evolução de Enfermagem"
        description="Registre usando a classificação NANDA-I / NIC / NOC"
        width="lg"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Registrar Evolução"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={form.client_id} onValueChange={handleNursingClientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {recentAppointments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Vincular a consulta (opcional)</Label>
                <Select value={form.appointment_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, appointment_id: v === "none" ? "" : v }))}>
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

          {/* NANDA */}
          <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-red-700 dark:text-red-400">NANDA-I — Diagnóstico de Enfermagem ({NANDA_DIAGNOSES.length} diagnósticos)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar diagnóstico NANDA</Label>
                <NandaNicNocCombobox
                  items={NANDA_DIAGNOSES}
                  value={form.nanda_code}
                  onChange={handleSelectNanda}
                  placeholder="Buscar por código ou nome (ex: dor, infecção, ansiedade)..."
                  badgeColor="text-red-600 border-red-300"
                  groupKey="domain"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input value={form.nanda_code} onChange={e => setForm(f => ({ ...f, nanda_code: e.target.value }))} placeholder="00132" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Diagnóstico *</Label>
                  <Input value={form.nanda_diagnosis} onChange={e => setForm(f => ({ ...f, nanda_diagnosis: e.target.value }))} placeholder="Dor aguda" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NIC */}
          <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-blue-700 dark:text-blue-400">NIC — Intervenções de Enfermagem ({NIC_INTERVENTIONS.length} intervenções)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar intervenção NIC</Label>
                <NandaNicNocCombobox
                  items={NIC_INTERVENTIONS}
                  value={form.nic_code}
                  onChange={handleSelectNic}
                  placeholder="Buscar por código ou nome (ex: dor, medicamento, oxigênio)..."
                  badgeColor="text-blue-600 border-blue-300"
                  groupKey="class"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código NIC</Label>
                  <Input value={form.nic_code} onChange={e => setForm(f => ({ ...f, nic_code: e.target.value }))} placeholder="1400" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Intervenção</Label>
                  <Input value={form.nic_intervention} onChange={e => setForm(f => ({ ...f, nic_intervention: e.target.value }))} placeholder="Controle da dor" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Atividades realizadas</Label>
                <Textarea value={form.nic_activities} onChange={e => setForm(f => ({ ...f, nic_activities: e.target.value }))} placeholder="Descreva as atividades de enfermagem realizadas..." rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* NOC */}
          <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-green-700 dark:text-green-400">NOC — Resultados de Enfermagem ({NOC_OUTCOMES.length} resultados)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar resultado NOC</Label>
                <NandaNicNocCombobox
                  items={NOC_OUTCOMES}
                  value={form.noc_code}
                  onChange={handleSelectNoc}
                  placeholder="Buscar por código ou nome (ex: dor, mobilidade, ansiedade)..."
                  badgeColor="text-green-600 border-green-300"
                  groupKey="class"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código NOC</Label>
                  <Input value={form.noc_code} onChange={e => setForm(f => ({ ...f, noc_code: e.target.value }))} placeholder="2102" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Resultado esperado</Label>
                  <Input value={form.noc_outcome} onChange={e => setForm(f => ({ ...f, noc_outcome: e.target.value }))} placeholder="Nível de dor" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Score Inicial (1-5)</Label>
                  <Input type="number" min="1" max="5" value={form.noc_score_initial} onChange={e => setForm(f => ({ ...f, noc_score_initial: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score Atual (1-5)</Label>
                  <Input type="number" min="1" max="5" value={form.noc_score_current} onChange={e => setForm(f => ({ ...f, noc_score_current: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score Meta (1-5)</Label>
                  <Input type="number" min="1" max="5" value={form.noc_score_target} onChange={e => setForm(f => ({ ...f, noc_score_target: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações adicionais..." rows={2} />
          </div>
        </div>
      </FormDrawer>
    </MainLayout>
  );
}
