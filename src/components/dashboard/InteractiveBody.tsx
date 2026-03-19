import { useState, useRef, useCallback, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { X, RotateCcw } from "lucide-react";

/* ─── Body region data ─── */
interface BodyRegion {
  id: string;
  label: string;
  description: string;
  specialties: string[];
  path: string; // SVG path
  /** Center of the region for tooltip positioning (%) */
  cx: number;
  cy: number;
}

const BODY_REGIONS: BodyRegion[] = [
  {
    id: "head",
    label: "Cabeça",
    description: "Cefaleias, enxaquecas, dores faciais, sinusite, problemas visuais e auditivos.",
    specialties: ["Neurologia", "Otorrino", "Oftalmologia"],
    path: "M48,8 C42,8 37,12 36,18 L35,26 C35,30 38,35 42,37 L44,38 C45,40 46,42 48,42 L52,42 C54,42 55,40 56,38 L58,37 C62,35 65,30 65,26 L64,18 C63,12 58,8 52,8 Z",
    cx: 50, cy: 6,
  },
  {
    id: "neck",
    label: "Pescoço",
    description: "Cervicalgia, problemas na tireoide, linfonodos, torcicolos.",
    specialties: ["Ortopedia", "Endocrinologia"],
    path: "M44,42 L43,50 C43,52 45,53 48,53 L52,53 C55,53 57,52 57,50 L56,42 C55,43 54,44 52,44 L48,44 C46,44 45,43 44,42 Z",
    cx: 50, cy: 12,
  },
  {
    id: "chest",
    label: "Tórax",
    description: "Dores torácicas, problemas cardíacos, respiratórios, costelas.",
    specialties: ["Cardiologia", "Pneumologia", "Clínico Geral"],
    path: "M35,53 L30,56 C28,57 27,60 27,63 L28,75 C28,78 30,80 33,80 L42,80 L48,80 L52,80 L58,80 L67,80 C70,80 72,78 72,75 L73,63 C73,60 72,57 70,56 L65,53 L57,53 L52,53 L48,53 L43,53 Z",
    cx: 50, cy: 20,
  },
  {
    id: "left-arm",
    label: "Braço Esquerdo",
    description: "Dores musculares, tendinites, epicondilite, síndrome do túnel do carpo.",
    specialties: ["Ortopedia", "Fisioterapia", "Reumatologia"],
    path: "M27,56 L22,60 L18,70 L15,82 L14,92 L13,105 L16,106 L19,105 L20,95 L22,85 L25,78 L27,72 L28,63 Z",
    cx: 18, cy: 25,
  },
  {
    id: "right-arm",
    label: "Braço Direito",
    description: "Dores musculares, tendinites, epicondilite, fraturas.",
    specialties: ["Ortopedia", "Fisioterapia", "Reumatologia"],
    path: "M73,56 L78,60 L82,70 L85,82 L86,92 L87,105 L84,106 L81,105 L80,95 L78,85 L75,78 L73,72 L72,63 Z",
    cx: 82, cy: 25,
  },
  {
    id: "abdomen",
    label: "Abdômen",
    description: "Dores abdominais, problemas gástricos, hepáticos, intestinais.",
    specialties: ["Gastroenterologia", "Clínico Geral", "Cirurgia"],
    path: "M33,80 L34,92 L36,100 L40,104 L48,106 L52,106 L60,104 L64,100 L66,92 L67,80 L58,80 L52,80 L48,80 L42,80 Z",
    cx: 50, cy: 30,
  },
  {
    id: "pelvis",
    label: "Quadril / Pelve",
    description: "Dores pélvicas, problemas urinários, problemas ginecológicos.",
    specialties: ["Urologia", "Ginecologia", "Ortopedia"],
    path: "M36,104 L32,110 L30,116 L32,118 L38,118 L42,115 L48,114 L52,114 L58,115 L62,118 L68,118 L70,116 L68,110 L64,104 L60,106 L52,108 L48,108 L40,106 Z",
    cx: 50, cy: 38,
  },
  {
    id: "left-leg",
    label: "Perna Esquerda",
    description: "Dores no joelho, varizes, ciática, lesões musculares, fraturas.",
    specialties: ["Ortopedia", "Fisioterapia", "Angiologia"],
    path: "M32,118 L30,130 L28,145 L27,158 L26,170 L25,182 L23,195 L27,196 L30,195 L31,184 L33,170 L34,158 L36,145 L37,135 L38,125 L38,118 Z",
    cx: 30, cy: 55,
  },
  {
    id: "right-leg",
    label: "Perna Direita",
    description: "Dores no joelho, varizes, ciática, lesões musculares, fraturas.",
    specialties: ["Ortopedia", "Fisioterapia", "Angiologia"],
    path: "M68,118 L70,130 L72,145 L73,158 L74,170 L75,182 L77,195 L73,196 L70,195 L69,184 L67,170 L66,158 L64,145 L63,135 L62,125 L62,118 Z",
    cx: 70, cy: 55,
  },
  {
    id: "left-foot",
    label: "Pé Esquerdo",
    description: "Fascite plantar, joanete, entorses, problemas podológicos.",
    specialties: ["Ortopedia", "Podologia"],
    path: "M23,195 L21,200 L19,204 L20,206 L26,207 L30,206 L31,203 L30,198 L30,195 Z",
    cx: 25, cy: 72,
  },
  {
    id: "right-foot",
    label: "Pé Direito",
    description: "Fascite plantar, joanete, entorses, problemas podológicos.",
    specialties: ["Ortopedia", "Podologia"],
    path: "M77,195 L79,200 L81,204 L80,206 L74,207 L70,206 L69,203 L70,198 L70,195 Z",
    cx: 75, cy: 72,
  },
];

/* ─── BACK BODY REGIONS ─── */
const BACK_REGIONS: BodyRegion[] = [
  {
    id: "back-head",
    label: "Occipital",
    description: "Cefaleia tensional, neuralgia occipital, dores cervicais altas.",
    specialties: ["Neurologia", "Fisioterapia"],
    path: "M48,8 C42,8 37,12 36,18 L35,26 C35,30 38,35 42,37 L44,38 C45,40 46,42 48,42 L52,42 C54,42 55,40 56,38 L58,37 C62,35 65,30 65,26 L64,18 C63,12 58,8 52,8 Z",
    cx: 50, cy: 6,
  },
  {
    id: "upper-back",
    label: "Coluna Dorsal",
    description: "Dores dorsais, cifose, hérnia de disco torácica, escoliose.",
    specialties: ["Ortopedia", "Fisioterapia", "Reumatologia"],
    path: "M35,53 L30,56 C28,57 27,60 27,63 L28,75 C28,78 30,80 33,80 L67,80 C70,80 72,78 72,75 L73,63 C73,60 72,57 70,56 L65,53 L35,53 Z",
    cx: 50, cy: 20,
  },
  {
    id: "lower-back",
    label: "Coluna Lombar",
    description: "Lombalgia, hérnia de disco, ciática, espondilose, dores lombares.",
    specialties: ["Ortopedia", "Fisioterapia", "Neurocirurgia"],
    path: "M33,80 L34,92 L36,100 L40,104 L60,104 L64,100 L66,92 L67,80 Z",
    cx: 50, cy: 30,
  },
  {
    id: "back-pelvis",
    label: "Sacro / Glúteos",
    description: "Dores sacrais, síndrome piriforme, bursite trocantérica.",
    specialties: ["Ortopedia", "Fisioterapia"],
    path: "M36,104 L32,110 L30,116 L32,118 L68,118 L70,116 L68,110 L64,104 Z",
    cx: 50, cy: 38,
  },
];

/* ─── Component ─── */
export const InteractiveBody = memo(function InteractiveBody() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotationY, setRotationY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [startRotation, setStartRotation] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const autoRotateRef = useRef<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Auto-rotate animation
  useEffect(() => {
    if (!autoRotate || isDragging) {
      if (autoRotateRef.current) cancelAnimationFrame(autoRotateRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRotationY((prev) => (prev + dt * 0.015) % 360);
      autoRotateRef.current = requestAnimationFrame(tick);
    };
    autoRotateRef.current = requestAnimationFrame(tick);
    return () => {
      if (autoRotateRef.current) cancelAnimationFrame(autoRotateRef.current);
    };
  }, [autoRotate, isDragging]);

  // Mouse/touch drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    setDragStartX(e.clientX);
    setStartRotation(rotationY);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [rotationY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    setRotationY((startRotation + dx * 0.5) % 360);
  }, [isDragging, dragStartX, startRotation]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const showingBack = Math.abs(((rotationY % 360) + 360) % 360 - 180) < 90;
  const currentRegions = showingBack ? BACK_REGIONS : BODY_REGIONS;

  const handleRegionClick = useCallback((region: BodyRegion) => {
    setAutoRotate(false);
    setSelectedRegion(region);
  }, []);

  const resetView = useCallback(() => {
    setRotationY(0);
    setAutoRotate(true);
    setSelectedRegion(null);
    setHoveredRegion(null);
  }, []);

  // Compute the visual scale factor from the Y rotation to achieve a 3D coin-flip illusion
  const normalizedAngle = ((rotationY % 360) + 360) % 360;
  const scaleX = Math.cos((normalizedAngle * Math.PI) / 180);

  return (
    <div className="relative flex flex-col items-center h-full">
      {/* Title */}
      <div className="flex items-center justify-between w-full mb-2 px-1">
        <h3 className="text-sm font-semibold text-foreground">Mapa Corporal</h3>
        <button
          type="button"
          onClick={resetView}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          title="Resetar rotação"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* Instruction */}
      <p className="text-[10px] text-muted-foreground/70 mb-3 text-center">
        {showingBack ? "Vista posterior" : "Vista anterior"} • Arraste para girar • Clique em uma região
      </p>

      {/* 3D Body Container */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 w-full cursor-grab select-none",
          isDragging && "cursor-grabbing"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ perspective: "800px" }}
      >
        {/* Glow effect behind body */}
        <div
          className="absolute inset-0 mx-auto rounded-full opacity-30 blur-3xl"
          style={{
            width: "60%",
            height: "70%",
            top: "10%",
            background: "radial-gradient(ellipse, rgba(20,184,166,0.3) 0%, transparent 70%)",
          }}
        />

        <svg
          viewBox="0 0 100 210"
          className="w-full h-full transition-transform"
          style={{
            transform: `scaleX(${scaleX})`,
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
        >
          <defs>
            {/* Body gradient fill */}
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="bodyStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
            {/* Hover glow filter */}
            <filter id="regionGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Full body outline silhouette */}
          <path
            d="M48,6 C40,6 35,11 34,18 L33,28 C33,33 37,38 42,40 L43,42 L41,50 C40,52 38,53 35,53 L28,56 C24,58 22,63 22,68 L13,105 L12,110 L16,111 L22,85 L26,72 L27,65 L28,75 L33,80 L34,92 L36,104 L32,110 L28,130 L26,155 L24,180 L22,195 L19,206 L20,208 L28,208 L31,205 L32,195 L34,170 L38,140 L42,120 L48,114 L52,114 L58,120 L62,140 L66,170 L68,195 L69,205 L72,208 L80,208 L81,206 L78,195 L76,180 L74,155 L72,130 L68,110 L64,104 L66,92 L67,80 L72,75 L73,65 L74,72 L78,85 L84,111 L88,110 L87,105 L78,68 C78,63 76,58 72,56 L65,53 C62,53 60,52 59,50 L57,42 L58,40 C63,38 67,33 67,28 L66,18 C65,11 60,6 52,6 Z"
            fill="url(#bodyGrad)"
            stroke="url(#bodyStroke)"
            strokeWidth="0.5"
          />

          {/* Interactive regions */}
          {currentRegions.map((region) => {
            const isHovered = hoveredRegion === region.id;
            const isSelected = selectedRegion?.id === region.id;
            return (
              <path
                key={region.id}
                d={region.path}
                fill={isSelected ? "hsla(var(--primary), 0.3)" : isHovered ? "hsla(var(--primary), 0.18)" : "transparent"}
                stroke={isSelected ? "hsl(var(--primary))" : isHovered ? "hsl(var(--primary))" : "transparent"}
                strokeWidth={isSelected ? "1" : "0.5"}
                className="cursor-pointer transition-all duration-200"
                filter={isHovered || isSelected ? "url(#regionGlow)" : undefined}
                onPointerEnter={() => setHoveredRegion(region.id)}
                onPointerLeave={() => setHoveredRegion(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRegionClick(region);
                }}
              />
            );
          })}

          {/* Spine line (decorative) */}
          {showingBack && (
            <line
              x1="50" y1="45" x2="50" y2="115"
              stroke="hsl(var(--primary))"
              strokeWidth="0.4"
              strokeOpacity="0.3"
              strokeDasharray="2 2"
            />
          )}

          {/* Pulse dot on hovered region center */}
          {hoveredRegion && !selectedRegion && (() => {
            const region = currentRegions.find((r) => r.id === hoveredRegion);
            if (!region) return null;
            return (
              <circle
                cx={region.cx}
                cy={region.cy + 100 * (region.cy / 100)}
                r="2"
                fill="hsl(var(--primary))"
                opacity="0.6"
              >
                <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
              </circle>
            );
          })()}
        </svg>

        {/* Hover tooltip */}
        {hoveredRegion && !selectedRegion && (() => {
          const region = currentRegions.find((r) => r.id === hoveredRegion);
          if (!region) return null;
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-lg bg-popover/95 px-3 py-2 text-xs shadow-lg border border-border/50 backdrop-blur-sm"
              style={{
                left: `${region.cx}%`,
                top: `${Math.min(region.cy + 8, 85)}%`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-semibold text-foreground">{region.label}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px]">Clique para ver detalhes</p>
            </div>
          );
        })()}
      </div>

      {/* Selected region info panel */}
      {selectedRegion && (
        <div className="absolute bottom-0 left-0 right-0 z-30 animate-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-xl border bg-card/95 backdrop-blur-md p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm text-foreground">{selectedRegion.label}</h4>
              <button
                type="button"
                onClick={() => setSelectedRegion(null)}
                className="rounded-md p-0.5 hover:bg-muted/60 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{selectedRegion.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedRegion.specialties.map((s) => (
                <span key={s} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rotation indicator */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary/40 transition-all"
            style={{ width: `${((normalizedAngle / 360) * 100)}%` }}
          />
        </div>
        <span className="text-[9px] text-muted-foreground tabular-nums">{Math.round(normalizedAngle)}°</span>
      </div>
    </div>
  );
});
