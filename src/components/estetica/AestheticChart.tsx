/**
 * AestheticChart — Componente principal do mapeamento estético.
 * Toggle Face/Corpo, legenda por procedimento, stats, ZoneEditPanel inline.
 * Blueprint: OdontogramChart.tsx
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FaceZoneDiagram } from "./FaceZoneDiagram";
import { BodyZoneDiagram } from "./BodyZoneDiagram";
import { ZoneEditPanel } from "./ZoneEditPanel";
import {
  AESTHETIC_PROCEDURES,
  PROCEDURE_CATEGORIES,
  type ZoneApplication,
} from "./aestheticConstants";
import { cn } from "@/lib/utils";

type DiagramView = "face" | "body";

interface AestheticChartProps {
  applications: ZoneApplication[];
  onApplicationsChange?: (apps: ZoneApplication[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  showLegend?: boolean;
  showStats?: boolean;
}

export function AestheticChart({
  applications,
  onApplicationsChange,
  readOnly = false,
  compact = false,
  showLegend = true,
  showStats = true,
}: AestheticChartProps) {
  const [view, setView] = useState<DiagramView>("face");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const handleZoneClick = (zoneId: string) => {
    if (readOnly) return;
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
  };

  const handleAdd = (app: ZoneApplication) => {
    onApplicationsChange?.([...applications, app]);
  };

  const handleRemove = (index: number) => {
    onApplicationsChange?.(applications.filter((_, i) => i !== index));
  };

  // Stats
  const stats = useMemo(() => {
    if (applications.length === 0) return null;
    const totalZones = new Set(applications.map(a => a.zoneId)).size;
    const totalApps = applications.length;
    const toxinaU = applications
      .filter(a => a.procedure === "toxina_botulinica")
      .reduce((s, a) => s + a.quantity, 0);
    const preenchMl = applications
      .filter(a => a.procedure === "preenchimento_ah")
      .reduce((s, a) => s + a.quantity, 0);
    const procedures = new Set(applications.map(a => a.procedure)).size;
    return { totalZones, totalApps, toxinaU, preenchMl, procedures };
  }, [applications]);

  // Used procedures for legend filtering
  const usedProcedures = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) set.add(app.procedure);
    return set;
  }, [applications]);

  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {/* Toggle Face / Corpo */}
      <div className="flex items-center justify-between">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v) {
              setView(v as DiagramView);
              setSelectedZone(null);
            }
          }}
          className="gap-1"
        >
          <ToggleGroupItem value="face" className="text-xs px-3 h-8">
            Rosto
          </ToggleGroupItem>
          <ToggleGroupItem value="body" className="text-xs px-3 h-8">
            Corpo
          </ToggleGroupItem>
        </ToggleGroup>

        {stats && showStats && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {stats.totalZones} zona{stats.totalZones !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {stats.totalApps} aplicaç{stats.totalApps !== 1 ? "ões" : "ão"}
            </Badge>
            {stats.toxinaU > 0 && (
              <Badge className="text-xs bg-[#8b5cf6]">{stats.toxinaU}U toxina</Badge>
            )}
            {stats.preenchMl > 0 && (
              <Badge className="text-xs bg-[#ec4899]">{stats.preenchMl}ml preench.</Badge>
            )}
          </div>
        )}
      </div>

      {/* Diagram + Edit panel side by side */}
      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="flex-shrink-0">
          {view === "face" ? (
            <FaceZoneDiagram
              applications={applications}
              selectedZone={selectedZone}
              onZoneClick={handleZoneClick}
              compact={compact}
              readOnly={readOnly}
            />
          ) : (
            <BodyZoneDiagram
              applications={applications}
              selectedZone={selectedZone}
              onZoneClick={handleZoneClick}
              compact={compact}
              readOnly={readOnly}
            />
          )}
        </div>

        {/* Zone edit panel */}
        {selectedZone && !readOnly && (
          <div className="flex-1 min-w-[280px]">
            <ZoneEditPanel
              zoneId={selectedZone}
              applications={applications}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onClose={() => setSelectedZone(null)}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Legenda — Procedimentos
          </h4>
          <div className="flex flex-wrap gap-2">
            {PROCEDURE_CATEGORIES.map(cat => {
              const procs = AESTHETIC_PROCEDURES.filter(
                p => p.category === cat.key && (applications.length === 0 || usedProcedures.has(p.value))
              );
              if (procs.length === 0 && applications.length > 0) return null;
              // Show all if no applications yet
              const showProcs = applications.length === 0
                ? AESTHETIC_PROCEDURES.filter(p => p.category === cat.key)
                : procs;
              return (
                <div key={cat.key} className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">{cat.label}</span>
                  <div className="flex flex-wrap gap-1">
                    {showProcs.map(p => (
                      <div key={p.value} className="flex items-center gap-1 text-[10px]">
                        <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: p.color }} />
                        <span>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
