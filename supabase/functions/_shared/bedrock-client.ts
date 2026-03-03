/**
 * Multi-provider AI Client for Supabase Edge Functions
 *
 * Primary: AWS Bedrock (Claude 3 Haiku)
 * Fallback: Google Vertex AI (Gemini 2.0 Flash)
 *
 * If Bedrock fails or is not configured, automatically falls back to Vertex AI.
 * If only one provider is configured, uses that one exclusively.
 *
 * AWS Bedrock env vars:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (default: us-east-1)
 *
 * Google Vertex AI env vars:
 * - GCP_SERVICE_ACCOUNT_KEY (full JSON service account key)
 * - GCP_REGION (default: us-central1)
 */

const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";

// Claude 3 Haiku - Best cost-benefit for medical use cases
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

// ── Vertex AI (Google Gemini) fallback ──────────────────────────
const GCP_SERVICE_ACCOUNT_KEY = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") || "";
const GCP_REGION = Deno.env.get("GCP_REGION") || "us-central1";
const GEMINI_MODEL = "gemini-2.0-flash";

const BEDROCK_AVAILABLE = !!AWS_ACCESS_KEY_ID && !!AWS_SECRET_ACCESS_KEY;
const VERTEX_AI_AVAILABLE = !!GCP_SERVICE_ACCOUNT_KEY;

// ── Configurações de resiliência ────────────────────────────────
const BEDROCK_TIMEOUT_MS = 25_000; // 25 s (edge functions têm 30 s de wall-time)
const MAX_RETRIES = 2; // até 3 tentativas (1 original + 2 retries)
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

/** Aguarda ms milissegundos */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calcula backoff exponencial com jitter: base * 2^attempt ± jitter */
function backoffMs(attempt: number): number {
  const base = 1000; // 1 s
  const exp = base * Math.pow(2, attempt); // 1s, 2s, 4s…
  const jitter = Math.floor(Math.random() * 500);
  return exp + jitter;
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

interface BedrockRequest {
  messages: BedrockMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
}

interface BedrockResponse {
  content: { type: string; text: string }[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Sign AWS request using Signature Version 4
 */
async function signRequest(
  method: string,
  url: string,
  body: string,
  service: string
): Promise<Headers> {
  const encoder = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  // AWS SigV4 requires URI-encoded path (except '/') for canonical URI
  const canonicalUri = parsedUrl.pathname
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  // Create canonical request
  const payloadHash = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    "", // query string
    canonicalHeaders,
    signedHeaders,
    payloadHashHex,
  ].join("\n");

  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHashHex].join("\n");

  // Calculate signature
  async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key instanceof ArrayBuffer ? key : key.buffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  }

  const kDate = await hmacSha256(encoder.encode(`AWS4${AWS_SECRET_ACCESS_KEY}`), dateStamp);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return new Headers({
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization: authorizationHeader,
  });
}

// ══════════════════════════════════════════════════════════════════
// ██  Vertex AI (Google Gemini) — Auth + Format Translators      ██
// ══════════════════════════════════════════════════════════════════

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

  // Import RSA private key from PEM
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

function _geminiEndpoint(): string {
  const creds = _getGcpCreds();
  return `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${creds.project_id}/locations/${GCP_REGION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
}

// ── Format translators: Claude ↔ Gemini ──────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { output: string } };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function _claudeSimpleToGemini(messages: BedrockMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));
}

function _claudeAgentToGemini(messages: AgentMessage[]): GeminiContent[] {
  // Build tool_use_id → name map for resolving tool_result
  const toolIdToName = new Map<string, string>();
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_use") {
          const tu = block as ContentBlockToolUse;
          toolIdToName.set(tu.id, tu.name);
        }
      }
    }
  }

  return messages.map((m) => {
    if (typeof m.content === "string") {
      return {
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      };
    }
    const parts: GeminiPart[] = [];
    for (const block of m.content) {
      if (block.type === "text") {
        parts.push({ text: (block as ContentBlockText).text });
      } else if (block.type === "tool_use") {
        const tu = block as ContentBlockToolUse;
        toolIdToName.set(tu.id, tu.name);
        parts.push({ functionCall: { name: tu.name, args: tu.input } });
      } else if (block.type === "tool_result") {
        const tr = block as ContentBlockToolResult;
        const name = toolIdToName.get(tr.tool_use_id) || "unknown_tool";
        parts.push({ functionResponse: { name, response: { output: tr.content } } });
      }
    }
    return {
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts,
    };
  });
}

function _geminiToClaudeSimple(
  // deno-lint-ignore no-explicit-any
  geminiResp: any,
): { text: string; usage: { input_tokens: number; output_tokens: number } } {
  const candidate = geminiResp.candidates?.[0];
  // deno-lint-ignore no-explicit-any
  const text = candidate?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  const u = geminiResp.usageMetadata || {};
  return {
    text,
    usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
  };
}

// deno-lint-ignore no-explicit-any
function _geminiToClaudeAgent(geminiResp: any): AgentResponse {
  const candidate = geminiResp.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const content: ContentBlock[] = [];

  for (const part of parts) {
    if (part.text) {
      content.push({ type: "text", text: part.text });
    }
    if (part.functionCall) {
      content.push({
        type: "tool_use",
        id: `toolu_${crypto.randomUUID().slice(0, 12)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  // Determine stop_reason based on presence of tool_use blocks
  const hasToolUse = content.some((b) => b.type === "tool_use");
  const u = geminiResp.usageMetadata || {};

  return {
    content,
    stop_reason: hasToolUse ? "tool_use" : "end_turn",
    usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
  };
}

// ── Vertex AI invoke (internal) ──────────────────────────────────

async function _invokeVertexGemini(request: BedrockRequest): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const token = await _getGcpAccessToken();
  const url = _geminiEndpoint();
  const contents = _claudeSimpleToGemini(request.messages);

  // deno-lint-ignore no-explicit-any
  const reqBody: any = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens || 1024,
      temperature: request.temperature ?? 0.3,
    },
  };
  if (request.system) {
    reqBody.systemInstruction = { parts: [{ text: request.system }] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Vertex AI error: ${resp.status} - ${errText}`);
    }
    return _geminiToClaudeSimple(await resp.json());
  } finally {
    clearTimeout(timer);
  }
}

async function _invokeVertexGeminiWithTools(
  messages: AgentMessage[],
  system: string,
  tools: ToolDefinition[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<AgentResponse> {
  const token = await _getGcpAccessToken();
  const url = _geminiEndpoint();
  const contents = _claudeAgentToGemini(messages);

  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));

  const reqBody = {
    contents,
    systemInstruction: { parts: [{ text: system }] },
    tools: [{ functionDeclarations }],
    generationConfig: {
      maxOutputTokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Vertex AI error: ${resp.status} - ${errText}`);
    }
    return _geminiToClaudeAgent(await resp.json());
  } finally {
    clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════════════════════
// ██  Public API — Bedrock primary, Vertex AI fallback           ██
// ══════════════════════════════════════════════════════════════════

/**
 * Invoke Claude 3 Haiku via AWS Bedrock with retry + timeout.
 * Falls back to Google Vertex AI (Gemini) if Bedrock fails or is not configured.
 */
export async function invokeBedrockClaude(request: BedrockRequest): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}> {
  // ── Try AWS Bedrock first ──
  if (BEDROCK_AVAILABLE) {
    try {
      const url = `https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${MODEL_ID}/invoke`;
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: request.max_tokens || 1024,
        temperature: request.temperature ?? 0.3,
        system: request.system || "",
        messages: request.messages,
      });

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) await sleep(backoffMs(attempt - 1));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
        try {
          const headers = await signRequest("POST", url, body, "bedrock");
          const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
          if (!response.ok) {
            const errorText = await response.text();
            lastError = new Error(`Bedrock API error: ${response.status} - ${errorText}`);
            if (RETRYABLE_STATUS.has(response.status)) continue;
            throw lastError;
          }
          const data: BedrockResponse = await response.json();
          return { text: data.content[0]?.text || "", usage: data.usage };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (lastError.name === "AbortError") lastError = new Error(`Bedrock timeout after ${BEDROCK_TIMEOUT_MS}ms`);
          if (attempt < MAX_RETRIES) continue;
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastError ?? new Error("Bedrock request failed after retries");
    } catch (bedrockErr) {
      // If Vertex AI is available, fall back; otherwise re-throw
      if (!VERTEX_AI_AVAILABLE) throw bedrockErr;
      console.warn(`[AI] Bedrock failed: ${bedrockErr instanceof Error ? bedrockErr.message : bedrockErr}. Falling back to Vertex AI (Gemini).`);
    }
  }

  // ── Fallback to Vertex AI (Gemini) ──
  if (VERTEX_AI_AVAILABLE) {
    return _invokeVertexGemini(request);
  }

  throw new Error("No AI provider configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (Bedrock) or GCP_SERVICE_ACCOUNT_KEY (Vertex AI).");
}

/**
 * Simple text completion with Claude 3 Haiku
 */
export async function completeText(
  prompt: string,
  systemPrompt?: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const result = await invokeBedrockClaude({
    messages: [{ role: "user", content: prompt }],
    system: systemPrompt,
    max_tokens: options?.maxTokens,
    temperature: options?.temperature,
  });
  return result.text;
}

/**
 * Chat completion with conversation history
 */
export async function chatCompletion(
  messages: BedrockMessage[],
  systemPrompt?: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  return invokeBedrockClaude({
    messages,
    system: systemPrompt,
    max_tokens: options?.maxTokens,
    temperature: options?.temperature,
  });
}

// === Tool Use Support for AI Agent ===

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ContentBlockText {
  type: "text";
  text: string;
}

export interface ContentBlockToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContentBlockToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export type ContentBlock = ContentBlockText | ContentBlockToolUse | ContentBlockToolResult;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface AgentResponse {
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Invoke Claude 3 Haiku via AWS Bedrock with native tool use support.
 * Falls back to Google Vertex AI (Gemini) if Bedrock fails or is not configured.
 */
export async function invokeBedrockClaudeWithTools(
  messages: AgentMessage[],
  system: string,
  tools: ToolDefinition[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<AgentResponse> {
  // ── Try AWS Bedrock first ──
  if (BEDROCK_AVAILABLE) {
    try {
      const url = `https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${MODEL_ID}/invoke`;
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.3,
        system,
        messages,
        tools,
      });

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) await sleep(backoffMs(attempt - 1));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
        try {
          const headers = await signRequest("POST", url, body, "bedrock");
          const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
          if (!response.ok) {
            const errorText = await response.text();
            lastError = new Error(`Bedrock API error: ${response.status} - ${errorText}`);
            if (RETRYABLE_STATUS.has(response.status)) continue;
            throw lastError;
          }
          return response.json();
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (lastError.name === "AbortError") lastError = new Error(`Bedrock timeout after ${BEDROCK_TIMEOUT_MS}ms`);
          if (attempt < MAX_RETRIES) continue;
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastError ?? new Error("Bedrock request failed after retries");
    } catch (bedrockErr) {
      if (!VERTEX_AI_AVAILABLE) throw bedrockErr;
      console.warn(`[AI] Bedrock WithTools failed: ${bedrockErr instanceof Error ? bedrockErr.message : bedrockErr}. Falling back to Vertex AI (Gemini).`);
    }
  }

  // ── Fallback to Vertex AI (Gemini) ──
  if (VERTEX_AI_AVAILABLE) {
    return _invokeVertexGeminiWithTools(messages, system, tools, options);
  }

  throw new Error("No AI provider configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (Bedrock) or GCP_SERVICE_ACCOUNT_KEY (Vertex AI).");
}

// Re-export types
export type { BedrockMessage, BedrockRequest };
