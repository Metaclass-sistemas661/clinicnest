/**
 * twilio-token — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import twilio from 'twilio';
const twilioJwt = (twilio as any).jwt;
import { createAuthAdmin } from '../shared/auth-admin';
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
  // Twilio room names must be <= 128 chars and can include: a-zA-Z0-9_-/
  // We'll normalize to a conservative subset.
  return input
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 128);
}

export async function twilioToken(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      const auth = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); const r = await authAdmin.getUser(token); return { user: r.data?.user, tenant_id: (r.data?.user as any)?.user_metadata?.tenant_id }; })();
      if (!auth.user) return res.status(401).json({ error: 'Unauthorized' });

      const { user, tenant_id: tenantId } = auth;

      const rl = await checkRateLimit(`twilio-video-token:${user.id}`, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
      }

      let body: Body;
      try {
        body = (req.body) as Body;
      } catch {
        return res.status(400).json({ error: "Corpo da requisição inválido" });
      }

      const appointmentId = toTrimmedString(body.appointment_id, 80);
      const role: Role = body.role === "patient" ? "patient" : "staff";

      if (!appointmentId) {
        return res.status(400).json({ error: "appointment_id é obrigatório" });
      }

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
      // Validar que o appointment existe, pertence ao tenant e está marcado como teleconsulta.
      const { data: apt, error: aptError } = await db.from("appointments")
        .select("id, tenant_id, telemedicine")
        .eq("id", appointmentId)
        .maybeSingle();

      if (aptError) {
        log("DB: erro ao buscar appointment", { message: aptError.message });
        return res.status(500).json({ error: "Erro ao validar agendamento" });
      }

      if (!apt) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      if (String((apt as any).tenant_id) !== String(tenantId)) {
        return res.status(403).json({ error: "Não autorizado" });
      }

      if ((apt as any).telemedicine !== true) {
        return res.status(400).json({ error: "Este agendamento não é teleconsulta" });
      }

      const baseRoomName = `tenant-${tenantId}-appointment-${appointmentId}`;
      const roomName = sanitizeRoomName(baseRoomName);

      // Twilio identity should be stable and <= 128 chars.
      const identity = sanitizeRoomName(`${role}-${user.id}`);

      try {
        const AccessToken = (twilioJwt as any).AccessToken;
        const VideoGrant = (twilioJwt as any).AccessToken.VideoGrant;

        const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
          identity,
          ttl: ttlSeconds,
        });

        token.addGrant(new VideoGrant({ room: roomName }));

        const jwt = token.toJwt();
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        return res.status(200).json({
            token: jwt,
            room_name: roomName,
            identity,
            expires_at: expiresAt,
          });
      } catch (error: any) {
        log("TWILIO: erro ao gerar token", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return res.status(500).json({ error: "Erro ao gerar token" });
      }
  } catch (err: any) {
    console.error(`[twilio-token] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
