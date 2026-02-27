import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeText } from "../_shared/bedrock-client.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente especializado em codificação CID-10 para profissionais de saúde brasileiros.

Sua tarefa é analisar a descrição clínica fornecida e sugerir os códigos CID-10 mais apropriados.

REGRAS:
1. Sugira de 1 a 5 códigos CID-10 mais relevantes
2. Ordene por relevância (mais provável primeiro)
3. Inclua o código e a descrição oficial em português
4. Se a descrição for vaga, sugira códigos mais genéricos
5. Considere diagnósticos diferenciais quando apropriado

FORMATO DE RESPOSTA (JSON):
{
  "suggestions": [
    {
      "code": "J06.9",
      "description": "Infecção aguda das vias aéreas superiores não especificada",
      "confidence": "alta",
      "notes": "Quadro compatível com IVAS"
    }
  ],
  "observations": "Observações adicionais se necessário"
}

NÍVEIS DE CONFIANÇA:
- "alta": Diagnóstico bem definido pela descrição
- "media": Provável, mas pode haver outras possibilidades
- "baixa": Sugestão baseada em informações limitadas

Responda APENAS com o JSON, sem texto adicional.`;

interface CidRequest {
  description: string;
  specialty?: string;
  tenant_id?: string;
}

interface CidSuggestion {
  code: string;
  description: string;
  confidence: "alta" | "media" | "baixa";
  notes?: string;
}

interface CidResponse {
  suggestions: CidSuggestion[];
  observations?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: 10 requests per minute per user
    const rl = await checkRateLimit(`ai-cid-suggest:${user.id}`, 10, 60);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 60) },
      });
    }

    // Check if user has medical role
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("professional_type, tenant_id")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["medico", "dentista", "enfermeiro", "admin"];
    if (!profile || !allowedRoles.includes(profile.professional_type)) {
      return new Response(JSON.stringify({ error: "Access denied. Medical role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CidRequest = await req.json();
    const { description, specialty } = body;

    if (!description || typeof description !== "string" || description.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Description must be at least 5 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt with context
    let prompt = `Descrição clínica: ${description.trim()}`;
    if (specialty) {
      prompt += `\nEspecialidade: ${specialty}`;
    }

    // Call Claude 3 Haiku via Bedrock
    const result = await completeText(prompt, SYSTEM_PROMPT, {
      maxTokens: 800,
      temperature: 0.2,
    });

    // Parse JSON response
    let response: CidResponse;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[ai-cid-suggest] Parse error:", parseError, "Response:", result);
      response = {
        suggestions: [],
        observations: "Não foi possível processar a resposta. Tente reformular a descrição.",
      };
    }

    // Log usage
    console.log(`[ai-cid-suggest] User: ${user.id}, Description length: ${description.length}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-cid-suggest] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
