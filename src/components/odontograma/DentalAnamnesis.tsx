/**
 * DentalAnamnesis — Questionário de anamnese odontológica (F12)
 *
 * Coleta dados clínicos pré-avaliação: bruxismo, tabagismo, medicamentos,
 * alergias, última visita, higiene, gestação, etc.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface AnamnesisData {
  bruxism: boolean;
  smoking: boolean;
  smoking_frequency?: string;
  diabetes: boolean;
  diabetes_type?: string;
  hypertension: boolean;
  pregnancy: boolean;
  pregnancy_weeks?: number;
  allergies: string;
  medications: string;
  last_dental_visit: string;
  oral_hygiene: "good" | "regular" | "poor";
  brushing_frequency: string;
  flossing: boolean;
  mouthwash: boolean;
  previous_surgeries: string;
  bleeding_gums: boolean;
  tooth_sensitivity: boolean;
  jaw_pain: boolean;
  notes: string;
}

const INITIAL: AnamnesisData = {
  bruxism: false,
  smoking: false,
  diabetes: false,
  hypertension: false,
  pregnancy: false,
  allergies: "",
  medications: "",
  last_dental_visit: "",
  oral_hygiene: "regular",
  brushing_frequency: "2",
  flossing: false,
  mouthwash: false,
  previous_surgeries: "",
  bleeding_gums: false,
  tooth_sensitivity: false,
  jaw_pain: false,
  notes: "",
};

interface Props {
  patientId: string;
  tenantId: string;
  existingData?: AnamnesisData;
  onSaved?: () => void;
}

export function DentalAnamnesis({ patientId, tenantId, existingData, onSaved }: Props) {
  const [form, setForm] = useState<AnamnesisData>(existingData ?? INITIAL);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AnamnesisData>(key: K, value: AnamnesisData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("dental_anamnesis" as any).upsert(
        {
          patient_id: patientId,
          tenant_id: tenantId,
          data: form,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "patient_id,tenant_id" }
      );
      if (error) throw error;
      toast.success("Anamnese salva com sucesso");
      onSaved?.();
    } catch (err) {
      logger.error("Erro ao salvar anamnese:", err);
      toast.error("Erro ao salvar anamnese");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          Anamnese Odontológica
        </CardTitle>
        <CardDescription>Dados clínicos do paciente para avaliação odontológica</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hábitos */}
        <fieldset className="space-y-3 border rounded-lg p-3">
          <legend className="text-sm font-medium px-1">Hábitos e Condições</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SwitchField label="Bruxismo" checked={form.bruxism} onChange={(v) => set("bruxism", v)} />
            <SwitchField label="Tabagismo" checked={form.smoking} onChange={(v) => set("smoking", v)} />
            <SwitchField label="Diabetes" checked={form.diabetes} onChange={(v) => set("diabetes", v)} />
            <SwitchField label="Hipertensão" checked={form.hypertension} onChange={(v) => set("hypertension", v)} />
            <SwitchField label="Gestação" checked={form.pregnancy} onChange={(v) => set("pregnancy", v)} />
            <SwitchField label="Sangramento gengival" checked={form.bleeding_gums} onChange={(v) => set("bleeding_gums", v)} />
            <SwitchField label="Sensibilidade" checked={form.tooth_sensitivity} onChange={(v) => set("tooth_sensitivity", v)} />
            <SwitchField label="Dor na ATM" checked={form.jaw_pain} onChange={(v) => set("jaw_pain", v)} />
            <SwitchField label="Uso de fio dental" checked={form.flossing} onChange={(v) => set("flossing", v)} />
            <SwitchField label="Uso de enxaguante" checked={form.mouthwash} onChange={(v) => set("mouthwash", v)} />
          </div>
        </fieldset>

        {/* Detalhes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Alergias</Label>
            <Input
              placeholder="Ex.: Penicilina, Látex..."
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Medicamentos em uso</Label>
            <Input
              placeholder="Ex.: Losartana 50mg, AAS..."
              value={form.medications}
              onChange={(e) => set("medications", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Última visita ao dentista</Label>
            <Input
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={form.last_dental_visit}
              onChange={(e) => set("last_dental_visit", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Escovações por dia</Label>
            <Select value={form.brushing_frequency} onValueChange={(v) => set("brushing_frequency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="3">3x ou mais</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Higiene oral</Label>
            <Select value={form.oral_hygiene} onValueChange={(v: any) => set("oral_hygiene", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Boa</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="poor">Deficiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cirurgias prévias</Label>
            <Input
              placeholder="Descrição..."
              value={form.previous_surgeries}
              onChange={(e) => set("previous_surgeries", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Observações adicionais</Label>
          <Textarea
            rows={2}
            placeholder="Informações complementares..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Anamnese"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <Label className="text-xs cursor-pointer" onClick={() => onChange(!checked)}>
        {label}
      </Label>
    </div>
  );
}
