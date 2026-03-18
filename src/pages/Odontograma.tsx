import { Spinner } from "@/components/ui/spinner";
/**
 * Odontograma — Página principal do módulo odontológico profissional
 * 
 * Features:
 * - Diagrama de 5 faces por dente (padrão ISO/FDI)
 * - Toggle dentição: Adulto / Decídua / Mista
 * - 33 condições categorizadas (status, patologia, tratamento, protético, anomalia)
 * - Grau de mobilidade, prioridade, material de restauração
 * - Navegação pelo histórico de odontogramas
 * - Modo de comparação entre versões
 * - Tabela de registros com filtros
 * - Estatísticas rápidas
 * @module
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Smile, Trash2, Search, Loader2, History, ChevronLeft, ChevronRight,
  AlertTriangle, Plus, GitCompare, FileDown, ClipboardList,
  Undo2, Redo2, Filter, Zap, LayoutTemplate,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

import { OdontogramChart, type ToothRecord } from "@/components/odontograma/OdontogramChart";
import { ToothEditDialog, type ToothFormData } from "@/components/odontograma/ToothEditDialog";
import {
  TOOTH_CONDITIONS,
  type DentitionType,
  type ToothConditionKey,
} from "@/components/odontograma/odontogramConstants";
import { generateOdontogramPdf } from "@/utils/odontogramPdf";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { cn } from "@/lib/utils";
/** Condições que requerem tratamento e devem ser sugeridas no plano */
const TREATABLE_CONDITIONS: Set<ToothConditionKey> = new Set([
  "caries", "fracture", "extraction", "abscess", "periapical",
  "root_remnant", "resorption", "fistula", "mobility", "recession",
  "erosion", "abrasion", "temporary",
]);

/** Mapeamento padrão condição → procedimento sugerido para o plano de tratamento */
const CONDITION_PROCEDURE_MAP: Record<string, { name: string; code?: string }> = {
  caries:       { name: "Restauração direta" },
  fracture:     { name: "Restauração / Reabilitação" },
  extraction:   { name: "Exodontia" },
  abscess:      { name: "Drenagem de abscesso + Endodontia" },
  periapical:   { name: "Tratamento endodôntico" },
  root_remnant: { name: "Exodontia de resto radicular" },
  resorption:   { name: "Avaliação endodôntica" },
  fistula:      { name: "Tratamento endodôntico + Drenagem" },
  mobility:     { name: "Contenção + Avaliação periodontal" },
  recession:    { name: "Cirurgia periodontal" },
  erosion:      { name: "Restauração" },
  abrasion:     { name: "Restauração" },
  temporary:    { name: "Restauração definitiva" },
};

/** F20: Templates de condição pré-configurados */
const CONDITION_TEMPLATES: Array<{
  label: string;
  description: string;
  apply: () => Array<{ tooth: number; condition: ToothConditionKey }>;
}> = [
  {
    label: "Prótese Total Superior",
    description: "Marcar dentes 11-18 e 21-28 como ausentes",
    apply: () => {
      const teeth: Array<{ tooth: number; condition: ToothConditionKey }> = [];
      for (const num of [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28]) {
        teeth.push({ tooth: num, condition: "missing" });
      }
      return teeth;
    },
  },
  {
    label: "Prótese Total Inferior",
    description: "Marcar dentes 31-38 e 41-48 como ausentes",
    apply: () => {
      const teeth: Array<{ tooth: number; condition: ToothConditionKey }> = [];
      for (const num of [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]) {
        teeth.push({ tooth: num, condition: "missing" });
      }
      return teeth;
    },
  },
  {
    label: "Prótese Total Bimaxilar",
    description: "Marcar todos os dentes como ausentes",
    apply: () => {
      const teeth: Array<{ tooth: number; condition: ToothConditionKey }> = [];
      for (const num of [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]) {
        teeth.push({ tooth: num, condition: "missing" });
      }
      return teeth;
    },
  },
  {
    label: "Classe III Kennedy Sup. (post. bilateral)",
    description: "Molares superiores ausentes bilateral",
    apply: () => [
      { tooth: 16, condition: "missing" as ToothConditionKey },
      { tooth: 17, condition: "missing" as ToothConditionKey },
      { tooth: 18, condition: "missing" as ToothConditionKey },
      { tooth: 26, condition: "missing" as ToothConditionKey },
      { tooth: 27, condition: "missing" as ToothConditionKey },
      { tooth: 28, condition: "missing" as ToothConditionKey },
    ],
  },
  {
    label: "Selantes em Primeiros Molares (jovem)",
    description: "Aplicar selante nos dentes 16, 26, 36, 46",
    apply: () => [
      { tooth: 16, condition: "sealant" as ToothConditionKey },
      { tooth: 26, condition: "sealant" as ToothConditionKey },
      { tooth: 36, condition: "sealant" as ToothConditionKey },
      { tooth: 46, condition: "sealant" as ToothConditionKey },
    ],
  },
];

/** F10: Protocolo de tratamento automático — sequência sugerida por condição */
const AUTO_PROTOCOL: Record<string, string[]> = {
  caries: ["Anestesia local", "Remoção de cárie", "Restauração direta"],
  abscess: ["Drenagem de abscesso", "Antibioticoterapia", "Tratamento endodôntico", "Restauração definitiva"],
  periapical: ["Tratamento endodôntico", "Pino de fibra de vidro", "Coroa protética"],
  root_remnant: ["Exodontia de resto radicular", "Alveoloplastia", "Planejamento protético"],
  fracture: ["Avaliação de viabilidade", "Restauração / Coroa", "Controle radiográfico"],
  mobility: ["Avaliação periodontal", "Contenção provisória", "Tratamento periodontal"],
  recession: ["Avaliação periodontal", "Enxerto gengival / Cirurgia mucogengival", "Manutenção periodontal"],
  erosion: ["Orientação de higiene e dieta", "Restauração", "Aplicação de flúor"],
  fistula: ["Tratamento endodôntico", "Drenagem", "Controle radiográfico"],
};
// ─── Types ───────────────────────────────────────────────────────────────────

interface OdontogramEntry {
  id: string;
  exam_date: string;
  notes: string | null;
  professional_name: string | null;
  tooth_count: number;
  created_at: string;
  dentition_type?: string;
}

interface PatientOption {
  id: string;
  name: string;
}

function getConditionInfo(condition: string) {
  return TOOTH_CONDITIONS.find(c => c.value === condition) ?? TOOTH_CONDITIONS[0];
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function Odontograma() {
  const { profile, tenant } = useAuth();
  const navigate = useNavigate();

  // Patient selection
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");

  // Odontogram state
  const [teeth, setTeeth] = useState<Map<number, ToothRecord>>(new Map());
  const [dentitionType, setDentitionType] = useState<DentitionType>("permanent");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothDialogOpen, setToothDialogOpen] = useState(false);

  // Save / load
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // History
  const [historyEntries, setHistoryEntries] = useState<OdontogramEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Comparison mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareTeeth, setCompareTeeth] = useState<Map<number, ToothRecord>>(new Map());
  const [compareIndex, setCompareIndex] = useState(-1);

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyTeeth, setDirtyTeeth] = useState<Set<number>>(new Set()); // U7

  // U4: Undo/Redo
  const [undoStack, setUndoStack] = useState<Map<number, ToothRecord>[]>([]);
  const [redoStack, setRedoStack] = useState<Map<number, ToothRecord>[]>([]);
  const MAX_UNDO = 50;

  // U8: Condition filter
  const [conditionFilter, setConditionFilter] = useState<ToothConditionKey | null>(null);

  // F20: Templates dialog
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  // F10: Protocol suggestion
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [protocolTooth, setProtocolTooth] = useState<ToothRecord | null>(null);

  // Treatment plan dialog
  const [treatmentPlanDialogOpen, setTreatmentPlanDialogOpen] = useState(false);
  const [treatmentPlanSelectedTeeth, setTreatmentPlanSelectedTeeth] = useState<Set<number>>(new Set());
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // ── Load odontograms for patient ──
  /** Pushes current teeth state to undo stack before mutation */
  const pushUndo = useCallback(() => {
    setUndoStack(prev => {
      const next = [...prev, new Map(teeth)];
      return next.length > MAX_UNDO ? next.slice(-MAX_UNDO) : next;
    });
    setRedoStack([]); // clear redo on new change
  }, [teeth]);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setRedoStack(r => [...r, new Map(teeth)]);
      setTeeth(last);
      setIsDirty(true);
      return next;
    });
  }, [teeth]);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setUndoStack(u => [...u, new Map(teeth)]);
      setTeeth(last);
      setIsDirty(true);
      return next;
    });
  }, [teeth]);

  // U4: Keyboard shortcut for Undo/Redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const handleSelectPatient = useCallback(async (patientId: string) => {
    setSelectedPatient(patientId);
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    setIsDirty(false);
    setCompareMode(false);
    try {
      const { data: odontograms, error } = await (supabase
        .rpc as any)("get_client_odontograms", {
          p_tenant_id: profile.tenant_id,
          p_client_id: patientId,
        });

      if (error) throw error;

      const entries: OdontogramEntry[] = ((odontograms as any[]) || []).map((o: any) => ({
        id: o.id,
        exam_date: o.exam_date,
        notes: o.notes,
        professional_name: o.professional_name,
        tooth_count: Number(o.tooth_count),
        created_at: o.created_at,
        dentition_type: o.dentition_type,
      }));

      setHistoryEntries(entries);

      if (entries.length > 0) {
        setHistoryIndex(0);
        setDentitionType((entries[0].dentition_type as DentitionType) || "permanent");
        await loadOdontogramTeeth(entries[0].id);
      } else {
        setHistoryIndex(-1);
        setTeeth(new Map());
      }
    } catch (err) {
      logger.error("Erro ao carregar odontogramas:", err);
      toast.error("Erro ao carregar histórico de odontogramas");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  // ── Load teeth for a specific odontogram ──
  const loadOdontogramTeeth = async (odontogramId: string) => {
    const { data: teethData, error } = await (supabase
      .rpc as any)("get_odontogram_teeth", { p_odontogram_id: odontogramId });

    if (error) {
      logger.error("Erro ao carregar dentes:", error);
      return;
    }

    const map = new Map<number, ToothRecord>();
    for (const t of (teethData as any[]) || []) {
      map.set(t.tooth_number, {
        tooth_number: t.tooth_number,
        condition: (t.condition || "healthy") as ToothConditionKey,
        surfaces: t.surfaces || undefined,
        notes: t.notes || undefined,
        procedure_date: t.procedure_date || undefined,
        mobility_grade: t.mobility_grade ?? null,
        priority: t.priority || "normal",
      });
    }
    setTeeth(map);
  };

  // ── History navigation ──
  const navigateHistory = async (index: number) => {
    if (index < 0 || index >= historyEntries.length) return;
    if (isDirty && index !== 0) {
      const ok = window.confirm("Há alterações não salvas. Deseja descartá-las?");
      if (!ok) return;
    }
    setHistoryIndex(index);
    setIsDirty(false);
    const entry = historyEntries[index];
    setDentitionType((entry.dentition_type as DentitionType) || "permanent");
    await loadOdontogramTeeth(entry.id);
  };

  const isViewingOldVersion = historyIndex > 0;

  // ── Tooth dialog ──
  const openToothDialog = (toothNumber: number) => {
    if (isViewingOldVersion) return;
    setSelectedTooth(toothNumber);
    setToothDialogOpen(true);
  };

  const handleSaveTooth = (data: ToothFormData) => {
    if (selectedTooth == null) return;
    pushUndo();
    const next = new Map(teeth);
    next.set(selectedTooth, {
      tooth_number: selectedTooth,
      condition: data.condition,
      surfaces: data.surfaces || undefined,
      notes: data.notes || undefined,
      procedure_date: data.procedure_date || undefined,
      mobility_grade: data.mobility_grade,
      priority: data.priority || "normal",
    });
    setTeeth(next);
    setIsDirty(true);
    setDirtyTeeth(prev => new Set(prev).add(selectedTooth));
    setToothDialogOpen(false);
    toast.success(`Dente ${selectedTooth} atualizado`);

    // F10: Show protocol suggestion if condition has a protocol
    const cond = data.condition;
    if (AUTO_PROTOCOL[cond]) {
      setProtocolTooth({
        tooth_number: selectedTooth,
        condition: cond,
        priority: data.priority || "normal",
      });
      setProtocolDialogOpen(true);
    }
  };

  const handleRemoveTooth = () => {
    if (selectedTooth == null) return;
    pushUndo();
    const next = new Map(teeth);
    next.delete(selectedTooth);
    setTeeth(next);
    setIsDirty(true);
    setDirtyTeeth(prev => new Set(prev).add(selectedTooth));
    setToothDialogOpen(false);
    toast.success(`Dente ${selectedTooth} removido`);
  };

  // ── Save odontogram ──
  const handleSaveOdontogram = async () => {
    if (!profile?.tenant_id || !selectedPatient) return;
    setIsSaving(true);

    try {
      const teethArray = Array.from(teeth.values()).map(t => ({
        tooth_number: t.tooth_number,
        condition: t.condition,
        surfaces: t.surfaces || null,
        notes: t.notes || null,
        procedure_date: t.procedure_date || null,
        mobility_grade: t.mobility_grade ?? null,
        priority: t.priority || "normal",
      }));

      const { error } = await (supabase
        .rpc as any)("create_odontogram_with_teeth", {
          p_tenant_id: profile.tenant_id,
          p_client_id: selectedPatient,
          p_professional_id: profile.id,
          p_appointment_id: null,
          p_exam_date: new Date().toISOString().split("T")[0],
          p_notes: `Odontograma: ${teethArray.length} dente(s) — Dentição: ${dentitionType}`,
          p_teeth: teethArray,
          p_dentition_type: dentitionType,
        });

      if (error) throw error;

      toast.success("Odontograma salvo com sucesso!");
      setIsDirty(false);
      setDirtyTeeth(new Set());
      setUndoStack([]);
      setRedoStack([]);
      await handleSelectPatient(selectedPatient);
    } catch (err: any) {
      logger.error("Erro ao salvar odontograma:", err);
      toast.error(err.message || "Erro ao salvar odontograma");
    } finally {
      setIsSaving(false);
    }
  };

  // ── New odontogram ──
  const handleNewOdontogram = () => {
    if (isDirty) {
      const ok = window.confirm("Há alterações não salvas. Deseja criar um novo odontograma?");
      if (!ok) return;
    }
    setTeeth(new Map());
    setHistoryIndex(-1);
    setIsDirty(false);
    setCompareMode(false);
    toast.info("Novo odontograma iniciado. Clique nos dentes para registrar.");
  };

  // ── Comparison mode ──
  const toggleCompareMode = async () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareTeeth(new Map());
      setCompareIndex(-1);
      return;
    }

    if (historyEntries.length < 2) {
      toast.warning("É necessário pelo menos 2 odontogramas para comparar.");
      return;
    }

    const compareWithIdx = historyIndex === 0 ? 1 : 0;
    setCompareMode(true);
    setCompareIndex(compareWithIdx);

    const { data: teethData } = await (supabase
      .rpc as any)("get_odontogram_teeth", { p_odontogram_id: historyEntries[compareWithIdx].id });

    const map = new Map<number, ToothRecord>();
    for (const t of (teethData as any[]) || []) {
      map.set(t.tooth_number, {
        tooth_number: t.tooth_number,
        condition: (t.condition || "healthy") as ToothConditionKey,
        surfaces: t.surfaces || undefined,
        notes: t.notes || undefined,
        mobility_grade: t.mobility_grade ?? null,
        priority: t.priority || "normal",
      });
    }
    setCompareTeeth(map);
  };

  // ── Computed data ──
  const records = useMemo(
    () => Array.from(teeth.values()).sort((a, b) => a.tooth_number - b.tooth_number),
    [teeth]
  );

  const selectedToothData = useMemo(
    () => (selectedTooth != null ? teeth.get(selectedTooth) : undefined),
    [selectedTooth, teeth]
  );

  const diffs = useMemo(() => {
    if (!compareMode) return [];
    const changes: Array<{ tooth: number; from: string; to: string }> = [];
    const allTeeth = new Set([...teeth.keys(), ...compareTeeth.keys()]);
    for (const num of allTeeth) {
      const current = teeth.get(num)?.condition ?? "healthy";
      const previous = compareTeeth.get(num)?.condition ?? "healthy";
      if (current !== previous) {
        changes.push({
          tooth: num,
          from: getConditionInfo(previous).label,
          to: getConditionInfo(current).label,
        });
      }
    }
    return changes.sort((a, b) => a.tooth - b.tooth);
  }, [teeth, compareTeeth, compareMode]);

  /** F6: Set of tooth numbers that differ between versions */
  const diffTeeth = useMemo(() => {
    if (!compareMode) return new Set<number>();
    return new Set(diffs.map(d => d.tooth));
  }, [diffs, compareMode]);

  /** Dentes com condições que requerem tratamento */
  const treatableTeeth = useMemo(
    () => records.filter(r => TREATABLE_CONDITIONS.has(r.condition)),
    [records]
  );

  /** Abre o dialog de criação de plano de tratamento */
  const openTreatmentPlanDialog = () => {
    setTreatmentPlanSelectedTeeth(new Set(treatableTeeth.map(t => t.tooth_number)));
    setTreatmentPlanDialogOpen(true);
  };

  /** F20: Apply a condition template */
  const handleApplyTemplate = (templateIndex: number) => {
    const template = CONDITION_TEMPLATES[templateIndex];
    if (!template) return;
    pushUndo();
    const next = new Map(teeth);
    const dirtySet = new Set(dirtyTeeth);
    for (const { tooth, condition } of template.apply()) {
      next.set(tooth, {
        tooth_number: tooth,
        condition,
        priority: "normal",
      });
      dirtySet.add(tooth);
    }
    setTeeth(next);
    setDirtyTeeth(dirtySet);
    setIsDirty(true);
    setTemplatesDialogOpen(false);
    toast.success(`Template "${template.label}" aplicado`);
  };

  /** Cria o plano de tratamento no Supabase e navega para a página */
  const handleCreateTreatmentPlan = async () => {
    if (!profile?.tenant_id || !selectedPatient) return;

    const selected = treatableTeeth.filter(t => treatmentPlanSelectedTeeth.has(t.tooth_number));
    if (selected.length === 0) {
      toast.error("Selecione pelo menos 1 dente.");
      return;
    }

    setIsCreatingPlan(true);
    try {
      // 1. Criar o plano
      const { data: plan, error: planError } = await (supabase.from("treatment_plans") as any)
        .insert({
          tenant_id: profile.tenant_id,
          patient_id: selectedPatient,
          professional_id: profile.id,
          title: `Plano Odontograma — ${new Date().toLocaleDateString("pt-BR")}`,
          description: `Plano gerado a partir do odontograma com ${selected.length} dente(s) identificado(s).`,
        })
        .select()
        .single();

      if (planError || !plan) throw planError ?? new Error("Falha ao criar plano");

      // 2. Inserir os itens (1 por dente)
      const items = selected.map(tooth => {
        const proc = CONDITION_PROCEDURE_MAP[tooth.condition] ?? { name: getConditionInfo(tooth.condition).label };
        return {
          plan_id: plan.id,
          tooth_number: tooth.tooth_number,
          surface: tooth.surfaces || null,
          procedure_name: proc.name,
          procedure_code: proc.code || null,
          unit_price: 0,
          quantity: 1,
          total_price: 0,
        };
      });

      const { error: itemsError } = await (supabase.from("treatment_plan_items") as any).insert(items);
      if (itemsError) throw itemsError;

      toast.success(`Plano criado com ${items.length} procedimento(s)! Preencha os valores na página de Planos.`);
      setTreatmentPlanDialogOpen(false);
      navigate("/planos-tratamento");
    } catch (err: any) {
      logger.error("Erro ao criar plano de tratamento:", err);
      toast.error(err.message || "Erro ao criar plano de tratamento");
    } finally {
      setIsCreatingPlan(false);
    }
  };

  // ── Render ──
  return (
    <MainLayout
      title="Odontograma"
      subtitle="Prontuário odontológico visual — diagrama interativo com 5 faces por dente"
    >
      {/* ── Patient selector ── */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar Paciente</Label>
              <PatientCombobox
                tenantId={profile?.tenant_id}
                value={selectedPatient}
                onSelect={(id, name) => {
                  if (id) {
                    setSelectedPatientName(name);
                    void handleSelectPatient(id);
                  } else {
                    setSelectedPatient("");
                    setSelectedPatientName("");
                  }
                }}
              />
            </div>
            {selectedPatient && (
              <div className="flex gap-2 flex-wrap">
                {/* U4: Undo/Redo */}
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} title="Desfazer (Ctrl+Z)" className="gap-1">
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleRedo} disabled={redoStack.length === 0} title="Refazer (Ctrl+Y)" className="gap-1">
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>

                <Button variant="outline" size="sm" onClick={handleNewOdontogram} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Novo
                </Button>

                {/* F20: Templates */}
                <Button variant="outline" size="sm" onClick={() => setTemplatesDialogOpen(true)} className="gap-1" title="Templates de condição">
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Templates
                </Button>
                {historyEntries.length >= 2 && (
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    onClick={toggleCompareMode}
                    className="gap-1"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    {compareMode ? "Sair Comparação" : "Comparar"}
                  </Button>
                )}
                {records.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      const patientName = selectedPatientName || "Paciente";
                      generateOdontogramPdf({
                        patient_name: patientName,
                        exam_date: historyEntries[historyIndex]?.exam_date ?? new Date().toISOString().slice(0, 10),
                        professional_name: profile?.full_name ?? "Profissional",
                        clinic_name: tenant?.name ?? "Clínica",
                        dentition_type: dentitionType,
                        notes: historyEntries[historyIndex]?.notes ?? null,
                        teeth: records.map(r => ({
                          tooth_number: r.tooth_number,
                          condition: r.condition,
                          surfaces: r.surfaces,
                          notes: r.notes,
                          mobility_grade: r.mobility_grade,
                          priority: r.priority,
                        })),
                      });
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                )}
                {treatableTeeth.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={openTreatmentPlanDialog}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Gerar Plano ({treatableTeeth.length})
                  </Button>
                )}
                {!isViewingOldVersion && (
                  <Button
                    onClick={() => void handleSaveOdontogram()}
                    disabled={isSaving || records.length === 0}
                    className="gap-2"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smile className="h-4 w-4" />}
                    Salvar
                    {isDirty && <Badge variant="destructive" className="ml-1 text-[10px] py-0">*</Badge>}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Loading ── */}
      {isLoading && (
        <Card className="mb-4">
          <CardContent className="py-8 flex items-center justify-center gap-2">
            <Spinner size="sm" className="text-muted-foreground" />
            <span className="text-muted-foreground">Carregando odontogramas...</span>
          </CardContent>
        </Card>
      )}

      {/* ── History Navigation ── */}
      {selectedPatient && historyEntries.length > 0 && !isLoading && (
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Histórico</span>
                <Badge variant="outline" className="text-xs">{historyEntries.length} registro(s)</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={historyIndex >= historyEntries.length - 1}
                  onClick={() => navigateHistory(historyIndex + 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[140px] text-center">
                  {historyIndex === 0
                    ? "Atual"
                    : new Date(historyEntries[historyIndex]?.exam_date).toLocaleDateString("pt-BR")}
                  {" · "}{historyEntries[historyIndex]?.tooth_count || 0} dente(s)
                </span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={historyIndex <= 0}
                  onClick={() => navigateHistory(historyIndex - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isViewingOldVersion && (
              <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Visualizando registro de{" "}
                  {new Date(historyEntries[historyIndex]?.exam_date).toLocaleDateString("pt-BR")}
                  {historyEntries[historyIndex]?.professional_name &&
                    ` por ${historyEntries[historyIndex].professional_name}`}
                  . Volte ao registro atual para editar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dental Chart ── */}
      {!isLoading && selectedPatient && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smile className="h-4 w-4" />
              Mapa Dental
              {isDirty && (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                  Não salvo
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Clique em um dente para registrar condição, faces, mobilidade e prioridade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* U8: Condition filter */}
            {records.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filtrar:</span>
                <button
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border transition-colors",
                    conditionFilter === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onClick={() => setConditionFilter(null)}
                >
                  Todos
                </button>
                {Array.from(new Set(records.map(r => r.condition))).map(cond => {
                  const info = getConditionInfo(cond);
                  return (
                    <button
                      key={cond}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border transition-colors",
                        conditionFilter === cond ? "ring-2 ring-offset-1" : "hover:bg-muted"
                      )}
                      style={conditionFilter === cond ? { backgroundColor: info.color, color: "white" } : {}}
                      onClick={() => setConditionFilter(prev => prev === cond ? null : cond)}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            )}

            <OdontogramChart
              teeth={teeth}
              dentitionType={dentitionType}
              onDentitionChange={!isViewingOldVersion ? setDentitionType : undefined}
              selectedTooth={selectedTooth}
              onToothClick={(num) => setSelectedTooth(num)}
              onToothDoubleClick={!isViewingOldVersion ? openToothDialog : undefined}
              showLegend
              showStats
              readOnly={isViewingOldVersion}
              dirtyTeeth={dirtyTeeth}
              conditionFilter={conditionFilter}
              diffTeeth={diffTeeth}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Comparison ── */}
      {compareMode && compareTeeth.size > 0 && (
        <Card className="mb-4 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-blue-600" />
              Comparação com{" "}
              {new Date(historyEntries[compareIndex]?.exam_date).toLocaleDateString("pt-BR")}
            </CardTitle>
            <CardDescription>
              {diffs.length === 0
                ? "Nenhuma diferença encontrada."
                : `${diffs.length} alteração(ões) detectada(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OdontogramChart
              teeth={compareTeeth}
              dentitionType={dentitionType}
              selectedTooth={null}
              compact={false}
              readOnly
              showLegend={false}
              showStats={false}
              diffTeeth={diffTeeth}
            />

            {diffs.length > 0 && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Dente</TableHead>
                      <TableHead>Anterior</TableHead>
                      <TableHead>Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffs.map(d => (
                      <TableRow key={d.tooth}>
                        <TableCell className="font-mono font-bold">{d.tooth}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.from}</TableCell>
                        <TableCell className="text-sm font-medium">{d.to}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Records Table ── */}
      {records.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registros ({records.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Dente</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Faces</TableHead>
                  <TableHead className="hidden md:table-cell">Mobilidade</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead>Observações</TableHead>
                  {!isViewingOldVersion && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => {
                  const info = getConditionInfo(r.condition);
                  return (
                    <TableRow
                      key={r.tooth_number}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openToothDialog(r.tooth_number)}
                    >
                      <TableCell className="font-mono font-bold">{r.tooth_number}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: info.color, color: "white" }} className="text-xs">
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.surfaces || "—"}</TableCell>
                      <TableCell className="text-sm hidden md:table-cell">
                        {(r.mobility_grade ?? 0) > 0
                          ? <Badge variant="outline" className="text-xs">Grau {r.mobility_grade}</Badge>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell">
                        {r.priority && r.priority !== "normal"
                          ? <Badge
                              variant={r.priority === "urgent" ? "destructive" : "outline"}
                              className="text-xs capitalize"
                            >
                              {r.priority === "urgent" ? "Urgente" : r.priority === "high" ? "Alta" : r.priority === "low" ? "Baixa" : r.priority}
                            </Badge>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {r.notes || "—"}
                      </TableCell>
                      {!isViewingOldVersion && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              pushUndo();
                              const next = new Map(teeth);
                              next.delete(r.tooth_number);
                              setTeeth(next);
                              setIsDirty(true);
                              setDirtyTeeth(prev => new Set(prev).add(r.tooth_number));
                            }}
                          >
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

      {/* ── Empty state (U9: more informative) ── */}
      {selectedPatient && !isLoading && records.length === 0 && historyEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Smile className="h-16 w-16 mx-auto text-muted-foreground/40" />
            <div>
              <h3 className="text-lg font-medium mb-1">Nenhum odontograma registrado</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Este paciente ainda não possui prontuário odontológico. Clique nos dentes no mapa acima para
                registrar condições clínicas, depois salve para criar o primeiro odontograma.
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setTemplatesDialogOpen(true)} className="gap-1">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Usar Template
              </Button>
              <Button size="sm" className="gap-1" onClick={() => {
                const firstTooth = dentitionType === "deciduous" ? 55 : 18;
                openToothDialog(firstTooth);
              }}>
                <Plus className="h-3.5 w-3.5" />
                Começar Registro
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Dica: Use o toggle de dentição (Adulto / Infantil / Misto) para escolher o tipo de arcada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Tooth Edit Dialog ── */}
      <ToothEditDialog
        open={toothDialogOpen}
        onOpenChange={setToothDialogOpen}
        toothNumber={selectedTooth}
        initialData={selectedToothData ? {
          condition: selectedToothData.condition,
          surfaces: selectedToothData.surfaces,
          notes: selectedToothData.notes ?? "",
          procedure_date: selectedToothData.procedure_date ?? "",
          mobility_grade: selectedToothData.mobility_grade ?? null,
          priority: selectedToothData.priority ?? "normal",
        } : undefined}
        onSave={handleSaveTooth}
        onRemove={selectedTooth != null && teeth.has(selectedTooth) ? handleRemoveTooth : undefined}
      />

      {/* ── Treatment Plan Dialog ── */}
      <Dialog open={treatmentPlanDialogOpen} onOpenChange={setTreatmentPlanDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Gerar Plano de Tratamento
            </DialogTitle>
            <DialogDescription>
              Selecione os dentes com condições que requerem tratamento. Um plano será criado automaticamente com os procedimentos sugeridos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {treatmentPlanSelectedTeeth.size} de {treatableTeeth.length} dente(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTreatmentPlanSelectedTeeth(new Set(treatableTeeth.map(t => t.tooth_number)))}
                >
                  Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTreatmentPlanSelectedTeeth(new Set())}
                >
                  Nenhum
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-16">Dente</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Procedimento Sugerido</TableHead>
                  <TableHead className="w-20">Faces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treatableTeeth.map(tooth => {
                  const info = getConditionInfo(tooth.condition);
                  const proc = CONDITION_PROCEDURE_MAP[tooth.condition] ?? { name: info.label };
                  const checked = treatmentPlanSelectedTeeth.has(tooth.tooth_number);
                  return (
                    <TableRow key={tooth.tooth_number} className={!checked ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(treatmentPlanSelectedTeeth);
                            if (v) next.add(tooth.tooth_number);
                            else next.delete(tooth.tooth_number);
                            setTreatmentPlanSelectedTeeth(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-bold">{tooth.tooth_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                          {info.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{proc.name}</TableCell>
                      <TableCell className="font-mono text-xs">{tooth.surfaces || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTreatmentPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreateTreatmentPlan()}
              disabled={isCreatingPlan || treatmentPlanSelectedTeeth.size === 0}
              className="gap-2"
            >
              {isCreatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              Criar Plano ({treatmentPlanSelectedTeeth.size} itens)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── F20: Templates Dialog ── */}
      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              Templates de Condição
            </DialogTitle>
            <DialogDescription>
              Aplique templates pré-configurados para preencher rapidamente múltiplos dentes de uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {CONDITION_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/60 transition-colors"
                onClick={() => handleApplyTemplate(idx)}
              >
                <p className="font-medium text-sm">{tpl.label}</p>
                <p className="text-xs text-muted-foreground">{tpl.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── F10: Auto Protocol Suggestion Dialog ── */}
      <Dialog open={protocolDialogOpen} onOpenChange={setProtocolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Protocolo de Tratamento Sugerido
            </DialogTitle>
            <DialogDescription>
              {protocolTooth && (
                <>Dente {protocolTooth.tooth_number} — {getConditionInfo(protocolTooth.condition).label}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {protocolTooth && AUTO_PROTOCOL[protocolTooth.condition] && (
            <div className="py-2">
              <p className="text-sm font-medium mb-3">Sequência recomendada:</p>
              <ol className="space-y-2">
                {AUTO_PROTOCOL[protocolTooth.condition].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtocolDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
