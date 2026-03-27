import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";

// ─── Qualidade de áudio detectada ──────────────────────────────────────────
export type AudioQuality = "good" | "low" | "unknown";

// ─── Resultado da gravação ─────────────────────────────────────────────────
export interface AudioRecordingResult {
  blob: Blob;
  quality: AudioQuality;
  /** Sample rate real capturado pelo dispositivo (0 se desconhecido) */
  sampleRate: number;
  /** Duração da gravação em milissegundos */
  durationMs: number;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
interface UseAudioRecorderOptions {
  /** Chamado quando a gravação para e o blob está pronto */
  onResult: (result: AudioRecordingResult) => void;
  /** Chamado se o microfone não pôde ser acessado */
  onError?: (reason: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

/**
 * Hook de gravação de áudio robusto.
 *
 * Funciona com microfones integrados, fones com fio, USB e Bluetooth.
 * Detecta automaticamente a qualidade real do dispositivo após captura.
 *
 * Estratégia de constraints (waterfall):
 *   1ª tentativa — ideal: 16kHz mono + processamento de áudio
 *   2ª tentativa — sem sampleRate (deixa o OS decidir)
 *   3ª tentativa — audio: true (mínimo absoluto, compatível com qualquer dispositivo)
 */
export function useAudioRecorder({
  onResult,
  onError,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const recordingStartRef = useRef<number>(0);

  // ── detecta qualidade real após stream adquirido ──────────────────────────
  function detectQuality(stream: MediaStream): AudioQuality {
    const track = stream.getAudioTracks()[0];
    if (!track) return "unknown";
    const settings = track.getSettings() as MediaTrackSettings & { sampleRate?: number };
    const sr = settings.sampleRate ?? 0;
    if (sr === 0) return "unknown";
    // Bluetooth HFP Classic: 8kHz | HFP 1.6+: 16kHz | USB/built-in: 44.1kHz/48kHz
    return sr < 16000 ? "low" : "good";
  }

  // ── escolhe melhor codec suportado pelo browser ───────────────────────────
  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  }

  // ── tenta getUserMedia com waterfall de constraints ───────────────────────
  async function acquireStream(): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      },
      {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        },
      },
      { audio: true },
    ];

    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  // ── Pipeline AudioContext: compressor + gain + high-pass ──────────────────
  // Normaliza volume, remove ruído de baixa frequência e melhora áudio Bluetooth.
  // Em microfones bons, o efeito é mínimo. Em BT HFP (8kHz), o AudioContext faz
  // upsampling para ~48kHz e a cadeia de processamento limpa o sinal.
  function createAudioPipeline(
    stream: MediaStream,
  ): { processedStream: MediaStream; cleanup: () => void } {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);

      // High-pass: remove DC offset + rumble < 80Hz
      const highPass = ctx.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.setValueAtTime(80, ctx.currentTime);

      // Compressor: normaliza volume (boost quiet, limit loud)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-35, ctx.currentTime);
      compressor.knee.setValueAtTime(20, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      // Gain: boost leve para compensar microfones fracos
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.4, ctx.currentTime);

      const dest = ctx.createMediaStreamDestination();
      source.connect(highPass);
      highPass.connect(compressor);
      compressor.connect(gain);
      gain.connect(dest);

      return {
        processedStream: dest.stream,
        cleanup: () => {
          source.disconnect();
          highPass.disconnect();
          compressor.disconnect();
          gain.disconnect();
          ctx.close().catch(() => {});
        },
      };
    } catch {
      // Fallback: usa stream original se AudioContext não disponível
      return { processedStream: stream, cleanup: () => {} };
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await acquireStream();
      const quality = detectQuality(stream);

      // Detecta sample rate real do dispositivo
      const track = stream.getAudioTracks()[0];
      const rawSampleRate =
        (track?.getSettings() as MediaTrackSettings & { sampleRate?: number })
          ?.sampleRate ?? 0;

      // Avisa se qualidade é baixa (Bluetooth HFP clássico)
      if (quality === "low") {
        toast.warning("Microfone Bluetooth em baixa qualidade", {
          description:
            "O áudio será processado automaticamente para melhorar a qualidade. " +
            "Se a transcrição ficar imprecisa, use o microfone integrado ou fone com fio.",
          duration: 7000,
        });
      }

      // Pipeline de áudio: compressor + gain + high-pass (melhora BT e normaliza)
      const { processedStream, cleanup } = createAudioPipeline(stream);
      audioCleanupRef.current = cleanup;

      const mimeType = pickMimeType();
      const mr = new MediaRecorder(processedStream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128_000,
      });
      const actualMime = mr.mimeType || mimeType || "audio/webm";

      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const durationMs = Date.now() - recordingStartRef.current;
        const baseType = actualMime.split(";")[0] || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: baseType });
        stream.getTracks().forEach((t) => t.stop());
        audioCleanupRef.current?.();
        audioCleanupRef.current = null;
        setIsRecording(false);
        onResult({ blob, quality, sampleRate: rawSampleRate, durationMs });
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permissão de microfone negada. Permita o acesso nas configurações do navegador."
          : "Não foi possível acessar o microfone. Verifique a conexão do dispositivo.";
      toast.error(msg);
      onError?.(msg);
    }
  }, [onResult, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  return { isRecording, startRecording, stopRecording };
}

// ─── Detecção de alucinação do STT ─────────────────────────────────────────
/**
 * Detecta transcrições que parecem alucinações do modelo STT.
 * Ocorre tipicamente com áudio de baixa qualidade (Bluetooth HFP, ruído intenso).
 *
 * Padrões detectados:
 *   1. Frase idêntica repetida 3+ vezes
 *   2. Mais de 60% do conteúdo é repetição de uma única frase
 *   3. Repetição de palavras/números curtos (ex: "11 11 11 11 11")
 */
export function isLikelyHallucination(transcript: string): boolean {
  if (!transcript || transcript.trim().length < 20) return false;

  const text = transcript.trim();

  // Padrão 3: repetição de token curto (≤6 chars) com espaço — ex: "31 11 11 11"
  const shortTokenRepeat = /\b(\w{1,6})\b(?:\s+\1){4,}/i;
  if (shortTokenRepeat.test(text)) return true;

  // Padrão 5: texto predominantemente numérico (>60% dos tokens são números)
  // Alucinação típica do Chirp com BT HFP: "19 20 21 22 ... 99 100"
  const tokens = text.split(/\s+/);
  if (tokens.length >= 5) {
    const numericTokens = tokens.filter((t) => /^\d{1,6}$/.test(t)).length;
    if (numericTokens / tokens.length > 0.6) return true;
  }

  // Divide em sentenças limpas
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 10);

  if (sentences.length < 2) return false;

  // Padrão 1: frase idêntica repetida 3+ vezes
  const counts = new Map<string, number>();
  for (const s of sentences) {
    const n = (counts.get(s) ?? 0) + 1;
    counts.set(s, n);
    if (n >= 3) return true;
  }

  // Padrão 2: uma única frase representa >60% de todas as sentenças
  for (const count of counts.values()) {
    if (count / sentences.length > 0.6 && sentences.length >= 4) return true;
  }

  return false;
}
