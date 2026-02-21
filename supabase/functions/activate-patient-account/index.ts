import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: activate-patient-account
 *
 * Called from the patient portal when a patient with a valid access_code/CPF
 * creates their password for the first time.
 *
 * Body: { client_id, email, password, full_name }
 *
 * 1. Creates an auth user with account_type=patient
 * 2. Calls activate_patient_account RPC to link user → client → patient_profiles
 * 3. Returns success + user info
 *
 * No auth required (patient doesn't have an account yet).
 */

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { client_id, email, password, full_name } = await req.json();

    if (!client_id || !email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_id, email, password, full_name" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify client exists and has no account yet (direct query by UUID)
    const { data: clientRow, error: clientError } = await adminClient
      .from("clients")
      .select("id, user_id, name")
      .eq("id", client_id)
      .maybeSingle();

    if (clientError) {
      console.error("client lookup error:", clientError);
      return new Response(
        JSON.stringify({ error: "Erro ao validar paciente" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!clientRow) {
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (clientRow.user_id) {
      return new Response(
        JSON.stringify({ error: "Este paciente já possui uma conta. Faça login com sua senha." }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const actualClientId = clientRow.id;

    // 2. Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
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
        return new Response(
          JSON.stringify({ error: "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail." }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Erro ao criar conta: ${authError.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 3. Link user to client + create patient_profiles
    const { data: activationResult, error: actError } = await adminClient.rpc(
      "activate_patient_account",
      { p_client_id: actualClientId, p_user_id: userId }
    );

    if (actError) {
      console.error("activate_patient_account error:", actError);
      // Rollback: delete the auth user we just created
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao ativar conta do paciente" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!activationResult?.success) {
      // Rollback
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: activationResult?.error || "Erro ao ativar conta" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conta criada com sucesso!",
        user_id: userId,
        client_name: activationResult.client_name,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("activate-patient-account error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
