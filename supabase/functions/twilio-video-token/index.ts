import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

// ---------- Twilio Access Token via native crypto (no SDK) ----------
// Ref: https://www.twilio.com/docs/iam/access-tokens

const encoder = new TextEncoder();

function base64url(input: Uint8Array): string {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlFromString(str: string): string {
  return base64url(encoder.encode(str));
}

async function signHS256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url(new Uint8Array(sig));
}

async function createTwilioAccessToken(opts: {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  identity: string;
  roomName: string;
  ttlSeconds: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" };

  const grants: Record<string, unknown> = {
    identity: opts.identity,
    video: { room: opts.roomName },
  };

  const payload = {
    jti: `${opts.apiKeySid}-${now}`,
    iss: opts.apiKeySid,
    sub: opts.accountSid,
    iat: now,
    nbf: now,
    exp: now + opts.ttlSeconds,
    grants,
  };

  const headerB64 = base64urlFromString(JSON.stringify(header));
  const payloadB64 = base64urlFromString(JSON.stringify(payload));
  const signature = await signHS256(opts.apiKeySecret, `${headerB64}.${payloadB64}`);

  return `${headerB64}.${payloadB64}.${signature}`;
}

// ---------- Helpers ----------

const log = createLogger("TWILIO-VIDEO-TOKEN");

type Role = "staff" | "patient";

type Body = {
  appointment_id: string;
  role?: Role;
};

function toTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeRoomName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 128);
}

// ---------- Handler ----------

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Authenticate user (supports both staff via profiles and patients via patient_profiles)
  const authResult = await getAuthenticatedUser(req, cors);
  if (authResult.error) return authResult.error;
  const user = authResult.user;

  const rl = await checkRateLimit(`twilio-video-token:${user.id}`, 20, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const appointmentId = toTrimmedString(body.appointment_id, 80);
  const role: Role = body.role === "patient" ? "patient" : "staff";

  if (!appointmentId) {
    return new Response(JSON.stringify({ error: "appointment_id é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID") ?? "";
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET") ?? "";

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    return new Response(
      JSON.stringify({
        error: "Configuração do servidor incompleta",
        details: "Missing TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID or TWILIO_API_KEY_SECRET",
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  const ttlSecondsRaw = Deno.env.get("TWILIO_TOKEN_TTL_SECONDS");
  const ttlSeconds = Math.min(60 * 60 * 6, Math.max(60, Number(ttlSecondsRaw ?? 60 * 60)));

  const supabaseAdmin = createSupabaseAdmin();

  // Fetch appointment with client_id for patient validation
  const { data: apt, error: aptError } = await supabaseAdmin
    .from("appointments")
    .select("id, tenant_id, client_id, telemedicine")
    .eq("id", appointmentId)
    .maybeSingle();

  if (aptError) {
    log("DB: erro ao buscar appointment", { message: aptError.message });
    return new Response(JSON.stringify({ error: "Erro ao validar agendamento" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!apt) {
    return new Response(JSON.stringify({ error: "Agendamento não encontrado" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const aptTenantId = String((apt as any).tenant_id);

  // Validate access: staff must belong to tenant, patient must be linked to the appointment's client
  if (role === "staff") {
    const { data: staffProfile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staffProfile || String(staffProfile.tenant_id) !== aptTenantId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  } else {
    // Patient: validate via patient_profiles link
    const aptClientId = (apt as any).client_id;
    const { data: patientLink } = await supabaseAdmin
      .from("patient_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", aptTenantId)
      .eq("client_id", aptClientId)
      .eq("is_active", true)
      .maybeSingle();

    if (!patientLink) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  if ((apt as any).telemedicine !== true) {
    return new Response(JSON.stringify({ error: "Este agendamento não é teleconsulta" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const baseRoomName = `tenant-${aptTenantId}-appointment-${appointmentId}`;
  const roomName = sanitizeRoomName(baseRoomName);
  const identity = sanitizeRoomName(`${role}-${user.id}`);

  try {
    const token = await createTwilioAccessToken({
      accountSid,
      apiKeySid,
      apiKeySecret,
      identity,
      roomName,
      ttlSeconds,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return new Response(
      JSON.stringify({
        token,
        room_name: roomName,
        identity,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("TWILIO: erro ao gerar token", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({ error: "Erro ao gerar token" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
