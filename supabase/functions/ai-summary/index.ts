import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { completeText } from "../_shared/bedrock-client.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente médico especializado em resumir prontuários de pacientes.

Sua tarefa é criar um resumo clínico conciso e útil a partir dos dados do prontuário.

ESTRUTURA DO RESUMO:
1. **Dados do Paciente**: Nome, idade, sexo
2. **Histórico Relevante**: Condições crônicas, alergias, cirurgias anteriores
3. **Consultas Recentes**: Resumo das últimas consultas (máximo 5)
4. **Diagnósticos Ativos**: CIDs atuais
5. **Medicamentos em Uso**: Lista atual
6. **Pontos de Atenção**: Alertas importantes para o profissional

REGRAS:
- Seja objetivo e conciso
- Destaque informações críticas (alergias, interações medicamentosas)
- Use terminologia médica apropriada
- Não invente informações - use apenas os dados fornecidos
- Se alguma informação estiver ausente, indique "Não informado"
- Responda em português brasileiro

FORMATO: Markdown estruturado`;

interface SummaryRequest {
  client_id: string;
  include_appointments?: boolean;
  include_prescriptions?: boolean;
  include_exams?: boolean;
  max_appointments?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    const rl = await checkRateLimit(`ai-summary:${user.id}`, 10, 60);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 60) },
      });
    }

    // Check medical role
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("professional_type, tenant_id")
      .eq("id", user.id)
      .single();

    const allowedRoles = ["medico", "dentista", "enfermeiro", "admin"];
    if (!profile || !allowedRoles.includes(profile.professional_type)) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SummaryRequest = await req.json();
    const {
      client_id,
      include_appointments = true,
      include_prescriptions = true,
      include_exams = true,
      max_appointments = 5,
    } = body;

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch patient data
    const { data: client, error: clientError } = await supabaseClient
      .from("clients")
      .select(`
        id,
        full_name,
        birth_date,
        gender,
        cpf,
        phone,
        email,
        allergies,
        chronic_conditions,
        blood_type,
        notes
      `)
      .eq("id", client_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Patient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build patient data object
    const patientData: Record<string, unknown> = {
      nome: client.full_name,
      data_nascimento: client.birth_date,
      sexo: client.gender,
      tipo_sanguineo: client.blood_type,
      alergias: client.allergies || "Não informado",
      condicoes_cronicas: client.chronic_conditions || "Não informado",
      observacoes: client.notes,
    };

    // Fetch recent appointments
    if (include_appointments) {
      const { data: appointments } = await supabaseClient
        .from("appointments")
        .select(`
          start_time,
          status,
          notes,
          diagnosis,
          cid_code,
          professional:profiles!appointments_professional_id_fkey(full_name)
        `)
        .eq("client_id", client_id)
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "completed")
        .order("start_time", { ascending: false })
        .limit(max_appointments);

      patientData.consultas_recentes = appointments?.map((a) => ({
        data: a.start_time,
        profissional: a.professional?.full_name,
        diagnostico: a.diagnosis,
        cid: a.cid_code,
        observacoes: a.notes,
      })) || [];
    }

    // Fetch active prescriptions
    if (include_prescriptions) {
      const { data: prescriptions } = await supabaseClient
        .from("prescriptions")
        .select(`
          medication_name,
          dosage,
          frequency,
          start_date,
          end_date,
          notes
        `)
        .eq("client_id", client_id)
        .eq("tenant_id", profile.tenant_id)
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split("T")[0]}`)
        .order("start_date", { ascending: false });

      patientData.medicamentos_ativos = prescriptions || [];
    }

    // Fetch recent exams
    if (include_exams) {
      const { data: exams } = await supabaseClient
        .from("exam_results")
        .select(`
          exam_type,
          result_date,
          result_summary,
          is_abnormal
        `)
        .eq("client_id", client_id)
        .eq("tenant_id", profile.tenant_id)
        .order("result_date", { ascending: false })
        .limit(10);

      patientData.exames_recentes = exams || [];
    }

    // Generate summary with Claude
    const prompt = `Gere um resumo clínico do seguinte paciente:\n\n${JSON.stringify(patientData, null, 2)}`;

    const summary = await completeText(prompt, SYSTEM_PROMPT, {
      maxTokens: 1500,
      temperature: 0.2,
    });

    console.log(`[ai-summary] User: ${user.id}, Client: ${client_id}`);

    return new Response(
      JSON.stringify({
        summary,
        patient_name: client.full_name,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[ai-summary] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
