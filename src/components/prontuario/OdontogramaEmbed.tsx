import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Smile, Trash2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

const TOOTH_CONDITIONS = [
  { value: "healthy", label: "Saudável", color: "#22c55e" },
  { value: "caries", label: "Cárie", color: "#ef4444" },
  { value: "restored", label: "Restaurado", color: "#3b82f6" },
  { value: "missing", label: "Ausente", color: "#6b7280" },
  { value: "crown", label: "Coroa", color: "#f59e0b" },
  { value: "implant", label: "Implante", color: "#8b5cf6" },
  { value: "endodontic", label: "Endodontia", color: "#ec4899" },
  { value: "extraction", label: "Indicado extração", color: "#dc2626" },
  { value: "prosthesis", label: "Prótese", color: "#14b8a6" },
  { value: "fracture", label: "Fratura", color: "#f97316" },
];

interface ToothRecord {
  tooth_number: number;
  condition: string;
  surfaces?: string;
  notes?: string;
}

interface Props {
  tenantId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  readOnly?: boolean;
}

function getConditionInfo(condition: string) {
  return TOOTH_CONDITIONS.find(c => c.value === condition) ?? TOOTH_CONDITIONS[0];
}

function ToothIcon({ number, condition, isSelected, onClick, disabled }: {
  number: number;
  condition: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const info = getConditionInfo(condition);
  const isUpper = number <= 28;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 p-0.5 rounded transition-all ${
        disabled ? "cursor-default opacity-70" : "hover:scale-110"
      } ${isSelected ? "ring-2 ring-primary bg-primary/10" : !disabled && "hover:bg-muted"}`}
      title={`Dente ${number} — ${info.label}`}
    >
      <svg width="22" height="26" viewBox="0 0 28 32">
        {isUpper ? (
          <path
            d="M14 2 C8 2, 4 6, 4 12 C4 18, 6 24, 10 28 C12 30, 16 30, 18 28 C22 24, 24 18, 24 12 C24 6, 20 2, 14 2Z"
            fill={condition === "missing" ? "none" : info.color}
            stroke={info.color}
            strokeWidth="1.5"
            opacity={condition === "missing" ? 0.3 : 0.85}
            strokeDasharray={condition === "missing" ? "3,2" : "none"}
          />
        ) : (
          <path
            d="M14 30 C8 30, 4 26, 4 20 C4 14, 6 8, 10 4 C12 2, 16 2, 18 4 C22 8, 24 14, 24 20 C24 26, 20 30, 14 30Z"
            fill={condition === "missing" ? "none" : info.color}
            stroke={info.color}
            strokeWidth="1.5"
            opacity={condition === "missing" ? 0.3 : 0.85}
            strokeDasharray={condition === "missing" ? "3,2" : "none"}
          />
        )}
        {condition === "endodontic" && (
          <line x1="10" y1="10" x2="18" y2="22" stroke="white" strokeWidth="2" />
        )}
        {condition === "crown" && (
          <circle cx="14" cy="16" r="5" fill="none" stroke="white" strokeWidth="1.5" />
        )}
        {condition === "implant" && (
          <rect x="12" y="8" width="4" height="16" fill="white" opacity="0.6" rx="1" />
        )}
      </svg>
      <span className="text-[9px] font-mono font-bold text-muted-foreground">{number}</span>
    </button>
  );
}

export function OdontogramaEmbed({ tenantId, patientId, professionalId, appointmentId, readOnly = false }: Props) {
  const [teeth, setTeeth] = useState<Map<number, ToothRecord>>(new Map());
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ condition: "healthy", surfaces: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOdontogramId, setCurrentOdontogramId] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId && patientId) {
      void loadLatestOdontogram();
    }
  }, [tenantId, patientId]);

  const loadLatestOdontogram = async () => {
    setIsLoading(true);
    try {
      const { data: odontograms, error } = await supabase
        .rpc('get_client_odontograms', {
          p_tenant_id: tenantId,
          p_client_id: patientId
        });

      if (error) throw error;

      if (odontograms && odontograms.length > 0) {
        const latest = odontograms[0];
        setCurrentOdontogramId(latest.id);
        
        const { data: teethData } = await supabase
          .rpc('get_odontogram_teeth', { p_odontogram_id: latest.id });

        const map = new Map<number, ToothRecord>();
        for (const t of (teethData || [])) {
          map.set(t.tooth_number, {
            tooth_number: t.tooth_number,
            condition: t.condition,
            surfaces: t.surfaces || undefined,
            notes: t.notes || undefined,
          });
        }
        setTeeth(map);
      }
    } catch (err) {
      console.error('Erro ao carregar odontograma:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openToothDialog = (tooth: number) => {
    if (readOnly) return;
    setSelectedTooth(tooth);
    const existing = teeth.get(tooth);
    setForm({
      condition: existing?.condition ?? "healthy",
      surfaces: existing?.surfaces ?? "",
      notes: existing?.notes ?? "",
    });
    setDialog(true);
  };

  const handleSaveTooth = () => {
    if (selectedTooth == null) return;
    const next = new Map(teeth);
    next.set(selectedTooth, {
      tooth_number: selectedTooth,
      condition: form.condition,
      surfaces: form.surfaces || undefined,
      notes: form.notes || undefined,
    });
    setTeeth(next);
    setDialog(false);
    toast.success(`Dente ${selectedTooth} atualizado`);
  };

  const handleRemoveTooth = (tooth: number) => {
    if (readOnly) return;
    const next = new Map(teeth);
    next.delete(tooth);
    setTeeth(next);
  };

  const handleSaveOdontogram = async () => {
    if (readOnly) return;
    setIsSaving(true);
    
    try {
      const teethArray = Array.from(teeth.values()).map(t => ({
        tooth_number: t.tooth_number,
        condition: t.condition,
        surfaces: t.surfaces || null,
        notes: t.notes || null,
        procedure_date: null,
      }));

      const { error } = await supabase
        .rpc('create_odontogram_with_teeth', {
          p_tenant_id: tenantId,
          p_client_id: patientId,
          p_professional_id: professionalId,
          p_appointment_id: appointmentId || null,
          p_exam_date: new Date().toISOString().split('T')[0],
          p_notes: `Odontograma: ${teethArray.length} dente(s) registrado(s)`,
          p_teeth: teethArray
        });

      if (error) throw error;

      toast.success("Odontograma salvo com sucesso");
      await loadLatestOdontogram();
    } catch (err: any) {
      console.error('Erro ao salvar odontograma:', err);
      toast.error(err.message || "Erro ao salvar odontograma");
    } finally {
      setIsSaving(false);
    }
  };

  const getToothCondition = (num: number) => teeth.get(num)?.condition ?? "healthy";
  const records = Array.from(teeth.values()).sort((a, b) => a.tooth_number - b.tooth_number);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando odontograma...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Smile className="h-4 w-4" />
                Odontograma
              </CardTitle>
              <CardDescription>Mapa dental do paciente</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/odontograma">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir Completo
                </Link>
              </Button>
              {!readOnly && records.length > 0 && (
                <Button size="sm" onClick={handleSaveOdontogram} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Smile className="h-3 w-3 mr-1" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted-foreground font-semibold">Arcada Superior</div>
            <div className="flex flex-wrap justify-center gap-0">
              {UPPER_TEETH.map(num => (
                <ToothIcon
                  key={num}
                  number={num}
                  condition={getToothCondition(num)}
                  isSelected={selectedTooth === num}
                  onClick={() => openToothDialog(num)}
                  disabled={readOnly}
                />
              ))}
            </div>

            <div className="w-full max-w-md border-t my-1" />

            <div className="flex flex-wrap justify-center gap-0">
              {LOWER_TEETH.map(num => (
                <ToothIcon
                  key={num}
                  number={num}
                  condition={getToothCondition(num)}
                  isSelected={selectedTooth === num}
                  onClick={() => openToothDialog(num)}
                  disabled={readOnly}
                />
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">Arcada Inferior</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {TOOTH_CONDITIONS.map(c => (
              <div key={c.value} className="flex items-center gap-1 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registros ({records.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Dente</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Obs</TableHead>
                  {!readOnly && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => {
                  const info = getConditionInfo(r.condition);
                  return (
                    <TableRow key={r.tooth_number}>
                      <TableCell className="font-mono font-bold text-sm">{r.tooth_number}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: info.color, color: "white" }} className="text-[10px]">
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.surfaces || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{r.notes || "—"}</TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveTooth(r.tooth_number)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dente {selectedTooth}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Condição</Label>
              <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOOTH_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Face / Superfície</Label>
              <Input
                value={form.surfaces}
                onChange={e => setForm({ ...form, surfaces: e.target.value })}
                placeholder="Ex: V, L, M, D, O..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveTooth}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
