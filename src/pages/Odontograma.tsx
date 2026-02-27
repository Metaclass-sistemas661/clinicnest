import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Smile, Trash2, Search, Loader2, History, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

// ─── Tooth data ──────────────────────────────────────────────────────────────

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
  procedure_date?: string;
}

interface OdontogramEntry {
  id: string;
  exam_date: string;
  notes: string | null;
  professional_name: string | null;
  tooth_count: number;
  created_at: string;
}

interface ClientOption {
  id: string;
  name: string;
}

function getConditionInfo(condition: string) {
  return TOOTH_CONDITIONS.find(c => c.value === condition) ?? TOOTH_CONDITIONS[0];
}

// ─── Tooth SVG Component ─────────────────────────────────────────────────────

function ToothIcon({ number, condition, isSelected, onClick }: {
  number: number;
  condition: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const info = getConditionInfo(condition);
  const isUpper = number <= 28;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all hover:scale-110 ${
        isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-muted"
      }`}
      title={`Dente ${number} — ${info.label}`}
    >
      <svg width="28" height="32" viewBox="0 0 28 32">
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
      <span className="text-[10px] font-mono font-bold text-muted-foreground">{number}</span>
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Odontograma() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [teeth, setTeeth] = useState<Map<number, ToothRecord>>(new Map());
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ condition: "healthy", surfaces: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<OdontogramEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentOdontogramId, setCurrentOdontogramId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant_id && clientSearch.length >= 2) {
      void searchClients();
    }
  }, [clientSearch, profile?.tenant_id]);

  const searchClients = async () => {
    if (!profile?.tenant_id) return;
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .eq("tenant_id", profile.tenant_id)
      .ilike("name", `%${clientSearch}%`)
      .limit(20);
    setClients((data ?? []) as ClientOption[]);
  };

  const handleSelectClient = async (clientId: string) => {
    setSelectedClient(clientId);
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    try {
      // Busca histórico de odontogramas usando a RPC
      const { data: odontograms, error } = await supabase
        .rpc('get_client_odontograms', {
          p_tenant_id: profile.tenant_id,
          p_client_id: clientId
        });

      if (error) throw error;

      const entries: OdontogramEntry[] = (odontograms || []).map((o: any) => ({
        id: o.id,
        exam_date: o.exam_date,
        notes: o.notes,
        professional_name: o.professional_name,
        tooth_count: Number(o.tooth_count),
        created_at: o.created_at,
      }));

      setHistoryEntries(entries);
      
      if (entries.length > 0) {
        setHistoryIndex(0);
        setCurrentOdontogramId(entries[0].id);
        await loadOdontogramTeeth(entries[0].id);
      } else {
        setHistoryIndex(-1);
        setCurrentOdontogramId(null);
        setTeeth(new Map());
      }
    } catch (err) {
      logger.error('Erro ao carregar odontogramas:', err);
      toast.error("Erro ao carregar histórico de odontogramas");
    } finally {
      setIsLoading(false);
    }
  };

  const loadOdontogramTeeth = async (odontogramId: string) => {
    const { data: teethData, error } = await supabase
      .rpc('get_odontogram_teeth', { p_odontogram_id: odontogramId });

    if (error) {
      logger.error('Erro ao carregar dentes:', error);
      return;
    }

    const map = new Map<number, ToothRecord>();
    for (const t of (teethData || [])) {
      map.set(t.tooth_number, {
        tooth_number: t.tooth_number,
        condition: t.condition,
        surfaces: t.surfaces || undefined,
        notes: t.notes || undefined,
        procedure_date: t.procedure_date || undefined,
      });
    }
    setTeeth(map);
  };

  const navigateHistory = async (index: number) => {
    if (index < 0 || index >= historyEntries.length) return;
    setHistoryIndex(index);
    const entry = historyEntries[index];
    setCurrentOdontogramId(entry.id);
    await loadOdontogramTeeth(entry.id);
  };

  const openToothDialog = (tooth: number) => {
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
    const next = new Map(teeth);
    next.delete(tooth);
    setTeeth(next);
  };

  const handleSaveOdontogram = async () => {
    if (!profile?.tenant_id || !selectedClient) return;
    setIsSaving(true);
    
    try {
      const teethArray = Array.from(teeth.values()).map(t => ({
        tooth_number: t.tooth_number,
        condition: t.condition,
        surfaces: t.surfaces || null,
        notes: t.notes || null,
        procedure_date: t.procedure_date || null,
      }));

      // Usa a RPC para criar odontograma com dentes em uma transação
      const { data: newOdontogramId, error } = await supabase
        .rpc('create_odontogram_with_teeth', {
          p_tenant_id: profile.tenant_id,
          p_client_id: selectedClient,
          p_professional_id: profile.id,
          p_appointment_id: null,
          p_exam_date: new Date().toISOString().split('T')[0],
          p_notes: `Odontograma: ${teethArray.length} dente(s) registrado(s)`,
          p_teeth: teethArray
        });

      if (error) throw error;

      toast.success("Odontograma salvo com sucesso");
      
      // Recarrega o histórico
      await handleSelectClient(selectedClient);
    } catch (err: any) {
      logger.error('Erro ao salvar odontograma:', err);
      toast.error(err.message || "Erro ao salvar odontograma");
    } finally {
      setIsSaving(false);
    }
  };

  const getToothCondition = (num: number) => teeth.get(num)?.condition ?? "healthy";

  const records = Array.from(teeth.values()).sort((a, b) => a.tooth_number - b.tooth_number);
  const isViewingOldVersion = historyIndex > 0;

  return (
    <MainLayout
      title="Odontograma"
      subtitle="Prontuário odontológico visual — mapa interativo dos dentes"
    >
      {/* Patient selector */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar Paciente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Digite o nome do paciente..."
                  className="pl-10"
                />
              </div>
            </div>
            {clients.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Paciente</Label>
                <Select value={selectedClient} onValueChange={(v) => void handleSelectClient(v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedClient && !isViewingOldVersion && (
              <Button 
                onClick={() => void handleSaveOdontogram()} 
                disabled={isSaving || records.length === 0} 
                className="gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smile className="h-4 w-4" />}
                Salvar Odontograma
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card className="mb-6">
          <CardContent className="py-8 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Carregando odontogramas...</span>
          </CardContent>
        </Card>
      )}

      {/* History Navigation */}
      {selectedClient && historyEntries.length > 0 && !isLoading && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Histórico</span>
                <Badge variant="outline" className="text-xs">{historyEntries.length} registro(s)</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7" 
                  disabled={historyIndex >= historyEntries.length - 1}
                  onClick={() => navigateHistory(historyIndex + 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[140px] text-center">
                  {historyIndex === 0 ? "Atual" : new Date(historyEntries[historyIndex]?.exam_date).toLocaleDateString("pt-BR")}
                  {" · "}{historyEntries[historyIndex]?.tooth_count || 0} dente(s)
                </span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7" 
                  disabled={historyIndex <= 0}
                  onClick={() => navigateHistory(historyIndex - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isViewingOldVersion && (
              <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Visualizando registro de {new Date(historyEntries[historyIndex]?.exam_date).toLocaleDateString("pt-BR")} 
                  {historyEntries[historyIndex]?.professional_name && ` por ${historyEntries[historyIndex].professional_name}`}
                  . Para editar, volte ao registro atual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dental chart */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mapa Dental</CardTitle>
          <CardDescription>Clique em um dente para registrar sua condição.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2">
            {/* Upper arch */}
            <div className="text-xs text-muted-foreground font-semibold mb-1">Arcada Superior</div>
            <div className="flex flex-wrap justify-center gap-0.5">
              {UPPER_TEETH.map(num => (
                <ToothIcon
                  key={num}
                  number={num}
                  condition={getToothCondition(num)}
                  isSelected={selectedTooth === num}
                  onClick={() => !isViewingOldVersion && openToothDialog(num)}
                />
              ))}
            </div>

            <div className="w-full max-w-lg border-t my-2" />

            {/* Lower arch */}
            <div className="flex flex-wrap justify-center gap-0.5">
              {LOWER_TEETH.map(num => (
                <ToothIcon
                  key={num}
                  number={num}
                  condition={getToothCondition(num)}
                  isSelected={selectedTooth === num}
                  onClick={() => !isViewingOldVersion && openToothDialog(num)}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground font-semibold mt-1">Arcada Inferior</div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {TOOTH_CONDITIONS.map(c => (
              <div key={c.value} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Records table */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registros ({records.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dente</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Observações</TableHead>
                  {!isViewingOldVersion && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => {
                  const info = getConditionInfo(r.condition);
                  return (
                    <TableRow key={r.tooth_number}>
                      <TableCell className="font-mono font-bold">{r.tooth_number}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: info.color, color: "white" }}>{info.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.surfaces || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.notes || "—"}</TableCell>
                      {!isViewingOldVersion && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveTooth(r.tooth_number)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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

      {/* Empty state */}
      {selectedClient && !isLoading && records.length === 0 && historyEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smile className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum odontograma registrado</h3>
            <p className="text-sm text-muted-foreground">
              Clique nos dentes acima para registrar as condições e depois salve o odontograma.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tooth dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dente {selectedTooth}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Condição</Label>
              <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOOTH_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Face / Superfície</Label>
              <Input
                value={form.surfaces}
                onChange={e => setForm({ ...form, surfaces: e.target.value })}
                placeholder="Ex: V, L, M, D, O..."
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes do tratamento..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTooth}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
