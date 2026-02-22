import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface FacialCaptureProps {
  onCapture: (blob: Blob) => void;
  disabled?: boolean;
}

export function FacialCapture({ onCapture, disabled }: FacialCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "streaming" | "captured" | "error">("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const startCamera = useCallback(async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("streaming");
    } catch (err: any) {
      setStatus("error");
      if (err.name === "NotAllowedError") {
        setErrorMsg("Permissão de câmera negada. Habilite a câmera nas configurações do navegador.");
      } else if (err.name === "NotFoundError") {
        setErrorMsg("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setErrorMsg("Erro ao acessar a câmera. Tente novamente.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
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

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setStatus("idle");
    startCamera();
  }, [capturedUrl, startCamera]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] max-w-sm mx-auto">
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3">
            <Camera className="h-10 w-10" />
            <p className="text-sm text-center px-4">Capture uma foto do seu rosto para assinar o termo</p>
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
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-52 border-2 border-white/40 rounded-[50%]" />
            </div>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <Button
                type="button"
                onClick={capture}
                className="bg-white text-black hover:bg-white/90 shadow-lg"
                disabled={disabled}
              >
                <Camera className="mr-2 h-4 w-4" />
                Capturar Foto
              </Button>
            </div>
          </>
        )}

        {status === "captured" && capturedUrl && (
          <>
            <img src={capturedUrl} alt="Foto facial capturada" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Capturada
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

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 px-4">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm text-center">{errorMsg}</p>
            <Button type="button" variant="secondary" size="sm" onClick={startCamera}>
              Tentar Novamente
            </Button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {status === "captured" && (
        <p className="text-xs text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Foto facial capturada com sucesso
        </p>
      )}
    </div>
  );
}
