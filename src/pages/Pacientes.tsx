import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createPatientPackageV1 } from "@/lib/supabase-typed-rpc";
import { Plus, Search, Lock, Sparkles, FileSpreadsheet } from "lucide-react";
import { GenerateContractsDialog } from "@/components/consent/GenerateContractsDialog";
import { SendConsentLinkDialog } from "@/components/consent/SendConsentLinkDialog";
import { PatientContractsDrawer } from "@/components/consent/PatientContractsDrawer";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import type { Patient } from "@/types/database";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { UsageIndicator } from "@/components/subscription/LimitGate";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { CsvImportDialog } from "@/components/patient/CsvImportDialog";
import { Link, useNavigate } from "react-router-dom";

import { PatientTable, PatientPackageDialog } from "./pacientes/index";

export default function Pacientes() {
  const { profile, isAdmin } = useAuth();
  const { isWithinLimit, getLimit } = usePlanFeatures();
  const navigate = useNavigate();

  // ── Patient list state ───────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);

  // ── Staff filter ─────────────────────────────────────────────
  const [myPatientIds, setMyPatientIds] = useState<Set<string>>(new Set());
  const [patientFilter, setPatientFilter] = useState<"all" | "mine">("all");

  // ── Package dialog ───────────────────────────────────────────
  const [packageDialog, setPackageDialog] = useState(false);
  const [packagePatientId, setPackagePatientId] = useState("");
  const [procedures, setProcedures] = useState<Array<{ id: string; name: string }>>([]);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

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
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("appointments")
          .select("patient_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .not("patient_id", "is", null);
        if (!cancelled) setMyPatientIds(new Set((data || []).map((r: { patient_id: string }) => r.patient_id)));
      } catch (err) {
        if (!cancelled) logger.error("Error fetching my patients:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.tenant_id, profile?.id, isAdmin]);

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
    } catch (err) {
      logger.error("[Pacientes] createPackage error", err);
      toast.error("Erro ao criar pacote");
    } finally {
      setIsSavingPackage(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  const renderAddPatientButton = () => {
    if (!canAddPatient) {
      return (
        <Link to="/assinatura">
          <Button variant="outline" className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <Lock className="h-4 w-4" />Limite Atingido<Sparkles className="h-4 w-4" />
          </Button>
        </Link>
      );
    }
    return (
      <Button variant="gradient" onClick={() => navigate("/pacientes/novo")} data-tour="patients-new">
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
            <Button variant={patientFilter === "all" ? "gradient" : "ghost"} size="sm" onClick={() => setPatientFilter("all")} data-tour="patients-filter-all">
              Todos
            </Button>
            <Button variant={patientFilter === "mine" ? "gradient" : "ghost"} size="sm" onClick={() => setPatientFilter("mine")} data-tour="patients-filter-mine">
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
        onEdit={(p) => navigate(`/pacientes/${p.id}/editar`)}
        onNewPatient={() => navigate("/pacientes/novo")}
        onOpenPackage={openPackageDialog}
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
