import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { upsertPatientV2 } from "@/lib/supabase-typed-rpc";
import type { Patient } from "@/types/database";
import {
  formatCpf, formatCep, patientFormSchema,
  emptyFormData, patientToFormData, BRAZILIAN_STATES, MARITAL_STATUS_OPTIONS,
  type PatientFormData,
} from "./helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPatient: Patient | null;
  tenantId: string;
  onSaved: (result: { isNew: boolean; accessCode?: string; patientName: string }) => void;
}

export function PatientFormDialog({ open, onOpenChange, editingPatient, tenantId, onSaved }: Props) {
  const [formData, setFormData] = useState<PatientFormData>(
    editingPatient ? patientToFormData(editingPatient) : emptyFormData,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // Sync form when editing patient changes
  const [prevPatient, setPrevPatient] = useState<Patient | null>(null);
  if (editingPatient !== prevPatient) {
    setPrevPatient(editingPatient);
    setFormData(editingPatient ? patientToFormData(editingPatient) : emptyFormData);
  }

  const handleCepBlur = async () => {
    const digits = formData.zip_code.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(digits)}/json/`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    const parsed = patientFormSchema.safeParse({
      ...formData,
      name: formData.name.trim(),
      email: formData.email || "",
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
      onOpenChange(false);
      setFormData(emptyFormData);
      onSaved({
        isNew,
        accessCode: isNew ? rpcResult?.access_code : undefined,
        patientName: parsed.data.name,
      });
    } catch {
      toast.error(editingPatient ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="patients-save">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingPatient ? "Atualizar Paciente" : "Cadastrar Paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
