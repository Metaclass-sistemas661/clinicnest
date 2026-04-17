import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, AlertTriangle, ArrowLeft, KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { upsertPatientV2 } from "@/lib/typed-rpc";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import type { Patient } from "@/types/database";
import {
  formatCpf, formatCep, formatPhone, patientFormSchema,
  emptyFormData, patientToFormData, BRAZILIAN_STATES, MARITAL_STATUS_OPTIONS,
  type PatientFormData,
} from "./helpers";

export default function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState<PatientFormData>(emptyFormData);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isLoadingPatient, setIsLoadingPatient] = useState(isEditing);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Success state
  const [savedAccessCode, setSavedAccessCode] = useState<string | null>(null);
  const [savedPatientName, setSavedPatientName] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!id || !profile?.tenant_id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingPatient(true);
      try {
        const { data, error } = await api
          .from("patients")
          .select("id,tenant_id,name,phone,email,notes,cpf,access_code,date_of_birth,marital_status,zip_code,street,street_number,complement,neighborhood,city,state,allergies,created_at,updated_at")
          .eq("id", id)
          .eq("tenant_id", profile.tenant_id)
          .single();
        if (error) throw error;
        if (!cancelled && data) {
          const patient = data as Patient;
          setEditingPatient(patient);
          setFormData(patientToFormData(patient));
        }
      } catch (err) {
        logger.error("Error loading patient:", err);
        toast.error("Paciente não encontrado");
        navigate("/pacientes");
      } finally {
        if (!cancelled) setIsLoadingPatient(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, profile?.tenant_id]);

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
    if (!profile?.tenant_id) return;

    const parsed = patientFormSchema.safeParse({
      ...formData,
      name: formData.name.trim(),
      email: formData.email || "",
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const err of parsed.error.errors) {
        const field = err.path[0] as string;
        if (!errors[field]) errors[field] = err.message;
      }
      setFieldErrors(errors);
      const firstMsg = parsed.error.errors[0]?.message ?? "Verifique os dados";
      toast.error(firstMsg);
      return;
    }
    setFieldErrors({});

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
        const errMsg = String((error as any)?.message ?? "");
        const errDetail = String((error as any)?.details ?? "");
        if (errMsg.includes("CPF") || errDetail === "DUPLICATE_CPF") {
          setFieldErrors({ cpf: errMsg.includes("já existe") ? "CPF já cadastrado para outro paciente" : errMsg });
          toast.error(errMsg || "Já existe um paciente cadastrado com este CPF.");
        } else if (errMsg.includes("telefone") || errDetail === "DUPLICATE_PHONE") {
          setFieldErrors({ phone: errMsg.includes("já existe") ? "Telefone já cadastrado para outro paciente" : errMsg });
          toast.error(errMsg || "Já existe um paciente cadastrado com este telefone.");
        } else {
          toastRpcError(toast, error as any, isEditing ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente");
        }
        return;
      }

      if (!isEditing && rpcResult?.access_code) {
        setSavedAccessCode(rpcResult.access_code);
        setSavedPatientName(parsed.data.name);
      } else {
        toast.success(isEditing ? "Paciente atualizado com sucesso!" : "Paciente cadastrado com sucesso!");
        navigate("/pacientes");
      }
    } catch {
      toast.error(isEditing ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente");
    } finally {
      setIsSaving(false);
    }
  };

  // After successful creation — show access code
  if (savedAccessCode) {
    return (
      <MainLayout title="Paciente Cadastrado" subtitle="Paciente criado com sucesso">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <KeyRound className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">Código de acesso de {savedPatientName}</div>
                <div className="text-2xl font-mono font-bold tracking-widest text-primary">{savedAccessCode}</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(savedAccessCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2500);
                  toast.success("Código copiado!");
                }}
              >
                {codeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Envie este código ao paciente para que ele acesse o Portal do Paciente.
            </p>
            <Button variant="gradient" className="w-full" onClick={() => navigate("/pacientes")}>
              Voltar para Pacientes
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  if (isLoadingPatient) {
    return (
      <MainLayout title={isEditing ? "Editar Paciente" : "Novo Paciente"}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={isEditing ? "Editar Paciente" : "Novo Paciente"}
      subtitle={isEditing ? "Atualize os dados do paciente" : "Preencha os dados para cadastrar um novo paciente"}
      actions={
        <Button variant="outline" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Dados Pessoais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label>Nome <span className="text-destructive">*</span></Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" required className={fieldErrors.name ? "border-destructive" : ""} />
                    {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>CPF <span className="text-destructive">*</span></Label>
                    <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" maxLength={14} required className={fieldErrors.cpf ? "border-destructive" : ""} />
                    {fieldErrors.cpf && <p className="text-xs text-destructive">{fieldErrors.cpf}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone <span className="text-destructive">*</span></Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" maxLength={15} required className={fieldErrors.phone ? "border-destructive" : ""} />
                    {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" className={fieldErrors.email ? "border-destructive" : ""} />
                    {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Nascimento <span className="text-destructive">*</span></Label>
                    <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} required className={fieldErrors.date_of_birth ? "border-destructive" : ""} />
                    {fieldErrors.date_of_birth && <p className="text-xs text-destructive">{fieldErrors.date_of_birth}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select value={formData.marital_status || undefined} onValueChange={(v) => setFormData({ ...formData, marital_status: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
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
                  <AlertTriangle className="h-4 w-4" /> Alergias
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

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate("/pacientes")}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} variant="gradient">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Atualizar Paciente" : "Cadastrar Paciente"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
