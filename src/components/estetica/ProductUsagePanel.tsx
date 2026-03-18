/**
 * ProductUsagePanel — Registrar uso de produto em uma sessão.
 * Vincula produto (com lote/validade) → paciente → consulta.
 */
import { useState, useMemo } from "react";
import { Package, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AESTHETIC_PROCEDURES,
  FACE_ZONES,
  BODY_ZONES,
  type AestheticProcedureKey,
} from "./aestheticConstants";

/* ─── Types ─── */

export interface ProductUsageRecord {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  zone?: string;
  procedureType?: AestheticProcedureKey;
  notes?: string;
}

interface ProductOption {
  id: string;
  name: string;
  quantity: number; // estoque disponível
  unit?: string;
}

interface ProductUsagePanelProps {
  usages: ProductUsageRecord[];
  products: ProductOption[];
  onAdd: (usage: ProductUsageRecord) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}

const allZones = [...FACE_ZONES, ...BODY_ZONES];

export function ProductUsagePanel({
  usages,
  products,
  onAdd,
  onRemove,
  readOnly = false,
}: ProductUsagePanelProps) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("ml");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [zone, setZone] = useState("");
  const [procedureType, setProcedureType] = useState<AestheticProcedureKey | "">("");
  const [notes, setNotes] = useState("");

  const selectedProduct = products.find(p => p.id === productId);

  // Check for near-expiry
  const isNearExpiry = useMemo(() => {
    if (!expiryDate) return false;
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  }, [expiryDate]);

  const isExpired = useMemo(() => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  }, [expiryDate]);

  const handleAdd = () => {
    if (!productId || !selectedProduct) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return;

    onAdd({
      productId,
      productName: selectedProduct.name,
      quantity: qty,
      unit,
      batchNumber: batchNumber || undefined,
      expiryDate: expiryDate || undefined,
      zone: zone || undefined,
      procedureType: (procedureType as AestheticProcedureKey) || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setQuantity("");
    setBatchNumber("");
    setExpiryDate("");
    setNotes("");
  };

  const totalByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of usages) {
      map.set(u.productId, (map.get(u.productId) ?? 0) + u.quantity);
    }
    return map;
  }, [usages]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Produtos Utilizados na Sessão</h3>
        <Badge variant="outline" className="text-xs">{usages.length}</Badge>
      </div>

      {/* Existing usages */}
      {usages.length > 0 && (
        <div className="space-y-1">
          {usages.map((u, i) => {
            const proc = u.procedureType
              ? AESTHETIC_PROCEDURES.find(p => p.value === u.procedureType)
              : null;
            const zoneObj = u.zone ? allZones.find(z => z.id === u.zone) : null;

            return (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{u.productName}</span>
                  <Badge variant="outline" className="text-[10px]">{u.quantity} {u.unit}</Badge>
                  {u.batchNumber && <span className="text-muted-foreground">Lote: {u.batchNumber}</span>}
                  {u.expiryDate && <span className="text-muted-foreground">Val: {u.expiryDate}</span>}
                  {zoneObj && (
                    <Badge variant="secondary" className="text-[10px]">{zoneObj.label}</Badge>
                  )}
                  {proc && (
                    <Badge className="text-[10px]" style={{ backgroundColor: proc.color, color: "#fff" }}>
                      {proc.label}
                    </Badge>
                  )}
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {!readOnly && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar produto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">(Est: {p.quantity})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="Ex: 20"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={0}
                step={0.1}
              />
            </div>

            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="U">U (unidades)</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                  <SelectItem value="fios">fios</SelectItem>
                  <SelectItem value="amp">ampola</SelectItem>
                  <SelectItem value="fr">frasco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Nº Lote</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Lote do produto"
                value={batchNumber}
                onChange={e => setBatchNumber(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Validade</Label>
              <Input
                type="date"
                className={cn("h-8 text-xs", isExpired && "border-destructive", isNearExpiry && !isExpired && "border-amber-500")}
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
              {isExpired && (
                <span className="text-[10px] text-destructive flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Produto vencido
                </span>
              )}
              {isNearExpiry && !isExpired && (
                <span className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Vence em breve
                </span>
              )}
            </div>

            <div>
              <Label className="text-xs">Zona</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Face</div>
                  {FACE_ZONES.map(z => (
                    <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Corpo</div>
                  {BODY_ZONES.map(z => (
                    <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Procedimento</Label>
              <Select value={procedureType} onValueChange={(v) => setProcedureType(v as AestheticProcedureKey)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {AESTHETIC_PROCEDURES.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Notas sobre o uso"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <Button size="sm" className="w-full h-8 text-xs" onClick={handleAdd} disabled={!productId || !quantity}>
            <Plus className="h-3 w-3 mr-1" />
            Registrar uso do produto
          </Button>
        </div>
      )}
    </div>
  );
}
