import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Plus, Replace, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface VoiceFieldButtonProps {
  /** Chamado com o texto final (já decidido se append ou replace) */
  onTranscript: (text: string) => void;
  /** Valor atual do campo — se não-vazio, oferece escolha append/replace */
  currentValue?: string;
  className?: string;
  /** Tooltip do botão no estado idle */
  title?: string;
}

/**
 * Botão de microfone inline para transcrever voz em um campo específico.
 *
 * Se o campo já tem conteúdo, exibe um mini-painel inline para o usuário
 * escolher entre "Adicionar ao texto" ou "Substituir tudo".
 * Se o campo está vazio, preenche diretamente.
 */
export function VoiceFieldButton({ onTranscript, currentValue, className, title }: VoiceFieldButtonProps) {
  const [pendingText, setPendingText] = useState<string | null>(null);

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
      // Se campo está vazio, preenche direto
      if (!currentValue?.trim()) {
        onTranscript(transcript);
        toast.success("Campo preenchido via voz");
      } else {
        // Campo já tem texto — mostrar opções
        setPendingText(transcript);
      }
    },
    onError: () => {
      toast.error("Falha na transcrição. Tente novamente.");
    },
  });

  const handleResult = useCallback(
    ({ blob }: { blob: Blob }) => {
      transcribeMutation.mutate(blob);
    },
    [transcribeMutation],
  );

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onResult: handleResult,
  });

  const handleAppend = useCallback(() => {
    if (!pendingText) return;
    const existing = (currentValue ?? "").trim();
    onTranscript(existing + "\n" + pendingText);
    setPendingText(null);
    toast.success("Texto adicionado ao campo");
  }, [pendingText, currentValue, onTranscript]);

  const handleReplace = useCallback(() => {
    if (!pendingText) return;
    onTranscript(pendingText);
    setPendingText(null);
    toast.success("Campo substituído via voz");
  }, [pendingText, onTranscript]);

  const handleCancel = useCallback(() => {
    setPendingText(null);
  }, []);

  // Painel de escolha append/replace
  if (pendingText) {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button" size="sm" variant="outline"
          onClick={handleAppend}
          className="h-6 px-2 text-[10px] gap-1 text-teal-700 border-teal-300 hover:bg-teal-50"
          title="Adicionar ao texto existente"
        >
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
        <Button
          type="button" size="sm" variant="outline"
          onClick={handleReplace}
          className="h-6 px-2 text-[10px] gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
          title="Substituir todo o texto"
        >
          <Replace className="h-3 w-3" /> Substituir
        </Button>
        <Button
          type="button" size="icon" variant="ghost"
          onClick={handleCancel}
          className="h-5 w-5 text-muted-foreground hover:text-red-500"
          title="Descartar transcrição"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

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
