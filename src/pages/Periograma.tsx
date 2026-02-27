import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Loader2, Save, History, ChevronLeft, ChevronRight,
  AlertTriangle, Download, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { generatePeriogramPdf } from "@/utils/periogramPdf";

// Constantes
const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const SITES = ["MV", "V", "DV", "ML", "L", "DL"] as const;
type Site = typeof SITES[number];

interface Measurement {
  tooth_number: number;
  site: Site;
  probing_depth: number | null;
  recession: number | null;
  bleeding: boolean;
  plaque: boolean;
  suppuration: boolean;
  mobility: number | null;
  furcation: number | null;
}

interface PeriogramSummary {
  id: string;
  exam_date: string;
  plaque_index: number | null;
  bleeding_index: number | null;
  avg_probing_depth: number | null;
  sites_over_4mm: number;
  sites_over_6mm: number;
  total_sites: number;
  periodontal_diagnosis: string | null;
  risk_classification: string | null;
  professional_name: string | null;
}

interface PatientOption {
  id: string;
  name: string;
}

function getDepthColor(depth: number | null): string {
  if (depth === null) return "#d1d5db";
  if (depth <= 3) return "#22c55e";
  if (depth <= 5) return "#eab308";
  return "#ef4444";
}

export default function Periograma() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [historyEntries, setHistoryEntries] = useState<PeriogramSummary[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [measurements, setMeasurements] = useState<Map<string, Measurement>>(new Map());
  
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [riskClass, setRiskClass] = useState("");

  useEffect(() => {
    if (profile?.tenant_id && patientSearch.length >= 2) {
      void searchPatients();
    }
  }, [patientSearch, profile?.tenant_id]);

  const searchPatients = async () => {
    if (!profile?.tenant_id) return;
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .eq("tenant_id", profile.tenant_id)
      .ilike("name", `%${patientSearch}%`)
      .limit(20);
    setPatients((data ?? []) as PatientOption[]);
  };

  const handleSelectPatient = async (patientId: string) => {
    setSelectedPatient(patientId);
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_client_periograms", {
        p_tenant_id: profile.tenant_id,
        p_client_id: patientId,
      });
      if (error) throw error;
      const entries = (data || []) as PeriogramSummary[];
      setHistoryEntries(entries);
      if (entries.length > 0) {
        setHistoryIndex(0);
        await loadPeriogramMeasurements(entries[0].id);
      } else {
        setHistoryIndex(-1);
        initEmptyMeasurements();
      }
    } catch (err) {
      logger.error("Erro ao carregar periogramas:", err);
      toast.error("Erro ao carregar histórico");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriogramMeasurements = async (periogramId: string) => {
    const { data, error } = await supabase.rpc("get_periogram_measurements", {
      p_periogram_id: periogramId,
    });
    if (error) {
      logger.error("Erro ao carregar medições:", error);
      return;
    }
    const map = new Map<string, Measurement>();
    for (const m of data || []) {
      const key = `${m.tooth_number}-${m.site}`;
      map.set(key, m as Measurement);
    }
    setMeasurements(map);
  };

  const initEmptyMeasurements = () => {
    const map = new Map<string, Measurement>();
    const allTeeth = [...UPPER_TEETH, ...LOWER_TEETH];
    for (const tooth of allTeeth) {
      for (const site of SITES) {
        const key = `${tooth}-${site}`;
        map.set(key, {
          tooth_number: tooth,
          site,
          probing_depth: null,
          recession: null,
          bleeding: false,
          plaque: false,
          suppuration: false,
          mobility: null,
          furcation: null,
        });
      }
    }
    setMeasurements(map);
    setNotes("");
    setDiagnosis("");
    setRiskClass("");
  };

  const navigateHistory = async (index: number) => {
    if (index < 0 || index >= historyEntries.length) return;
    setHistoryIndex(index);
    await loadPeriogramMeasurements(historyEntries[index].id);
  };

  const updateMeasurement = (key: string, field: keyof Measurement, value: any) => {
    setMeasurements(prev => {
      const next = new Map(prev);
      const m = next.get(key);
      if (m) {
        next.set(key, { ...m, [field]: value });
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!profile?.tenant_id || !selectedPatient) return;
    setIsSaving(true);
    try {
      const measurementsArray = Array.from(measurements.values())
        .filter(m => m.probing_depth !== null)
        .map(m => ({
          tooth_number: m.tooth_number,
          site: m.site,
          probing_depth: m.probing_depth,
          recession: m.recession,
          clinical_attachment_level: m.probing_depth && m.recession 
            ? m.probing_depth + m.recession : null,
          bleeding: m.bleeding,
          suppuration: m.suppuration,
          plaque: m.plaque,
          mobility: m.mobility,
          furcation: m.furcation,
        }));

      const { error } = await supabase.rpc("save_periogram_with_measurements", {
        p_tenant_id: profile.tenant_id,
        p_client_id: selectedPatient,
        p_professional_id: profile.id,
        p_appointment_id: null,
        p_exam_date: new Date().toISOString().split("T")[0],
        p_notes: notes || null,
        p_periodontal_diagnosis: diagnosis || null,
        p_risk_classification: riskClass || null,
        p_measurements: measurementsArray,
      });

      if (error) throw error;
      toast.success("Periograma salvo com sucesso");
      await handleSelectPatient(selectedPatient);
    } catch (err: any) {
      logger.error("Erro ao salvar:", err);
      toast.error(err.message || "Erro ao salvar periograma");
    } finally {
      setIsSaving(false);
    }
  };

  const calcIndices = useCallback(() => {
    const arr = Array.from(measurements.values()).filter(m => m.probing_depth !== null);
    if (arr.length === 0) return { plaque: 0, bleeding: 0, avgDepth: 0, over4: 0, over6: 0 };
    const plaque = (arr.filter(m => m.plaque).length / arr.length) * 100;
    const bleeding = (arr.filter(m => m.bleeding).length / arr.length) * 100;
    const avgDepth = arr.reduce((s, m) => s + (m.probing_depth || 0), 0) / arr.length;
    const over4 = arr.filter(m => (m.probing_depth || 0) > 4).length;
    const over6 = arr.filter(m => (m.probing_depth || 0) > 6).length;
    return { plaque, bleeding, avgDepth, over4, over6 };
  }, [measurements]);

  const indices = calcIndices();
  const isViewingOld = historyIndex > 0;

  const handleExportPdf = () => {
    const patientName = patients.find(c => c.id === selectedPatient)?.name || "Paciente";
    const current = historyEntries[historyIndex];
    const measurementsArray = Array.from(measurements.values()).filter(m => m.probing_depth !== null);
    
    generatePeriogramPdf({
      client_name: patientName,
      exam_date: current?.exam_date || new Date().toISOString().split("T")[0],
      professional_name: current?.professional_name || profile?.full_name || "Profissional",
      clinic_name: "Clínica",
      plaque_index: indices.plaque,
      bleeding_index: indices.bleeding,
      avg_probing_depth: indices.avgDepth,
      sites_over_4mm: indices.over4,
      sites_over_6mm: indices.over6,
      total_sites: measurementsArray.length,
      periodontal_diagnosis: diagnosis || current?.periodontal_diagnosis || null,
      risk_classification: riskClass || current?.risk_classification || null,
      notes: notes || null,
      measurements: measurementsArray,
    });
  };

  return (
    <MainLayout title="Periograma" subtitle="Registro da saúde periodontal">
      <PeriogramHeader
        patientSearch={patientSearch}
        setPatientSearch={setPatientSearch}
        patients={patients}
        selectedPatient={selectedPatient}
        onSelectPatient={handleSelectPatient}
        onSave={handleSave}
        isSaving={isSaving}
        isViewingOld={isViewingOld}
        hasData={measurements.size > 0}
        onExportPdf={handleExportPdf}
      />

      {isLoading && (
        <Card className="mb-6">
          <CardContent className="py-8 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Carregando...</span>
          </CardContent>
        </Card>
      )}

      {selectedPatient && historyEntries.length > 0 && !isLoading && (
        <HistoryNav
          entries={historyEntries}
          index={historyIndex}
          onNavigate={navigateHistory}
        />
      )}

      {selectedPatient && !isLoading && (
        <>
          <IndicesCard indices={indices} />
          <PeriogramChart
            measurements={measurements}
            onUpdate={updateMeasurement}
            readOnly={isViewingOld}
          />
          <DiagnosisCard
            notes={notes}
            setNotes={setNotes}
            diagnosis={diagnosis}
            setDiagnosis={setDiagnosis}
            riskClass={riskClass}
            setRiskClass={setRiskClass}
            readOnly={isViewingOld}
          />
        </>
      )}
    </MainLayout>
  );
}

// Sub-componentes serão adicionados abaixo
function PeriogramHeader({ patientSearch, setPatientSearch, patients, selectedPatient, onSelectPatient, onSave, isSaving, isViewingOld, hasData, onExportPdf }: any) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar Paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Digite o nome..."
                className="pl-10"
              />
            </div>
          </div>
          {patients.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Paciente</Label>
              <Select value={selectedPatient} onValueChange={onSelectPatient}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c: PatientOption) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedPatient && !isViewingOld && (
            <Button onClick={onSave} disabled={isSaving || !hasData} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Periograma
            </Button>
          )}
          {selectedPatient && hasData && onExportPdf && (
            <Button variant="outline" onClick={onExportPdf} className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryNav({ entries, index, onNavigate }: { entries: PeriogramSummary[]; index: number; onNavigate: (i: number) => void }) {
  const current = entries[index];
  return (
    <Card className="mb-6">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Histórico</span>
            <Badge variant="outline" className="text-xs">{entries.length} exame(s)</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={index >= entries.length - 1} onClick={() => onNavigate(index + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[120px] text-center">
              {index === 0 ? "Atual" : new Date(current?.exam_date).toLocaleDateString("pt-BR")}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={index <= 0} onClick={() => onNavigate(index - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {index > 0 && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Visualizando exame de {new Date(current?.exam_date).toLocaleDateString("pt-BR")}. Para editar, volte ao atual.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IndicesCard({ indices }: { indices: { plaque: number; bleeding: number; avgDepth: number; over4: number; over6: number } }) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Índices Periodontais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Índice de Placa</p>
            <p className="text-xl font-bold">{indices.plaque.toFixed(1)}%</p>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Sangramento</p>
            <p className="text-xl font-bold">{indices.bleeding.toFixed(1)}%</p>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Prof. Média</p>
            <p className="text-xl font-bold">{indices.avgDepth.toFixed(1)}mm</p>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Sítios &gt;4mm</p>
            <p className="text-xl font-bold text-yellow-600">{indices.over4}</p>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Sítios &gt;6mm</p>
            <p className="text-xl font-bold text-red-600">{indices.over6}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PeriogramChart({ measurements, onUpdate, readOnly }: { measurements: Map<string, Measurement>; onUpdate: (key: string, field: keyof Measurement, value: any) => void; readOnly: boolean }) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gráfico Periodontal</CardTitle>
        <CardDescription>6 sítios por dente · Clique para editar valores</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <ToothRow teeth={UPPER_TEETH} measurements={measurements} onUpdate={onUpdate} readOnly={readOnly} isUpper />
        <div className="border-t my-4" />
        <ToothRow teeth={LOWER_TEETH} measurements={measurements} onUpdate={onUpdate} readOnly={readOnly} isUpper={false} />
        <Legend />
      </CardContent>
    </Card>
  );
}

function ToothRow({ teeth, measurements, onUpdate, readOnly, isUpper }: { teeth: number[]; measurements: Map<string, Measurement>; onUpdate: any; readOnly: boolean; isUpper: boolean }) {
  return (
    <div className="flex gap-1 justify-center flex-wrap">
      {teeth.map(tooth => (
        <ToothColumn key={tooth} tooth={tooth} measurements={measurements} onUpdate={onUpdate} readOnly={readOnly} isUpper={isUpper} />
      ))}
    </div>
  );
}

function ToothColumn({ tooth, measurements, onUpdate, readOnly, isUpper }: { tooth: number; measurements: Map<string, Measurement>; onUpdate: any; readOnly: boolean; isUpper: boolean }) {
  const sites = isUpper ? ["MV", "V", "DV", "ML", "L", "DL"] : ["ML", "L", "DL", "MV", "V", "DV"];
  return (
    <div className="flex flex-col items-center gap-0.5 p-1 border rounded-lg bg-muted/20 min-w-[40px]">
      <span className="text-[10px] font-mono font-bold text-muted-foreground">{tooth}</span>
      {sites.map(site => {
        const key = `${tooth}-${site}`;
        const m = measurements.get(key);
        const depth = m?.probing_depth;
        return (
          <SiteCell
            key={key}
            site={site}
            depth={depth}
            bleeding={m?.bleeding || false}
            plaque={m?.plaque || false}
            onDepthChange={(v) => onUpdate(key, "probing_depth", v)}
            onBleedingToggle={() => onUpdate(key, "bleeding", !m?.bleeding)}
            onPlaqueToggle={() => onUpdate(key, "plaque", !m?.plaque)}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function SiteCell({ site, depth, bleeding, plaque, onDepthChange, onBleedingToggle, onPlaqueToggle, readOnly }: any) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(depth?.toString() || "");

  const handleBlur = () => {
    setEditing(false);
    const num = parseInt(value);
    onDepthChange(isNaN(num) ? null : Math.min(15, Math.max(0, num)));
  };

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[8px] text-muted-foreground w-4">{site}</span>
      {editing && !readOnly ? (
        <input
          type="number"
          className="w-6 h-5 text-[10px] text-center border rounded"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && handleBlur()}
          autoFocus
          min={0}
          max={15}
        />
      ) : (
        <button
          className="w-6 h-5 text-[10px] font-bold rounded flex items-center justify-center"
          style={{ backgroundColor: getDepthColor(depth), color: depth !== null ? "white" : "#9ca3af" }}
          onClick={() => !readOnly && setEditing(true)}
          disabled={readOnly}
        >
          {depth ?? "-"}
        </button>
      )}
      <button
        className={`w-3 h-3 rounded-full border ${bleeding ? "bg-red-500 border-red-600" : "bg-white border-gray-300"}`}
        onClick={onBleedingToggle}
        disabled={readOnly}
        title="Sangramento"
      />
      <button
        className={`w-3 h-3 rounded-sm border ${plaque ? "bg-yellow-500 border-yellow-600" : "bg-white border-gray-300"}`}
        onClick={onPlaqueToggle}
        disabled={readOnly}
        title="Placa"
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
      <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: "#22c55e" }} />≤3mm (saudável)</div>
      <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: "#eab308" }} />4-5mm (atenção)</div>
      <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: "#ef4444" }} />≥6mm (crítico)</div>
      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" />Sangramento</div>
      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-500" />Placa</div>
    </div>
  );
}

function DiagnosisCard({ notes, setNotes, diagnosis, setDiagnosis, riskClass, setRiskClass, readOnly }: any) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Diagnóstico e Observações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Diagnóstico Periodontal</Label>
            <Select value={diagnosis} onValueChange={setDiagnosis} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saude_periodontal">Saúde Periodontal</SelectItem>
                <SelectItem value="gengivite">Gengivite</SelectItem>
                <SelectItem value="periodontite_leve">Periodontite Leve</SelectItem>
                <SelectItem value="periodontite_moderada">Periodontite Moderada</SelectItem>
                <SelectItem value="periodontite_severa">Periodontite Severa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Classificação de Risco</Label>
            <Select value={riskClass} onValueChange={setRiskClass} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações clínicas..."
            rows={3}
            disabled={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}
