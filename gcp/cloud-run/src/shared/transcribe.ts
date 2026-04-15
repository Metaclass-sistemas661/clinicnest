/**
 * Google Cloud Speech-to-Text V2 (Chirp)
 * Replaces: _shared/vertex-transcribe-client.ts
 */

const HALLUCINATION_PATTERNS = [
  /(.{10,}?)\1{3,}/i,                    // repeated text
  /^\d[\d\s,.]+\d$/,                      // all numeric
  /legendas? por/i,                       // subtitle attribution
  /obrigad[oa]\s+por\s+assistir/i,        // "thanks for watching"
  /inscreva-se/i,                         // "subscribe"
];

interface TranscribeResult {
  transcript: string;
  confidence: number;
  isHallucination: boolean;
  hallucinationReason?: string;
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = 'audio/webm;codecs=opus'
): Promise<TranscribeResult> {
  const projectId = process.env.GCP_PROJECT_ID || 'sistema-de-gestao-16e15';
  const region = process.env.GCP_REGION || 'us-central1';

  // Get access token (metadata server in Cloud Run)
  let token: string;
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } }
    );
    const data = await res.json() as any;
    token = data.access_token;
  } catch {
    // Fallback: use service account key
    const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error('Cannot get GCP access token');
    const { createSign } = await import('crypto');
    const key = JSON.parse(keyJson);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    })).toString('base64url');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenRes.json() as any;
    token = tokenData.access_token;
  }

  // Map MIME to encoding
  const encodingMap: Record<string, string> = {
    'audio/webm;codecs=opus': 'WEBM_OPUS',
    'audio/webm': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/mp3': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/wav': 'LINEAR16',
    'audio/flac': 'FLAC',
    'audio/mp4': 'MP3',
  };

  const encoding = encodingMap[mimeType.toLowerCase()] || 'WEBM_OPUS';

  const url = `https://${region}-speech.googleapis.com/v2/projects/${projectId}/locations/${region}/recognizers/_:recognize`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        features: { enableWordConfidence: true, enableAutomaticPunctuation: true },
        autoDecodingConfig: {},
        languageCodes: ['pt-BR'],
        model: 'chirp',
      },
      content: audioBase64,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Speech-to-Text error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const results = data.results || [];
  const transcript = results.map((r: any) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
  const confidence = results[0]?.alternatives?.[0]?.confidence || 0;

  // Hallucination detection
  let isHallucination = false;
  let hallucinationReason: string | undefined;

  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(transcript)) {
      isHallucination = true;
      hallucinationReason = `Pattern match: ${pattern.source}`;
      break;
    }
  }

  if (!isHallucination && transcript.length < 10 && confidence < 0.5) {
    isHallucination = true;
    hallucinationReason = 'Short transcript with low confidence';
  }

  if (!isHallucination && transcript.replace(/[\d\s,.]/g, '').length / transcript.length > 0.6) {
    // >60% numeric
    if (transcript.length > 20) {
      isHallucination = true;
      hallucinationReason = 'Excessive numeric content';
    }
  }

  return { transcript, confidence, isHallucination, hallucinationReason };
}
