/**
 * activate-patient-account — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function activatePatientAccount(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Rate limiting: 5 requests per 15 minutes per IP
    const requesterIp = (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`activate-patient:${requesterIp}`, 5, 900);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }

        const body = req.body;
        // Accept both patient_id (new) and client_id (legacy) for backward compatibility
        const client_id = body.patient_id || body.client_id;
        const { email, password, full_name } = body;

        if (!client_id || !email || !password || !full_name) {
          return res.status(400).json({ error: "Missing required fields: patient_id, email, password, full_name" });
        }

        if (password.length < 8) {
          return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres" });
        }

        if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          return res.status(400).json({ error: "A senha deve conter pelo menos 1 letra maiúscula e 1 número" });
        }
                // 1. Verify patient exists and has no account yet
        const { data: patientRow, error: patientError } = await db.from("patients")
          .select("id, user_id, name")
          .eq("id", client_id)
          .maybeSingle();

        if (patientError) {
          console.error("patient lookup error:", patientError);
          return res.status(500).json({ error: "Erro ao validar paciente" });
        }

        if (!patientRow) {
          console.warn("[security] activate-patient-account: patient not found for id:", client_id);
          return res.status(200).json({ error: "Não foi possível processar sua solicitação. Verifique seus dados ou entre em contato com a clínica." });
        }

        if (patientRow.user_id) {
          console.warn("[security] activate-patient-account: patient already has account:", client_id);
          return res.status(200).json({ error: "Não foi possível processar sua solicitação. Verifique seus dados ou entre em contato com a clínica." });
        }

        const actualClientId = patientRow.uid;

        // 2. Create auth user
        const { data: authData, error: authError } = await authAdmin.admin.createUser({
          email,
          password,
          email_confirm: true, // auto-confirm since clinic already validated the patient
          user_metadata: {
            full_name,
            account_type: "patient",
          },
        });

        if (authError) {
          console.error("createUser error:", authError);
          // Handle duplicate email
          if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
            return res.status(409).json({ error: "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail." });
          }
          return res.status(500).json({ error: `Erro ao criar conta: ${authError.message}` });
        }

        const userId = authData!.user.uid;

        // 3. Link user to client + create patient_profiles
        const { data: activationResult, error: actError } = await db.rpc(
          "activate_patient_account",
          { p_client_id: actualClientId, p_user_id: userId }
        );

        if (actError) {
          console.error("activate_patient_account error:", actError);
          // Rollback: delete the auth user we just created
          await authAdmin.admin.deleteUser(userId);
          return res.status(500).json({ error: "Erro ao ativar conta do paciente" });
        }

        if (!activationResult?.success) {
          // Rollback
          await authAdmin.admin.deleteUser(userId);
          return res.status(400).json({ error: activationResult?.error || "Erro ao ativar conta" });
        }

        return res.status(200).json({
          success: true,
          message: "Conta criada com sucesso!",
          user_id: userId,
          client_name: activationResult.client_name,
        });
  } catch (err: any) {
    console.error(`[activate-patient-account] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
