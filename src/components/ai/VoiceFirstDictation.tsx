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
  specialty?: string;
  patientContext?: string;
  disabled?: boolean;
  className?: string;
}

type DictationStep = "idle" | "recording" | "transcribing" | "generating" | "done";

export function VoiceFirstDictation({
  onSoapReady,
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
          file_name: `voice-dictation-${Date.now()}.webm`,
          content_type: "audio/webm",
          specialty,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.transcript) {
        setTranscript(data.transcript);
        setStep("generating");
        soapMutation.mutate(data.transcript);
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
      return data as SoapResult;
    },
    onSuccess: (soap) => {
      setStep("done");
      onSoapReady({
        chief_complaint: soap.subjective.split(".")[0] || soap.subjective,
        anamnesis: soap.subjective,
        physical_exam: soap.objective,
        diagnosis: soap.assessment,
        treatment_plan: soap.plan,
        cid_code: soap.cid_suggestions?.[0] || "",
      });
      toast.success(
        `Prontuário SOAP preenchido automaticamente (confiança: ${Math.round(soap.confidence * 100)}%)`
      );
    },
    onError: () => {
      toast.error("Falha ao gerar SOAP. A transcrição foi salva — preencha manualmente.");
      setStep("idle");
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setElapsedSec(0);
      setTranscript("");

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
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
      "border-red-400 bg-red-50/50": step === "recording",
      "border-yellow-400 bg-yellow-50/50": isProcessing,
      "border-green-400 bg-green-50/50": step === "done",
      "border-gray-200 hover:border-teal-300": step === "idle",
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
            <div className="flex items-center gap-2 text-yellow-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Transcrevendo áudio...</span>
            </div>
          )}

          {step === "generating" && (
            <div className="flex items-center gap-2 text-yellow-700">
              <Wand2 className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Gerando SOAP automático...</span>
            </div>
          )}

          {step === "done" && (
            <div className="flex items-center gap-2 text-green-700">
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
        <p className="text-xs text-muted-foreground mt-2">
          Grave a consulta e o prontuário SOAP será preenchido automaticamente. Zero digitação.
        </p>
      )}

      {transcript && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Ver transcrição original
          </summary>
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {transcript}
          </p>
        </details>
      )}
    </div>
  );
}
