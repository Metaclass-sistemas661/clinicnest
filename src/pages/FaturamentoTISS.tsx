import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calculator,
  Download,
  FileCheck,
  FileClock,
  FileX,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  generateConsultaXML,
  downloadTissXml,
  generateLotNumber,
} from "@/lib/tiss";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface EligibleAppointment {
  id: string;
  scheduled_at: string;
  client_name: string;
  client_cpf: string | null;
  client_carteirinha: string | null;
  service_name: string;
  service_tuss_code: string | null;
  insurance_price: number;
  insurance_plan_id: string;
  insurance_plan_name: string;
  professional_name: string;
  cid_code: string | null;
  insurance_authorization: string | null;
  already_billed: boolean;
}

interface TissGuide {
  id: string;
  lot_number: string;
  guide_number: string;
  guide_type: string;
  status: string;
  insurance_plan_name: string | null;
  client_name: string | null;
  created_at: string;
  submitted_at: string | null;
  xml_content: string | null;
}

interface InsurancePlan {
  id: string;
  name: string;
  ans_code: string | null;
  tiss_version: string | null;
}

interface AppointmentRaw {
  id: string;
  scheduled_at: string;
  cid_code: string | null;
  insurance_authorization: string | null;
  insurance_plan_id: string;
  clients: { name: string; cpf: string | null; insurance_card_number: string | null } | null;
  services: { name: string; tuss_code: string | null; insurance_price: number } | null;
  profiles: { full_name: string } | null;
  insurance_plans: { name: string } | null;
}

interface TissGuideRaw {
  id: string;
  lot_number: string;
  guide_number: string;
  guide_type: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  xml_content: string | null;
  insurance_plans: { name: string } | null;
  appointments: { clients: { name: string } | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "pending":   return <Badge variant="secondary"><FileClock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case "submitted": return <Badge variant="default"><FileCheck className="h-3 w-3 mr-1" />Enviada</Badge>;
    case "accepted":  return <Badge className="bg-green-600 text-white"><FileCheck className="h-3 w-3 mr-1" />Aceita</Badge>;
    case "rejected":  return <Badge variant="destructive"><FileX className="h-3 w-3 mr-1" />Rejeitada</Badge>;
    default:          return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function FaturamentoTISS() {
  const { profile } = useAuth();

  // Estado geral
  const [activeTab, setActiveTab] = useState("gerar");
  const [plans, setPlans] = useState<InsurancePlan[]>([]);

  // Aba Gerar
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10));
  const [eligible, setEligible] = useState<EligibleAppointment[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Aba Histórico
  const [guides, setGuides] = useState<TissGuide[]>([]);
  const [isLoadingGuides, setIsLoadingGuides] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      void fetchPlans();
      void fetchGuides();
    }
    // fetchPlans and fetchGuides are stable within a tenant session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.tenant_id]);

  // ── Planos ────────────────────────────────────────────────────────────────
  const fetchPlans = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name, ans_code, tiss_version")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setPlans(data ?? []);
    } catch (err) {
      logger.error("TISS fetchPlans:", err);
    }
  };

  // ── Elegíveis ─────────────────────────────────────────────────────────────
  const fetchEligible = async () => {
    if (!profile?.tenant_id) return;
    setIsLoadingEligible(true);
    setSelected(new Set());
    try {
      let q = supabase
        .from("appointments")
        .select(`
          id, scheduled_at, status, cid_code, insurance_authorization, insurance_plan_id,
          clients(name, cpf, insurance_card_number),
          services(name, tuss_code, insurance_price),
          profiles(full_name),
          insurance_plans(name)
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "completed")
        .gte("scheduled_at", `${filterFrom}T00:00:00`)
        .lte("scheduled_at", `${filterTo}T23:59:59`)
        .not("insurance_plan_id", "is", null);

      if (filterPlan !== "all") {
        q = q.eq("insurance_plan_id", filterPlan);
      }

      const { data, error } = await q.order("scheduled_at");
      if (error) throw error;

      // Verificar quais já foram faturados
      const apptIds = ((data ?? []) as AppointmentRaw[]).map((r) => r.id);
      const { data: billed } = await supabase
        .from("tiss_guides")
        .select("appointment_id")
        .eq("tenant_id", profile.tenant_id)
        .in("appointment_id", apptIds);
      const billedIds = new Set(
        ((billed ?? []) as { appointment_id: string }[]).map((b) => b.appointment_id)
      );

      const mapped: EligibleAppointment[] = ((data ?? []) as AppointmentRaw[]).map((r) => ({
        id: r.id,
        scheduled_at: r.scheduled_at,
        client_name: r.clients?.name ?? "—",
        client_cpf: r.clients?.cpf ?? null,
        client_carteirinha: r.clients?.insurance_card_number ?? null,
        service_name: r.services?.name ?? "—",
        service_tuss_code: r.services?.tuss_code ?? null,
        insurance_price: r.services?.insurance_price ?? 0,
        insurance_plan_id: r.insurance_plan_id,
        insurance_plan_name: r.insurance_plans?.name ?? "—",
        professional_name: r.profiles?.full_name ?? "—",
        cid_code: r.cid_code,
        insurance_authorization: r.insurance_authorization,
        already_billed: billedIds.has(r.id),
      }));

      setEligible(mapped);
    } catch (err) {
      logger.error("TISS fetchEligible:", err);
      toast.error("Erro ao carregar atendimentos elegíveis");
    } finally {
      setIsLoadingEligible(false);
    }
  };

  // ── Gerar guias ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (selected.size === 0) { toast.error("Selecione pelo menos um atendimento"); return; }
    if (!profile?.tenant_id) return;
    setIsGenerating(true);
    try {
      const tenant = (await supabase.from("tenants").select("*").eq("id", profile.tenant_id).single()).data;
      if (!tenant) throw new Error("Tenant não encontrado");

      const toGenerate = eligible.filter((a) => selected.has(a.id));
      const lotNum = generateLotNumber(guides.length + 1);
      const guideRecords: object[] = [];
      const xmlFiles: { name: string; content: string }[] = [];

      toGenerate.forEach((appt, idx) => {
        const plan = plans.find((p) => p.id === appt.insurance_plan_id);
        const guideNum = `${lotNum}${String(idx + 1).padStart(4, "0")}`;
        const xml = generateConsultaXML({
          prestadorCnpj: tenant.cnpj ?? "00000000000000",
          prestadorCnes: tenant.cnes_code ?? "0000000",
          prestadorNome: tenant.name,
          profissionalNome: appt.professional_name,
          profissionalCrm: tenant.responsible_crm ?? "000000",
          profissionalConselho: "CRM",
          profissionalUF: "SP",
          operadoraRegistroANS: plan?.ans_code ?? "000000",
          beneficiarioNome: appt.client_name,
          beneficiarioCarteirinha: appt.client_carteirinha ?? "000000000000000",
          beneficiarioCpf: appt.client_cpf ?? undefined,
          dataAtendimento: appt.scheduled_at.slice(0, 10),
          horaInicial: format(new Date(appt.scheduled_at), "HH:mm"),
          numeroGuia: guideNum,
          indicacaoAcidente: "0",
          tipoConsulta: "1",
          tussCode: appt.service_tuss_code ?? "10101012",
          procedimentoDescricao: appt.service_name,
          valorProcedimento: appt.insurance_price,
          valorTotal: appt.insurance_price,
          observacao: appt.cid_code ? `CID: ${appt.cid_code}` : undefined,
          numLote: lotNum,
          dataEnvio: new Date().toISOString().slice(0, 10),
          tissVersion: plan?.tiss_version ?? "3.05.00",
        });

        guideRecords.push({
          tenant_id: profile.tenant_id,
          insurance_plan_id: appt.insurance_plan_id,
          appointment_id: appt.id,
          lot_number: lotNum,
          guide_number: guideNum,
          guide_type: "consulta",
          status: "pending",
          xml_content: xml,
          tiss_version: plan?.tiss_version ?? "3.05.00",
        });
        xmlFiles.push({ name: `guia_${guideNum}.xml`, content: xml });
      });

      const { error } = await supabase.from("tiss_guides").insert(guideRecords);
      if (error) throw error;

      // Baixa o XML do primeiro lote agrupado
      if (xmlFiles.length === 1) {
        downloadTissXml(xmlFiles[0].content, xmlFiles[0].name);
      } else {
        // Baixa todos como arquivo concatenado simples
        xmlFiles.forEach((f) => downloadTissXml(f.content, f.name));
      }

      toast.success(`${guideRecords.length} guia(s) gerada(s) — lote ${lotNum}`);
      setSelected(new Set());
      void fetchGuides();
      void fetchEligible();
    } catch (err) {
      logger.error("TISS generate:", err);
      toast.error("Erro ao gerar guias");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Histórico ─────────────────────────────────────────────────────────────
  const fetchGuides = async () => {
    if (!profile?.tenant_id) return;
    setIsLoadingGuides(true);
    try {
      const { data, error } = await supabase
        .from("tiss_guides")
        .select("*, insurance_plans(name), appointments(clients(name))")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const mapped: TissGuide[] = ((data ?? []) as TissGuideRaw[]).map((r) => ({
        id: r.id,
        lot_number: r.lot_number,
        guide_number: r.guide_number,
        guide_type: r.guide_type,
        status: r.status,
        insurance_plan_name: r.insurance_plans?.name ?? null,
        client_name: r.appointments?.clients?.name ?? null,
        created_at: r.created_at,
        submitted_at: r.submitted_at,
        xml_content: r.xml_content,
      }));
      setGuides(mapped);
    } catch (err) {
      logger.error("TISS fetchGuides:", err);
    } finally {
      setIsLoadingGuides(false);
    }
  };

  const updateGuideStatus = async (id: string, status: string) => {
    try {
      const patch: Record<string, string> = { status };
      if (status === "submitted") patch.submitted_at = new Date().toISOString();
      const { error } = await supabase
        .from("tiss_guides")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Status atualizado");
      void fetchGuides();
    } catch (err) {
      logger.error("TISS updateStatus:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  // ── Seleção ───────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const toggleAll = () => {
    const unbilled = eligible.filter((a) => !a.already_billed).map((a) => a.id);
    if (selected.size === unbilled.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unbilled));
    }
  };

  const unbilledCount = eligible.filter((a) => !a.already_billed).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout
      title="Faturamento TISS"
      subtitle="Geração de guias eletrônicas para operadoras de planos de saúde (ANS)"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="gerar">Gerar Guias</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({guides.length})</TabsTrigger>
        </TabsList>

        {/* ─── Gerar ──────────────────────────────────────────────────── */}
        <TabsContent value="gerar" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros de Atendimento</CardTitle>
              <CardDescription>
                Selecione o período e o convênio para listar atendimentos elegíveis ao faturamento TISS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">De</Label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Convênio</Label>
                  <Select value={filterPlan} onValueChange={setFilterPlan}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Todos os convênios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os convênios</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void fetchEligible()} disabled={isLoadingEligible} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoadingEligible ? "animate-spin" : ""}`} />
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {eligible.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {eligible.length} atendimento(s) encontrado(s)
                    </CardTitle>
                    <CardDescription>
                      {unbilledCount} pendentes de faturamento · {selected.size} selecionado(s)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={toggleAll}>
                      {selected.size === unbilledCount ? "Desmarcar" : "Selecionar"} todos
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleGenerate()}
                      disabled={selected.size === 0 || isGenerating}
                      className="gap-2"
                    >
                      <Calculator className="h-4 w-4" />
                      {isGenerating ? "Gerando..." : `Gerar ${selected.size} guia(s)`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligible.map((appt) => (
                        <TableRow key={appt.id} className={appt.already_billed ? "opacity-50" : ""}>
                          <TableCell>
                            {appt.already_billed ? (
                              <FileCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <button onClick={() => toggleSelect(appt.id)}>
                                {selected.has(appt.id)
                                  ? <CheckSquare className="h-4 w-4 text-primary" />
                                  : <Square className="h-4 w-4 text-muted-foreground" />}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(appt.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">{appt.client_name}</TableCell>
                          <TableCell className="text-sm">{appt.service_name}</TableCell>
                          <TableCell className="text-sm">{appt.insurance_plan_name}</TableCell>
                          <TableCell className="text-sm text-right">
                            R$ {appt.insurance_price.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {appt.already_billed
                              ? <Badge variant="outline" className="text-xs">Faturado</Badge>
                              : <Badge variant="secondary" className="text-xs">Pendente</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {eligible.length === 0 && !isLoadingEligible && (
            <EmptyState
              icon={<Calculator className="h-10 w-10 text-muted-foreground/40" />}
              title="Nenhum atendimento encontrado"
              description="Ajuste o período e o convênio e clique em Buscar."
            />
          )}
        </TabsContent>

        {/* ─── Histórico ─────────────────────────────────────────────── */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Guias geradas</CardTitle>
                <Button variant="outline" size="sm" onClick={() => void fetchGuides()} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoadingGuides ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingGuides ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : guides.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhuma guia gerada ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lote</TableHead>
                        <TableHead>Nº Guia</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead>Gerada em</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guides.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs">{g.lot_number}</TableCell>
                          <TableCell className="font-mono text-xs">{g.guide_number}</TableCell>
                          <TableCell className="text-sm">{g.client_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{g.insurance_plan_name ?? "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(g.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{statusBadge(g.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              {g.xml_content && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => downloadTissXml(g.xml_content!, `guia_${g.guide_number}.xml`)}
                                >
                                  <Download className="h-3 w-3" />
                                  XML
                                </Button>
                              )}
                              {g.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => void updateGuideStatus(g.id, "submitted")}
                                >
                                  Marcar enviada
                                </Button>
                              )}
                              {g.status === "submitted" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-green-600"
                                    onClick={() => void updateGuideStatus(g.id, "accepted")}
                                  >
                                    Aceita
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-destructive"
                                    onClick={() => void updateGuideStatus(g.id, "rejected")}
                                  >
                                    Rejeitada
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
