/**
 * twilio-video-token — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
const log = createLogger("TWILIO-VIDEO-TOKEN");

type Role = "staff" | "patient";

type Body = {
  appointment_id: string;
  role?: Role;
  public_token?: string; // UUID token for unauthenticated patient access
  device_fingerprint?: string; // Client-side device fingerprint for rate limiting
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
    ["sign"]);
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
// Supports 3 auth paths:
// 1. Authenticated staff (JWT + role=staff) — validated via profiles table
// 2. Authenticated patient (JWT + role=patient) — validated via patient_profiles table
// 3. Public token (no JWT, public_token in body) — validated via telemedicine_token column

export async function twilioVideoToken(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      let body: Body;
      try {
        body = (req.body) as Body;
      } catch {
        return res.status(400).json({ error: "Corpo da requisição inválido" });
      }

      const appointmentId = toTrimmedString(body.appointment_id, 80);
      const role: Role = body.role === "patient" ? "patient" : "staff";
      const publicToken = toTrimmedString(body.public_token, 80);
      const deviceFingerprint = toTrimmedString(body.device_fingerprint, 64);
      const isPublicAccess = !!publicToken && role === "patient";

      if (!appointmentId && !isPublicAccess) {
        return res.status(400).json({ error: "appointment_id é obrigatório" });
      }

      // --- Rate limit: scoped by user/token + appointment + device fingerprint ---
      const fpSuffix = deviceFingerprint ? `:fp:${deviceFingerprint}` : "";
      const rateLimitKey = isPublicAccess
        ? `twilio-pub:${publicToken}:apt:${appointmentId || "tok"}${fpSuffix}`
        : `twilio-auth:unknown`;

      let userId = "anonymous";

      if (!isPublicAccess) {
        // Authenticated path: validate JWT
        const authResult = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); return authAdmin.getUser(token); })();
        if (authResult.error) return authResult.error;
        userId = authResult.data?.user?.id || 'anonymous';
      }

      const rl = await checkRateLimit(
        isPublicAccess ? rateLimitKey : `twilio-auth:${userId}:apt:${appointmentId}${fpSuffix}`,
        10,
        60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
      }

      // --- Twilio credentials ---
      const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
      const apiKeySid = process.env.TWILIO_API_KEY_SID ?? "";
      const apiKeySecret = process.env.TWILIO_API_KEY_SECRET ?? "";

      if (!accountSid || !apiKeySid || !apiKeySecret) {
        return res.status(500).json({
            error: "Configuração do servidor incompleta",
            details: "Missing TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID or TWILIO_API_KEY_SECRET",
          });
      }

      const ttlSecondsRaw = process.env.TWILIO_TOKEN_TTL_SECONDS;
      const ttlSeconds = Math.min(60 * 60 * 6, Math.max(60, Number(ttlSecondsRaw ?? 60 * 60)));
      // --- Fetch and validate appointment ---
      let apt: any = null;

      if (isPublicAccess) {
        // Public token path: find appointment by telemedicine_token
        const { data, error: aptError } = await db.from("appointments")
          .select("id, tenant_id, client_id, telemedicine, telemedicine_token, status")
          .eq("telemedicine_token", publicToken)
          .eq("telemedicine", true)
          .maybeSingle();

        if (aptError) {
          log("DB: erro ao buscar appointment por token", { message: aptError.message });
          return res.status(500).json({ error: "Erro ao validar agendamento" });
        }

        if (!data) {
          return res.status(404).json({ error: "Link inválido ou expirado" });
        }

        if (!["pending", "confirmed"].includes(data.status)) {
          return res.status(400).json({ error: "Esta teleconsulta já foi encerrada" });
        }

        apt = data;
      } else {
        // Authenticated path: find appointment by ID
        const { data, error: aptError } = await db.from("appointments")
          .select("id, tenant_id, client_id, telemedicine")
          .eq("id", appointmentId)
          .maybeSingle();

        if (aptError) {
          log("DB: erro ao buscar appointment", { message: aptError.message });
          return res.status(500).json({ error: "Erro ao validar agendamento" });
        }

        if (!data) {
          return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        apt = data;
      }

      const aptTenantId = String(apt.tenant_id);

      // --- Authorization ---
      if (!isPublicAccess) {
        if (role === "staff") {
          const { data: staffProfile } = await db.from("profiles")
            .select("tenant_id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!staffProfile || String(staffProfile.tenant_id) !== aptTenantId) {
            return res.status(403).json({ error: "Não autorizado" });
          }
        } else {
          // Authenticated patient: validate via patient_profiles
          const { data: patientLink } = await db.from("patient_profiles")
            .select("id")
            .eq("user_id", userId)
            .eq("tenant_id", aptTenantId)
            .eq("client_id", apt.client_id)
            .eq("is_active", true)
            .maybeSingle();

          if (!patientLink) {
            return res.status(403).json({ error: "Não autorizado" });
          }
        }
      }
      // Public token access is already validated by finding the appointment via telemedicine_token

      if (apt.telemedicine !== true) {
        return res.status(400).json({ error: "Este agendamento não é teleconsulta" });
      }

      // --- Generate Twilio token ---
      const resolvedAppointmentId = apt.uid;
      const baseRoomName = `tenant-${aptTenantId}-appointment-${resolvedAppointmentId}`;
      const roomName = sanitizeRoomName(baseRoomName);
      const identity = isPublicAccess
        ? sanitizeRoomName(`patient-public-${publicToken.slice(0, 8)}`)
        : sanitizeRoomName(`${role}-${userId}`);

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

        return res.status(200).json({ token, room_name: roomName, identity, expires_at: expiresAt });
      } catch (error: any) {
        log("TWILIO: erro ao gerar token", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return res.status(500).json({ error: "Erro ao gerar token" });
      }
  } catch (err: any) {
    console.error(`[twilio-video-token] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
