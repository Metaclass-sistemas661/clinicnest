/**
 * BeforeAfterGallery — Galeria de fotos antes/depois com:
 * - Upload de fotos (before / after)
 * - Modo slider (drag overlay) para comparação
 * - Modo side-by-side
 * - Dados: data da foto, zona, procedimento, notas
 */
import { useState, useRef, useCallback } from "react";
import { Camera, GripVertical, Columns2, Layers, Trash2, Plus, Calendar, MapPin, ZoomIn, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FACE_ZONES, BODY_ZONES } from "./aestheticConstants";

/* ─── Types ─── */

export interface BeforeAfterPhoto {
  id: string;
  type: "before" | "after";
  url: string;
  date: string;        // ISO date
  zone?: string;       // zone id
  procedure?: string;
  notes?: string;
}

export interface BeforeAfterPair {
  id: string;
  label: string;
  zone?: string;
  before?: BeforeAfterPhoto;
  after?: BeforeAfterPhoto;
}

interface BeforeAfterGalleryProps {
  pairs: BeforeAfterPair[];
  onAddPhoto?: (pairId: string, type: "before" | "after", file: File) => void;
  onRemovePair?: (pairId: string) => void;
  onAddPair?: () => void;
  readOnly?: boolean;
}

/* ─── Slider Comparator ─── */

function CompareSlider({
  beforeUrl,
  afterUrl,
  height = 320,
}: {
  beforeUrl: string;
  afterUrl: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50); // percentage

  const handleMove = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.buttons !== 1) return;
      handleMove(e.clientX);
    },
    [handleMove],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove],
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg select-none cursor-col-resize"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseDown={(e) => handleMove(e.clientX)}
    >
      {/* After image (full) */}
      <img
        src={afterUrl}
        alt="Depois"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={beforeUrl}
          alt="Antes"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ width: containerRef.current?.offsetWidth ?? "100%" }}
          draggable={false}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 z-20">
        <Badge className="bg-blue-600 text-white text-[10px]">Antes</Badge>
      </div>
      <div className="absolute top-2 right-2 z-20">
        <Badge className="bg-green-600 text-white text-[10px]">Depois</Badge>
      </div>
    </div>
  );
}

/* ─── Side by Side ─── */

function SideBySide({
  beforeUrl,
  afterUrl,
  height = 320,
}: {
  beforeUrl: string;
  afterUrl: string;
  height?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden" style={{ height }}>
      <div className="relative">
        <img src={beforeUrl} alt="Antes" className="w-full h-full object-cover" />
        <Badge className="absolute top-2 left-2 bg-blue-600 text-white text-[10px]">Antes</Badge>
      </div>
      <div className="relative">
        <img src={afterUrl} alt="Depois" className="w-full h-full object-cover" />
        <Badge className="absolute top-2 left-2 bg-green-600 text-white text-[10px]">Depois</Badge>
      </div>
    </div>
  );
}

/* ─── Main Gallery ─── */

const allZones = [...FACE_ZONES, ...BODY_ZONES];

export function BeforeAfterGallery({
  pairs,
  onAddPhoto,
  onRemovePair,
  onAddPair,
  readOnly = false,
}: BeforeAfterGalleryProps) {
  const [compareMode, setCompareMode] = useState<"slider" | "side">("slider");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ pairId: string; type: "before" | "after" } | null>(null);

  const triggerUpload = (pairId: string, type: "before" | "after") => {
    setUploadTarget({ pairId, type });
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget && onAddPhoto) {
      onAddPhoto(uploadTarget.pairId, uploadTarget.type, file);
    }
    // Reset
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Galeria Antes &amp; Depois</h3>
          <Badge variant="outline" className="text-xs">{pairs.length} par{pairs.length !== 1 ? "es" : ""}</Badge>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={compareMode === "slider" ? "default" : "outline"}
            className="h-7 text-xs px-2"
            onClick={() => setCompareMode("slider")}
          >
            <Layers className="h-3 w-3 mr-1" /> Slider
          </Button>
          <Button
            size="sm"
            variant={compareMode === "side" ? "default" : "outline"}
            className="h-7 text-xs px-2"
            onClick={() => setCompareMode("side")}
          >
            <Columns2 className="h-3 w-3 mr-1" /> Lado a lado
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Cards */}
      {pairs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma imagem adicionada
        </div>
      )}

      {pairs.map(pair => {
        const zone = pair.zone ? allZones.find(z => z.id === pair.zone) : null;
        const hasBoth = !!pair.before && !!pair.after;

        return (
          <div key={pair.id} className="rounded-lg border overflow-hidden">
            {/* Pair header */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{pair.label}</span>
                {zone && (
                  <Badge variant="outline" className="text-[10px]">
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                    {zone.label}
                  </Badge>
                )}
                {pair.before?.date && (
                  <span className="text-muted-foreground flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" /> {pair.before.date}
                  </span>
                )}
                {pair.after?.date && (
                  <span className="text-muted-foreground flex items-center gap-0.5">
                    → {pair.after.date}
                  </span>
                )}
              </div>
              {!readOnly && onRemovePair && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemovePair(pair.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Comparison view */}
            {hasBoth ? (
              <div className="p-2">
                {compareMode === "slider" ? (
                  <CompareSlider beforeUrl={pair.before!.url} afterUrl={pair.after!.url} />
                ) : (
                  <SideBySide beforeUrl={pair.before!.url} afterUrl={pair.after!.url} />
                )}
              </div>
            ) : (
              /* Partial view — upload placeholders */
              <div className="grid grid-cols-2 gap-2 p-2">
                {/* Before */}
                <div className="relative">
                  {pair.before ? (
                    <div className="relative group cursor-pointer" onClick={() => setLightboxUrl(pair.before!.url)}>
                      <img src={pair.before.url} alt="Antes" className="w-full h-40 object-cover rounded" />
                      <Badge className="absolute top-1 left-1 bg-blue-600 text-white text-[10px]">Antes</Badge>
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <ZoomIn className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    !readOnly && (
                      <button
                        className="w-full h-40 border-2 border-dashed rounded flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={() => triggerUpload(pair.id, "before")}
                      >
                        <Camera className="h-5 w-5" />
                        Foto Antes
                      </button>
                    )
                  )}
                </div>

                {/* After */}
                <div className="relative">
                  {pair.after ? (
                    <div className="relative group cursor-pointer" onClick={() => setLightboxUrl(pair.after!.url)}>
                      <img src={pair.after.url} alt="Depois" className="w-full h-40 object-cover rounded" />
                      <Badge className="absolute top-1 left-1 bg-green-600 text-white text-[10px]">Depois</Badge>
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <ZoomIn className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    !readOnly && (
                      <button
                        className="w-full h-40 border-2 border-dashed rounded flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={() => triggerUpload(pair.id, "after")}
                      >
                        <Camera className="h-5 w-5" />
                        Foto Depois
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add pair button */}
      {!readOnly && onAddPair && (
        <Button variant="outline" className="w-full h-9 text-xs" onClick={onAddPair}>
          <Plus className="h-3 w-3 mr-1" />
          Novo par de fotos
        </Button>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader>
            <DialogTitle className="text-sm">Visualização</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Foto" className="w-full max-h-[70vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
