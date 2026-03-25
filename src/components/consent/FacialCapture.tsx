import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Timer,
  Glasses,
  HardHat,
  Sun,
  User,
  ArrowRight,
  Lightbulb,
  ScanFace,
} from "lucide-react";

interface FacialCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

/* ─────────────────────────────────────────────────────────
 *  Banuba Web AR SDK — loaded lazily from CDN
 * ───────────────────────────────────────────────────────── */
const BANUBA_SDK_VERSION = "1.17.7";
const BANUBA_CDN = `https://cdn.jsdelivr.net/npm/@banuba/webar@${BANUBA_SDK_VERSION}`;
const BANUBA_TOKEN = (import.meta.env.VITE_BANUBA_CLIENT_TOKEN as string) || "";

const FACE_DETECT_TIMEOUT_MS = 8_000;

let _sdkPromise: Promise<any | null> | null = null;

function getBanubaSDK(): Promise<any | null> {
  if (!BANUBA_TOKEN) return Promise.resolve(null);
  if (!_sdkPromise) {
    _sdkPromise = import(
      /* @vite-ignore */
      `${BANUBA_CDN}/dist/BanubaSDK.browser.esm.js`
    ).catch((err) => {
      console.warn("[FacialCapture] Banuba CDN load failed:", err);
      _sdkPromise = null;
      return null;
    });
  }
  return _sdkPromise;
}

export function FacialCapture({ onCapture, disabled }: FacialCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<any>(null);
  const offscreenRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameCountRef = useRef(0);
  const fallbackActiveRef = useRef(false);

  const [phase, setPhase] = useState<"instructions" | "capture">("instructions");
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "captured" | "error"
  >("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [banubaActive, setBanubaActive] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);

  /* ── Cleanup ─────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    }
    if (offscreenRef.current) {
      offscreenRef.current.remove();
      offscreenRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [stopCamera, capturedUrl]);

  /* ── Attach stream to <video> ── */
  useEffect(() => {
    if (status === "streaming" && videoRef.current && streamRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [status]);

  /* ── Start camera + optional Banuba face detection ───── */
  const startCamera = useCallback(async () => {
    setErrorMsg("");
    setFaceDetected(false);
    setFallbackActive(false);
    fallbackActiveRef.current = false;
    setStatus("loading");
    frameCountRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
    } catch (err: any) {
      setStatus("error");
      if (err.name === "NotAllowedError") {
        setErrorMsg(
          "Permissão de câmera negada. Habilite a câmera nas configurações do navegador."
        );
      } else if (err.name === "NotFoundError") {
        setErrorMsg("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setErrorMsg("Erro ao acessar a câmera. Tente novamente.");
      }
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    let banubaOk = false;
    if (BANUBA_TOKEN) {
      try {
        const sdk = await getBanubaSDK();
        if (sdk) {
          const { Player, Module, Dom } = sdk;
          const BanubaMediaStream = sdk.MediaStream;

          const player = await Player.create({
            clientToken: BANUBA_TOKEN,
            devicePixelRatio: 1,
          });

          await player.addModule(
            new Module(`${BANUBA_CDN}/dist/modules/face_tracker.zip`)
          );

          player.use(new BanubaMediaStream(stream));

          const offscreen = document.createElement("div");
          offscreen.style.cssText =
            "position:fixed;width:160px;height:120px;top:-9999px;left:-9999px;overflow:hidden;opacity:0;pointer-events:none;z-index:-9999";
          document.body.appendChild(offscreen);
          Dom.render(player, offscreen);
          offscreenRef.current = offscreen;

          player.addEventListener(
            "framedata",
            ({ detail: frameData }: any) => {
              frameCountRef.current++;
              if (fallbackActiveRef.current) return;
              try {
                let hasFace = frameData.get("frxRecognitionResult.faces.0.hasFace");
                if (hasFace === undefined || hasFace === null) {
                  const frx = frameData.get("frxRecognitionResult");
                  if (frx) hasFace = frx?.faces?.[0]?.hasFace;
                }
                if (hasFace === undefined || hasFace === null) {
                  const faceCount = frameData.get("frxRecognitionResult.faces.count");
                  if (typeof faceCount === "number") hasFace = faceCount > 0;
                }
                setFaceDetected(!!hasFace);
              } catch (e) {
                console.warn("[FacialCapture] framedata parse error:", e);
              }
            }
          );

          player.play({ fps: 25 });
          playerRef.current = player;
          banubaOk = true;
        }
      } catch (err) {
        console.warn("[FacialCapture] Banuba init failed:", err);
      }
    }

    setBanubaActive(banubaOk);
    if (!banubaOk) {
      setFaceDetected(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        fallbackActiveRef.current = true;
        setFallbackActive(true);
        setFaceDetected(true);
      }, FACE_DETECT_TIMEOUT_MS);
    }
    setStatus("streaming");
  }, []);

  useEffect(() => {
    if (faceDetected && !fallbackActive && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [faceDetected, fallbackActive]);

  /* ── Capture photo (crop to face oval area) ──────────── */
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Crop to center oval area (face region)
    const cropW = Math.round(vw * 0.55);
    const cropH = Math.round(vh * 0.85);
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2) - Math.round(vh * 0.02);

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror horizontally for selfie + crop
    ctx.translate(cropW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, cropX, Math.max(0, cropY), cropW, cropH, 0, 0, cropW, cropH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        const url = URL.createObjectURL(blob);
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(url);
        setStatus("captured");
        onCapture(blob);
      },
      "image/jpeg",
      0.85
    );
  }, [stopCamera, onCapture, capturedUrl]);

  /* ── Retake ────────────────────────────────────────── */
  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setFaceDetected(false);
    setBanubaActive(false);
    setFallbackActive(false);
    setStatus("idle");
    startCamera();
  }, [capturedUrl, startCamera]);

  /* ── Phase: Instructions ────────────────────────────── */
  if (phase === "instructions") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/50">
            <ScanFace className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-base font-bold text-foreground text-center">
            Reconhecimento Facial
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Para validar sua identidade, vamos capturar uma foto do seu rosto.
            Siga as orientações abaixo para garantir uma boa captura.
          </p>
        </div>

        {/* Tips grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
          {[
            { icon: Glasses, color: "text-red-500 bg-red-50 dark:bg-red-950/50", title: "Sem óculos escuros", desc: "Retire óculos de sol ou lentes escuras" },
            { icon: HardHat, color: "text-red-500 bg-red-50 dark:bg-red-950/50", title: "Sem bonés ou chapéus", desc: "Remova qualquer acessório da cabeça" },
            { icon: Lightbulb, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50", title: "Boa iluminação", desc: "Fique em um ambiente bem iluminado" },
            { icon: User, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50", title: "Rosto centralizado", desc: "Posicione o rosto dentro do oval" },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 rounded-xl border bg-card p-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 max-w-lg mx-auto">
          <Sun className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            A foto será utilizada exclusivamente como prova de identidade para a assinatura do termo. Seus dados são protegidos e não serão compartilhados.
          </p>
        </div>

        {/* Start button */}
        <div className="flex justify-center pt-1 pb-2">
          <Button
            type="button"
            onClick={() => { setPhase("capture"); startCamera(); }}
            className="bg-teal-600 hover:bg-teal-700 text-white min-w-[240px] h-12 text-sm font-semibold"
            disabled={disabled}
          >
            Iniciar Captura
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ── Phase: Capture ─────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Teal container with rounded corners — bank-style */}
      <div className="relative bg-teal-600 dark:bg-teal-800 rounded-2xl overflow-hidden mx-auto" style={{ maxWidth: "420px" }}>
        {/* Top label */}
        <div className="flex items-center justify-center gap-2 py-3 px-4">
          <ScanFace className="h-4 w-4 text-white/90" />
          <span className="text-sm font-semibold text-white/90">Reconhecimento Facial</span>
        </div>

        {/* Camera viewport — taller, face-focused */}
        <div className="relative bg-black mx-3 rounded-xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
          {/* LOADING */}
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3 z-10">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="text-sm font-medium">Iniciando câmera…</p>
            </div>
          )}

          {/* STREAMING */}
          {status === "streaming" && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />

              {/* Dark overlay with oval cutout */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg viewBox="0 0 300 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <mask id="faceMask">
                      <rect width="300" height="400" fill="white" />
                      <ellipse cx="150" cy="175" rx="85" ry="110" fill="black" />
                    </mask>
                  </defs>
                  {/* Semi-transparent overlay outside the oval */}
                  <rect width="300" height="400" fill="rgba(0,0,0,0.55)" mask="url(#faceMask)" />
                  {/* Oval border */}
                  <ellipse
                    cx="150" cy="175" rx="85" ry="110"
                    fill="none"
                    stroke={faceDetected ? "#2dd4bf" : banubaActive ? "#f87171" : "rgba(255,255,255,0.5)"}
                    strokeWidth="2.5"
                    strokeDasharray={faceDetected ? "none" : "8 4"}
                    className="transition-all duration-300"
                  />
                  {/* Corner brackets for bank-style look */}
                  {[
                    // Top-left
                    "M 80 85 L 80 70 Q 80 58 92 58 L 105 58",
                    // Top-right
                    "M 220 85 L 220 70 Q 220 58 208 58 L 195 58",
                    // Bottom-left
                    "M 80 265 L 80 280 Q 80 292 92 292 L 105 292",
                    // Bottom-right
                    "M 220 265 L 220 280 Q 220 292 208 292 L 195 292",
                  ].map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke={faceDetected ? "#2dd4bf" : "rgba(255,255,255,0.6)"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  ))}
                </svg>
              </div>

              {/* Face detection status badge */}
              {banubaActive && (
                <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors ${
                      faceDetected && !fallbackActive
                        ? "bg-teal-600/90 text-white"
                        : fallbackActive
                          ? "bg-blue-600/90 text-white"
                          : "bg-yellow-600/90 text-white animate-pulse"
                    }`}
                  >
                    {fallbackActive ? (
                      <Timer className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {faceDetected && !fallbackActive
                      ? "Rosto detectado"
                      : fallbackActive
                        ? "Captura liberada"
                        : "Posicione seu rosto no oval"}
                  </div>
                </div>
              )}

              {/* Instruction text at bottom of camera area */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20 pointer-events-none">
                <p className="text-[11px] text-white/70 font-medium bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                  {banubaActive && !faceDetected
                    ? "Aproxime o rosto e olhe para a câmera"
                    : "Mantenha o rosto dentro do oval"}
                </p>
              </div>
            </>
          )}

          {/* CAPTURED */}
          {status === "captured" && capturedUrl && (
            <>
              <img
                src={capturedUrl}
                alt="Foto facial capturada"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg viewBox="0 0 300 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <mask id="faceMaskCaptured">
                      <rect width="300" height="400" fill="white" />
                      <ellipse cx="150" cy="175" rx="85" ry="110" fill="black" />
                    </mask>
                  </defs>
                  <rect width="300" height="400" fill="rgba(0,0,0,0.45)" mask="url(#faceMaskCaptured)" />
                  <ellipse cx="150" cy="175" rx="85" ry="110" fill="none" stroke="#2dd4bf" strokeWidth="3" />
                </svg>
              </div>
              <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
                <div className="flex items-center gap-1.5 bg-green-600/90 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Foto capturada com sucesso
                </div>
              </div>
            </>
          )}

          {/* ERROR */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 px-6 z-10">
              <AlertCircle className="h-12 w-12" />
              <p className="text-sm text-center font-medium">{errorMsg}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={startCamera}
              >
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>

        {/* Action buttons area — inside teal container */}
        <div className="flex flex-col items-center gap-2 py-4 px-4">
          {status === "streaming" && (
            <button
              type="button"
              onClick={capture}
              disabled={disabled || (banubaActive && !faceDetected)}
              className="flex items-center justify-center h-16 w-16 rounded-full bg-white shadow-lg shadow-black/20 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 ring-4 ring-white/30 hover:ring-white/50"
            >
              <Camera className="h-7 w-7 text-teal-700" />
            </button>
          )}
          {status === "streaming" && (
            <p className="text-xs text-white/70 font-medium">
              {banubaActive && !faceDetected ? "Aguardando detecção…" : "Toque para capturar"}
            </p>
          )}

          {status === "captured" && (
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Button
                type="button"
                variant="outline"
                onClick={retake}
                disabled={disabled}
                className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Tirar Outra
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-teal-200 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Pronta
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Success message below */}
      {status === "captured" && (
        <p className="text-xs text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1.5 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {banubaActive && !fallbackActive
            ? "Foto facial verificada por IA e capturada com sucesso"
            : "Foto facial capturada com sucesso"}
        </p>
      )}
    </div>
  );
}
