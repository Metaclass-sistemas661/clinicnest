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
  /** Nível médio de energia do áudio (0-1). < 0.005 = silêncio/ruído */
  avgEnergy: number;
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
 *   1ª — SEM processamento Chrome (melhor para BT e mics externos no Windows)
 *   2ª — COM processamento Chrome (para mics integrados)
 *   3ª — audio: true (mínimo absoluto)
 */
export function useAudioRecorder({
  onResult,
  onError,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const analyserCleanupRef = useRef<(() => void) | null>(null);
  const energySamplesRef = useRef<number[]>([]);

  // ── detecta qualidade real após stream adquirido ──────────────────────────
  function detectQuality(stream: MediaStream): AudioQuality {
    const track = stream.getAudioTracks()[0];
    if (!track) return "unknown";
    const settings = track.getSettings() as MediaTrackSettings & { sampleRate?: number };
    const sr = settings.sampleRate ?? 0;
    if (sr === 0) return "unknown";
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
  // ORDEM CORRIGIDA: sem processamento primeiro (evita conflito BT HFP Windows)
  async function acquireStream(): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      // 1ª: SEM processamento do Chrome — ideal para BT e mics externos
      // Chrome's echoCancellation/noiseSuppression pode silenciar BT HFP no Windows
      {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      },
      // 2ª: COM processamento — para mics integrados de baixa qualidade
      {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        },
      },
      // 3ª: mínimo absoluto
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

  // ── Monitor de energia via AnalyserNode (LEITURA PASSIVA, sem alterar stream) ──
  function attachEnergyMonitor(stream: MediaStream): () => void {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      // NÃO conecta a destination — apenas monitora, sem feedback

      const buf = new Float32Array(analyser.fftSize);
      const intervalId = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        energySamplesRef.current.push(rms);
      }, 200);

      return () => {
        clearInterval(intervalId);
        source.disconnect();
        ctx.close().catch(() => {});
      };
    } catch {
      return () => {};
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await acquireStream();
      const quality = detectQuality(stream);

      const track = stream.getAudioTracks()[0];
      const rawSampleRate =
        (track?.getSettings() as MediaTrackSettings & { sampleRate?: number })
          ?.sampleRate ?? 0;

      // Log do dispositivo para debug
      console.log(
        `[AudioRecorder] Device: "${track?.label}", sampleRate: ${rawSampleRate}, quality: ${quality}`
      );

      if (quality === "low") {
        toast.warning("Microfone em baixa qualidade detectado", {
          description:
            "Se a transcrição ficar imprecisa, use o microfone integrado ou fone com fio.",
          duration: 5000,
        });
      }

      // Monitor de energia (passivo — NÃO altera o stream)
      energySamplesRef.current = [];
      const cleanupMonitor = attachEnergyMonitor(stream);
      analyserCleanupRef.current = cleanupMonitor;

      // Grava diretamente do stream original — SEM AudioContext pipeline
      // O pipeline anterior (compressor+gain+highpass) causava silêncio em
      // certas combinações Windows + Chrome + Bluetooth HFP.
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, {
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

        // Limpa monitor de energia
        analyserCleanupRef.current?.();
        analyserCleanupRef.current = null;

        // Calcula energia média
        const samples = energySamplesRef.current;
        const avgEnergy =
          samples.length > 0
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0;

        console.log(
          `[AudioRecorder] Recording done: ${durationMs}ms, ` +
            `${blob.size} bytes, avgEnergy: ${avgEnergy.toFixed(5)}, ` +
            `samples: ${samples.length}`
        );

        setIsRecording(false);
        onResult({ blob, quality, sampleRate: rawSampleRate, durationMs, avgEnergy });
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
  if (!transcript || transcript.trim().length < 5) return false;

  const text = transcript.trim();

  // Padrão 3: repetição de token curto (≤6 chars) com espaço — ex: "31 11 11 11"
  const shortTokenRepeat = /\b(\w{1,6})\b(?:\s+\1){4,}/i;
  if (shortTokenRepeat.test(text)) return true;

  // Padrão 5: texto predominantemente numérico (>60% dos tokens são números)
  // Alucinação típica do Chirp com BT HFP: "19 20 21 22 ... 99 100"
  const tokens = text.split(/\s+/);
  if (tokens.length >= 2) {
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
