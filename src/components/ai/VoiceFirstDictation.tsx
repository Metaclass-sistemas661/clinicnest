import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  StopCircle,
  Loader2,
  CheckCircle,
  Wand2,
  Play,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SoapResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cid_suggestions: string[];
  confidence: number;
  vital_signs?: VitalSignsFromVoice | null;
}

export interface VitalSignsFromVoice {
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  oxygen_saturation?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  pain_scale?: number | null;
}

interface VoiceFirstDictationProps {
  onSoapReady: (soap: {
    chief_complaint: string;
    anamnesis: string;
    physical_exam: string;
    diagnosis: string;
    treatment_plan: string;
    cid_code: string;
  }) => void;
  onVitalsExtracted?: (vitals: VitalSignsFromVoice) => void;
  specialty?: string;
  patientContext?: string;
  disabled?: boolean;
  className?: string;
}

type DictationStep = "idle" | "recording" | "transcribing" | "generating" | "done";

// Normaliza campo SOAP: descarta strings placeholder que o AI escreve quando
// algo não foi mencionado (ex: "Não mencionado na consulta", "Não informado", etc.)
function cleanSoapField(value: string | undefined | null): string {
  if (!value) return "";
  const v = value.trim();
  const placeholders = [
    "não mencionado na consulta",
    "não mencionado",
    "não foi mencionado",
    "nenhuma informação mencionada",
    "nenhuma informação",
    "sem informação disponível",
    "sem informação",
    "não informado",
    "não disponível",
    "informação não fornecida",
    "not mentioned",
    "not provided",
    "n/a",
  ];
  const lower = v.toLowerCase();
  if (placeholders.some((p) => lower === p || lower.startsWith(p + "."))) return "";
  return v;
}

// Detecta alucinação do STT: ocorre com áudio de baixa qualidade (ex: Bluetooth HFP 8kHz).
// Sintoma típico: frases idênticas repetidas 3+ vezes na mesma transcrição.
function isLikelyHallucination(transcript: string): boolean {
  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 10);
  if (sentences.length < 3) return false;
  const counts = new Map<string, number>();
  for (const s of sentences) {
    const n = (counts.get(s) ?? 0) + 1;
    counts.set(s, n);
    if (n >= 3) return true;
  }
  return false;
}

export function VoiceFirstDictation({
  onSoapReady,
  onVitalsExtracted,
  specialty = "PRIMARYCARE",
  patientContext,
  disabled,
  className,
}: VoiceFirstDictationProps) {
  const [step, setStep] = useState<DictationStep>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 1: Transcribe audio
  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: {
          action: "transcribe",
          audio_base64: base64,
          file_name: `voice-dictation-${Date.now()}.${audioBlob.type.split("/")[1]?.split(";")[0] || "webm"}`,
          content_type: audioBlob.type,
          specialty,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.transcript && data.transcript.trim().length >= 10) {
        const transcript: string = data.transcript;
        setTranscript(transcript);

        if (isLikelyHallucination(transcript)) {
          toast.warning("Qualidade de áudio baixa detectada", {
            description: "O microfone Bluetooth pode estar em modo de baixa qualidade. Use o microfone integrado do notebook ou fone com fio para melhores resultados.",
            duration: 8000,
          });
          setStep("idle");
          return;
        }

        setStep("generating");
        soapMutation.mutate(transcript);
      } else if (data.transcript && data.transcript.trim().length > 0) {
        setTranscript(data.transcript);
        toast.error("Transcrição muito curta para gerar SOAP automaticamente. Fale por mais tempo ou preencha manualmente.");
        setStep("idle");
      } else {
        toast.error("Transcrição vazia. Tente falar mais alto ou mais perto do microfone.");
        setStep("idle");
      }
    },
    onError: () => {
      toast.error("Falha na transcrição.");
      setStep("idle");
    },
  });

  // Step 2: Generate SOAP from transcript
  const soapMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke("ai-generate-soap", {
        body: {
          transcript: text,
          specialty,
          patient_context: patientContext,
        },
      });
      if (error) throw error;
      // Edge function returns { soap: { ... } } — unwrap
      const soapData = data?.soap ?? data;
      console.log("[VoiceSOAP] Raw data:", JSON.stringify(data));
      console.log("[VoiceSOAP] Unwrapped:", JSON.stringify(soapData));
      return soapData as SoapResult;
    },
    onSuccess: (soap) => {
      if (!soap || (!soap.subjective && !soap.objective && !soap.assessment && !soap.plan)) {
        console.warn("[VoiceSOAP] SOAP data is empty or null:", soap);
        toast.error("SOAP gerado sem conteúdo. Tente falar por mais tempo ou mais claramente.");
        setStep("idle");
        return;
      }

      setStep("done");

      const mapped = {
        chief_complaint: cleanSoapField(soap.subjective?.split(".")[0] || soap.subjective),
        anamnesis: cleanSoapField(soap.subjective),
        physical_exam: cleanSoapField(soap.objective),
        diagnosis: cleanSoapField(soap.assessment),
        treatment_plan: cleanSoapField(soap.plan),
        cid_code: cleanSoapField(soap.cid_suggestions?.[0]),
      };
      console.log("[VoiceSOAP] Mapped fields:", JSON.stringify(mapped));
      onSoapReady(mapped);

      // Extract vital signs if present
      if (soap.vital_signs && onVitalsExtracted) {
        const vs = soap.vital_signs;
        const hasAny = Object.values(vs).some((v) => v != null);
        if (hasAny) {
          onVitalsExtracted(vs);
          const count = Object.values(vs).filter((v) => v != null).length;
          toast.success(`${count} sinal(is) vital(is) extraído(s) da voz`);
        }
      }

      toast.success(
        `Prontuário SOAP preenchido automaticamente (confiança: ${Math.round((soap.confidence || 0) * 100)}%)`
      );
    },
    onError: (err: any) => {
      const msg = err?.context?.body ? "Transcrição muito curta para gerar SOAP." : "Falha ao gerar SOAP.";
      toast.error(`${msg} A transcrição foi salva — preencha manualmente.`);
      setStep("idle");
    },
  });

  const startRecording = useCallback(async () => {
    try {
      // Constraints otimizadas para STT: mono, 16kHz, com cancelamento de ruído.
      // Ajuda dispositivos Bluetooth a capturar em qualidade adequada para transcrição.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      });

      // Escolhe o melhor formato suportado — opus/webm é preferido pelo Chirp
      const preferredMime = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const mediaRecorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      // mimeType real que o browser está usando (pode ter parâmetros de codec)
      const actualMime = mediaRecorder.mimeType || preferredMime || "audio/webm";
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setElapsedSec(0);
      setTranscript("");

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // Usa o mimeType real; remove parâmetros de codec para o backend (ex: "audio/webm;codecs=opus" → "audio/webm")
        const baseType = actualMime.split(";")[0] || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: baseType });
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setStep("transcribing");
        transcribeMutation.mutate(audioBlob);
      };

      mediaRecorder.start();
      setStep("recording");

      timerRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [specialty]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && step === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [step]);

  const reset = useCallback(() => {
    setStep("idle");
    setTranscript("");
    setElapsedSec(0);
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const isProcessing = step === "transcribing" || step === "generating";

  return (
    <div className={cn("rounded-xl border-2 border-dashed p-4", className, {
      "border-red-400 bg-red-50 dark:bg-red-950/40": step === "recording",
      "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40": isProcessing,
      "border-green-400 bg-green-50 dark:bg-green-950/40": step === "done",
      "border-gray-200 dark:border-gray-700 hover:border-teal-300": step === "idle",
    })}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {step === "idle" && (
            <Button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Mic className="h-4 w-4" />
              Modo Voz
            </Button>
          )}

          {step === "recording" && (
            <Button
              type="button"
              onClick={stopRecording}
              variant="destructive"
              className="gap-2 animate-pulse"
            >
              <StopCircle className="h-4 w-4" />
              Parar ({formatTime(elapsedSec)})
            </Button>
          )}

          {step === "transcribing" && (
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Transcrevendo áudio...</span>
            </div>
          )}

          {step === "generating" && (
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Wand2 className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Gerando SOAP automático...</span>
            </div>
          )}

          {step === "done" && (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Prontuário preenchido por voz!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step === "recording" && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Play className="h-3 w-3" />
              Gravando
            </Badge>
          )}
          {step === "done" && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs">
              <RotateCcw className="h-3 w-3" />
              Nova gravação
            </Button>
          )}
        </div>
      </div>

      {step === "idle" && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Grave a consulta e o prontuário SOAP será preenchido automaticamente. Zero digitação.
        </p>
      )}

      {transcript && (
        <details className="mt-3">
          <summary className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-foreground font-medium">
            Ver transcrição original
          </summary>
          <p className="text-xs text-gray-700 dark:text-gray-200 mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto bg-white/60 dark:bg-gray-800/60 rounded p-2">
            {transcript}
          </p>
        </details>
      )}
    </div>
  );
}
