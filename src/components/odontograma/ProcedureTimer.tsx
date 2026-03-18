/**
 * ProcedureTimer — Cronômetro para procedimentos odontológicos (F16)
 *
 * Exibe tempo decorrido, permite pausar/retomar, mostra histórico de laps.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, RotateCcw, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lap {
  label: string;
  elapsed: number; // ms
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(String(h).padStart(2, "0"));
  parts.push(String(m).padStart(2, "0"));
  parts.push(String(s).padStart(2, "0"));
  return parts.join(":");
}

export function ProcedureTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const baseRef = useRef(0);

  const tick = useCallback(() => {
    setElapsed(baseRef.current + Date.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleStart = () => {
    startRef.current = Date.now();
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePause = () => {
    cancelAnimationFrame(rafRef.current);
    baseRef.current = elapsed;
    setRunning(false);
  };

  const handleReset = () => {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
    setLaps([]);
  };

  const handleLap = () => {
    const lapNum = laps.length + 1;
    setLaps((prev) => [...prev, { label: `Etapa ${lapNum}`, elapsed }]);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Cronômetro do Procedimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p
            className={cn(
              "text-4xl font-mono font-bold tabular-nums",
              running ? "text-green-600 dark:text-green-400" : "text-foreground"
            )}
          >
            {formatTime(elapsed)}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {!running ? (
            <Button size="sm" onClick={handleStart}>
              <Play className="h-4 w-4 mr-1" /> {elapsed === 0 ? "Iniciar" : "Retomar"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-1" /> Pausar
            </Button>
          )}
          {running && (
            <Button size="sm" variant="ghost" onClick={handleLap}>
              <Flag className="h-4 w-4 mr-1" /> Etapa
            </Button>
          )}
          {elapsed > 0 && !running && (
            <Button size="sm" variant="destructive" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Resetar
            </Button>
          )}
        </div>

        {laps.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {laps.map((lap, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50">
                <span className="text-muted-foreground">{lap.label}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {formatTime(lap.elapsed)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
