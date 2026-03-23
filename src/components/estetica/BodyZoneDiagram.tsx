/**
 * BodyZoneDiagram — Diagrama SVG 3D do corpo com zonas clicáveis.
 * Usa gradientes radiais e filtros SVG para aparência tridimensional.
 */
import { cn } from "@/lib/utils";
import {
  BODY_ZONES,
  AESTHETIC_PROCEDURES,
  type ZoneApplication,
} from "./aestheticConstants";

interface BodyZoneDiagramProps {
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

export function BodyZoneDiagram({
  applications,
  selectedZone,
  onZoneClick,
  compact = false,
  readOnly = false,
}: BodyZoneDiagramProps) {
  const w = compact ? 140 : 200;
  const h = compact ? 350 : 500;

  const handleClick = (zoneId: string) => {
    if (!readOnly && onZoneClick) onZoneClick(zoneId);
  };

  const zoneLabel = (zoneId: string) =>
    BODY_ZONES.find(z => z.id === zoneId)?.label ?? zoneId;

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
        filter={isSelected ? "url(#body-zone-glow)" : "url(#body-zone-shadow)"}
      >
        <g
          opacity={hasApp ? 0.9 : 0.5}
          stroke={isSelected ? "#3b82f6" : "rgba(100,116,139,0.6)"}
          strokeWidth={isSelected ? 2.5 : 0.8}
          fill={hasApp ? `url(#body-grad-${zoneId})` : "url(#body-grad-inactive)"}
        >
          {shape}
        </g>
        <title>{`${zoneLabel(zoneId)}${qty ? ` — ${qty}` : ""}`}</title>
      </g>
    );
  };

  /* Active zone gradients */
  const activeZoneGradients = BODY_ZONES.map(z => {
    const color = getZoneColor(z.id, applications);
    if (color === "#e5e7eb") return null;
    return (
      <radialGradient key={`body-grad-${z.id}`} id={`body-grad-${z.id}`} cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor={lighten(color, 40)} />
        <stop offset="50%" stopColor={color} />
        <stop offset="100%" stopColor={darken(color, 25)} />
      </radialGradient>
    );
  });

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
      <svg width={w} height={h} viewBox="0 0 200 500" className="select-none">
        <defs>
          {/* 3D Filters */}
          <filter id="body-zone-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
          </filter>
          <filter id="body-zone-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.6" />
          </filter>
          <filter id="body-shadow" x="-5%" y="-5%" width="115%" height="115%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
            <feOffset dx="3" dy="4" result="offsetBlur" />
            <feFlood floodColor="rgba(0,0,0,0.18)" result="color" />
            <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Skin 3D gradient */}
          <radialGradient id="body-skin" cx="45%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fce4d6" />
            <stop offset="40%" stopColor="#f5d0b5" />
            <stop offset="75%" stopColor="#e8b896" />
            <stop offset="100%" stopColor="#d4a07a" />
          </radialGradient>

          {/* Hair gradient (head) */}
          <radialGradient id="body-hair" cx="50%" cy="20%" r="55%">
            <stop offset="0%" stopColor="#8B6F47" />
            <stop offset="60%" stopColor="#5C4033" />
            <stop offset="100%" stopColor="#3E2723" />
          </radialGradient>

          {/* Inactive gradient */}
          <radialGradient id="body-grad-inactive" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#c8ccd2" />
          </radialGradient>

          {/* Torso depth */}
          <linearGradient id="torso-depth" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </linearGradient>

          {/* Active zone gradients */}
          {activeZoneGradients}
        </defs>

        {/* ── 3D Body base (PNG from Whisk) ── */}
        <image
          href="/corpo.png"
          x={0} y={0}
          width={200} height={500}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══ ZONAS ═══ */}

        {renderZone("face", <circle cx={100} cy={30} r={18} />)}
        {!compact && <text x={100} y={34} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Face</text>}

        {renderZone("pescoco", <rect x={88} y={50} width={24} height={16} rx={4} />)}

        {renderZone("colo", <ellipse cx={100} cy={80} rx={30} ry={12} />)}
        {!compact && <text x={100} y={83} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Colo</text>}

        {renderZone("braco_d", <rect x={30} y={100} width={22} height={55} rx={8} transform="rotate(15,41,127)" />)}
        {!compact && <text x={35} y={130} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">BrD</text>}

        {renderZone("braco_e", <rect x={148} y={100} width={22} height={55} rx={8} transform="rotate(-15,159,127)" />)}
        {!compact && <text x={165} y={130} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">BrE</text>}

        {renderZone("antebraco_d", <rect x={20} y={160} width={18} height={45} rx={6} transform="rotate(5,29,182)" />)}
        {renderZone("antebraco_e", <rect x={162} y={160} width={18} height={45} rx={6} transform="rotate(-5,171,182)" />)}

        {renderZone("mao_d", <ellipse cx={22} cy={215} rx={10} ry={12} />)}
        {renderZone("mao_e", <ellipse cx={178} cy={215} rx={10} ry={12} />)}

        {renderZone("abdomen", <ellipse cx={100} cy={170} rx={28} ry={40} />)}
        {!compact && <text x={100} y={173} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Abdômen</text>}

        {renderZone("flancos", <>
          <ellipse cx={68} cy={175} rx={10} ry={25} />
          <ellipse cx={132} cy={175} rx={10} ry={25} />
        </>)}

        {renderZone("costas", <rect x={80} y={95} width={40} height={18} rx={6} />)}
        {!compact && <text x={100} y={107} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Costas</text>}

        {renderZone("gluteo_d", <ellipse cx={85} cy={255} rx={18} ry={15} />)}
        {renderZone("gluteo_e", <ellipse cx={115} cy={255} rx={18} ry={15} />)}

        {renderZone("coxa_d", <rect x={72} y={280} width={22} height={60} rx={8} />)}
        {!compact && <text x={83} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">CxD</text>}

        {renderZone("coxa_e", <rect x={106} y={280} width={22} height={60} rx={8} />)}
        {!compact && <text x={117} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">CxE</text>}

        {renderZone("joelho_d", <ellipse cx={83} cy={355} rx={12} ry={10} />)}
        {renderZone("joelho_e", <ellipse cx={117} cy={355} rx={12} ry={10} />)}

        {/* ══ Quantity badges ══ */}
        {applications.length > 0 && BODY_ZONES.map(z => {
          const qty = getQuantityLabel(z.id, applications);
          if (!qty) return null;
          const pos = BODY_BADGE_POS[z.id];
          if (!pos) return null;
          return (
            <g key={`badge-${z.id}`} pointerEvents="none">
              <rect x={pos.x - 14} y={pos.y - 8} width={28} height={16} rx={8} fill="white" fillOpacity={0.95} stroke="#94a3b8" strokeWidth={0.5} filter="url(#body-zone-shadow)" />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="bold">{qty}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const BODY_BADGE_POS: Record<string, { x: number; y: number }> = {
  face:       { x: 100, y: 14 },
  pescoco:    { x: 100, y: 48 },
  colo:       { x: 100, y: 93 },
  braco_d:    { x: 25,  y: 115 },
  braco_e:    { x: 175, y: 115 },
  antebraco_d:{ x: 18,  y: 175 },
  antebraco_e:{ x: 182, y: 175 },
  mao_d:      { x: 22,  y: 230 },
  mao_e:      { x: 178, y: 230 },
  abdomen:    { x: 100, y: 215 },
  flancos:    { x: 150, y: 175 },
  costas:     { x: 100, y: 115 },
  gluteo_d:   { x: 70,  y: 250 },
  gluteo_e:   { x: 130, y: 250 },
  coxa_d:     { x: 65,  y: 310 },
  coxa_e:     { x: 135, y: 310 },
  joelho_d:   { x: 65,  y: 355 },
  joelho_e:   { x: 135, y: 355 },
};
