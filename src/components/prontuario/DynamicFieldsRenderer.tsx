import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "boolean";
  required: boolean;
  placeholder?: string;
  options?: string;
}

interface Props {
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function DynamicFieldsRenderer({ fields, values, onChange }: Props) {
  const set = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <h4 className="text-sm font-semibold text-muted-foreground">Campos do Modelo</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.id} className={f.type === "textarea" ? "md:col-span-2" : ""}>
            <div className="space-y-1.5">
              <Label className="text-sm">
                {f.label}{f.required && " *"}
              </Label>
              {f.type === "text" && (
                <Input
                  value={(values[f.name] as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder || ""}
                  required={f.required}
                />
              )}
              {f.type === "textarea" && (
                <Textarea
                  value={(values[f.name] as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder || ""}
                  rows={3}
                  required={f.required}
                />
              )}
              {f.type === "number" && (
                <Input
                  type="number"
                  value={(values[f.name] as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder || ""}
                  required={f.required}
                />
              )}
              {f.type === "date" && (
                <Input
                  type="date"
                  value={(values[f.name] as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                />
              )}
              {f.type === "select" && (
                <Select
                  value={(values[f.name] as string) ?? ""}
                  onValueChange={(v) => set(f.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options || "").split(",").map((opt) => {
                      const trimmed = opt.trim();
                      return trimmed ? (
                        <SelectItem key={trimmed} value={trimmed}>{trimmed}</SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              )}
              {f.type === "boolean" && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={!!values[f.name]}
                    onCheckedChange={(v) => set(f.name, v)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {values[f.name] ? "Sim" : "Não"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
