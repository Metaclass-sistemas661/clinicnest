/**
 * ToothEditDialog — Drawer lateral profissional para edição de dente
 * 
 * Padrão dos grandes softwares odontológicos brasileiros:
 * painel lateral (Sheet/Drawer) deslizando pela direita.
 * 
 * Features:
 * - Seleção de condição por categoria (Status, Patologia, Tratamento, Protético, Anomalia)
 * - Seleção interativa de faces/superfícies
 * - Grau de mobilidade (0-3)
 * - Prioridade de tratamento
 * - Material de restauração
 * - Observações e data de procedimento
 */
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  TOOTH_CONDITIONS,
  CONDITION_CATEGORIES,
  RESTORATION_MATERIALS,
  MOBILITY_GRADES,
  PRIORITIES,
  getSurfacesForTooth,
  SURFACE_LABELS,
  type ToothConditionKey,
} from "./odontogramConstants";
import { cn } from "@/lib/utils";

export interface ToothFormData {
  condition: ToothConditionKey;
  surfaces: string;
  notes: string;
  procedure_date: string;
  mobility_grade: number | null;
  priority: string;
  material?: string;
}

interface ToothEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toothNumber: number | null;
  initialData?: Partial<ToothFormData>;
  onSave: (data: ToothFormData) => void;
  onRemove?: () => void;
}

export function ToothEditDialog({
  open,
  onOpenChange,
  toothNumber,
  initialData,
  onSave,
  onRemove,
}: ToothEditDialogProps) {
  const [condition, setCondition] = useState<ToothConditionKey>("healthy");
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [mobilityGrade, setMobilityGrade] = useState<number | null>(null);
  const [priority, setPriority] = useState("normal");
  const [material, setMaterial] = useState("");

  // Available surfaces for this tooth
  const availableSurfaces = useMemo(
    () => (toothNumber ? getSurfacesForTooth(toothNumber) : []),
    [toothNumber]
  );

  // Reset form on open
  useEffect(() => {
    if (open && toothNumber) {
      setCondition(initialData?.condition ?? "healthy");
      setSelectedSurfaces(initialData?.surfaces ? initialData.surfaces.split(",").map(s => s.trim()).filter(Boolean) : []);
      setNotes(initialData?.notes ?? "");
      setProcedureDate(initialData?.procedure_date ?? "");
      setMobilityGrade(initialData?.mobility_grade ?? null);
      setPriority(initialData?.priority ?? "normal");
      setMaterial(initialData?.material ?? "");
    }
  }, [open, toothNumber, initialData]);

  const conditionInfo = TOOTH_CONDITIONS.find(c => c.value === condition);

  const handleToggleSurface = (surface: string) => {
    setSelectedSurfaces(prev =>
      prev.includes(surface) ? prev.filter(s => s !== surface) : [...prev, surface]
    );
  };

  const handleSave = () => {
    onSave({
      condition,
      surfaces: selectedSurfaces.join(", "),
      notes,
      procedure_date: procedureDate,
      mobility_grade: mobilityGrade,
      priority,
      material: material || undefined,
    });
  };

  if (!toothNumber) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto p-5">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            Dente {toothNumber}
            {conditionInfo && (
              <Badge style={{ backgroundColor: conditionInfo.color, color: "white" }} className="text-xs">
                {conditionInfo.label}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Registre a condição detalhada deste dente
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="condition" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="condition" className="text-xs">Condição</TabsTrigger>
            <TabsTrigger value="surfaces" className="text-xs">Faces</TabsTrigger>
            <TabsTrigger value="details" className="text-xs">Detalhes</TabsTrigger>
          </TabsList>

          {/* ── Tab: Condição ── */}
          <TabsContent value="condition" className="space-y-3 mt-3">
            {CONDITION_CATEGORIES.map(cat => {
              const items = TOOTH_CONDITIONS.filter(c => c.category === cat.key);
              return (
                <div key={cat.key} className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {items.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCondition(c.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all",
                          condition === c.value
                            ? "ring-2 ring-primary border-primary bg-primary/5 font-medium"
                            : "hover:bg-muted border-border"
                        )}
                      >
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* ── Tab: Faces/Superfícies ── */}
          <TabsContent value="surfaces" className="space-y-4 mt-3">
            <div className="space-y-2">
              <Label className="text-xs">Selecione as faces afetadas</Label>
              <div className="flex justify-center gap-2">
                {availableSurfaces.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleToggleSurface(s)}
                    className={cn(
                      "w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all text-xs font-bold",
                      selectedSurfaces.includes(s)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-sm">{s}</span>
                    <span className="text-[8px] font-normal">{SURFACE_LABELS[s]?.slice(0, 4)}</span>
                  </button>
                ))}
              </div>
              {selectedSurfaces.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Selecionadas: <strong>{selectedSurfaces.join(", ")}</strong>
                </p>
              )}
            </div>

            {/* Material (for restored, crown, veneer, etc.) */}
            {["restored", "crown", "veneer", "bridge", "bridge_abutment", "temporary", "sealant"].includes(condition) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Material</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RESTORATION_MATERIALS.map(m => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Detalhes ── */}
          <TabsContent value="details" className="space-y-4 mt-3">
            {/* Mobilidade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Grau de Mobilidade</Label>
              <ToggleGroup
                type="single"
                value={mobilityGrade?.toString() ?? ""}
                onValueChange={(v) => setMobilityGrade(v ? parseInt(v) : null)}
                className="justify-start"
              >
                {MOBILITY_GRADES.map(g => (
                  <ToggleGroupItem
                    key={g.value}
                    value={g.value.toString()}
                    className="text-xs px-3 h-8"
                    title={g.label}
                  >
                    {g.value}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {mobilityGrade != null && (
                <p className="text-[10px] text-muted-foreground">
                  {MOBILITY_GRADES.find(g => g.value === mobilityGrade)?.label}
                </p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade de Tratamento</Label>
              <div className="flex gap-1.5">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-all",
                      priority === p.value
                        ? "ring-2 ring-primary border-primary bg-primary/5 font-medium"
                        : "hover:bg-muted border-border"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data do procedimento */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Procedimento</Label>
              <Input
                type="date"
                value={procedureDate}
                onChange={(e) => setProcedureDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações Clínicas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes do tratamento, achados clínicos..."
                rows={3}
                className="text-xs"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Priority warning */}
        {priority === "urgent" && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-[11px] text-red-700 dark:text-red-400">
              Marcado como urgente. Este dente aparecerá destacado no odontograma.
            </p>
          </div>
        )}

        <SheetFooter className="flex !justify-between gap-2 pt-4 border-t">
          <div>
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remover
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
