/**
 * ai-ocr-exam — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkAiAccess, logAiUsage } from '../shared/planGating';
import { checkAiRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function aiOcrExam(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    /**
     * ai-ocr-exam — Extrai dados estruturados de exames médicos via Vertex AI (Gemini 2.0 Flash Vision).
     *
     * Input: { image_base64: string, mime_type: string, context?: string }
     * Output: { results: { exam_name, date, parameters: [{ name, value, unit, reference, flag }], notes } }
     */

    const GCP_SERVICE_ACCOUNT_KEY = process.env.GCP_SERVICE_ACCOUNT_KEY || "";
    const GCP_REGION = process.env.GCP_REGION || "us-central1";
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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
        ["sign"]);
      const sig = new Uint8Array(
        await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(sigInput)));
      return `${sigInput}.${_base64url(sig)}`;
    }

    async function _getGcpAccessToken(): Promise<string> {
      if (_gcpAccessToken && Date.now() < _gcpTokenExpiry) return _gcpAccessToken;
      const jwt = await _createGcpJwt();
      const creds = _getGcpCreds();
      const tokenUri = creds.token_uri || "https://oauth2.googleapis.com/token";
      const resp = await fetch(tokenUri, {
        method: "POST",
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      });
      if (!resp.ok) throw new Error(`GCP token exchange failed: ${resp.status}`);
      const data = await resp.json() as any;
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
      try {
        const authHeader = (req.headers['authorization'] as string);
        if (!authHeader) {
          return res.status(401).json({ error: "Não autorizado" });
        }
        const authRes = (await authAdmin.getUser((authHeader || '').replace('Bearer ', '')) as any);

        const authError = authRes.error;

        const user = authRes.data?.user;
        if (authError || !user) {
          return res.status(401).json({ error: "Não autorizado" });
        }

        const rl = await checkAiRateLimit(user.id, "ai-ocr", "generation");
        if (!rl.allowed) {
          return res.status(429).json({ error: "Limite de requisições excedido. Tente novamente em instantes." });
        }

        const { data: profile } = await db.from("profiles")
          .select("tenant_id, role")
          .eq("id", user.id)
          .single();

        if (!profile) {
          return res.status(403).json({ error: "Perfil não encontrado" });
        }

        const accessCheck = await checkAiAccess(user.id, profile.tenant_id, "ocrExams");
        if (accessCheck) {
          return res.status(403).json({ error: accessCheck });
        }

        const body = req.body;
        const { image_base64, mime_type, context } = body;

        if (!image_base64 || !mime_type) {
          return res.status(400).json({ error: "image_base64 e mime_type são obrigatórios" });
        }

        if (!ALLOWED_MIMES.has(mime_type)) {
          return res.status(400).json({ error: "Tipo de imagem não suportado. Use JPEG, PNG, WebP ou PDF." });
        }

        // Validate base64 size
        const estimatedBytes = (image_base64.length * 3) / 4;
        if (estimatedBytes > MAX_IMAGE_SIZE) {
          return res.status(400).json({ error: "Imagem muito grande. Máximo 10MB." });
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
            return res.status(502).json({ error: "Erro ao processar imagem pela IA" });
          }

          const aiData = await aiResp.json() as any;
          const rawText = aiData.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || "")
            .join("") || "";

          const usage = aiData.usageMetadata || {};
          await logAiUsage(profile.tenant_id, user.id, "ocr-exam", {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
          }).catch(() => {});

          // Parse JSON from response (handle markdown code blocks)
          let results;
          try {
            const jsonStr = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            results = JSON.parse(jsonStr);
          } catch {
            results = { raw_text: rawText, error: "Não foi possível estruturar os dados" };
          }

          return res.json({ results });
        } finally {
          clearTimeout(timer);
        }
      } catch (err: any) {
        console.error("ai-ocr-exam error:", err);
        return res.status(500).json({ error: "Erro interno" });
      }

  } catch (err: any) {
    console.error(`[ai-ocr-exam] Error:`, err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
