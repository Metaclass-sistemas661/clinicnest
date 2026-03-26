import { useRef, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceFieldButtonProps {
  /** Chamado com o texto transcrito — o caller decide append ou replace */
  onTranscript: (text: string) => void;
  className?: string;
  /** Tooltip do botão no estado idle */
  title?: string;
}

/**
 * Botão de microfone inline para transcrever voz em um campo específico.
 *
 * Grava, transcreve via ai-transcribe e devolve o texto cru via onTranscript.
 * A lógica de append/replace fica a cargo do componente pai.
 *
 * @example
 * // Replace
 * <VoiceFieldButton onTranscript={(t) => set("chief_complaint", t)} />
 *
 * // Append ao conteúdo existente
 * <VoiceFieldButton
 *   onTranscript={(t) =>
 *     setBase(b => ({ ...b, anamnesis: b.anamnesis ? b.anamnesis.trim() + "\n" + t : t }))
 *   }
 * />
 */
export function VoiceFieldButton({ onTranscript, className, title }: VoiceFieldButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribeMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      const ext = audioBlob.type.split("/")[1]?.split(";")[0] || "webm";
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: {
          action: "transcribe",
          audio_base64: base64,
          file_name: `voice-field-${Date.now()}.${ext}`,
          content_type: audioBlob.type,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const transcript: string = (data?.transcript ?? "").trim();
      if (!transcript) {
        toast.error("Nenhuma fala detectada. Tente novamente.");
        return;
      }
      onTranscript(transcript);
    },
    onError: () => {
      toast.error("Falha na transcrição. Tente novamente.");
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const mr = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      const actualMime = mr.mimeType || preferredMime || "audio/webm";
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const baseType = actualMime.split(";")[0] || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: baseType });
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        transcribeMutation.mutate(blob);
      };
      mr.start();
      setIsRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [transcribeMutation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  if (transcribeMutation.isPending) {
    return (
      <Button type="button" size="icon" variant="ghost" disabled
        className={cn("h-6 w-6 shrink-0", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <Button
        type="button" size="icon" variant="ghost"
        onClick={stopRecording}
        className={cn("h-6 w-6 shrink-0 animate-pulse text-red-500 hover:text-red-600", className)}
        title="Parar gravação"
      >
        <MicOff className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Button
      type="button" size="icon" variant="ghost"
      onClick={startRecording}
      className={cn("h-6 w-6 shrink-0 text-muted-foreground hover:text-teal-600", className)}
      title={title ?? "Preencher campo via voz"}
    >
      <Mic className="h-3.5 w-3.5" />
    </Button>
  );
}
