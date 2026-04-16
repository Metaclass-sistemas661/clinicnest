/**
 * ai-smart-referral — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkAiAccess, logAiUsage } from '../shared/planGating';
import { completeText, chatCompletion } from '../shared/vertexAi';
import { checkAiRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function aiSmartReferral(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
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

        const rl = await checkAiRateLimit(user.id, "ai-referral", "interaction");
        if (!rl.allowed) {
          return res.status(429).json({ error: "Limite de requisições excedido. Tente novamente em instantes." });
        }

        // Admin client for data queries (bypasses RLS after manual auth checks)
        const { data: profile } = await db.from("profiles")
          .select("tenant_id, professional_type, full_name")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          return res.status(403).json({ error: "Sem permissão" });
        }

        const { data: userRole } = await db.from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", profile.tenant_id)
          .single();

        const clinicalRoles = ["medico", "dentista", "enfermeiro", "nutricionista", "psicologo", "fisioterapeuta", "fonoaudiologo", "esteticista", "admin"];
        const isAdmin = userRole?.role === "admin";
        const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
        if (!isAdmin && !hasClinicalRole) {
          return res.status(403).json({ error: "Sem permissão" });
        }

        const aiAccess = await checkAiAccess(user.id, profile.tenant_id, "copilot");
        if (!aiAccess.allowed) {
          return res.status(403).json({ error: aiAccess.reason });
        }

        const { chief_complaint, diagnosis, treatment_plan, cid_code, patient_name, allergies } = req.body;

        if (!diagnosis && !chief_complaint) {
          return res.status(400).json({ error: "Diagnóstico ou queixa principal obrigatório" });
        }

        const prompt = `Paciente: ${patient_name || "N/I"}
    Alergias: ${allergies || "Nenhuma"}
    Queixa Principal: ${chief_complaint || "N/I"}
    Diagnóstico: ${diagnosis || "N/I"}
    CID: ${cid_code || "N/I"}
    Conduta Atual: ${treatment_plan || "N/I"}
    Profissional Solicitante: ${profile.full_name || "N/I"}

    Gere o(s) encaminhamento(s) apropriado(s) para este caso.`;

        const aiResponse = await completeText(prompt, { systemInstruction: SYSTEM_PROMPT, maxTokens: 2048,
          temperature: 0.2 });

        let parsed;
        try {
          const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch?.[0] || aiResponse.text);
        } catch {
          parsed = {
            referrals: [],
            general_notes: aiResponse.text,
          };
        }

        logAiUsage(profile.tenant_id, user.id, "copilot").catch(() => {});

        return res.status(200).json(parsed);
      } catch (err: any) {
        console.error("ai-smart-referral error:", err);
        return res.status(500).json({ error: "Erro interno ao gerar encaminhamento" });
      }

  } catch (err: any) {
    console.error(`[ai-smart-referral] Error:`, err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
