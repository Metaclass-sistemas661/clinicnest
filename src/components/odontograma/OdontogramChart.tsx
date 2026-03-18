/**
 * OdontogramChart — Componente visual do odontograma completo
 * 
 * Features:
 * - Diagrama de 5 faces por dente (ToothDiagram)
 * - Toggle: Adulto / Decíduo / Misto
 * - Legenda agrupada por categoria
 * - Estatísticas rápidas (resumo)
 * - Modo compacto para embed
 */
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ToothDiagram, type ToothSurfaceData } from "./ToothDiagram";
import {
  TOOTH_CONDITIONS,
  CONDITION_CATEGORIES,
  getTeethForDentition,
  type DentitionType,
  type ToothConditionKey,
} from "./odontogramConstants";
import { cn } from "@/lib/utils";

export interface ToothRecord {
  tooth_number: number;
  condition: ToothConditionKey;
  surfaces?: string;
  notes?: string;
  procedure_date?: string;
  mobility_grade?: number | null;
  priority?: string;
  surfaceData?: ToothSurfaceData[];
}

interface OdontogramChartProps {
  teeth: Map<number, ToothRecord>;
  dentitionType: DentitionType;
  onDentitionChange?: (type: DentitionType) => void;
  selectedTooth: number | null;
  onToothClick?: (toothNumber: number) => void;
  onSurfaceClick?: (toothNumber: number, surface: string) => void;
  compact?: boolean;
  readOnly?: boolean;
  showLegend?: boolean;
  showStats?: boolean;
  /** U7: Set of tooth numbers with unsaved changes */
  dirtyTeeth?: Set<number>;
  /** U8: Filter to highlight only teeth with this condition */
  conditionFilter?: ToothConditionKey | null;
  /** F6: Set of tooth numbers that differ between versions */
  diffTeeth?: Set<number>;
}

export function OdontogramChart({
  teeth,
  dentitionType,
  onDentitionChange,
  selectedTooth,
  onToothClick,
  onSurfaceClick,
  compact = false,
  readOnly = false,
  showLegend = true,
  showStats = true,
  dirtyTeeth,
  conditionFilter,
  diffTeeth,
}: OdontogramChartProps) {
  const { upper, lower } = useMemo(() => getTeethForDentition(dentitionType), [dentitionType]);

  // Separate permanent and deciduous for mixed dentition layout
  const isDeciduous = (num: number) => num >= 51 && num <= 85;

  // Split upper and lower into permanent and deciduous for mixed
  const upperPermanent = upper.filter(n => !isDeciduous(n));
  const upperDeciduous = upper.filter(n => isDeciduous(n));
  const lowerPermanent = lower.filter(n => !isDeciduous(n));
  const lowerDeciduous = lower.filter(n => isDeciduous(n));

  const getCondition = (num: number): ToothConditionKey => teeth.get(num)?.condition ?? "healthy";
  const getRecord = (num: number) => teeth.get(num);

  // Stats
  const stats = useMemo(() => {
    const records = Array.from(teeth.values());
    if (records.length === 0) return null;
    const total = records.length;
    const caries = records.filter(r => r.condition === "caries").length;
    const missing = records.filter(r => r.condition === "missing").length;
    const restored = records.filter(r => r.condition === "restored").length;
    const urgent = records.filter(r => r.priority === "urgent").length;
    const withMobility = records.filter(r => (r.mobility_grade ?? 0) > 0).length;
    return { total, caries, missing, restored, urgent, withMobility };
  }, [teeth]);

  // Used conditions for legend filtering
  const usedConditions = useMemo(() => {
    const set = new Set<string>();
    set.add("healthy");
    for (const rec of teeth.values()) {
      set.add(rec.condition);
    }
    return set;
  }, [teeth]);

  const renderToothRow = (toothNumbers: readonly number[] | number[]) => (
    <div className="flex flex-wrap justify-center gap-0">
      {toothNumbers.map(num => {
        const rec = getRecord(num);
        const toothCondition = getCondition(num);
        const isDimmed = conditionFilter != null && toothCondition !== conditionFilter;
        return (
          <ToothDiagram
            key={num}
            number={num}
            condition={toothCondition}
            surfaces={rec?.surfaceData}
            mobilityGrade={rec?.mobility_grade}
            priority={rec?.priority}
            isSelected={selectedTooth === num}
            compact={compact}
            onClick={() => onToothClick?.(num)}
            onSurfaceClick={onSurfaceClick ? (s) => onSurfaceClick(num, s) : undefined}
            disabled={readOnly}
            isDirty={dirtyTeeth?.has(num) ?? false}
            dimmed={isDimmed}
            diffHighlight={diffTeeth?.has(num) ?? false}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Dentition type toggle */}
      {onDentitionChange && !compact && (
        <div className="flex justify-center">
          <ToggleGroup
            type="single"
            value={dentitionType}
            onValueChange={(v) => v && onDentitionChange(v as DentitionType)}
            className="bg-muted rounded-lg p-1"
          >
            <ToggleGroupItem value="permanent" className="text-xs px-3 data-[state=on]:bg-background">
              Adulto (32)
            </ToggleGroupItem>
            <ToggleGroupItem value="deciduous" className="text-xs px-3 data-[state=on]:bg-background">
              Infantil (20)
            </ToggleGroupItem>
            <ToggleGroupItem value="mixed" className="text-xs px-3 data-[state=on]:bg-background">
              Misto
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {/* Dental chart */}
      <div className="flex flex-col items-center gap-1">
        {/* Upper arch label */}
        <div className={cn("text-muted-foreground font-semibold", compact ? "text-[9px]" : "text-xs")}>
          Arcada Superior
        </div>

        {/* Upper permanent */}
        {(dentitionType === "permanent" || dentitionType === "mixed") && renderToothRow(upperPermanent)}

        {/* Upper deciduous (inside for mixed, alone for deciduous) */}
        {(dentitionType === "deciduous" || dentitionType === "mixed") && (
          <div className={dentitionType === "mixed" ? "mb-1" : ""}>
            {dentitionType === "mixed" && (
              <div className="text-[8px] text-muted-foreground text-center mb-0.5">Decíduos</div>
            )}
            {renderToothRow(upperDeciduous)}
          </div>
        )}

        {/* Separator */}
        <div className={cn("border-t", compact ? "w-full max-w-xs my-0.5" : "w-full max-w-lg my-2")} />

        {/* Lower deciduous */}
        {(dentitionType === "deciduous" || dentitionType === "mixed") && (
          <div className={dentitionType === "mixed" ? "mt-1" : ""}>
            {dentitionType === "mixed" && (
              <div className="text-[8px] text-muted-foreground text-center mb-0.5">Decíduos</div>
            )}
            {renderToothRow(lowerDeciduous)}
          </div>
        )}

        {/* Lower permanent */}
        {(dentitionType === "permanent" || dentitionType === "mixed") && renderToothRow(lowerPermanent)}

        {/* Lower arch label */}
        <div className={cn("text-muted-foreground font-semibold", compact ? "text-[9px]" : "text-xs")}>
          Arcada Inferior
        </div>
      </div>

      {/* Stats */}
      {showStats && stats && !compact && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Badge variant="outline" className="text-xs gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> {stats.total - stats.caries - stats.missing} saudáveis
          </Badge>
          {stats.caries > 0 && (
            <Badge variant="outline" className="text-xs gap-1 border-red-200 text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> {stats.caries} cárie(s)
            </Badge>
          )}
          {stats.missing > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" /> {stats.missing} ausente(s)
            </Badge>
          )}
          {stats.restored > 0 && (
            <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> {stats.restored} restaurado(s)
            </Badge>
          )}
          {stats.urgent > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              {stats.urgent} urgente(s)
            </Badge>
          )}
          {stats.withMobility > 0 && (
            <Badge variant="outline" className="text-xs gap-1 border-amber-200 text-amber-700">
              {stats.withMobility} c/ mobilidade
            </Badge>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && !compact && (
        <div className="space-y-2 pt-2">
          {CONDITION_CATEGORIES.map(cat => {
            const conditions = TOOTH_CONDITIONS.filter(c => c.category === cat.key && usedConditions.has(c.value));
            if (conditions.length === 0) return null;
            return (
              <div key={cat.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.label}:
                </span>
                {conditions.map(c => (
                  <div key={c.value} className="flex items-center gap-1 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Compact legend */}
      {showLegend && compact && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {TOOTH_CONDITIONS.filter(c => usedConditions.has(c.value)).slice(0, 8).map(c => (
            <div key={c.value} className="flex items-center gap-0.5 text-[9px]">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label.split(" ")[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
