import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createPatientPackageV1, getPatientTimelineV1, revertPackageConsumptionForAppointmentV1 } from "@/lib/supabase-typed-rpc";
import { Plus, Search, KeyRound, Copy, Check, Lock, Sparkles, FileSpreadsheet } from "lucide-react";
import { GenerateContractsDialog } from "@/components/consent/GenerateContractsDialog";
import { SendConsentLinkDialog } from "@/components/consent/SendConsentLinkDialog";
import { PatientContractsDrawer } from "@/components/consent/PatientContractsDrawer";
import type { ClinicalEvolution } from "@/types/database";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import type { Patient } from "@/types/database";
import type { PatientTimelineEventRow } from "@/types/supabase-extensions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { UsageIndicator } from "@/components/subscription/LimitGate";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { CsvImportDialog } from "@/components/patient/CsvImportDialog";
import { Link } from "react-router-dom";

import { PatientFormDialog, PatientTable, PatientDetailModal, PatientPackageDialog } from "./pacientes/index";
import type { PatientPackage, ClinicalHistoryItem } from "./pacientes/helpers";

export default function Pacientes() {
  const { profile, isAdmin } = useAuth();
  const { isWithinLimit, getLimit } = usePlanFeatures();

  // ── Patient list state ───────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);

  // ── Form dialog ──────────────────────────────────────────────
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // ── Detail modal ─────────────────────────────────────────────
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTimeline, setDetailTimeline] = useState<PatientTimelineEventRow[]>([]);
  const [detailPackages, setDetailPackages] = useState<PatientPackage[]>([]);
  const [isDetailLoadingExtras, setIsDetailLoadingExtras] = useState(false);
  const [clinicalHistory, setClinicalHistory] = useState<ClinicalHistoryItem[]>([]);
  const [patientEvolutions, setPatientEvolutions] = useState<ClinicalEvolution[]>([]);

  // ── Staff filter ─────────────────────────────────────────────
  const [myPatientIds, setMyPatientIds] = useState<Set<string>>(new Set());
  const [patientFilter, setPatientFilter] = useState<"all" | "mine">("all");

  // ── Package dialog ───────────────────────────────────────────
  const [packageDialog, setPackageDialog] = useState(false);
  const [packagePatientId, setPackagePatientId] = useState("");
  const [procedures, setProcedures] = useState<Array<{ id: string; name: string }>>([]);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // ── Access code dialog ───────────────────────────────────────
  const [accessCodeDialog, setAccessCodeDialog] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  // ── Auxiliary dialogs ────────────────────────────────────────
  const [contractsPatient, setContractsPatient] = useState<Patient | null>(null);
  const [sendLinkPatient, setSendLinkPatient] = useState<Patient | null>(null);
  const [drawerPatient, setDrawerPatient] = useState<Patient | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // ── Data fetching ────────────────────────────────────────────

  const fetchPatients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id,tenant_id,name,phone,email,notes,cpf,access_code,date_of_birth,marital_status,zip_code,street,street_number,complement,neighborhood,city,state,allergies,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setPatients((data as Patient[]) || []);
    } catch (error) {
      logger.error("Error fetching patients:", error);
      toast.error("Erro ao carregar pacientes. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProcedures = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      setProcedures((data || []) as Array<{ id: string; name: string }>);
    } catch (err) {
      logger.error("Error fetching procedures:", err);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPatients();
      fetchProcedures();
    }
  }, [profile?.tenant_id, isAdmin]);

  // Staff: own patient IDs
  useEffect(() => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("appointments")
          .select("patient_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .not("patient_id", "is", null);
        setMyPatientIds(new Set((data || []).map((r: { patient_id: string }) => r.patient_id)));
      } catch (err) {
        logger.error("Error fetching my patients:", err);
      }
    })();
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  // Load detail extras when modal opens
  useEffect(() => {
    if (!isDetailOpen || !detailPatient?.id || !profile?.tenant_id) {
      setDetailTimeline([]);
      setDetailPackages([]);
      setClinicalHistory([]);
      setPatientEvolutions([]);
      setIsDetailLoadingExtras(false);
      return;
    }
    const patientId = detailPatient.id;
    const tenantId = profile.tenant_id;

    (async () => {
      setIsDetailLoadingExtras(true);
      try {
        const [{ data: timelineData, error: timelineError }, packagesRes] = await Promise.all([
          getPatientTimelineV1({ p_patient_id: patientId, p_limit: 50 }),
          supabase
            .from("patient_packages")
            .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
            .eq("tenant_id", tenantId)
            .eq("patient_id", patientId)
            .order("purchased_at", { ascending: false }),
        ]);

        if (timelineError) toastRpcError(toast, timelineError as any, "Erro ao carregar histórico");
        else setDetailTimeline((timelineData || []) as PatientTimelineEventRow[]);

        if (!packagesRes.error) {
          setDetailPackages((packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Procedimento"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          })));
        }

        const clinDocs: ClinicalHistoryItem[] = [];
        const [recRes, certRes, examRes, refRes, mrRes] = await Promise.all([
          supabase.from("prescriptions").select("id, issued_at, medications, prescription_type").eq("tenant_id", tenantId).eq("patient_id", patientId).order("issued_at", { ascending: false }).limit(20),
          supabase.from("medical_certificates").select("id, issued_at, certificate_type, content").eq("tenant_id", tenantId).eq("patient_id", patientId).order("issued_at", { ascending: false }).limit(20),
          supabase.from("exam_results").select("id, created_at, exam_name, status").eq("tenant_id", tenantId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
          supabase.from("referrals").select("id, created_at, reason, status, specialties(name)").eq("tenant_id", tenantId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
          supabase.from("medical_records").select("id, record_date, chief_complaint, diagnosis, cid_code").eq("tenant_id", tenantId).eq("patient_id", patientId).order("record_date", { ascending: false }).limit(20),
        ]);

        (mrRes.data || []).forEach((d: any) => clinDocs.push({ id: d.id, type: "prontuario", title: d.chief_complaint || "Prontuário", subtitle: [d.diagnosis, d.cid_code].filter(Boolean).join(" — "), date: d.record_date }));
        (recRes.data || []).forEach((d: any) => clinDocs.push({ id: d.id, type: "receita", title: d.prescription_type === "simples" ? "Receita Simples" : d.prescription_type === "especial_b" ? "Receita Especial B" : "Receita Especial A", subtitle: (d.medications || "").substring(0, 60), date: d.issued_at }));
        (certRes.data || []).forEach((d: any) => clinDocs.push({ id: d.id, type: "atestado", title: d.certificate_type === "atestado" ? "Atestado Médico" : d.certificate_type === "declaracao_comparecimento" ? "Declaração" : d.certificate_type === "laudo" ? "Laudo Médico" : "Relatório Médico", subtitle: (d.content || "").substring(0, 60), date: d.issued_at }));
        (examRes.data || []).forEach((d: any) => clinDocs.push({ id: d.id, type: "laudo", title: d.exam_name, subtitle: d.status, date: d.created_at }));
        (refRes.data || []).forEach((d: any) => clinDocs.push({ id: d.id, type: "encaminhamento", title: `Encaminhamento${d.specialties?.name ? ` — ${d.specialties.name}` : ""}`, subtitle: (d.reason || "").substring(0, 60), date: d.created_at }));

        clinDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setClinicalHistory(clinDocs);

        const { data: evoData } = await (supabase as any).from("clinical_evolutions")
          .select("*, patient:patients(name), profiles(full_name)")
          .eq("tenant_id", tenantId).eq("patient_id", patientId)
          .order("evolution_date", { ascending: false }).limit(50);
        setPatientEvolutions((evoData ?? []) as ClinicalEvolution[]);
      } catch (err) {
        logger.error("Error loading patient extras:", err);
        toast.error("Erro ao carregar detalhes do paciente");
      } finally {
        setIsDetailLoadingExtras(false);
      }
    })();
  }, [isDetailOpen, detailPatient?.id, profile?.tenant_id]);

  // ── Derived / computed ───────────────────────────────────────

  const filteredPatients = useMemo(() => {
    let list = patients;
    if (!isAdmin && patientFilter === "mine") {
      list = list.filter((p) => myPatientIds.has(p.id));
    }
    if (!debouncedSearchQuery.trim()) return list;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone?.includes(debouncedSearchQuery) ||
        p.email?.toLowerCase().includes(q) ||
        p.access_code?.toLowerCase().includes(q)
    );
  }, [patients, debouncedSearchQuery, isAdmin, patientFilter, myPatientIds]);

  const canAddPatient = isWithinLimit("patients", patients.length);
  const patientLimit = getLimit("patients");

  // ── Handlers ─────────────────────────────────────────────────

  const handleOpenDialog = (patient?: Patient) => {
    setEditingPatient(patient ?? null);
    setIsDialogOpen(true);
  };

  const handleFormSaved = (result: { isNew: boolean; accessCode?: string; patientName: string }) => {
    setIsDialogOpen(false);
    setEditingPatient(null);
    fetchPatients();
    if (result.isNew && result.accessCode) {
      setNewAccessCode(result.accessCode);
      setNewPatientName(result.patientName);
      setCodeCopied(false);
      setAccessCodeDialog(true);
    } else {
      toast.success(result.isNew ? "Paciente cadastrado com sucesso!" : "Paciente atualizado com sucesso!");
    }
  };

  const openPackageDialog = (patientId: string) => {
    setPackagePatientId(patientId);
    setPackageDialog(true);
  };

  const handleCreatePackage = async (data: { procedure_id: string; total_sessions: number; expires_at: string | null; notes: string | null }) => {
    setIsSavingPackage(true);
    try {
      const { error } = await createPatientPackageV1({
        p_patient_id: packagePatientId,
        p_service_id: data.procedure_id,
        p_total_sessions: data.total_sessions,
        p_expires_at: data.expires_at,
        p_notes: data.notes,
      });
      if (error) { toastRpcError(toast, error as any, "Erro ao criar pacote"); return; }
      toast.success("Pacote criado com sucesso!");
      setPackageDialog(false);

      if (isDetailOpen && detailPatient?.id === packagePatientId && profile?.tenant_id) {
        const packagesRes = await supabase
          .from("patient_packages")
          .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("patient_id", packagePatientId)
          .order("purchased_at", { ascending: false });
        if (!packagesRes.error) {
          setDetailPackages((packagesRes.data || []).map((p: any) => ({
            id: String(p.id), procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Procedimento"),
            total_sessions: Number(p.total_sessions ?? 0), remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""), purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          })));
        }
      }
    } catch (err) {
      logger.error("[Pacientes] createPackage error", err);
      toast.error("Erro ao criar pacote");
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleRevertPackage = async (appointmentId: string) => {
    if (!isAdmin) return;
    const id = String(appointmentId || "").trim();
    if (!id) return;
    try {
      const { data, error } = await revertPackageConsumptionForAppointmentV1({
        p_appointment_id: id,
        p_reason: "Estorno manual via CRM",
      });
      if (error) { toastRpcError(toast, error as any, "Erro ao estornar pacote"); return; }
      if (!data?.success) { toast.error("Não foi possível estornar"); return; }
      data.reverted ? toast.success("Sessão estornada com sucesso") : toast.message("Nenhum consumo para estornar");

      if (detailPatient?.id) {
        setIsDetailLoadingExtras(true);
        const [{ data: timelineData }, packagesRes] = await Promise.all([
          getPatientTimelineV1({ p_patient_id: detailPatient.id, p_limit: 50 }),
          supabase.from("patient_packages")
            .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
            .eq("tenant_id", profile?.tenant_id)
            .eq("patient_id", detailPatient.id)
            .order("purchased_at", { ascending: false }),
        ]);
        setDetailTimeline((timelineData || []) as PatientTimelineEventRow[]);
        if (!packagesRes.error) {
          setDetailPackages((packagesRes.data || []).map((p: any) => ({
            id: String(p.id), procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Procedimento"),
            total_sessions: Number(p.total_sessions ?? 0), remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""), purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          })));
        }
      }
    } catch (err) {
      logger.error("Error reverting package consumption:", err);
      toast.error("Erro ao estornar pacote");
    } finally {
      setIsDetailLoadingExtras(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  const renderAddPatientButton = () => {
    if (!canAddPatient && !editingPatient) {
      return (
        <Link to="/assinatura">
          <Button variant="outline" className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <Lock className="h-4 w-4" />Limite Atingido<Sparkles className="h-4 w-4" />
          </Button>
        </Link>
      );
    }
    return (
      <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="patients-new">
        <Plus className="mr-2 h-4 w-4" />Novo Paciente
      </Button>
    );
  };

  return (
    <MainLayout
      title="Pacientes"
      subtitle={isAdmin ? "Gerencie os pacientes da clínica" : "Pacientes da clínica"}
      actions={
        <div className="flex items-center gap-4">
          {patientLimit !== -1 && (
            <div className="hidden sm:block">
              <UsageIndicator limit="patients" currentValue={patients.length} showLabel={false} size="sm" />
            </div>
          )}
          <FeatureGate feature="csvImport" showUpgradePrompt={false}>
            <Button variant="outline" className="gap-2 hidden sm:inline-flex" onClick={() => setCsvImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" />Importar CSV
            </Button>
          </FeatureGate>
          {renderAddPatientButton()}
        </div>
      }
    >
      {/* Search + Staff filter */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nome, telefone ou email..." className="pl-10" aria-label="Buscar pacientes" />
        </div>
        {!isAdmin && (
          <div className="flex rounded-lg border border-border bg-card">
            <Button variant={patientFilter === "all" ? "default" : "ghost"} size="sm" className={patientFilter === "all" ? "gradient-primary text-primary-foreground" : ""} onClick={() => setPatientFilter("all")} data-tour="patients-filter-all">
              Todos
            </Button>
            <Button variant={patientFilter === "mine" ? "default" : "ghost"} size="sm" className={patientFilter === "mine" ? "gradient-primary text-primary-foreground" : ""} onClick={() => setPatientFilter("mine")} data-tour="patients-filter-mine">
              Meus pacientes ({myPatientIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Patient Table (extracted component — no ranking/spending columns) */}
      <PatientTable
        patients={filteredPatients}
        isLoading={isLoading}
        isAdmin={isAdmin}
        tenantId={profile?.tenant_id}
        searchQuery={searchQuery}
        onEdit={(p) => handleOpenDialog(p)}
        onNewPatient={() => handleOpenDialog()}
        onOpenPackage={openPackageDialog}
        onOpenContracts={(p) => setContractsPatient(p)}
        onSendLink={(p) => setSendLinkPatient(p)}
        onOpenDrawer={(p) => setDrawerPatient(p)}
      />

      {/* Form Dialog (extracted component) */}
      <PatientFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingPatient={editingPatient}
        tenantId={profile?.tenant_id ?? ""}
        onSaved={handleFormSaved}
      />

      {/* Detail Modal (extracted component) */}
      <PatientDetailModal
        patient={detailPatient}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        isLoading={isDetailLoadingExtras}
        isAdmin={isAdmin}
        tenantId={profile?.tenant_id ?? ""}
        timeline={detailTimeline}
        packages={detailPackages}
        clinicalHistory={clinicalHistory}
        evolutions={patientEvolutions}
        onOpenPackageDialog={openPackageDialog}
        onRevertPackage={handleRevertPackage}
        onOpenContracts={(p) => setContractsPatient(p)}
        onSendLink={(p) => setSendLinkPatient(p)}
        onOpenDrawer={(p) => setDrawerPatient(p)}
      />

      {/* Package Dialog (extracted component) */}
      <PatientPackageDialog
        open={packageDialog}
        onOpenChange={setPackageDialog}
        procedures={procedures}
        isSaving={isSavingPackage}
        onSave={handleCreatePackage}
      />

      {/* Access Code Dialog */}
      <Dialog open={accessCodeDialog} onOpenChange={setAccessCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />Paciente cadastrado!
            </DialogTitle>
            <DialogDescription>
              Envie o código abaixo ao paciente <strong>{newPatientName}</strong> para que ele possa acessar o Portal do Paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex-1 text-center">
                <div className="text-xs text-muted-foreground mb-1">Código de acesso</div>
                <div className="text-2xl font-mono font-bold tracking-widest text-primary">{newAccessCode}</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(newAccessCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2500);
                  toast.success("Código copiado!");
                }}
              >
                {codeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              O paciente deve informar este código (ou CPF) na tela de login do portal para criar sua senha e acessar consultas, exames, receitas e teleconsultas.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAccessCodeDialog(false)} className="gradient-primary text-primary-foreground">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contracts Dialog */}
      {contractsPatient && (
        <GenerateContractsDialog open={!!contractsPatient} onOpenChange={(open) => { if (!open) setContractsPatient(null); }} patient={contractsPatient} />
      )}

      {/* Send Link Dialog */}
      <SendConsentLinkDialog open={!!sendLinkPatient} onOpenChange={(open) => { if (!open) setSendLinkPatient(null); }} patient={sendLinkPatient} />

      {/* CSV Import Dialog */}
      <CsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} onSuccess={fetchPatients} currentPatientCount={patients.length} patientLimit={patientLimit} />

      {/* Contracts Drawer */}
      {drawerPatient && profile?.tenant_id && (
        <PatientContractsDrawer
          patientId={drawerPatient.id}
          patientName={drawerPatient.name}
          tenantId={profile.tenant_id}
          open={!!drawerPatient}
          onOpenChange={(open) => { if (!open) setDrawerPatient(null); }}
          onGenerateContracts={() => { setDrawerPatient(null); setContractsPatient(drawerPatient); }}
          onSendLink={() => { setDrawerPatient(null); setSendLinkPatient(drawerPatient); }}
        />
      )}
    </MainLayout>
  );
}
