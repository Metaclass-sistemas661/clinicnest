/**
 * PeriodontalPrescription — Prescrição odontológica vinculada ao periograma (F15)
 *
 * Permite ao profissional criar prescrições (medicamentos, posologia, duração)
 * vinculadas ao periograma/odontograma e registrar assinatura digital.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pill, Plus, Trash2, Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const EMPTY_MED: Medication = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

interface Props {
  patientId: string;
  tenantId: string;
  professionalId: string;
  periogramId?: string;
  odontogramId?: string;
  onSaved?: () => void;
}

export function PeriodontalPrescription({
  patientId,
  tenantId,
  professionalId,
  periogramId,
  odontogramId,
  onSaved,
}: Props) {
  const [diagnosis, setDiagnosis] = useState("");
  const [medications, setMedications] = useState<Medication[]>([{ ...EMPTY_MED }]);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const updateMed = (idx: number, field: keyof Medication, value: string) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const addMed = () => setMedications((prev) => [...prev, { ...EMPTY_MED }]);

  const removeMed = (idx: number) => {
    if (medications.length <= 1) return;
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const validMeds = medications.filter((m) => m.name.trim());
    if (validMeds.length === 0) {
      toast.error("Adicione pelo menos um medicamento");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("dental_prescriptions" as any).insert({
        tenant_id: tenantId,
        patient_id: patientId,
        professional_id: professionalId,
        periogram_id: periogramId ?? null,
        odontogram_id: odontogramId ?? null,
        prescription_date: new Date().toISOString().split("T")[0],
        diagnosis,
        medications: validMeds,
        instructions,
      });
      if (error) throw error;
      toast.success("Prescrição salva com sucesso");
      onSaved?.();
    } catch (err) {
      logger.error("Erro ao salvar prescrição:", err);
      toast.error("Erro ao salvar prescrição");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-4 w-4" />
          Prescrição Odontológica
        </CardTitle>
        <CardDescription>Prescrição vinculada ao periograma/odontograma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Diagnóstico</Label>
          <Input
            placeholder="Diagnóstico periodontal..."
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Medicamentos</Label>
            <Button size="sm" variant="ghost" onClick={addMed}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Medicamento</TableHead>
                  <TableHead className="text-xs">Dosagem</TableHead>
                  <TableHead className="text-xs">Frequência</TableHead>
                  <TableHead className="text-xs">Duração</TableHead>
                  <TableHead className="text-xs">Observação</TableHead>
                  <TableHead className="text-xs w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map((med, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Nome"
                        value={med.name}
                        onChange={(e) => updateMed(idx, "name", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ex.: 500mg"
                        value={med.dosage}
                        onChange={(e) => updateMed(idx, "dosage", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ex.: 8/8h"
                        value={med.frequency}
                        onChange={(e) => updateMed(idx, "frequency", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ex.: 7 dias"
                        value={med.duration}
                        onChange={(e) => updateMed(idx, "duration", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Obs."
                        value={med.instructions}
                        onChange={(e) => updateMed(idx, "instructions", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={medications.length <= 1}
                        onClick={() => removeMed(idx)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Instruções ao paciente</Label>
          <Textarea
            rows={2}
            placeholder="Orientações gerais..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Prescrição"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
