/**
 * SignatureCanvas — Canvas para captura de assinatura digital (F7)
 *
 * Permite ao profissional assinar digitalmente com mouse ou toque.
 * Exporta como Data URL (PNG) para inserção em PDFs.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenLine, RotateCcw, Check } from "lucide-react";

interface Props {
  onSign: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

export function SignatureCanvas({ onSign, width = 400, height = 150 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = useCallback(() => canvasRef.current?.getContext("2d"), []);

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [getCtx]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    setDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const doDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  };

  const endDraw = () => setDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;
    onSign(canvas.toDataURL("image/png"));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PenLine className="h-4 w-4" />
          Assinatura Digital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="border rounded-lg bg-white dark:bg-gray-100 overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full cursor-crosshair"
            style={{ touchAction: "none" }}
            onMouseDown={startDraw}
            onMouseMove={doDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={doDraw}
            onTouchEnd={endDraw}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={!hasContent}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Limpar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!hasContent}
          >
            <Check className="h-3 w-3 mr-1" /> Confirmar Assinatura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
