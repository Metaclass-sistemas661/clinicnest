/**
 * Google Cloud Speech-to-Text V2 Client for Supabase Edge Functions
 * Uses Chirp model via Vertex AI — specialized for medical transcription in pt-BR
 *
 * Replaces AWS Transcribe Medical with a synchronous approach:
 * Audio in → transcript out (no polling required)
 *
 * Required environment variables:
 * - GCP_SERVICE_ACCOUNT_KEY (full JSON service account key)
 * - GCP_REGION (default: us-central1)
 */

const GCP_SERVICE_ACCOUNT_KEY = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") || "";
const GCP_REGION = Deno.env.get("GCP_REGION") || "us-central1";

// ── GCP Auth (shared pattern from bedrock-client.ts) ────────────

interface GcpServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

let _gcpAccessToken: string | null = null;
let _gcpTokenExpiry = 0;

function _getGcpCreds(): GcpServiceAccount {
  try {
    return JSON.parse(GCP_SERVICE_ACCOUNT_KEY);
  } catch {
    throw new Error("Invalid GCP_SERVICE_ACCOUNT_KEY JSON");
  }
}

function _base64url(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function _createGcpJwt(): Promise<string> {
  const creds = _getGcpCreds();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: creds.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const h = _base64url(enc.encode(JSON.stringify(header)));
  const p = _base64url(enc.encode(JSON.stringify(claims)));
  const sigInput = `${h}.${p}`;

  const pem = creds.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(sigInput)),
  );
  return `${sigInput}.${_base64url(sig)}`;
}

async function _getGcpAccessToken(): Promise<string> {
  if (_gcpAccessToken && Date.now() < _gcpTokenExpiry) return _gcpAccessToken;

  const jwt = await _createGcpJwt();
  const creds = _getGcpCreds();
  const tokenUri = creds.token_uri || "https://oauth2.googleapis.com/token";

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`GCP token exchange failed: ${resp.status} - ${txt}`);
  }
  const data = await resp.json();
  _gcpAccessToken = data.access_token;
  _gcpTokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
  return _gcpAccessToken!;
}

// ── Specialty → Medical context mapping ─────────────────────────

const SPECIALTY_CONTEXT: Record<string, string[]> = {
  PRIMARYCARE: [
    "consulta médica", "anamnese", "exame físico", "pressão arterial",
    "frequência cardíaca", "temperatura", "saturação", "glicemia",
    "hemograma", "receituário", "atestado", "encaminhamento",
  ],
  CARDIOLOGY: [
    "eletrocardiograma", "ecocardiograma", "cateterismo", "arritmia",
    "insuficiência cardíaca", "fibrilação atrial", "estenose aórtica",
    "infarto", "angina", "marca-passo", "stent", "hipertensão",
  ],
  NEUROLOGY: [
    "eletroencefalograma", "ressonância magnética", "tomografia",
    "acidente vascular cerebral", "epilepsia", "esclerose múltipla",
    "parkinson", "cefaleia", "enxaqueca", "neuropatia", "demência",
  ],
  ONCOLOGY: [
    "quimioterapia", "radioterapia", "imunoterapia", "biópsia",
    "estadiamento", "metástase", "neoplasia", "tumor", "linfonodo",
    "marcador tumoral", "PET-CT", "protocolo oncológico",
  ],
  RADIOLOGY: [
    "radiografia", "tomografia computadorizada", "ressonância magnética",
    "ultrassonografia", "densitometria", "mamografia", "contraste",
    "laudo radiológico", "achado incidental", "consolidação",
  ],
  UROLOGY: [
    "próstata", "PSA", "litíase", "cistoscopia", "urofluxometria",
    "nefrolitíase", "hidronefrose", "bexiga", "uretra", "ureter",
    "incontinência urinária", "hematúria",
  ],
};

// ── Types ───────────────────────────────────────────────────────

export type MedicalSpecialty =
  | "PRIMARYCARE"
  | "CARDIOLOGY"
  | "NEUROLOGY"
  | "ONCOLOGY"
  | "RADIOLOGY"
  | "UROLOGY";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  languageCode: string;
  durationSeconds: number;
  /** True se a transcrição parece ser alucinação do modelo (repetições, confiança baixa) */
  isHallucination: boolean;
}

// ── Audio encoding detection ────────────────────────────────────

/**
 * Detecta se a transcrição é provavelmente uma alucinação do modelo STT.
 * Ocorre com áudio Bluetooth HFP de baixa qualidade, ruído intenso, ou silêncio.
 *
 * Padrões:
 *  1. Frase idêntica repetida 3+ vezes
 *  2. Uma frase representa >60% de todas as sentenças (mín. 4 sentenças)
 *  3. Token curto (≤6 chars) repetido 5+ vezes seguidas ("31 31 31 31 31")
 *  4. Confiança baixa (< 50%) com transcrição curta
 *  5. Texto predominantemente numérico (>60% dos tokens)
 */
function detectHallucination(transcript: string, avgConfidence: number): boolean {
  if (!transcript || transcript.trim().length < 5) return false;

  const text = transcript.trim();

  // Padrão 3: repetição de token curto
  const shortTokenRepeat = /\b(\w{1,6})\b(?:\s+\1){4,}/i;
  if (shortTokenRepeat.test(text)) return true;

  // Padrão 5: texto predominantemente numérico (>60% dos tokens são números)
  // Alucinação típica: "19 20 21 22 23 ... 99 100" ou "3 1 3 5 0 6 3 9 3 0"
  const tokens = text.split(/\s+/);
  if (tokens.length >= 2) {
    const numericTokens = tokens.filter((t) => /^\d{1,6}$/.test(t)).length;
    if (numericTokens / tokens.length > 0.6) return true;
  }

  // Divide em sentenças
  const sentences = text
    .split(/[.!?"]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 10);

  if (sentences.length >= 2) {
    const counts = new Map<string, number>();
    for (const s of sentences) {
      const n = (counts.get(s) ?? 0) + 1;
      counts.set(s, n);
      if (n >= 3) return true; // Padrão 1
    }
    for (const count of counts.values()) {
      if (count / sentences.length > 0.6 && sentences.length >= 4) return true; // Padrão 2
    }
  }

  // Padrão 4: confiança baixa (< 50%) com transcrição curta — improvável ser fala real
  if (avgConfidence > 0 && avgConfidence < 0.50 && text.length < 100) return true;

  return false;
}

function detectEncoding(contentType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "WEBM_OPUS",
    "audio/ogg": "OGG_OPUS",
    "audio/opus": "OGG_OPUS",
    "audio/mp3": "MP3",
    "audio/mpeg": "MP3",
    "audio/wav": "LINEAR16",
    "audio/x-wav": "LINEAR16",
    "audio/flac": "FLAC",
    "audio/mp4": "MP3",
    "audio/m4a": "MP3",
  };
  return map[contentType.toLowerCase()] || "WEBM_OPUS";
}

// ── Main transcription function ─────────────────────────────────

/**
 * Transcribe audio using Google Cloud Speech-to-Text V2 (Chirp model).
 * This is a SYNCHRONOUS call — returns the transcript directly.
 *
 * Supports audio up to ~60 seconds inline (base64).
 * For longer audio, uses Google Cloud Storage URI.
 *
 * @param audioData - Raw audio bytes
 * @param contentType - MIME type of the audio (e.g., "audio/webm")
 * @param specialty - Medical specialty for context hints
 * @returns Transcription result with transcript text and confidence
 */
export async function transcribeAudio(
  audioData: Uint8Array,
  contentType: string,
  specialty: MedicalSpecialty = "PRIMARYCARE",
): Promise<TranscriptionResult> {
  if (!GCP_SERVICE_ACCOUNT_KEY) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured for transcription");
  }

  const token = await _getGcpAccessToken();
  const creds = _getGcpCreds();
  const encoding = detectEncoding(contentType);

  // Build speech adaptation with medical terms for the specialty
  const phraseHints = SPECIALTY_CONTEXT[specialty] || SPECIALTY_CONTEXT.PRIMARYCARE;

  // Use Speech-to-Text V2 Recognize API (synchronous, up to 480s with Chirp)
  const url = `https://${GCP_REGION}-speech.googleapis.com/v2/projects/${creds.project_id}/locations/${GCP_REGION}/recognizers/_:recognize`;

  // Convert audio to base64
  const audioBase64 = btoa(
    audioData.reduce((data, byte) => data + String.fromCharCode(byte), ""),
  );

  const requestBody = {
    config: {
      // Chirp — Google's universal speech model, best for medical Portuguese
      autoDecodingConfig: {},
      languageCodes: ["pt-BR"],
      model: "chirp_2",
      features: {
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
      },
      adaptation: {
        phraseSets: [
          {
            inlinePhraseSet: {
              phrases: phraseHints.map((p) => ({ value: p, boost: 5 })),
            },
          },
        ],
      },
    },
    content: audioBase64,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000); // 55s (edge fn has 60s)

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Speech-to-Text error: ${resp.status} - ${errText}`);
    }

    const data = await resp.json();

    // Extract transcript from V2 response
    let transcript = "";
    let totalConfidence = 0;
    let resultCount = 0;
    let durationSeconds = 0;

    if (data.results && data.results.length > 0) {
      for (const result of data.results) {
        if (result.alternatives && result.alternatives.length > 0) {
          const best = result.alternatives[0];
          transcript += (transcript ? " " : "") + best.transcript;
          if (best.confidence) {
            totalConfidence += best.confidence;
            resultCount++;
          }
        }
        // Get duration from the last result's end time
        if (result.resultEndOffset) {
          const secs = parseFloat(result.resultEndOffset.replace("s", ""));
          if (secs > durationSeconds) durationSeconds = secs;
        }
      }
    }

    if (!transcript) {
      throw new Error("Nenhuma fala detectada no áudio. Verifique a qualidade da gravação.");
    }

    // Detecção de alucinação server-side
    const isHallucination = detectHallucination(transcript, resultCount > 0 ? totalConfidence / resultCount : 0);

    console.log(
      `[vertex-transcribe] Transcribed ${durationSeconds.toFixed(1)}s audio, ` +
        `${transcript.length} chars, confidence: ${resultCount > 0 ? (totalConfidence / resultCount * 100).toFixed(1) : "N/A"}%` +
        `${isHallucination ? " [HALLUCINATION DETECTED]" : ""}`,
    );

    return {
      transcript,
      confidence: resultCount > 0 ? totalConfidence / resultCount : 0,
      languageCode: "pt-BR",
      durationSeconds,
      isHallucination,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transcribe audio from base64 string (convenience wrapper for edge functions).
 * Decodes base64 → Uint8Array and calls transcribeAudio.
 */
export async function transcribeAudioBase64(
  audioBase64: string,
  contentType: string,
  specialty: MedicalSpecialty = "PRIMARYCARE",
): Promise<TranscriptionResult> {
  const binaryString = atob(audioBase64);
  const audioData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    audioData[i] = binaryString.charCodeAt(i);
  }
  return transcribeAudio(audioData, contentType, specialty);
}
