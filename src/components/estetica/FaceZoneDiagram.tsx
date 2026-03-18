/**
 * FaceZoneDiagram — Diagrama SVG interativo do rosto com zonas clicáveis.
 * Cada zona muda de cor de acordo com os procedimentos aplicados.
 * Blueprint: ToothDiagram.tsx (zonas clicáveis com cores).
 */
import { cn } from "@/lib/utils";
import {
  FACE_ZONES,
  AESTHETIC_PROCEDURES,
  type AestheticProcedureKey,
  type ZoneApplication,
} from "./aestheticConstants";

interface FaceZoneDiagramProps {
  applications: ZoneApplication[];
  selectedZone: string | null;
  onZoneClick?: (zoneId: string) => void;
  compact?: boolean;
  readOnly?: boolean;
}

/* Cores por zonas baseadas no procedimento dominante */
function getZoneColor(zoneId: string, apps: ZoneApplication[]): string {
  const zoneApps = apps.filter(a => a.zoneId === zoneId);
  if (zoneApps.length === 0) return "#e5e7eb";
  // Use cor do último procedimento aplicado
  const last = zoneApps[zoneApps.length - 1];
  return AESTHETIC_PROCEDURES.find(p => p.value === last.procedure)?.color ?? "#e5e7eb";
}

function getQuantityLabel(zoneId: string, apps: ZoneApplication[]): string {
  const zoneApps = apps.filter(a => a.zoneId === zoneId);
  if (zoneApps.length === 0) return "";
  const total = zoneApps.reduce((s, a) => s + a.quantity, 0);
  const unit = zoneApps[0].unit;
  return `${total}${unit}`;
}

/**
 * SVG face diagram (300×400 viewBox)
 * Zonas são elipses/paths posicionadas anatomicamente.
 */
export function FaceZoneDiagram({
  applications,
  selectedZone,
  onZoneClick,
  compact = false,
  readOnly = false,
}: FaceZoneDiagramProps) {
  const w = compact ? 200 : 300;
  const h = compact ? 270 : 400;
  const scale = compact ? 0.67 : 1;

  const handleClick = (zoneId: string) => {
    if (!readOnly && onZoneClick) onZoneClick(zoneId);
  };

  const zoneLabel = (zoneId: string) =>
    FACE_ZONES.find(z => z.id === zoneId)?.label ?? zoneId;

  /* Render helpers */
  const renderZone = (
    zoneId: string,
    shape: React.ReactNode,
  ) => {
    const fill = getZoneColor(zoneId, applications);
    const isSelected = selectedZone === zoneId;
    const qty = getQuantityLabel(zoneId, applications);
    const hasApp = applications.some(a => a.zoneId === zoneId);

    return (
      <g
        key={zoneId}
        onClick={() => handleClick(zoneId)}
        style={{ cursor: readOnly ? "default" : "pointer" }}
        className="transition-all"
      >
        <g
          opacity={hasApp ? 0.85 : 0.4}
          stroke={isSelected ? "#2563eb" : "#64748b"}
          strokeWidth={isSelected ? 2.5 : 1}
          fill={fill}
        >
          {shape}
        </g>
        <title>{`${zoneLabel(zoneId)}${qty ? ` — ${qty}` : ""}`}</title>
      </g>
    );
  };

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 300 400"
        className="select-none"
      >
        {/* ── Contorno do rosto (referência) ── */}
        <ellipse
          cx={150} cy={195} rx={120} ry={170}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />

        {/* ── Cabelo/topo referência ── */}
        <path
          d="M 30 195 Q 30 30, 150 25 Q 270 30, 270 195"
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1}
          strokeDasharray="3,3"
        />

        {/* ═══════════════════════ ZONAS ═══════════════════════ */}

        {/* ── FRONTAL ── */}
        {renderZone("frontal",
          <ellipse cx={150} cy={80} rx={70} ry={30} />
        )}
        {!compact && (
          <text x={150} y={83} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Frontal</text>
        )}

        {/* ── GLABELA ── */}
        {renderZone("glabela",
          <ellipse cx={150} cy={118} rx={18} ry={12} />
        )}
        {!compact && (
          <text x={150} y={121} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Glab.</text>
        )}

        {/* ── TEMPORAL D ── */}
        {renderZone("temporal_d",
          <ellipse cx={60} cy={110} rx={22} ry={35} />
        )}
        {!compact && (
          <text x={60} y={113} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Temp.D</text>
        )}

        {/* ── TEMPORAL E ── */}
        {renderZone("temporal_e",
          <ellipse cx={240} cy={110} rx={22} ry={35} />
        )}
        {!compact && (
          <text x={240} y={113} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Temp.E</text>
        )}

        {/* ── PERIOCULAR D ── */}
        {renderZone("periocular_d",
          <ellipse cx={108} cy={145} rx={28} ry={16} />
        )}
        {!compact && (
          <text x={108} y={148} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.D</text>
        )}

        {/* ── PERIOCULAR E ── */}
        {renderZone("periocular_e",
          <ellipse cx={192} cy={145} rx={28} ry={16} />
        )}
        {!compact && (
          <text x={192} y={148} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.E</text>
        )}

        {/* ── NASAL ── */}
        {renderZone("nasal",
          <path d="M 140 165 L 150 215 L 160 165 Z" />
        )}
        {!compact && (
          <text x={150} y={195} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Nasal</text>
        )}

        {/* ── MALAR D ── */}
        {renderZone("malar_d",
          <ellipse cx={85} cy={195} rx={32} ry={25} />
        )}
        {!compact && (
          <text x={85} y={198} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Malar D</text>
        )}

        {/* ── MALAR E ── */}
        {renderZone("malar_e",
          <ellipse cx={215} cy={195} rx={32} ry={25} />
        )}
        {!compact && (
          <text x={215} y={198} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Malar E</text>
        )}

        {/* ── SULCO NASOGENIANO D ── */}
        {renderZone("sulco_ng_d",
          <path d="M 125 215 Q 118 240, 125 265 L 132 265 Q 128 240, 132 215 Z" />
        )}
        {!compact && (
          <text x={116} y={242} textAnchor="middle" fontSize="6" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-10,116,242)">SNG D</text>
        )}

        {/* ── SULCO NASOGENIANO E ── */}
        {renderZone("sulco_ng_e",
          <path d="M 175 215 Q 182 240, 175 265 L 168 265 Q 172 240, 168 215 Z" />
        )}
        {!compact && (
          <text x={184} y={242} textAnchor="middle" fontSize="6" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(10,184,242)">SNG E</text>
        )}

        {/* ── LÁBIO SUPERIOR ── */}
        {renderZone("labio_superior",
          <ellipse cx={150} cy={260} rx={28} ry={10} />
        )}
        {!compact && (
          <text x={150} y={263} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Sup</text>
        )}

        {/* ── LÁBIO INFERIOR ── */}
        {renderZone("labio_inferior",
          <ellipse cx={150} cy={282} rx={30} ry={10} />
        )}
        {!compact && (
          <text x={150} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Inf</text>
        )}

        {/* ── COMISSURA D ── */}
        {renderZone("comissura_d",
          <circle cx={116} cy={270} r={8} />
        )}

        {/* ── COMISSURA E ── */}
        {renderZone("comissura_e",
          <circle cx={184} cy={270} r={8} />
        )}

        {/* ── MENTO ── */}
        {renderZone("mento",
          <ellipse cx={150} cy={310} rx={30} ry={18} />
        )}
        {!compact && (
          <text x={150} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Mento</text>
        )}

        {/* ── LINHA MARIONETE D ── */}
        {renderZone("linha_marionete_d",
          <path d="M 118 280 Q 112 298, 118 315 L 124 315 Q 120 298, 124 280 Z" />
        )}

        {/* ── LINHA MARIONETE E ── */}
        {renderZone("linha_marionete_e",
          <path d="M 182 280 Q 188 298, 182 315 L 176 315 Q 180 298, 176 280 Z" />
        )}

        {/* ── MANDÍBULA D ── */}
        {renderZone("mandibula_d",
          <path d="M 45 235 Q 38 290, 80 335 L 100 335 Q 60 290, 65 235 Z" />
        )}
        {!compact && (
          <text x={65} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-20,65,285)">Mand.D</text>
        )}

        {/* ── MANDÍBULA E ── */}
        {renderZone("mandibula_e",
          <path d="M 255 235 Q 262 290, 220 335 L 200 335 Q 240 290, 235 235 Z" />
        )}
        {!compact && (
          <text x={235} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(20,235,285)">Mand.E</text>
        )}

        {/* ── SUBMENTO ── */}
        {renderZone("submento",
          <ellipse cx={150} cy={355} rx={42} ry={15} />
        )}
        {!compact && (
          <text x={150} y={358} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Submento</text>
        )}

        {/* ══ Quantity badges ══ */}
        {applications.length > 0 && FACE_ZONES.map(z => {
          const qty = getQuantityLabel(z.id, applications);
          if (!qty) return null;
          const pos = ZONE_BADGE_POS[z.id];
          if (!pos) return null;
          return (
            <g key={`badge-${z.id}`} pointerEvents="none">
              <rect x={pos.x - 12} y={pos.y - 7} width={24} height={14} rx={4} fill="white" fillOpacity={0.9} stroke="#94a3b8" strokeWidth={0.5} />
              <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="bold">{qty}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* Badge position offsets for quantity labels */
const ZONE_BADGE_POS: Record<string, { x: number; y: number }> = {
  frontal:          { x: 150, y: 65 },
  glabela:          { x: 150, y: 134 },
  temporal_d:       { x: 42,  y: 95 },
  temporal_e:       { x: 258, y: 95 },
  periocular_d:     { x: 108, y: 163 },
  periocular_e:     { x: 192, y: 163 },
  nasal:            { x: 150, y: 178 },
  malar_d:          { x: 85,  y: 213 },
  malar_e:          { x: 215, y: 213 },
  sulco_ng_d:       { x: 106, y: 252 },
  sulco_ng_e:       { x: 194, y: 252 },
  labio_superior:   { x: 150, y: 248 },
  labio_inferior:   { x: 150, y: 296 },
  comissura_d:      { x: 100, y: 270 },
  comissura_e:      { x: 200, y: 270 },
  mento:            { x: 150, y: 330 },
  linha_marionete_d:{ x: 105, y: 300 },
  linha_marionete_e:{ x: 195, y: 300 },
  mandibula_d:      { x: 52,  y: 310 },
  mandibula_e:      { x: 248, y: 310 },
  submento:         { x: 150, y: 370 },
};
