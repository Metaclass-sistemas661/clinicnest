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
      // 1ª: AGC ligado, sem echo/noise — ideal para BT HFP no Windows
      // autoGainControl amplifica sinais fracos do Bluetooth sem o risco
      // de silenciamento que echoCancellation causa em certos drivers
      {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: { ideal: 1 },
        },
      },
      // 2ª: COM todo processamento — para mics integrados
      {
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        },
      },
      // 3ª: SEM nenhum processamento — fallback raw
      {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      },
      // 4ª: mínimo absoluto
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
      const isBluetooth = /bluetooth|bt[\s-]|airpods|buds|wireless|jbl|sony|bose|jabra|beats|sennheiser|galaxy|wh-|wf-|qc|tune|free/i.test(trackLabel);
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

// ─── Processamento de áudio para STT ──────────────────────────────────────
/**
 * Processa o blob de áudio antes de enviar ao STT:
 *  1. SEMPRE decodifica e re-encoda como WAV (PCM 16-bit) — elimina artefatos de codec
 *  2. Aplica noise gate adaptativo — remove ruído constante de BT HFP
 *  3. Normaliza o volume — amplifica sinais fracos para pico ideal
 *  4. Detecta se existe fala real (vs ruído constante)
 *
 * Retorna hasSpeechContent=false se o áudio parece ser apenas ruído.
 */
export async function normalizeAudioBlob(
  blob: Blob,
  _avgEnergy: number,
): Promise<{ blob: Blob; contentType: string; wasNormalized: boolean; hasSpeechContent: boolean }> {
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

    // ── Análise por frames (25ms) para noise gate ──
    const frameSize = Math.max(Math.floor(sampleRate * 0.025), 1);
    const frameCount = Math.ceil(length / frameSize);
    const frameRms: number[] = [];

    for (let i = 0; i < length; i += frameSize) {
      const end = Math.min(i + frameSize, length);
      let sum = 0;
      for (let j = i; j < end; j++) sum += channelData[j] * channelData[j];
      frameRms.push(Math.sqrt(sum / (end - i)));
    }

    // ── Noise floor adaptativo (percentil 30) ──
    const sortedRms = [...frameRms].sort((a, b) => a - b);
    const noiseFloor = sortedRms[Math.floor(sortedRms.length * 0.3)] || 0;
    const gateThreshold = Math.max(noiseFloor * 3, 0.003);

    // ── Detecção de fala via variância de energia ──
    // Fala tem alta variância (silábas + pausas). Ruído constante tem variância baixa.
    const avgRms = frameRms.reduce((a, b) => a + b, 0) / frameRms.length;
    const variance = frameRms.reduce((sum, r) => sum + (r - avgRms) ** 2, 0) / frameRms.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = avgRms > 0 ? stdDev / avgRms : 0;

    // ── Aplica noise gate ──
    const processed = new Float32Array(length);
    let speechFrames = 0;

    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const start = frameIdx * frameSize;
      const end = Math.min(start + frameSize, length);
      if (frameRms[frameIdx] > gateThreshold) {
        for (let j = start; j < end; j++) processed[j] = channelData[j];
        speechFrames++;
      }
    }

    // Fala real: CV > 0.3 E pelo menos 15% dos frames acima do gate
    const speechRatio = speechFrames / frameCount;
    const hasSpeechContent = coeffOfVariation > 0.3 && speechRatio > 0.15;

    // ── Normaliza pico para 0.7 ──
    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(processed[i]);
      if (abs > peak) peak = abs;
    }
    const gain = peak > 0.001 ? 0.7 / peak : 1;

    console.log(
      `[AudioRecorder] Audio processing: frames=${frameCount}, speechFrames=${speechFrames}, ` +
        `speechRatio=${(speechRatio * 100).toFixed(1)}%, CV=${coeffOfVariation.toFixed(3)}, ` +
        `noiseFloor=${noiseFloor.toFixed(5)}, peak=${peak.toFixed(5)}, gain=${gain.toFixed(1)}x, ` +
        `hasSpeechContent=${hasSpeechContent}`,
    );

    // ── Encoda como WAV mono 16-bit PCM ──
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
      let sample = processed[i] * gain;
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }

    return {
      blob: new Blob([buffer], { type: "audio/wav" }),
      contentType: "audio/wav",
      wasNormalized: true,
      hasSpeechContent,
    };
  } catch (err) {
    console.warn("[AudioRecorder] Audio processing failed, using original:", err);
    return { blob, contentType: blob.type, wasNormalized: false, hasSpeechContent: true };
  }
}
