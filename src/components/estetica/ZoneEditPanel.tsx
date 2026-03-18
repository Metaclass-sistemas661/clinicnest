/**
 * ZoneEditPanel — Painel inline para editar aplicação em uma zona.
 * Mostra procedimento, quantidade, produto, lote, calibre, profundidade e notas.
 */
import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACE_ZONES,
  BODY_ZONES,
  AESTHETIC_PROCEDURES,
  PROCEDURE_CATEGORIES,
  type AestheticProcedureKey,
  type ZoneApplication,
} from "./aestheticConstants";

interface ZoneEditPanelProps {
  zoneId: string;
  applications: ZoneApplication[];
  onAdd: (app: ZoneApplication) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}

const allZones = [...FACE_ZONES, ...BODY_ZONES];

export function ZoneEditPanel({
  zoneId,
  applications,
  onAdd,
  onRemove,
  onClose,
}: ZoneEditPanelProps) {
  const zone = allZones.find(z => z.id === zoneId);
  const zoneApps = applications.filter(a => a.zoneId === zoneId);

  const [procedure, setProcedure] = useState<AestheticProcedureKey>("toxina_botulinica");
  const [quantity, setQuantity] = useState("");
  const [product, setProduct] = useState("");
  const [batch, setBatch] = useState("");
  const [needle, setNeedle] = useState("");
  const [depth, setDepth] = useState("");
  const [notes, setNotes] = useState("");

  const selectedProc = AESTHETIC_PROCEDURES.find(p => p.value === procedure);
  const unit = selectedProc?.unit ?? "";

  const handleAdd = () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return;
    onAdd({
      zoneId,
      procedure,
      quantity: qty,
      unit,
      product: product || undefined,
      batch: batch || undefined,
      needle: needle || undefined,
      depth: depth || undefined,
      notes: notes || undefined,
    });
    // Reset qty fields
    setQuantity("");
    setNotes("");
  };

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedProc?.color ?? "#6b7280" }}
          />
          <h4 className="font-semibold text-sm">{zone?.label ?? zoneId}</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Existing applications */}
      {zoneApps.length > 0 && (
        <div className="space-y-1">
          {zoneApps.map((app, i) => {
            const proc = AESTHETIC_PROCEDURES.find(p => p.value === app.procedure);
            const globalIdx = applications.indexOf(app);
            return (
              <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    className="text-[10px] px-1.5 py-0"
                    style={{ backgroundColor: proc?.color, color: "#fff" }}
                  >
                    {proc?.label}
                  </Badge>
                  <span className="font-mono font-bold">{app.quantity}{app.unit}</span>
                  {app.product && <span className="text-muted-foreground">• {app.product}</span>}
                  {app.batch && <span className="text-muted-foreground">Lote: {app.batch}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onRemove(globalIdx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new application */}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Procedimento</Label>
          <Select value={procedure} onValueChange={(v) => setProcedure(v as AestheticProcedureKey)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROCEDURE_CATEGORIES.map(cat => (
                <div key={cat.key}>
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{cat.label}</div>
                  {AESTHETIC_PROCEDURES.filter(p => p.category === cat.key).map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.label} ({p.unit})
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Quantidade ({unit})</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            placeholder={`Ex: ${unit === "U" ? "20" : unit === "ml" ? "0.5" : "1"}`}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min={0}
            step={unit === "ml" ? 0.1 : 1}
          />
        </div>

        <div>
          <Label className="text-xs">Produto / Marca</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Ex: Botox, Juvederm"
            value={product}
            onChange={e => setProduct(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Lote</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Nº do lote"
            value={batch}
            onChange={e => setBatch(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Calibre (agulha/cânula)</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Ex: 27G, 25G×50mm"
            value={needle}
            onChange={e => setNeedle(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Profundidade</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Ex: subcutânea, supraperiosteal"
            value={depth}
            onChange={e => setDepth(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Observações</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Notas adicionais"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <Button size="sm" className="w-full h-8 text-xs" onClick={handleAdd}>
        <Plus className="h-3 w-3 mr-1" />
        Adicionar aplicação
      </Button>
    </div>
  );
}
