/**
 * AWS Bedrock Client for Supabase Edge Functions
 * Uses Claude 3 Haiku for cost-effective AI operations
 * 
 * Required environment variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (default: us-east-1)
 */

const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";

// Claude 3 Haiku - Best cost-benefit for medical use cases
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

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

/**
 * Invoke Claude 3 Haiku via AWS Bedrock with retry + timeout
 */
export async function invokeBedrockClaude(request: BedrockRequest): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }

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
    if (attempt > 0) {
      await sleep(backoffMs(attempt - 1));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);

    try {
      const headers = await signRequest("POST", url, body, "bedrock");
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Bedrock API error: ${response.status} - ${errorText}`);
        if (RETRYABLE_STATUS.has(response.status)) continue; // retry
        throw lastError; // 4xx não-retryable: falha imediata
      }

      const data: BedrockResponse = await response.json();
      return {
        text: data.content[0]?.text || "",
        usage: data.usage,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        lastError = new Error(`Bedrock timeout after ${BEDROCK_TIMEOUT_MS}ms`);
      }
      // Retry em erros de rede / timeout (exceto último attempt)
      if (attempt < MAX_RETRIES) continue;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Bedrock request failed after retries");
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
 * Used by the AI Agent for function calling (search patients, schedule, etc.).
 * Includes retry with exponential backoff + AbortController timeout.
 */
export async function invokeBedrockClaudeWithTools(
  messages: AgentMessage[],
  system: string,
  tools: ToolDefinition[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<AgentResponse> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }

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
    if (attempt > 0) {
      await sleep(backoffMs(attempt - 1));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);

    try {
      const headers = await signRequest("POST", url, body, "bedrock");
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Bedrock API error: ${response.status} - ${errorText}`);
        if (RETRYABLE_STATUS.has(response.status)) continue;
        throw lastError;
      }

      return response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        lastError = new Error(`Bedrock timeout after ${BEDROCK_TIMEOUT_MS}ms`);
      }
      if (attempt < MAX_RETRIES) continue;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Bedrock request failed after retries");
}

// Re-export types
export type { BedrockMessage, BedrockRequest };
