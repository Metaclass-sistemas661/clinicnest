import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiRateLimit } from "../_shared/rateLimit.ts";
import { checkAiAccess, logAiUsage } from "../_shared/planGating.ts";

/**
 * ai-ocr-exam — Extrai dados estruturados de exames médicos via Vertex AI (Gemini 2.0 Flash Vision).
 *
 * Input: { image_base64: string, mime_type: string, context?: string }
 * Output: { results: { exam_name, date, parameters: [{ name, value, unit, reference, flag }], notes } }
 */

const GCP_SERVICE_ACCOUNT_KEY = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") || "";
const GCP_REGION = Deno.env.get("GCP_REGION") || "us-central1";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

let _gcpAccessToken: string | null = null;
let _gcpTokenExpiry = 0;

function _getGcpCreds() {
  if (!GCP_SERVICE_ACCOUNT_KEY) throw new Error("GCP_SERVICE_ACCOUNT_KEY not configured");
  return JSON.parse(GCP_SERVICE_ACCOUNT_KEY);
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
  if (!resp.ok) throw new Error(`GCP token exchange failed: ${resp.status}`);
  const data = await resp.json();
  _gcpAccessToken = data.access_token;
  _gcpTokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
  return _gcpAccessToken!;
}

const SYSTEM_PROMPT = `Você é um assistente de OCR médico altamente preciso.
Analise a imagem de exame médico fornecida e extraia todos os dados estruturados.

Responda SEMPRE em JSON válido com esta estrutura:
{
  "exam_name": "Nome do exame (ex: Hemograma Completo, Perfil Lipídico)",
  "date": "Data do exame se visível (formato YYYY-MM-DD ou null)",
  "laboratory": "Nome do laboratório se visível (ou null)",
  "patient_name": "Nome do paciente se visível (ou null)",
  "parameters": [
    {
      "name": "Nome do parâmetro",
      "value": "Valor encontrado",
      "unit": "Unidade de medida",
      "reference": "Valor de referência se disponível",
      "flag": "normal" | "high" | "low" | "critical"
    }
  ],
  "notes": "Observações adicionais do exame, metodologia, ou informações relevantes",
  "raw_text": "Texto completo extraído da imagem para referência"
}

Regras:
- Extraia TODOS os parâmetros visíveis
- Se um valor estiver fora da faixa de referência, marque flag como "high" ou "low"
- Se o valor estiver muito acima/abaixo (>2x referência), use "critical"
- Se não conseguir ler um valor, use "ilegível" como valor
- Se a imagem não for um exame médico, retorne {"error": "Imagem não é um exame médico"}
- Seja extremamente cuidadoso com números — erros podem afetar diagnósticos`;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await checkAiRateLimit(user.id, "ai-ocr", "generation");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessCheck = await checkAiAccess(supabase, profile.tenant_id, "ocrExams");
    if (accessCheck) {
      return new Response(JSON.stringify({ error: accessCheck }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { image_base64, mime_type, context } = body;

    if (!image_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: "image_base64 e mime_type são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_MIMES.has(mime_type)) {
      return new Response(JSON.stringify({ error: "Tipo de imagem não suportado. Use JPEG, PNG, WebP ou PDF." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate base64 size
    const estimatedBytes = (image_base64.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: "Imagem muito grande. Máximo 10MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = _getGcpCreds();
    const token = await _getGcpAccessToken();
    const url = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${creds.project_id}/locations/${GCP_REGION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

    const userPrompt = context
      ? `Analise esta imagem de exame médico. Contexto adicional: ${context}`
      : "Analise esta imagem de exame médico e extraia todos os dados estruturados.";

    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mime_type, data: image_base64 } },
            { text: userPrompt },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const aiResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(geminiBody),
        signal: controller.signal,
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("Vertex AI Vision error:", errText);
        return new Response(JSON.stringify({ error: "Erro ao processar imagem pela IA" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResp.json();
      const rawText = aiData.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

      const usage = aiData.usageMetadata || {};
      await logAiUsage(supabase, profile.tenant_id, user.id, "ocr-exam", {
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
      }).catch(() => {});

      // Parse JSON from response (handle markdown code blocks)
      let results;
      try {
        const jsonStr = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        results = JSON.parse(jsonStr);
      } catch {
        results = { raw_text: rawText, error: "Não foi possível estruturar os dados" };
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error("ai-ocr-exam error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
