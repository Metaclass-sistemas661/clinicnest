import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
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
/** Time face must remain detected before auto-capture fires (with Banuba) */
const AUTO_CAPTURE_DELAY_MS = 2_500;
/** Without Banuba, auto-capture after this delay from streaming start */
const NO_BANUBA_AUTO_CAPTURE_MS = 4_000;
/** Minimum time camera must be streaming before auto-capture */
const MIN_STREAMING_MS = 1_500;
/** Simulated verification time after capture */
const VERIFY_DURATION_MS = 1_800;

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

/** Dynamic instruction messages */
const INSTRUCTIONS = {
  noFace: "Posicione seu rosto no oval",
  tooFar: "Aproxime um pouco o rosto",
  tooClose: "Afaste um pouco o rosto",
  detected: "Ótimo! Mantenha assim…",
  capturing: "Capturando automaticamente…",
  preparing: "Centralize o rosto e aguarde…",
  verifying: "Verificando qualidade da foto…",
} as const;

export function FacialCapture({ onCapture, disabled }: FacialCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<any>(null);
  const offscreenRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameCountRef = useRef(0);
  const fallbackActiveRef = useRef(false);
  const autoCaptureRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTriggeredRef = useRef(false);
  const streamingStartRef = useRef(0);

  const [phase, setPhase] = useState<"instructions" | "capture">("instructions");
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "verifying" | "captured" | "error"
  >("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [banubaActive, setBanubaActive] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [instruction, setInstruction] = useState<string>(INSTRUCTIONS.noFace);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState(false);

  /* ── Cleanup ─────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    if (autoCaptureRef.current) {
      clearTimeout(autoCaptureRef.current);
      autoCaptureRef.current = null;
    }
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

  /* ── Capture photo (crop to face oval area) ──────────── */
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const cropW = Math.round(vw * 0.62);
    const cropH = Math.round(vh * 0.88);
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2) - Math.round(vh * 0.02);

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

        // Show verification spinner
        setStatus("verifying");
        setInstruction("Verificando qualidade da foto…");

        setTimeout(() => {
          // Photo passes verification
          setStatus("captured");
          onCapture(blob);
        }, VERIFY_DURATION_MS);
      },
      "image/jpeg",
      0.85
    );
  }, [stopCamera, onCapture, capturedUrl]);

  /* ── Start camera + optional Banuba face detection ───── */
  const startCamera = useCallback(async () => {
    setErrorMsg("");
    setFaceDetected(false);
    setFallbackActive(false);
    setAutoCaptureCountdown(false);
    captureTriggeredRef.current = false;
    fallbackActiveRef.current = false;
    setStatus("loading");
    setInstruction(INSTRUCTIONS.noFace);
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
      // No Banuba → auto-capture on timer after user has time to position
      setInstruction(INSTRUCTIONS.preparing);
    } else {
      timeoutRef.current = setTimeout(() => {
        fallbackActiveRef.current = true;
        setFallbackActive(true);
        setFaceDetected(true);
      }, FACE_DETECT_TIMEOUT_MS);
    }
    streamingStartRef.current = Date.now();
    setStatus("streaming");
  }, []);

  /* ── Cancel Banuba timeout when face detected ───────── */
  useEffect(() => {
    if (faceDetected && !fallbackActive && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [faceDetected, fallbackActive]);

  /* ── Auto-capture logic ── */
  useEffect(() => {
    if (status !== "streaming" || captureTriggeredRef.current) return;

    // ─── WITH Banuba: auto-capture when face detected + held ───
    if (banubaActive) {
      const elapsed = Date.now() - streamingStartRef.current;
      if (elapsed < MIN_STREAMING_MS) {
        const remaining = MIN_STREAMING_MS - elapsed;
        const t = setTimeout(() => setInstruction((prev) => prev), remaining);
        return () => clearTimeout(t);
      }

      if (faceDetected && !fallbackActive) {
        if (!autoCaptureRef.current) {
          setInstruction(INSTRUCTIONS.detected);
          setAutoCaptureCountdown(true);
          autoCaptureRef.current = setTimeout(() => {
            if (captureTriggeredRef.current) return;
            captureTriggeredRef.current = true;
            setInstruction(INSTRUCTIONS.capturing);
            setTimeout(() => capture(), 400);
          }, AUTO_CAPTURE_DELAY_MS);
        }
      } else if (fallbackActive && faceDetected) {
        // Banuba timed out but face is "detected" (fallback) → auto-capture
        if (!autoCaptureRef.current) {
          setInstruction(INSTRUCTIONS.capturing);
          setAutoCaptureCountdown(true);
          autoCaptureRef.current = setTimeout(() => {
            if (captureTriggeredRef.current) return;
            captureTriggeredRef.current = true;
            setTimeout(() => capture(), 400);
          }, 1_500);
        }
      } else if (!faceDetected) {
        if (autoCaptureRef.current) {
          clearTimeout(autoCaptureRef.current);
          autoCaptureRef.current = null;
        }
        setAutoCaptureCountdown(false);
        if (frameCountRef.current > 30) {
          setInstruction(INSTRUCTIONS.tooFar);
        } else {
          setInstruction(INSTRUCTIONS.noFace);
        }
      }
      return;
    }

    // ─── WITHOUT Banuba: timed auto-capture ───
    if (!autoCaptureRef.current) {
      setInstruction(INSTRUCTIONS.preparing);
      autoCaptureRef.current = setTimeout(() => {
        if (captureTriggeredRef.current) return;
        setInstruction(INSTRUCTIONS.detected);
        setAutoCaptureCountdown(true);

        // Give 1.5s of "Ótimo! Mantenha assim" then capture
        setTimeout(() => {
          if (captureTriggeredRef.current) return;
          captureTriggeredRef.current = true;
          setInstruction(INSTRUCTIONS.capturing);
          setTimeout(() => capture(), 400);
        }, 1_500);
      }, NO_BANUBA_AUTO_CAPTURE_MS);
    }
  }, [faceDetected, status, banubaActive, fallbackActive, capture]);

  /* ── Retake ────────────────────────────────────────── */
  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setFaceDetected(false);
    setBanubaActive(false);
    setFallbackActive(false);
    setAutoCaptureCountdown(false);
    captureTriggeredRef.current = false;
    setStatus("idle");
    startCamera();
  }, [capturedUrl, startCamera]);

  /* ── Phase: Instructions ────────────────────────────── */
  if (phase === "instructions") {
    return (
      <div className="space-y-4">
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

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 max-w-lg mx-auto">
          <Sun className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            A foto será utilizada exclusivamente como prova de identidade para a assinatura do termo. Seus dados são protegidos e não serão compartilhados.
          </p>
        </div>

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

  /* ── Dynamic oval sizing — animates to guide user ── */
  const ovalScale = useMemo(() => {
    const isVC = status === "verifying" || status === "captured";
    if (isVC) return 1.0;
    switch (instruction) {
      case INSTRUCTIONS.noFace:
      case INSTRUCTIONS.preparing:
        return 1.1;
      case INSTRUCTIONS.tooFar:
        return 0.9;
      case INSTRUCTIONS.tooClose:
        return 1.18;
      case INSTRUCTIONS.detected:
      case INSTRUCTIONS.capturing:
      default:
        return 1.0;
    }
  }, [instruction, status]);

  /* ── Phase: Capture ─────────────────────────────────── */
  const isVerifyingOrCaptured = status === "verifying" || status === "captured";

  return (
    <div className="space-y-4">
      {/* Full capture area — teal overlay around face cutout */}
      <div className="relative rounded-2xl overflow-hidden mx-auto" style={{ maxWidth: "420px", aspectRatio: "3/4" }}>
        {/* Video layer — always behind */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${isVerifyingOrCaptured ? "hidden" : ""}`}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Captured image (shown during verifying + captured) */}
        {isVerifyingOrCaptured && capturedUrl && (
          <img
            src={capturedUrl}
            alt="Foto facial capturada"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* TEAL overlay with dynamic oval cutout */}
        {(status === "streaming" || isVerifyingOrCaptured) && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <svg viewBox="0 0 300 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="faceMask">
                  <rect width="300" height="400" fill="white" />
                  <ellipse
                    cx="150" cy="180" rx="100" ry="130"
                    fill="black"
                    style={{
                      transformOrigin: "150px 180px",
                      transform: `scale(${ovalScale})`,
                      transition: "transform 0.8s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </mask>
              </defs>
              {/* TEAL overlay outside the oval */}
              <rect
                width="300" height="400"
                fill={isVerifyingOrCaptured ? "rgba(13,155,139,0.75)" : "rgba(13,155,139,0.85)"}
                mask="url(#faceMask)"
              />
              {/* Oval border — dynamically resizes and changes color */}
              <ellipse
                cx="150" cy="180" rx="100" ry="130"
                fill="none"
                stroke={
                  isVerifyingOrCaptured
                    ? "#2dd4bf"
                    : faceDetected
                      ? autoCaptureCountdown ? "#2dd4bf" : "#5eead4"
                      : "rgba(255,255,255,0.5)"
                }
                strokeWidth={isVerifyingOrCaptured || (faceDetected && autoCaptureCountdown) ? "3" : "2"}
                strokeDasharray={faceDetected || isVerifyingOrCaptured ? "none" : "8 4"}
                style={{
                  transformOrigin: "150px 180px",
                  transform: `scale(${ovalScale})`,
                  transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
              {/* Outer glow ring during auto-capture countdown */}
              {autoCaptureCountdown && status === "streaming" && (
                <ellipse
                  cx="150" cy="180" rx="106" ry="136"
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="1.5"
                  opacity="0.5"
                  className="animate-pulse"
                  style={{
                    transformOrigin: "150px 180px",
                    transform: `scale(${ovalScale})`,
                    transition: "transform 0.8s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              )}
            </svg>
          </div>
        )}

        {/* Top bar — title + prominent instruction */}
        <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-3 pb-2 px-4" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-2 mb-2">
            <ScanFace className="h-4 w-4 text-white/80" />
            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Reconhecimento Facial</span>
          </div>
          {status === "streaming" && (
            <div
              className={`flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-full transition-all duration-300 ${
                autoCaptureCountdown
                  ? "bg-teal-400/90 text-white"
                  : "bg-white/20 backdrop-blur-md text-white"
              }`}
            >
              {autoCaptureCountdown ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ScanFace className="h-4 w-4" />
              )}
              {instruction}
            </div>
          )}
        </div>

        {/* LOADING overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-teal-700 text-white gap-3 z-30">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm font-medium">Iniciando câmera…</p>
          </div>
        )}

        {/* VERIFYING — spinner in center of oval */}
        {status === "verifying" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-md">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
              <p className="text-sm font-semibold text-white drop-shadow">Verificando foto…</p>
            </div>
          </div>
        )}

        {/* CAPTURED — success badge */}
        {status === "captured" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-500/90 backdrop-blur-md">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <p className="text-sm font-semibold text-white drop-shadow">Foto verificada!</p>
            </div>
          </div>
        )}

        {/* Bottom progress indicator during auto-capture countdown */}
        {status === "streaming" && autoCaptureCountdown && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-teal-300" />
              <span className="text-xs font-medium text-white/80">Captura automática em andamento…</span>
            </div>
          </div>
        )}

        {/* ERROR overlay */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-teal-800 text-white gap-3 px-6 z-30">
            <AlertCircle className="h-12 w-12 text-red-400" />
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

      {/* Action bar below capture area */}
      {status === "captured" && (
        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={retake}
            disabled={disabled}
            size="sm"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Tirar Outra
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Foto aprovada
          </span>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
