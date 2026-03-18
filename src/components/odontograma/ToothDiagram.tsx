/**
 * ToothDiagram — Componente profissional de dente com 5 faces interativas
 * 
 * Renderiza um dente como diagrama clicável com faces:
 * V (Vestibular), L/P (Lingual/Palatina), M (Mesial), D (Distal), O/I (Oclusal/Incisal)
 * 
 * Cada face pode ter uma condição independente (cárie, restauração, etc.)
 * Visualmente baseado no padrão ISO dos softwares odontológicos profissionais.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";
import { TOOTH_CONDITIONS, type ToothConditionKey, type ToothCondition } from "./odontogramConstants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ToothSurfaceData {
  surface: string; // V, L, P, M, D, O, I
  condition: ToothConditionKey;
}

interface ToothDiagramProps {
  number: number;
  condition: ToothConditionKey;
  surfaces?: ToothSurfaceData[];
  mobilityGrade?: number | null;
  priority?: string;
  isSelected?: boolean;
  compact?: boolean; // For embed use
  onClick?: () => void;
  onSurfaceClick?: (surface: string) => void;
  disabled?: boolean;
  isDirty?: boolean;     // U7: unsaved changes indicator
  dimmed?: boolean;      // U8: dimmed when filtered out
  diffHighlight?: boolean; // F6: highlight diff between versions
}

const getColor = (condition: ToothConditionKey): string => {
  return TOOTH_CONDITIONS.find((c: ToothCondition) => c.value === condition)?.color ?? "#e5e7eb";
};

const getToothLabel = (condition: ToothConditionKey): string => {
  return TOOTH_CONDITIONS.find((c: ToothCondition) => c.value === condition)?.label ?? "";
};

// Determine if tooth is in upper arch
const isUpperTooth = (num: number) => {
  return (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
};

// Determine if tooth is anterior (incisors + canines) → show Incisal instead of Oclusal
const isAnterior = (num: number) => {
  const unit = num % 10;
  const quadrant = Math.floor(num / 10);
  if (quadrant >= 5) {
    // deciduous
    return unit <= 3;
  }
  return unit <= 3; // 1=central, 2=lateral, 3=canine
};

/**
 * 5-face tooth diagram using SVG
 * Layout: Pentagon-like shape
 *   [  M  ] [ O/I ] [  D  ]
 *           [  V  ]
 *           [ L/P ]
 * 
 * Actually rendered as a cross-like pattern:
 *        ┌─────────┐
 *        │    V    │
 *   ┌────┼─────────┼────┐
 *   │ M  │   O/I   │ D  │
 *   └────┼─────────┼────┘
 *        │   L/P   │
 *        └─────────┘
 */
function ToothDiagramInner({
  number,
  condition,
  surfaces = [],
  mobilityGrade,
  priority,
  isSelected = false,
  compact = false,
  onClick,
  onSurfaceClick,
  disabled = false,
  isDirty = false,
  dimmed = false,
  diffHighlight = false,
}: ToothDiagramProps) {
  const upper = isUpperTooth(number);
  const anterior = isAnterior(number);
  const centerLabel = anterior ? "I" : "O";
  const bottomLabel = upper ? "P" : "L";
  const size = compact ? 44 : 56;
  const pad = compact ? 1 : 2;

  // Get surface condition or fallback to tooth general condition
  const getSurfaceColor = (face: string): string => {
    const surf = surfaces.find(s => s.surface === face);
    if (surf) return getColor(surf.condition);
    // If tooth has a general condition, show it
    if (condition === "missing") return "transparent";
    if (condition !== "healthy") return getColor(condition);
    return "#e5e7eb"; // neutral gray for healthy
  };

  const handleSurfaceClick = (face: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onSurfaceClick) {
      onSurfaceClick(face);
    }
  };

  const isMissing = condition === "missing";
  const isSpecial = ["impacted", "unerupted", "semi_erupted", "agenesis", "supernumerary"].includes(condition);

  // Colors for each face
  const vColor = getSurfaceColor("V");
  const lColor = getSurfaceColor(upper ? "P" : "L");
  const mColor = getSurfaceColor("M");
  const dColor = getSurfaceColor("D");
  const oColor = getSurfaceColor(anterior ? "I" : "O");

  // Stroke color
  const stroke = isMissing ? "#9ca3af" : isSelected ? "#2563eb" : "#64748b";
  const strokeW = isSelected ? 1.5 : 0.8;
  const dashArray = isMissing ? "2,2" : "none";

  // Priority indicator
  const priorityColor = priority === "urgent" ? "#dc2626" : priority === "high" ? "#f59e0b" : null;

  // Build tooltip text
  const tooltipLines: string[] = [`Dente ${number} — ${getToothLabel(condition)}`];
  if (surfaces && surfaces.length > 0) {
    tooltipLines.push(`Faces: ${surfaces.map(s => s.surface).join(", ")}`);
  }
  if (mobilityGrade != null && mobilityGrade > 0) {
    tooltipLines.push(`Mobilidade: Grau ${mobilityGrade}`);
  }
  if (priority && priority !== "normal") {
    const pLabel = priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : priority === "low" ? "Baixa" : priority;
    tooltipLines.push(`Prioridade: ${pLabel}`);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg transition-all cursor-pointer relative",
              isSelected && "ring-2 ring-primary bg-primary/5",
              !disabled && !isSelected && "hover:bg-muted/60 hover:scale-105",
              disabled && "cursor-default opacity-70",
              compact ? "p-0.5" : "p-1",
              dimmed && "opacity-25 pointer-events-none",
              isDirty && "ring-2 ring-amber-400 animate-pulse",
              diffHighlight && "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/30"
            )}
            onClick={() => !disabled && onClick?.()}
          >
      {/* Tooth number (top for upper, bottom for lower) */}
      {upper && (
        <span className={cn(
          "font-mono font-bold text-muted-foreground",
          compact ? "text-[8px]" : "text-[10px]"
        )}>
          {number}
        </span>
      )}

      {/* SVG 5-face diagram */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Special cases: missing/impacted/etc draw differently */}
        {isMissing || isSpecial ? (
          <g>
            {/* X mark for missing */}
            {isMissing && (
              <>
                <line x1={pad + 8} y1={pad + 8} x2={size - pad - 8} y2={size - pad - 8} stroke="#9ca3af" strokeWidth={2} strokeDasharray="3,2" />
                <line x1={size - pad - 8} y1={pad + 8} x2={pad + 8} y2={size - pad - 8} stroke="#9ca3af" strokeWidth={2} strokeDasharray="3,2" />
              </>
            )}
            {/* Circle for impacted/unerupted */}
            {isSpecial && !isMissing && (
              <circle cx={size / 2} cy={size / 2} r={size / 2 - pad - 4} fill={getColor(condition)} fillOpacity={0.3} stroke={getColor(condition)} strokeWidth={1.5} strokeDasharray="4,2" />
            )}
          </g>
        ) : (
          <g>
            {/* ── Vestibular (top) ── */}
            <polygon
              points={`${pad + 8},${pad} ${size - pad - 8},${pad} ${size - pad - 12},${pad + 12} ${pad + 12},${pad + 12}`}
              fill={vColor}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              className="transition-colors"
              onClick={(e) => handleSurfaceClick("V", e)}
              style={{ cursor: onSurfaceClick ? "pointer" : "inherit" }}
            />

            {/* ── Mesial (left) ── */}
            <polygon
              points={`${pad},${pad + 8} ${pad + 12},${pad + 12} ${pad + 12},${size - pad - 12} ${pad},${size - pad - 8}`}
              fill={mColor}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              className="transition-colors"
              onClick={(e) => handleSurfaceClick("M", e)}
              style={{ cursor: onSurfaceClick ? "pointer" : "inherit" }}
            />

            {/* ── Distal (right) ── */}
            <polygon
              points={`${size - pad},${pad + 8} ${size - pad - 12},${pad + 12} ${size - pad - 12},${size - pad - 12} ${size - pad},${size - pad - 8}`}
              fill={dColor}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              className="transition-colors"
              onClick={(e) => handleSurfaceClick("D", e)}
              style={{ cursor: onSurfaceClick ? "pointer" : "inherit" }}
            />

            {/* ── Lingual/Palatina (bottom) ── */}
            <polygon
              points={`${pad + 8},${size - pad} ${size - pad - 8},${size - pad} ${size - pad - 12},${size - pad - 12} ${pad + 12},${size - pad - 12}`}
              fill={lColor}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              className="transition-colors"
              onClick={(e) => handleSurfaceClick(upper ? "P" : "L", e)}
              style={{ cursor: onSurfaceClick ? "pointer" : "inherit" }}
            />

            {/* ── Oclusal/Incisal (center) ── */}
            <rect
              x={pad + 12}
              y={pad + 12}
              width={size - 2 * (pad + 12)}
              height={size - 2 * (pad + 12)}
              fill={oColor}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              className="transition-colors"
              onClick={(e) => handleSurfaceClick(anterior ? "I" : "O", e)}
              style={{ cursor: onSurfaceClick ? "pointer" : "inherit" }}
            />

            {/* Face labels (only in non-compact mode) */}
            {!compact && (
              <>
                <text x={size / 2} y={pad + 9} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="bold" pointerEvents="none">V</text>
                <text x={pad + 5} y={size / 2 + 2.5} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="bold" pointerEvents="none">M</text>
                <text x={size - pad - 5} y={size / 2 + 2.5} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="bold" pointerEvents="none">D</text>
                <text x={size / 2} y={size - pad - 3} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="bold" pointerEvents="none">{bottomLabel}</text>
                <text x={size / 2} y={size / 2 + 3} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="bold" pointerEvents="none">{centerLabel}</text>
              </>
            )}

            {/* Condition-specific symbols */}
            {condition === "endodontic" && (
              <line x1={size / 2 - 6} y1={size / 2 - 6} x2={size / 2 + 6} y2={size / 2 + 6} stroke="white" strokeWidth={2} pointerEvents="none" />
            )}
            {condition === "crown" && (
              <circle cx={size / 2} cy={size / 2} r={7} fill="none" stroke="white" strokeWidth={1.5} pointerEvents="none" />
            )}
            {condition === "implant" && (
              <rect x={size / 2 - 2} y={size / 4} width={4} height={size / 2} fill="white" opacity={0.6} rx={1} pointerEvents="none" />
            )}
            {condition === "extraction" && (
              <>
                <line x1={size / 2 - 8} y1={size / 2 - 8} x2={size / 2 + 8} y2={size / 2 + 8} stroke="white" strokeWidth={2.5} pointerEvents="none" />
                <line x1={size / 2 + 8} y1={size / 2 - 8} x2={size / 2 - 8} y2={size / 2 + 8} stroke="white" strokeWidth={2.5} pointerEvents="none" />
              </>
            )}
            {condition === "bridge" && (
              <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="white" strokeWidth={2} pointerEvents="none" />
            )}
          </g>
        )}

        {/* Priority indicator (top-right corner) */}
        {priorityColor && (
          <circle cx={size - 5} cy={5} r={3} fill={priorityColor} stroke="white" strokeWidth={0.5} pointerEvents="none" />
        )}

        {/* Mobility indicator (bottom-left corner) */}
        {mobilityGrade != null && mobilityGrade > 0 && (
          <g pointerEvents="none">
            <circle cx={6} cy={size - 6} r={5} fill="#0f172a" opacity={0.8} />
            <text x={6} y={size - 3.5} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">
              {mobilityGrade}
            </text>
          </g>
        )}
      </svg>

      {/* Tooth number (bottom for lower) */}
      {!upper && (
        <span className={cn(
          "font-mono font-bold text-muted-foreground",
          compact ? "text-[8px]" : "text-[10px]"
        )}>
          {number}
        </span>
      )}
          </div>
        </TooltipTrigger>
        <TooltipContent side={upper ? "top" : "bottom"} className="text-xs whitespace-pre-line">
          {tooltipLines.join("\n")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const ToothDiagram = memo(ToothDiagramInner);
