import { useState, useEffect } from "react";
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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Plus, Loader2, Search, Printer, User, Calendar,
  Trash2, Pencil, Download, ShieldCheck, CheckCircle2, AlertTriangle, FileSignature,
  Eye, EyeOff, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { MODAL_SIZES } from "@/lib/modal-constants";
import { generateCertificatePdf } from "@/utils/patientDocumentPdf";
import { useCertificateSign } from "@/hooks/useCertificateSign";
import { generateRecordHash } from "@/lib/digital-signature";

interface Client {
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

interface Certificate {
  id: string;
  client_id: string;
  client_name: string;
  professional_name: string;
  certificate_type: string;
  issued_at: string;
  days_off: number | null;
  start_date: string | null;
  end_date: string | null;
  cid_code: string | null;
  content: string;
  notes: string | null;
  digital_signature: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  signed_by_uf: string | null;
  signed_by_specialty: string | null;
  server_timestamp: string | null;
}

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  services: { name: string } | null;
  medical_records: { id: string }[] | { id: string } | null;
}

interface CertificateRow {
  id: string;
  client_id: string;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
  certificate_type: string;
  issued_at: string;
  days_off: number | null;
  start_date: string | null;
  end_date: string | null;
  cid_code: string | null;
  content: string;
  notes: string | null;
  digital_signature: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  signed_by_uf: string | null;
  signed_by_specialty: string | null;
  server_timestamp: string | null;
}

interface TenantWithLogo {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  cnpj?: string;
}

const typeLabel: Record<string, string> = {
  atestado: "Atestado Médico",
  declaracao_comparecimento: "Declaração de Comparecimento",
  laudo: "Laudo Médico",
  relatorio: "Relatório Médico",
};

const typeColors: Record<string, string> = {
  atestado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  declaracao_comparecimento: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  laudo: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  relatorio: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const contentTemplates: Record<string, { label: string; content: string }[]> = {
  atestado: [
    {
      label: "Atestado Padrão",
      content: "Atesto, para os devidos fins, que o(a) paciente acima identificado(a) esteve sob meus cuidados profissionais na data de hoje, necessitando de afastamento de suas atividades laborais pelo período indicado.",
    },
    {
      label: "Atestado com Repouso",
      content: "Atesto, para os devidos fins, que o(a) paciente acima identificado(a) encontra-se em tratamento médico, necessitando de repouso absoluto pelo período indicado, estando impossibilitado(a) de exercer suas atividades habituais.",
    },
    {
      label: "Atestado para Acompanhante",
      content: "Atesto, para os devidos fins, que o(a) Sr(a). __________________ acompanhou o(a) paciente acima identificado(a) durante consulta/procedimento médico realizado nesta data, permanecendo nas dependências desta clínica das ___:___ às ___:___.",
    },
  ],
  declaracao_comparecimento: [
    {
      label: "Comparecimento Padrão",
      content: "Declaramos, para os devidos fins, que o(a) paciente acima identificado(a) compareceu a esta clínica na data de hoje para consulta médica, permanecendo em atendimento das ___:___ às ___:___.",
    },
    {
      label: "Comparecimento para Exame",
      content: "Declaramos, para os devidos fins, que o(a) paciente acima identificado(a) compareceu a esta clínica na data de hoje para realização de exame/procedimento, permanecendo em atendimento das ___:___ às ___:___.",
    },
  ],
  laudo: [
    {
      label: "Laudo Médico Padrão",
      content: "LAUDO MÉDICO\n\nPaciente em acompanhamento neste serviço desde ___/___/___.\n\nHISTÓRIA CLÍNICA:\n\n\nEXAME FÍSICO:\n\n\nEXAMES COMPLEMENTARES:\n\n\nHIPÓTESE DIAGNÓSTICA:\n\n\nCONDUTA:\n\n\nCONCLUSÃO:",
    },
  ],
  relatorio: [
    {
      label: "Relatório Médico Padrão",
      content: "RELATÓRIO MÉDICO\n\nPaciente em acompanhamento neste serviço.\n\nQUADRO CLÍNICO ATUAL:\n\n\nTRATAMENTO EM CURSO:\n\n\nEVOLUÇÃO:\n\n\nPROGNÓSTICO:\n\n\nRECOMENDAÇÕES:",
    },
  ],
};

const emptyForm = {
  client_id: "",
  appointment_id: "",
  certificate_type: "atestado",
  days_off: "",
  start_date: "",
  end_date: "",
  cid_code: "",
  content: "",
  notes: "",
};

export default function Atestados() {
  const { profile, tenant, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  
  // Estados para assinatura digital
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signingCertificate, setSigningCertificate] = useState<Certificate | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message?: string; error?: string; signed_at?: string; signed_by?: string; crm?: string; uf?: string; specialty?: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchCertificates();
    }
  }, [profile?.tenant_id]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, phone, cpf")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (err) {
      logger.error("Error fetching patients:", err);
    }
  };

  const fetchRecentAppointments = async (clientId: string) => {
    if (!profile?.tenant_id || !clientId) { setRecentAppointments([]); return; }
    try {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, services(name), medical_records(id)")
        .eq("tenant_id", profile.tenant_id)
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      setRecentAppointments((data ?? []).map((a: AppointmentRow) => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        service_name: a.services?.name ?? "Consulta",
        medical_record_id: Array.isArray(a.medical_records) ? a.medical_records[0]?.id ?? null : a.medical_records?.id ?? null,
      })));
    } catch { setRecentAppointments([]); }
  };

  const handleClientChange = (clientId: string) => {
    setFormData(f => ({ ...f, client_id: clientId, appointment_id: "" }));
    void fetchRecentAppointments(clientId);
  };

  const fetchCertificates = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_certificates")
        .select(`*, clients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const mapped: Certificate[] = (data || []).map((r: CertificateRow) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.name ?? "—",
        professional_name: r.profiles?.full_name ?? "—",
        certificate_type: r.certificate_type,
        issued_at: r.issued_at,
        days_off: r.days_off,
        start_date: r.start_date,
        end_date: r.end_date,
        cid_code: r.cid_code,
        content: r.content,
        notes: r.notes,
        digital_signature: r.digital_signature,
        signed_at: r.signed_at,
        signed_by_name: r.signed_by_name,
        signed_by_crm: r.signed_by_crm,
        signed_by_uf: r.signed_by_uf,
        signed_by_specialty: r.signed_by_specialty,
        server_timestamp: r.server_timestamp,
      }));
      setCertificates(mapped);
    } catch (err) {
      logger.error("Error fetching certificates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (c: Certificate) => {
    setEditingId(c.id);
    setFormData({
      client_id: c.client_id,
      certificate_type: c.certificate_type,
      days_off: c.days_off?.toString() ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      cid_code: c.cid_code ?? "",
      content: c.content,
      notes: c.notes ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.client_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.content.trim()) { toast.error("Preencha o conteúdo do atestado"); return; }

    setIsSaving(true);
    try {
      const selectedAppt = recentAppointments.find(a => a.id === formData.appointment_id);
      const payload = {
        tenant_id: profile!.tenant_id,
        client_id: formData.client_id,
        professional_id: profile!.id,
        appointment_id: formData.appointment_id || null,
        medical_record_id: selectedAppt?.medical_record_id || null,
        certificate_type: formData.certificate_type,
        days_off: formData.days_off ? Number(formData.days_off) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        cid_code: formData.cid_code || null,
        content: formData.content,
        notes: formData.notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("medical_certificates")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Atestado atualizado!");
      } else {
        const { error } = await supabase
          .from("medical_certificates")
          .insert(payload);
        if (error) throw error;
        toast.success("Atestado emitido com sucesso!");
      }
      setIsDialogOpen(false);
      setFormData(emptyForm);
      setEditingId(null);
      fetchCertificates();
    } catch (err) {
      logger.error("Error saving certificate:", err);
      toast.error("Erro ao salvar atestado");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("medical_certificates")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success("Atestado excluído");
      setDeleteId(null);
      fetchCertificates();
    } catch (err) {
      logger.error("Error deleting certificate:", err);
      toast.error("Erro ao excluir atestado");
    }
  };

  // Funções de assinatura digital
  const { state: certState, hasCertificate, checkCertificate, signData, reset: resetCertSign } = useCertificateSign();
  const [certPassword, setCertPassword] = useState("");
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [useIcpBrasil, setUseIcpBrasil] = useState(false);

  const openSignDialog = async (c: Certificate) => {
    if (c.signed_at) {
      toast.error("Este atestado já foi assinado digitalmente");
      return;
    }
    setSigningCertificate(c);
    setCertPassword("");
    setShowCertPassword(false);
    
    const hasCert = await checkCertificate();
    setUseIcpBrasil(hasCert);
    setSignDialogOpen(true);
  };

  const handleSign = async () => {
    if (!signingCertificate) return;
    setIsSigning(true);
    
    try {
      if (useIcpBrasil && hasCertificate) {
        if (!certPassword) {
          toast.error("Informe a senha do certificado");
          setIsSigning(false);
          return;
        }

        const dataToSign = JSON.stringify({
          certificate_type: signingCertificate.certificate_type,
          content: signingCertificate.content,
          days_off: signingCertificate.days_off,
          start_date: signingCertificate.start_date,
          end_date: signingCertificate.end_date,
          cid_code: signingCertificate.cid_code,
          notes: signingCertificate.notes,
          client_id: signingCertificate.client_id,
          issued_at: signingCertificate.issued_at,
        });

        const signResult = await signData(dataToSign, certPassword);
        
        if (!signResult) {
          setIsSigning(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("medical_certificates")
          .update({
            digital_signature: signResult.signature,
            content_hash: signResult.dataHash,
            signed_at: signResult.signedAt,
            signed_by_name: signResult.certificate.commonName,
            signed_by_crm: profile?.council_number || null,
            signed_by_uf: profile?.council_state || null,
            signed_by_specialty: profile?.professional_type || null,
          })
          .eq("id", signingCertificate.id);

        if (updateError) throw updateError;

        toast.success("Atestado assinado com certificado ICP-Brasil!");
      } else {
        const { data, error } = await supabase.rpc("sign_medical_certificate", {
          p_certificate_id: signingCertificate.id,
        });
        
        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; hash?: string; signed_by?: string };
        
        if (!result.success) {
          toast.error(result.error || "Erro ao assinar atestado");
          setIsSigning(false);
          return;
        }
        
        toast.success("Atestado assinado digitalmente com sucesso!");
      }
      
      setSignDialogOpen(false);
      setSigningCertificate(null);
      setCertPassword("");
      resetCertSign();
      fetchCertificates();
    } catch (err) {
      logger.error("Error signing certificate:", err);
      toast.error("Erro ao assinar atestado");
    } finally {
      setIsSigning(false);
    }
  };

  const handleVerify = async (c: Certificate) => {
    setIsVerifying(true);
    setVerifyResult(null);
    setVerifyDialogOpen(true);
    
    try {
      const { data, error } = await supabase.rpc("verify_certificate_signature", {
        p_certificate_id: c.id,
      });
      
      if (error) throw error;
      
      setVerifyResult(data as typeof verifyResult);
    } catch (err) {
      logger.error("Error verifying certificate:", err);
      setVerifyResult({ valid: false, error: "Erro ao verificar assinatura" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrint = (c: Certificate) => {
    const tenantData = tenant as TenantWithLogo | null;
    const clinicName = tenant?.name || "Clínica";
    const logoUrl = tenantData?.logo_url || "";
    const clinicAddress = tenant?.address || "";
    const clinicPhone = tenant?.phone || "";
    const clinicEmail = tenant?.email || "";
    const cnpj = tenantAny?.cnpj || "";
    const responsibleDoctor = tenantAny?.responsible_doctor || "";
    const responsibleCrm = tenantAny?.responsible_crm || "";
    const client = clients.find((cl) => cl.id === c.client_id);

    const borderColor = c.certificate_type === "atestado" ? "#2563eb"
      : c.certificate_type === "declaracao_comparecimento" ? "#059669"
      : c.certificate_type === "laudo" ? "#d97706"
      : "#7c3aed";

    const title = typeLabel[c.certificate_type] || "Documento Médico";
    const issuedDate = new Date(c.issued_at).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo" style="height:64px;width:64px;object-fit:contain;border-radius:8px;" crossorigin="anonymous" />`
      : `<div style="height:64px;width:64px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#64748b;">${clinicName.charAt(0)}</div>`;

    const contentHtml = c.content
      .split("\n")
      .map((line) => `<p style="margin:4px 0;">${line || "&nbsp;"}</p>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title} - ${c.client_name}</title>
<style>
  @page { size: A4 portrait; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 0; }
  .header { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid ${borderColor}; }
  .header-logo { flex-shrink: 0; }
  .header-info { flex: 1; }
  .header-info h1 { font-size: 18px; color: ${borderColor}; margin-bottom: 2px; }
  .header-info p { font-size: 10px; color: #64748b; line-height: 1.5; }
  .type-banner { background: ${borderColor}; color: #fff; text-align: center; padding: 8px 0; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; margin-top: 14px; border-radius: 4px; }
  .patient-section { margin-top: 18px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
  .patient-section .row { display: flex; gap: 16px; font-size: 11px; line-height: 1.8; }
  .patient-section .label { font-weight: 600; color: #475569; min-width: 100px; }
  .patient-section .value { color: #1e293b; }
  .content-section { margin-top: 20px; font-size: 12px; line-height: 1.8; min-height: 200px; }
  .notes-section { margin-top: 16px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 10px; color: #92400e; }
  .notes-section strong { display: block; margin-bottom: 4px; font-size: 10px; color: #78350f; }
  .footer { margin-top: 40px; border-top: 2px solid ${borderColor}; padding-top: 16px; }
  .footer-grid { display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 9px; color: #94a3b8; }
  .footer-right { text-align: center; }
  .signature-line { width: 220px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; }
  .footer-right p { font-size: 11px; color: #1e293b; }
  .footer-right .small { font-size: 9px; color: #64748b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
  <div class="type-banner">${title.toUpperCase()}</div>
  <div class="patient-section">
    <div class="row"><span class="label">Paciente:</span><span class="value">${c.client_name}</span></div>
    ${client?.cpf ? `<div class="row"><span class="label">CPF:</span><span class="value">${client.cpf}</span></div>` : ""}
    <div class="row"><span class="label">Data de Emissão:</span><span class="value">${issuedDate}</span></div>
    ${c.days_off ? `<div class="row"><span class="label">Dias de Afastamento:</span><span class="value">${c.days_off} dia(s)${c.start_date && c.end_date ? ` — de ${new Date(c.start_date + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(c.end_date + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</span></div>` : ""}
    ${c.cid_code ? `<div class="row"><span class="label">CID-10:</span><span class="value">${c.cid_code}</span></div>` : ""}
  </div>
  <div class="content-section">${contentHtml}</div>
  ${c.notes ? `<div class="notes-section"><strong>Observações:</strong>${c.notes}</div>` : ""}
  <div class="footer">
    <div class="footer-grid">
      <div class="footer-left"><p>Emitido em: ${issuedDate}</p></div>
      <div class="footer-right">
        <div class="signature-line"></div>
        <p>${responsibleDoctor || c.professional_name}</p>
        <p class="small">${responsibleCrm || ""}</p>
        <p class="small">${clinicName}</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  };

  const handleDownloadPdf = (c: Certificate) => {
    const tenantData = tenant as TenantWithLogo | null;
    const client = clients.find((cl) => cl.id === c.client_id);
    
    generateCertificatePdf({
      certificate_type: c.certificate_type,
      issued_at: c.issued_at,
      days_off: c.days_off,
      start_date: c.start_date,
      end_date: c.end_date,
      cid_code: c.cid_code,
      content: c.content,
      notes: c.notes,
      professional_name: c.signed_by_name || c.professional_name,
      professional_crm: c.signed_by_crm || tenantAny?.responsible_crm,
      professional_uf: c.signed_by_uf || tenantAny?.council_state,
      professional_specialty: c.signed_by_specialty,
      clinic_name: tenant?.name || "Clínica",
      clinic_address: tenant?.address,
      clinic_phone: tenant?.phone,
      clinic_cnpj: tenantAny?.cnpj,
      patient_name: client?.name,
      patient_cpf: client?.cpf,
      digital_signature: c.digital_signature,
      signed_at: c.signed_at,
    });
  };

  const filtered = certificates.filter((c) => {
    const matchSearch =
      c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.cid_code ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === "all" || c.certificate_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <MainLayout
      title="Atestados Médicos"
      subtitle="Emissão e gerenciamento de atestados, declarações e laudos"
      actions={
        <Button className="gradient-primary text-primary-foreground" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Atestado
        </Button>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente, conteúdo ou CID..."
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="atestado">Atestado Médico</SelectItem>
            <SelectItem value="declaracao_comparecimento">Declaração de Comparecimento</SelectItem>
            <SelectItem value="laudo">Laudo Médico</SelectItem>
            <SelectItem value="relatorio">Relatório Médico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum atestado encontrado"
          description="Emita atestados, declarações e laudos para seus pacientes."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />Novo Atestado
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{c.client_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(c.issued_at).toLocaleDateString("pt-BR")}
                        <span>·</span>
                        {c.professional_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={typeColors[c.certificate_type]}>
                      {typeLabel[c.certificate_type] || c.certificate_type}
                    </Badge>
                    {c.signed_at && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Assinado
                      </Badge>
                    )}
                    {c.days_off != null && c.days_off > 0 && (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        {c.days_off} dia(s) afastamento
                      </Badge>
                    )}
                    {c.cid_code && (
                      <Badge variant="outline">{c.cid_code}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {c.content}
                  </pre>
                </div>
                {c.notes && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Obs: </span>
                    {c.notes}
                  </div>
                )}
                
                {/* Seção de assinatura digital */}
                {c.signed_at && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">Documento Assinado Digitalmente</p>
                        <p className="text-emerald-600 dark:text-emerald-500 text-xs mt-1">
                          Assinado por: {c.signed_by_name} {c.signed_by_crm && `(${c.signed_by_crm}${c.signed_by_uf ? `/${c.signed_by_uf}` : ''})`}
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-500 text-xs">
                          Data: {new Date(c.signed_at).toLocaleString("pt-BR")}
                        </p>
                        {c.digital_signature && (
                          <p className="text-emerald-500 dark:text-emerald-600 text-xs font-mono mt-1 truncate" title={c.digital_signature}>
                            Hash: {c.digital_signature.substring(0, 32)}...
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700" onClick={() => handleVerify(c)}>
                        Verificar
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 flex-wrap">
                  {!c.signed_at && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar
                    </Button>
                  )}
                  {!c.signed_at && (
                    <Button variant="outline" size="sm" className="text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50" onClick={() => openSignDialog(c)}>
                      <FileSignature className="h-3.5 w-3.5 mr-1.5" />Assinar
                    </Button>
                  )}
                  {isAdmin && !c.signed_at && (
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(c)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePrint(c)}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Drawer */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingId ? "Editar Atestado" : "Novo Atestado Médico"}
        description={editingId ? "Atualize os dados do atestado" : "Emita um atestado para o paciente"}
        width="md"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel={editingId ? "Salvar Alterações" : "Emitir Atestado"}
      >
        <div className="space-y-4">
          <FormDrawerSection title="Paciente">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select
                value={formData.client_id || undefined}
                onValueChange={handleClientChange}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((cl) => (
                    <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
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

          <FormDrawerSection title="Tipo e Período">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select
                value={formData.certificate_type}
                onValueChange={(v) => setFormData({ ...formData, certificate_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atestado">Atestado Médico</SelectItem>
                  <SelectItem value="declaracao_comparecimento">Declaração de Comparecimento</SelectItem>
                  <SelectItem value="laudo">Laudo Médico</SelectItem>
                  <SelectItem value="relatorio">Relatório Médico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Dias de Afastamento</Label>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={formData.days_off}
                  onChange={(e) => setFormData({ ...formData, days_off: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CID-10</Label>
              <Input
                value={formData.cid_code}
                onChange={(e) => setFormData({ ...formData, cid_code: e.target.value })}
                placeholder="Ex: J06.9"
              />
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Conteúdo">
            <div className="space-y-2">
              <Label>Modelo de Texto</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  const templates = contentTemplates[formData.certificate_type] || [];
                  const template = templates.find((t) => t.label === v);
                  if (template) {
                    setFormData({ ...formData, content: template.content });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um modelo (opcional)" /></SelectTrigger>
                <SelectContent>
                  {(contentTemplates[formData.certificate_type] || []).map((t) => (
                    <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Selecione um modelo para preencher automaticamente ou escreva livremente</p>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo do Atestado *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Atesto, para os devidos fins, que o(a) paciente..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </FormDrawerSection>
        </div>
      </FormDrawer>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        itemName="este atestado"
        itemType="atestado"
        warningText="O documento será permanentemente removido."
      />

      {/* Dialog de Assinatura Digital */}
      <AlertDialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-emerald-600" />
              Assinar Digitalmente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a assinar digitalmente este atestado. Esta ação:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Gerará um hash SHA-256 único do conteúdo</li>
                <li>Registrará seu nome e CRM como assinante</li>
                <li>Impedirá alterações futuras no documento</li>
                <li>Permitirá verificação de integridade</li>
              </ul>
              {signingCertificate && (
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium">Documento a ser assinado:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {typeLabel[signingCertificate.certificate_type]} — {signingCertificate.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Emitido em: {new Date(signingCertificate.issued_at).toLocaleDateString("pt-BR")}
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

      {/* Dialog de Verificação de Assinatura */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Verificação de Assinatura Digital
            </DialogTitle>
            <DialogDescription>
              Resultado da verificação de integridade do documento
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {isVerifying ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : verifyResult ? (
              <div className={`rounded-lg p-4 ${verifyResult.valid ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"}`}>
                <div className="flex items-start gap-3">
                  {verifyResult.valid ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${verifyResult.valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      {verifyResult.valid ? "Documento Íntegro" : "Atenção: Problema Detectado"}
                    </p>
                    <p className={`text-sm mt-1 ${verifyResult.valid ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"}`}>
                      {verifyResult.message || verifyResult.error}
                    </p>
                    {verifyResult.valid && verifyResult.signed_by && (
                      <div className="mt-3 space-y-1 text-sm text-emerald-600 dark:text-emerald-500">
                        <p><strong>Assinado por:</strong> {verifyResult.signed_by}</p>
                        {verifyResult.crm && <p><strong>CRM:</strong> {verifyResult.crm}{verifyResult.uf && `/${verifyResult.uf}`}</p>}
                        {verifyResult.specialty && <p><strong>Especialidade:</strong> {verifyResult.specialty}</p>}
                        {verifyResult.signed_at && (
                          <p><strong>Data:</strong> {new Date(verifyResult.signed_at).toLocaleString("pt-BR")}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
