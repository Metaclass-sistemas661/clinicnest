import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Loader2, Save } from "lucide-react";

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";

interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string;
}

interface Specialty {
  id: string;
  name: string;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção (lista)" },
  { value: "boolean", label: "Sim / Não" },
];

function newField(): TemplateField {
  return { id: crypto.randomUUID(), name: "", label: "", type: "text", required: false, placeholder: "", options: "" };
}

export default function ModeloProntuarioEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isNew = id === "novo";

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState<string>("none");
  const [formDefault, setFormDefault] = useState(false);
  const [formFields, setFormFields] = useState<TemplateField[]>([newField()]);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSpecialties();
      if (!isNew && id) fetchTemplate();
    }
  }, [profile?.tenant_id, id, isNew]);

  const fetchSpecialties = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data } = await supabase
        .from("specialties")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      setSpecialties(data ?? []);
    } catch (err) {
      logger.error(err);
    }
  };

  const fetchTemplate = async () => {
    if (!profile?.tenant_id || !id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("record_field_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", id)
        .single();
      if (error) throw error;
      setFormName(data.name);
      setFormSpecialty(data.specialty_id ?? "none");
      setFormDefault(data.is_default);
      setFormFields((data.fields as TemplateField[]) ?? [newField()]);
    } catch (err) {
      logger.error(err);
      toast.error("Modelo não encontrado");
      navigate("/modelos-prontuario");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
    const validFields = formFields.filter((f) => f.label.trim() && f.name.trim());
    if (validFields.length === 0) { toast.error("Adicione pelo menos um campo válido"); return; }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        specialty_id: formSpecialty === "none" ? null : formSpecialty,
        is_default: formDefault,
        fields: validFields,
        tenant_id: profile!.tenant_id,
      };

      if (isNew) {
        const { error } = await supabase.from("record_field_templates").insert(payload);
        if (error) throw error;
        toast.success("Modelo criado com sucesso!");
      } else {
        const { error } = await supabase
          .from("record_field_templates")
          .update(payload)
          .eq("id", id)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Modelo atualizado!");
      }
      navigate("/modelos-prontuario");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao salvar modelo");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (idx: number, f: TemplateField) =>
    setFormFields((prev) => prev.map((x, i) => (i === idx ? f : x)));
  const removeField = (idx: number) =>
    setFormFields((prev) => prev.filter((_, i) => i !== idx));
  const moveField = (idx: number, dir: -1 | 1) =>
    setFormFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  if (isLoading) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <Skeleton className="h-64 w-full" />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={isNew ? "Novo Modelo de Prontuário" : "Editar Modelo"}
      subtitle="Configure campos personalizados para o prontuário"
      actions={
        <Button variant="outline" onClick={() => navigate("/modelos-prontuario")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Informações do Modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do modelo *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Consulta Cardiológica" required />
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Select value={formSpecialty} onValueChange={setFormSpecialty}>
                  <SelectTrigger><SelectValue placeholder="Todas as especialidades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas as especialidades</SelectItem>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formDefault} onCheckedChange={setFormDefault} />
              <Label>Usar como padrão para a especialidade selecionada</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Campos Personalizados</CardTitle>
                <CardDescription>Arraste para reordenar os campos</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setFormFields((prev) => [...prev, newField()])}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar campo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formFields.map((field, idx) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <span className="text-sm font-medium text-muted-foreground">Campo {idx + 1}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(idx, -1)} disabled={idx === 0}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(idx, 1)} disabled={idx === formFields.length - 1}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(idx)} disabled={formFields.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Rótulo (exibição)</Label>
                    <Input value={field.label} onChange={(e) => updateField(idx, { ...field, label: e.target.value })} placeholder="Ex: Pressão Arterial" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nome interno</Label>
                    <Input value={field.name} onChange={(e) => updateField(idx, { ...field, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="Ex: pressao_arterial" className="font-mono" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={field.type} onValueChange={(v) => updateField(idx, { ...field, type: v as FieldType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { ...field, required: v })} />
                    <Label className="text-xs">Obrigatório</Label>
                  </div>
                </div>

                {field.type === "select" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Opções (separadas por vírgula)</Label>
                    <Input value={field.options ?? ""} onChange={(e) => updateField(idx, { ...field, options: e.target.value })} placeholder="Ex: Normal, Alterado, Crítico" />
                  </div>
                )}

                {(field.type === "text" || field.type === "textarea" || field.type === "number") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Placeholder</Label>
                    <Input value={field.placeholder ?? ""} onChange={(e) => updateField(idx, { ...field, placeholder: e.target.value })} placeholder="Texto de exemplo..." />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isSaving} variant="gradient">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />{isNew ? "Criar Modelo" : "Salvar Alterações"}</>}
          </Button>
        </div>
      </form>
    </MainLayout>
  );
}
