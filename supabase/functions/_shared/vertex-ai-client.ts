/**
 * Vertex AI Client — Google Gemini 2.0 Flash
 * 
 * Único provider de IA para text generation no ClinicNest.
 * ZERO dependência de AWS Bedrock.
 *
 * Env vars:
 * - GCP_SERVICE_ACCOUNT_KEY (full JSON service account key)
 * - GCP_REGION (default: us-central1)
 * - GEMINI_MODEL (default: gemini-2.0-flash)
 */

const GCP_SERVICE_ACCOUNT_KEY = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") || "";
const GCP_REGION = Deno.env.get("GCP_REGION") || "us-central1";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number): number {
  return 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
}

// ── Types (backward-compatible with bedrock-client exports) ─────

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BedrockRequest {
  messages: BedrockMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
}

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

// ── GCP Auth ────────────────────────────────────────────────────

interface GcpServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

let _gcpAccessToken: string | null = null;
let _gcpTokenExpiry = 0;

function _getGcpCreds(): GcpServiceAccount {
  if (!GCP_SERVICE_ACCOUNT_KEY) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured");
  }
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

function _geminiEndpoint(): string {
  const creds = _getGcpCreds();
  return `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${creds.project_id}/locations/${GCP_REGION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
}

// ── Format translators ──────────────────────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { output: string } };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function _toGeminiSimple(messages: BedrockMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));
}

function _toGeminiAgent(messages: AgentMessage[]): GeminiContent[] {
  const toolIdToName = new Map<string, string>();
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === "tool_use") {
          toolIdToName.set((block as ContentBlockToolUse).id, (block as ContentBlockToolUse).name);
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

// deno-lint-ignore no-explicit-any
function _parseSimpleResponse(geminiResp: any): {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
} {
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
function _parseAgentResponse(geminiResp: any): AgentResponse {
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

  const hasToolUse = content.some((b) => b.type === "tool_use");
  const u = geminiResp.usageMetadata || {};

  return {
    content,
    stop_reason: hasToolUse ? "tool_use" : "end_turn",
    usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
  };
}

// ── Core invoke with retry ──────────────────────────────────────

async function _invokeGemini(
  // deno-lint-ignore no-explicit-any
  reqBody: Record<string, any>,
): Promise<Response> {
  const token = await _getGcpAccessToken();
  const url = _geminiEndpoint();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errText = await resp.text();
        lastError = new Error(`Vertex AI error: ${resp.status} - ${errText}`);
        if (RETRYABLE_STATUS.has(resp.status)) continue;
        throw lastError;
      }
      return resp;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") lastError = new Error(`Vertex AI timeout after ${REQUEST_TIMEOUT_MS}ms`);
      if (attempt < MAX_RETRIES) continue;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("Vertex AI request failed after retries");
}

// ── Public API (same signatures as bedrock-client) ──────────────

/**
 * Invoke Gemini 2.0 Flash via Vertex AI with retry + timeout.
 * Drop-in replacement for invokeBedrockClaude().
 */
export async function invokeBedrockClaude(request: BedrockRequest): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const contents = _toGeminiSimple(request.messages);

  // deno-lint-ignore no-explicit-any
  const reqBody: Record<string, any> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens || 1024,
      temperature: request.temperature ?? 0.3,
    },
  };
  if (request.system) {
    reqBody.systemInstruction = { parts: [{ text: request.system }] };
  }

  const resp = await _invokeGemini(reqBody);
  return _parseSimpleResponse(await resp.json());
}

/**
 * Simple text completion.
 * Drop-in replacement for completeText().
 */
export async function completeText(
  prompt: string,
  systemPrompt?: string,
  options?: { maxTokens?: number; temperature?: number },
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
 * Chat completion with conversation history.
 * Drop-in replacement for chatCompletion().
 */
export async function chatCompletion(
  messages: BedrockMessage[],
  systemPrompt?: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  return invokeBedrockClaude({
    messages,
    system: systemPrompt,
    max_tokens: options?.maxTokens,
    temperature: options?.temperature,
  });
}

/**
 * Chat with native tool use support (for AI agents).
 * Drop-in replacement for invokeBedrockClaudeWithTools().
 */
export async function invokeBedrockClaudeWithTools(
  messages: AgentMessage[],
  system: string,
  tools: ToolDefinition[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<AgentResponse> {
  const contents = _toGeminiAgent(messages);

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

  const resp = await _invokeGemini(reqBody);
  return _parseAgentResponse(await resp.json());
}
