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
  /** Label do dispositivo de entrada retornado pelo navegador */
  trackLabel: string;
  /** Indica se o dispositivo parece ser Bluetooth */
  isBluetooth: boolean;
  /** Duração da gravação em milissegundos */
  durationMs: number;
  /** Tamanho do blob final em bytes */
  blobSize: number;
  /** MIME final gravado pelo MediaRecorder */
  mimeType: string;
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
 *   1ª — AGC ligado, echo/noise desligados (amplifica BT HFP sem silenciar)
 *   2ª — COM todo processamento Chrome (para mics integrados)
 *   3ª — SEM processamento (fallback raw)
 *   4ª — audio: true (mínimo absoluto)
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
  // AGC primeiro — amplifica sinal fraco do BT HFP sem risco de silêncio
  // de echoCancellation/noiseSuppression no Windows
  async function acquireStream(): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      // 1ª: default do navegador (comportamento mais próximo do WhatsApp Web)
      { audio: true },
      // 2ª: COM todo processamento — bom baseline para desktop
      {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      },
      // 3ª: AGC ligado, sem echo/noise — fallback para alguns BT HFP
      // autoGainControl amplifica sinais fracos do Bluetooth.
      {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      },
      // 4ª: SEM nenhum processamento — fallback raw
      {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const constraints = attempts[i];
      try {
        console.log(`[AudioRecorder] getUserMedia attempt ${i + 1}/${attempts.length}`);
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  // ── Monitor de energia via AnalyserNode (LEITURA PASSIVA, sem alterar stream) ──
  // Usa CLONE do stream para não interferir com o MediaRecorder
  function attachEnergyMonitor(stream: MediaStream): () => void {
    try {
      const monitorStream = stream.clone();
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(monitorStream);
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
        monitorStream.getTracks().forEach((t) => t.stop());
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
      const trackLabel = track?.label ?? "";
      console.log(
        `[AudioRecorder] Device: "${trackLabel}", sampleRate: ${rawSampleRate}, quality: ${quality}`
      );

      // Estabilização de perfil Bluetooth: no Windows, quando getUserMedia ativa
      // o mic de um fone BT, o sistema muda de A2DP (só áudio) para HFP (mic+áudio).
      // Essa mudança leva 200-800ms e durante esse período o stream contém lixo.
      const isBluetooth = /bluetooth|bt[\s-]|airpods|buds|wireless|jbl|sony|bose|jabra|beats|sennheiser|galaxy|wh-|wf-|qc|tune|free|philips|tat\d|tws|earbuds/i.test(trackLabel);
      if (isBluetooth) {
        console.log("[AudioRecorder] Bluetooth device detected, waiting for HFP stabilization...");
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      if (quality === "low") {
        toast.warning("Microfone em baixa qualidade detectado", {
          description:
            "Se a transcrição ficar imprecisa, use o microfone integrado ou fone com fio.",
          duration: 5000,
        });
      }

      // Monitor de energia desativado — stream.clone() + AnalyserNode causa
      // interferência em muitos drivers (BT HFP, USB, alguns integrados no
      // Windows). Energia agora é apenas informativa e nunca bloqueia envio.
      energySamplesRef.current = [];
      analyserCleanupRef.current = null;
      console.log("[AudioRecorder] Energy monitor disabled (clone interference prevention)");

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
        onResult({
          blob,
          quality,
          sampleRate: rawSampleRate,
          trackLabel,
          isBluetooth,
          durationMs,
          blobSize: blob.size,
          mimeType: baseType,
          avgEnergy,
        });
      };

      // Entrega chunks periódicos reduz chance de blob vazio em alguns drivers BT.
      mr.start(1000);
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

/**
 * Mede energia RMS diretamente do blob gravado.
 * Fallback para casos em que o AnalyserNode reporta 0 no Windows+Bluetooth.
 */
export async function estimateAudioEnergyFromBlob(blob: Blob): Promise<number | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      await audioCtx.close().catch(() => {});
    }

    if (audioBuffer.numberOfChannels < 1 || audioBuffer.length === 0) return 0;

    const channel = audioBuffer.getChannelData(0);
    // Usa amostragem parcial para manter rápido em blobs maiores
    const step = Math.max(1, Math.floor(channel.length / 120_000));
    let sum = 0;
    let count = 0;
    for (let i = 0; i < channel.length; i += step) {
      const s = channel[i];
      sum += s * s;
      count++;
    }
    if (count === 0) return 0;
    return Math.sqrt(sum / count);
  } catch (err) {
    console.warn("[AudioRecorder] Failed to estimate blob energy:", err);
    return null;
  }
}

// ─── Processamento de áudio para STT ──────────────────────────────────────
/**
 * Converte blob de áudio para WAV PCM 16-bit mono com normalização de volume.
 * - Elimina artefatos de codec Opus/WebM que confundem o STT
 * - Normaliza pico para 0.7 (amplifica mics fracos como BT HFP)
 * - Se a decodificação falhar, retorna o blob original sem modificação
 */
export async function normalizeAudioBlob(
  blob: Blob,
  _avgEnergy: number,
): Promise<{ blob: Blob; contentType: string; wasNormalized: boolean }> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      await audioCtx.close().catch(() => {});
    }

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Encontra pico de amplitude
    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }

    // Ganho para normalizar pico a 0.7 (headroom de 30%)
    const gain = peak > 0.001 ? 0.7 / peak : 1;

    console.log(
      `[AudioRecorder] WAV conversion: ${length} samples, ${sampleRate}Hz, ` +
        `peak=${peak.toFixed(5)}, gain=${gain.toFixed(1)}x`,
    );

    // Encoda como WAV mono 16-bit PCM
    const wavSize = 44 + length * 2;
    const buffer = new ArrayBuffer(wavSize);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);  // PCM
    view.setUint16(22, 1, true);  // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeStr(36, "data");
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      let sample = channelData[i] * gain;
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }

    return {
      blob: new Blob([buffer], { type: "audio/wav" }),
      contentType: "audio/wav",
      wasNormalized: true,
    };
  } catch (err) {
    console.warn("[AudioRecorder] WAV conversion failed, using original:", err);
    return { blob, contentType: blob.type, wasNormalized: false };
  }
}
