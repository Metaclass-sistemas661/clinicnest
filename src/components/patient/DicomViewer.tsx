/**
 * DICOM Viewer component using cornerstone.js
 * Provides in-browser medical image viewing with:
 * - Pan, Zoom, Window/Level controls
 * - DICOM tag metadata display
 * - Fullscreen mode
 *
 * Usage:
 *   <DicomViewer fileUrl="/path/to/file.dcm" />
 *   <DicomViewer fileUrl="wadouri:http://example.com/dicom" />
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Loader2,
  AlertTriangle,
  X,
  SunMedium,
  Contrast,
  Move,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface DicomViewerProps {
  /** URL to the DICOM file. Accepts wadouri: prefix or plain URL. */
  fileUrl: string;
  /** Optional height (default: 512px). */
  height?: number;
  /** Optional class name for outer wrapper */
  className?: string;
}

type Tool = "wwwc" | "pan" | "zoom";

// Script loader cache
let cornerstoneLoaded = false;
let cornerstoneLoadPromise: Promise<void> | null = null;

async function loadCornerstoneScripts(): Promise<void> {
  if (cornerstoneLoaded) return;
  if (cornerstoneLoadPromise) return cornerstoneLoadPromise;

  cornerstoneLoadPromise = (async () => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/cornerstone-core@2.6.1/dist/cornerstone.min.js",
      "https://cdn.jsdelivr.net/npm/cornerstone-math@0.1.10/dist/cornerstoneMath.min.js",
      "https://cdn.jsdelivr.net/npm/dicom-parser@1.8.21/dist/dicomParser.min.js",
      "https://cdn.jsdelivr.net/npm/cornerstone-wado-image-loader@4.13.2/dist/cornerstoneWADOImageLoader.bundle.min.js",
      "https://cdn.jsdelivr.net/npm/cornerstone-tools@6.0.10/dist/cornerstoneTools.min.js",
    ];

    for (const src of scripts) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(s);
      });
    }

    // Configure cornerstone-wado-image-loader
    const cs = (window as any).cornerstone;
    const cswil = (window as any).cornerstoneWADOImageLoader;
    const csTools = (window as any).cornerstoneTools;
    const csMath = (window as any).cornerstoneMath;

    if (cswil && cs) {
      cswil.external.cornerstone = cs;
      cswil.external.dicomParser = (window as any).dicomParser;

      // Web worker for decoding
      const config = {
        maxWebWorkers: navigator.hardwareConcurrency || 2,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: { initializeCodecsOnStartup: false, strict: false },
        },
      };
      cswil.webWorkerManager.initialize(config);
    }

    if (csTools && cs && csMath) {
      csTools.external.cornerstone = cs;
      csTools.external.cornerstoneMath = csMath;
      csTools.init();
    }

    cornerstoneLoaded = true;
  })();

  return cornerstoneLoadPromise;
}

export function DicomViewer({ fileUrl, height = 512, className }: DicomViewerProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("wwwc");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [showMeta, setShowMeta] = useState(false);

  const initViewer = useCallback(async () => {
    if (!elementRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      await loadCornerstoneScripts();

      const cs = (window as any).cornerstone;
      const csTools = (window as any).cornerstoneTools;

      if (!cs || !csTools) {
        throw new Error("Cornerstone libraries failed to load");
      }

      const el = elementRef.current;

      // Enable cornerstone on the element
      cs.enable(el);

      // Build image ID
      let imageId = fileUrl;
      if (!imageId.startsWith("wadouri:") && !imageId.startsWith("dicomweb:")) {
        imageId = `wadouri:${imageId}`;
      }

      // Load and display
      const image = await cs.loadAndCacheImage(imageId);
      cs.displayImage(el, image);

      // Add tools
      const WwwcTool = csTools.WwwcTool;
      const PanTool = csTools.PanTool;
      const ZoomTool = csTools.ZoomTool;

      csTools.addTool(WwwcTool);
      csTools.addTool(PanTool);
      csTools.addTool(ZoomTool);

      csTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
      setActiveTool("wwwc");

      // Extract DICOM metadata
      const dataSet = image.data;
      if (dataSet) {
        const meta: Record<string, string> = {};
        const getString = (tag: string) => {
          try { return dataSet.string(tag) || ""; } catch { return ""; }
        };
        meta["Nome do Paciente"] = getString("x00100010");
        meta["ID do Paciente"] = getString("x00100020");
        meta["Data de Nascimento"] = getString("x00100030");
        meta["Sexo"] = getString("x00100040");
        meta["Modalidade"] = getString("x00080060");
        meta["Descrição do Estudo"] = getString("x00081030");
        meta["Data do Estudo"] = getString("x00080020");
        meta["Instituição"] = getString("x00080080");
        meta["Fabricante"] = getString("x00080070");
        meta["Linhas"] = String(image.rows || "");
        meta["Colunas"] = String(image.columns || "");
        meta["Window Center"] = String(image.windowCenter || "");
        meta["Window Width"] = String(image.windowWidth || "");

        // Filter empty
        const filtered: Record<string, string> = {};
        for (const [k, v] of Object.entries(meta)) {
          if (v) filtered[k] = v;
        }
        setMetadata(filtered);
      }

      setIsLoading(false);
    } catch (err: any) {
      logger.error("DicomViewer init:", err);
      setError(err.message || "Erro ao carregar imagem DICOM");
      setIsLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    void initViewer();

    return () => {
      if (elementRef.current) {
        try {
          const cs = (window as any).cornerstone;
          if (cs) cs.disable(elementRef.current);
        } catch {}
      }
    };
  }, [initViewer]);

  const handleToolChange = (tool: Tool) => {
    const csTools = (window as any).cornerstoneTools;
    if (!csTools) return;

    // Deactivate all
    csTools.setToolPassive("Wwwc");
    csTools.setToolPassive("Pan");
    csTools.setToolPassive("Zoom");

    switch (tool) {
      case "wwwc":
        csTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
        break;
      case "pan":
        csTools.setToolActive("Pan", { mouseButtonMask: 1 });
        break;
      case "zoom":
        csTools.setToolActive("Zoom", { mouseButtonMask: 1 });
        break;
    }
    setActiveTool(tool);
  };

  const handleReset = () => {
    if (!elementRef.current) return;
    const cs = (window as any).cornerstone;
    if (!cs) return;
    cs.reset(elementRef.current);
  };

  const toggleFullscreen = () => {
    if (!elementRef.current?.parentElement) return;
    const wrapper = elementRef.current.parentElement.parentElement;
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Resize on fullscreen change
  useEffect(() => {
    if (elementRef.current) {
      const cs = (window as any).cornerstone;
      if (cs) {
        setTimeout(() => {
          try { cs.resize(elementRef.current, true); } catch {}
        }, 200);
      }
    }
  }, [isFullscreen]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <SunMedium className="h-4 w-4 text-teal-500" />
            Visualizador DICOM
          </CardTitle>

          <div className="flex items-center gap-1">
            <Button
              variant={activeTool === "wwwc" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleToolChange("wwwc")}
              title="Janela/Nível (Window/Level)"
            >
              <Contrast className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={activeTool === "pan" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleToolChange("pan")}
              title="Mover (Pan)"
            >
              <Move className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={activeTool === "zoom" ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleToolChange("zoom")}
              title="Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Resetar">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={showMeta ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowMeta(!showMeta)}
              title="Metadados DICOM"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative p-0">
        {/* Cornerstone viewport */}
        <div className="relative" style={{ height: isFullscreen ? "calc(100vh - 60px)" : height }}>
          <div
            ref={elementRef}
            className="w-full h-full bg-black"
            style={{ position: "relative" }}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Carregando imagem DICOM...</p>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-center max-w-xs">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void initViewer()}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>

        {/* Metadata panel */}
        {showMeta && Object.keys(metadata).length > 0 && (
          <div className="border-t bg-muted/50 p-4 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Metadados DICOM
              </h4>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowMeta(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-1 text-xs">
                  <span className="text-muted-foreground shrink-0">{key}:</span>
                  <span className="font-medium truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DicomViewer;
