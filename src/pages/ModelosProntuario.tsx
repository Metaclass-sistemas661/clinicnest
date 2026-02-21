import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileCode2,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string; // CSV para select
}

interface RecordTemplate {
  id: string;
  name: string;
  specialty_id: string | null;
  specialty_name: string | null;
  fields: TemplateField[];
  is_default: boolean;
  created_at: string;
}

interface Specialty {
  id: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção (lista)" },
  { value: "boolean", label: "Sim / Não" },
];

function newField(): TemplateField {
  return {
    id: crypto.randomUUID(),
    name: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: "",
  };
}

// ─── FieldEditor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: TemplateField;
  index: number;
  total: number;
  onChange: (f: TemplateField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const set = (k: keyof TemplateField, v: string | boolean) =>
    onChange({ ...field, [k]: v });

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
        <span className="text-xs font-medium text-muted-foreground">Campo {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown} disabled={index === total - 1}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Rótulo (exibição)</Label>
          <Input
            value={field.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Ex: Pressão Arterial"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome interno</Label>
          <Input
            value={field.name}
            onChange={(e) => set("name", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="Ex: pressao_arterial"
            className="h-8 text-sm font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={field.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            checked={field.required}
            onCheckedChange={(v) => set("required", v)}
          />
          <Label className="text-xs">Obrigatório</Label>
        </div>
      </div>

      {field.type === "select" && (
        <div className="space-y-1">
          <Label className="text-xs">Opções (separadas por vírgula)</Label>
          <Input
            value={field.options ?? ""}
            onChange={(e) => set("options", e.target.value)}
            placeholder="Ex: Normal, Alterado, Crítico"
            className="h-8 text-sm"
          />
        </div>
      )}

      {(field.type === "text" || field.type === "textarea" || field.type === "number") && (
        <div className="space-y-1">
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => set("placeholder", e.target.value)}
            placeholder="Texto de exemplo..."
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ModelosProntuario() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState<string>("none");
  const [formDefault, setFormDefault] = useState(false);
  const [formFields, setFormFields] = useState<TemplateField[]>([newField()]);

  useEffect(() => {
    if (profile?.tenant_id) {
      void fetchTemplates();
      void fetchSpecialties();
    }
  }, [profile?.tenant_id]);

  const fetchTemplates = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("record_field_templates")
        .select("*, specialties(name)")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      const mapped: RecordTemplate[] = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        specialty_id: r.specialty_id,
        specialty_name: r.specialties?.name ?? null,
        fields: (r.fields as TemplateField[]) ?? [],
        is_default: r.is_default,
        created_at: r.created_at,
      }));
      setTemplates(mapped);
    } catch (err) {
      logger.error("Templates fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("specialties")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setSpecialties(data ?? []);
    } catch (err) {
      logger.error("Specialties fetch:", err);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormSpecialty("none");
    setFormDefault(false);
    setFormFields([newField()]);
    setIsDialogOpen(true);
  };

  const openEdit = (t: RecordTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormSpecialty(t.specialty_id ?? "none");
    setFormDefault(t.is_default);
    setFormFields(t.fields.length > 0 ? t.fields : [newField()]);
    setIsDialogOpen(true);
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
      if (editingId) {
        const { error } = await supabase
          .from("record_field_templates")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Modelo atualizado");
      } else {
        const { error } = await supabase.from("record_field_templates").insert(payload);
        if (error) throw error;
        toast.success("Modelo criado");
      }
      setIsDialogOpen(false);
      void fetchTemplates();
    } catch (err) {
      logger.error("Templates save:", err);
      toast.error("Erro ao salvar modelo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este modelo?")) return;
    try {
      const { error } = await supabase
        .from("record_field_templates")
        .delete()
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Modelo excluído");
      void fetchTemplates();
    } catch (err) {
      logger.error("Templates delete:", err);
      toast.error("Erro ao excluir");
    }
  };

  // Field list helpers
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

  return (
    <MainLayout
      title="Modelos de Prontuário"
      subtitle="Configure campos personalizados por especialidade"
      actions={
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Modelo
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="Nenhum modelo criado"
          description="Crie modelos de campos extras para personalizar o prontuário por especialidade."
          action={
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Modelo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.specialty_name && (
                      <CardDescription className="mt-0.5">{t.specialty_name}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {t.is_default && <Badge variant="default">Padrão</Badge>}
                    <Badge variant="secondary">{t.fields.length} campos</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.fields.map((f) => (
                    <Badge key={f.id} variant="outline" className="text-xs">
                      {f.label || f.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)} className="flex-1 gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleDelete(t.id)} className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Modelo" : "Novo Modelo de Prontuário"}</DialogTitle>
            <DialogDescription>
              Defina campos extras que aparecerão no prontuário para esta especialidade.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="tmpl-name">Nome do modelo *</Label>
                <Input
                  id="tmpl-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Consulta Cardiológica"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tmpl-spec">Especialidade</Label>
                <Select value={formSpecialty} onValueChange={setFormSpecialty}>
                  <SelectTrigger id="tmpl-spec">
                    <SelectValue placeholder="Todas as especialidades" />
                  </SelectTrigger>
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

            {/* Lista de campos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Campos personalizados</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFormFields((prev) => [...prev, newField()])}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar campo
                </Button>
              </div>
              {formFields.map((f, idx) => (
                <FieldEditor
                  key={f.id}
                  field={f}
                  index={idx}
                  total={formFields.length}
                  onChange={(updated) => updateField(idx, updated)}
                  onRemove={() => removeField(idx)}
                  onMoveUp={() => moveField(idx, -1)}
                  onMoveDown={() => moveField(idx, 1)}
                />
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : editingId ? "Salvar" : "Criar Modelo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
