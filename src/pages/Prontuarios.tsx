import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { api } from "@/integrations/gcp/client";
import { useClinicalAudit } from "@/hooks/useClinicalAudit";
import {
  ClipboardList, Plus, Search, User, Calendar,
  FileText, AlertCircle, Pill, Heart, Activity, Thermometer, Wind,
  ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle2, Stethoscope,
  Download, ShieldCheck, Pencil, Lock, History, Upload, FileJson,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { ProntuarioForm, type EditableRecord } from "@/components/prontuario/ProntuarioForm";
import type { TriageData } from "@/components/prontuario/TriageContextCard";
import type { TemplateField } from "@/components/prontuario/DynamicFieldsRenderer";
import { PRONTUARIO_TEMPLATES, type BuiltInProntuarioTemplate } from "@/lib/prontuario-templates";
import { generateMedicalRecordPdf } from "@/utils/patientDocumentPdf";
import { VitalSignsChart } from "@/components/prontuario/VitalSignsChart";
import {
  buildFHIRPatient, buildFHIREncounter, buildFHIRObservation, buildFHIRCondition,
  buildFHIRBundle, downloadFHIRBundle, parseFHIRBundle,
  VITAL_SIGNS_LOINC, type PatientData, type FHIRImportResult,
} from "@/lib/fhir";

interface PatientOption { id: string; name: string; phone?: string; email?: string; }
interface Template { id: string; name: string; specialty_id: string | null; fields: TemplateField[]; is_default: boolean; }

interface MedicalRecord {
  id: string; patient_id: string; client_name: string; appointment_date: string;
  professional_name: string; chief_complaint: string; anamnesis: string;
  physical_exam: string; diagnosis: string; cid_code: string;
  treatment_plan: string; prescriptions: string; notes: string; created_at: string;
  blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null;
  heart_rate: number | null; respiratory_rate: number | null;
  temperature: number | null; oxygen_saturation: number | null;
  weight_kg: number | null; height_cm: number | null; pain_scale: number | null;
  allergies: string; current_medications: string; medical_history: string;
  digital_hash: string | null; signed_at: string | null;
  signed_by_name: string | null; signed_by_crm: string | null; signed_by_uf: string | null;
  is_locked: boolean; lock_reason: string | null;
  appointment_id: string | null; triage_id: string | null;
  template_id: string | null; custom_fields: Record<string, unknown>;
  attendance_number: number | null; attendance_type: string | null;
  server_timestamp: string | null;
  return_days: number | null; return_reason: string | null;
}

interface RecordVersion {
  id: string;
  version_number: number;
  changed_by_name: string;
  changed_at: string;
  change_reason: string | null;
  digital_hash: string | null;
}

interface PendingTriage {
  id: string; patient_id: string; client_name: string; priority: string;
  chief_complaint: string; triaged_at: string; appointment_id: string | null;
  raw: TriageData;
}

const priorityConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  emergencia: { label: "Emergência", color: "bg-red-500/20 text-red-600 border-red-500/30", icon: AlertTriangle },
  urgente: { label: "Urgente", color: "bg-orange-500/20 text-orange-600 border-orange-500/30", icon: AlertTriangle },
  pouco_urgente: { label: "Pouco Urgente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30", icon: Clock },
  nao_urgente: { label: "Não Urgente", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
};

const attendanceTypeLabels: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  urgencia: "Urgência",
  emergencia: "Emergência",
  procedimento: "Procedimento",
  exame: "Exame",
  teleconsulta: "Teleconsulta",
  domiciliar: "Domiciliar",
  preventivo: "Preventivo",
  pre_operatorio: "Pré-operatório",
  pos_operatorio: "Pós-operatório",
  outro: "Outro",
};

function VitalsDisplay({ record }: { record: MedicalRecord }) {
  const hasVitals = record.blood_pressure_systolic != null || record.heart_rate != null
    || record.temperature != null || record.oxygen_saturation != null
    || record.respiratory_rate != null || record.weight_kg != null;

  const imc = record.weight_kg && record.height_cm
    ? (record.weight_kg / ((record.height_cm / 100) ** 2)).toFixed(1) : null;

  if (!hasVitals && !record.allergies && !record.current_medications && !record.medical_history) {
    return <p className="text-sm text-muted-foreground">Nenhum sinal vital registrado.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {record.blood_pressure_systolic != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <Heart className="h-3 w-3 text-red-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">PA</p>
            <p className="text-xs font-semibold">{record.blood_pressure_systolic}/{record.blood_pressure_diastolic}</p>
          </div>
        )}
        {record.heart_rate != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <Activity className="h-3 w-3 text-pink-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">FC</p>
            <p className="text-xs font-semibold">{record.heart_rate} bpm</p>
          </div>
        )}
        {record.temperature != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <Thermometer className="h-3 w-3 text-orange-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Temp</p>
            <p className="text-xs font-semibold">{record.temperature}°C</p>
          </div>
        )}
        {record.oxygen_saturation != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <Wind className="h-3 w-3 text-blue-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">SpO₂</p>
            <p className="text-xs font-semibold">{record.oxygen_saturation}%</p>
          </div>
        )}
        {record.respiratory_rate != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <Wind className="h-3 w-3 text-teal-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">FR</p>
            <p className="text-xs font-semibold">{record.respiratory_rate} irpm</p>
          </div>
        )}
        {record.weight_kg != null && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Peso</p>
            <p className="text-xs font-semibold">{record.weight_kg} kg</p>
          </div>
        )}
        {imc && (
          <div className="rounded-lg border bg-muted/30 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">IMC</p>
            <p className="text-xs font-semibold">{imc}</p>
          </div>
        )}
      </div>
      {record.pain_scale != null && (
        <div className="text-xs text-muted-foreground">Escala de dor: <span className="font-medium text-foreground">{record.pain_scale}/10</span></div>
      )}
      {(record.allergies || record.current_medications || record.medical_history) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {record.allergies && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5">
              <p className="font-medium text-destructive mb-0.5">Alergias</p>
              <p className="text-muted-foreground">{record.allergies}</p>
            </div>
          )}
          {record.current_medications && (
            <div className="rounded-lg border px-2 py-1.5">
              <p className="font-medium mb-0.5">Medicamentos em Uso</p>
              <p className="text-muted-foreground">{record.current_medications}</p>
            </div>
          )}
          {record.medical_history && (
            <div className="rounded-lg border px-2 py-1.5">
              <p className="font-medium mb-0.5">Histórico Médico</p>
              <p className="text-muted-foreground">{record.medical_history}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Prontuarios() {
  const { profile, isAdmin, tenant } = useAuth();
  const { professionalType } = usePermissions();
  const { logAccess } = useClinicalAudit();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pendingTriages, setPendingTriages] = useState<PendingTriage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedPatientId, setSelectedPatientId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Panel state: null = list view, object = form open
  const [formState, setFormState] = useState<{
    patientId?: string; appointmentId?: string; triage?: TriageData | null;
    builtInFields?: TemplateField[];
    editRecord?: EditableRecord | null;
  } | null>(null);

  // Selector modal
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorContext, setSelectorContext] = useState<{
    patientId?: string; appointmentId?: string; triage?: TriageData | null;
  } | null>(null);

  // Version history
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsRecordId, setVersionsRecordId] = useState<string | null>(null);

  const [fhirImportOpen, setFhirImportOpen] = useState(false);
  const [fhirImportJson, setFhirImportJson] = useState("");
  const [fhirImportResult, setFhirImportResult] = useState<FHIRImportResult | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPatients();
      fetchRecords();
      fetchTemplates();
      fetchPendingTriages();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && profile?.tenant_id) {
      const patientId = searchParams.get("patient_id") || undefined;
      const appointmentId = searchParams.get("appointment_id") || undefined;
      const triageId = searchParams.get("triage_id") || undefined;
      setSearchParams({}, { replace: true });

      if (triageId) {
        // Buscar dados da triagem e abrir form com eles pré-preenchidos
        api.from("triage_records").select("*").eq("id", triageId).single().then(({ data: tr }) => {
          if (tr) {
            const triageData: TriageData = {
              id: tr.id,
              priority: tr.priority,
              triaged_at: tr.triaged_at,
              performed_by: "",
              blood_pressure_systolic: tr.blood_pressure_systolic,
              blood_pressure_diastolic: tr.blood_pressure_diastolic,
              heart_rate: tr.heart_rate,
              respiratory_rate: tr.respiratory_rate,
              temperature: tr.temperature,
              oxygen_saturation: tr.oxygen_saturation,
              weight_kg: tr.weight_kg,
              height_cm: tr.height_cm,
              chief_complaint: tr.chief_complaint,
              pain_scale: tr.pain_scale,
              allergies: tr.allergies,
              current_medications: tr.current_medications,
              medical_history: tr.medical_history,
              notes: tr.notes,
            };
            setSelectorContext({ patientId, appointmentId, triage: triageData });
          } else {
            setSelectorContext({ patientId, appointmentId, triage: null });
          }
          setSelectorOpen(true);
        });
      } else {
        setSelectorContext({ patientId, appointmentId, triage: null });
        setSelectorOpen(true);
      }
    }
  }, [searchParams, profile?.tenant_id]);

  const fetchPatients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api.from("patients")
        .select("id, name, phone, email").eq("tenant_id", profile.tenant_id).order("name");
      if (error) throw error;
      setPatients((data as PatientOption[]) || []);
    } catch (err) { logger.error("Fetch patients:", err); }
  };

  const fetchRecords = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api.from("medical_records")
        .select("*, patient:patients(name), profiles(full_name)")
        .eq("tenant_id", profile.tenant_id).order("created_at", { ascending: false });
      if (error) throw error;
      setRecords((data || []).map((r: any) => ({
        id: r.id, patient_id: r.patient_id, client_name: r.patient?.name ?? "—",
        appointment_date: r.created_at, professional_name: r.profiles?.full_name ?? "—",
        chief_complaint: r.subjective ?? "", anamnesis: r.subjective ?? "",
        physical_exam: r.objective ?? "", diagnosis: r.assessment ?? "",
        cid_code: Array.isArray(r.cid_codes) ? r.cid_codes.join(", ") : "", treatment_plan: r.plan ?? "",
        prescriptions: "", notes: r.notes ?? "", created_at: r.created_at,
        blood_pressure_systolic: r.blood_pressure_systolic,
        blood_pressure_diastolic: r.blood_pressure_diastolic,
        heart_rate: r.heart_rate, respiratory_rate: r.respiratory_rate,
        temperature: r.temperature, oxygen_saturation: r.oxygen_saturation,
        weight_kg: r.weight_kg, height_cm: r.height_cm, pain_scale: r.pain_scale,
        allergies: r.allergies ?? "", current_medications: r.current_medications ?? "",
        medical_history: r.medical_history ?? "",
        digital_hash: r.digital_hash ?? null, signed_at: r.signed_at ?? null,
        signed_by_name: r.signed_by_name ?? null, signed_by_crm: r.signed_by_crm ?? null,
        signed_by_uf: r.signed_by_uf ?? null,
        is_locked: r.is_locked ?? false, lock_reason: r.lock_reason ?? null,
        appointment_id: r.appointment_id ?? null, triage_id: r.triage_id ?? null,
        template_id: r.template_id ?? null, custom_fields: r.custom_fields ?? {},
        attendance_number: r.attendance_number ?? null, attendance_type: r.attendance_type ?? null,
        server_timestamp: r.server_timestamp ?? null,
      })));
    } catch (err) { logger.error("Fetch records:", err); }
    finally { setIsLoading(false); }
  };

  const fetchTemplates = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api.from("record_field_templates")
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
      const { data, error } = await api.from("triage_records")
        .select("*, patient:patients(name)")
        .eq("tenant_id", profile.tenant_id).eq("status", "pendente")
        .gte("triaged_at", `${today}T00:00:00`)
        .order("triaged_at", { ascending: true });
      if (error) throw error;
      setPendingTriages((data || []).map((r: any) => ({
        id: r.id, patient_id: r.patient_id, client_name: r.patient?.name ?? "—",
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
    setSelectorContext({ patientId: t.patient_id, appointmentId: t.appointment_id ?? undefined, triage: t.raw });
    setSelectorOpen(true);
  };

  const openNewProntuario = () => {
    setSelectorContext({});
    setSelectorOpen(true);
  };

  const handleSelectTemplate = (tmpl: BuiltInProntuarioTemplate) => {
    setSelectorOpen(false);
    setFormState({
      ...selectorContext,
      builtInFields: tmpl.fields.length > 0 ? tmpl.fields : undefined,
    });
    setSelectorContext(null);
  };

  const onFormSaved = () => {
    setFormState(null);
    fetchRecords();
    fetchPendingTriages();
  };

  const openEditRecord = (record: MedicalRecord) => {
    const editableRecord: EditableRecord = {
      id: record.id,
      patient_id: record.patient_id,
      appointment_id: record.appointment_id,
      triage_id: record.triage_id,
      template_id: record.template_id,
      attendance_type: record.attendance_type,
      chief_complaint: record.chief_complaint,
      anamnesis: record.anamnesis,
      physical_exam: record.physical_exam,
      diagnosis: record.diagnosis,
      cid_code: record.cid_code,
      treatment_plan: record.treatment_plan,
      prescriptions: record.prescriptions,
      notes: record.notes,
      blood_pressure_systolic: record.blood_pressure_systolic,
      blood_pressure_diastolic: record.blood_pressure_diastolic,
      heart_rate: record.heart_rate,
      respiratory_rate: record.respiratory_rate,
      temperature: record.temperature,
      oxygen_saturation: record.oxygen_saturation,
      weight_kg: record.weight_kg,
      height_cm: record.height_cm,
      pain_scale: record.pain_scale,
      allergies: record.allergies,
      current_medications: record.current_medications,
      medical_history: record.medical_history,
      digital_hash: record.digital_hash,
      signed_at: record.signed_at,
      signed_by_name: record.signed_by_name,
      signed_by_crm: record.signed_by_crm,
      is_locked: record.is_locked,
      lock_reason: record.lock_reason,
      created_at: record.created_at,
      custom_fields: record.custom_fields,
      return_days: record.return_days,
      return_reason: record.return_reason,
    };
    setFormState({ patientId: record.patient_id, editRecord: editableRecord });
  };

  const isRecordEditable = (record: MedicalRecord) => {
    if (record.is_locked) return false;
    const ageMs = Date.now() - new Date(record.created_at).getTime();
    return ageMs <= 24 * 60 * 60 * 1000;
  };

  const fetchVersions = async (recordId: string) => {
    setVersionsRecordId(recordId);
    setVersionsLoading(true);
    setVersionsOpen(true);
    try {
      const { data, error } = await api
        .from("medical_record_versions")
        .select("id, version_number, changed_by, changed_at, change_reason, digital_hash, profiles(full_name)")
        .eq("record_id", recordId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      setVersions((data || []).map((v: any) => ({
        id: v.id,
        version_number: v.version_number,
        changed_by_name: v.profiles?.full_name ?? "—",
        changed_at: v.changed_at,
        change_reason: v.change_reason,
        digital_hash: v.digital_hash,
      })));
    } catch (err) {
      logger.error("Fetch versions:", err);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleExportFHIR = async () => {
    if (selectedPatientId === "all") {
      toast.error("Filtre por um paciente para exportar FHIR");
      return;
    }
    const patient = patients.find(c => c.id === selectedPatientId);
    if (!patient) return;

    try {
      // Exportação completa via Edge Function (inclui prescrições, atestados, exames, etc.)
      const { data: { session } } = await api.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const resp = await api.functions.invoke("export-patient-fhir", {
        body: { patient_id: selectedPatientId },
      });

      if (resp.error) throw resp.error;
      const bundle = resp.data;

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fhir-${patient.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Bundle FHIR exportado: ${bundle.total ?? bundle.entry?.length ?? 0} recursos`);
    } catch (err) {
      logger.error("FHIR export via Edge Function falhou, usando fallback local", err);
      // Fallback: exportação cliente-side com dados já carregados
      const patientData: PatientData = {
        id: patient.id, name: patient.name, phone: patient.phone, email: patient.email,
      };
      const resources = [buildFHIRPatient(patientData)];

      for (const rec of patientRecords) {
        resources.push(buildFHIREncounter({
          id: rec.id, patientId: patient.id, date: rec.appointment_date,
          status: "finished", type: rec.chief_complaint,
          professionalName: rec.professional_name,
          clinicName: tenant?.name,
        }));
        const vitalMap: Record<string, number | null> = {
          blood_pressure_systolic: rec.blood_pressure_systolic,
          blood_pressure_diastolic: rec.blood_pressure_diastolic,
          heart_rate: rec.heart_rate, temperature: rec.temperature,
          oxygen_saturation: rec.oxygen_saturation, respiratory_rate: rec.respiratory_rate,
          weight: rec.weight_kg, height: rec.height_cm,
        };
        for (const [key, val] of Object.entries(vitalMap)) {
          if (val != null && VITAL_SIGNS_LOINC[key]) {
            const loinc = VITAL_SIGNS_LOINC[key];
            resources.push(buildFHIRObservation({
              id: crypto.randomUUID(), patientId: patient.id, encounterId: rec.id,
              date: rec.appointment_date, code: loinc.code, display: loinc.display,
              value: val, unit: loinc.unit,
            }));
          }
        }
        if (rec.cid_code && rec.diagnosis) {
          resources.push(buildFHIRCondition({
            id: crypto.randomUUID(), patientId: patient.id, encounterId: rec.id,
            code: rec.cid_code, display: rec.diagnosis, clinicalStatus: "active",
            onsetDate: rec.appointment_date,
          }));
        }
      }

      const bundle = buildFHIRBundle(resources);
      downloadFHIRBundle(bundle, `fhir-${patient.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.json`);
      toast.success(`Bundle FHIR exportado (local): ${resources.length} recursos`);
    }
  };

  const handleFhirImportParse = () => {
    try {
      const result = parseFHIRBundle(fhirImportJson);
      setFhirImportResult(result);
      if (result.totalParsed === 0) toast.error("Nenhum recurso FHIR encontrado no JSON");
      else toast.success(`${result.totalParsed} recursos encontrados`);
    } catch (err) {
      toast.error("JSON inválido — verifique o formato");
      logger.error("FHIR parse error:", err);
    }
  };

  const handleFhirFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFhirImportJson(reader.result as string);
      try {
        const result = parseFHIRBundle(reader.result as string);
        setFhirImportResult(result);
        toast.success(`${result.totalParsed} recursos encontrados no arquivo`);
      } catch {
        toast.error("Erro ao processar o arquivo FHIR");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filteredRecords = records.filter((r) =>
    r.client_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    r.diagnosis.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    r.cid_code.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const patientRecords = selectedPatientId !== "all"
    ? filteredRecords.filter((r) => r.patient_id === selectedPatientId) : filteredRecords;

  // ── FORM VIEW ──
  if (formState) {
    return (
      <MainLayout title={formState.editRecord ? "Editar Prontuário" : "Novo Prontuário"} subtitle="Registro clínico do atendimento">
        <div className="max-w-4xl mx-auto">
          <ProntuarioForm
            tenantId={profile!.tenant_id}
            professionalId={profile!.id}
            professionalName={profile!.full_name || undefined}
            professionalCrm={(profile as any)?.crm || undefined}
            patients={patients}
            templates={templates}
            initialPatientId={formState.patientId}
            initialAppointmentId={formState.appointmentId}
            initialTriage={formState.triage}
            builtInFields={formState.builtInFields}
            editRecord={formState.editRecord}
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFhirImportOpen(true)} title="Importar Bundle FHIR">
            <Upload className="mr-2 h-4 w-4" />Importar FHIR
          </Button>
          {selectedPatientId !== "all" && (
            <Button variant="outline" size="sm" onClick={handleExportFHIR} title="Exportar paciente e prontuários como FHIR Bundle">
              <FileJson className="mr-2 h-4 w-4" />Exportar FHIR
            </Button>
          )}
          <Button variant="gradient" onClick={openNewProntuario}>
            <Plus className="mr-2 h-4 w-4" /> Novo Prontuário
          </Button>
        </div>
      }
    >
      {/* Busca + Filtro */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente, diagnóstico ou CID..." className="pl-10" />
        </div>
        <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Filtrar por paciente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pacientes</SelectItem>
            {patients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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

      {/* Gráfico de Sinais Vitais (quando paciente filtrado) */}
      {selectedPatientId !== "all" && patientRecords.length >= 2 && (
        <VitalSignsChart
          records={patientRecords.map((r) => ({
            record_date: r.appointment_date,
            blood_pressure_systolic: r.blood_pressure_systolic,
            blood_pressure_diastolic: r.blood_pressure_diastolic,
            heart_rate: r.heart_rate,
            temperature: r.temperature,
            oxygen_saturation: r.oxygen_saturation,
            weight_kg: r.weight_kg,
            respiratory_rate: r.respiratory_rate,
          }))}
          className="mb-6"
        />
      )}

      {/* Lista de Prontuários */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : patientRecords.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum prontuário encontrado"
          description="Crie o primeiro prontuário clínico ou atenda uma triagem pendente."
          action={
            <Button variant="gradient" onClick={openNewProntuario}>
              <Plus className="mr-2 h-4 w-4" /> Novo Prontuário
            </Button>
          } />
      ) : (
        <div className="space-y-3">
          {patientRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/prontuarios/${record.id}`)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {record.client_name}
                        {record.attendance_number && (
                          <span className="text-xs font-mono text-muted-foreground">
                            #{record.attendance_number.toString().padStart(6, '0')}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(record.appointment_date).toLocaleDateString("pt-BR")}
                        <span>·</span>
                        {record.professional_name}
                        {record.signed_by_crm && (
                          <span className="text-xs">
                            ({record.signed_by_crm}{record.signed_by_uf ? `/${record.signed_by_uf}` : ''})
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {record.attendance_type && (
                      <Badge variant="secondary" className="text-xs">
                        {attendanceTypeLabels[record.attendance_type] || record.attendance_type}
                      </Badge>
                    )}
                    {record.cid_code && (
                      <Badge variant="outline" className="text-xs font-mono">CID: {record.cid_code}</Badge>
                    )}
                    {record.is_locked && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 gap-1">
                        <Lock className="h-3 w-3" />Bloqueado
                      </Badge>
                    )}
                    {record.signed_at ? (
                      <Badge variant="outline" className="text-xs text-success border-success/30 gap-1">
                        <ShieldCheck className="h-3 w-3" />Assinado
                      </Badge>
                    ) : record.digital_hash ? (
                      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                        Integridade verificável
                      </Badge>
                    ) : null}
                    <Button variant="outline" size="sm" title="Editar prontuário"
                      onClick={(e) => { e.stopPropagation(); openEditRecord(record); }}>
                      {isRecordEditable(record) ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="outline" size="sm" title="Histórico de versões"
                      onClick={(e) => { e.stopPropagation(); fetchVersions(record.id); }}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" title="Baixar PDF"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateMedicalRecordPdf({
                          client_name: record.client_name,
                          record_date: record.appointment_date,
                          professional_name: record.professional_name,
                          clinic_name: tenant?.name || "Clínica",
                          chief_complaint: record.chief_complaint,
                          anamnesis: record.anamnesis,
                          physical_exam: record.physical_exam,
                          diagnosis: record.diagnosis,
                          cid_code: record.cid_code,
                          treatment_plan: record.treatment_plan,
                          prescriptions: record.prescriptions,
                          notes: record.notes,
                          blood_pressure_systolic: record.blood_pressure_systolic,
                          blood_pressure_diastolic: record.blood_pressure_diastolic,
                          heart_rate: record.heart_rate,
                          respiratory_rate: record.respiratory_rate,
                          temperature: record.temperature,
                          oxygen_saturation: record.oxygen_saturation,
                          weight_kg: record.weight_kg,
                          height_cm: record.height_cm,
                          pain_scale: record.pain_scale,
                          allergies: record.allergies,
                          current_medications: record.current_medications,
                          medical_history: record.medical_history,
                          digital_hash: record.digital_hash,
                          signed_at: record.signed_at,
                          signed_by_name: record.signed_by_name,
                          signed_by_crm: record.signed_by_crm,
                        });
                      }}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => {
                        const next = expandedRecord === record.id ? null : record.id;
                        if (next) logAccess("medical_records", record.id, record.patient_id);
                        setExpandedRecord(next);
                      }}>
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
                  <Tabs defaultValue="vitais" className="mt-4">
                    <TabsList className="flex w-full overflow-x-auto scrollbar-hide h-auto gap-1 p-1">
                      <TabsTrigger value="vitais" className="text-xs py-2 shrink-0"><Activity className="h-3 w-3 mr-1" />Vitais</TabsTrigger>
                      <TabsTrigger value="anamnese" className="text-xs py-2 shrink-0"><FileText className="h-3 w-3 mr-1" />Anamnese</TabsTrigger>
                      <TabsTrigger value="exame" className="text-xs py-2 shrink-0"><Heart className="h-3 w-3 mr-1" />Exame</TabsTrigger>
                      <TabsTrigger value="diagnostico" className="text-xs py-2 shrink-0"><AlertCircle className="h-3 w-3 mr-1" />Diagnóstico</TabsTrigger>
                      <TabsTrigger value="prescricao" className="text-xs py-2 shrink-0"><Pill className="h-3 w-3 mr-1" />Prescrição</TabsTrigger>
                    </TabsList>
                    <TabsContent value="vitais" className="mt-3">
                      <VitalsDisplay record={record} />
                    </TabsContent>
                    <TabsContent value="anamnese" className="mt-3 text-sm">
                      <p className="text-muted-foreground whitespace-pre-line">{record.anamnesis || "—"}</p>
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

      {/* Modal Seletor de Tipo de Prontuário */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Que tipo de prontuário você precisa?
            </DialogTitle>
            <DialogDescription>
              Selecione a especialidade para abrir o prontuário com os campos específicos pré-configurados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {PRONTUARIO_TEMPLATES
              .filter((tmpl) => !tmpl.targetTypes?.length || isAdmin || tmpl.targetTypes.includes(professionalType))
              .map((tmpl) => (
              <Card
                key={tmpl.key}
                className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => handleSelectTemplate(tmpl)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5 ${tmpl.color}`}>
                      <tmpl.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{tmpl.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tmpl.description}</p>
                      {tmpl.fields.length > 0 && (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {tmpl.fields.length} campos específicos
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Histórico de Versões */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Versões
            </DialogTitle>
            <DialogDescription>
              Cada edição gera uma nova versão com registro do profissional e motivo.
            </DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma versão anterior encontrada.
              <p className="text-xs mt-1">Versões são criadas automaticamente quando o prontuário é editado.</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {versions.map((v) => (
                <div key={v.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">Versão {v.version_number}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.changed_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{v.changed_by_name}</span>
                  </p>
                  {v.change_reason && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Motivo:</span> {v.change_reason}
                    </p>
                  )}
                  {v.digital_hash && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate" title={v.digital_hash}>
                      SHA-256: {v.digital_hash}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Importar FHIR */}
      <Dialog open={fhirImportOpen} onOpenChange={(open) => { setFhirImportOpen(open); if (!open) { setFhirImportJson(""); setFhirImportResult(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Importar Bundle FHIR
            </DialogTitle>
            <DialogDescription>
              Cole um JSON FHIR R4 ou faça upload de um arquivo .json para visualizar os dados contidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => document.getElementById("fhir-file-input")?.click()}>
                <Upload className="mr-2 h-4 w-4" />Upload arquivo
              </Button>
              <input id="fhir-file-input" type="file" accept=".json,application/json,application/fhir+json" className="hidden" onChange={handleFhirFileUpload} />
              {fhirImportJson && !fhirImportResult && (
                <Button size="sm" onClick={handleFhirImportParse}>Analisar JSON</Button>
              )}
            </div>
            <textarea
              value={fhirImportJson}
              onChange={(e) => { setFhirImportJson(e.target.value); setFhirImportResult(null); }}
              placeholder='{"resourceType": "Bundle", "type": "collection", "entry": [...]}'
              rows={6}
              className="w-full rounded-md border bg-muted/30 p-3 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {fhirImportResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{fhirImportResult.totalParsed} recursos</Badge>
                  {fhirImportResult.patients.length > 0 && <Badge variant="outline">{fhirImportResult.patients.length} Pacientes</Badge>}
                  {fhirImportResult.encounters.length > 0 && <Badge variant="outline">{fhirImportResult.encounters.length} Encontros</Badge>}
                  {fhirImportResult.observations.length > 0 && <Badge variant="outline">{fhirImportResult.observations.length} Observações</Badge>}
                  {fhirImportResult.conditions.length > 0 && <Badge variant="outline">{fhirImportResult.conditions.length} Condições</Badge>}
                  {fhirImportResult.unknownResources.length > 0 && <Badge variant="outline" className="text-amber-600">{fhirImportResult.unknownResources.length} Não reconhecidos</Badge>}
                </div>
                {fhirImportResult.patients.map((p, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm space-y-1">
                    <p className="font-medium">{p.name}</p>
                    {p.cpf && <p className="text-xs text-muted-foreground">CPF: {p.cpf}</p>}
                    {p.birthDate && <p className="text-xs text-muted-foreground">Nascimento: {p.birthDate}</p>}
                    {p.phone && <p className="text-xs text-muted-foreground">Tel: {p.phone}</p>}
                  </div>
                ))}
                {fhirImportResult.conditions.map((c, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{c.display}</p>
                    <p className="text-xs text-muted-foreground">CID: {c.code} · Status: {c.clinicalStatus}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">A importação FHIR é somente para visualização. Para incorporar ao sistema, use os dados acima como referência ao criar prontuários.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
