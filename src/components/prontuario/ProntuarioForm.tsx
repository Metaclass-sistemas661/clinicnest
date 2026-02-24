import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, ArrowLeft, Heart, Activity, Thermometer, Wind, Weight, Ruler, Lock, ShieldCheck, Upload, FileKey } from "lucide-react";
import { TriageContextCard, type TriageData } from "./TriageContextCard";
import { DynamicFieldsRenderer, type TemplateField } from "./DynamicFieldsRenderer";
import { Cid10Combobox } from "@/components/ui/cid10-combobox";
import { generateRecordHash, buildSignaturePayload } from "@/lib/digital-signature";
import { readPfxFile, parsePfxCertificateInfo, signWithCertificate, validateICPCertificate, type ICPCertificateInfo } from "@/lib/icp-brasil-signature";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Template {
  id: string;
  name: string;
  specialty_id: string | null;
  fields: TemplateField[];
  is_default: boolean;
}

interface Client { id: string; name: string; }

export interface EditableRecord {
  id: string;
  client_id: string;
  appointment_id: string | null;
  triage_id?: string | null;
  template_id?: string | null;
  chief_complaint: string;
  anamnesis: string;
  physical_exam: string;
  diagnosis: string;
  cid_code: string;
  treatment_plan: string;
  prescriptions: string;
  notes: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  pain_scale: number | null;
  allergies: string;
  current_medications: string;
  medical_history: string;
  digital_hash: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  is_locked: boolean;
  lock_reason: string | null;
  created_at: string;
  custom_fields?: Record<string, unknown>;
}

interface Props {
  tenantId: string;
  professionalId: string;
  professionalName?: string;
  professionalCrm?: string;
  clients: Client[];
  templates: Template[];
  initialClientId?: string;
  initialAppointmentId?: string;
  initialTriage?: TriageData | null;
  builtInFields?: TemplateField[];
  editRecord?: EditableRecord | null;
  onSaved: () => void;
  onCancel: () => void;
}

const emptyBase = {
  chief_complaint: "",
  anamnesis: "",
  physical_exam: "",
  diagnosis: "",
  cid_code: "",
  treatment_plan: "",
  prescriptions: "",
  notes: "",
};

const emptyVitals = {
  blood_pressure_systolic: null as number | null,
  blood_pressure_diastolic: null as number | null,
  heart_rate: null as number | null,
  respiratory_rate: null as number | null,
  temperature: null as number | null,
  oxygen_saturation: null as number | null,
  weight_kg: null as number | null,
  height_cm: null as number | null,
  pain_scale: null as number | null,
  allergies: "",
  current_medications: "",
  medical_history: "",
};

export function ProntuarioForm({
  tenantId, professionalId, professionalName, professionalCrm,
  clients, templates,
  initialClientId, initialAppointmentId, initialTriage,
  builtInFields, editRecord,
  onSaved, onCancel,
}: Props) {
  const isEditing = !!editRecord;
  const isLocked = editRecord?.is_locked ?? false;

  const isOlderThan24h = editRecord
    ? (Date.now() - new Date(editRecord.created_at).getTime()) > 24 * 60 * 60 * 1000
    : false;
  const canEdit = isEditing ? !isLocked && !isOlderThan24h : true;

  const [clientId, setClientId] = useState(editRecord?.client_id || initialClientId || "");
  const [templateId, setTemplateId] = useState(editRecord?.template_id || "none");
  const [base, setBase] = useState(
    editRecord
      ? {
          chief_complaint: editRecord.chief_complaint,
          anamnesis: editRecord.anamnesis,
          physical_exam: editRecord.physical_exam,
          diagnosis: editRecord.diagnosis,
          cid_code: editRecord.cid_code,
          treatment_plan: editRecord.treatment_plan,
          prescriptions: editRecord.prescriptions,
          notes: editRecord.notes,
        }
      : emptyBase
  );
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(editRecord?.custom_fields ?? {});
  const [builtInCustomFields, setBuiltInCustomFields] = useState<Record<string, unknown>>({});
  const [triage, setTriage] = useState<TriageData | null>(initialTriage || null);
  const [vitals, setVitals] = useState(
    editRecord
      ? {
          blood_pressure_systolic: editRecord.blood_pressure_systolic,
          blood_pressure_diastolic: editRecord.blood_pressure_diastolic,
          heart_rate: editRecord.heart_rate,
          respiratory_rate: editRecord.respiratory_rate,
          temperature: editRecord.temperature,
          oxygen_saturation: editRecord.oxygen_saturation,
          weight_kg: editRecord.weight_kg,
          height_cm: editRecord.height_cm,
          pain_scale: editRecord.pain_scale,
          allergies: editRecord.allergies,
          current_medications: editRecord.current_medications,
          medical_history: editRecord.medical_history,
        }
      : emptyVitals
  );
  const [isSaving, setIsSaving] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const [icpMode, setIcpMode] = useState(false);
  const [icpPfxBytes, setIcpPfxBytes] = useState<Uint8Array | null>(null);
  const [icpPassword, setIcpPassword] = useState("");
  const [icpCertInfo, setIcpCertInfo] = useState<ICPCertificateInfo | null>(null);
  const [icpError, setIcpError] = useState("");

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const populateVitalsFromTriage = (t: TriageData) => {
    setVitals({
      blood_pressure_systolic: t.blood_pressure_systolic,
      blood_pressure_diastolic: t.blood_pressure_diastolic,
      heart_rate: t.heart_rate,
      respiratory_rate: t.respiratory_rate,
      temperature: t.temperature,
      oxygen_saturation: t.oxygen_saturation,
      weight_kg: t.weight_kg,
      height_cm: t.height_cm,
      pain_scale: t.pain_scale,
      allergies: t.allergies || "",
      current_medications: t.current_medications || "",
      medical_history: t.medical_history || "",
    });
  };

  useEffect(() => {
    if (initialTriage) {
      setTriage(initialTriage);
      populateVitalsFromTriage(initialTriage);
      const anamnesis = buildAnamnesisFromTriage(initialTriage);
      setBase((b) => ({
        ...b,
        chief_complaint: initialTriage.chief_complaint || b.chief_complaint,
        anamnesis: anamnesis || b.anamnesis,
      }));
    }
  }, [initialTriage]);

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  useEffect(() => {
    if (templates.length > 0 && templateId === "none") {
      const def = templates.find((t) => t.is_default);
      if (def) setTemplateId(def.id);
    }
  }, [templates, templateId]);

  const fetchTriageForClient = async (cid: string) => {
    if (!cid) { setTriage(null); return; }
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("triage_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("client_id", cid)
        .eq("status", "pendente")
        .gte("triaged_at", `${today}T00:00:00`)
        .order("triaged_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const r = data[0] as any;
        const triageData: TriageData = {
          id: r.id, priority: r.priority, triaged_at: r.triaged_at,
          performed_by: "", blood_pressure_systolic: r.blood_pressure_systolic,
          blood_pressure_diastolic: r.blood_pressure_diastolic, heart_rate: r.heart_rate,
          respiratory_rate: r.respiratory_rate, temperature: r.temperature,
          oxygen_saturation: r.oxygen_saturation, weight_kg: r.weight_kg,
          height_cm: r.height_cm, chief_complaint: r.chief_complaint,
          pain_scale: r.pain_scale, allergies: r.allergies,
          current_medications: r.current_medications, medical_history: r.medical_history,
          notes: r.notes,
        };
        setTriage(triageData);
        populateVitalsFromTriage(triageData);
        const anamnesis = buildAnamnesisFromTriage(triageData);
        setBase((b) => ({
          ...b,
          chief_complaint: r.chief_complaint || b.chief_complaint,
          anamnesis: anamnesis || b.anamnesis,
        }));
        toast.info("Dados da triagem de hoje carregados no prontuário");
      } else {
        setTriage(null);
      }
    } catch (err) {
      logger.error("Fetch triage:", err);
    }
  };

  const handleClientChange = (cid: string) => {
    setClientId(cid);
    if (!initialTriage) fetchTriageForClient(cid);
  };

  const handlePfxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIcpError("");
    try {
      const bytes = await readPfxFile(file);
      setIcpPfxBytes(bytes);
      if (icpPassword) {
        try {
          const info = parsePfxCertificateInfo(bytes, icpPassword);
          setIcpCertInfo(info);
          const warnings = validateICPCertificate(info);
          if (warnings.length > 0) setIcpError(warnings.join("; "));
        } catch (err: any) {
          setIcpCertInfo(null);
          setIcpError(err.message || "Erro ao ler certificado");
        }
      }
    } catch (err: any) {
      setIcpError(err.message || "Erro ao ler arquivo PFX");
    }
    e.target.value = "";
  };

  const handlePfxPassword = (pwd: string) => {
    setIcpPassword(pwd);
    setIcpError("");
    setIcpCertInfo(null);
    if (icpPfxBytes && pwd) {
      try {
        const info = parsePfxCertificateInfo(icpPfxBytes, pwd);
        setIcpCertInfo(info);
        const warnings = validateICPCertificate(info);
        if (warnings.length > 0) setIcpError(warnings.join("; "));
      } catch (err: any) {
        setIcpError(err.message || "Senha incorreta ou certificado inválido");
      }
    }
  };

  const buildAnamnesisFromTriage = (t: TriageData) => {
    const parts: string[] = [];

    if (t.chief_complaint) {
      parts.push(`Queixa principal: ${t.chief_complaint}${t.pain_scale != null ? ` (Dor: ${t.pain_scale}/10)` : ""}`);
    }
    if (t.medical_history) {
      parts.push(`Histórico médico: ${t.medical_history}`);
    }
    if (t.allergies) {
      parts.push(`Alergias: ${t.allergies}`);
    }
    if (t.current_medications) {
      parts.push(`Medicamentos em uso: ${t.current_medications}`);
    }

    const vitals: string[] = [];
    if (t.blood_pressure_systolic != null) vitals.push(`PA: ${t.blood_pressure_systolic}/${t.blood_pressure_diastolic} mmHg`);
    if (t.heart_rate != null) vitals.push(`FC: ${t.heart_rate} bpm`);
    if (t.temperature != null) vitals.push(`Temp: ${t.temperature}°C`);
    if (t.oxygen_saturation != null) vitals.push(`SpO₂: ${t.oxygen_saturation}%`);
    if (t.respiratory_rate != null) vitals.push(`FR: ${t.respiratory_rate} irpm`);
    if (t.weight_kg != null) vitals.push(`Peso: ${t.weight_kg} kg`);
    if (t.height_cm != null) vitals.push(`Altura: ${t.height_cm} cm`);

    if (vitals.length > 0) {
      parts.push(`Sinais vitais (triagem): ${vitals.join(" · ")}`);
    }

    if (t.notes) {
      parts.push(`Observações da triagem: ${t.notes}`);
    }

    return parts.join("\n\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error("Selecione um paciente"); return; }
    if (!base.chief_complaint.trim()) { toast.error("Queixa principal é obrigatória"); return; }
    if (isEditing && !canEdit) { toast.error("Este prontuário está bloqueado para edição"); return; }
    if (isEditing && !changeReason.trim()) { toast.error("Informe o motivo da alteração"); return; }

    setIsSaving(true);
    try {
      const signPayload = buildSignaturePayload({ ...base, ...vitals });
      let digitalHash: string;
      let signedByName = professionalName || null;
      let signedByCrm = professionalCrm || null;

      if (icpMode && icpPfxBytes && icpPassword && icpCertInfo?.isValid) {
        const icpResult = await signWithCertificate(signPayload, icpPfxBytes, icpPassword);
        digitalHash = icpResult.signature;
        signedByName = icpResult.certificate.commonName;
        signedByCrm = icpResult.certificate.cpfCnpj || professionalCrm || null;
      } else {
        digitalHash = await generateRecordHash(signPayload);
      }
      const now = new Date().toISOString();

      if (isEditing && editRecord) {
        const prevSnapshot = {
          chief_complaint: editRecord.chief_complaint,
          anamnesis: editRecord.anamnesis,
          physical_exam: editRecord.physical_exam,
          diagnosis: editRecord.diagnosis,
          cid_code: editRecord.cid_code,
          treatment_plan: editRecord.treatment_plan,
          prescriptions: editRecord.prescriptions,
          notes: editRecord.notes,
          blood_pressure_systolic: editRecord.blood_pressure_systolic,
          blood_pressure_diastolic: editRecord.blood_pressure_diastolic,
          heart_rate: editRecord.heart_rate,
          respiratory_rate: editRecord.respiratory_rate,
          temperature: editRecord.temperature,
          oxygen_saturation: editRecord.oxygen_saturation,
          weight_kg: editRecord.weight_kg,
          height_cm: editRecord.height_cm,
          pain_scale: editRecord.pain_scale,
          allergies: editRecord.allergies,
          current_medications: editRecord.current_medications,
          medical_history: editRecord.medical_history,
          digital_hash: editRecord.digital_hash,
          signed_at: editRecord.signed_at,
          signed_by_name: editRecord.signed_by_name,
          signed_by_crm: editRecord.signed_by_crm,
        };

        const { data: maxVer } = await supabase
          .from("medical_record_versions")
          .select("version_number")
          .eq("record_id", editRecord.id)
          .order("version_number", { ascending: false })
          .limit(1);
        const nextVersion = (maxVer?.[0]?.version_number ?? 0) + 1;

        await supabase.from("medical_record_versions").insert({
          record_id: editRecord.id,
          tenant_id: tenantId,
          version_number: nextVersion,
          changed_by: professionalId,
          change_reason: changeReason,
          snapshot: prevSnapshot as any,
          digital_hash: editRecord.digital_hash,
        });

        const { error } = await supabase.from("medical_records").update({
          chief_complaint: base.chief_complaint,
          anamnesis: base.anamnesis || null,
          physical_exam: base.physical_exam || null,
          diagnosis: base.diagnosis || null,
          cid_code: base.cid_code || null,
          treatment_plan: base.treatment_plan || null,
          prescriptions: base.prescriptions || null,
          notes: base.notes || null,
          blood_pressure_systolic: vitals.blood_pressure_systolic,
          blood_pressure_diastolic: vitals.blood_pressure_diastolic,
          heart_rate: vitals.heart_rate,
          respiratory_rate: vitals.respiratory_rate,
          temperature: vitals.temperature,
          oxygen_saturation: vitals.oxygen_saturation,
          weight_kg: vitals.weight_kg,
          height_cm: vitals.height_cm,
          pain_scale: vitals.pain_scale,
          allergies: vitals.allergies || null,
          current_medications: vitals.current_medications || null,
          medical_history: vitals.medical_history || null,
          digital_hash: digitalHash,
          signed_at: now,
          signed_by_name: signedByName,
          signed_by_crm: signedByCrm,
        }).eq("id", editRecord.id);
        if (error) throw error;
        toast.success("Prontuário atualizado! Versão anterior salva no histórico.");
      } else {
        const { error } = await supabase.from("medical_records").insert({
          tenant_id: tenantId,
          professional_id: professionalId,
          client_id: clientId,
          appointment_id: initialAppointmentId || null,
          triage_id: triage?.id || null,
          template_id: templateId && templateId !== "none" ? templateId : null,
          chief_complaint: base.chief_complaint,
          anamnesis: base.anamnesis || null,
          physical_exam: base.physical_exam || null,
          diagnosis: base.diagnosis || null,
          cid_code: base.cid_code || null,
          treatment_plan: base.treatment_plan || null,
          prescriptions: base.prescriptions || null,
          notes: base.notes || null,
          blood_pressure_systolic: vitals.blood_pressure_systolic,
          blood_pressure_diastolic: vitals.blood_pressure_diastolic,
          heart_rate: vitals.heart_rate,
          respiratory_rate: vitals.respiratory_rate,
          temperature: vitals.temperature,
          oxygen_saturation: vitals.oxygen_saturation,
          weight_kg: vitals.weight_kg,
          height_cm: vitals.height_cm,
          pain_scale: vitals.pain_scale,
          allergies: vitals.allergies || null,
          current_medications: vitals.current_medications || null,
          medical_history: vitals.medical_history || null,
          digital_hash: digitalHash,
          signed_at: now,
          signed_by_name: signedByName,
          signed_by_crm: signedByCrm,
          custom_fields: Object.keys(customFields).length > 0 || Object.keys(builtInCustomFields).length > 0
            ? { ...builtInCustomFields, ...customFields }
            : {},
        });
        if (error) throw error;
        if (triage?.id) {
          await supabase.from("triage_records").update({ status: "concluida" }).eq("id", triage.id);
        }
        toast.success("Prontuário salvo com sucesso!");
      }
      onSaved();
    } catch (err) {
      logger.error("Save record:", err);
      toast.error("Erro ao salvar prontuário");
    } finally {
      setIsSaving(false);
    }
  };

  const set = (k: keyof typeof emptyBase, v: string) => setBase((b) => ({ ...b, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {canEdit && (
          <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Salvar Prontuário"}
          </Button>
        )}
      </div>

      {isEditing && !canEdit && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Prontuário bloqueado para edição</p>
            <p className="text-xs text-amber-600">
              {isLocked
                ? `Motivo: ${editRecord?.lock_reason || "Bloqueado pelo sistema"}`
                : "Prontuários só podem ser editados nas primeiras 24 horas após a criação."}
            </p>
          </div>
        </div>
      )}

      {isEditing && editRecord?.digital_hash && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-2 flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-success shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Assinado digitalmente</span>
            {editRecord.signed_by_name && <> por {editRecord.signed_by_name}</>}
            {editRecord.signed_at && <> em {new Date(editRecord.signed_at).toLocaleString("pt-BR")}</>}
          </div>
        </div>
      )}

      {isEditing && canEdit && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 space-y-2">
          <Label className="text-sm font-semibold text-blue-700">Motivo da Alteração *</Label>
          <Input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Descreva o motivo da edição (obrigatório para audit trail)..."
            className="border-blue-500/20"
          />
          <p className="text-xs text-blue-600">A versão anterior será salva automaticamente no histórico.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Paciente *</Label>
          <Select value={clientId || undefined} onValueChange={handleClientChange}>
            <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Modelo de Prontuário</Label>
          <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setCustomFields({}); }}>
            <SelectTrigger><SelectValue placeholder="Modelo padrão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem modelo (campos base)</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.is_default ? " (Padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {triage && <TriageContextCard triage={triage} />}

      {/* Sinais Vitais Estruturados */}
      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-500" />
          Sinais Vitais
          {triage && <span className="text-xs font-normal text-muted-foreground">(pré-preenchidos da triagem — editáveis)</span>}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Heart className="h-3 w-3 text-red-500" />PA (mmHg)</Label>
            <div className="flex gap-1">
              <Input type="number" placeholder="Sis" value={vitals.blood_pressure_systolic ?? ""}
                onChange={(e) => setVitals((v) => ({ ...v, blood_pressure_systolic: e.target.value ? +e.target.value : null }))}
                className="text-center text-sm" />
              <span className="self-center text-muted-foreground">/</span>
              <Input type="number" placeholder="Dia" value={vitals.blood_pressure_diastolic ?? ""}
                onChange={(e) => setVitals((v) => ({ ...v, blood_pressure_diastolic: e.target.value ? +e.target.value : null }))}
                className="text-center text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Activity className="h-3 w-3 text-pink-500" />FC (bpm)</Label>
            <Input type="number" placeholder="72" value={vitals.heart_rate ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, heart_rate: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3 text-orange-500" />Temp (°C)</Label>
            <Input type="number" step="0.1" placeholder="36.5" value={vitals.temperature ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, temperature: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Wind className="h-3 w-3 text-blue-500" />SpO₂ (%)</Label>
            <Input type="number" placeholder="98" value={vitals.oxygen_saturation ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, oxygen_saturation: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Wind className="h-3 w-3 text-teal-500" />FR (irpm)</Label>
            <Input type="number" placeholder="18" value={vitals.respiratory_rate ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, respiratory_rate: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3 text-purple-500" />Peso (kg)</Label>
            <Input type="number" step="0.1" placeholder="70.0" value={vitals.weight_kg ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, weight_kg: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Ruler className="h-3 w-3 text-indigo-500" />Altura (cm)</Label>
            <Input type="number" placeholder="170" value={vitals.height_cm ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, height_cm: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dor (0-10)</Label>
            <Input type="number" min={0} max={10} placeholder="0" value={vitals.pain_scale ?? ""}
              onChange={(e) => setVitals((v) => ({ ...v, pain_scale: e.target.value ? +e.target.value : null }))}
              className="text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-destructive font-medium">Alergias</Label>
            <Input value={vitals.allergies} onChange={(e) => setVitals((v) => ({ ...v, allergies: e.target.value }))}
              placeholder="Penicilina, AAS..." className="text-sm border-destructive/30" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Medicamentos em Uso</Label>
            <Input value={vitals.current_medications} onChange={(e) => setVitals((v) => ({ ...v, current_medications: e.target.value }))}
              placeholder="Losartana 50mg, Metformina..." className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Histórico Médico</Label>
            <Input value={vitals.medical_history} onChange={(e) => setVitals((v) => ({ ...v, medical_history: e.target.value }))}
              placeholder="HAS, DM2..." className="text-sm" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Queixa Principal *</Label>
          <Input value={base.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} placeholder="Motivo da consulta..." />
        </div>
        <div className="space-y-1.5">
          <Label>Anamnese</Label>
          <Textarea value={base.anamnesis} onChange={(e) => set("anamnesis", e.target.value)} placeholder="HDA, antecedentes..." rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Exame Físico</Label>
          <Textarea value={base.physical_exam} onChange={(e) => set("physical_exam", e.target.value)} placeholder="PA, FC, achados..." rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Diagnóstico</Label>
            <Input value={base.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="Diagnóstico clínico" />
          </div>
          <div className="space-y-1.5">
            <Label>CID-10</Label>
            <Cid10Combobox value={base.cid_code} onChange={(code) => set("cid_code", code)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Plano Terapêutico / Conduta</Label>
          <Textarea value={base.treatment_plan} onChange={(e) => set("treatment_plan", e.target.value)} placeholder="Orientações, encaminhamentos..." rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Prescrições</Label>
          <Textarea value={base.prescriptions} onChange={(e) => set("prescriptions", e.target.value)} placeholder="Medicamentos, posologia..." rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={base.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notas internas..." rows={2} />
        </div>
      </div>

      {builtInFields && builtInFields.length > 0 && (
        <DynamicFieldsRenderer fields={builtInFields} values={builtInCustomFields} onChange={setBuiltInCustomFields} />
      )}

      {selectedTemplate && selectedTemplate.fields.length > 0 && (
        <DynamicFieldsRenderer fields={selectedTemplate.fields} values={customFields} onChange={setCustomFields} />
      )}

      {/* Assinatura ICP-Brasil (Certificado Digital A1) */}
      {canEdit && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileKey className="h-4 w-4 text-primary" />
              Assinatura Digital
            </h4>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={icpMode} onChange={(e) => setIcpMode(e.target.checked)} className="rounded" />
              Usar Certificado ICP-Brasil A1
            </label>
          </div>
          {!icpMode && (
            <p className="text-xs text-muted-foreground">O prontuário será assinado com hash SHA-256 padrão. Ative o certificado digital para assinatura com validade jurídica ICP-Brasil.</p>
          )}
          {icpMode && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Arquivo .pfx / .p12</Label>
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("pfx-upload")?.click()}>
                      <Upload className="mr-2 h-3.5 w-3.5" />{icpPfxBytes ? "Trocar certificado" : "Selecionar certificado"}
                    </Button>
                    <input id="pfx-upload" type="file" accept=".pfx,.p12" className="hidden" onChange={handlePfxUpload} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Senha do certificado</Label>
                  <Input type="password" value={icpPassword} onChange={(e) => handlePfxPassword(e.target.value)} placeholder="Senha do .pfx" className="text-sm" />
                </div>
              </div>
              {icpError && (
                <p className="text-xs text-destructive">{icpError}</p>
              )}
              {icpCertInfo && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p><span className="font-medium">Titular:</span> {icpCertInfo.commonName}</p>
                  {icpCertInfo.cpfCnpj && <p><span className="font-medium">CPF/CNPJ:</span> {icpCertInfo.cpfCnpj}</p>}
                  <p><span className="font-medium">Emissor:</span> {icpCertInfo.issuer}</p>
                  <p><span className="font-medium">Validade:</span> {icpCertInfo.notBefore.toLocaleDateString("pt-BR")} a {icpCertInfo.notAfter.toLocaleDateString("pt-BR")}
                    {icpCertInfo.isValid
                      ? <Badge variant="outline" className="ml-2 text-[10px] text-success border-success/30">Válido ({icpCertInfo.daysUntilExpiry}d)</Badge>
                      : <Badge variant="outline" className="ml-2 text-[10px] text-destructive border-destructive/30">Expirado</Badge>
                    }
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">Serial: {icpCertInfo.serialNumber}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        {canEdit && (
          <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Salvar Prontuário"}
          </Button>
        )}
      </div>
    </form>
  );
}
