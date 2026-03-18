/**
 * BodyZoneDiagram — Diagrama SVG do corpo com zonas clicáveis.
 * Complementa o FaceZoneDiagram para procedimentos corporais.
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

/**
 * SVG body silhouette (200×500 viewBox) — vista frontal simplificada
 */
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
      <svg width={w} height={h} viewBox="0 0 200 500" className="select-none">
        {/* ── Contorno do corpo (referência) ── */}
        <path
          d="M 100 20 
             Q 130 20, 130 50 L 130 55 Q 155 60, 165 100 L 185 180 Q 188 195, 175 195 L 145 195 L 140 140 
             Q 137 130, 130 125 L 130 250 Q 132 280, 140 300 L 150 380 Q 152 400, 145 420 L 140 460 
             Q 138 475, 125 480 L 115 480 Q 108 475, 108 460 L 108 420 L 100 350 L 92 420 L 92 460 
             Q 92 475, 85 480 L 75 480 Q 62 475, 60 460 L 55 420 Q 48 400, 50 380 L 60 300 Q 68 280, 70 250 
             L 70 125 Q 63 130, 60 140 L 55 195 L 25 195 Q 12 195, 15 180 L 35 100 Q 45 60, 70 55 L 70 50 
             Q 70 20, 100 20 Z"
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1}
          strokeDasharray="4,3"
        />

        {/* ── Cabeça (referência) ── */}
        <circle cx={100} cy={30} r={20} fill="none" stroke="#d1d5db" strokeWidth={1} strokeDasharray="3,3" />

        {/* ═══ ZONAS ═══ */}

        {/* Face */}
        {renderZone("face",
          <circle cx={100} cy={30} r={18} />
        )}
        {!compact && <text x={100} y={34} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Face</text>}

        {/* Pescoço */}
        {renderZone("pescoco",
          <rect x={88} y={50} width={24} height={16} rx={4} />
        )}

        {/* Colo */}
        {renderZone("colo",
          <ellipse cx={100} cy={80} rx={30} ry={12} />
        )}
        {!compact && <text x={100} y={83} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Colo</text>}

        {/* Braço D */}
        {renderZone("braco_d",
          <rect x={30} y={100} width={22} height={55} rx={8} transform="rotate(15,41,127)" />
        )}
        {!compact && <text x={35} y={130} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">BrD</text>}

        {/* Braço E */}
        {renderZone("braco_e",
          <rect x={148} y={100} width={22} height={55} rx={8} transform="rotate(-15,159,127)" />
        )}
        {!compact && <text x={165} y={130} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">BrE</text>}

        {/* Antebraço D */}
        {renderZone("antebraco_d",
          <rect x={20} y={160} width={18} height={45} rx={6} transform="rotate(5,29,182)" />
        )}

        {/* Antebraço E */}
        {renderZone("antebraco_e",
          <rect x={162} y={160} width={18} height={45} rx={6} transform="rotate(-5,171,182)" />
        )}

        {/* Mão D */}
        {renderZone("mao_d",
          <ellipse cx={22} cy={215} rx={10} ry={12} />
        )}

        {/* Mão E */}
        {renderZone("mao_e",
          <ellipse cx={178} cy={215} rx={10} ry={12} />
        )}

        {/* Abdômen */}
        {renderZone("abdomen",
          <ellipse cx={100} cy={170} rx={28} ry={40} />
        )}
        {!compact && <text x={100} y={173} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="600" pointerEvents="none">Abdômen</text>}

        {/* Flancos */}
        {renderZone("flancos",
          <>
            <ellipse cx={68} cy={175} rx={10} ry={25} />
            <ellipse cx={132} cy={175} rx={10} ry={25} />
          </>
        )}

        {/* Costas (indicativo — mesmo layout frontal) */}
        {renderZone("costas",
          <rect x={80} y={95} width={40} height={18} rx={6} />
        )}
        {!compact && <text x={100} y={107} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">Costas</text>}

        {/* Glúteo D */}
        {renderZone("gluteo_d",
          <ellipse cx={85} cy={255} rx={18} ry={15} />
        )}

        {/* Glúteo E */}
        {renderZone("gluteo_e",
          <ellipse cx={115} cy={255} rx={18} ry={15} />
        )}

        {/* Coxa D */}
        {renderZone("coxa_d",
          <rect x={72} y={280} width={22} height={60} rx={8} />
        )}
        {!compact && <text x={83} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">CxD</text>}

        {/* Coxa E */}
        {renderZone("coxa_e",
          <rect x={106} y={280} width={22} height={60} rx={8} />
        )}
        {!compact && <text x={117} y={313} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600" pointerEvents="none">CxE</text>}

        {/* Joelho D */}
        {renderZone("joelho_d",
          <ellipse cx={83} cy={355} rx={12} ry={10} />
        )}

        {/* Joelho E */}
        {renderZone("joelho_e",
          <ellipse cx={117} cy={355} rx={12} ry={10} />
        )}
      </svg>
    </div>
  );
}
