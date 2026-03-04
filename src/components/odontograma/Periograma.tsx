/**
 * Periograma — Componente profissional de ficha periodontal
 * 
 * Features:
 * - Tabela interativa com 6 sítios por dente (MV, V, DV, ML, L, DL)
 * - Profundidade de sondagem, recessão, NIC (calculado)
 * - Indicadores: sangramento, supuração, placa
 * - Mobilidade (0-3) e furca (0-3) por dente
 * - Cálculo automático de índices (placa, sangramento, profundidade média)
 * - Código de cores por profundidade (verde ≤3mm, amarelo 4-5mm, vermelho ≥6mm)
 * - Diagnóstico periodontal e classificação de risco
 * - Exportação para PDF
 * - Histórico de periogramas
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Save, FileDown, History, ChevronLeft, ChevronRight,
  AlertTriangle, Droplets, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
// 3 vestibular sites, then 3 lingual/palatine sites
const VESTIBULAR_SITES = ["MV", "V", "DV"] as const;
const LINGUAL_SITES = ["ML", "L", "DL"] as const;
const ALL_SITES = [...VESTIBULAR_SITES, ...LINGUAL_SITES] as const;

type Site = typeof ALL_SITES[number];

interface SiteMeasurement {
  probing_depth: number | null;
  recession: number | null;
  bleeding: boolean;
  suppuration: boolean;
  plaque: boolean;
}

interface ToothMeasurements {
  tooth_number: number;
  mobility: number | null;
  furcation: number | null;
  sites: Record<Site, SiteMeasurement>;
}

interface PeriogramEntry {
  id: string;
  exam_date: string;
  plaque_index: number | null;
  bleeding_index: number | null;
  avg_probing_depth: number | null;
  sites_over_4mm: number | null;
  sites_over_6mm: number | null;
  total_sites: number | null;
  periodontal_diagnosis: string | null;
  risk_classification: string | null;
  professional_name: string | null;
  notes: string | null;
  created_at: string;
}

interface PeriogramaProps {
  tenantId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  readOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createEmptySite(): SiteMeasurement {
  return { probing_depth: null, recession: null, bleeding: false, suppuration: false, plaque: false };
}

function createEmptyTooth(num: number): ToothMeasurements {
  const sites = {} as Record<Site, SiteMeasurement>;
  for (const s of ALL_SITES) {
    sites[s] = createEmptySite();
  }
  return { tooth_number: num, mobility: null, furcation: null, sites };
}

function getDepthColor(depth: number | null): string {
  if (depth === null) return "bg-muted text-muted-foreground";
  if (depth <= 3) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (depth <= 5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

function getDepthBorderColor(depth: number | null): string {
  if (depth === null) return "border-muted";
  if (depth <= 3) return "border-green-300 dark:border-green-700";
  if (depth <= 5) return "border-yellow-300 dark:border-yellow-700";
  return "border-red-300 dark:border-red-700";
}

// ─── Periograma Component ────────────────────────────────────────────────────

export function Periograma({ tenantId, patientId, professionalId, appointmentId, readOnly = false }: PeriogramaProps) {
  // Data state
  const [teethMap, setTeethMap] = useState<Map<number, ToothMeasurements>>(new Map());
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [riskClass, setRiskClass] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // History
  const [history, setHistory] = useState<PeriogramEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Active cell for keyboard navigation
  const [activeCell, setActiveCell] = useState<{ tooth: number; site: Site; field: "depth" | "recession" } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── Initialize teeth ──
  useEffect(() => {
    const map = new Map<number, ToothMeasurements>();
    [...UPPER_TEETH, ...LOWER_TEETH].forEach(num => {
      map.set(num, createEmptyTooth(num));
    });
    setTeethMap(map);
  }, []);

  // ── Load history on mount ──
  useEffect(() => {
    if (tenantId && patientId) {
      void loadHistory();
    }
  }, [tenantId, patientId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_client_periograms", {
        p_tenant_id: tenantId,
        p_client_id: patientId,
      });

      if (error) throw error;

      const entries: PeriogramEntry[] = ((data as any[]) || []).map((p: any) => ({
        id: p.id,
        exam_date: p.exam_date,
        plaque_index: p.plaque_index,
        bleeding_index: p.bleeding_index,
        avg_probing_depth: p.avg_probing_depth,
        sites_over_4mm: p.sites_over_4mm,
        sites_over_6mm: p.sites_over_6mm,
        total_sites: p.total_sites,
        periodontal_diagnosis: p.periodontal_diagnosis,
        risk_classification: p.risk_classification,
        professional_name: p.professional_name,
        notes: p.notes,
        created_at: p.created_at,
      }));

      setHistory(entries);

      if (entries.length > 0) {
        setHistoryIndex(0);
        await loadMeasurements(entries[0].id);
        setNotes(entries[0].notes ?? "");
        setDiagnosis(entries[0].periodontal_diagnosis ?? "");
        setRiskClass(entries[0].risk_classification ?? "");
      }
    } catch (err) {
      console.error("Erro ao carregar periogramas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeasurements = async (periogramId: string) => {
    const { data, error } = await (supabase.rpc as any)("get_periogram_measurements", {
      p_periogram_id: periogramId,
    });

    if (error) {
      console.error("Erro ao carregar medições:", error);
      return;
    }

    const map = new Map<number, ToothMeasurements>();
    [...UPPER_TEETH, ...LOWER_TEETH].forEach(num => {
      map.set(num, createEmptyTooth(num));
    });

    for (const m of (data as any[]) || []) {
      let tooth = map.get(m.tooth_number);
      if (!tooth) {
        tooth = createEmptyTooth(m.tooth_number);
        map.set(m.tooth_number, tooth);
      }

      const site = m.site as Site;
      if (tooth.sites[site]) {
        tooth.sites[site] = {
          probing_depth: m.probing_depth,
          recession: m.recession,
          bleeding: m.bleeding ?? false,
          suppuration: m.suppuration ?? false,
          plaque: m.plaque ?? false,
        };
      }

      if (m.mobility != null && site === "V") {
        tooth.mobility = m.mobility;
      }
      if (m.furcation != null && site === "V") {
        tooth.furcation = m.furcation;
      }
    }

    setTeethMap(map);
  };

  // ── Navigation ──
  const navigateHistory = async (index: number) => {
    if (index < 0 || index >= history.length) return;
    if (isDirty) {
      const ok = window.confirm("Há alterações não salvas. Deseja descartá-las?");
      if (!ok) return;
    }
    setHistoryIndex(index);
    setIsDirty(false);
    const entry = history[index];
    setNotes(entry.notes ?? "");
    setDiagnosis(entry.periodontal_diagnosis ?? "");
    setRiskClass(entry.risk_classification ?? "");
    await loadMeasurements(entry.id);
  };

  const isViewingOld = historyIndex > 0;

  // ── Update measurement ──
  const updateSite = useCallback((toothNum: number, site: Site, field: keyof SiteMeasurement, value: any) => {
    setTeethMap(prev => {
      const next = new Map(prev);
      const tooth = { ...next.get(toothNum)! };
      tooth.sites = { ...tooth.sites };
      tooth.sites[site] = { ...tooth.sites[site], [field]: value };
      next.set(toothNum, tooth);
      return next;
    });
    setIsDirty(true);
  }, []);

  const updateToothField = useCallback((toothNum: number, field: "mobility" | "furcation", value: number | null) => {
    setTeethMap(prev => {
      const next = new Map(prev);
      const tooth = { ...next.get(toothNum)!, [field]: value };
      next.set(toothNum, tooth);
      return next;
    });
    setIsDirty(true);
  }, []);

  // ── Keyboard navigation helper ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, toothNum: number, site: Site, field: "depth" | "recession") => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      // Move to next site/tooth
      const allTeeth = [...UPPER_TEETH, ...LOWER_TEETH];
      const toothIdx = allTeeth.indexOf(toothNum);
      const siteIdx = ALL_SITES.indexOf(site);

      let nextSite = siteIdx + 1;
      let nextTooth = toothIdx;

      if (nextSite >= ALL_SITES.length) {
        nextSite = 0;
        nextTooth = toothIdx + 1;
      }

      if (nextTooth < allTeeth.length) {
        const key = `${allTeeth[nextTooth]}-${ALL_SITES[nextSite]}-${field}`;
        const ref = inputRefs.current.get(key);
        ref?.focus();
        ref?.select();
      }
    }
  };

  // ── Computed indices ──
  const indices = useMemo(() => {
    let totalSites = 0;
    let plaqueCount = 0;
    let bleedingCount = 0;
    let depthSum = 0;
    let depthCount = 0;
    let over4 = 0;
    let over6 = 0;

    for (const tooth of teethMap.values()) {
      for (const site of ALL_SITES) {
        const m = tooth.sites[site];
        if (m.probing_depth != null) {
          totalSites++;
          depthSum += m.probing_depth;
          depthCount++;
          if (m.probing_depth > 4) over4++;
          if (m.probing_depth > 6) over6++;
        }
        if (m.plaque) plaqueCount++;
        if (m.bleeding) bleedingCount++;
      }
    }

    return {
      totalSites,
      plaqueIndex: totalSites > 0 ? (plaqueCount / totalSites) * 100 : 0,
      bleedingIndex: totalSites > 0 ? (bleedingCount / totalSites) * 100 : 0,
      avgDepth: depthCount > 0 ? depthSum / depthCount : 0,
      over4,
      over6,
    };
  }, [teethMap]);

  // ── Save ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const measurements: any[] = [];
      for (const tooth of teethMap.values()) {
        for (const site of ALL_SITES) {
          const m = tooth.sites[site];
          // Only include sites that have at least some data
          if (m.probing_depth != null || m.recession != null || m.bleeding || m.suppuration || m.plaque) {
            measurements.push({
              tooth_number: tooth.tooth_number,
              site,
              probing_depth: m.probing_depth,
              recession: m.recession,
              clinical_attachment_level: m.probing_depth != null && m.recession != null
                ? m.probing_depth + m.recession
                : null,
              bleeding: m.bleeding,
              suppuration: m.suppuration,
              plaque: m.plaque,
              mobility: site === "V" ? tooth.mobility : null,
              furcation: site === "V" ? tooth.furcation : null,
            });
          }
        }
      }

      const { error } = await (supabase.rpc as any)("save_periogram_with_measurements", {
        p_tenant_id: tenantId,
        p_client_id: patientId,
        p_professional_id: professionalId,
        p_appointment_id: appointmentId ?? null,
        p_exam_date: new Date().toISOString().split("T")[0],
        p_notes: notes || null,
        p_periodontal_diagnosis: diagnosis || null,
        p_risk_classification: riskClass || null,
        p_measurements: measurements,
      });

      if (error) throw error;

      toast.success("Periograma salvo com sucesso!");
      setIsDirty(false);
      await loadHistory();
    } catch (err: any) {
      console.error("Erro ao salvar periograma:", err);
      toast.error(err.message || "Erro ao salvar periograma");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Export PDF ──
  const handleExportPdf = async () => {
    try {
      const { generatePeriogramPdf } = await import("@/utils/periogramPdf");

      const measurements: any[] = [];
      for (const tooth of teethMap.values()) {
        for (const site of ALL_SITES) {
          const m = tooth.sites[site];
          if (m.probing_depth != null) {
            measurements.push({
              tooth_number: tooth.tooth_number,
              site,
              probing_depth: m.probing_depth,
              recession: m.recession,
              bleeding: m.bleeding,
              plaque: m.plaque,
            });
          }
        }
      }

      generatePeriogramPdf({
        client_name: "Paciente", // Would need to fetch
        exam_date: history[historyIndex]?.exam_date ?? new Date().toISOString(),
        professional_name: history[historyIndex]?.professional_name ?? "Profissional",
        clinic_name: "Clínica",
        plaque_index: indices.plaqueIndex,
        bleeding_index: indices.bleedingIndex,
        avg_probing_depth: indices.avgDepth,
        sites_over_4mm: indices.over4,
        sites_over_6mm: indices.over6,
        total_sites: indices.totalSites,
        periodontal_diagnosis: diagnosis,
        risk_classification: riskClass,
        notes,
        measurements,
      });

      toast.success("PDF gerado!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF do periograma");
    }
  };

  // ── Render tooth row ──
  const renderToothRow = (teethArray: number[], label: string, isReversed?: boolean) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-1 py-0.5 text-left w-16 text-[9px] font-semibold" rowSpan={2}>
                {label}
              </th>
              {teethArray.map(num => (
                <th key={num} className="px-0.5 py-0.5 text-center font-mono font-bold border-l border-border min-w-[52px]">
                  {num}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Vestibular sites row - probing depth */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                PS (V)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {VESTIBULAR_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <input
                            key={site}
                            ref={(el) => {
                              if (el) inputRefs.current.set(`${num}-${site}-depth`, el);
                            }}
                            type="number"
                            min={0}
                            max={15}
                            value={m.probing_depth ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateSite(num, site, "probing_depth", val);
                            }}
                            onKeyDown={(e) => handleKeyDown(e, num, site, "depth")}
                            disabled={readOnly || isViewingOld}
                            className={cn(
                              "w-[17px] h-5 text-center text-[10px] font-mono border-0 border-r last:border-r-0 outline-none focus:ring-1 focus:ring-primary p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              getDepthColor(m.probing_depth)
                            )}
                            title={`Dente ${num} - ${site}: PS`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Vestibular sites row - recession */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                Rec (V)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {VESTIBULAR_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <input
                            key={site}
                            ref={(el) => {
                              if (el) inputRefs.current.set(`${num}-${site}-recession`, el);
                            }}
                            type="number"
                            min={-5}
                            max={15}
                            value={m.recession ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateSite(num, site, "recession", val);
                            }}
                            disabled={readOnly || isViewingOld}
                            className="w-[17px] h-5 text-center text-[10px] font-mono bg-background border-0 border-r last:border-r-0 outline-none focus:ring-1 focus:ring-primary p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title={`Dente ${num} - ${site}: Recessão`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Bleeding row */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                SS (V)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {VESTIBULAR_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <button
                            key={site}
                            type="button"
                            disabled={readOnly || isViewingOld}
                            onClick={() => updateSite(num, site, "bleeding", !m.bleeding)}
                            className={cn(
                              "w-[17px] h-4 border-0 border-r last:border-r-0 transition-colors",
                              m.bleeding
                                ? "bg-red-500 dark:bg-red-600"
                                : "bg-background hover:bg-red-100 dark:hover:bg-red-950/50"
                            )}
                            title={`${m.bleeding ? "Sangramento" : "Sem sangramento"} - Dente ${num} ${site}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Plaque row */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                Placa (V)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {VESTIBULAR_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <button
                            key={site}
                            type="button"
                            disabled={readOnly || isViewingOld}
                            onClick={() => updateSite(num, site, "plaque", !m.plaque)}
                            className={cn(
                              "w-[17px] h-4 border-0 border-r last:border-r-0 transition-colors",
                              m.plaque
                                ? "bg-amber-400 dark:bg-amber-600"
                                : "bg-background hover:bg-amber-100 dark:hover:bg-amber-950/50"
                            )}
                            title={`${m.plaque ? "Placa" : "Sem placa"} - Dente ${num} ${site}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Separator */}
            <tr>
              <td colSpan={teethArray.length + 1} className="border-t-2 border-primary/20 h-0.5" />
            </tr>

            {/* Lingual sites row - probing depth */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                PS (L/P)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {LINGUAL_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <input
                            key={site}
                            type="number"
                            min={0}
                            max={15}
                            value={m.probing_depth ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateSite(num, site, "probing_depth", val);
                            }}
                            disabled={readOnly || isViewingOld}
                            className={cn(
                              "w-[17px] h-5 text-center text-[10px] font-mono border-0 border-r last:border-r-0 outline-none focus:ring-1 focus:ring-primary p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              getDepthColor(m.probing_depth)
                            )}
                            title={`Dente ${num} - ${site}: PS`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Lingual recession */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                Rec (L/P)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {LINGUAL_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <input
                            key={site}
                            type="number"
                            min={-5}
                            max={15}
                            value={m.recession ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateSite(num, site, "recession", val);
                            }}
                            disabled={readOnly || isViewingOld}
                            className="w-[17px] h-5 text-center text-[10px] font-mono bg-background border-0 border-r last:border-r-0 outline-none focus:ring-1 focus:ring-primary p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title={`Dente ${num} - ${site}: Recessão`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Bleeding L */}
            <tr>
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                SS (L/P)
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex">
                      {LINGUAL_SITES.map(site => {
                        const m = tooth.sites[site];
                        return (
                          <button
                            key={site}
                            type="button"
                            disabled={readOnly || isViewingOld}
                            onClick={() => updateSite(num, site, "bleeding", !m.bleeding)}
                            className={cn(
                              "w-[17px] h-4 border-0 border-r last:border-r-0 transition-colors",
                              m.bleeding
                                ? "bg-red-500 dark:bg-red-600"
                                : "bg-background hover:bg-red-100 dark:hover:bg-red-950/50"
                            )}
                            title={`${m.bleeding ? "Sangramento" : "Sem sangramento"} - Dente ${num} ${site}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Mobility / Furcation row */}
            <tr className="bg-muted/30">
              <td className="px-1 py-0 text-[9px] font-semibold text-muted-foreground">
                Mob / Furca
              </td>
              {teethArray.map(num => {
                const tooth = teethMap.get(num)!;
                return (
                  <td key={num} className="px-0 py-0 border-l border-border">
                    <div className="flex justify-center gap-0.5 py-0.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <select
                              value={tooth.mobility ?? ""}
                              onChange={(e) => updateToothField(num, "mobility", e.target.value === "" ? null : Number(e.target.value))}
                              disabled={readOnly || isViewingOld}
                              className="w-6 h-4 text-[9px] font-mono text-center bg-transparent border rounded outline-none cursor-pointer"
                              title={`Mobilidade dente ${num}`}
                            >
                              <option value="">-</option>
                              <option value="0">0</option>
                              <option value="1">I</option>
                              <option value="2">II</option>
                              <option value="3">III</option>
                            </select>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">Mobilidade dente {num}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <select
                              value={tooth.furcation ?? ""}
                              onChange={(e) => updateToothField(num, "furcation", e.target.value === "" ? null : Number(e.target.value))}
                              disabled={readOnly || isViewingOld}
                              className="w-6 h-4 text-[9px] font-mono text-center bg-transparent border rounded outline-none cursor-pointer"
                              title={`Furca dente ${num}`}
                            >
                              <option value="">-</option>
                              <option value="0">0</option>
                              <option value="1">I</option>
                              <option value="2">II</option>
                              <option value="3">III</option>
                            </select>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">Furca dente {num}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando periograma...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header + Actions ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Periograma
                {isDirty && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Não salvo</Badge>
                )}
              </CardTitle>
              <CardDescription>Ficha periodontal completa — 6 sítios por dente</CardDescription>
            </div>
            <div className="flex gap-2">
              {indices.totalSites > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1">
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </Button>
              )}
              {!readOnly && !isViewingOld && (
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── History ── */}
      {history.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Histórico</span>
                <Badge variant="outline" className="text-xs">{history.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={historyIndex >= history.length - 1}
                  onClick={() => navigateHistory(historyIndex + 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[120px] text-center">
                  {historyIndex === 0 ? "Atual" : new Date(history[historyIndex]?.exam_date).toLocaleDateString("pt-BR")}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={historyIndex <= 0}
                  onClick={() => navigateHistory(historyIndex - 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isViewingOld && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Visualizando {new Date(history[historyIndex]?.exam_date).toLocaleDateString("pt-BR")}. Somente leitura.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Indices Summary ── */}
      {indices.totalSites > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground">Sítios</div>
              <div className="text-lg font-bold">{indices.totalSites}</div>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Droplets className="h-3 w-3" /> Placa
              </div>
              <div className={cn("text-lg font-bold", indices.plaqueIndex > 20 ? "text-red-600" : "text-green-600")}>
                {indices.plaqueIndex.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground">Sangramento</div>
              <div className={cn("text-lg font-bold", indices.bleedingIndex > 10 ? "text-red-600" : "text-green-600")}>
                {indices.bleedingIndex.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground">Prof. Média</div>
              <div className={cn("text-lg font-bold", indices.avgDepth > 4 ? "text-red-600" : indices.avgDepth > 3 ? "text-yellow-600" : "text-green-600")}>
                {indices.avgDepth.toFixed(1)}mm
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground">&gt;4mm</div>
              <div className={cn("text-lg font-bold", indices.over4 > 0 ? "text-yellow-600" : "text-green-600")}>
                {indices.over4}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="py-2 px-3 text-center">
              <div className="text-[10px] text-muted-foreground">&gt;6mm</div>
              <div className={cn("text-lg font-bold", indices.over6 > 0 ? "text-red-600" : "text-green-600")}>
                {indices.over6}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Upper Arch Table ── */}
      <Card>
        <CardContent className="pt-4 pb-2 px-2">
          {renderToothRow(UPPER_TEETH, "Superior")}
        </CardContent>
      </Card>

      {/* ── Lower Arch Table ── */}
      <Card>
        <CardContent className="pt-4 pb-2 px-2">
          {renderToothRow(LOWER_TEETH, "Inferior")}
        </CardContent>
      </Card>

      {/* ── Diagnosis + Notes ── */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnóstico Periodontal</Label>
              <Select value={diagnosis} onValueChange={(v) => { setDiagnosis(v); setIsDirty(true); }} disabled={readOnly || isViewingOld}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gengivite_leve">Gengivite Leve</SelectItem>
                  <SelectItem value="gengivite_moderada">Gengivite Moderada</SelectItem>
                  <SelectItem value="gengivite_grave">Gengivite Grave</SelectItem>
                  <SelectItem value="periodontite_leve">Periodontite Leve</SelectItem>
                  <SelectItem value="periodontite_moderada">Periodontite Moderada</SelectItem>
                  <SelectItem value="periodontite_grave">Periodontite Grave</SelectItem>
                  <SelectItem value="saude_periodontal">Saúde Periodontal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Classificação de Risco</Label>
              <Select value={riskClass} onValueChange={(v) => { setRiskClass(v); setIsDirty(true); }} disabled={readOnly || isViewingOld}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo Risco</SelectItem>
                  <SelectItem value="moderado">Risco Moderado</SelectItem>
                  <SelectItem value="alto">Alto Risco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              placeholder="Achados clínicos, plano de tratamento periodontal..."
              rows={2}
              className="text-xs"
              disabled={readOnly || isViewingOld}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="font-semibold">Legenda PS:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
          ≤ 3mm (saudável)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" />
          4–5mm (alerta)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
          ≥ 6mm (crítico)
        </div>
        <span className="ml-2">|</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          SS (sangramento)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          Placa
        </div>
      </div>
    </div>
  );
}
