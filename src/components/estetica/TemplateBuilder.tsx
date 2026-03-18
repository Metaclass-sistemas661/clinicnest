/**
 * TemplateBuilder — UI para admins criarem templates de prontuário sem código.
 * 
 * Features:
 * - Nome, descrição, ícone, cor, profissões-alvo
 * - Adicionar/remover/reordenar campos (drag via botões ↑↓)
 * - Cada campo: name, label, tipo, required, placeholder, options
 * - Preview ao vivo com DynamicFieldsRenderer
 * - Exportar/importar JSON
 */
import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  Code,
  Save,
  Upload,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DynamicFieldsRenderer, type TemplateField } from "@/components/prontuario/DynamicFieldsRenderer";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

export interface CustomTemplate {
  id?: string;
  key: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  targetTypes: string[];
  fields: TemplateField[];
}

const FIELD_TYPES: { value: TemplateField["type"]; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto Longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção" },
  { value: "boolean", label: "Sim / Não" },
];

const PROFESSION_OPTIONS = [
  "medico",
  "enfermeiro",
  "fisioterapeuta",
  "psicologo",
  "nutricionista",
  "fonoaudiologo",
  "biomédico esteticista",
  "odontólogo",
  "terapeuta ocupacional",
];

function generateFieldId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

interface TemplateBuilderProps {
  initialTemplate?: CustomTemplate;
  onSave: (template: CustomTemplate) => void;
  onCancel?: () => void;
}

export function TemplateBuilder({
  initialTemplate,
  onSave,
  onCancel,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [key, setKey] = useState(initialTemplate?.key ?? "");
  const [color, setColor] = useState(initialTemplate?.color ?? "bg-blue-500/10 text-blue-600 border-blue-500/20");
  const [targetTypes, setTargetTypes] = useState<string[]>(initialTemplate?.targetTypes ?? ["medico"]);
  const [fields, setFields] = useState<TemplateField[]>(initialTemplate?.fields ?? []);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState("editor");

  // Auto-slug from name
  const autoKey = useMemo(() => key || slugify(name), [key, name]);

  /* ── Field manipulation ── */

  const addField = () => {
    const newField: TemplateField = {
      id: generateFieldId(),
      name: "",
      label: "",
      type: "text",
      required: false,
      placeholder: "",
    };
    setFields(prev => [...prev, newField]);
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        // Auto-generate name from label
        if (updates.label && !f.name) {
          updated.name = slugify(updates.label);
        }
        return updated;
      }),
    );
  };

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    setFields(prev => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
  };

  const duplicateField = (index: number) => {
    const original = fields[index];
    const copy: TemplateField = {
      ...original,
      id: generateFieldId(),
      name: `${original.name}_copia`,
      label: `${original.label} (Cópia)`,
    };
    setFields(prev => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
  };

  const toggleProfession = (prof: string) => {
    setTargetTypes(prev =>
      prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof],
    );
  };

  /* ── Save ── */

  const handleSave = () => {
    const template: CustomTemplate = {
      ...(initialTemplate?.id ? { id: initialTemplate.id } : {}),
      key: autoKey,
      name,
      description,
      color,
      targetTypes,
      fields: fields.map(f => ({
        ...f,
        name: f.name || slugify(f.label),
      })),
    };
    onSave(template);
  };

  /* ── Export/Import ── */

  const exportJSON = () => {
    const template: CustomTemplate = {
      key: autoKey,
      name,
      description,
      color,
      targetTypes,
      fields,
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${autoKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text) as CustomTemplate;
        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);
        if (data.key) setKey(data.key);
        if (data.color) setColor(data.color);
        if (data.targetTypes) setTargetTypes(data.targetTypes);
        if (data.fields) setFields(data.fields);
      } catch {
        // invalid JSON
      }
    };
    input.click();
  };

  const fieldCount = fields.length;
  const isValid = name.trim() && fields.length > 0 && fields.every(f => f.label.trim());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Template Builder</h2>
          <p className="text-xs text-muted-foreground">
            Crie modelos de prontuário personalizados sem código
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importJSON}>
            <Upload className="h-3 w-3 mr-1" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <Code className="h-3 w-3 mr-1" /> Exportar JSON
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!isValid}>
            <Save className="h-3 w-3 mr-1" /> Salvar Template
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-3 w-3 mr-1" /> Preview
          </TabsTrigger>
        </TabsList>

        {/* ── Editor Tab ── */}
        <TabsContent value="editor" className="space-y-4">
          {/* Meta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações do Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do Template *</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Ex: Avaliação Capilar"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Chave (slug)</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="auto"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                  />
                  <span className="text-[10px] text-muted-foreground">{autoKey}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Descrição curta do template"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Profissões-alvo</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PROFESSION_OPTIONS.map(prof => (
                    <Badge
                      key={prof}
                      variant={targetTypes.includes(prof) ? "default" : "outline"}
                      className="text-[10px] cursor-pointer"
                      onClick={() => toggleProfession(prof)}
                    >
                      {prof}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Campos ({fieldCount})
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addField}>
                  <Plus className="h-3 w-3 mr-1" /> Campo
                </Button>
              </div>
              <CardDescription className="text-xs">
                Defina os campos que o profissional preencherá no prontuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-xs border border-dashed rounded-lg">
                  Nenhum campo adicionado. Clique em "+ Campo" acima.
                </div>
              )}

              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="border rounded-lg p-3 bg-background space-y-2"
                >
                  {/* Field header */}
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => moveField(i, -1)} disabled={i === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => moveField(i, 1)} disabled={i === fields.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicateField(i)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={() => removeField(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Field config */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Label *</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Ex: Área Tratada"
                        value={field.label}
                        onChange={e => updateField(i, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Nome</Label>
                      <Input
                        className="h-7 text-xs font-mono"
                        placeholder="auto"
                        value={field.name}
                        onChange={e => updateField(i, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Tipo</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(i, { type: v as TemplateField["type"] })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Placeholder</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Texto de ajuda"
                        value={field.placeholder ?? ""}
                        onChange={e => updateField(i, { placeholder: e.target.value })}
                      />
                    </div>
                    {field.type === "select" && (
                      <div className="col-span-2">
                        <Label className="text-[10px]">Opções (separadas por vírgula)</Label>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Opção1,Opção2,Opção3"
                          value={field.options ?? ""}
                          onChange={e => updateField(i, { options: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-3">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(v) => updateField(i, { required: v })}
                      />
                      <Label className="text-[10px]">Obrigatório</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Preview Tab ── */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{name || "Template sem nome"}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
              <div className="flex gap-1 mt-1">
                {targetTypes.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {fields.length > 0 ? (
                <DynamicFieldsRenderer
                  fields={fields}
                  values={previewValues}
                  onChange={setPreviewValues}
                />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Adicione campos no editor para ver o preview
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
