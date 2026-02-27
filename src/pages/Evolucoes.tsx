import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { MODAL_SIZES } from "@/lib/modal-constants";
import { generateRecordHash } from "@/lib/digital-signature";
import { Cid10Combobox } from "@/components/ui/cid10-combobox";
import { NandaNicNocCombobox } from "@/components/ui/nanda-nic-noc-combobox";
import { NANDA_DIAGNOSES, NIC_INTERVENTIONS, NOC_OUTCOMES } from "@/data/nanda-nic-noc";
import {
  SOAP_TEMPLATES, EVOLUTION_TYPE_LABELS, EVOLUTION_TYPE_COLORS,
} from "@/lib/soap-templates";
import type { ClinicalEvolution, ClinicalEvolutionType } from "@/types/database";
import {
  Plus, Loader2, Trash2, Pencil, Calendar, User, Search,
  ClipboardList, ShieldCheck, Download, Stethoscope, Clipboard,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEvolutionPdf } from "@/utils/patientDocumentPdf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Helper Components
function EmptyEvolutionsState({ type }: { type?: "soap" | "enfermagem" }) {
  const messages = {
    soap: { title: "Nenhuma evolução SOAP encontrada", desc: "Registre evoluções clínicas no formato SOAP." },
    enfermagem: { title: "Nenhuma evolução de enfermagem encontrada", desc: "Registre evoluções com classificação NANDA/NIC/NOC." },
    default: { title: "Nenhuma evolução encontrada", desc: "Registre a primeira evolução clínica." },
  };
  const msg = messages[type ?? "default"];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
        <ClipboardList className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{msg.title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{msg.desc}</p>
    </div>
  );
}

function SoapEvolutionCard({
  evo,
  onEdit,
  onDelete,
  onPdf,
}: {
  evo: ClinicalEvolution;
  onEdit: (evo: ClinicalEvolution) => void;
  onDelete: (id: string) => void;
  onPdf: (evo: ClinicalEvolution) => void;
}) {
  return (
    <Card className="border-gradient hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground">{evo.patient?.name ?? "Paciente"}</h3>
              <Badge className={`text-xs ${EVOLUTION_TYPE_COLORS[evo.evolution_type]}`}>
                {EVOLUTION_TYPE_LABELS[evo.evolution_type]}
              </Badge>
              {evo.cid_code && <Badge variant="outline" className="text-xs">{evo.cid_code}</Badge>}
              {evo.signed_at && (
                <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200">
                  <ShieldCheck className="h-3 w-3" />Assinado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(evo.evolution_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {evo.profiles?.full_name ?? "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {evo.subjective && (
                <div><span className="font-bold text-blue-600 dark:text-blue-400">S: </span>
                  <span className="text-muted-foreground line-clamp-2">{evo.subjective}</span></div>
              )}
              {evo.objective && (
                <div><span className="font-bold text-emerald-600 dark:text-emerald-400">O: </span>
                  <span className="text-muted-foreground line-clamp-2">{evo.objective}</span></div>
              )}
              {evo.assessment && (
                <div><span className="font-bold text-amber-600 dark:text-amber-400">A: </span>
                  <span className="text-muted-foreground line-clamp-2">{evo.assessment}</span></div>
              )}
              {evo.plan && (
                <div><span className="font-bold text-violet-600 dark:text-violet-400">P: </span>
                  <span className="text-muted-foreground line-clamp-2">{evo.plan}</span></div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" title="PDF" onClick={() => onPdf(evo)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(evo)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(evo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NursingEvolutionCard({
  evo,
  onDelete,
  nocTrend,
}: {
  evo: NursingEvolution;
  onDelete: (id: string) => void;
  nocTrend: (initial: number | null, current: number | null) => React.ReactNode;
}) {
  return (
    <Card className="border-gradient hover:shadow-md transition-shadow border-pink-200/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground">{evo.client_name}</h3>
              <Badge className="text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                Enfermagem NANDA
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(evo.evolution_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {evo.professional_name}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-bold text-red-600 dark:text-red-400">NANDA: </span>
                {evo.nanda_code && <Badge variant="outline" className="text-[10px] mr-1">{evo.nanda_code}</Badge>}
                <span className="text-muted-foreground">{evo.nanda_diagnosis}</span>
              </div>
              {evo.nic_intervention && (
                <div>
                  <span className="font-bold text-blue-600 dark:text-blue-400">NIC: </span>
                  <span className="text-muted-foreground">{evo.nic_intervention}</span>
                </div>
              )}
              {evo.noc_outcome && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600 dark:text-green-400">NOC: </span>
                  <span className="text-muted-foreground">{evo.noc_outcome}</span>
                  {evo.noc_score_current != null && (
                    <span className="flex items-center gap-1 text-xs font-mono">
                      ({evo.noc_score_initial}→{evo.noc_score_current}/{evo.noc_score_target})
                      {nocTrend(evo.noc_score_initial, evo.noc_score_current)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(evo.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PatientOption { id: string; name: string }
interface ProfessionalOption { id: string; full_name: string }
interface AppointmentOption { id: string; appointment_date: string; start_time: string; patient_id: string }

interface NursingEvolution {
  id: string;
  patient_id: string;
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

type TabType = "todas" | "soap" | "enfermagem";

const TYPES = Object.keys(EVOLUTION_TYPE_LABELS) as ClinicalEvolutionType[];
const SOAP_TYPES = TYPES.filter(t => t !== "enfermagem");

export default function Evolucoes() {
  const { profile } = useAuth();
  const { professionalType, isAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = profile?.tenant_id;

  // Tab from URL param (?tipo=enfermagem)
  const initialTab = searchParams.get("tipo") === "enfermagem" ? "enfermagem" : "todas";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([]);
  const [nursingEvolutions, setNursingEvolutions] = useState<NursingEvolution[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterClient, setFilterClient] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isNursingFormOpen, setIsNursingFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingNursingId, setDeletingNursingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // SOAP Form state
  const [fClientId, setFClientId] = useState("");
  const [fType, setFType] = useState<ClinicalEvolutionType>("medica");
  const [fDate, setFDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fAppointmentId, setFAppointmentId] = useState("");
  const [fSubjective, setFSubjective] = useState("");
  const [fObjective, setFObjective] = useState("");
  const [fAssessment, setFAssessment] = useState("");
  const [fPlan, setFPlan] = useState("");
  const [fCid, setFCid] = useState("");
  const [fNotes, setFNotes] = useState("");

  // Nursing Form state
  const [nfPatientId, setNfPatientId] = useState("");
  const [nfAppointmentId, setNfAppointmentId] = useState("");
  const [nfNandaCode, setNfNandaCode] = useState("");
  const [nfNandaDiagnosis, setNfNandaDiagnosis] = useState("");
  const [nfNicCode, setNfNicCode] = useState("");
  const [nfNicIntervention, setNfNicIntervention] = useState("");
  const [nfNicActivities, setNfNicActivities] = useState("");
  const [nfNocCode, setNfNocCode] = useState("");
  const [nfNocOutcome, setNfNocOutcome] = useState("");
  const [nfNocScoreInitial, setNfNocScoreInitial] = useState("3");
  const [nfNocScoreCurrent, setNfNocScoreCurrent] = useState("3");
  const [nfNocScoreTarget, setNfNocScoreTarget] = useState("5");
  const [nfNotes, setNfNotes] = useState("");

  // Permission checks
  const canCreateSOAP = isAdmin || !["enfermeiro", "tec_enfermagem"].includes(professionalType);
  const canCreateNursing = isAdmin || ["enfermeiro", "tec_enfermagem", "medico"].includes(professionalType);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [evoRes, nursingRes, cliRes, proRes] = await Promise.all([
        db.from("clinical_evolutions")
          .select("*, patient:patients(name), profiles(full_name)")
          .eq("tenant_id", tenantId)
          .order("evolution_date", { ascending: false })
          .limit(200),
        supabase.from("nursing_evolutions")
          .select("*, patient:patients(name), profiles(full_name)")
          .eq("tenant_id", tenantId)
          .order("evolution_date", { ascending: false })
          .limit(200),
        supabase.from("patients").select("id, name")
          .eq("tenant_id", tenantId).order("name").limit(500),
        supabase.from("profiles").select("id, full_name")
          .eq("tenant_id", tenantId).order("full_name"),
      ]);
      if (evoRes.error) throw evoRes.error;
      setEvolutions((evoRes.data ?? []) as ClinicalEvolution[]);
      // Map nursing evolutions
      setNursingEvolutions(((nursingRes.data ?? []) as any[]).map(r => ({
        id: r.id,
        patient_id: r.patient_id,
        client_name: r.patient?.name ?? "—",
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
      setPatients((cliRes.data ?? []) as PatientOption[]);
      setProfessionals((proRes.data ?? []) as ProfessionalOption[]);
    } catch (err) {
      logger.error("Evolucoes.fetchData", err);
      toast.error("Erro ao carregar evoluções");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchAppointments = useCallback(async (patientId: string) => {
    if (!tenantId || !patientId) { setAppointments([]); return; }
    const { data } = await supabase.from("appointments")
      .select("id, appointment_date, start_time, patient_id")
      .eq("tenant_id", tenantId).eq("patient_id", patientId)
      .order("appointment_date", { ascending: false }).limit(20);
    setAppointments((data ?? []) as AppointmentOption[]);
  }, [tenantId]);

  const filtered = useMemo(() => {
    let list = evolutions;
    if (filterClient) list = list.filter((e) => e.patient_id === filterClient);
    if (filterType !== "all") list = list.filter((e) => e.evolution_type === filterType);
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      list = list.filter((e) =>
        e.subjective?.toLowerCase().includes(q) ||
        e.objective?.toLowerCase().includes(q) ||
        e.assessment?.toLowerCase().includes(q) ||
        e.plan?.toLowerCase().includes(q) ||
        e.patient?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [evolutions, filterClient, filterType, filterSearch]);

  const filteredNursing = useMemo(() => {
    let list = nursingEvolutions;
    if (filterClient) list = list.filter((e) => e.patient_id === filterClient);
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      list = list.filter((e) =>
        e.nanda_diagnosis?.toLowerCase().includes(q) ||
        e.nic_intervention?.toLowerCase().includes(q) ||
        e.noc_outcome?.toLowerCase().includes(q) ||
        e.client_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [nursingEvolutions, filterClient, filterSearch]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    if (tab === "enfermagem") {
      setSearchParams({ tipo: "enfermagem" });
    } else {
      searchParams.delete("tipo");
      setSearchParams(searchParams);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFClientId("");
    setFType("medica");
    setFDate(format(new Date(), "yyyy-MM-dd"));
    setFAppointmentId("");
    setFSubjective("");
    setFObjective("");
    setFAssessment("");
    setFPlan("");
    setFCid("");
    setFNotes("");
    setAppointments([]);
    setIsFormOpen(true);
  };

  const openEdit = (evo: ClinicalEvolution) => {
    setEditingId(evo.id);
    setFClientId(evo.patient_id);
    setFType(evo.evolution_type);
    setFDate(evo.evolution_date);
    setFAppointmentId(evo.appointment_id ?? "");
    setFSubjective(evo.subjective ?? "");
    setFObjective(evo.objective ?? "");
    setFAssessment(evo.assessment ?? "");
    setFPlan(evo.plan ?? "");
    setFCid(evo.cid_code ?? "");
    setFNotes(evo.notes ?? "");
    fetchAppointments(evo.patient_id);
    setIsFormOpen(true);
  };

  const applyTemplate = (type: ClinicalEvolutionType) => {
    setFType(type);
    const tpl = SOAP_TEMPLATES.find((t) => t.key === type);
    if (tpl && !fSubjective && !fObjective && !fAssessment && !fPlan) {
      setFSubjective(tpl.subjective);
      setFObjective(tpl.objective);
      setFAssessment(tpl.assessment);
      setFPlan(tpl.plan);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !profile) return;
    if (!fClientId) { toast.error("Selecione o paciente"); return; }
    if (!fSubjective && !fObjective && !fAssessment && !fPlan) {
      toast.error("Preencha pelo menos um campo SOAP"); return;
    }
    setIsSaving(true);
    try {
      const hash = await generateRecordHash({
        subjective: fSubjective, objective: fObjective,
        assessment: fAssessment, plan: fPlan, cid_code: fCid,
      });
      const payload = {
        tenant_id: tenantId,
        patient_id: fClientId,
        professional_id: profile.id,
        appointment_id: fAppointmentId || null,
        evolution_date: fDate,
        evolution_type: fType,
        subjective: fSubjective || null,
        objective: fObjective || null,
        assessment: fAssessment || null,
        plan: fPlan || null,
        cid_code: fCid || null,
        notes: fNotes || null,
        digital_hash: hash,
        signed_at: new Date().toISOString(),
        signed_by_name: profile.full_name,
        signed_by_crm: profile.crm || null,
        signed_by_uf: profile.council_state || null,
      };

      if (editingId) {
        const { error } = await db.from("clinical_evolutions")
          .update(payload).eq("id", editingId).eq("tenant_id", tenantId);
        if (error) throw error;
        toast.success("Evolução atualizada");
      } else {
        const { error } = await db.from("clinical_evolutions").insert(payload);
        if (error) throw error;
        toast.success("Evolução registrada");
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      logger.error("Evolucoes.save", err);
      toast.error("Erro ao salvar evolução");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await db.from("clinical_evolutions")
        .delete().eq("id", deletingId).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Evolução excluída");
      setDeletingId(null);
      fetchData();
    } catch (err) {
      logger.error("Evolucoes.delete", err);
      toast.error("Erro ao excluir");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdf = (evo: ClinicalEvolution) => {
    try {
      const clinicName = profile?.tenant_id ? "Clínica" : "Clínica";
      generateEvolutionPdf({
        clinicName,
        professionalName: evo.profiles?.full_name ?? evo.signed_by_name ?? "",
        patientName: evo.patient?.name ?? "",
        evolutionDate: evo.evolution_date,
        evolutionType: EVOLUTION_TYPE_LABELS[evo.evolution_type] ?? evo.evolution_type,
        subjective: evo.subjective,
        objective: evo.objective,
        assessment: evo.assessment,
        plan: evo.plan,
        cidCode: evo.cid_code,
        notes: evo.notes,
        signedByName: evo.signed_by_name,
        signedByCrm: evo.signed_by_crm,
        signedByUf: evo.signed_by_uf,
        signedAt: evo.signed_at,
        digitalHash: evo.digital_hash,
      });
      toast.success("PDF gerado");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  const clientAppts = useMemo(() =>
    appointments.filter((a) => a.patient_id === fClientId),
  [appointments, fClientId]);

  const nursingClientAppts = useMemo(() =>
    appointments.filter((a) => a.patient_id === nfPatientId),
  [appointments, nfPatientId]);

  // Nursing form functions
  const openNursingCreate = () => {
    setNfPatientId("");
    setNfAppointmentId("");
    setNfNandaCode("");
    setNfNandaDiagnosis("");
    setNfNicCode("");
    setNfNicIntervention("");
    setNfNicActivities("");
    setNfNocCode("");
    setNfNocOutcome("");
    setNfNocScoreInitial("3");
    setNfNocScoreCurrent("3");
    setNfNocScoreTarget("5");
    setNfNotes("");
    setAppointments([]);
    setIsNursingFormOpen(true);
  };

  const handleNursingPatientChange = (patientId: string) => {
    setNfPatientId(patientId);
    setNfAppointmentId("");
    if (patientId) fetchAppointments(patientId);
    else setAppointments([]);
  };

  const handleSelectNanda = (code: string, label: string) => {
    setNfNandaCode(code);
    setNfNandaDiagnosis(label);
  };

  const handleSelectNic = (code: string, label: string) => {
    setNfNicCode(code);
    setNfNicIntervention(label);
  };

  const handleSelectNoc = (code: string, label: string) => {
    setNfNocCode(code);
    setNfNocOutcome(label);
  };

  const handleNursingSave = async () => {
    if (!tenantId || !profile) return;
    if (!nfPatientId || !nfNandaDiagnosis.trim()) {
      toast.error("Paciente e diagnóstico NANDA são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("nursing_evolutions").insert({
        tenant_id: tenantId,
        patient_id: nfPatientId,
        professional_id: profile.id,
        appointment_id: nfAppointmentId || null,
        nanda_code: nfNandaCode || null,
        nanda_diagnosis: nfNandaDiagnosis,
        nic_code: nfNicCode || null,
        nic_intervention: nfNicIntervention || null,
        nic_activities: nfNicActivities || null,
        noc_code: nfNocCode || null,
        noc_outcome: nfNocOutcome || null,
        noc_score_initial: nfNocScoreInitial ? Number(nfNocScoreInitial) : null,
        noc_score_current: nfNocScoreCurrent ? Number(nfNocScoreCurrent) : null,
        noc_score_target: nfNocScoreTarget ? Number(nfNocScoreTarget) : null,
        notes: nfNotes || null,
      });
      if (error) throw error;
      toast.success("Evolução de enfermagem registrada");
      setIsNursingFormOpen(false);
      fetchData();
    } catch (err) {
      logger.error("Evolucoes.saveNursing", err);
      toast.error("Erro ao salvar evolução de enfermagem");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNursingDelete = async () => {
    if (!deletingNursingId || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("nursing_evolutions")
        .delete().eq("id", deletingNursingId).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Evolução de enfermagem excluída");
      setDeletingNursingId(null);
      fetchData();
    } catch (err) {
      logger.error("Evolucoes.deleteNursing", err);
      toast.error("Erro ao excluir");
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
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Evoluções Clínicas</h1>
            <p className="text-sm text-muted-foreground">Registro SOAP e NANDA/NIC/NOC — acompanhamento contínuo do paciente</p>
          </div>
          <div className="flex gap-2">
            {canCreateSOAP && (
              <Button onClick={openCreate} className="gradient-primary gap-2">
                <Stethoscope className="h-4 w-4" />Nova SOAP
              </Button>
            )}
            {canCreateNursing && (
              <Button onClick={openNursingCreate} variant="outline" className="gap-2">
                <Clipboard className="h-4 w-4" />Nova Enfermagem
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="todas" className="gap-2">
              <ClipboardList className="h-4 w-4" />Todas
            </TabsTrigger>
            <TabsTrigger value="soap" className="gap-2">
              <Stethoscope className="h-4 w-4" />SOAP
            </TabsTrigger>
            <TabsTrigger value="enfermagem" className="gap-2">
              <Clipboard className="h-4 w-4" />Enfermagem
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por conteúdo ou paciente..." className="pl-9"
                value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
            </div>
            <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Paciente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pacientes</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(activeTab === "todas" || activeTab === "soap") && (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {SOAP_TYPES.map((t) => <SelectItem key={t} value={t}>{EVOLUTION_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tab: Todas */}
          <TabsContent value="todas" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
            ) : (filtered.length === 0 && filteredNursing.length === 0) ? (
              <EmptyEvolutionsState />
            ) : (
              <div className="space-y-3">
                {filtered.map((evo) => (
                  <SoapEvolutionCard key={evo.id} evo={evo} onEdit={openEdit} onDelete={setDeletingId} onPdf={handlePdf} />
                ))}
                {filteredNursing.map((evo) => (
                  <NursingEvolutionCard key={evo.id} evo={evo} onDelete={setDeletingNursingId} nocTrend={nocTrend} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: SOAP */}
          <TabsContent value="soap" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyEvolutionsState type="soap" />
            ) : (
              <div className="space-y-3">
                {filtered.map((evo) => (
                  <SoapEvolutionCard key={evo.id} evo={evo} onEdit={openEdit} onDelete={setDeletingId} onPdf={handlePdf} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Enfermagem */}
          <TabsContent value="enfermagem" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : filteredNursing.length === 0 ? (
              <EmptyEvolutionsState type="enfermagem" />
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Evoluções de Enfermagem ({filteredNursing.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
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
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNursing.map(evo => (
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
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingNursingId(evo.id)}>
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Drawer */}
      <FormDrawer
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingId ? "Editar Evolução" : "Nova Evolução Clínica (SOAP)"}
        description="Preencha os campos S-O-A-P do acompanhamento do paciente."
        width="xl"
        onSubmit={handleSave}
        isSubmitting={isSaving}
        submitLabel={editingId ? "Salvar" : "Registrar Evolução"}
      >
        <div className="space-y-4">
          <FormDrawerSection title="Identificação">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Paciente *</Label>
                <Select value={fClientId || "none"} onValueChange={(v) => {
                  const val = v === "none" ? "" : v;
                  setFClientId(val);
                  if (val) fetchAppointments(val);
                  else setAppointments([]);
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar paciente</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Evolução</Label>
                <Select value={fType} onValueChange={(v) => applyTemplate(v as ClinicalEvolutionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t} value={t}>{EVOLUTION_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
            </div>

            {clientAppts.length > 0 && (
              <div className="space-y-1.5">
                <Label>Vincular a consulta (opcional)</Label>
                <Select value={fAppointmentId || "none"} onValueChange={(v) => setFAppointmentId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {clientAppts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {format(parseISO(a.appointment_date), "dd/MM/yyyy")} às {a.start_time?.slice(0, 5)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormDrawerSection>

          {/* SOAP Fields */}
          <FormDrawerSection title="Registro SOAP">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-700 font-bold text-xs dark:bg-blue-900 dark:text-blue-300">S</span>
                  Subjetivo
                </Label>
                <Textarea placeholder="Queixa do paciente, relato, sintomas..." rows={3}
                  value={fSubjective} onChange={(e) => setFSubjective(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-emerald-700 font-bold text-xs dark:bg-emerald-900 dark:text-emerald-300">O</span>
                  Objetivo
                </Label>
                <Textarea placeholder="Exame físico, sinais vitais, achados objetivos..." rows={3}
                  value={fObjective} onChange={(e) => setFObjective(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-700 font-bold text-xs dark:bg-amber-900 dark:text-amber-300">A</span>
                  Avaliação
                </Label>
                <Textarea placeholder="Diagnóstico, impressão clínica, raciocínio..." rows={3}
                  value={fAssessment} onChange={(e) => setFAssessment(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-violet-100 text-violet-700 font-bold text-xs dark:bg-violet-900 dark:text-violet-300">P</span>
                  Plano
                </Label>
                <Textarea placeholder="Conduta, prescrições, encaminhamentos, retorno..." rows={3}
                  value={fPlan} onChange={(e) => setFPlan(e.target.value)} />
              </div>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Complementos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CID-10</Label>
                <Cid10Combobox value={fCid} onChange={setFCid} />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Input placeholder="Notas adicionais..." value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
              </div>
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>

      {/* Delete SOAP */}
      <ConfirmDeleteDialog
        open={!!deletingId}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        itemName="esta evolução"
        itemType="evolução clínica"
        isDeleting={isSaving}
      />

      {/* Nursing Form Drawer */}
      <FormDrawer
        open={isNursingFormOpen}
        onOpenChange={setIsNursingFormOpen}
        title="Nova Evolução de Enfermagem"
        description="Registre usando a classificação NANDA-I / NIC / NOC"
        width="lg"
        onSubmit={handleNursingSave}
        isSubmitting={isSaving}
        submitLabel="Registrar Evolução"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={nfPatientId || "none"} onValueChange={(v) => handleNursingPatientChange(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar paciente</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {nursingClientAppts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Vincular a consulta (opcional)</Label>
                <Select value={nfAppointmentId || "none"} onValueChange={(v) => setNfAppointmentId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {nursingClientAppts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {format(parseISO(a.appointment_date), "dd/MM/yyyy")} às {a.start_time?.slice(0, 5)}
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
              <CardTitle className="text-sm text-red-700 dark:text-red-400">NANDA-I — Diagnóstico de Enfermagem</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar diagnóstico NANDA</Label>
                <NandaNicNocCombobox
                  items={NANDA_DIAGNOSES}
                  value={nfNandaCode}
                  onChange={handleSelectNanda}
                  placeholder="Buscar por código ou nome..."
                  badgeColor="text-red-600 border-red-300"
                  groupKey="domain"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input value={nfNandaCode} onChange={e => setNfNandaCode(e.target.value)} placeholder="00132" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Diagnóstico *</Label>
                  <Input value={nfNandaDiagnosis} onChange={e => setNfNandaDiagnosis(e.target.value)} placeholder="Dor aguda" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NIC */}
          <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-blue-700 dark:text-blue-400">NIC — Intervenções de Enfermagem</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar intervenção NIC</Label>
                <NandaNicNocCombobox
                  items={NIC_INTERVENTIONS}
                  value={nfNicCode}
                  onChange={handleSelectNic}
                  placeholder="Buscar por código ou nome..."
                  badgeColor="text-blue-600 border-blue-300"
                  groupKey="class"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código NIC</Label>
                  <Input value={nfNicCode} onChange={e => setNfNicCode(e.target.value)} placeholder="1400" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Intervenção</Label>
                  <Input value={nfNicIntervention} onChange={e => setNfNicIntervention(e.target.value)} placeholder="Controle da dor" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Atividades realizadas</Label>
                <Textarea value={nfNicActivities} onChange={e => setNfNicActivities(e.target.value)} placeholder="Descreva as atividades de enfermagem realizadas..." rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* NOC */}
          <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-green-700 dark:text-green-400">NOC — Resultados de Enfermagem</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Buscar resultado NOC</Label>
                <NandaNicNocCombobox
                  items={NOC_OUTCOMES}
                  value={nfNocCode}
                  onChange={handleSelectNoc}
                  placeholder="Buscar por código ou nome..."
                  badgeColor="text-green-600 border-green-300"
                  groupKey="class"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código NOC</Label>
                  <Input value={nfNocCode} onChange={e => setNfNocCode(e.target.value)} placeholder="2102" className="font-mono" />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Resultado esperado</Label>
                  <Input value={nfNocOutcome} onChange={e => setNfNocOutcome(e.target.value)} placeholder="Nível de dor" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Score Inicial (1-5)</Label>
                  <Input type="number" min="1" max="5" value={nfNocScoreInitial} onChange={e => setNfNocScoreInitial(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score Atual (1-5)</Label>
                  <Input type="number" min="1" max="5" value={nfNocScoreCurrent} onChange={e => setNfNocScoreCurrent(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score Meta (1-5)</Label>
                  <Input type="number" min="1" max="5" value={nfNocScoreTarget} onChange={e => setNfNocScoreTarget(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Observações gerais</Label>
            <Textarea value={nfNotes} onChange={e => setNfNotes(e.target.value)} placeholder="Anotações adicionais..." rows={2} />
          </div>
        </div>
      </FormDrawer>

      {/* Delete Nursing */}
      <ConfirmDeleteDialog
        open={!!deletingNursingId}
        onConfirm={handleNursingDelete}
        onCancel={() => setDeletingNursingId(null)}
        itemName="esta evolução"
        itemType="evolução de enfermagem"
        isDeleting={isSaving}
      />
    </MainLayout>
  );
}
