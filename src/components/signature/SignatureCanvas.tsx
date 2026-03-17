import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Loader2 } from "lucide-react";

interface SignatureCanvasProps {
  onComplete: (dataUrl: string) => void;
  onClear?: () => void;
  patientName: string;
  disabled?: boolean;
}

export function SignatureCanvas({ onComplete, onClear, patientName, disabled }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  const MIN_STROKES = 2;

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }, []);

  // Init canvas with high DPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#1a1a2e";
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, [disabled, getCtx, getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStrokes(true);
  }, [isDrawing, disabled, getCtx, getPos]);

  const endDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    setStrokeCount((c) => c + 1);
  }, [isDrawing]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasStrokes(false);
    setStrokeCount(0);
    onClear?.();
  }, [getCtx, onClear]);

  const handleConfirm = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsConfirming(true);
    // Small delay so loader is visible
    await new Promise((r) => setTimeout(r, 150));
    const dataUrl = canvas.toDataURL("image/png");
    onComplete(dataUrl);
    setIsConfirming(false);
  }, [onComplete]);

  const canConfirm = hasStrokes && strokeCount >= MIN_STROKES && !disabled;

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white dark:bg-zinc-950 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height: 200, touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {/* Dotted line */}
        <div className="absolute bottom-12 left-6 right-6 border-b border-dotted border-muted-foreground/30" />
        <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-muted-foreground/50 select-none pointer-events-none">
          Assine acima desta linha — {patientName}
        </p>
        {!hasStrokes && (
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground/30 select-none pointer-events-none">
            Desenhe sua assinatura aqui
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!hasStrokes || disabled}
          className="gap-2"
        >
          <Eraser className="h-4 w-4" />
          Limpar
        </Button>
        <div className="flex items-center gap-2">
          {hasStrokes && strokeCount < MIN_STROKES && (
            <p className="text-[11px] text-amber-600">Assinatura muito simples</p>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm || isConfirming}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Confirmar Assinatura
          </Button>
        </div>
      </div>
    </div>
  );
}
