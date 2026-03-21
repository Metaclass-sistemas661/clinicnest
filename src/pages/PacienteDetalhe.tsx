import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { getClientTimelineV1 } from "@/lib/supabase-typed-rpc";
import { toastRpcError } from "@/lib/rpc-error";
import { EVOLUTION_TYPE_LABELS, EVOLUTION_TYPE_COLORS } from "@/lib/soap-templates";
import { PatientConsentsViewer } from "@/components/consent/PatientConsentsViewer";
import { GenerateContractsDialog } from "@/components/consent/GenerateContractsDialog";
import { fetchPatientSpendingAllTime, type PatientSpendingRow } from "@/lib/patientSpending";
import type { ClientTimelineEventRow } from "@/types/supabase-extensions";
import type { Client, ClinicalEvolution } from "@/types/database";
import {
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Pencil,
  Calendar,
  MessageCircle,
  DollarSign,
  ClipboardList,
  NotebookPen,
  Package,
  Clock,
  ShieldCheck,
  Plus,
  Pill,
  FlaskConical,
  ArrowRightLeft,
  FileText,
  Stethoscope,
  FileSignature,
} from "lucide-react";

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("consumo");

  // ── Keyboard shortcuts: Ctrl+1..6 switches tabs ──
  const TAB_KEYS = ["consumo", "clinico", "evolucoes", "pacotes", "timeline", "termos"] as const;
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TAB_KEYS.length) {
        e.preventDefault();
        setActiveTab(TAB_KEYS[idx - 1]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Data states
  const [patientSpending, setPatientSpending] = useState<PatientSpendingRow | null>(null);
  const [clinicalHistory, setClinicalHistory] = useState<Array<{
    id: string; type: string; title: string; subtitle: string; date: string;
  }>>([]);
  const [clientEvolutions, setClientEvolutions] = useState<ClinicalEvolution[]>([]);
  const [detailPackages, setDetailPackages] = useState<Array<{
    id: string; procedure_id: string; service_name: string;
    total_sessions: number; remaining_sessions: number;
    status: string; purchased_at: string; expires_at: string | null;
  }>>([]);
  const [detailTimeline, setDetailTimeline] = useState<ClientTimelineEventRow[]>([]);
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [isUpdatingMarketing, setIsUpdatingMarketing] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id && id) {
      fetchClient();
    }
  }, [profile?.tenant_id, id]);

  const fetchClient = async () => {
    if (!profile?.tenant_id || !id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", id)
        .single();
      if (error) throw error;
      setClient(data as Client);
      await loadExtras(id);
    } catch (err) {
      logger.error("Error fetching client:", err);
      toast.error("Paciente não encontrado");
      navigate("/clientes");
    } finally {
      setIsLoading(false);
    }
  };

  const loadExtras = async (patientId: string) => {
    if (!profile?.tenant_id) return;
    setIsLoadingExtras(true);
    try {
      const [spendingData, { data: timelineData, error: timelineError }, packagesRes, mktPrefRes] = await Promise.all([
        fetchPatientSpendingAllTime(profile.tenant_id),
        getClientTimelineV1({ p_client_id: patientId, p_limit: 50 }),
        supabase.from("patient_packages")
          .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("purchased_at", { ascending: false }),
        supabase.from("client_marketing_preferences")
          .select("marketing_opt_out")
          .eq("tenant_id", profile.tenant_id).eq("client_id", patientId)
          .maybeSingle(),
      ]);

      if (mktPrefRes.data) {
        setMarketingOptOut(mktPrefRes.data.marketing_opt_out ?? false);
      }

      const spending = spendingData.find((s) => s.patient_id === patientId);
      setPatientSpending(spending || null);

      if (timelineError) toastRpcError(toast, timelineError as any, "Erro ao carregar histórico");
      else setDetailTimeline((timelineData || []) as ClientTimelineEventRow[]);

      if (!packagesRes.error) {
        setDetailPackages((packagesRes.data || []).map((p: any) => ({
          id: String(p.id), procedure_id: String(p.procedure_id),
          service_name: String(p?.procedure?.name ?? "Procedimento"),
          total_sessions: Number(p.total_sessions ?? 0),
          remaining_sessions: Number(p.remaining_sessions ?? 0),
          status: String(p.status ?? ""), purchased_at: String(p.purchased_at ?? ""),
          expires_at: p.expires_at ? String(p.expires_at) : null,
        })));
      }

      // Clinical history
      const clinDocs: typeof clinicalHistory = [];
      const [recRes, certRes, examRes, refRes, mrRes] = await Promise.all([
        supabase.from("prescriptions").select("id, issued_at, medications, prescription_type")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("issued_at", { ascending: false }).limit(20),
        supabase.from("medical_certificates").select("id, issued_at, certificate_type, content")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("issued_at", { ascending: false }).limit(20),
        supabase.from("exam_results").select("id, created_at, exam_name, status")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("referrals").select("id, created_at, reason, status, specialties(name)")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("medical_records").select("id, record_date, chief_complaint, diagnosis, cid_code")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("record_date", { ascending: false }).limit(20),
      ]);

      (mrRes.data || []).forEach((d: any) => clinDocs.push({
        id: d.id, type: "prontuario", title: d.chief_complaint || "Prontuário",
        subtitle: [d.diagnosis, d.cid_code].filter(Boolean).join(" — "), date: d.record_date,
      }));
      (recRes.data || []).forEach((d: any) => clinDocs.push({
        id: d.id, type: "receita",
        title: d.prescription_type === "simples" ? "Receita Simples" : d.prescription_type === "especial_b" ? "Receita Especial B" : "Receita Especial A",
        subtitle: (d.medications || "").substring(0, 60), date: d.issued_at,
      }));
      (certRes.data || []).forEach((d: any) => clinDocs.push({
        id: d.id, type: "atestado",
        title: d.certificate_type === "atestado" ? "Atestado Médico" : d.certificate_type === "declaracao_comparecimento" ? "Declaração" : d.certificate_type === "laudo" ? "Laudo Médico" : "Relatório Médico",
        subtitle: (d.content || "").substring(0, 60), date: d.issued_at,
      }));
      (examRes.data || []).forEach((d: any) => clinDocs.push({
        id: d.id, type: "laudo", title: d.exam_name, subtitle: d.status, date: d.created_at,
      }));
      (refRes.data || []).forEach((d: any) => clinDocs.push({
        id: d.id, type: "encaminhamento",
        title: `Encaminhamento${d.specialties?.name ? ` — ${d.specialties.name}` : ""}`,
        subtitle: (d.reason || "").substring(0, 60), date: d.created_at,
      }));
      clinDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setClinicalHistory(clinDocs);

      const { data: evoData } = await (supabase as any).from("clinical_evolutions")
        .select("*, patient:patients(name), profiles(full_name)")
        .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
        .order("evolution_date", { ascending: false }).limit(50);
      setClientEvolutions((evoData ?? []) as ClinicalEvolution[]);
    } catch (err) {
      logger.error("Error loading client extras:", err);
    } finally {
      setIsLoadingExtras(false);
    }
  };

  const handleToggleMarketingOptOut = async (checked: boolean) => {
    if (!profile?.tenant_id || !id) return;
    setIsUpdatingMarketing(true);
    try {
      const { error } = await supabase.from("client_marketing_preferences")
        .upsert({
          tenant_id: profile.tenant_id,
          client_id: id,
          marketing_opt_out: checked,
        }, { onConflict: "tenant_id,client_id" });
      if (error) throw error;
      setMarketingOptOut(checked);
      toast.success(checked ? "Opt-out de marketing ativado" : "Opt-out de marketing desativado");
    } catch (err) {
      logger.error("Error toggling marketing opt-out:", err);
      toast.error("Erro ao atualizar preferência de marketing");
    } finally {
      setIsUpdatingMarketing(false);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  if (isLoading) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!client) return null;

  const whatsappLink = client.phone
    ? `https://wa.me/55${client.phone.replace(/\D/g, "")}`
    : null;

  return (
    <MainLayout title="" subtitle="">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <Link to="/pacientes" className="hover:text-foreground transition-colors">
          Pacientes
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{client.name}</span>
      </nav>

      {/* Header do paciente */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            {/* Avatar */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{client.name}</h1>
                {client.allergies && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Alergia: {client.allergies.length > 30 ? client.allergies.substring(0, 30) + "..." : client.allergies}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {client.cpf && <span>CPF: {client.cpf}</span>}
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" onClick={() => navigate(`/clientes?edit=${client.id}`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" onClick={() => navigate(`/agenda?client=${client.id}`)}>
                <Calendar className="mr-2 h-4 w-4" />
                Agendar
              </Button>
              {whatsappLink && (
                <Button variant="outline" asChild>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full overflow-x-auto scrollbar-hide h-auto gap-1 p-1">
          <TabsTrigger value="consumo" className="gap-2 shrink-0">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Consumo</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃1</kbd>
          </TabsTrigger>
          <TabsTrigger value="clinico" className="gap-2 shrink-0">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Clínico</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃2</kbd>
          </TabsTrigger>
          <TabsTrigger value="evolucoes" className="gap-2 shrink-0">
            <NotebookPen className="h-4 w-4" />
            <span className="hidden sm:inline">Evoluções</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃3</kbd>
          </TabsTrigger>
          <TabsTrigger value="pacotes" className="gap-2 shrink-0">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Pacotes</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃4</kbd>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2 shrink-0">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃5</kbd>
          </TabsTrigger>
          <TabsTrigger value="termos" className="gap-2 shrink-0">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Termos</span>
            <kbd className="hidden sm:inline-block ml-1 rounded border border-border/50 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground leading-none">⌃6</kbd>
          </TabsTrigger>
        </TabsList>

        {isLoadingExtras ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Tab: Consumo */}
            <TabsContent value="consumo" className="space-y-4">
              {!patientSpending ? (
                <EmptyState icon={DollarSign} title="Nenhum consumo registrado" description="Este paciente ainda não realizou procedimentos ou compras." />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">Total: {formatCurrency(patientSpending.total_amount)}</Badge>
                    <Badge variant="outline" className="text-sm">Ticket médio: {formatCurrency(patientSpending.ticket_medio)}</Badge>
                    <Badge variant="outline" className="text-sm">{patientSpending.services_count} procedimento{patientSpending.services_count !== 1 ? "s" : ""}</Badge>
                    <Badge variant="outline" className="text-sm">{patientSpending.products_count} produto{patientSpending.products_count !== 1 ? "s" : ""}</Badge>
                  </div>

                  {patientSpending.services_detail.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Stethoscope className="h-4 w-4" />Procedimentos realizados</CardTitle></CardHeader>
                      <CardContent>
                        <div className="rounded-lg border divide-y text-sm">
                          {patientSpending.services_detail.map((s, i) => (
                            <div key={i} className="flex justify-between items-center px-3 py-2">
                              <span>{s.name}</span>
                              <span className="text-muted-foreground">{formatDate(s.date)}</span>
                              <span className="font-medium">{formatCurrency(s.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {patientSpending.products_detail.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Produtos comprados</CardTitle></CardHeader>
                      <CardContent>
                        <div className="rounded-lg border divide-y text-sm">
                          {patientSpending.products_detail.map((p, i) => (
                            <div key={i} className="flex justify-between items-center px-3 py-2">
                              <span>{p.name}</span>
                              <span className="text-muted-foreground">{formatDate(p.date)}</span>
                              <span className="font-medium">{formatCurrency(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isAdmin && (
                    <Card>
                      <CardContent className="py-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Opt-out de marketing</div>
                          <div className="text-xs text-muted-foreground">Paciente não deseja receber comunicações</div>
                        </div>
                        <Switch checked={marketingOptOut} onCheckedChange={handleToggleMarketingOptOut} disabled={isUpdatingMarketing} />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab: Clínico */}
            <TabsContent value="clinico" className="space-y-3">
              {clinicalHistory.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nenhum registro clínico" description="Prontuários, receitas, atestados, laudos e encaminhamentos aparecerão aqui." />
              ) : (
                <div className="space-y-2">
                  {clinicalHistory.map((doc) => {
                    const iconMap: Record<string, React.ReactNode> = {
                      prontuario: <ClipboardList className="h-4 w-4 text-primary" />,
                      receita: <Pill className="h-4 w-4 text-blue-500" />,
                      atestado: <FileText className="h-4 w-4 text-emerald-500" />,
                      laudo: <FlaskConical className="h-4 w-4 text-amber-500" />,
                      encaminhamento: <ArrowRightLeft className="h-4 w-4 text-purple-500" />,
                    };
                    const colorMap: Record<string, string> = {
                      prontuario: "bg-primary/10 text-primary border-primary/20",
                      receita: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                      atestado: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                      laudo: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                      encaminhamento: "bg-purple-500/10 text-purple-600 border-purple-500/20",
                    };
                    const labelMap: Record<string, string> = { prontuario: "Prontuário", receita: "Receita", atestado: "Atestado", laudo: "Laudo", encaminhamento: "Encaminhamento" };
                    return (
                      <Card key={`${doc.type}-${doc.id}`}>
                        <CardContent className="py-3 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">{iconMap[doc.type]}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{doc.title}</p>
                              <Badge variant="outline" className={`text-[10px] ${colorMap[doc.type] || ""}`}>{labelMap[doc.type] || doc.type}</Badge>
                            </div>
                            {doc.subtitle && <p className="text-xs text-muted-foreground truncate">{doc.subtitle}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{new Date(doc.date).toLocaleDateString("pt-BR")}</span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab: Evoluções */}
            <TabsContent value="evolucoes" className="space-y-3">
              {clientEvolutions.length === 0 ? (
                <EmptyState icon={NotebookPen} title="Nenhuma evolução" description="Evoluções clínicas SOAP aparecerão aqui." />
              ) : (
                <div className="space-y-2">
                  {clientEvolutions.map((evo) => (
                    <Card key={evo.id}>
                      <CardContent className="py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[10px] ${EVOLUTION_TYPE_COLORS[evo.evolution_type]}`}>{EVOLUTION_TYPE_LABELS[evo.evolution_type]}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(evo.evolution_date).toLocaleDateString("pt-BR")}</span>
                          <span className="text-xs text-muted-foreground">— {evo.profiles?.full_name ?? ""}</span>
                          {evo.cid_code && <Badge variant="outline" className="text-[10px]">{evo.cid_code}</Badge>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                          {evo.subjective && <div><span className="font-bold text-blue-600">S: </span><span className="text-muted-foreground">{evo.subjective.substring(0, 120)}</span></div>}
                          {evo.objective && <div><span className="font-bold text-emerald-600">O: </span><span className="text-muted-foreground">{evo.objective.substring(0, 120)}</span></div>}
                          {evo.assessment && <div><span className="font-bold text-amber-600">A: </span><span className="text-muted-foreground">{evo.assessment.substring(0, 120)}</span></div>}
                          {evo.plan && <div><span className="font-bold text-violet-600">P: </span><span className="text-muted-foreground">{evo.plan.substring(0, 120)}</span></div>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Pacotes */}
            <TabsContent value="pacotes" className="space-y-4">
              {isAdmin && (
                <Button size="sm" variant="gradient" onClick={() => navigate(`/pacientes?package=${client.id}`)}>
                  <Plus className="mr-2 h-4 w-4" />Novo Pacote
                </Button>
              )}
              {detailPackages.length === 0 ? (
                <EmptyState icon={Package} title="Nenhum pacote" description="Este paciente ainda não possui pacotes de sessões." />
              ) : (
                <div className="space-y-2">
                  {detailPackages.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="py-3 flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.service_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.status === "active" ? "Ativo" : p.status === "depleted" ? "Esgotado" : p.status}
                            {p.purchased_at && ` · Comprado em ${new Date(p.purchased_at).toLocaleDateString("pt-BR")}`}
                          </div>
                        </div>
                        <Badge variant={p.remaining_sessions > 0 ? "secondary" : "outline"}>{p.remaining_sessions}/{p.total_sessions}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Timeline */}
            <TabsContent value="timeline" className="space-y-4">
              {detailTimeline.length === 0 ? (
                <EmptyState icon={Clock} title="Nenhum evento" description="O histórico do paciente aparecerá aqui." />
              ) : (
                <div className="space-y-2">
                  {detailTimeline.map((ev, i) => (
                    <Card key={`${ev.kind}-${ev.event_at}-${i}`}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium truncate">{ev.title}</div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {new Date(ev.event_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        </div>
                        {ev.body && <div className="text-xs text-muted-foreground mt-1">{ev.body}</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Termos */}
            <TabsContent value="termos" className="space-y-4">
              <Button size="sm" variant="gradient" onClick={() => setContractsDialogOpen(true)}>
                <FileSignature className="mr-2 h-4 w-4" />Gerar Contrato e Termos
              </Button>
              <PatientConsentsViewer patientId={client.id} patientName={client.name} tenantId={profile?.tenant_id ?? ""} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialog: Gerar Contratos */}
      {client && (
        <GenerateContractsDialog
          open={contractsDialogOpen}
          onOpenChange={setContractsDialogOpen}
          patient={client}
        />
      )}
    </MainLayout>
  );
}
