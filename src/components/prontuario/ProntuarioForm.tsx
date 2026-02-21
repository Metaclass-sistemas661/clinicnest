import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, ArrowLeft } from "lucide-react";
import { TriageContextCard, type TriageData } from "./TriageContextCard";
import { DynamicFieldsRenderer, type TemplateField } from "./DynamicFieldsRenderer";
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

interface Props {
  tenantId: string;
  professionalId: string;
  clients: Client[];
  templates: Template[];
  initialClientId?: string;
  initialAppointmentId?: string;
  initialTriage?: TriageData | null;
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

export function ProntuarioForm({
  tenantId, professionalId, clients, templates,
  initialClientId, initialAppointmentId, initialTriage,
  onSaved, onCancel,
}: Props) {
  const [clientId, setClientId] = useState(initialClientId || "");
  const [templateId, setTemplateId] = useState("");
  const [base, setBase] = useState(emptyBase);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [triage, setTriage] = useState<TriageData | null>(initialTriage || null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (initialTriage) {
      setTriage(initialTriage);
      if (initialTriage.chief_complaint) {
        setBase((b) => ({ ...b, chief_complaint: initialTriage.chief_complaint }));
      }
    }
  }, [initialTriage]);

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  useEffect(() => {
    if (templates.length > 0 && !templateId) {
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
        setTriage({
          id: r.id, priority: r.priority, triaged_at: r.triaged_at,
          performed_by: "", blood_pressure_systolic: r.blood_pressure_systolic,
          blood_pressure_diastolic: r.blood_pressure_diastolic, heart_rate: r.heart_rate,
          respiratory_rate: r.respiratory_rate, temperature: r.temperature,
          oxygen_saturation: r.oxygen_saturation, weight_kg: r.weight_kg,
          height_cm: r.height_cm, chief_complaint: r.chief_complaint,
          pain_scale: r.pain_scale, allergies: r.allergies,
          current_medications: r.current_medications, medical_history: r.medical_history,
          notes: r.notes,
        });
        if (r.chief_complaint) {
          setBase((b) => ({ ...b, chief_complaint: r.chief_complaint }));
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error("Selecione um paciente"); return; }
    if (!base.chief_complaint.trim()) { toast.error("Queixa principal é obrigatória"); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        tenant_id: tenantId,
        professional_id: professionalId,
        client_id: clientId,
        appointment_id: initialAppointmentId || null,
        triage_id: triage?.id || null,
        template_id: templateId || null,
        chief_complaint: base.chief_complaint,
        anamnesis: base.anamnesis || null,
        physical_exam: base.physical_exam || null,
        diagnosis: base.diagnosis || null,
        cid_code: base.cid_code || null,
        treatment_plan: base.treatment_plan || null,
        prescriptions: base.prescriptions || null,
        notes: base.notes || null,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      });
      if (error) throw error;
      if (triage?.id) {
        await supabase.from("triage_records").update({ status: "concluida" }).eq("id", triage.id);
      }
      toast.success("Prontuário salvo com sucesso!");
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
        <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Prontuário"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Paciente *</Label>
          <Select value={clientId} onValueChange={handleClientChange}>
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
              <SelectItem value="">Sem modelo (campos base)</SelectItem>
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
            <Input value={base.cid_code} onChange={(e) => set("cid_code", e.target.value.toUpperCase())} placeholder="Ex: J06.9" className="font-mono" />
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

      {selectedTemplate && selectedTemplate.fields.length > 0 && (
        <DynamicFieldsRenderer fields={selectedTemplate.fields} values={customFields} onChange={setCustomFields} />
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Prontuário"}
        </Button>
      </div>
    </form>
  );
}
