import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
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

type Specialty = "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY";

interface AiTranscribeProps {
  onTranscriptReady?: (transcript: string) => void;
  className?: string;
}

export function AiTranscribe({ onTranscriptReady, className }: AiTranscribeProps) {
  const [jobName, setJobName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [specialty, setSpecialty] = useState<Specialty>("PRIMARYCARE");
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: {
          action: "start",
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
      setJobName(data.job_name);
      toast.info("Transcrição iniciada. O áudio está sendo processado...");
    },
    onError: () => {
      toast.error("Não foi possível iniciar a transcrição.");
    },
  });

  const statusQuery = useQuery({
    queryKey: ["transcription-status", jobName],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: { action: "status", job_name: jobName },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!jobName && !transcript,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "COMPLETED" || data?.status === "FAILED") {
        return false;
      }
      return 5000;
    },
  });

  // Handle status updates
  if (statusQuery.data?.status === "COMPLETED" && statusQuery.data?.transcript && !transcript) {
    setTranscript(statusQuery.data.transcript);
    onTranscriptReady?.(statusQuery.data.transcript);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Por favor, selecione um arquivo de áudio.");
      return;
    }

    startMutation.mutate(file);
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
        startMutation.mutate(audioBlob);
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
    setJobName(null);
    setTranscript("");
  };

  const getStatusDisplay = () => {
    if (!jobName) return null;

    const status = statusQuery.data?.status;
    switch (status) {
      case "IN_PROGRESS":
      case "QUEUED":
        return (
          <div className="flex items-center gap-2 text-yellow-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processando...</span>
          </div>
        );
      case "COMPLETED":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Concluído</span>
          </div>
        );
      case "FAILED":
        return (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Falhou: {statusQuery.data?.error}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-5 w-5 text-primary" />
          Transcrição de Áudio Médico
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!jobName && !transcript ? (
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
                disabled={startMutation.isPending}
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
                  disabled={startMutation.isPending || isRecording}
                />
                <div
                  className={cn(
                    "h-24 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors",
                    startMutation.isPending || isRecording
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary hover:bg-muted/50"
                  )}
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">Upload de Arquivo</span>
                </div>
              </label>
            </div>

            {startMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Enviando áudio...</span>
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

            {statusQuery.data?.status === "IN_PROGRESS" && (
              <Progress value={undefined} className="w-full" />
            )}

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
  );
}
