import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { RefillRequestsPanel } from "@/components/prontuario/RefillRequestsPanel";
import { safePrintHtml } from "@/lib/safe-print";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { api } from "@/integrations/gcp/client";
import {
  FilePlus2,
  Plus,
  Loader2,
  Search,
  Printer,
  User,
  Calendar,
  Pill,
  Copy,
  CheckCheck,
  Zap,
  FileSignature,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { isMemedConfigured, loadMemedSdk, openMemedPrescription } from "@/lib/memed-integration";
import { useCertificateSign } from "@/hooks/useCertificateSign";
import { generatePrescriptionPdf } from "@/utils/patientDocumentPdf";

interface Patient {
  id: string;
  name: string;
  phone?: string;
  cpf?: string;
}

interface RecentAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  medical_record_id: string | null;
}

interface Prescription {
  id: string;
  patient_id: string;
  client_name: string;
  professional_name: string;
  issued_at: string;
  medications: string;
  instructions: string;
  validity_days: number;
  prescription_type: "simples" | "especial_b" | "especial_a";
  status: "ativo" | "expirado" | "cancelado";
  signed_by_name?: string | null;
  signed_by_crm?: string | null;
  signed_by_uf?: string | null;
  digital_signature?: string | null;
  signed_at?: string | null;
}


const typeLabel: Record<string, string> = {
  simples: "Simples",
  especial_b: "Especial B (Tarja Preta)",
  especial_a: "Especial A (Entorpecente)",
};

const typeColors: Record<string, string> = {
  simples: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  especial_b: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  especial_a: "bg-red-500/10 text-red-600 border-red-500/20",
};

const emptyForm = {
  patient_id: "",
  appointment_id: "",
  medications: "",
  instructions: "",
  validity_days: "30",
  prescription_type: "simples" as const,
};

export default function Receituarios() {
  const { profile, tenant } = useAuth();
  const { isPrescriber } = usePermissions();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  
  // Assinatura digital
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signingPrescription, setSigningPrescription] = useState<Prescription | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [certPassword, setCertPassword] = useState("");
  const [showCertPassword, setShowCertPassword] = useState(false);
  
  const {
    hasCertificate,
    certState,
    signData,
    reset: resetCertSign,
  } = useCertificateSign();
  
  const useIcpBrasil = hasCertificate;
  const [memedLoading, setMemedLoading] = useState(false);

  const memedEnabled = isMemedConfigured();

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPatients();
      fetchPrescriptions();
    }
  }, [profile?.tenant_id]);

  const fetchPatients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from("patients")
        .select("id, name, phone, cpf")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setPatients((data as Patient[]) || []);
    } catch (err) {
      logger.error("Error fetching patients:", err);
    }
  };

  const fetchRecentAppointments = async (patientId: string) => {
    if (!profile?.tenant_id || !patientId) { setRecentAppointments([]); return; }
    try {
      const { data } = await api
        .from("appointments")
        .select("id, scheduled_at, procedure:procedures(name), medical_records(id)")
        .eq("tenant_id", profile.tenant_id)
        .eq("patient_id", patientId)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      setRecentAppointments((data ?? []).map((a: any) => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        service_name: a.procedure?.name ?? "Consulta",
        medical_record_id: Array.isArray(a.medical_records) ? a.medical_records[0]?.id ?? null : a.medical_records?.id ?? null,
      })));
    } catch { setRecentAppointments([]); }
  };

  const handlePatientChange = (patientId: string) => {
    setFormData(f => ({ ...f, patient_id: patientId, appointment_id: "" }));
    void fetchRecentAppointments(patientId);
  };

  const handleMemedPrescription = async () => {
    if (!formData.patient_id) {
      toast.error("Selecione um paciente antes de prescrever via Memed");
      return;
    }
    const patient = patients.find(c => c.id === formData.patient_id);
    if (!patient) return;

    setMemedLoading(true);
    try {
      await loadMemedSdk();
      openMemedPrescription(client.name, patient.cpf);
      toast.info("Memed aberto — prescreva e salve no painel do Memed");
    } catch (err) {
      logger.error("Memed SDK error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao abrir Memed");
    } finally {
      setMemedLoading(false);
    }
  };

  useEffect(() => {
    if (!memedEnabled) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && formData.patient_id) {
        const meds = Array.isArray(detail)
          ? detail.map((m: any) => `${m.nome || m.name} — ${m.posologia || m.dosage || ""}`).join("\n")
          : typeof detail === "string" ? detail : JSON.stringify(detail);
        setFormData(f => ({ ...f, medications: meds }));
        setIsDialogOpen(true);
        toast.success("Prescrição do Memed importada — revise e emita");
      }
    };
    window.addEventListener("memed:prescription-saved", handler);
    return () => window.removeEventListener("memed:prescription-saved", handler);
  }, [memedEnabled, formData.patient_id]);

  const fetchPrescriptions = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("prescriptions")
        .select(`*, patient:patients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const mapped: Prescription[] = (data || []).map((r: any) => ({
        id: r.id,
        patient_id: r.patient_id,
        client_name: r.patient?.name ?? "—",
        professional_name: r.profiles?.full_name ?? "—",
        issued_at: r.issued_at,
        medications: r.medications,
        instructions: r.instructions ?? "",
        validity_days: r.validity_days,
        prescription_type: r.prescription_type,
        status: r.status,
        signed_by_name: r.signed_by_name,
        signed_by_crm: r.signed_by_crm,
        signed_by_uf: r.signed_by_uf,
        digital_signature: r.digital_signature,
        signed_at: r.signed_at,
      }));
      setPrescriptions(mapped);
    } catch (err) {
      logger.error("Error fetching prescriptions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.patient_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.medications.trim()) { toast.error("Adicione ao menos um medicamento"); return; }

    setIsSaving(true);
    try {
      const selectedAppt = recentAppointments.find(a => a.id === formData.appointment_id);
      const { error } = await api.from("prescriptions").insert({
        tenant_id: profile!.tenant_id,
        patient_id: formData.patient_id,
        professional_id: profile!.id,
        appointment_id: formData.appointment_id || null,
        medical_record_id: selectedAppt?.medical_record_id || null,
        medications: formData.medications,
        instructions: formData.instructions || null,
        validity_days: Number(formData.validity_days),
        prescription_type: formData.prescription_type,
        status: "ativo",
        signed_by_name: profile!.full_name,
        signed_by_crm: profile!.council_number || null,
        signed_by_uf: profile!.council_state || null,
      });
      if (error) throw error;
      toast.success("Receituário emitido com sucesso!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchPrescriptions();
    } catch (err) {
      logger.error("Error saving prescription:", err);
      toast.error("Erro ao emitir receituário");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = (p: Prescription) => {
    const tenantAny = tenant as any;
    const logoUrl = tenantAny?.logo_url || "";
    const clinicName = tenant?.name || "Clínica";
    const clinicAddress = tenant?.address || "";
    const clinicPhone = tenant?.phone || "";
    const clinicEmail = tenant?.email || "";
    const cnpj = tenantAny?.cnpj || "";
    const responsibleDoctor = tenantAny?.responsible_doctor || "";
    const responsibleCrm = tenantAny?.responsible_crm || "";
    const patient = patients.find((c) => c.id === p.patient_id);

    const typeLabels: Record<string, string> = {
      simples: "RECEITUÁRIO SIMPLES",
      especial_b: "RECEITUÁRIO ESPECIAL — CONTROLE ESPECIAL",
      especial_a: "RECEITUÁRIO ESPECIAL — ENTORPECENTES E PSICOTRÓPICOS",
    };

    const typeBorder: Record<string, string> = {
      simples: "#2563eb",
      especial_b: "#d97706",
      especial_a: "#dc2626",
    };

    const borderColor = typeBorder[p.prescription_type] || "#2563eb";
    const typeTitle = typeLabels[p.prescription_type] || "RECEITUÁRIO";
    const issuedDate = new Date(p.issued_at).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const medsHtml = p.medications
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<div style="padding:4px 0;border-bottom:1px dotted #e5e7eb;">${line}</div>`)
      .join("");

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo" style="height:64px;width:64px;object-fit:contain;border-radius:8px;" crossorigin="anonymous" />`
      : `<div style="height:64px;width:64px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#64748b;">${clinicName.charAt(0)}</div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Receita - ${p.client_name}</title>
<style>
  @page { size: A5 portrait; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
  .page { max-width: 148mm; margin: 0 auto; padding: 0; }
  .header { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid ${borderColor}; }
  .header-logo { flex-shrink: 0; }
  .header-info { flex: 1; }
  .header-info h1 { font-size: 16px; color: ${borderColor}; margin-bottom: 2px; letter-spacing: 0.5px; }
  .header-info p { font-size: 9px; color: #64748b; line-height: 1.5; }
  .type-banner { background: ${borderColor}; color: #fff; text-align: center; padding: 6px 0; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; margin-top: 10px; border-radius: 4px; }
  .patient-section { margin-top: 14px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
  .patient-section .row { display: flex; gap: 16px; font-size: 10px; line-height: 1.8; }
  .patient-section .label { font-weight: 600; color: #475569; min-width: 60px; }
  .patient-section .value { color: #1e293b; }
  .rx-symbol { font-size: 28px; font-weight: 700; color: ${borderColor}; font-style: italic; font-family: 'Times New Roman', serif; margin-top: 16px; }
  .meds-section { margin-top: 8px; padding: 0 4px; font-size: 11px; line-height: 1.8; min-height: 140px; }
  .meds-section div { padding: 3px 0; border-bottom: 1px dotted #e5e7eb; }
  .instructions { margin-top: 14px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 10px; color: #92400e; }
  .instructions strong { display: block; margin-bottom: 4px; font-size: 10px; color: #78350f; }
  .footer { margin-top: 20px; border-top: 2px solid ${borderColor}; padding-top: 14px; }
  .footer-grid { display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 9px; color: #94a3b8; }
  .footer-right { text-align: center; }
  .signature-line { width: 200px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; }
  .footer-right p { font-size: 10px; color: #1e293b; }
  .footer-right .small { font-size: 9px; color: #64748b; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-logo">${logoHtml}</div>
    <div class="header-info">
      <h1>${clinicName}</h1>
      ${clinicAddress ? `<p>${clinicAddress}</p>` : ""}
      <p>${[clinicPhone, clinicEmail, cnpj ? `CNPJ: ${cnpj}` : ""].filter(Boolean).join(" · ")}</p>
    </div>
  </div>

  <div class="type-banner">${typeTitle}</div>

  <div class="patient-section">
    <div class="row"><span class="label">Paciente:</span><span class="value">${p.client_name}</span></div>
    ${patient?.cpf ? `<div class="row"><span class="label">CPF:</span><span class="value">${patient.cpf}</span></div>` : ""}
    <div class="row">
      <span class="label">Data:</span><span class="value">${issuedDate}</span>
      <span class="label" style="margin-left:16px;">Validade:</span><span class="value">${p.validity_days} dias</span>
    </div>
  </div>

  <div class="rx-symbol">Rx</div>

  <div class="meds-section">
    ${medsHtml}
  </div>

  ${p.instructions ? `
  <div class="instructions">
    <strong>Instruções ao Paciente:</strong>
    ${p.instructions}
  </div>` : ""}

  <div class="footer">
    <div class="footer-grid">
      <div class="footer-left">
        <p>Emitido em: ${issuedDate}</p>
        <p>Válido por ${p.validity_days} dias</p>
      </div>
      <div class="footer-right">
        <div class="signature-line"></div>
        <p>${p.signed_by_name || responsibleDoctor || p.professional_name}</p>
        <p class="small">${p.signed_by_crm ? `CRM: ${p.signed_by_crm}${p.signed_by_uf ? `/${p.signed_by_uf}` : ""}` : responsibleCrm || ""}</p>
        <p class="small">${clinicName}</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

    safePrintHtml(html);
  };

  const handleOpenSignDialog = (p: Prescription) => {
    if (p.signed_at) {
      toast.info("Esta receita já foi assinada digitalmente");
      return;
    }
    setSigningPrescription(p);
    setCertPassword("");
    setSignDialogOpen(true);
  };

  const handleSign = async () => {
    if (!signingPrescription) return;
    
    setIsSigning(true);
    try {
      if (useIcpBrasil && hasCertificate) {
        if (!certPassword) {
          toast.error("Digite a senha do certificado");
          setIsSigning(false);
          return;
        }

        const dataToSign = JSON.stringify({
          prescription_type: signingPrescription.prescription_type,
          medications: signingPrescription.medications,
          instructions: signingPrescription.instructions,
          validity_days: signingPrescription.validity_days,
          patient_id: signingPrescription.patient_id,
          issued_at: signingPrescription.issued_at,
        });

        const signResult = await signData(dataToSign, certPassword);
        
        if (!signResult) {
          setIsSigning(false);
          return;
        }

        const { error: updateError } = await api
          .from("prescriptions")
          .update({
            digital_signature: signResult.signature,
            content_hash: signResult.dataHash,
            digital_hash: signResult.dataHash,
            signed_at: signResult.signedAt,
            signed_by_name: signResult.certificate.commonName,
            signed_by_crm: profile?.council_number || null,
            signed_by_uf: profile?.council_state || null,
          })
          .eq("id", signingPrescription.id);

        if (updateError) throw updateError;

        toast.success("Receita assinada com certificado ICP-Brasil!");
      } else {
        const { data, error } = await api.rpc("sign_prescription", {
          p_prescription_id: signingPrescription.id,
        });
        
        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; hash?: string; signed_by?: string };
        
        if (!result.success) {
          toast.error(result.error || "Erro ao assinar receita");
          setIsSigning(false);
          return;
        }
        
        toast.success("Receita assinada digitalmente com sucesso!");
      }
      
      setSignDialogOpen(false);
      setSigningPrescription(null);
      setCertPassword("");
      resetCertSign();
      fetchPrescriptions();
    } catch (err) {
      logger.error("Error signing prescription:", err);
      toast.error("Erro ao assinar receita");
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadPdf = (p: Prescription) => {
    const patient = patients.find((c) => c.id === p.patient_id);
    const expiresAt = new Date(new Date(p.issued_at).getTime() + p.validity_days * 24 * 60 * 60 * 1000);
    
    generatePrescriptionPdf({
      prescription_type: p.prescription_type,
      issued_at: p.issued_at,
      validity_days: p.validity_days,
      expires_at: expiresAt.toISOString(),
      medications: p.medications,
      instructions: p.instructions || "",
      professional_name: p.signed_by_name || p.professional_name,
      professional_crm: p.signed_by_crm,
      professional_uf: p.signed_by_uf,
      clinic_name: tenant?.name || "Clínica",
      patient_name: p.client_name,
      patient_cpf: patient?.cpf,
      digital_hash: p.digital_signature,
      signed_at: p.signed_at,
    });
  };

  const filtered = prescriptions.filter(
    (p) =>
      p.client_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.medications.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const isExpired = (p: Prescription) => {
    const issued = new Date(p.issued_at);
    const expiry = new Date(issued.getTime() + p.validity_days * 24 * 60 * 60 * 1000);
    return expiry < new Date();
  };

  return (
    <MainLayout
      title="Receituários"
      subtitle="Emissão e controle de receitas médicas"
      actions={
        <div className="flex gap-2">
          {memedEnabled && isPrescriber && (
            <Button variant="outline" onClick={handleMemedPrescription} disabled={memedLoading || !formData.patient_id}>
              {memedLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Prescrever via Memed
            </Button>
          )}
          {isPrescriber && (
            <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Receita
            </Button>
          )}
        </div>
      }
    >
      {/* Busca */}
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por paciente ou medicamento..."
          className="pl-10"
        />
      </div>

      <RefillRequestsPanel />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title="Nenhum receituário encontrado"
          description={isPrescriber ? "Emita receitas médicas para seus pacientes." : "Nenhuma receita encontrada. Apenas prescritores podem emitir receitas."}
          action={
            isPrescriber ? (
              <Button variant="gradient" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Nova Receita
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => {
            const expired = isExpired(p);
            return (
              <Card key={p.id} className={expired ? "opacity-70" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{p.client_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(p.issued_at).toLocaleDateString("pt-BR")}
                          <span>·</span>
                          {p.professional_name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={typeColors[p.prescription_type]}>
                        {typeLabel[p.prescription_type]}
                      </Badge>
                      {p.signed_at ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Assinado
                        </Badge>
                      ) : null}
                      {expired ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                          Válido por {p.validity_days} dias
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Pill className="h-4 w-4 text-primary" />
                        Medicamentos
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopy(p.medications, p.id)}
                      >
                        {copiedId === p.id ? (
                          <><CheckCheck className="h-3.5 w-3.5 mr-1 text-success" />Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" />Copiar</>
                        )}
                      </Button>
                    </div>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {p.medications}
                    </pre>
                  </div>
                  {p.instructions && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Instruções: </span>
                      {p.instructions}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {!p.signed_at && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenSignDialog(p)}>
                        <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                        Assinar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(p)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrint(p)}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" />
                      Imprimir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Nova Receita Médica"
        description="Emita uma receita para o paciente"
        width="md"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel="Emitir Receita"
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={formData.patient_id || undefined} onValueChange={handlePatientChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recentAppointments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Vincular a consulta (opcional)</Label>
                <Select value={formData.appointment_id || "none"} onValueChange={(v) => setFormData(f => ({ ...f, appointment_id: v === "none" ? "" : v }))}>
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

          <FormDrawerSection title="Tipo e Validade">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Receita</Label>
                <Select
                  value={formData.prescription_type}
                  onValueChange={(v: any) => setFormData({ ...formData, prescription_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="especial_b">Especial B (Tarja Preta)</SelectItem>
                    <SelectItem value="especial_a">Especial A (Entorpecente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.validity_days}
                  onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                />
              </div>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Prescrição">
            <div className="space-y-2">
              <Label>Medicamentos e Posologia *</Label>
              <Textarea
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                placeholder={"1. Amoxicilina 500mg\n   - 1 cápsula a cada 8h por 7 dias\n\n2. Dipirona 500mg\n   - 1 comprimido se dor (máx. 4x/dia)"}
                rows={6}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Instruções ao Paciente</Label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Orientações gerais, cuidados, restrições alimentares..."
                rows={3}
              />
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>

      {/* Dialog de Assinatura Digital */}
      <AlertDialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-emerald-600" />
              Assinar Receita Digitalmente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a assinar digitalmente esta receita. Esta ação:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Gerará um hash SHA-256 único do conteúdo</li>
                <li>Registrará seu nome e CRM como assinante</li>
                <li>Impedirá alterações futuras no documento</li>
                <li>Permitirá verificação de integridade</li>
              </ul>
              {signingPrescription && (
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium">Receita a ser assinada:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {typeLabel[signingPrescription.prescription_type]} — {signingPrescription.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Emitida em: {new Date(signingPrescription.issued_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
              
              {useIcpBrasil && hasCertificate && certState.certificate && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Assinatura com Certificado ICP-Brasil
                    </p>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mb-3">
                    Certificado: {certState.certificate.common_name}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs">Senha do Certificado</Label>
                    <div className="relative">
                      <Input
                        type={showCertPassword ? "text" : "password"}
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        placeholder="Digite a senha do certificado"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowCertPassword(!showCertPassword)}
                      >
                        {showCertPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {!useIcpBrasil && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Nota:</strong> Você não possui certificado ICP-Brasil cadastrado. 
                    A assinatura será feita com hash SHA-256 interno. Para assinatura com validade jurídica plena, 
                    cadastre seu certificado em Configurações → Certificados.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSign}
              disabled={isSigning || (useIcpBrasil && hasCertificate && !certPassword)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assinando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Confirmar Assinatura
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
