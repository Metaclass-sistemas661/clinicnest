import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeText } from "../_shared/vertex-ai-client.ts";
import { checkAiRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiAccess, logAiUsage } from "../_shared/planGating.ts";

const SYSTEM_PROMPT = `Você é um assistente de monitoramento clínico que analisa a evolução de prontuários médicos de um paciente ao longo do tempo.

Sua tarefa: identificar sinais de DETERIORAÇÃO CLÍNICA comparando os registros mais recentes com os anteriores.

Analise especificamente:
1. Piora progressiva de sintomas (queixa principal ficando mais grave)
2. Novos sintomas que aparecem entre consultas
3. Diagnósticos que se agravam
4. Tratamentos que não estão funcionando (conduta muda repetidamente)
5. PROMs (desfechos relatados) piorando ao longo do tempo

Responda SEMPRE em JSON válido com esta estrutura:
{
  "risk_level": "low" | "moderate" | "high" | "critical",
  "alerts": [
    {
      "type": "worsening_symptoms" | "new_symptoms" | "treatment_failure" | "proms_decline" | "escalating_diagnosis",
      "description": "Descrição concisa do alerta",
      "evidence": "Evidência dos prontuários",
      "recommendation": "Recomendação de conduta"
    }
  ],
  "summary": "Resumo geral da avaliação de deterioração em 2-3 frases",
  "trend": "improving" | "stable" | "declining"
}

Se não houver sinais de deterioração, retorne risk_level "low" com alerts vazio e trend "stable" ou "improving".
Seja objetivo, baseado em evidências dos dados fornecidos. Não invente dados.`;

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

    // Rate limit: interaction category (20 req/min)
    const rl = await checkAiRateLimit(user.id, "ai-deterioration", "interaction");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, professional_type")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin via user_roles OR clinical professional_type
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    const clinicalRoles = ["medico", "dentista", "enfermeiro", "tec_enfermagem", "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo", "esteticista", "admin"];
    const isAdmin = userRole?.role === "admin";
    const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
    if (!isAdmin && !hasClinicalRole) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plan gating
    const aiAccess = await checkAiAccess(profile.tenant_id, user.id, "copilot");
    if (!aiAccess.allowed) {
      return new Response(JSON.stringify({ error: aiAccess.reason }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch last N medical records
    const { data: records } = await supabase
      .from("medical_records")
      .select("chief_complaint, anamnesis, diagnosis, treatment_plan, cid_code, created_at")
      .eq("patient_id", patient_id)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch patient info (allergies)
    const { data: patient } = await supabase
      .from("patients")
      .select("name, allergies, date_of_birth")
      .eq("id", patient_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    // Fetch latest PROMs
    const { data: proms } = await supabase
      .from("patient_proms")
      .select("questionnaire, total_score, max_score, severity, created_at")
      .eq("patient_id", patient_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!records || records.length < 2) {
      return new Response(
        JSON.stringify({
          risk_level: "low",
          alerts: [],
          summary: "Dados insuficientes para análise de deterioração. Necessário ao menos 2 prontuários.",
          trend: "stable",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt
    const patientInfo = patient
      ? `Paciente: ${patient.name}, Nascimento: ${patient.date_of_birth || "N/I"}, Alergias: ${patient.allergies || "Nenhuma registrada"}`
      : "Informações do paciente não disponíveis";

    const recordsText = records
      .map((r, i) => {
        const d = new Date(r.created_at).toLocaleDateString("pt-BR");
        return `--- Prontuário ${i + 1} (${d}) ---
Queixa: ${r.chief_complaint || "N/I"}
Anamnese: ${r.anamnesis || "N/I"}
Diagnóstico: ${r.diagnosis || "N/I"}
Conduta: ${r.treatment_plan || "N/I"}
CID: ${r.cid_code || "N/I"}`;
      })
      .join("\n\n");

    const promsText = proms && proms.length > 0
      ? `\n\n--- PROMs (Desfechos Relatados pelo Paciente) ---\n` +
        proms.map((p) => {
          const d = new Date(p.created_at).toLocaleDateString("pt-BR");
          return `${d}: ${p.questionnaire} — Score ${p.total_score}/${p.max_score} (${p.severity})`;
        }).join("\n")
      : "";

    const prompt = `${patientInfo}\n\n${recordsText}${promsText}\n\nAnalise a evolução clínica e identifique sinais de deterioração.`;

    const aiResponse = await completeText(prompt, SYSTEM_PROMPT, {
      maxTokens: 2048,
      temperature: 0.1,
    });

    let parsed;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || aiResponse);
    } catch {
      parsed = {
        risk_level: "low",
        alerts: [],
        summary: aiResponse,
        trend: "stable",
      };
    }

    await logAiUsage(profile.tenant_id, "ai-deterioration-alert");

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-deterioration-alert error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao analisar deterioração" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
