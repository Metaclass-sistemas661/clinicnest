import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { createPatientPackageV1, getPatientTimelineV1, revertPackageConsumptionForAppointmentV1, upsertPatientV2 } from "@/lib/supabase-typed-rpc";
import { Users, Plus, Loader2, Phone, Mail, Search, Pencil, Stethoscope, Package, DollarSign, Info, Clock, Copy, Check, KeyRound, MapPin, ShieldCheck, FileSignature, ClipboardList, Pill, FlaskConical, ArrowRightLeft, FileText, AlertTriangle, NotebookPen, ExternalLink, Lock, Sparkles, MessageCircle } from "lucide-react";
import { PatientConsentsViewer } from "@/components/consent/PatientConsentsViewer";
import { GenerateContractsDialog } from "@/components/consent/GenerateContractsDialog";
import { SendConsentLinkDialog } from "@/components/consent/SendConsentLinkDialog";
import { EVOLUTION_TYPE_LABELS, EVOLUTION_TYPE_COLORS } from "@/lib/soap-templates";
import type { ClinicalEvolution } from "@/types/database";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import { z } from "zod";
import type { Patient } from "@/types/database";
import { fetchPatientSpendingAllTime, type PatientSpendingRow } from "@/lib/patientSpending";
import type { PatientTimelineEventRow } from "@/types/supabase-extensions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { UsageIndicator } from "@/components/subscription/LimitGate";
import { Link } from "react-router-dom";

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const MARITAL_STATUS_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

const patientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  phone: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
  cpf: z.string().optional(),
  date_of_birth: z.string().optional(),
  marital_status: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  street_number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});

const packageFormSchema = z.object({
  procedure_id: z.string().min(1, "Selecione um serviço"),
  total_sessions: z.coerce.number().int().min(1, "Mínimo 1 sessão").max(100, "Máximo 100 sessões"),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
});

export default function Pacientes() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { isWithinLimit, getLimit, getLimitMessage } = usePlanFeatures();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSpending, setPatientSpending] = useState<PatientSpendingRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTimeline, setDetailTimeline] = useState<PatientTimelineEventRow[]>([]);
  const [detailPackages, setDetailPackages] = useState<
    Array<{
      id: string;
      procedure_id: string;
      service_name: string;
      total_sessions: number;
      remaining_sessions: number;
      status: string;
      purchased_at: string;
      expires_at: string | null;
    }>
  >([]);
  const [isDetailLoadingExtras, setIsDetailLoadingExtras] = useState(false);
  const [myPatientIds, setMyPatientIds] = useState<Set<string>>(new Set());
  const [patientFilter, setPatientFilter] = useState<"all" | "mine">("all");

  // Package creation
  const [packageDialog, setPackageDialog] = useState(false);
  const [packagePatientId, setPackagePatientId] = useState<string>("");
  const [procedures, setProcedures] = useState<Array<{ id: string; name: string }>>([]);
  const [packageForm, setPackageForm] = useState({ procedure_id: "", total_sessions: "5", expires_at: "", notes: "" });
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Access code dialog
  const [accessCodeDialog, setAccessCodeDialog] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  const [contractsPatient, setContractsPatient] = useState<Patient | null>(null);
  const [sendLinkPatient, setSendLinkPatient] = useState<Patient | null>(null);

  const [clinicalHistory, setClinicalHistory] = useState<Array<{
    id: string; type: string; title: string; subtitle: string; date: string;
  }>>([]);
  const [patientEvolutions, setPatientEvolutions] = useState<ClinicalEvolution[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
    date_of_birth: "",
    marital_status: "",
    zip_code: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    notes: "",
  });
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPatients();
      fetchProcedures();
      if (isAdmin) {
        fetchPatientSpending();
      }
    }
  }, [profile?.tenant_id, isAdmin]);

  // Staff: buscar IDs de pacientes que o profissional já atendeu
  useEffect(() => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return;
    const fetchMyPatientIds = async () => {
      try {
        const { data } = await supabase
          .from("appointments")
          .select("patient_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .not("patient_id", "is", null);
        const ids = new Set((data || []).map((r: { patient_id: string }) => r.patient_id));
        setMyPatientIds(ids);
      } catch (err) {
        logger.error("Error fetching my patients:", err);
      }
    };

    fetchMyPatientIds();
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  useEffect(() => {
    const loadExtras = async (patientId: string) => {
      if (!profile?.tenant_id) return;

      setIsDetailLoadingExtras(true);
      try {
        const [{ data: timelineData, error: timelineError }, packagesRes] = await Promise.all([
          getPatientTimelineV1({ p_patient_id: patientId, p_limit: 50 }),
          supabase
            .from("patient_packages")
            .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
            .eq("tenant_id", profile.tenant_id)
            .eq("patient_id", patientId)
            .order("purchased_at", { ascending: false }),
        ]);

        if (timelineError) {
          toastRpcError(toast, timelineError as any, "Erro ao carregar histórico");
        } else {
          setDetailTimeline((timelineData || []) as PatientTimelineEventRow[]);
        }

        if (packagesRes.error) {
          logger.error("Error loading patient packages:", packagesRes.error);
        } else {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }

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
          id: d.id, type: "prontuario",
          title: d.chief_complaint || "Prontuário",
          subtitle: [d.diagnosis, d.cid_code].filter(Boolean).join(" — "),
          date: d.record_date,
        }));
        (recRes.data || []).forEach((d: any) => clinDocs.push({
          id: d.id, type: "receita",
          title: d.prescription_type === "simples" ? "Receita Simples" : d.prescription_type === "especial_b" ? "Receita Especial B" : "Receita Especial A",
          subtitle: (d.medications || "").substring(0, 60),
          date: d.issued_at,
        }));
        (certRes.data || []).forEach((d: any) => clinDocs.push({
          id: d.id, type: "atestado",
          title: d.certificate_type === "atestado" ? "Atestado Médico" : d.certificate_type === "declaracao_comparecimento" ? "Declaração" : d.certificate_type === "laudo" ? "Laudo Médico" : "Relatório Médico",
          subtitle: (d.content || "").substring(0, 60),
          date: d.issued_at,
        }));
        (examRes.data || []).forEach((d: any) => clinDocs.push({
          id: d.id, type: "laudo",
          title: d.exam_name,
          subtitle: d.status,
          date: d.created_at,
        }));
        (refRes.data || []).forEach((d: any) => clinDocs.push({
          id: d.id, type: "encaminhamento",
          title: `Encaminhamento${d.specialties?.name ? ` — ${d.specialties.name}` : ""}`,
          subtitle: (d.reason || "").substring(0, 60),
          date: d.created_at,
        }));

        clinDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setClinicalHistory(clinDocs);

        const { data: evoData } = await (supabase as any).from("clinical_evolutions")
          .select("*, patient:patients(name), profiles(full_name)")
          .eq("tenant_id", profile.tenant_id).eq("patient_id", patientId)
          .order("evolution_date", { ascending: false }).limit(50);
        setPatientEvolutions((evoData ?? []) as ClinicalEvolution[]);
      } catch (err) {
        logger.error("Error loading patient extras:", err);
        toast.error("Erro ao carregar detalhes do paciente");
      } finally {
        setIsDetailLoadingExtras(false);
      }
    };

    if (isDetailOpen && detailPatient?.id) {
      loadExtras(detailPatient.id);
    } else {
      setDetailTimeline([]);
      setDetailPackages([]);
      setClinicalHistory([]);
      setPatientEvolutions([]);
      setIsDetailLoadingExtras(false);
    }
  }, [isDetailOpen, detailPatient?.id, profile?.tenant_id]);

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

  const handleRevertPackageConsumption = async (appointmentId: string) => {
    if (!isAdmin) return;
    const id = String(appointmentId || "").trim();
    if (!id) return;

    try {
      const { data, error } = await revertPackageConsumptionForAppointmentV1({
        p_appointment_id: id,
        p_reason: "Estorno manual via CRM",
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao estornar pacote");
        return;
      }
      if (!data?.success) {
        toast.error("Não foi possível estornar");
        return;
      }
      if (data.reverted) {
        toast.success("Sessão estornada com sucesso");
      } else {
        toast.message("Nenhum consumo para estornar");
      }

      // Refresh detail
      if (detailPatient?.id) {
        setIsDetailLoadingExtras(true);
        const [{ data: timelineData }, packagesRes] = await Promise.all([
          getPatientTimelineV1({ p_patient_id: detailPatient.id, p_limit: 50 }),
          supabase
            .from("patient_packages")
            .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
            .eq("tenant_id", profile?.tenant_id)
            .eq("patient_id", detailPatient.id)
            .order("purchased_at", { ascending: false }),
        ]);
        setDetailTimeline((timelineData || []) as PatientTimelineEventRow[]);
        if (!packagesRes.error) {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }
      }
    } catch (err) {
      logger.error("Error reverting package consumption:", err);
      toast.error("Erro ao estornar pacote");
    } finally {
      setIsDetailLoadingExtras(false);
    }
  };

  const handleCreatePackage = async () => {
    const parsed = packageFormSchema.safeParse(packageForm);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }
    setIsSavingPackage(true);
    try {
      const { error } = await createPatientPackageV1({
        p_patient_id: packagePatientId,
        p_service_id: parsed.data.procedure_id,
        p_total_sessions: parsed.data.total_sessions,
        p_expires_at: parsed.data.expires_at || null,
        p_notes: parsed.data.notes || null,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao criar pacote");
        return;
      }
      toast.success("Pacote criado com sucesso!");
      setPackageDialog(false);
      setPackageForm({ procedure_id: "", total_sessions: "5", expires_at: "", notes: "" });

      // Reload packages if detail is open for same client
      if (isDetailOpen && detailPatient?.id === packagePatientId && profile?.tenant_id) {
        const packagesRes = await supabase
          .from("patient_packages")
          .select("id, procedure_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, procedure:procedures(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("patient_id", packagePatientId)
          .order("purchased_at", { ascending: false });
        if (!packagesRes.error) {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            procedure_id: String(p.procedure_id),
            service_name: String(p?.procedure?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }
      }
    } catch (err) {
      logger.error("[Pacientes] createPackage error", err);
      toast.error("Erro ao criar pacote");
    } finally {
      setIsSavingPackage(false);
    }
  };

  const filteredPatients = useMemo(() => {
    let list = patients;
    if (!isAdmin && patientFilter === "mine") {
      list = list.filter((c) => myPatientIds.has(c.id));
    }
    if (!debouncedSearchQuery.trim()) return list;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return list.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        patient.phone?.includes(debouncedSearchQuery) ||
        patient.email?.toLowerCase().includes(q) ||
        patient.access_code?.toLowerCase().includes(q)
    );
  }, [patients, debouncedSearchQuery, isAdmin, patientFilter, myPatientIds]);

  const fetchPatientSpending = async () => {
    if (!profile?.tenant_id) return;
    try {
      const data = await fetchPatientSpendingAllTime(profile.tenant_id);
      setPatientSpending(data);
    } catch (err) {
      logger.error("Error fetching patient spending:", err);
      toast.error("Erro ao carregar consumo dos pacientes.");
    }
  };

  const getSpendingForPatient = (patientId: string): PatientSpendingRow | undefined =>
    patientSpending.find((s) => s.patient_id === patientId);

  const sortedAndFilteredPatients = useMemo(() => {
    if (!isAdmin || patientSpending.length === 0) return [...filteredPatients];
    return [...filteredPatients].sort((a, b) => {
      const sa = getSpendingForPatient(a.id)?.total_amount ?? 0;
      const sb = getSpendingForPatient(b.id)?.total_amount ?? 0;
      return sb - sa;
    });
  }, [filteredPatients, isAdmin, patientSpending]);

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

  const emptyFormData = { name: "", phone: "", email: "", cpf: "", date_of_birth: "", marital_status: "", zip_code: "", street: "", street_number: "", complement: "", neighborhood: "", city: "", state: "", allergies: "", notes: "" };

  const handleOpenDialog = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        name: patient.name,
        phone: patient.phone || "",
        email: patient.email || "",
        cpf: patient.cpf || "",
        date_of_birth: patient.date_of_birth || "",
        marital_status: patient.marital_status || "",
        zip_code: patient.zip_code || "",
        street: patient.street || "",
        street_number: patient.street_number || "",
        complement: patient.complement || "",
        neighborhood: patient.neighborhood || "",
        city: patient.city || "",
        state: patient.state || "",
        allergies: patient.allergies || "",
        notes: patient.notes || "",
      });
    } else {
      setEditingPatient(null);
      setFormData(emptyFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCepBlur = async () => {
    const digits = formData.zip_code.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      // silently ignore CEP lookup errors
    } finally {
      setIsFetchingCep(false);
    }
  };

  const openPackageDialog = (patientId: string) => {
    setPackagePatientId(patientId);
    setPackageForm({ procedure_id: "", total_sessions: "5", expires_at: "", notes: "" });
    setPackageDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const parsed = patientFormSchema.safeParse({
      name: formData.name.trim(),
      phone: formData.phone,
      email: formData.email || "",
      cpf: formData.cpf,
      date_of_birth: formData.date_of_birth,
      marital_status: formData.marital_status,
      zip_code: formData.zip_code,
      street: formData.street,
      street_number: formData.street_number,
      complement: formData.complement,
      neighborhood: formData.neighborhood,
      city: formData.city,
      state: formData.state,
      notes: formData.notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }

    setIsSaving(true);

    try {
      const { data: rpcResult, error } = await upsertPatientV2({
        p_patient_id: editingPatient?.id ?? null,
        p_name: parsed.data.name,
        p_phone: parsed.data.phone || null,
        p_email: parsed.data.email || null,
        p_notes: parsed.data.notes || null,
        p_cpf: parsed.data.cpf || null,
        p_date_of_birth: parsed.data.date_of_birth || null,
        p_marital_status: parsed.data.marital_status || null,
        p_zip_code: parsed.data.zip_code || null,
        p_street: parsed.data.street || null,
        p_street_number: parsed.data.street_number || null,
        p_complement: parsed.data.complement || null,
        p_neighborhood: parsed.data.neighborhood || null,
        p_city: parsed.data.city || null,
        p_state: parsed.data.state || null,
        p_allergies: parsed.data.allergies || null,
      });

      if (error) {
        toastRpcError(toast, error as any, editingPatient ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente");
        return;
      }

      const isNew = !editingPatient;
      setIsDialogOpen(false);
      setFormData(emptyFormData);
      setEditingPatient(null);
      fetchPatients();

      if (isNew && rpcResult?.access_code) {
        setNewAccessCode(rpcResult.access_code);
        setNewPatientName(parsed.data.name);
        setCodeCopied(false);
        setAccessCodeDialog(true);
      } else {
        toast.success(isNew ? "Paciente cadastrado com sucesso!" : "Paciente atualizado com sucesso!");
      }
    } catch (error) {
      toast.error(editingPatient ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  const canAddPatient = isWithinLimit('patients', patients.length);
  const patientLimit = getLimit('patients');

  const renderAddPatientButton = () => {
    if (!canAddPatient && !editingPatient) {
      return (
        <Link to="/assinatura">
          <Button variant="outline" className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <Lock className="h-4 w-4" />
            Limite Atingido
            <Sparkles className="h-4 w-4" />
          </Button>
        </Link>
      );
    }
    return (
      <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="patients-new">
        <Plus className="mr-2 h-4 w-4" />
        Novo Paciente
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              {renderAddPatientButton()}
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-full lg:max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">{editingPatient ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
                <DialogDescription>
                  {editingPatient ? "Atualize os dados do paciente" : "Preencha os dados para cadastrar um novo paciente na clínica"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-6 py-4">
                  {/* Dados Pessoais */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Dados Pessoais</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                      <Label>Nome <span className="text-destructive">*</span></Label>
                      <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" required />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Select value={formData.marital_status || undefined} onValueChange={(v) => setFormData({ ...formData, marital_status: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MARITAL_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <div className="relative">
                        <Input
                          value={formData.zip_code}
                          onChange={(e) => setFormData({ ...formData, zip_code: formatCep(e.target.value) })}
                          onBlur={handleCepBlur}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                      <Label>Logradouro</Label>
                      <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder="Rua, Avenida, Travessa..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input value={formData.street_number} onChange={(e) => setFormData({ ...formData, street_number: e.target.value })} placeholder="Nº" />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input value={formData.complement} onChange={(e) => setFormData({ ...formData, complement: e.target.value })} placeholder="Apto, Bloco, Sala..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input value={formData.neighborhood} onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Bairro" />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={formData.state || undefined} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Alergias */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-destructive border-b border-destructive/20 pb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alergias
                  </h3>
                  <Input
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="Ex: Penicilina, AAS, Dipirona, Látex..."
                    className="border-destructive/30 focus-visible:ring-destructive/30"
                  />
                </div>

                {/* Observações */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Observações</h3>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Observações clínicas, convênio..." rows={3} />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="patients-save">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingPatient ? "Atualizar Paciente" : "Cadastrar Paciente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      {/* Search + Staff filter */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
            aria-label="Buscar pacientes"
          />
        </div>
        {!isAdmin && (
          <div className="flex rounded-lg border border-border bg-card">
            <Button
              variant={patientFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={patientFilter === "all" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setPatientFilter("all")}
              data-tour="patients-filter-all"
            >
              Todos
            </Button>
            <Button
              variant={patientFilter === "mine" ? "default" : "ghost"}
              size="sm"
              className={patientFilter === "mine" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setPatientFilter("mine")}
              data-tour="patients-filter-mine"
            >
              Meus pacientes ({myPatientIds.size})
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? "Pacientes Cadastrados" : `Pacientes Cadastrados (${sortedAndFilteredPatients.length})`}
          </CardTitle>
          {isAdmin && patientSpending.length > 0 && (
            <CardDescription>Ordenado por consumo — pacientes que mais utilizam a clínica no topo</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
              description={searchQuery ? "Tente ajustar os termos da busca." : "Cadastre seu primeiro paciente para começar."}
              action={
                !searchQuery && (
                  <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="patients-new-empty">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Paciente
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="block md:hidden space-y-3">
                {sortedAndFilteredPatients.map((patient, index) => {
                  const spending = getSpendingForPatient(patient.id);
                  return (
                    <div key={patient.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAdmin && patientSpending.length > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                          )}
                          <p className="font-medium">{patient.name}</p>
                          {patient.allergies && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
                              <AlertTriangle className="h-3 w-3" />Alergia
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSendLinkPatient(patient)} aria-label={`Enviar link de assinatura para ${patient.name}`} title="Enviar Link WhatsApp">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setContractsPatient(patient)} aria-label={`Gerar contratos para ${patient.name}`} data-tour="patients-item-contracts">
                            <FileSignature className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => openPackageDialog(patient.id)} aria-label={`Vender pacote para ${patient.name}`} data-tour="patients-item-package">
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(patient)} aria-label={`Editar paciente ${patient.name}`} data-tour="patients-item-edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {patient.access_code && (
                        <div className="flex items-center gap-2 text-sm">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="outline" className="font-mono text-xs tracking-wider">{patient.access_code}</Badge>
                        </div>
                      )}
                      {patient.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />{patient.phone}
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" /><span className="truncate">{patient.email}</span>
                        </div>
                      )}
                      {isAdmin && spending && (spending.services_count > 0 || spending.products_count > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          <Badge variant="secondary" className="gap-1 text-xs"><DollarSign className="h-3 w-3" />{formatCurrency(spending.total_amount)}</Badge>
                          <Badge variant="outline" className="gap-1 text-xs">Ticket: {formatCurrency(spending.ticket_medio)}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => navigate(`/pacientes/${patient.id}`)}
                            data-tour="patients-item-details"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />Ver Ficha
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && patientSpending.length > 0 && <TableHead className="w-10">#</TableHead>}
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      {isAdmin && patientSpending.length > 0 && <TableHead>Consumo</TableHead>}
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredPatients.map((patient, index) => {
                      const spending = getSpendingForPatient(patient.id);
                      return (
                        <TableRow key={patient.id}>
                          {isAdmin && patientSpending.length > 0 && <TableCell className="font-bold text-primary">{index + 1}</TableCell>}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {patient.name}
                              {patient.allergies && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 shrink-0 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30" title={`Alergias: ${patient.allergies}`}>
                                  <AlertTriangle className="h-3 w-3" />Alergia
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {patient.access_code ? (
                              <Badge variant="outline" className="font-mono text-xs tracking-wider">{patient.access_code}</Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>{patient.phone ? <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-4 w-4" />{patient.phone}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>{patient.email ? <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" />{patient.email}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                          {isAdmin && patientSpending.length > 0 && (
                            <TableCell>
                              {spending ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="secondary" className="text-xs">{formatCurrency(spending.total_amount)}</Badge>
                                  <Badge variant="outline" className="text-xs">Ticket: {formatCurrency(spending.ticket_medio)}</Badge>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs px-1" onClick={() => navigate(`/pacientes/${patient.id}`)} aria-label={`Ver ficha de ${patient.name}`} data-tour="patients-item-details">
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                          )}
                          <TableCell className="max-w-xs truncate text-muted-foreground">{patient.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setSendLinkPatient(patient)} aria-label={`Enviar link de assinatura para ${patient.name}`} title="Enviar Link WhatsApp">
                                <MessageCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setContractsPatient(patient)} aria-label={`Gerar contratos para ${patient.name}`} data-tour="patients-item-contracts" title="Gerar Contrato e Termos">
                                <FileSignature className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => openPackageDialog(patient.id)} aria-label={`Vender pacote para ${patient.name}`} data-tour="patients-item-package">
                                  <Package className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(patient)} aria-label={`Editar paciente ${patient.name}`} data-tour="patients-item-edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do paciente com tabs */}
      {detailPatient && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailPatient.name}</DialogTitle>
              <DialogDescription>Histórico, pacotes e fidelidade</DialogDescription>
            </DialogHeader>

            {/* Botão Ver Ficha Completa */}
            <Button
              variant="outline"
              className="w-full mb-4"
              onClick={() => {
                setIsDetailOpen(false);
                navigate(`/pacientes/${detailPatient.id}`);
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver Ficha Completa
            </Button>

            {isDetailLoadingExtras ? (
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
                  {(() => {
                    const spending = getSpendingForPatient(detailPatient.id);
                    if (!spending) return <p className="text-muted-foreground text-sm py-4">Nenhum consumo registrado.</p>;
                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-sm">Total: {formatCurrency(spending.total_amount)}</Badge>
                          <Badge variant="outline" className="text-sm">Ticket médio: {formatCurrency(spending.ticket_medio)}</Badge>
                          <Badge variant="outline" className="text-sm">{spending.services_count} serviço{spending.services_count !== 1 ? "s" : ""}</Badge>
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
                    );
                  })()}
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
                  {patientEvolutions.length === 0 ? (
                    <EmptyState icon={NotebookPen} title="Nenhuma evolução" description="Evoluções clínicas SOAP deste paciente aparecerão aqui." />
                  ) : (
                    <div className="space-y-2">
                      {patientEvolutions.map((evo) => (
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
                    <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => openPackageDialog(detailPatient.id)}>
                      <Plus className="mr-2 h-4 w-4" />Novo Pacote
                    </Button>
                  )}
                  {detailPackages.length === 0 ? (
                    <EmptyState icon={Package} title="Nenhum pacote" description="Este paciente ainda não possui pacotes de sessões." />
                  ) : (
                    <div className="rounded-lg border divide-y text-sm">
                      {detailPackages.map((p) => (
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
                  {detailTimeline.length === 0 ? (
                    <EmptyState icon={Clock} title="Nenhum evento" description="O histórico do paciente aparecerá aqui." />
                  ) : (
                    <div className="rounded-lg border divide-y text-sm">
                      {detailTimeline.map((ev, i) => (
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
                                  if (!aptId) { toast.error("appointment_id não encontrado"); return; }
                                  handleRevertPackageConsumption(aptId);
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
                      onClick={() => { setIsDetailOpen(false); setContractsPatient(detailPatient); }}
                    >
                      <FileSignature className="mr-2 h-4 w-4" />Gerar Contrato e Termos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setIsDetailOpen(false); setSendLinkPatient(detailPatient); }}
                    >
                      <MessageCircle className="mr-2 h-4 w-4 text-green-600" />Enviar Link WhatsApp
                    </Button>
                  </div>
                  <PatientConsentsViewer
                    patientId={detailPatient.id}
                    patientName={detailPatient.name}
                    tenantId={profile?.tenant_id ?? ""}
                  />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para criar pacote */}
      <Dialog open={packageDialog} onOpenChange={setPackageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vender Pacote</DialogTitle>
            <DialogDescription>Crie um pacote de sessões para o paciente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={packageForm.procedure_id || undefined} onValueChange={(v) => setPackageForm({ ...packageForm, procedure_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                <SelectContent>
                  {procedures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total de sessões</Label>
              <Input type="number" min="1" max="100" value={packageForm.total_sessions} onChange={(e) => setPackageForm({ ...packageForm, total_sessions: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={packageForm.expires_at} onChange={(e) => setPackageForm({ ...packageForm, expires_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={packageForm.notes} onChange={(e) => setPackageForm({ ...packageForm, notes: e.target.value })} rows={2} placeholder="Notas sobre o pacote..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialog(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreatePackage} disabled={isSavingPackage}>
              {isSavingPackage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog: Código de acesso do paciente */}
      <Dialog open={accessCodeDialog} onOpenChange={setAccessCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Paciente cadastrado!
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
            <Button onClick={() => setAccessCodeDialog(false)} className="gradient-primary text-primary-foreground">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog: Gerar Contratos e Termos */}
      {contractsPatient && (
        <GenerateContractsDialog
          open={!!contractsPatient}
          onOpenChange={(open) => { if (!open) setContractsPatient(null); }}
          patient={contractsPatient}
        />
      )}
      {/* Dialog: Enviar Link de Assinatura */}
      <SendConsentLinkDialog
        open={!!sendLinkPatient}
        onOpenChange={(open) => { if (!open) setSendLinkPatient(null); }}
        patient={sendLinkPatient}
      />
    </MainLayout>
  );
}
