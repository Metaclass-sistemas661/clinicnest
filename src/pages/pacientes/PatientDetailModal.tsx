import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, DollarSign, Stethoscope, Package, Clock, NotebookPen,
  ClipboardList, Pill, FlaskConical, ArrowRightLeft, FileText,
  ExternalLink, ShieldCheck, FileSignature, MessageCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { EVOLUTION_TYPE_LABELS, EVOLUTION_TYPE_COLORS } from "@/lib/soap-templates";
import { PatientConsentsViewer } from "@/components/consent/PatientConsentsViewer";
import type { Patient } from "@/types/database";
import type { ClinicalEvolution } from "@/types/database";
import type { PatientTimelineEventRow } from "@/types/supabase-extensions";
import { formatDate } from "./helpers";
import type { PatientPackage, ClinicalHistoryItem } from "./helpers";
import { fetchPatientSpendingAllTime, type PatientSpendingRow } from "@/lib/patientSpending";
import { logger } from "@/lib/logger";

interface Props {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  isAdmin: boolean;
  tenantId: string;
  timeline: PatientTimelineEventRow[];
  packages: PatientPackage[];
  clinicalHistory: ClinicalHistoryItem[];
  evolutions: ClinicalEvolution[];
  onOpenPackageDialog: (patientId: string) => void;
  onRevertPackage: (appointmentId: string) => void;
  onOpenContracts: (patient: Patient) => void;
  onSendLink: (patient: Patient) => void;
  onOpenDrawer: (patient: Patient) => void;
}

export function PatientDetailModal({
  patient, open, onOpenChange, isLoading, isAdmin, tenantId,
  timeline, packages, clinicalHistory, evolutions,
  onOpenPackageDialog, onRevertPackage,
  onOpenContracts, onSendLink, onOpenDrawer,
}: Props) {
  const navigate = useNavigate();
  const [spending, setSpending] = useState<PatientSpendingRow | null>(null);

  useEffect(() => {
    if (!open || !patient?.id || !tenantId || !isAdmin) {
      setSpending(null);
      return;
    }
    let cancelled = false;
    fetchPatientSpendingAllTime(tenantId)
      .then((data) => {
        if (!cancelled) {
          setSpending(data.find((s) => s.patient_id === patient.id) ?? null);
        }
      })
      .catch((err) => logger.error("Error fetching patient spending:", err));
    return () => { cancelled = true; };
  }, [open, patient?.id, tenantId, isAdmin]);

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient.name}</DialogTitle>
          <DialogDescription>Histórico, pacotes e fidelidade</DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={() => { onOpenChange(false); navigate(`/pacientes/${patient.id}`); }}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Ver Ficha Completa
        </Button>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="consumo" className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-auto gap-1 p-1">
              <TabsTrigger value="consumo" className="text-xs py-2"><DollarSign className="h-3 w-3 mr-1" />Consumo</TabsTrigger>
              <TabsTrigger value="clinico" className="text-xs py-2"><ClipboardList className="h-3 w-3 mr-1" />Clínico</TabsTrigger>
              <TabsTrigger value="evolucoes" className="text-xs py-2"><NotebookPen className="h-3 w-3 mr-1" />Evoluções</TabsTrigger>
              <TabsTrigger value="pacotes" className="text-xs py-2"><Package className="h-3 w-3 mr-1" />Pacotes</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs py-2"><Clock className="h-3 w-3 mr-1" />Timeline</TabsTrigger>
              <TabsTrigger value="termos" className="text-xs py-2"><ShieldCheck className="h-3 w-3 mr-1" />Termos</TabsTrigger>
            </TabsList>

            {/* Tab: Consumo */}
            <TabsContent value="consumo" className="mt-4 space-y-4">
              {!spending ? (
                <p className="text-muted-foreground text-sm py-4">Nenhum consumo registrado.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">Total: {formatCurrency(spending.total_amount)}</Badge>
                    <Badge variant="outline" className="text-sm">Ticket médio: {formatCurrency(spending.ticket_medio)}</Badge>
                    <Badge variant="outline" className="text-sm">{spending.services_count} procedimento{spending.services_count !== 1 ? "s" : ""}</Badge>
                    <Badge variant="outline" className="text-sm">{spending.products_count} produto{spending.products_count !== 1 ? "s" : ""}</Badge>
                  </div>
                  {spending.services_detail.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2"><Stethoscope className="h-4 w-4" />Procedimentos realizados</h4>
                      <div className="rounded-lg border divide-y text-sm">
                        {spending.services_detail.map((s, i) => (
                          <div key={i} className="flex justify-between items-center px-3 py-2">
                            <span>{s.name}</span>
                            <span className="text-muted-foreground">{formatDate(s.date)}</span>
                            <span className="font-medium">{formatCurrency(s.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {spending.products_detail.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2"><Package className="h-4 w-4" />Produtos comprados</h4>
                      <div className="rounded-lg border divide-y text-sm">
                        {spending.products_detail.map((p, i) => (
                          <div key={i} className="flex justify-between items-center px-3 py-2">
                            <span>{p.name}</span>
                            <span className="text-muted-foreground">{formatDate(p.date)}</span>
                            <span className="font-medium">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab: Histórico Clínico */}
            <TabsContent value="clinico" className="mt-4 space-y-3">
              {clinicalHistory.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nenhum registro clínico" description="Prontuários, receitas, atestados, laudos e encaminhamentos deste paciente aparecerão aqui." />
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
                    const labelMap: Record<string, string> = {
                      prontuario: "Prontuário", receita: "Receita", atestado: "Atestado", laudo: "Laudo", encaminhamento: "Encaminhamento",
                    };
                    return (
                      <div key={`${doc.type}-${doc.id}`} className="rounded-lg border p-3 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                          {iconMap[doc.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            <Badge variant="outline" className={`text-[10px] ${colorMap[doc.type] || ""}`}>
                              {labelMap[doc.type] || doc.type}
                            </Badge>
                          </div>
                          {doc.subtitle && <p className="text-xs text-muted-foreground truncate">{doc.subtitle}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(doc.date).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab: Evoluções SOAP */}
            <TabsContent value="evolucoes" className="mt-4 space-y-3">
              {evolutions.length === 0 ? (
                <EmptyState icon={NotebookPen} title="Nenhuma evolução" description="Evoluções clínicas SOAP deste paciente aparecerão aqui." />
              ) : (
                <div className="space-y-2">
                  {evolutions.map((evo) => (
                    <div key={evo.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] ${EVOLUTION_TYPE_COLORS[evo.evolution_type]}`}>
                          {EVOLUTION_TYPE_LABELS[evo.evolution_type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(evo.evolution_date).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs text-muted-foreground">— {evo.profiles?.full_name ?? ""}</span>
                        {evo.cid_code && <Badge variant="outline" className="text-[10px]">{evo.cid_code}</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {evo.subjective && <div><span className="font-bold text-blue-600">S: </span><span className="text-muted-foreground">{evo.subjective.substring(0, 120)}</span></div>}
                        {evo.objective && <div><span className="font-bold text-emerald-600">O: </span><span className="text-muted-foreground">{evo.objective.substring(0, 120)}</span></div>}
                        {evo.assessment && <div><span className="font-bold text-amber-600">A: </span><span className="text-muted-foreground">{evo.assessment.substring(0, 120)}</span></div>}
                        {evo.plan && <div><span className="font-bold text-violet-600">P: </span><span className="text-muted-foreground">{evo.plan.substring(0, 120)}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Pacotes */}
            <TabsContent value="pacotes" className="mt-4 space-y-4">
              {isAdmin && (
                <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => onOpenPackageDialog(patient.id)}>
                  <Plus className="mr-2 h-4 w-4" />Novo Pacote
                </Button>
              )}
              {packages.length === 0 ? (
                <EmptyState icon={Package} title="Nenhum pacote" description="Este paciente ainda não possui pacotes de sessões." />
              ) : (
                <div className="rounded-lg border divide-y text-sm">
                  {packages.map((p) => (
                    <div key={p.id} className="flex justify-between items-center px-3 py-2 gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.service_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.status === "active" ? "Ativo" : p.status === "depleted" ? "Esgotado" : p.status}
                          {p.purchased_at && ` · Comprado em ${new Date(p.purchased_at).toLocaleDateString("pt-BR")}`}
                        </div>
                      </div>
                      <Badge variant={p.remaining_sessions > 0 ? "secondary" : "outline"}>
                        {p.remaining_sessions}/{p.total_sessions}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Timeline */}
            <TabsContent value="timeline" className="mt-4 space-y-4">
              {timeline.length === 0 ? (
                <EmptyState icon={Clock} title="Nenhum evento" description="O histórico do paciente aparecerá aqui." />
              ) : (
                <div className="rounded-lg border divide-y text-sm">
                  {timeline.map((ev, i) => (
                    <div key={`${ev.kind}-${ev.event_at}-${i}`} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium truncate">{ev.title}</div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {new Date(ev.event_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                      {ev.body && <div className="text-xs text-muted-foreground mt-1">{ev.body}</div>}
                      {isAdmin && ev.kind === "appointment" && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const aptId = String((ev as any)?.meta?.appointment_id ?? "");
                              if (!aptId) return;
                              onRevertPackage(aptId);
                            }}
                          >
                            Estornar sessão do pacote
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Termos e Consentimentos */}
            <TabsContent value="termos" className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground"
                  onClick={() => { onOpenChange(false); onOpenContracts(patient); }}
                >
                  <FileSignature className="mr-2 h-4 w-4" />Gerar Contrato e Termos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onOpenChange(false); onSendLink(patient); }}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-green-600" />Enviar Link WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onOpenChange(false); onOpenDrawer(patient); }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4 text-primary" />Abrir Painel Completo
                </Button>
              </div>
              <PatientConsentsViewer
                patientId={patient.id}
                patientName={patient.name}
                tenantId={tenantId}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
