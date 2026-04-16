/**
import { completeText, chatCompletion } from '../shared/vertexAi';
 * Vertex AI Client — Gemini 2.0 Flash
 * Replaces: _shared/vertex-ai-client.ts
 */

const GCP_REGION = process.env.VERTEX_AI_REGION || 'us-central1';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

interface VertexResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
}

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GCP_SERVICE_ACCOUNT_KEY not set');

  // Use Google Auth Library or manual JWT signing
  // In Cloud Run, use metadata server for default SA token
  if (!keyJson || keyJson === 'default') {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } }
    );
    const data = await res.json() as any;
    return data.access_token;
  }

  // Manual JWT → access token exchange for explicit credentials
  const { createSign } = await import('crypto');
  const key = JSON.parse(keyJson);
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
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
  return tokenData.access_token;
}

function getProjectId(): string {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (keyJson && keyJson !== 'default') {
    try { return JSON.parse(keyJson).project_id; } catch { /* fall through */ }
  }
  return process.env.GCP_PROJECT_ID || 'sistema-de-gestao-16e15';
}

export async function completeText(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; systemInstruction?: string }
): Promise<VertexResponse> {
  const token = await getAccessToken();
  const projectId = getProjectId();
  const url = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GCP_REGION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 4096,
    },
  };
  if (options?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    text,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

export async function chatCompletion(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  options?: { temperature?: number; maxTokens?: number; systemInstruction?: string; tools?: any[] }
): Promise<VertexResponse & { toolCalls?: any[] }> {
  const token = await getAccessToken();
  const projectId = getProjectId();
  const url = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GCP_REGION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const contents = messages.map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 4096,
    },
  };
  if (options?.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (options?.tools) {
    const declarations = options.tools.flat();
    body.tools = [{ functionDeclarations: declarations }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const candidate = data.candidates?.[0]?.content;
  const text = candidate?.parts?.find((p: any) => p.text)?.text || '';
  const toolCalls = candidate?.parts?.filter((p: any) => p.functionCall) || [];

  return {
    text,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}
