import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Focus, Layers, RotateCcw, X } from "lucide-react";

/* ─── Body pin / point data ─── */
interface BodyPin {
  id: string;
  label: string;
  value: string;
  emoji: string;
  description: string;
  specialties: string[];
  top: string;
  left: string;
  cardSide: "left" | "right";
}

/* ─── View system — each view has its own image + pins ─── */
interface BodyView {
  id: string;
  label: string;
  /** Image path — swap when real PNGs arrive */
  image: string;
  /** CSS transform applied to the image (e.g. mirror for back) */
  imageTransform?: string;
  pins: BodyPin[];
}

const VIEWS: BodyView[] = [
  {
    id: "anterior",
    label: "Vista Anterior",
    image: "/MAPA-CORPORAL.png",
    pins: [
      { id: "head", label: "Neurológico", value: "Normal", emoji: "🧠", description: "Funções cognitivas, cefaleias, enxaquecas.", specialties: ["Neurologia"], top: "6%", left: "50%", cardSide: "right" },
      { id: "chest", label: "Freq. Cardíaca", value: "72 bpm", emoji: "🫀", description: "Ritmo cardíaco, dores torácicas, arritmias.", specialties: ["Cardiologia", "Pneumologia"], top: "28%", left: "44%", cardSide: "left" },
      { id: "lungs", label: "Respiratório", value: "SpO₂ 98%", emoji: "🫁", description: "Capacidade pulmonar, asma, bronquite.", specialties: ["Pneumologia"], top: "28%", left: "56%", cardSide: "right" },
      { id: "abdomen", label: "Digestivo", value: "Normal", emoji: "🩺", description: "Aparelho digestivo, fígado, estômago.", specialties: ["Gastroenterologia"], top: "43%", left: "50%", cardSide: "right" },
      { id: "pelvis", label: "Urológico", value: "Normal", emoji: "💧", description: "Sistema urinário, rins, bexiga.", specialties: ["Urologia", "Nefrologia"], top: "54%", left: "50%", cardSide: "left" },
      { id: "knee-l", label: "Joelho Esq.", value: "Sem dor", emoji: "🦴", description: "Articulação, menisco, ligamentos.", specialties: ["Ortopedia"], top: "72%", left: "42%", cardSide: "left" },
      { id: "knee-r", label: "Joelho Dir.", value: "Sem dor", emoji: "🦴", description: "Articulação, menisco, ligamentos.", specialties: ["Ortopedia"], top: "72%", left: "58%", cardSide: "right" },
    ],
  },
  {
    id: "posterior",
    label: "Vista Posterior",
    image: "/MAPA-CORPORAL.png",
    imageTransform: "scaleX(-1)",
    pins: [
      { id: "cervical", label: "Cervical", value: "Normal", emoji: "🦴", description: "Vértebras cervicais, tensão muscular, hérnia.", specialties: ["Ortopedia", "Neurologia"], top: "12%", left: "50%", cardSide: "right" },
      { id: "trapezio", label: "Trapézio", value: "Tensão leve", emoji: "💪", description: "Musculatura do trapézio, contraturas, dor.", specialties: ["Ortopedia", "Fisioterapia"], top: "22%", left: "38%", cardSide: "left" },
      { id: "escapula", label: "Escápula", value: "Normal", emoji: "🦴", description: "Região escapular, mobilidade, dor referida.", specialties: ["Ortopedia"], top: "26%", left: "60%", cardSide: "right" },
      { id: "coluna", label: "Coluna Torácica", value: "Normal", emoji: "🦴", description: "Vértebras torácicas, postura, escoliose.", specialties: ["Ortopedia", "Reumatologia"], top: "34%", left: "50%", cardSide: "left" },
      { id: "lombar", label: "Lombar", value: "Dor crônica", emoji: "⚠️", description: "Região lombar, hérnia de disco, lombalgia.", specialties: ["Ortopedia", "Neurologia"], top: "46%", left: "50%", cardSide: "right" },
      { id: "gluteo", label: "Glúteo", value: "Normal", emoji: "💪", description: "Musculatura glútea, ciática, bursite.", specialties: ["Ortopedia", "Fisioterapia"], top: "56%", left: "50%", cardSide: "left" },
      { id: "panturrilha", label: "Panturrilha", value: "Sem dor", emoji: "🦵", description: "Musculatura posterior da perna, câimbras.", specialties: ["Ortopedia", "Angiologia"], top: "78%", left: "44%", cardSide: "left" },
    ],
  },
  {
    id: "lateral-dir",
    label: "Lateral Direita",
    image: "/MAPA-CORPORAL.png",
    imageTransform: "perspective(600px) rotateY(-25deg)",
    pins: [
      { id: "temporal", label: "Temporal", value: "Normal", emoji: "🧠", description: "Região temporal, cefaleia tensional.", specialties: ["Neurologia"], top: "8%", left: "48%", cardSide: "right" },
      { id: "ombro-dir", label: "Ombro Dir.", value: "Normal", emoji: "🦴", description: "Articulação do ombro, manguito rotador.", specialties: ["Ortopedia"], top: "22%", left: "34%", cardSide: "left" },
      { id: "cotovelo-dir", label: "Cotovelo Dir.", value: "Normal", emoji: "🦴", description: "Epicondilite, bursite, mobilidade.", specialties: ["Ortopedia"], top: "38%", left: "30%", cardSide: "left" },
      { id: "quadril-dir", label: "Quadril Dir.", value: "Normal", emoji: "🦴", description: "Articulação coxofemoral, artrose.", specialties: ["Ortopedia", "Reumatologia"], top: "52%", left: "46%", cardSide: "right" },
      { id: "tornozelo-dir", label: "Tornozelo Dir.", value: "Sem dor", emoji: "🦶", description: "Entorse, tendinite, mobilidade articular.", specialties: ["Ortopedia"], top: "88%", left: "48%", cardSide: "right" },
    ],
  },
  {
    id: "lateral-esq",
    label: "Lateral Esquerda",
    image: "/MAPA-CORPORAL.png",
    imageTransform: "perspective(600px) rotateY(25deg)",
    pins: [
      { id: "temporal-e", label: "Temporal", value: "Normal", emoji: "🧠", description: "Região temporal, cefaleia tensional.", specialties: ["Neurologia"], top: "8%", left: "52%", cardSide: "left" },
      { id: "ombro-esq", label: "Ombro Esq.", value: "Normal", emoji: "🦴", description: "Articulação do ombro, manguito rotador.", specialties: ["Ortopedia"], top: "22%", left: "66%", cardSide: "right" },
      { id: "cotovelo-esq", label: "Cotovelo Esq.", value: "Normal", emoji: "🦴", description: "Epicondilite, bursite, mobilidade.", specialties: ["Ortopedia"], top: "38%", left: "70%", cardSide: "right" },
      { id: "quadril-esq", label: "Quadril Esq.", value: "Normal", emoji: "🦴", description: "Articulação coxofemoral, artrose.", specialties: ["Ortopedia", "Reumatologia"], top: "52%", left: "54%", cardSide: "left" },
      { id: "tornozelo-esq", label: "Tornozelo Esq.", value: "Sem dor", emoji: "🦶", description: "Entorse, tendinite, mobilidade articular.", specialties: ["Ortopedia"], top: "88%", left: "52%", cardSide: "left" },
    ],
  },
];

/** Layer thumbnails for the bottom gallery */
type BodyLayer = "skin" | "muscle" | "organs" | "skeleton";
interface LayerOption {
  id: BodyLayer;
  label: string;
  emoji: string;
  gradient: string;
}
const LAYERS: LayerOption[] = [
  { id: "skin", label: "Pele", emoji: "🧍", gradient: "from-amber-200 to-orange-300" },
  { id: "muscle", label: "Músculos", emoji: "💪", gradient: "from-rose-400 to-red-500" },
  { id: "organs", label: "Órgãos", emoji: "🫀", gradient: "from-pink-400 to-fuchsia-500" },
  { id: "skeleton", label: "Esqueleto", emoji: "🦴", gradient: "from-slate-300 to-slate-500" },
];

/** Rotation angles per view index for the CSS 3D transition */
const VIEW_ANGLES = [0, 180, 270, 90];

export const InteractiveBody = memo(function InteractiveBody() {
  const [selectedPin, setSelectedPin] = useState<BodyPin | null>(null);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<BodyLayer>("skin");
  const [viewIndex, setViewIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentView = VIEWS[viewIndex];

  const rotateView = useCallback((direction: 1 | -1) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedPin(null);
    setHoveredPin(null);
    setViewIndex(prev => (prev + direction + VIEWS.length) % VIEWS.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const resetView = useCallback(() => {
    setSelectedPin(null);
    setHoveredPin(null);
    setViewIndex(0);
  }, []);

  const activePinForCard = selectedPin ?? (hoveredPin ? currentView.pins.find(p => p.id === hoveredPin) : null);

  return (
    <div className="relative flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 z-10">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">Mapa Corporal 360°</h3>
          <p className="text-[10px] text-muted-foreground/70">
            {currentView.label} · Clique nos pontos
          </p>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          title="Resetar visão"
        >
          <Focus className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* View indicator dots */}
      <div className="flex items-center justify-center gap-1.5 pb-1 z-10">
        {VIEWS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => { if (!isTransitioning) { setIsTransitioning(true); setSelectedPin(null); setHoveredPin(null); setViewIndex(i); setTimeout(() => setIsTransitioning(false), 500); }}}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === viewIndex
                ? "w-4 bg-blue-500"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
            title={v.label}
          />
        ))}
      </div>

      {/* Main viewport */}
      <div className="relative flex-1 min-h-0">
        {/* 3D Perspective Container */}
        <div className="absolute inset-0" style={{ perspective: "1200px" }}>
          {/* Rotating body image */}
          <div
            className="absolute inset-0 flex items-center justify-center select-none"
            style={{
              transform: `rotateY(${VIEW_ANGLES[viewIndex]}deg)`,
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          >
            <img
              src={currentView.image}
              alt={currentView.label}
              className="h-[94%] w-auto max-w-full object-contain pointer-events-none"
              draggable={false}
              style={{
                transform: currentView.imageTransform || undefined,
                filter:
                  activeLayer === "muscle" ? "saturate(1.3) contrast(1.05)"
                  : activeLayer === "organs" ? "hue-rotate(-10deg) saturate(1.2)"
                  : activeLayer === "skeleton" ? "saturate(0.35) contrast(1.2)"
                  : undefined,
                transition: "filter 0.3s ease",
              }}
            />
          </div>

          {/* Fade overlay for smooth view transitions */}
          <div
            className="absolute inset-0 bg-background/80 pointer-events-none z-[5]"
            style={{
              opacity: isTransitioning ? 1 : 0,
              transition: "opacity 0.25s ease",
            }}
          />
        </div>

        {/* Rotation Arrow — LEFT */}
        <button
          type="button"
          onClick={() => rotateView(-1)}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/50 dark:border-slate-700/50 shadow-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition-all active:scale-90"
          title="Girar para esquerda"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Rotation Arrow — RIGHT */}
        <button
          type="button"
          onClick={() => rotateView(1)}
          className="absolute right-12 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/50 dark:border-slate-700/50 shadow-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 transition-all active:scale-90"
          title="Girar para direita"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Pulsing Blue Pins */}
        {!isTransitioning && currentView.pins.map((pin) => {
          const isActive = activePinForCard?.id === pin.id;
          return (
            <button
              key={pin.id}
              type="button"
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group animate-in fade-in duration-300"
              style={{ top: pin.top, left: pin.left }}
              onClick={() => setSelectedPin(isActive && selectedPin?.id === pin.id ? null : pin)}
              onMouseEnter={() => setHoveredPin(pin.id)}
              onMouseLeave={() => setHoveredPin(null)}
            >
              <span className={cn(
                "absolute inset-0 -m-2 rounded-full border-2 border-blue-400/50",
                isActive ? "animate-ping opacity-40" : "animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-30"
              )} />
              <span className="absolute inset-0 -m-1 rounded-full bg-blue-400/20" />
              <span className={cn(
                "relative block h-3 w-3 rounded-full shadow-lg shadow-blue-500/30 transition-transform duration-200",
                isActive ? "bg-blue-500 scale-125" : "bg-blue-500 group-hover:scale-125"
              )} />
            </button>
          );
        })}

        {/* Floating Tooltip Card */}
        {!isTransitioning && activePinForCard && (() => {
          const pin = activePinForCard;
          const pinTopNum = parseFloat(pin.top);
          const pinLeftNum = parseFloat(pin.left);
          const isLeft = pin.cardSide === "left";
          const cardLeft = isLeft ? Math.max(2, pinLeftNum - 42) : Math.min(98, pinLeftNum + 6);
          const cardTop = Math.max(2, pinTopNum - 4);

          return (
            <div className="pointer-events-none absolute inset-0 z-20">
              <svg className="absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
                <line
                  x1={`${pinLeftNum}%`} y1={`${pinTopNum}%`}
                  x2={`${isLeft ? cardLeft + 36 : cardLeft}%`} y2={`${cardTop + 2}%`}
                  stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" opacity="0.5"
                />
              </svg>
              <div
                className="pointer-events-auto absolute bg-white dark:bg-slate-800 shadow-xl shadow-black/10 rounded-2xl px-3 py-2 flex items-center gap-2.5 border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200"
                style={{
                  left: `${cardLeft}%`,
                  top: `${cardTop}%`,
                  minWidth: "120px",
                  maxWidth: "160px",
                }}
              >
                <span className="text-xl leading-none shrink-0">{pin.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-foreground truncate leading-tight">{pin.label}</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">{pin.value}</p>
                </div>
                {selectedPin?.id === pin.id && (
                  <button
                    type="button"
                    onClick={() => setSelectedPin(null)}
                    className="pointer-events-auto ml-auto rounded-md p-0.5 hover:bg-muted/60 transition-colors shrink-0"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Floating Toolbar */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-white/50 dark:border-slate-700/50 p-1.5 shadow-lg">
          {[
            { icon: Focus, label: "Foco", action: resetView },
            { icon: Layers, label: "Camada", action: () => setActiveLayer(prev => { const idx = LAYERS.findIndex(l => l.id === prev); return LAYERS[(idx + 1) % LAYERS.length].id; }) },
            { icon: RotateCcw, label: "Reset", action: resetView },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-muted-foreground/70 transition-all hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
              title={label}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[7px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected pin detail panel */}
      {selectedPin && (
        <div className="absolute bottom-14 left-2 right-2 z-30 animate-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-xl border bg-card/95 backdrop-blur-md p-3 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedPin.emoji}</span>
                <h4 className="font-semibold text-xs text-foreground">{selectedPin.label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPin(null)}
                className="rounded-md p-0.5 hover:bg-muted/60 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{selectedPin.description}</p>
            <div className="flex flex-wrap gap-1">
              {selectedPin.specialties.map((s) => (
                <span key={s} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-700 dark:text-blue-400">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Gallery — Layer Thumbnails */}
      <div className="relative z-10 px-3 pb-3 pt-1">
        <div className="flex items-center justify-center gap-2">
          {LAYERS.map((layer) => {
            const active = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveLayer(layer.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all duration-200 border-2",
                  active
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md shadow-blue-500/10"
                    : "border-transparent hover:border-blue-300 dark:hover:border-blue-700 hover:bg-muted/40 cursor-pointer",
                )}
                title={layer.label}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm",
                  layer.gradient,
                  active ? "shadow-inner" : "",
                )}>
                  {layer.emoji}
                </div>
                <span className={cn(
                  "text-[8px] font-semibold tracking-wide uppercase",
                  active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground",
                )}>{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
