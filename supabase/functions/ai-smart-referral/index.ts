import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeText } from "../_shared/vertex-ai-client.ts";
import { checkAiRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiAccess, logAiUsage } from "../_shared/planGating.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

const SYSTEM_PROMPT = `Você é um assistente clínico especializado em encaminhamentos médicos.

Dado o diagnóstico, queixa e conduta de um paciente, gere um encaminhamento inteligente com:
1. Especialidade(s) recomendada(s) em ordem de prioridade
2. Justificativa clínica para cada encaminhamento
3. Urgência (rotina, prioritário, urgente)
4. Informações relevantes para o especialista

Responda SEMPRE em JSON válido:
{
  "referrals": [
    {
      "specialty": "Nome da especialidade",
      "reason": "Justificativa clínica para o encaminhamento",
      "urgency": "routine" | "priority" | "urgent",
      "clinical_summary": "Resumo clínico para o especialista recebedor",
      "questions_for_specialist": ["Perguntas específicas para o especialista"],
      "complementary_exams": ["Exames que devem ser solicitados antes/junto"]
    }
  ],
  "general_notes": "Observações gerais sobre o caso"
}

Seja preciso e baseado em protocolos médicos. Máximo 3 encaminhamentos por vez.`;

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

    const rl = await checkAiRateLimit(user.id, "ai-referral", "interaction");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for data queries (bypasses RLS after manual auth checks)
    const adminClient = createSupabaseAdmin();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, professional_type, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    const clinicalRoles = ["medico", "dentista", "enfermeiro", "nutricionista", "psicologo", "fisioterapeuta", "fonoaudiologo", "esteticista", "admin"];
    const isAdmin = userRole?.role === "admin";
    const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
    if (!isAdmin && !hasClinicalRole) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiAccess = await checkAiAccess(profile.tenant_id, user.id, "copilot");
    if (!aiAccess.allowed) {
      return new Response(JSON.stringify({ error: aiAccess.reason }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { chief_complaint, diagnosis, treatment_plan, cid_code, patient_name, allergies } = await req.json();

    if (!diagnosis && !chief_complaint) {
      return new Response(JSON.stringify({ error: "Diagnóstico ou queixa principal obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Paciente: ${patient_name || "N/I"}
Alergias: ${allergies || "Nenhuma"}
Queixa Principal: ${chief_complaint || "N/I"}
Diagnóstico: ${diagnosis || "N/I"}
CID: ${cid_code || "N/I"}
Conduta Atual: ${treatment_plan || "N/I"}
Profissional Solicitante: ${profile.full_name || "N/I"}

Gere o(s) encaminhamento(s) apropriado(s) para este caso.`;

    const aiResponse = await completeText(prompt, SYSTEM_PROMPT, {
      maxTokens: 2048,
      temperature: 0.2,
    });

    let parsed;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || aiResponse);
    } catch {
      parsed = {
        referrals: [],
        general_notes: aiResponse,
      };
    }

    logAiUsage(profile.tenant_id, user.id, "copilot").catch(() => {});

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-smart-referral error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar encaminhamento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
