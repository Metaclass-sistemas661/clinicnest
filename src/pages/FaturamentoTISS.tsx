import { useState, useEffect, useRef, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator,
  Download,
  FileCheck,
  FileClock,
  FileX,
  RefreshCw,
  CheckSquare,
  Square,
  Upload,
  AlertTriangle,
  BarChart3,
  MessageSquareWarning,
  Send,
  TrendingUp,
  DollarSign,
  FileWarning,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  generateConsultaXML,
  generateSPSADTXML,
  generateHonorariosXML,
  downloadTissXml,
  generateLotNumber,
  parseRetornoXML,
  type TissRetornoLote,
} from "@/lib/tiss";
import {
  generateGTOXML,
  generateLoteGTOXML,
  parseRetornoOdontoXML,
  downloadGTOXml,
  type TissGuiaOdonto,
  type TissProcedimentoOdonto,
} from "@/lib/tiss-odonto";

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
  glosa_code: string | null;
  glosa_description: string | null;
  glosa_value: number;
  released_value: number | null;
  total_value: number;
}

interface GlosaAppeal {
  id: string;
  tiss_guide_id: string;
  appeal_number: string;
  justification: string;
  requested_value: number;
  status: string;
  response_text: string | null;
  resolved_value: number | null;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  guide_number?: string;
  client_name?: string;
  insurance_plan_name?: string;
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
  glosa_code: string | null;
  glosa_description: string | null;
  glosa_value: number | null;
  released_value: number | null;
  total_value: number | null;
  insurance_plans: { name: string } | null;
  appointments: { clients: { name: string } | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "pending":   return <Badge variant="secondary"><FileClock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case "submitted": return <Badge variant="default"><FileCheck className="h-3 w-3 mr-1" />Enviada</Badge>;
    case "accepted":  return <Badge className="bg-green-600 text-white"><FileCheck className="h-3 w-3 mr-1" />Aceita</Badge>;
    case "rejected":  return <Badge variant="destructive"><FileX className="h-3 w-3 mr-1" />Glosada</Badge>;
    default:          return <Badge variant="outline">{status}</Badge>;
  }
}

function guideTypeBadge(type: string) {
  switch (type) {
    case "consulta":    return <Badge variant="outline" className="text-xs">Consulta</Badge>;
    case "sadt":        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">SP/SADT</Badge>;
    case "honorarios":  return <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Honorários</Badge>;
    default:            return <Badge variant="outline" className="text-xs">{type}</Badge>;
  }
}

function appealStatusBadge(status: string) {
  switch (status) {
    case "pending":   return <Badge variant="secondary">Pendente</Badge>;
    case "submitted": return <Badge variant="default">Enviado</Badge>;
    case "accepted":  return <Badge className="bg-green-600 text-white">Deferido</Badge>;
    case "partial":   return <Badge className="bg-yellow-600 text-white">Parcial</Badge>;
    case "denied":    return <Badge variant="destructive">Indeferido</Badge>;
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
  const [guideType, setGuideType] = useState<"consulta" | "sadt" | "honorarios" | "odonto">("consulta");
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

  // Aba Retorno
  const [returnXml, setReturnXml] = useState("");
  const [isParsingReturn, setIsParsingReturn] = useState(false);
  const [returnResult, setReturnResult] = useState<TissRetornoLote | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aba Glosas / Recursos
  const [appeals, setAppeals] = useState<GlosaAppeal[]>([]);
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false);
  const [appealDialog, setAppealDialog] = useState(false);
  const [appealGuide, setAppealGuide] = useState<TissGuide | null>(null);
  const [appealForm, setAppealForm] = useState({ justification: "", requested_value: "" });
  const [isSavingAppeal, setIsSavingAppeal] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      void fetchPlans();
      void fetchGuides();
      void fetchAppeals();
    }
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
          patient:patients(name, cpf, insurance_card_number),
          procedure:procedures(name, tuss_code, insurance_price),
          profiles!professional_id(full_name),
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
        client_name: r.patient?.name ?? "—",
        client_cpf: r.patient?.cpf ?? null,
        client_carteirinha: r.patient?.insurance_card_number ?? null,
        service_name: r.procedure?.name ?? "—",
        service_tuss_code: r.procedure?.tuss_code ?? null,
        insurance_price: r.procedure?.insurance_price ?? 0,
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
      const cnpj = tenant.cnpj ?? "00000000000000";
      const cnes = tenant.cnes_code ?? "0000000";
      const crm = tenant.responsible_crm ?? "000000";

      toGenerate.forEach((appt, idx) => {
        const plan = plans.find((p) => p.id === appt.insurance_plan_id);
        const guideNum = `${lotNum}${String(idx + 1).padStart(4, "0")}`;
        const ver = plan?.tiss_version ?? "3.05.00";
        const dateStr = appt.scheduled_at.slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        let xml: string;

        if (guideType === "sadt") {
          xml = generateSPSADTXML({
            prestadorCnpj: cnpj,
            prestadorCnes: cnes,
            prestadorNome: tenant.name,
            profissionalSolicitante: appt.professional_name,
            profissionalSolicitanteCRM: crm,
            profissionalSolicitanteConselho: "CRM",
            profissionalSolicitanteUF: "SP",
            operadoraRegistroANS: plan?.ans_code ?? "000000",
            beneficiarioNome: appt.client_name,
            beneficiarioCarteirinha: appt.client_carteirinha ?? "000000000000000",
            beneficiarioCpf: appt.client_cpf ?? undefined,
            dataAtendimento: dateStr,
            dataSolicitacao: dateStr,
            numeroGuia: guideNum,
            senhaAutorizacao: appt.insurance_authorization ?? undefined,
            caraterAtendimento: "1",
            tipoAtendimento: "05",
            indicacaoAcidente: "0",
            indicacaoClinica: appt.cid_code ? `CID: ${appt.cid_code}` : undefined,
            procedimentos: [{
              codigoTabela: "22",
              codigoProcedimento: appt.service_tuss_code ?? "10101012",
              descricao: appt.service_name,
              quantidade: 1,
              valorUnitario: appt.insurance_price,
              valorTotal: appt.insurance_price,
            }],
            observacao: appt.cid_code ? `CID: ${appt.cid_code}` : undefined,
            numLote: lotNum,
            dataEnvio: todayStr,
            tissVersion: ver,
          });
        } else if (guideType === "honorarios") {
          xml = generateHonorariosXML({
            prestadorCnpj: cnpj,
            prestadorCnes: cnes,
            prestadorNome: tenant.name,
            profissionalNome: appt.professional_name,
            profissionalCrm: crm,
            profissionalConselho: "CRM",
            profissionalUF: "SP",
            profissionalCBOS: "225125",
            grauParticipacao: "00",
            operadoraRegistroANS: plan?.ans_code ?? "000000",
            beneficiarioNome: appt.client_name,
            beneficiarioCarteirinha: appt.client_carteirinha ?? "000000000000000",
            beneficiarioCpf: appt.client_cpf ?? undefined,
            dataAtendimento: dateStr,
            dataInicioFaturamento: dateStr,
            dataFimFaturamento: dateStr,
            numeroGuia: guideNum,
            numeroGuiaSolicitacao: guideNum,
            senhaAutorizacao: appt.insurance_authorization ?? undefined,
            procedimentos: [{
              codigoTabela: "22",
              codigoProcedimento: appt.service_tuss_code ?? "10101012",
              descricao: appt.service_name,
              quantidade: 1,
              valorUnitario: appt.insurance_price,
              valorTotal: appt.insurance_price,
            }],
            observacao: appt.cid_code ? `CID: ${appt.cid_code}` : undefined,
            numLote: lotNum,
            dataEnvio: todayStr,
            tissVersion: ver,
          });
        } else if (guideType === "odonto") {
          xml = generateGTOXML({
            prestadorCnpj: cnpj,
            prestadorCnes: cnes,
            prestadorNome: tenant.name,
            profissionalNome: appt.professional_name,
            profissionalCro: crm,
            profissionalUF: "SP",
            operadoraRegistroANS: plan?.ans_code ?? "000000",
            beneficiarioNome: appt.client_name,
            beneficiarioCarteirinha: appt.client_carteirinha ?? "000000000000000",
            beneficiarioCpf: appt.client_cpf ?? undefined,
            dataAtendimento: dateStr,
            numeroGuia: guideNum,
            senhaAutorizacao: appt.insurance_authorization ?? undefined,
            indicacaoAcidente: "0",
            procedimentos: [{
              codigoProcedimento: appt.service_tuss_code ?? "81000030",
              descricao: appt.service_name,
              quantidade: 1,
              valorUnitario: appt.insurance_price,
              valorTotal: appt.insurance_price,
            }],
            observacao: appt.cid_code ? `CID: ${appt.cid_code}` : undefined,
            numLote: lotNum,
            tissVersion: ver,
          });
        } else {
          xml = generateConsultaXML({
            prestadorCnpj: cnpj,
            prestadorCnes: cnes,
            prestadorNome: tenant.name,
            profissionalNome: appt.professional_name,
            profissionalCrm: crm,
            profissionalConselho: "CRM",
            profissionalUF: "SP",
            operadoraRegistroANS: plan?.ans_code ?? "000000",
            beneficiarioNome: appt.client_name,
            beneficiarioCarteirinha: appt.client_carteirinha ?? "000000000000000",
            beneficiarioCpf: appt.client_cpf ?? undefined,
            dataAtendimento: dateStr,
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
            dataEnvio: todayStr,
            tissVersion: ver,
          });
        }

        guideRecords.push({
          tenant_id: profile.tenant_id,
          insurance_plan_id: appt.insurance_plan_id,
          appointment_id: appt.id,
          lot_number: lotNum,
          guide_number: guideNum,
          guide_type: guideType,
          status: "pending",
          xml_content: xml,
          tiss_version: plan?.tiss_version ?? "3.05.00",
          total_value: appt.insurance_price,
        });
        xmlFiles.push({ name: `guia_${guideType}_${guideNum}.xml`, content: xml });
      });

      const { error } = await supabase.from("tiss_guides").insert(guideRecords);
      if (error) throw error;

      xmlFiles.forEach((f) => downloadTissXml(f.content, f.name));

      toast.success(`${guideRecords.length} guia(s) ${guideType.toUpperCase()} gerada(s) — lote ${lotNum}`);
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
        .select("*, insurance_plans(name), appointments(patient:patients(name))")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const mapped: TissGuide[] = ((data ?? []) as TissGuideRaw[]).map((r) => ({
        id: r.id,
        lot_number: r.lot_number,
        guide_number: r.guide_number,
        guide_type: r.guide_type,
        status: r.status,
        insurance_plan_name: r.insurance_plans?.name ?? null,
        client_name: r.appointments?.patient?.name ?? null,
        created_at: r.created_at,
        submitted_at: r.submitted_at,
        xml_content: r.xml_content,
        glosa_code: r.glosa_code ?? null,
        glosa_description: r.glosa_description ?? null,
        glosa_value: r.glosa_value ?? 0,
        released_value: r.released_value ?? null,
        total_value: r.total_value ?? 0,
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

  // ── Retorno XML ──────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReturnXml(ev.target?.result as string);
      setReturnResult(null);
    };
    reader.readAsText(file);
  };

  const handleParseReturn = () => {
    if (!returnXml.trim()) { toast.error("Cole ou carregue o XML de retorno"); return; }
    setIsParsingReturn(true);
    try {
      const result = parseRetornoXML(returnXml);
      if (!result) { toast.error("Não foi possível interpretar o XML. Verifique o formato."); return; }
      setReturnResult(result);
      toast.success(`Retorno processado: ${result.guias.length} guia(s) encontrada(s)`);
    } catch (err) {
      logger.error("TISS parseReturn:", err);
      toast.error("Erro ao processar XML de retorno");
    } finally {
      setIsParsingReturn(false);
    }
  };

  const handleApplyReturn = async () => {
    if (!returnResult || !profile?.tenant_id) return;
    setIsParsingReturn(true);
    try {
      let applied = 0;
      for (const guia of returnResult.guias) {
        const updates: Record<string, unknown> = {
          status: guia.status === "rejected" ? "rejected" : "accepted",
          return_xml: returnXml.substring(0, 50000),
          return_parsed_at: new Date().toISOString(),
        };
        if (guia.codigoGlosa) updates.glosa_code = guia.codigoGlosa;
        if (guia.motivoGlosa) updates.glosa_description = guia.motivoGlosa;
        if (guia.valorGlosado != null) updates.glosa_value = guia.valorGlosado;
        if (guia.valorLiberado != null) updates.released_value = guia.valorLiberado;

        const { error } = await supabase
          .from("tiss_guides")
          .update(updates)
          .eq("tenant_id", profile.tenant_id)
          .eq("guide_number", guia.numeroGuia);
        if (!error) applied++;
      }
      toast.success(`${applied} guia(s) atualizada(s) com retorno da operadora`);
      setReturnResult(null);
      setReturnXml("");
      void fetchGuides();
    } catch (err) {
      logger.error("TISS applyReturn:", err);
      toast.error("Erro ao aplicar retorno");
    } finally {
      setIsParsingReturn(false);
    }
  };

  // ── Glosas / Recursos ───────────────────────────────────────────────────
  const fetchAppeals = async () => {
    if (!profile?.tenant_id) return;
    setIsLoadingAppeals(true);
    try {
      const { data, error } = await supabase
        .from("tiss_glosa_appeals")
        .select("*, tiss_guides(guide_number, insurance_plans(name), appointments(patient:patients(name)))")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const mapped: GlosaAppeal[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        tiss_guide_id: r.tiss_guide_id,
        appeal_number: r.appeal_number,
        justification: r.justification,
        requested_value: r.requested_value,
        status: r.status,
        response_text: r.response_text,
        resolved_value: r.resolved_value,
        submitted_at: r.submitted_at,
        resolved_at: r.resolved_at,
        created_at: r.created_at,
        guide_number: r.tiss_guides?.guide_number ?? "—",
        client_name: r.tiss_guides?.appointments?.patient?.name ?? "—",
        insurance_plan_name: r.tiss_guides?.insurance_plans?.name ?? "—",
      }));
      setAppeals(mapped);
    } catch (err) {
      logger.error("TISS fetchAppeals:", err);
    } finally {
      setIsLoadingAppeals(false);
    }
  };

  const openAppealDialog = (guide: TissGuide) => {
    setAppealGuide(guide);
    setAppealForm({ justification: "", requested_value: String(guide.glosa_value || 0) });
    setAppealDialog(true);
  };

  const handleSaveAppeal = async () => {
    if (!appealGuide || !profile?.tenant_id) return;
    if (!appealForm.justification.trim()) { toast.error("Justificativa é obrigatória"); return; }
    setIsSavingAppeal(true);
    try {
      const appealNum = `RG${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("tiss_glosa_appeals").insert({
        tenant_id: profile.tenant_id,
        tiss_guide_id: appealGuide.id,
        appeal_number: appealNum,
        justification: appealForm.justification,
        requested_value: parseFloat(appealForm.requested_value) || 0,
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Recurso ${appealNum} criado com sucesso`);
      setAppealDialog(false);
      void fetchAppeals();
    } catch (err) {
      logger.error("TISS saveAppeal:", err);
      toast.error("Erro ao salvar recurso");
    } finally {
      setIsSavingAppeal(false);
    }
  };

  const updateAppealStatus = async (id: string, status: string) => {
    try {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "submitted") patch.submitted_at = new Date().toISOString();
      if (status === "accepted" || status === "denied" || status === "partial") {
        patch.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("tiss_glosa_appeals")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Status do recurso atualizado");
      void fetchAppeals();
    } catch (err) {
      logger.error("TISS updateAppeal:", err);
      toast.error("Erro ao atualizar recurso");
    }
  };

  // ── Dashboard dados ──────────────────────────────────────────────────────
  const dashData = useMemo(() => {
    const totalGuias = guides.length;
    const totalValue = guides.reduce((s, g) => s + (g.total_value || 0), 0);
    const acceptedValue = guides.filter((g) => g.status === "accepted").reduce((s, g) => s + (g.total_value || 0), 0);
    const glosaValue = guides.reduce((s, g) => s + (g.glosa_value || 0), 0);
    const pendingCount = guides.filter((g) => g.status === "pending" || g.status === "submitted").length;
    const rejectedCount = guides.filter((g) => g.status === "rejected").length;
    const acceptedCount = guides.filter((g) => g.status === "accepted").length;

    const byPlan: Record<string, { name: string; total: number; accepted: number; glosa: number; count: number }> = {};
    for (const g of guides) {
      const key = g.insurance_plan_name ?? "Sem convênio";
      if (!byPlan[key]) byPlan[key] = { name: key, total: 0, accepted: 0, glosa: 0, count: 0 };
      byPlan[key].total += g.total_value || 0;
      byPlan[key].count += 1;
      if (g.status === "accepted") byPlan[key].accepted += g.total_value || 0;
      byPlan[key].glosa += g.glosa_value || 0;
    }

    const byType: Record<string, number> = {};
    for (const g of guides) {
      byType[g.guide_type] = (byType[g.guide_type] || 0) + 1;
    }

    return {
      totalGuias, totalValue, acceptedValue, glosaValue,
      pendingCount, rejectedCount, acceptedCount,
      byPlan: Object.values(byPlan).sort((a, b) => b.total - a.total),
      byType,
      taxaGlosa: totalValue > 0 ? (glosaValue / totalValue * 100) : 0,
    };
  }, [guides]);

  const glosaGuides = useMemo(() => guides.filter((g) => g.status === "rejected" && g.glosa_value > 0), [guides]);

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
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="gerar">Gerar Guias</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({guides.length})</TabsTrigger>
          <TabsTrigger value="retorno">Retorno XML</TabsTrigger>
          <TabsTrigger value="glosas">Glosas & Recursos ({glosaGuides.length})</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
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
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Guia</Label>
                  <Select value={guideType} onValueChange={(v) => setGuideType(v as any)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="sadt">SP/SADT</SelectItem>
                      <SelectItem value="honorarios">Honorários</SelectItem>
                      <SelectItem value="odonto">Odontológico (GTO)</SelectItem>
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
                      {isGenerating ? "Gerando..." : `Gerar ${selected.size} ${guideType === "sadt" ? "SP/SADT" : guideType === "honorarios" ? "Honorários" : "Consulta"}`}
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
              icon={Calculator}
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
                        <TableHead>Tipo</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Glosa</TableHead>
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
                          <TableCell>{guideTypeBadge(g.guide_type)}</TableCell>
                          <TableCell className="text-sm">{g.client_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{g.insurance_plan_name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-right">
                            {g.total_value > 0 ? `R$ ${g.total_value.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {g.glosa_value > 0 ? (
                              <span className="text-destructive font-medium">R$ {g.glosa_value.toFixed(2)}</span>
                            ) : "—"}
                          </TableCell>
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

        {/* ─── Retorno XML ─────────────────────────────────────────────── */}
        <TabsContent value="retorno" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload de XML de Retorno da Operadora</CardTitle>
              <CardDescription>
                Carregue o arquivo XML devolvido pela operadora para atualizar automaticamente o status das guias (aceitas/glosadas).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">Arquivo XML</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml"
                    onChange={handleFileUpload}
                    className="w-72"
                  />
                </div>
                <span className="text-muted-foreground text-sm">ou</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Colar XML manualmente</Label>
                <Textarea
                  value={returnXml}
                  onChange={(e) => { setReturnXml(e.target.value); setReturnResult(null); }}
                  placeholder="Cole aqui o conteúdo do XML de retorno da operadora..."
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleParseReturn} disabled={isParsingReturn || !returnXml.trim()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Processar XML
                </Button>
                {returnResult && (
                  <Button onClick={() => void handleApplyReturn()} disabled={isParsingReturn} variant="default" className="gap-2">
                    {isParsingReturn ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                    Aplicar Retorno às Guias
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {returnResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Resultado do Retorno — Lote {returnResult.numeroLote}
                </CardTitle>
                <CardDescription>
                  Processado em {returnResult.dataProcessamento} — {returnResult.guias.length} guia(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Guia</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Código Glosa</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Valor Glosado</TableHead>
                        <TableHead className="text-right">Valor Liberado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnResult.guias.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{g.numeroGuia}</TableCell>
                          <TableCell>{statusBadge(g.status)}</TableCell>
                          <TableCell className="text-sm">{g.codigoGlosa ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{g.motivoGlosa ?? "—"}</TableCell>
                          <TableCell className="text-sm text-right">
                            {g.valorGlosado != null ? (
                              <span className="text-destructive font-medium">R$ {g.valorGlosado.toFixed(2)}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {g.valorLiberado != null ? `R$ ${g.valorLiberado.toFixed(2)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Glosas & Recursos ───────────────────────────────────────── */}
        <TabsContent value="glosas" className="space-y-6">
          {glosaGuides.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Guias Glosadas ({glosaGuides.length})
                </CardTitle>
                <CardDescription>
                  Guias rejeitadas pela operadora. Crie um recurso para contestar a glosa.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Guia</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead>Código Glosa</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Valor Glosado</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glosaGuides.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs">{g.guide_number}</TableCell>
                          <TableCell className="text-sm">{g.client_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{g.insurance_plan_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{g.glosa_code ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{g.glosa_description ?? "—"}</TableCell>
                          <TableCell className="text-sm text-right text-destructive font-medium">
                            R$ {g.glosa_value.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => openAppealDialog(g)}
                            >
                              <MessageSquareWarning className="h-3 w-3" />
                              Recursar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recursos de Glosa ({appeals.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => void fetchAppeals()} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoadingAppeals ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingAppeals ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : appeals.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum recurso de glosa registrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Recurso</TableHead>
                        <TableHead>Guia</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Valor Solicitado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appeals.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.appeal_number}</TableCell>
                          <TableCell className="font-mono text-xs">{a.guide_number}</TableCell>
                          <TableCell className="text-sm">{a.client_name}</TableCell>
                          <TableCell className="text-sm">{a.insurance_plan_name}</TableCell>
                          <TableCell className="text-sm text-right">R$ {a.requested_value.toFixed(2)}</TableCell>
                          <TableCell>{appealStatusBadge(a.status)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              {a.status === "pending" && (
                                <Button
                                  size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                                  onClick={() => void updateAppealStatus(a.id, "submitted")}
                                >
                                  <Send className="h-3 w-3" /> Enviar
                                </Button>
                              )}
                              {a.status === "submitted" && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600"
                                    onClick={() => void updateAppealStatus(a.id, "accepted")}>
                                    Deferido
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-yellow-600"
                                    onClick={() => void updateAppealStatus(a.id, "partial")}>
                                    Parcial
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive"
                                    onClick={() => void updateAppealStatus(a.id, "denied")}>
                                    Indeferido
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

          {glosaGuides.length === 0 && appeals.length === 0 && (
            <EmptyState
              icon={FileWarning}
              title="Nenhuma glosa registrada"
              description="Importe o XML de retorno da operadora na aba 'Retorno XML' para identificar glosas."
            />
          )}
        </TabsContent>

        {/* ─── Dashboard ───────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Guias</p>
                  <p className="text-2xl font-bold">{dashData.totalGuias}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total Faturado</p>
                  <p className="text-2xl font-bold">R$ {dashData.totalValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Aceito</p>
                  <p className="text-2xl font-bold">R$ {dashData.acceptedValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Glosado</p>
                  <p className="text-2xl font-bold text-destructive">R$ {dashData.glosaValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-500/10">
                  <FileClock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes/Enviadas</p>
                  <p className="text-2xl font-bold">{dashData.pendingCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
                  <FileCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aceitas</p>
                  <p className="text-2xl font-bold">{dashData.acceptedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                  <FileX className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Glosadas</p>
                  <p className="text-2xl font-bold">{dashData.rejectedCount}</p>
                  {dashData.taxaGlosa > 0 && (
                    <p className="text-xs text-destructive">{dashData.taxaGlosa.toFixed(1)}% de glosa</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {dashData.byPlan.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Faturamento por Convênio
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Guias</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Aceito</TableHead>
                        <TableHead className="text-right">Glosado</TableHead>
                        <TableHead className="text-right">% Glosa</TableHead>
                        <TableHead>Barra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashData.byPlan.map((p) => {
                        const maxTotal = dashData.byPlan[0]?.total || 1;
                        const barPct = (p.total / maxTotal) * 100;
                        const glosaPct = p.total > 0 ? (p.glosa / p.total * 100) : 0;
                        return (
                          <TableRow key={p.name}>
                            <TableCell className="font-medium text-sm">{p.name}</TableCell>
                            <TableCell className="text-sm text-right">{p.count}</TableCell>
                            <TableCell className="text-sm text-right">R$ {p.total.toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-right text-green-600">R$ {p.accepted.toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-right text-destructive">
                              {p.glosa > 0 ? `R$ ${p.glosa.toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {glosaPct > 0 ? `${glosaPct.toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell className="w-40">
                              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(dashData.byType).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Guias por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(dashData.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 rounded-lg border p-3 min-w-[140px]">
                      {guideTypeBadge(type)}
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {dashData.totalGuias === 0 && (
            <EmptyState
              icon={BarChart3}
              title="Sem dados de faturamento"
              description="Gere guias TISS para visualizar o dashboard de faturamento."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog Recurso de Glosa ─────────────────────────────────────── */}
      <Dialog open={appealDialog} onOpenChange={setAppealDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recurso de Glosa</DialogTitle>
            <DialogDescription>
              {appealGuide && (
                <>Guia {appealGuide.guide_number} — Valor glosado: R$ {appealGuide.glosa_value.toFixed(2)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {appealGuide && (
            <div className="space-y-4 py-2">
              {appealGuide.glosa_code && (
                <div className="rounded-lg border p-3 bg-destructive/5">
                  <p className="text-xs font-semibold text-destructive">Código da Glosa: {appealGuide.glosa_code}</p>
                  {appealGuide.glosa_description && (
                    <p className="text-sm text-muted-foreground mt-1">{appealGuide.glosa_description}</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Valor Solicitado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={appealForm.requested_value}
                  onChange={(e) => setAppealForm({ ...appealForm, requested_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Justificativa do Recurso *</Label>
                <Textarea
                  value={appealForm.justification}
                  onChange={(e) => setAppealForm({ ...appealForm, justification: e.target.value })}
                  placeholder="Descreva a justificativa clínica e documental para contestação da glosa..."
                  rows={5}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealDialog(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveAppeal()} disabled={isSavingAppeal}>
              {isSavingAppeal ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Criar Recurso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
