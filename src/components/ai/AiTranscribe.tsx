import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { useAudioRecorder, isLikelyHallucination, normalizeAudioBlob, type AudioRecordingResult } from "@/hooks/useAudioRecorder";

type Specialty = "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY";

interface AiTranscribeProps {
  onTranscriptReady?: (transcript: string) => void;
  className?: string;
}

export function AiTranscribe({ onTranscriptReady, className }: AiTranscribeProps) {
  const [transcript, setTranscript] = useState<string>("");
  const [specialty, setSpecialty] = useState<Specialty>("PRIMARYCARE");
  const [copied, setCopied] = useState(false);

  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const ext = audioBlob.type.split("/")[1]?.split(";")[0] || "webm";
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: {
          action: "transcribe",
          audio_base64: base64,
          file_name: `recording-${Date.now()}.${ext}`,
          content_type: audioBlob.type || "audio/webm",
          specialty,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.transcript) {
        // Detecção dupla: flag do backend + verificação local
        if (data.is_hallucination || isLikelyHallucination(data.transcript)) {
          toast.warning("Possível erro de transcrição detectado", {
            description:
              "O áudio pode estar com ruído ou muito baixo. " +
              "Tente falar mais alto, mais perto do microfone, ou use fone com fio.",
            duration: 8000,
          });
          return;
        }
        // Confiança baixa com texto curto — improvável ser fala real
        if (data.confidence && data.confidence < 0.50 && data.transcript.trim().length < 100) {
          toast.warning("Transcrição com confiança muito baixa", {
            description:
              "O microfone pode não estar captando bem. " +
              "Tente falar mais perto do microfone, em ambiente silencioso, " +
              "ou use fone com fio.",
            duration: 8000,
          });
          return;
        }
        setTranscript(data.transcript);
        onTranscriptReady?.(data.transcript);
        toast.success("Transcrição concluída!");
      }
    },
    onError: () => {
      toast.error("Não foi possível transcrever o áudio.");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Por favor, selecione um arquivo de áudio.");
      return;
    }

    transcribeMutation.mutate(file);
  };

  // ── Gravação via hook robusto (waterfall constraints + energy monitoring) ──
  const handleRecordingResult = useCallback(
    async ({ blob, durationMs, avgEnergy }: AudioRecordingResult) => {
      if (durationMs < 2000) {
        toast.warning("Gravação muito curta. Fale por pelo menos 2 segundos.");
        return;
      }
      if (avgEnergy < 0.005 && avgEnergy > 0) {
        toast.error("Microfone não captou áudio", {
          description:
            "Verifique nas configurações de som do Windows se o microfone correto está selecionado.",
          duration: 10000,
        });
        return;
      }
      // Converte para WAV PCM + normaliza volume antes de enviar ao STT
      const { blob: finalBlob } = await normalizeAudioBlob(blob, avgEnergy);
      transcribeMutation.mutate(finalBlob);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onResult: handleRecordingResult,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setTranscript("");
  };

  const getStatusDisplay = () => {
    if (transcribeMutation.isPending) {
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transcrevendo...</span>
        </div>
      );
    }
    if (transcript) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Concluído</span>
        </div>
      );
    }
    if (transcribeMutation.isError) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span>Falha na transcrição</span>
        </div>
      );
    }
    return null;
  };

  return (
    <FeatureGate feature="aiTranscribe" className={className}>
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-5 w-5 text-primary" />
          Transcrição de Áudio Médico
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!transcript && !transcribeMutation.isPending ? (
          <>
            <div className="space-y-2">
              <label htmlFor="ai-transcribe-specialty" className="text-sm font-medium">Especialidade</label>
              <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
                <SelectTrigger id="ai-transcribe-specialty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARYCARE">Clínica Geral</SelectItem>
                  <SelectItem value="CARDIOLOGY">Cardiologia</SelectItem>
                  <SelectItem value="NEUROLOGY">Neurologia</SelectItem>
                  <SelectItem value="ONCOLOGY">Oncologia</SelectItem>
                  <SelectItem value="RADIOLOGY">Radiologia</SelectItem>
                  <SelectItem value="UROLOGY">Urologia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={isRecording ? "destructive" : "default"}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={transcribeMutation.isPending}
                className="h-24 flex-col gap-2"
              >
                {isRecording ? (
                  <>
                    <StopCircle className="h-8 w-8" />
                    <span>Parar Gravação</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-8 w-8" />
                    <span>Gravar Áudio</span>
                  </>
                )}
              </Button>

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={transcribeMutation.isPending || isRecording}
                />
                <div
                  className={cn(
                    "h-24 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors",
                    transcribeMutation.isPending || isRecording
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary hover:bg-muted/50"
                  )}
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">Upload de Arquivo</span>
                </div>
              </label>
            </div>

            {transcribeMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Transcrevendo áudio...</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              {getStatusDisplay()}
              {transcript && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Nova Transcrição
                  </Button>
                </div>
              )}
            </div>

            {transcript && (
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Transcrição médica com IA — vocabulário otimizado para termos médicos em português.
        </p>
      </CardContent>
    </Card>
    </FeatureGate>
  );
}
