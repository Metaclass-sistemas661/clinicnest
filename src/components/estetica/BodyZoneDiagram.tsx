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
  const w = compact ? 220 : 340;
  const h = compact ? 232 : 360;

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
      <svg width={w} height={h} viewBox="0 0 340 360" className="select-none">
        <defs>
          {/* 3D Filters */}
          <filter id="body-zone-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
          </filter>
          <filter id="body-zone-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.6" />
          </filter>

          {/* Inactive gradient */}
          <radialGradient id="body-grad-inactive" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#c8ccd2" />
          </radialGradient>

          {/* Active zone gradients */}
          {activeZoneGradients}
        </defs>

        {/* ── 3D Body base (PNG) — square image filling viewBox width ── */}
        <image
          href="/corpo.png"
          x={0} y={5}
          width={340} height={340}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.9}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══ ZONAS — posicionadas sobre a anatomia da imagem ═══ */}

        {/* Face */}
        {renderZone("face", <circle cx={170} cy={32} r={22} />)}
        {!compact && <text x={170} y={36} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Face</text>}

        {/* Pescoço */}
        {renderZone("pescoco", <rect x={155} y={52} width={30} height={14} rx={5} />)}

        {/* Colo */}
        {renderZone("colo", <ellipse cx={170} cy={78} rx={42} ry={10} />)}
        {!compact && <text x={170} y={82} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Colo</text>}

        {/* Costas (indicador no peito superior) */}
        {renderZone("costas", <rect x={148} y={90} width={44} height={16} rx={6} />)}
        {!compact && <text x={170} y={101} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Costas</text>}

        {/* Braço D (direito da pessoa = esquerda na tela) */}
        {renderZone("braco_d", <rect x={55} y={92} width={28} height={52} rx={10} transform="rotate(12,69,118)" />)}
        {!compact && <text x={62} y={120} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">BrD</text>}

        {/* Braço E */}
        {renderZone("braco_e", <rect x={257} y={92} width={28} height={52} rx={10} transform="rotate(-12,271,118)" />)}
        {!compact && <text x={278} y={120} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">BrE</text>}

        {/* Antebraço D */}
        {renderZone("antebraco_d", <rect x={38} y={148} width={22} height={42} rx={8} transform="rotate(6,49,169)" />)}

        {/* Antebraço E */}
        {renderZone("antebraco_e", <rect x={280} y={148} width={22} height={42} rx={8} transform="rotate(-6,291,169)" />)}

        {/* Mão D */}
        {renderZone("mao_d", <ellipse cx={42} cy={200} rx={14} ry={12} />)}

        {/* Mão E */}
        {renderZone("mao_e", <ellipse cx={298} cy={200} rx={14} ry={12} />)}

        {/* Abdômen */}
        {renderZone("abdomen", <ellipse cx={170} cy={145} rx={38} ry={35} />)}
        {!compact && <text x={170} y={149} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Abdômen</text>}

        {/* Flancos */}
        {renderZone("flancos", <>
          <ellipse cx={120} cy={145} rx={14} ry={28} />
          <ellipse cx={220} cy={145} rx={14} ry={28} />
        </>)}

        {/* Glúteo D */}
        {renderZone("gluteo_d", <ellipse cx={148} cy={190} rx={22} ry={14} />)}

        {/* Glúteo E */}
        {renderZone("gluteo_e", <ellipse cx={192} cy={190} rx={22} ry={14} />)}

        {/* Coxa D */}
        {renderZone("coxa_d", <rect x={122} y={210} width={30} height={60} rx={10} />)}
        {!compact && <text x={137} y={243} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">CxD</text>}

        {/* Coxa E */}
        {renderZone("coxa_e", <rect x={188} y={210} width={30} height={60} rx={10} />)}
        {!compact && <text x={203} y={243} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">CxE</text>}

        {/* Joelho D */}
        {renderZone("joelho_d", <ellipse cx={137} cy={282} rx={16} ry={12} />)}

        {/* Joelho E */}
        {renderZone("joelho_e", <ellipse cx={203} cy={282} rx={16} ry={12} />)}

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
  face:       { x: 170, y: 16 },
  pescoco:    { x: 170, y: 50 },
  colo:       { x: 170, y: 92 },
  braco_d:    { x: 45,  y: 108 },
  braco_e:    { x: 295, y: 108 },
  antebraco_d:{ x: 32,  y: 162 },
  antebraco_e:{ x: 308, y: 162 },
  mao_d:      { x: 42,  y: 218 },
  mao_e:      { x: 298, y: 218 },
  abdomen:    { x: 170, y: 180 },
  flancos:    { x: 235, y: 145 },
  costas:     { x: 170, y: 112 },
  gluteo_d:   { x: 130, y: 188 },
  gluteo_e:   { x: 210, y: 188 },
  coxa_d:     { x: 118, y: 240 },
  coxa_e:     { x: 222, y: 240 },
  joelho_d:   { x: 120, y: 282 },
  joelho_e:   { x: 220, y: 282 },
};
