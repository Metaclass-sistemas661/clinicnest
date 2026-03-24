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
  const w = compact ? 260 : 380;
  const h = compact ? 340 : 520;

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
      <svg width={w} height={h} viewBox="0 0 380 520" className="select-none">
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

        {/* ── 3D Body base (PNG) — imagem mais alta, centralizada no viewBox ── */}
        <image
          href="/corpo.png"
          x={10} y={10}
          width={360} height={490}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.9}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══ ZONAS — posicionadas sobre a anatomia da imagem ═══ */}

        {/* Face */}
        {renderZone("face", <circle cx={190} cy={52} r={26} />)}
        {!compact && <text x={190} y={56} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600" pointerEvents="none">Face</text>}

        {/* Pescoço */}
        {renderZone("pescoco", <rect x={173} y={76} width={34} height={16} rx={6} />)}

        {/* Colo */}
        {renderZone("colo", <ellipse cx={190} cy={108} rx={48} ry={14} />)}
        {!compact && <text x={190} y={112} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Colo</text>}

        {/* Costas (indicador no peito superior) */}
        {renderZone("costas", <rect x={164} y={124} width={52} height={20} rx={7} />)}
        {!compact && <text x={190} y={138} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">Costas</text>}

        {/* Braço D (direito da pessoa = esquerda na tela) */}
        {renderZone("braco_d", <rect x={62} y={125} width={30} height={60} rx={12} transform="rotate(10,77,155)" />)}
        {!compact && <text x={68} y={158} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">BrD</text>}

        {/* Braço E */}
        {renderZone("braco_e", <rect x={288} y={125} width={30} height={60} rx={12} transform="rotate(-10,303,155)" />)}
        {!compact && <text x={312} y={158} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">BrE</text>}

        {/* Antebraço D */}
        {renderZone("antebraco_d", <rect x={42} y={195} width={24} height={48} rx={9} transform="rotate(5,54,219)" />)}

        {/* Antebraço E */}
        {renderZone("antebraco_e", <rect x={314} y={195} width={24} height={48} rx={9} transform="rotate(-5,326,219)" />)}

        {/* Mão D */}
        {renderZone("mao_d", <ellipse cx={44} cy={260} rx={16} ry={14} />)}

        {/* Mão E */}
        {renderZone("mao_e", <ellipse cx={336} cy={260} rx={16} ry={14} />)}

        {/* Abdômen */}
        {renderZone("abdomen", <ellipse cx={190} cy={195} rx={44} ry={42} />)}
        {!compact && <text x={190} y={199} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600" pointerEvents="none">Abdômen</text>}

        {/* Flancos */}
        {renderZone("flancos", <>
          <ellipse cx={132} cy={195} rx={16} ry={32} />
          <ellipse cx={248} cy={195} rx={16} ry={32} />
        </>)}

        {/* Glúteo D */}
        {renderZone("gluteo_d", <ellipse cx={164} cy={255} rx={24} ry={16} />)}

        {/* Glúteo E */}
        {renderZone("gluteo_e", <ellipse cx={216} cy={255} rx={24} ry={16} />)}

        {/* Coxa D */}
        {renderZone("coxa_d", <rect x={132} y={285} width={36} height={76} rx={12} />)}
        {!compact && <text x={150} y={328} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">CxD</text>}

        {/* Coxa E */}
        {renderZone("coxa_e", <rect x={212} y={285} width={36} height={76} rx={12} />)}
        {!compact && <text x={230} y={328} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600" pointerEvents="none">CxE</text>}

        {/* Joelho D */}
        {renderZone("joelho_d", <ellipse cx={150} cy={378} rx={18} ry={14} />)}

        {/* Joelho E */}
        {renderZone("joelho_e", <ellipse cx={230} cy={378} rx={18} ry={14} />)}

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
  face:       { x: 190, y: 30 },
  pescoco:    { x: 190, y: 74 },
  colo:       { x: 190, y: 125 },
  braco_d:    { x: 50,  y: 142 },
  braco_e:    { x: 330, y: 142 },
  antebraco_d:{ x: 36,  y: 212 },
  antebraco_e:{ x: 344, y: 212 },
  mao_d:      { x: 44,  y: 280 },
  mao_e:      { x: 336, y: 280 },
  abdomen:    { x: 190, y: 240 },
  flancos:    { x: 262, y: 195 },
  costas:     { x: 190, y: 147 },
  gluteo_d:   { x: 142, y: 252 },
  gluteo_e:   { x: 238, y: 252 },
  coxa_d:     { x: 126, y: 328 },
  coxa_e:     { x: 254, y: 328 },
  joelho_d:   { x: 132, y: 378 },
  joelho_e:   { x: 248, y: 378 },
};
