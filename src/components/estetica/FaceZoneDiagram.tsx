/**
 * FaceZoneDiagram — Diagrama SVG 3D do rosto com zonas clicáveis.
 * Cada zona muda de cor de acordo com os procedimentos aplicados.
 * Usa gradientes radiais e filtros SVG para efeito tridimensional.
 */
import { cn } from "@/lib/utils";
import {
  FACE_ZONES,
  AESTHETIC_PROCEDURES,
  type ZoneApplication,
} from "./aestheticConstants";

interface FaceZoneDiagramProps {
  applications: ZoneApplication[];
  selectedZone: string | null;
  onZoneClick?: (zoneId: string) => void;
  compact?: boolean;
  readOnly?: boolean;
}

function getZoneColor(zoneId: string, apps: ZoneApplication[]): string {
  const zoneApps = apps.filter(a => a.zoneId === zoneId);
  if (zoneApps.length === 0) return "#e5e7eb";
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

export function FaceZoneDiagram({
  applications,
  selectedZone,
  onZoneClick,
  compact = false,
  readOnly = false,
}: FaceZoneDiagramProps) {
  const w = compact ? 200 : 300;
  const h = compact ? 270 : 400;

  const handleClick = (zoneId: string) => {
    if (!readOnly && onZoneClick) onZoneClick(zoneId);
  };

  const zoneLabel = (zoneId: string) =>
    FACE_ZONES.find(z => z.id === zoneId)?.label ?? zoneId;

  const renderZone = (zoneId: string, shape: React.ReactNode) => {
    const fill = getZoneColor(zoneId, applications);
    const isSelected = selectedZone === zoneId;
    const hasApp = applications.some(a => a.zoneId === zoneId);
    const qty = getQuantityLabel(zoneId, applications);

    return (
      <g
        key={zoneId}
        onClick={() => handleClick(zoneId)}
        style={{ cursor: readOnly ? "default" : "pointer" }}
        className="transition-all"
        filter={isSelected ? "url(#zone-glow)" : "url(#zone-shadow)"}
      >
        <g
          opacity={hasApp ? 0.9 : 0.5}
          stroke={isSelected ? "#3b82f6" : "rgba(100,116,139,0.6)"}
          strokeWidth={isSelected ? 2.5 : 0.8}
          fill={hasApp ? `url(#grad-zone-${zoneId})` : "url(#grad-inactive)"}
        >
          {shape}
        </g>
        <title>{`${zoneLabel(zoneId)}${qty ? ` — ${qty}` : ""}`}</title>
      </g>
    );
  };

  /* Generate gradient defs for active zones */
  const activeZoneGradients = FACE_ZONES.map(z => {
    const color = getZoneColor(z.id, applications);
    if (color === "#e5e7eb") return null;
    return (
      <radialGradient key={`grad-zone-${z.id}`} id={`grad-zone-${z.id}`} cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor={lighten(color, 40)} />
        <stop offset="50%" stopColor={color} />
        <stop offset="100%" stopColor={darken(color, 25)} />
      </radialGradient>
    );
  });

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
      <svg width={w} height={h} viewBox="0 0 300 400" className="select-none">
        <defs>
          {/* 3D Lighting filters */}
          <filter id="zone-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
          </filter>
          <filter id="zone-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.6" />
          </filter>
          <filter id="skin-shadow" x="-5%" y="-5%" width="115%" height="115%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
            <feOffset dx="3" dy="5" result="offsetBlur" />
            <feFlood floodColor="rgba(0,0,0,0.2)" result="color" />
            <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Skin 3D gradient */}
          <radialGradient id="skin-3d" cx="40%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fce4d6" />
            <stop offset="40%" stopColor="#f5d0b5" />
            <stop offset="70%" stopColor="#e8b896" />
            <stop offset="100%" stopColor="#d4a07a" />
          </radialGradient>

          {/* Hair gradient */}
          <radialGradient id="hair-3d" cx="50%" cy="20%" r="55%">
            <stop offset="0%" stopColor="#8B6F47" />
            <stop offset="60%" stopColor="#5C4033" />
            <stop offset="100%" stopColor="#3E2723" />
          </radialGradient>

          {/* Inactive zone gradient */}
          <radialGradient id="grad-inactive" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#c8ccd2" />
          </radialGradient>

          {/* Neck shadow */}
          <linearGradient id="neck-shadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          {/* Active zone gradients */}
          {activeZoneGradients}
        </defs>

        {/* ── 3D Face base (PNG from Whisk) ── */}
        <image
          href="/cabeca.png"
          x={0} y={0}
          width={300} height={400}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══════════════════════ ZONAS ═══════════════════════ */}

        {renderZone("frontal", <ellipse cx={150} cy={80} rx={70} ry={30} />)}
        {!compact && <text x={150} y={83} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Frontal</text>}

        {renderZone("glabela", <ellipse cx={150} cy={118} rx={18} ry={12} />)}
        {!compact && <text x={150} y={121} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Glab.</text>}

        {renderZone("temporal_d", <ellipse cx={60} cy={110} rx={22} ry={35} />)}
        {!compact && <text x={60} y={113} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Temp.D</text>}

        {renderZone("temporal_e", <ellipse cx={240} cy={110} rx={22} ry={35} />)}
        {!compact && <text x={240} y={113} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Temp.E</text>}

        {renderZone("periocular_d", <ellipse cx={108} cy={145} rx={28} ry={16} />)}
        {!compact && <text x={108} y={148} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.D</text>}

        {renderZone("periocular_e", <ellipse cx={192} cy={145} rx={28} ry={16} />)}
        {!compact && <text x={192} y={148} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.E</text>}

        {renderZone("nasal", <path d="M 140 165 L 150 215 L 160 165 Z" />)}
        {!compact && <text x={150} y={195} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Nasal</text>}

        {renderZone("malar_d", <ellipse cx={85} cy={195} rx={32} ry={25} />)}
        {!compact && <text x={85} y={198} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Malar D</text>}

        {renderZone("malar_e", <ellipse cx={215} cy={195} rx={32} ry={25} />)}
        {!compact && <text x={215} y={198} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Malar E</text>}

        {renderZone("sulco_ng_d", <path d="M 125 215 Q 118 240, 125 265 L 132 265 Q 128 240, 132 215 Z" />)}
        {!compact && <text x={116} y={242} textAnchor="middle" fontSize="6" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-10,116,242)">SNG D</text>}

        {renderZone("sulco_ng_e", <path d="M 175 215 Q 182 240, 175 265 L 168 265 Q 172 240, 168 215 Z" />)}
        {!compact && <text x={184} y={242} textAnchor="middle" fontSize="6" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(10,184,242)">SNG E</text>}

        {renderZone("labio_superior", <ellipse cx={150} cy={260} rx={28} ry={10} />)}
        {!compact && <text x={150} y={263} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Sup</text>}

        {renderZone("labio_inferior", <ellipse cx={150} cy={282} rx={30} ry={10} />)}
        {!compact && <text x={150} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Inf</text>}

        {renderZone("comissura_d", <circle cx={116} cy={270} r={8} />)}
        {renderZone("comissura_e", <circle cx={184} cy={270} r={8} />)}

        {renderZone("mento", <ellipse cx={150} cy={310} rx={30} ry={18} />)}
        {!compact && <text x={150} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Mento</text>}

        {renderZone("linha_marionete_d", <path d="M 118 280 Q 112 298, 118 315 L 124 315 Q 120 298, 124 280 Z" />)}
        {renderZone("linha_marionete_e", <path d="M 182 280 Q 188 298, 182 315 L 176 315 Q 180 298, 176 280 Z" />)}

        {renderZone("mandibula_d", <path d="M 45 235 Q 38 290, 80 335 L 100 335 Q 60 290, 65 235 Z" />)}
        {!compact && <text x={65} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-20,65,285)">Mand.D</text>}

        {renderZone("mandibula_e", <path d="M 255 235 Q 262 290, 220 335 L 200 335 Q 240 290, 235 235 Z" />)}
        {!compact && <text x={235} y={285} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(20,235,285)">Mand.E</text>}

        {renderZone("submento", <ellipse cx={150} cy={355} rx={42} ry={15} />)}
        {!compact && <text x={150} y={358} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Submento</text>}

        {/* ══ Quantity badges ══ */}
        {applications.length > 0 && FACE_ZONES.map(z => {
          const qty = getQuantityLabel(z.id, applications);
          if (!qty) return null;
          const pos = ZONE_BADGE_POS[z.id];
          if (!pos) return null;
          return (
            <g key={`badge-${z.id}`} pointerEvents="none">
              <rect x={pos.x - 14} y={pos.y - 8} width={28} height={16} rx={8} fill="white" fillOpacity={0.95} stroke="#94a3b8" strokeWidth={0.5} filter="url(#zone-shadow)" />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="bold">{qty}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* Color helpers */
function lighten(hex: string, pct: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * pct / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * pct / 100));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * pct / 100));
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, pct: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * pct / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * pct / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * pct / 100));
  return `rgb(${r},${g},${b})`;
}

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
