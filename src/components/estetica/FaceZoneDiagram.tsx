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
  const w = compact ? 220 : 340;
  const h = compact ? 240 : 370;

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
      <svg width={w} height={h} viewBox="0 0 340 370" className="select-none">
        <defs>
          {/* 3D Lighting filters */}
          <filter id="zone-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
          </filter>
          <filter id="zone-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.6" />
          </filter>

          {/* Inactive zone gradient */}
          <radialGradient id="grad-inactive" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#c8ccd2" />
          </radialGradient>

          {/* Active zone gradients */}
          {activeZoneGradients}
        </defs>

        {/* ── 3D Face base (PNG from Whisk) ── */}
        <image
          href="/cabeca.png"
          x={0} y={0}
          width={340} height={340}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.9}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══════════ ZONAS — sobre a anatomia da imagem ═══════════ */}

        {renderZone("frontal", <ellipse cx={170} cy={52} rx={78} ry={28} />)}
        {!compact && <text x={170} y={56} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600" pointerEvents="none">Frontal</text>}

        {renderZone("glabela", <ellipse cx={170} cy={96} rx={20} ry={12} />)}
        {!compact && <text x={170} y={100} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Glab.</text>}

        {renderZone("temporal_d", <ellipse cx={48} cy={90} rx={22} ry={38} />)}
        {!compact && <text x={48} y={94} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Temp.D</text>}

        {renderZone("temporal_e", <ellipse cx={292} cy={90} rx={22} ry={38} />)}
        {!compact && <text x={292} y={94} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Temp.E</text>}

        {renderZone("periocular_d", <ellipse cx={115} cy={112} rx={32} ry={16} />)}
        {!compact && <text x={115} y={116} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.D</text>}

        {renderZone("periocular_e", <ellipse cx={225} cy={112} rx={32} ry={16} />)}
        {!compact && <text x={225} y={116} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Perioc.E</text>}

        {renderZone("nasal", <path d="M 158 115 L 170 180 L 182 115 Z" />)}
        {!compact && <text x={170} y={155} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Nasal</text>}

        {renderZone("malar_d", <ellipse cx={90} cy={155} rx={38} ry={28} />)}
        {!compact && <text x={90} y={159} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Malar D</text>}

        {renderZone("malar_e", <ellipse cx={250} cy={155} rx={38} ry={28} />)}
        {!compact && <text x={250} y={159} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Malar E</text>}

        {renderZone("sulco_ng_d", <path d="M 132 178 Q 124 200, 132 222 L 140 222 Q 135 200, 140 178 Z" />)}
        {!compact && <text x={124} y={202} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-10,124,202)">SNG D</text>}

        {renderZone("sulco_ng_e", <path d="M 208 178 Q 216 200, 208 222 L 200 222 Q 205 200, 200 178 Z" />)}
        {!compact && <text x={216} y={202} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(10,216,202)">SNG E</text>}

        {renderZone("labio_superior", <ellipse cx={170} cy={202} rx={32} ry={10} />)}
        {!compact && <text x={170} y={206} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Sup</text>}

        {renderZone("labio_inferior", <ellipse cx={170} cy={220} rx={34} ry={10} />)}
        {!compact && <text x={170} y={224} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Láb.Inf</text>}

        {renderZone("comissura_d", <circle cx={130} cy={210} r={9} />)}
        {renderZone("comissura_e", <circle cx={210} cy={210} r={9} />)}

        {renderZone("mento", <ellipse cx={170} cy={248} rx={34} ry={18} />)}
        {!compact && <text x={170} y={252} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Mento</text>}

        {renderZone("linha_marionete_d", <path d="M 126 222 Q 118 240, 126 256 L 134 256 Q 128 240, 134 222 Z" />)}
        {renderZone("linha_marionete_e", <path d="M 214 222 Q 222 240, 214 256 L 206 256 Q 212 240, 206 222 Z" />)}

        {renderZone("mandibula_d", <path d="M 38 180 Q 28 235, 78 275 L 100 275 Q 52 235, 58 180 Z" />)}
        {!compact && <text x={58} y={230} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(-18,58,230)">Mand.D</text>}

        {renderZone("mandibula_e", <path d="M 302 180 Q 312 235, 262 275 L 240 275 Q 288 235, 282 180 Z" />)}
        {!compact && <text x={282} y={230} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none" transform="rotate(18,282,230)">Mand.E</text>}

        {renderZone("submento", <ellipse cx={170} cy={285} rx={48} ry={16} />)}
        {!compact && <text x={170} y={289} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Submento</text>}

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
  frontal:          { x: 170, y: 36 },
  glabela:          { x: 170, y: 110 },
  temporal_d:       { x: 48,  y: 72 },
  temporal_e:       { x: 292, y: 72 },
  periocular_d:     { x: 115, y: 130 },
  periocular_e:     { x: 225, y: 130 },
  nasal:            { x: 170, y: 140 },
  malar_d:          { x: 90,  y: 175 },
  malar_e:          { x: 250, y: 175 },
  sulco_ng_d:       { x: 115, y: 198 },
  sulco_ng_e:       { x: 225, y: 198 },
  labio_superior:   { x: 170, y: 192 },
  labio_inferior:   { x: 170, y: 232 },
  comissura_d:      { x: 114, y: 210 },
  comissura_e:      { x: 226, y: 210 },
  mento:            { x: 170, y: 268 },
  linha_marionete_d:{ x: 112, y: 240 },
  linha_marionete_e:{ x: 228, y: 240 },
  mandibula_d:      { x: 55,  y: 250 },
  mandibula_e:      { x: 285, y: 250 },
  submento:         { x: 170, y: 305 },
};
