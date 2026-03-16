import { useState, useRef } from "react";
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

type Specialty = "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY";

interface AiTranscribeProps {
  onTranscriptReady?: (transcript: string) => void;
  className?: string;
}

export function AiTranscribe({ onTranscriptReady, className }: AiTranscribeProps) {
  const [transcript, setTranscript] = useState<string>("");
  const [specialty, setSpecialty] = useState<Specialty>("PRIMARYCARE");
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
          file_name: `recording-${Date.now()}.webm`,
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        transcribeMutation.mutate(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
              <label className="text-sm font-medium">Especialidade</label>
              <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
                <SelectTrigger>
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
          Transcrição médica especializada usando Amazon Transcribe Medical.
          Vocabulário otimizado para termos médicos em português.
        </p>
      </CardContent>
    </Card>
    </FeatureGate>
  );
}
