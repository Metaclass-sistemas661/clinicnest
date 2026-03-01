import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface FacialCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

/* ─────────────────────────────────────────────────────────
 *  Banuba Web AR SDK — loaded lazily from CDN
 *  Only the face_tracker module (~6 MB) is downloaded.
 *  The SDK processes the camera feed for real-time face
 *  detection while the <video> element renders the preview.
 * ───────────────────────────────────────────────────────── */
const BANUBA_SDK_VERSION = "1.17.7";
const BANUBA_CDN = `https://cdn.jsdelivr.net/npm/@banuba/webar@${BANUBA_SDK_VERSION}`;
const BANUBA_TOKEN = (import.meta.env.VITE_BANUBA_CLIENT_TOKEN as string) || "";

/** Singleton – the CDN ESM is fetched only once. */
let _sdkPromise: Promise<any | null> | null = null;

function getBanubaSDK(): Promise<any | null> {
  if (!BANUBA_TOKEN) return Promise.resolve(null);
  if (!_sdkPromise) {
    _sdkPromise = import(
      /* @vite-ignore */
      `${BANUBA_CDN}/dist/BanubaSDK.browser.esm.js`
    ).catch((err) => {
      console.warn("[FacialCapture] Banuba CDN load failed:", err);
      _sdkPromise = null; // allow retry on next attempt
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

  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "captured" | "error"
  >("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [banubaActive, setBanubaActive] = useState(false);

  /* ── Cleanup ─────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
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

  /* ── Start camera + optional Banuba face detection ───── */
  const startCamera = useCallback(async () => {
    setErrorMsg("");
    setFaceDetected(false);
    setStatus("loading");

    // 1. Acquire camera stream
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

    // 2. Attach stream to <video> for display & capture
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    // 3. Try to initialise Banuba face detection in the background
    let banubaOk = false;
    if (BANUBA_TOKEN) {
      try {
        const sdk = await getBanubaSDK();
        if (sdk) {
          const { Player, Module, Dom } = sdk;
          // Use the SDK's MediaStream wrapper to feed our existing stream
          const BanubaMediaStream = sdk.MediaStream;

          const player = await Player.create({
            clientToken: BANUBA_TOKEN,
            devicePixelRatio: 1,
          });

          await player.addModule(
            new Module(
              `${BANUBA_CDN}/dist/modules/face_tracker.zip`
            )
          );

          // Feed the same getUserMedia stream
          player.use(new BanubaMediaStream(stream));

          // Render to an offscreen container (needed for the GPU pipeline)
          const offscreen = document.createElement("div");
          offscreen.style.cssText =
            "position:fixed;width:160px;height:120px;top:-9999px;left:-9999px;overflow:hidden;opacity:0;pointer-events:none;z-index:-9999";
          document.body.appendChild(offscreen);
          Dom.render(player, offscreen);
          offscreenRef.current = offscreen;

          // Listen for face-detection data
          player.addEventListener(
            "framedata",
            ({ detail: frameData }: any) => {
              const hasFace = frameData.get(
                "frxRecognitionResult.faces.0.hasFace"
              );
              setFaceDetected(!!hasFace);
            }
          );

          player.play({ fps: 25 });
          playerRef.current = player;
          banubaOk = true;
        }
      } catch (err) {
        console.warn(
          "[FacialCapture] Banuba init failed, continuing without face detection:",
          err
        );
      }
    }

    setBanubaActive(banubaOk);
    if (!banubaOk) setFaceDetected(true); // no detection → always allow capture
    setStatus("streaming");
  }, []);

  /* ── Capture photo ──────────────────────────────────── */
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror horizontally for selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

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
    setStatus("idle");
    startCamera();
  }, [capturedUrl, startCamera]);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] max-w-sm mx-auto">
        {/* IDLE ─────────────────────────────────────── */}
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3">
            <Camera className="h-10 w-10" />
            <p className="text-sm text-center px-4">
              Capture uma foto do seu rosto para assinar o termo
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={startCamera}
              disabled={disabled}
            >
              <Camera className="mr-2 h-4 w-4" />
              Abrir Câmera
            </Button>
          </div>
        )}

        {/* LOADING ──────────────────────────────────── */}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Iniciando câmera…</p>
          </div>
        )}

        {/* STREAMING ────────────────────────────────── */}
        {status === "streaming" && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Face guide oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-40 h-52 border-2 rounded-[50%] transition-colors duration-300 ${
                  faceDetected
                    ? "border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                    : banubaActive
                      ? "border-red-400/60 animate-pulse"
                      : "border-white/40"
                }`}
              />
            </div>

            {/* Face detection badge (only when Banuba is active) */}
            {banubaActive && (
              <div className="absolute top-2 left-2">
                <div
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full backdrop-blur-sm transition-colors ${
                    faceDetected
                      ? "bg-green-600/80 text-white"
                      : "bg-yellow-600/80 text-white"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {faceDetected ? "Rosto detectado" : "Posicione seu rosto"}
                </div>
              </div>
            )}

            {/* Capture button */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Button
                type="button"
                onClick={capture}
                className="bg-white text-black hover:bg-white/90 shadow-lg"
                disabled={disabled || (banubaActive && !faceDetected)}
              >
                <Camera className="mr-2 h-4 w-4" />
                {banubaActive && !faceDetected
                  ? "Aguardando rosto…"
                  : "Capturar Foto"}
              </Button>
            </div>
          </>
        )}

        {/* CAPTURED ─────────────────────────────────── */}
        {status === "captured" && capturedUrl && (
          <>
            <img
              src={capturedUrl}
              alt="Foto facial capturada"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                {banubaActive ? "Verificada" : "Capturada"}
              </div>
            </div>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={retake}
                disabled={disabled}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Tirar Outra
              </Button>
            </div>
          </>
        )}

        {/* ERROR ────────────────────────────────────── */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 px-4">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm text-center">{errorMsg}</p>
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

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Success message */}
      {status === "captured" && (
        <p className="text-xs text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {banubaActive
            ? "Foto facial verificada por IA e capturada com sucesso"
            : "Foto facial capturada com sucesso"}
        </p>
      )}
    </div>
  );
}
