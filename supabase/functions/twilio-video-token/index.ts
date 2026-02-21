import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

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

// --- Lightweight Twilio Access Token via Web Crypto (zero external deps) ---

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToBase64Url(str: string): string {
  return toBase64Url(new TextEncoder().encode(str));
}

async function hmacSha256Sign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toBase64Url(sig);
}

interface TwilioTokenParams {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  identity: string;
  roomName: string;
  ttlSeconds: number;
}

async function generateTwilioAccessToken(params: TwilioTokenParams): Promise<string> {
  const { accountSid, apiKeySid, apiKeySecret, identity, roomName, ttlSeconds } = params;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + ttlSeconds,
    grants: {
      identity,
      video: { room: roomName },
    },
  };

  const encodedHeader = strToBase64Url(JSON.stringify(header));
  const encodedPayload = strToBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256Sign(apiKeySecret, signingInput);

  return `${signingInput}.${signature}`;
}

// --- Main handler ---

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

  const auth = await getAuthenticatedUserWithTenant(req, cors);
  if (auth.error) return auth.error;

  const { user, tenantId } = auth;

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
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const ttlSecondsRaw = Deno.env.get("TWILIO_TOKEN_TTL_SECONDS");
  const ttlSeconds = Math.min(60 * 60 * 6, Math.max(60, Number(ttlSecondsRaw ?? 60 * 60)));

  const supabaseAdmin = createSupabaseAdmin();

  const { data: apt, error: aptError } = await supabaseAdmin
    .from("appointments")
    .select("id, tenant_id, telemedicine")
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

  if (String((apt as any).tenant_id) !== String(tenantId)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if ((apt as any).telemedicine !== true) {
    return new Response(JSON.stringify({ error: "Este agendamento não é teleconsulta" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const baseRoomName = `tenant-${tenantId}-appointment-${appointmentId}`;
  const roomName = sanitizeRoomName(baseRoomName);
  const identity = sanitizeRoomName(`${role}-${user.id}`);

  try {
    const token = await generateTwilioAccessToken({
      accountSid,
      apiKeySid,
      apiKeySecret,
      identity,
      roomName,
      ttlSeconds,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return new Response(
      JSON.stringify({ token, room_name: roomName, identity, expires_at: expiresAt }),
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
