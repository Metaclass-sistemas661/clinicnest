import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, ArrowLeft, Heart, Activity, Thermometer, Wind, Weight, Ruler, Lock, ShieldCheck, Upload, FileKey, Settings } from "lucide-react";
import { TriageContextCard, type TriageData } from "./TriageContextCard";
import { DynamicFieldsRenderer, type TemplateField } from "./DynamicFieldsRenderer";
import { Cid10Combobox } from "@/components/ui/cid10-combobox";
import { generateRecordHash, buildSignaturePayload } from "@/lib/digital-signature";
import { readPfxFile, parsePfxCertificateInfo, signWithCertificate, validateICPCertificate, type ICPCertificateInfo } from "@/lib/icp-brasil-signature";
import { useCertificateSign } from "@/hooks/useCertificateSign";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { AiDrugInteractionAlert } from "@/components/ai";
import { VoiceFirstDictation } from "@/components/ai/VoiceFirstDictation";
import { PatientPromsViewer } from "@/components/prontuario/PatientPromsViewer";
import { AiSmartReferral } from "@/components/ai/AiSmartReferral";
import { ExamOcrAnalyzer } from "@/components/prontuario/ExamOcrAnalyzer";
import { ProfessionFields } from "@/components/prontuario/ProfessionFields";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { CopilotInput } from "@/components/ai";
import { ReturnSelector, defaultReturnConfig, type ReturnConfig } from "./ReturnSelector";
import { suggestReturn, suggestReturnMultiple, formatSuggestion, type ReturnSuggestion } from "@/lib/cid-return-suggestion";
import { CalendarClock, Lightbulb } from "lucide-react";
import { useCopilotProntuario } from "@/contexts/CopilotProntuarioContext";

interface Template {
  id: string;
  name: string;
  specialty_id: string | null;
  fields: TemplateField[];
  is_default: boolean;
}

interface PatientOption { id: string; name: string; }

export interface EditableRecord {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  triage_id?: string | null;
  template_id?: string | null;
  attendance_type?: string | null;
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
  return_days?: number | null;
  return_reason?: string | null;
  custom_fields?: Record<string, unknown>;
}

interface Props {
  tenantId: string;
  professionalId: string;
  professionalName?: string;
  professionalCrm?: string;
  patients: PatientOption[];
  templates: Template[];
  initialPatientId?: string;
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
  patients, templates,
  initialPatientId, initialAppointmentId, initialTriage,
  builtInFields, editRecord,
  onSaved, onCancel,
}: Props) {
  const isEditing = !!editRecord;
  const isLocked = editRecord?.is_locked ?? false;

  const isOlderThan24h = editRecord
    ? (Date.now() - new Date(editRecord.created_at).getTime()) > 24 * 60 * 60 * 1000
    : false;
  const canEdit = isEditing ? !isLocked && !isOlderThan24h : true;

  const { isPrescriber, professionalType } = usePermissions();
  const isPsychologist = professionalType === "psicologo";
  const isNurseType = professionalType === "enfermeiro" || professionalType === "tec_enfermagem";
  const accordionDefaults = useMemo(() => {
    const s = ["clinico"];
    if (isPrescriber) s.push("prescricao");
    if (isNurseType) s.push("vitais");
    return s;
  }, [isPrescriber, isNurseType]);

  const [patientId, setPatientId] = useState(editRecord?.patient_id || initialPatientId || "");
  const [templateId, setTemplateId] = useState(editRecord?.template_id || "none");
  const [attendanceType, setAttendanceType] = useState(editRecord?.attendance_type || "consulta");
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
  const [professionFields, setProfessionFields] = useState<Record<string, string>>(() => {
    const cf = editRecord?.custom_fields ?? {};
    const pf = cf._profession as Record<string, string> | undefined;
    return pf ?? {};
  });
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

  // ── Retorno do paciente ──
  const [returnConfig, setReturnConfig] = useState<ReturnConfig>(
    editRecord?.return_days
      ? {
          returnDays: editRecord.return_days,
          reason: editRecord.return_reason || "",
          notifyPatient: true,
          notifyDaysBefore: 3,
          preferredContact: "whatsapp",
          preSchedule: false,
        }
      : defaultReturnConfig
  );
  const [cidSuggestion, setCidSuggestion] = useState<ReturnSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const [icpMode, setIcpMode] = useState(false);
  const [icpPassword, setIcpPassword] = useState("");
  const [icpError, setIcpError] = useState("");

  // Hook para certificado cadastrado no banco
  const { state: certState, hasCertificate, checkCertificate, signData: signWithStoredCert } = useCertificateSign();

  // Fallback: upload manual (caso não tenha certificado cadastrado)
  const [icpManualMode, setIcpManualMode] = useState(false);
  const [icpPfxBytes, setIcpPfxBytes] = useState<Uint8Array | null>(null);
  const [icpCertInfo, setIcpCertInfo] = useState<ICPCertificateInfo | null>(null);

  // ── Auto-sugestão de retorno baseada no CID ──
  useEffect(() => {
    if (!base.cid_code || base.cid_code.length < 2) {
      setCidSuggestion(null);
      return;
    }
    // Support multiple CIDs (comma or semicolon separated)
    const codes = base.cid_code.split(/[,;\s]+/).map(c => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      setCidSuggestion(null);
      return;
    }
    const suggestion = codes.length === 1 ? suggestReturn(codes[0]) : suggestReturnMultiple(codes);
    setCidSuggestion(suggestion);
    setSuggestionDismissed(false);
  }, [base.cid_code]);

  // Ao ativar icpMode, verificar se há certificado cadastrado
  const handleIcpToggle = useCallback(async (checked: boolean) => {
    setIcpMode(checked);
    setIcpError("");
    setIcpManualMode(false);
    if (checked) {
      const found = await checkCertificate();
      if (!found) {
        // Sem certificado cadastrado — modo manual
        setIcpManualMode(true);
      }
    }
  }, [checkCertificate]);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const copilotInput: CopilotInput = {
    chief_complaint: base.chief_complaint || undefined,
    anamnesis: base.anamnesis || undefined,
    physical_exam: base.physical_exam || undefined,
    diagnosis: base.diagnosis || undefined,
    cid_code: base.cid_code || undefined,
    treatment_plan: base.treatment_plan || undefined,
    prescriptions: base.prescriptions || undefined,
    allergies: vitals.allergies || undefined,
    current_medications: vitals.current_medications || undefined,
    medical_history: vitals.medical_history || undefined,
    vitals: {
      blood_pressure_systolic: vitals.blood_pressure_systolic,
      blood_pressure_diastolic: vitals.blood_pressure_diastolic,
      heart_rate: vitals.heart_rate,
      temperature: vitals.temperature,
      oxygen_saturation: vitals.oxygen_saturation,
    },
  };

  // ── Copilot Clínico via Right Sidebar ──
  const { register, updateInput, unregister } = useCopilotProntuario();

  useEffect(() => {
    if (!canEdit) return;
    const callbacks = {
      onSelectCid: (code: string, description: string) => {
        set("cid_code", code);
        set("diagnosis", description);
      },
      onAppendPrescription: (text: string) => {
        setBase((b) => ({ ...b, prescriptions: b.prescriptions ? b.prescriptions + "\n" + text : text }));
      },
      onAppendPlan: (text: string) => {
        setBase((b) => ({ ...b, treatment_plan: b.treatment_plan ? b.treatment_plan + "\n" + text : text }));
      },
    };
    register(copilotInput, callbacks);
    return () => unregister();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canEdit) updateInput(copilotInput);
  }, [base, vitals]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

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
        .eq("patient_id", cid)
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

  const handlePatientChange = (cid: string) => {
    setPatientId(cid);
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
    if (!patientId) { toast.error("Selecione um paciente"); return; }
    if (!base.chief_complaint.trim()) { toast.error("Queixa principal é obrigatória"); return; }
    if (isEditing && !canEdit) { toast.error("Este prontuário está bloqueado para edição"); return; }
    if (isEditing && !changeReason.trim()) { toast.error("Informe o motivo da alteração"); return; }

    setIsSaving(true);
    try {
      const signPayload = buildSignaturePayload({ ...base, ...vitals });
      let digitalHash: string;
      let signedByName: string | null = null;
      let signedByCrm: string | null = null;
      let signedAt: string | null = null;

      if (icpMode && hasCertificate && icpPassword && !icpManualMode) {
        // Assinar com certificado salvo no banco
        const icpResult = await signWithStoredCert(signPayload, icpPassword);
        if (!icpResult) throw new Error("Falha na assinatura digital");
        digitalHash = icpResult.signature;
        signedByName = icpResult.certificate.commonName;
        signedByCrm = icpResult.certificate.cpfCnpj || professionalCrm || null;
        signedAt = new Date().toISOString();
      } else if (icpMode && icpManualMode && icpPfxBytes && icpPassword && icpCertInfo?.isValid) {
        // Fallback: assinar com certificado manual (upload)
        const icpResult = await signWithCertificate(signPayload, icpPfxBytes, icpPassword);
        digitalHash = icpResult.signature;
        signedByName = icpResult.certificate.commonName;
        signedByCrm = icpResult.certificate.cpfCnpj || professionalCrm || null;
        signedAt = new Date().toISOString();
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
          signed_at: signedAt,
          signed_by_name: signedByName,
          signed_by_crm: signedByCrm,
          return_days: returnConfig.returnDays || null,
          return_reason: returnConfig.reason || null,
        }).eq("id", editRecord.id);
        if (error) throw error;

        // ── Criar/atualizar lembrete de retorno na edição ──
        if (returnConfig.returnDays && editRecord.id) {
          try {
            await supabase.rpc("create_return_reminder", {
              p_medical_record_id: editRecord.id,
              p_return_days: returnConfig.returnDays,
              p_reason: returnConfig.reason || null,
              p_notify_patient: returnConfig.notifyPatient,
              p_notify_days_before: returnConfig.notifyDaysBefore,
              p_preferred_contact: returnConfig.preferredContact,
              p_pre_schedule: returnConfig.preSchedule,
              p_service_id: null,
            });
          } catch (retErr) {
            logger.error("Update return reminder:", retErr);
          }
        }

        toast.success("Prontuário atualizado! Versão anterior salva no histórico.");
      } else {
        const { data: insertedData, error } = await supabase.from("medical_records").insert({
          tenant_id: tenantId,
          professional_id: professionalId,
          patient_id: patientId,
          appointment_id: initialAppointmentId || null,
          triage_id: triage?.id || null,
          template_id: templateId && templateId !== "none" ? templateId : null,
          attendance_type: attendanceType || "consulta",
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
          signed_at: signedAt,
          signed_by_name: signedByName,
          signed_by_crm: signedByCrm,
          return_days: returnConfig.returnDays || null,
          return_reason: returnConfig.reason || null,
          custom_fields: Object.keys(customFields).length > 0 || Object.keys(builtInCustomFields).length > 0 || Object.keys(professionFields).length > 0
            ? { ...builtInCustomFields, ...customFields, _profession: professionFields }
            : {},
        }).select("id").single();
        if (error) throw error;

        // ── Criar lembrete de retorno se configurado ──
        if (returnConfig.returnDays && insertedData?.id) {
          try {
            await supabase.rpc("create_return_reminder", {
              p_medical_record_id: insertedData.id,
              p_return_days: returnConfig.returnDays,
              p_reason: returnConfig.reason || null,
              p_notify_patient: returnConfig.notifyPatient,
              p_notify_days_before: returnConfig.notifyDaysBefore,
              p_preferred_contact: returnConfig.preferredContact,
              p_pre_schedule: returnConfig.preSchedule,
              p_service_id: null,
            });
            toast.success(`Retorno em ${returnConfig.returnDays} dias registrado!`, { duration: 4000 });
          } catch (retErr) {
            logger.error("Create return reminder:", retErr);
            toast.warning("Prontuário salvo, mas houve erro ao criar lembrete de retorno.");
          }
        }

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
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button type="submit" disabled={isSaving} variant="gradient">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Salvar Prontuário"}
            </Button>
          )}
        </div>
      </div>

      {isEditing && !canEdit && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <Lock className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Prontuário bloqueado para edição</p>
            <p className="text-xs text-warning">
              {isLocked
                ? `Motivo: ${editRecord?.lock_reason || "Bloqueado pelo sistema"}`
                : "Prontuários só podem ser editados nas primeiras 24 horas após a criação."}
            </p>
          </div>
        </div>
      )}

      {isEditing && editRecord?.signed_at && (
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
        <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 space-y-2">
          <Label className="text-sm font-semibold text-info">Motivo da Alteração *</Label>
          <Input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Descreva o motivo da edição (obrigatório para audit trail)..."
            className="border-info/20"
          />
          <p className="text-xs text-info">A versão anterior será salva automaticamente no histórico.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Paciente *</Label>
          <Select value={patientId || undefined} onValueChange={handlePatientChange}>
            <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
            <SelectContent>
              {patients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de Atendimento</Label>
          <Select value={attendanceType} onValueChange={setAttendanceType}>
            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consulta">Consulta</SelectItem>
              <SelectItem value="retorno">Retorno</SelectItem>
              <SelectItem value="urgencia">Urgência</SelectItem>
              <SelectItem value="emergencia">Emergência</SelectItem>
              <SelectItem value="procedimento">Procedimento</SelectItem>
              <SelectItem value="exame">Exame</SelectItem>
              <SelectItem value="teleconsulta">Teleconsulta</SelectItem>
              <SelectItem value="domiciliar">Domiciliar</SelectItem>
              <SelectItem value="preventivo">Preventivo</SelectItem>
              <SelectItem value="pre_operatorio">Pré-operatório</SelectItem>
              <SelectItem value="pos_operatorio">Pós-operatório</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
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

      {/* Voice-first dictation (acima do accordion para acesso rápido) */}
      {canEdit && (
        <FeatureGate feature="aiTranscribe" showUpgradePrompt={false}>
          <VoiceFirstDictation
            onSoapReady={(soap) => {
              setBase((b) => ({
                ...b,
                chief_complaint: soap.chief_complaint || b.chief_complaint,
                anamnesis: soap.anamnesis || b.anamnesis,
                physical_exam: soap.physical_exam || b.physical_exam,
                diagnosis: soap.diagnosis || b.diagnosis,
                treatment_plan: soap.treatment_plan || b.treatment_plan,
              }));
              if (soap.cid_code) set("cid_code", soap.cid_code);
            }}
            disabled={!canEdit}
            className="mb-2"
          />
        </FeatureGate>
      )}

      <Accordion type="multiple" defaultValue={accordionDefaults} className="space-y-2">
        {/* ── Sinais Vitais (simplificado para psicólogo: só peso/altura) ── */}
        <AccordionItem value="vitais" className="rounded-xl border bg-muted/20 px-4">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-destructive" />
              Sinais Vitais
              {triage && <span className="text-xs font-normal text-muted-foreground">(pré-preenchidos da triagem)</span>}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3 text-chart-4" />Peso (kg)</Label>
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
              {!isPsychologist && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Heart className="h-3 w-3 text-destructive" />PA (mmHg)</Label>
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
                    <Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3 text-chart-5" />Temp (°C)</Label>
                    <Input type="number" step="0.1" placeholder="36.5" value={vitals.temperature ?? ""}
                      onChange={(e) => setVitals((v) => ({ ...v, temperature: e.target.value ? +e.target.value : null }))}
                      className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Wind className="h-3 w-3 text-info" />SpO₂ (%)</Label>
                    <Input type="number" placeholder="98" value={vitals.oxygen_saturation ?? ""}
                      onChange={(e) => setVitals((v) => ({ ...v, oxygen_saturation: e.target.value ? +e.target.value : null }))}
                      className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Wind className="h-3 w-3 text-primary" />FR (irpm)</Label>
                    <Input type="number" placeholder="18" value={vitals.respiratory_rate ?? ""}
                      onChange={(e) => setVitals((v) => ({ ...v, respiratory_rate: e.target.value ? +e.target.value : null }))}
                      className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dor (0-10)</Label>
                    <Input type="number" min={0} max={10} placeholder="0" value={vitals.pain_scale ?? ""}
                      onChange={(e) => setVitals((v) => ({ ...v, pain_scale: e.target.value ? +e.target.value : null }))}
                      className="text-sm" />
                  </div>
                </>
              )}
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
          </AccordionContent>
        </AccordionItem>

        {/* ── Campos Clínicos ── */}
        <AccordionItem value="clinico" className="rounded-xl border px-4">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Avaliação Clínica
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {/* PROMs */}
            {patientId && <PatientPromsViewer patientId={patientId} />}

            <div className="space-y-1.5">
              <Label>Queixa Principal *</Label>
              <Input value={base.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} placeholder="Motivo da consulta..." />
            </div>
            <div className="space-y-1.5">
              <Label>Anamnese</Label>
              <Textarea value={base.anamnesis} onChange={(e) => set("anamnesis", e.target.value)} placeholder="HDA, antecedentes..." rows={3} />
            </div>
            {/* Exame Físico — oculto para psicólogo */}
            {!isPsychologist && (
              <div className="space-y-1.5">
                <Label>Exame Físico</Label>
                <Textarea value={base.physical_exam} onChange={(e) => set("physical_exam", e.target.value)} placeholder="PA, FC, achados..." rows={3} />
              </div>
            )}
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

            {/* Encaminhamento Inteligente */}
            {canEdit && (base.diagnosis || base.chief_complaint) && (
              <FeatureGate feature="aiCopilot" showUpgradePrompt={false}>
                <AiSmartReferral
                  chiefComplaint={base.chief_complaint}
                  diagnosis={base.diagnosis}
                  treatmentPlan={base.treatment_plan}
                  cidCode={base.cid_code}
                  patientName={patients?.find((p) => p.id === patientId)?.name}
                  allergies={vitals.allergies}
                />
              </FeatureGate>
            )}

            {/* Campos específicos da profissão */}
            <ProfessionFields
              professionalType={professionalType}
              values={professionFields}
              onChange={(k, v) => setProfessionFields(prev => ({ ...prev, [k]: v }))}
              disabled={!canEdit}
            />

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={base.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notas internas..." rows={2} />
            </div>

            {/* OCR de Exames */}
            {canEdit && (
              <FeatureGate feature="aiCopilot" showUpgradePrompt={false}>
                <ExamOcrAnalyzer patientId={patientId} />
              </FeatureGate>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Prescrições — apenas prescritores (médico/dentista) ── */}
        {isPrescriber && (
          <AccordionItem value="prescricao" className="rounded-xl border px-4">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-warning" />
                Prescrições
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="space-y-1.5">
                <Textarea value={base.prescriptions} onChange={(e) => set("prescriptions", e.target.value)} placeholder="Medicamentos, posologia..." rows={3} />
                <AiDrugInteractionAlert
                  prescriptions={base.prescriptions}
                  currentMedications={vitals.current_medications}
                  allergies={vitals.allergies}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* ── Retorno do Paciente ── */}
      {canEdit && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Retorno do Paciente</h4>
          </div>

          {/* Sugestão automática baseada no CID */}
          {cidSuggestion && !suggestionDismissed && !returnConfig.returnDays && (
            <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-3">
              <Lightbulb className="h-4 w-4 text-info mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-info">
                  Sugestão de retorno (CID {cidSuggestion.cid_code})
                </p>
                <p className="text-xs text-info/80">
                  {formatSuggestion(cidSuggestion)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={() => {
                      setReturnConfig({
                        ...returnConfig,
                        returnDays: cidSuggestion.suggested_days_min,
                        reason: cidSuggestion.reason,
                      });
                      setSuggestionDismissed(true);
                    }}
                  >
                    Aceitar {cidSuggestion.suggested_days_min} dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setReturnConfig({
                        ...returnConfig,
                        returnDays: cidSuggestion.suggested_days_max,
                        reason: cidSuggestion.reason,
                      });
                      setSuggestionDismissed(true);
                    }}
                  >
                    Aceitar {cidSuggestion.suggested_days_max} dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setSuggestionDismissed(true)}
                  >
                    Dispensar
                  </Button>
                </div>
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${
                cidSuggestion.priority === "alta" ? "border-destructive/30 text-destructive" :
                cidSuggestion.priority === "media" ? "border-warning/30 text-warning" :
                "border-success/30 text-success"
              }`}>
                Prioridade {cidSuggestion.priority}
              </Badge>
            </div>
          )}

          <ReturnSelector
            value={returnConfig}
            onChange={setReturnConfig}
            disabled={!canEdit}
          />
        </div>
      )}

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
              <input type="checkbox" checked={icpMode} onChange={(e) => handleIcpToggle(e.target.checked)} className="rounded" />
              Usar Certificado ICP-Brasil A1
            </label>
          </div>
          {!icpMode && (
            <p className="text-xs text-muted-foreground">O prontuário será assinado com hash SHA-256 padrão. Ative o certificado digital para assinatura com validade jurídica ICP-Brasil.</p>
          )}
          {icpMode && certState.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Spinner size="sm" />
              Buscando certificado cadastrado...
            </div>
          )}
          {icpMode && !certState.isLoading && hasCertificate && !icpManualMode && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium text-success">Certificado cadastrado encontrado</span>
                </div>
                <p><span className="font-medium">Titular:</span> {certState.certificate?.common_name}</p>
                {certState.certificate?.cpf_cnpj && <p><span className="font-medium">CPF/CNPJ:</span> {certState.certificate.cpf_cnpj}</p>}
                <p><span className="font-medium">Emissor:</span> {certState.certificate?.issuer}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Senha do certificado</Label>
                <Input type="password" value={icpPassword} onChange={(e) => setIcpPassword(e.target.value)} placeholder="Digite a senha do certificado" className="text-sm" />
              </div>
              {icpError && <p className="text-xs text-destructive">{icpError}</p>}
            </div>
          )}
          {icpMode && !certState.isLoading && icpManualMode && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs space-y-2">
                <p className="text-amber-800">
                  Nenhum certificado cadastrado. Você pode <a href="/configuracoes" className="underline font-medium inline-flex items-center gap-0.5"><Settings className="h-3 w-3" />cadastrar em Configurações</a> para não precisar importar toda vez, ou importar manualmente abaixo:
                </p>
              </div>
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
          <Button type="submit" disabled={isSaving} variant="gradient">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Salvar Prontuário"}
          </Button>
        )}
      </div>
    </form>
  );
}
