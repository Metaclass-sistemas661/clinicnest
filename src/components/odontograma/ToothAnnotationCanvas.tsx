/**
 * F9: ToothAnnotationCanvas — Anotações gráficas livres sobre dentes
 * 
 * Componente HTML5 Canvas para desenho livre de marcações:
 * - Trincas, linhas de fratura
 * - Indicadores de lesão
 * - Anotações visuais personalizadas
 * 
 * Usa API Canvas nativa (sem dependência externa).
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Eraser, Undo2, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface ToothAnnotationCanvasProps {
  toothNumber: number;
  width?: number;
  height?: number;
  existingAnnotation?: string | null; // base64 image data
  onSave?: (dataUrl: string) => void;
  readOnly?: boolean;
}

const COLORS = [
  { value: "#ef4444", label: "Vermelho" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#22c55e", label: "Verde" },
  { value: "#000000", label: "Preto" },
  { value: "#f59e0b", label: "Amarelo" },
];

const WIDTHS = [1, 2, 3, 5];

export function ToothAnnotationCanvas({
  toothNumber,
  width = 200,
  height = 200,
  existingAnnotation,
  onSave,
  readOnly = false,
}: ToothAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(2);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Load existing annotation
  useEffect(() => {
    if (existingAnnotation && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = existingAnnotation;
    }
  }, [existingAnnotation, width, height]);

  // Redraw all strokes
  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // Draw existing annotation background if exists
    if (existingAnnotation) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        // Redraw strokes on top
        for (const stroke of strokes) {
          drawStroke(ctx, stroke);
        }
      };
      img.src = existingAnnotation;
    } else {
      for (const stroke of strokes) {
        drawStroke(ctx, stroke);
      }
    }
  }, [strokes, width, height, existingAnnotation]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentStroke([point]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);

    // Live drawing
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && currentStroke.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? lineWidth * 3 : lineWidth;
      ctx.lineCap = "round";
      const prevPoint = currentStroke[currentStroke.length - 1];
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const handleEnd = () => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      const stroke: Stroke = {
        points: currentStroke,
        color: tool === "eraser" ? "#ffffff" : color,
        width: tool === "eraser" ? lineWidth * 3 : lineWidth,
      };
      setStrokes(prev => [...prev, stroke]);
    }
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, width, height);
  };

  const handleSave = () => {
    if (!canvasRef.current || !onSave) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `anotacao_dente_${toothNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Anotações — Dente {toothNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={tool === "pen" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("pen")}
              className="h-7 gap-1"
            >
              <Pencil className="h-3 w-3" /> Caneta
            </Button>
            <Button
              variant={tool === "eraser" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("eraser")}
              className="h-7 gap-1"
            >
              <Eraser className="h-3 w-3" /> Borracha
            </Button>
            <div className="h-5 w-px bg-border" />
            {COLORS.map(c => (
              <button
                key={c.value}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  color === c.value ? "scale-125 border-ring" : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.label}
              />
            ))}
            <div className="h-5 w-px bg-border" />
            {WIDTHS.map(w => (
              <button
                key={w}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded border transition-colors",
                  lineWidth === w ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                onClick={() => setLineWidth(w)}
                title={`${w}px`}
              >
                <div className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
            <div className="h-5 w-px bg-border" />
            <Button variant="ghost" size="sm" className="h-7" onClick={handleUndo} disabled={strokes.length === 0}>
              <Undo2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={handleClear}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Canvas */}
        <div className="border rounded-lg overflow-hidden bg-white" style={{ width, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="touch-none cursor-crosshair"
            style={{ width: "100%", height: "auto" }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex gap-2">
            {onSave && (
              <Button size="sm" onClick={handleSave} className="gap-1">
                Salvar Anotação
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
              <Download className="h-3 w-3" /> Exportar PNG
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
