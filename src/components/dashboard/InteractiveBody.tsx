import { useState, useRef, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { X, RotateCcw } from "lucide-react";

/* ─── Body region data ─── */
interface BodyRegion {
  id: string;
  label: string;
  description: string;
  specialties: string[];
  path: string;
  cx: number;
  cy: number;
}

const FRONT_REGIONS: BodyRegion[] = [
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

  /* No auto-rotate — only user drag rotates */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
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
  const currentRegions = showingBack ? BACK_REGIONS : FRONT_REGIONS;

  const handleRegionClick = useCallback((region: BodyRegion) => {
    setSelectedRegion(region);
  }, []);

  const resetView = useCallback(() => {
    setRotationY(0);
    setSelectedRegion(null);
    setHoveredRegion(null);
  }, []);

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

      <p className="text-[10px] text-muted-foreground/70 mb-3 text-center">
        {showingBack ? "Vista posterior" : "Vista anterior"} · Arraste para girar · Clique em uma região
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
        <svg
          viewBox="0 0 100 210"
          className="w-full h-full"
          style={{
            transform: `scaleX(${scaleX})`,
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
        >
          <defs>
            {/* Realistic muscle/skin gradients */}
            <linearGradient id="skinBody" x1="0.3" y1="0" x2="0.7" y2="1">
              <stop offset="0%" stopColor="#D4956B" />
              <stop offset="35%" stopColor="#C4845A" />
              <stop offset="70%" stopColor="#B87456" />
              <stop offset="100%" stopColor="#A86648" />
            </linearGradient>
            <linearGradient id="muscleOverlay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C97B5E" />
              <stop offset="50%" stopColor="#B5664A" />
              <stop offset="100%" stopColor="#9E5840" />
            </linearGradient>
            <linearGradient id="skinHead" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#DCAA82" />
              <stop offset="100%" stopColor="#D09670" />
            </linearGradient>
            <linearGradient id="armGradL" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9876A" />
              <stop offset="100%" stopColor="#A8623E" />
            </linearGradient>
            <linearGradient id="armGradR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C9876A" />
              <stop offset="100%" stopColor="#A8623E" />
            </linearGradient>
            <linearGradient id="legGrad" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#B87456" />
              <stop offset="50%" stopColor="#A86648" />
              <stop offset="100%" stopColor="#9E5840" />
            </linearGradient>
            <radialGradient id="bodyShadow" cx="0.5" cy="1" r="0.6">
              <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <filter id="regionGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Floor shadow */}
          <ellipse cx="50" cy="208" rx="20" ry="2.5" fill="url(#bodyShadow)" />

          {/* ===== ANATOMICAL BODY ===== */}

          {/* Full silhouette base — muscle tone */}
          <path
            d="M48,6 C40,6 35,11 34,18 L33,28 C33,33 37,38 42,40 L43,42 L41,50 C40,52 38,53 35,53 L28,56 C24,58 22,63 22,68 L13,105 L12,110 L16,111 L22,85 L26,72 L27,65 L28,75 L33,80 L34,92 L36,104 L32,110 L28,130 L26,155 L24,180 L22,195 L19,206 L20,208 L28,208 L31,205 L32,195 L34,170 L38,140 L42,120 L48,114 L52,114 L58,120 L62,140 L66,170 L68,195 L69,205 L72,208 L80,208 L81,206 L78,195 L76,180 L74,155 L72,130 L68,110 L64,104 L66,92 L67,80 L72,75 L73,65 L74,72 L78,85 L84,111 L88,110 L87,105 L78,68 C78,63 76,58 72,56 L65,53 C62,53 60,52 59,50 L57,42 L58,40 C63,38 67,33 67,28 L66,18 C65,11 60,6 52,6 Z"
            fill="url(#skinBody)"
            stroke="#8B4332"
            strokeWidth="0.35"
          />

          {/* Head — lighter skin */}
          <path
            d="M48,7 C41,7 36,12 35,18.5 L34.5,27 C34.5,32 38,37 42.5,39 L44,40 C45.5,41.5 47,42.5 49,42.5 L51,42.5 C53,42.5 54.5,41.5 56,40 L57.5,39 C62,37 65.5,32 65.5,27 L65,18.5 C64,12 59,7 52,7 Z"
            fill="url(#skinHead)"
            stroke="#B57349"
            strokeWidth="0.25"
          />
          {/* Hair line hint */}
          <path d="M38,10 C42,7 48,6 52,6 C56,6 62,8 64,11" fill="none" stroke="#6B3A28" strokeWidth="0.5" opacity="0.35" />
          {/* Ear left */}
          <ellipse cx="35" cy="25" rx="1.5" ry="3" fill="#D09670" stroke="#B57349" strokeWidth="0.2" />
          {/* Ear right */}
          <ellipse cx="65" cy="25" rx="1.5" ry="3" fill="#D09670" stroke="#B57349" strokeWidth="0.2" />
          {/* Eye sockets */}
          <ellipse cx="44" cy="22" rx="3" ry="1.5" fill="#B57349" opacity="0.15" />
          <ellipse cx="56" cy="22" rx="3" ry="1.5" fill="#B57349" opacity="0.15" />
          {/* Nose */}
          <path d="M49,25 L48,28 L50,29 L52,28 L51,25" fill="none" stroke="#B57349" strokeWidth="0.2" opacity="0.3" />
          {/* Mouth line */}
          <path d="M47,32 Q50,33.5 53,32" fill="none" stroke="#A86648" strokeWidth="0.2" opacity="0.25" />

          {/* Neck */}
          <path
            d="M44.5,42 L43.5,49.5 C43.5,51.5 45.5,52.5 48.5,52.5 L51.5,52.5 C54.5,52.5 56.5,51.5 56.5,49.5 L55.5,42"
            fill="#C9876A"
            stroke="#A86648"
            strokeWidth="0.2"
          />
          {/* Sternocleidomastoid */}
          <path d="M44,43 L42,50 L43,52" fill="none" stroke="#A8623E" strokeWidth="0.3" opacity="0.25" />
          <path d="M56,43 L58,50 L57,52" fill="none" stroke="#A8623E" strokeWidth="0.3" opacity="0.25" />

          {/* Trapezius */}
          <path d="M35,53 L43,50 L50,52.5 L57,50 L65,53 L58,55 L50,54.5 L42,55 Z"
            fill="#B5664A" stroke="#9E5840" strokeWidth="0.15" opacity="0.5" />

          {/* Deltoids */}
          <path d="M28,56 L25,62 L23,68 L27,66 L30,60 L33,56 Z" fill="#C4845A" stroke="#9E5840" strokeWidth="0.15" opacity="0.55" />
          <path d="M72,56 L75,62 L77,68 L73,66 L70,60 L67,56 Z" fill="#C4845A" stroke="#9E5840" strokeWidth="0.15" opacity="0.55" />

          {/* Pectoral muscles */}
          <path d="M34,57 C37,55 42,55 46,57 L49,61 L50,64 L48,66 L40,64 L34,61 Z"
            fill="#B5664A" opacity="0.3" />
          <path d="M66,57 C63,55 58,55 54,57 L51,61 L50,64 L52,66 L60,64 L66,61 Z"
            fill="#B5664A" opacity="0.3" />
          {/* Pec lines */}
          <path d="M34,61 C38,64 44,66 50,64" fill="none" stroke="#9E5840" strokeWidth="0.25" opacity="0.35" />
          <path d="M66,61 C62,64 56,66 50,64" fill="none" stroke="#9E5840" strokeWidth="0.25" opacity="0.35" />

          {/* Biceps */}
          <path d="M23,68 L20,76 L18,84 L20,86 L24,80 L26,74 L27,66 Z" fill="url(#armGradL)" opacity="0.45" />
          <path d="M77,68 L80,76 L82,84 L80,86 L76,80 L74,74 L73,66 Z" fill="url(#armGradR)" opacity="0.45" />
          {/* Forearms */}
          <path d="M18,84 L16,92 L14,100 L15,105 L17,104 L19,96 L20,86 Z" fill="#C4845A" opacity="0.35" />
          <path d="M82,84 L84,92 L86,100 L85,105 L83,104 L81,96 L80,86 Z" fill="#C4845A" opacity="0.35" />

          {/* Abs — rectus abdominis */}
          <line x1="50" y1="64" x2="50" y2="104" stroke="#9E5840" strokeWidth="0.3" opacity="0.25" />
          <line x1="44" y1="67" x2="44" y2="98" stroke="#9E5840" strokeWidth="0.18" opacity="0.18" />
          <line x1="56" y1="67" x2="56" y2="98" stroke="#9E5840" strokeWidth="0.18" opacity="0.18" />
          {/* Horizontal ab lines */}
          <line x1="44" y1="72" x2="56" y2="72" stroke="#9E5840" strokeWidth="0.15" opacity="0.16" />
          <line x1="44" y1="78" x2="56" y2="78" stroke="#9E5840" strokeWidth="0.15" opacity="0.16" />
          <line x1="44" y1="84" x2="56" y2="84" stroke="#9E5840" strokeWidth="0.15" opacity="0.14" />
          <line x1="45" y1="90" x2="55" y2="90" stroke="#9E5840" strokeWidth="0.15" opacity="0.12" />
          <line x1="45" y1="96" x2="55" y2="96" stroke="#9E5840" strokeWidth="0.15" opacity="0.10" />

          {/* Obliques */}
          <path d="M33,65 L38,68 L40,80 L37,92 L34,84 Z" fill="#9E5840" opacity="0.10" />
          <path d="M67,65 L62,68 L60,80 L63,92 L66,84 Z" fill="#9E5840" opacity="0.10" />

          {/* Navel */}
          <circle cx="50" cy="96" r="1.2" fill="#8B4332" opacity="0.25" />

          {/* Nipples */}
          <circle cx="43.5" cy="65" r="0.7" fill="#9E5840" opacity="0.25" />
          <circle cx="56.5" cy="65" r="0.7" fill="#9E5840" opacity="0.25" />

          {/* Serratus anterior */}
          <path d="M34,68 L36,70 L34,72 L36,74 L34,76" fill="none" stroke="#9E5840" strokeWidth="0.2" opacity="0.15" />
          <path d="M66,68 L64,70 L66,72 L64,74 L66,76" fill="none" stroke="#9E5840" strokeWidth="0.2" opacity="0.15" />

          {/* Inguinal lines */}
          <path d="M42,102 L48,114" fill="none" stroke="#9E5840" strokeWidth="0.2" opacity="0.15" />
          <path d="M58,102 L52,114" fill="none" stroke="#9E5840" strokeWidth="0.2" opacity="0.15" />

          {/* Quadriceps */}
          <path d="M35,118 L33,130 L31,145 L32,150 L36,148 L37,138 L38,128 L38,118 Z" fill="url(#legGrad)" opacity="0.25" />
          <path d="M38,118 L37,130 L36,142 L35,155 L37,156 L39,146 L41,133 L42,120 Z" fill="#C4845A" opacity="0.18" />
          <path d="M65,118 L67,130 L69,145 L68,150 L64,148 L63,138 L62,128 L62,118 Z" fill="url(#legGrad)" opacity="0.25" />
          <path d="M62,118 L63,130 L64,142 L65,155 L63,156 L61,146 L59,133 L58,120 Z" fill="#C4845A" opacity="0.18" />

          {/* Knee caps */}
          <ellipse cx="33" cy="158" rx="3.5" ry="3.5" fill="#D4A088" opacity="0.45" stroke="#A86648" strokeWidth="0.15" />
          <ellipse cx="67" cy="158" rx="3.5" ry="3.5" fill="#D4A088" opacity="0.45" stroke="#A86648" strokeWidth="0.15" />

          {/* Tibialis anterior */}
          <path d="M32,162 L30,175 L28,188 L29,190 L32,186 L33,175 L34,162 Z" fill="#C9876A" opacity="0.18" />
          <path d="M68,162 L70,175 L72,188 L71,190 L68,186 L67,175 L66,162 Z" fill="#C9876A" opacity="0.18" />

          {/* Calves */}
          <path d="M28,163 L26,173 L25,181 L27,183 L30,178 L31,170 L31,163 Z" fill="#B5664A" opacity="0.15" />
          <path d="M72,163 L74,173 L75,181 L73,183 L70,178 L69,170 L69,163 Z" fill="#B5664A" opacity="0.15" />

          {/* Hands */}
          <path d="M13,105 L11,109 L12,111 L15,108 L16,106 Z" fill="#DCAA82" stroke="#B57349" strokeWidth="0.15" />
          <path d="M87,105 L89,109 L88,111 L85,108 L84,106 Z" fill="#DCAA82" stroke="#B57349" strokeWidth="0.15" />
          {/* Finger lines */}
          <path d="M12,110 L10.5,112 M12.5,111 L11.5,113.5 M13.5,111 L13,113" fill="none" stroke="#B57349" strokeWidth="0.12" opacity="0.3" />
          <path d="M88,110 L89.5,112 M87.5,111 L88.5,113.5 M86.5,111 L87,113" fill="none" stroke="#B57349" strokeWidth="0.12" opacity="0.3" />

          {/* Feet detail */}
          <path d="M24,200 L22,203 L23,205" fill="none" stroke="#9E5840" strokeWidth="0.15" opacity="0.2" />
          <path d="M76,200 L78,203 L77,205" fill="none" stroke="#9E5840" strokeWidth="0.15" opacity="0.2" />

          {/* ===== BACK VIEW DETAILS ===== */}
          {showingBack && (
            <>
              {/* Spine */}
              <line x1="50" y1="43" x2="50" y2="115" stroke="#7B3A28" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="1.5 1" />
              {/* Vertebrae bumps */}
              {[47, 52, 57, 62, 67, 72, 77, 82, 87, 92, 97, 102, 107, 112].map(y => (
                <circle key={y} cx="50" cy={y} r="0.6" fill="#8B4332" opacity="0.2" />
              ))}
              {/* Scapulae */}
              <path d="M37,58 L41,63 L43,72 L40,76 L35,72 L33,63 Z" fill="#A8523A" opacity="0.2" stroke="#8B4332" strokeWidth="0.15" />
              <path d="M63,58 L59,63 L57,72 L60,76 L65,72 L67,63 Z" fill="#A8523A" opacity="0.2" stroke="#8B4332" strokeWidth="0.15" />
              {/* Lats */}
              <path d="M34,63 L36,76 L40,88 L46,94 L50,95 L54,94 L60,88 L64,76 L66,63"
                fill="none" stroke="#9E5840" strokeWidth="0.2" opacity="0.25" />
              {/* Erector spinae */}
              <path d="M47,55 L47,100" fill="none" stroke="#8B4332" strokeWidth="0.2" opacity="0.15" />
              <path d="M53,55 L53,100" fill="none" stroke="#8B4332" strokeWidth="0.2" opacity="0.15" />
              {/* Gluteals */}
              <ellipse cx="42" cy="112" rx="8" ry="5.5" fill="#B5664A" opacity="0.2" />
              <ellipse cx="58" cy="112" rx="8" ry="5.5" fill="#B5664A" opacity="0.2" />
              <line x1="50" y1="106" x2="50" y2="118" stroke="#8B4332" strokeWidth="0.2" opacity="0.15" />
              {/* Hamstrings */}
              <path d="M35,120 L33,135 L32,150 L35,148 L37,135 L38,120 Z" fill="#A86648" opacity="0.15" />
              <path d="M65,120 L67,135 L68,150 L65,148 L63,135 L62,120 Z" fill="#A86648" opacity="0.15" />
              {/* Calf back */}
              <path d="M29,165 L28,175 L29,185 L32,182 L33,172 L32,165 Z" fill="#B5664A" opacity="0.15" />
              <path d="M71,165 L72,175 L71,185 L68,182 L67,172 L68,165 Z" fill="#B5664A" opacity="0.15" />
            </>
          )}

          {/* ===== INTERACTIVE REGIONS (transparent hit areas) ===== */}
          {currentRegions.map((region) => {
            const isHovered = hoveredRegion === region.id;
            const isSelected = selectedRegion?.id === region.id;
            return (
              <path
                key={region.id}
                d={region.path}
                fill={isSelected ? "rgba(20,184,166,0.25)" : isHovered ? "rgba(20,184,166,0.12)" : "transparent"}
                stroke={isSelected ? "#14b8a6" : isHovered ? "#14b8a6" : "transparent"}
                strokeWidth={isSelected ? "0.8" : "0.4"}
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

          {/* Pulse dot on hovered region */}
          {hoveredRegion && !selectedRegion && (() => {
            const region = currentRegions.find((r) => r.id === hoveredRegion);
            if (!region) return null;
            return (
              <circle
                cx={region.cx}
                cy={region.cy + 100 * (region.cy / 100)}
                r="2"
                fill="#14b8a6"
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
