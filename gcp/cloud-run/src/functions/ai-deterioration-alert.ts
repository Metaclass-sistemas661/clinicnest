/**
 * ai-deterioration-alert — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkAiAccess, logAiUsage } from '../shared/planGating';
import { completeText, chatCompletion } from '../shared/vertexAi';
import { checkAiRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function aiDeteriorationAlert(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
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

        // Rate limit: interaction category (20 req/min)
        const rl = await checkAiRateLimit(user.id, "ai-deterioration", "interaction");
        if (!rl.allowed) {
          return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
        }

        // Get profile
        const { data: profile } = await db.from("profiles")
          .select("tenant_id, professional_type")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          return res.status(403).json({ error: "Sem permissão" });
        }

        // Check admin via user_roles OR clinical professional_type
        const { data: userRole } = await db.from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", profile.tenant_id)
          .single();

        const clinicalRoles = ["medico", "dentista", "enfermeiro", "tec_enfermagem", "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo", "esteticista", "admin"];
        const isAdmin = userRole?.role === "admin";
        const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
        if (!isAdmin && !hasClinicalRole) {
          return res.status(403).json({ error: "Sem permissão" });
        }

        // Plan gating
        const aiAccess = await checkAiAccess(profile.tenant_id, user.id, "copilot");
        if (!aiAccess.allowed) {
          return res.status(403).json({ error: aiAccess.reason });
        }

        const { patient_id } = req.body;
        if (!patient_id) {
          return res.status(400).json({ error: "patient_id é obrigatório" });
        }

        // Fetch last N medical records
        const { data: records } = await db.from("medical_records")
          .select("chief_complaint, anamnesis, diagnosis, treatment_plan, cid_code, created_at")
          .eq("patient_id", patient_id)
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(10);

        // Fetch patient info (allergies)
        const { data: patient } = await db.from("patients")
          .select("name, allergies, date_of_birth")
          .eq("id", patient_id)
          .eq("tenant_id", profile.tenant_id)
          .single();

        // Fetch latest PROMs
        const { data: proms } = await db.from("patient_proms")
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
            { headers: { ...{}, "Content-Type": "application/json" } }
          );
        }

        // Build prompt
        const patientInfo = patient
          ? `Paciente: ${patient.name}, Nascimento: ${patient.date_of_birth || "N/I"}, Alergias: ${patient.allergies || "Nenhuma registrada"}`
          : "Informações do paciente não disponíveis";

        const recordsText = records
          .map((r: any, i: number) => {
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
            proms.map((p: any) => {
              const d = new Date(p.created_at).toLocaleDateString("pt-BR");
              return `${d}: ${p.questionnaire} — Score ${p.total_score}/${p.max_score} (${p.severity})`;
            }).join("\n")
          : "";

        const prompt = `${patientInfo}\n\n${recordsText}${promsText}\n\nAnalise a evolução clínica e identifique sinais de deterioração.`;

        const aiResponse = await completeText(prompt, { systemInstruction: SYSTEM_PROMPT, maxTokens: 2048,
          temperature: 0.1 });

        let parsed;
        try {
          const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch?.[0] || aiResponse.text);
        } catch {
          parsed = {
            risk_level: "low",
            alerts: [],
            summary: aiResponse,
            trend: "stable",
          };
        }

        await logAiUsage(user.id, profile.tenant_id, "ai-deterioration-alert");

        return new Response(JSON.stringify(parsed), {});
      } catch (err: any) {
        console.error("ai-deterioration-alert error:", err);
        return res.status(500).json({ error: "Erro interno ao analisar deterioração" });
      }

  } catch (err: any) {
    console.error(`[ai-deterioration-alert] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
