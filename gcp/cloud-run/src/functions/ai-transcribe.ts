/**
 * ai-transcribe — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkAiAccess, logAiUsage } from '../shared/planGating';
import { transcribeAudio } from '../shared/transcribe';
import { checkAiRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
interface TranscribeRequest {
  action: "transcribe" | "start" | "status";
  // For "transcribe" / "start" action
  audio_base64?: string;
  file_name?: string;
  content_type?: string;
  specialty?: string;
  audio_meta?: {
    avg_energy?: number;
    duration_ms?: number;
    sample_rate?: number;
    is_bluetooth?: boolean;
    track_label?: string;
    blob_size?: number;
    mime_type?: string;
  };
  // Legacy "status" action (kept for backward compat, returns immediately)
  job_name?: string;
}

export async function aiTranscribe(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    const authHeader = (req.headers['authorization'] as string);
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

        const authRes = (await authAdmin.getUser((authHeader || '').replace('Bearer ', '')) as any);


        const authError = authRes.error;


        const user = authRes.data?.user;
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Rate limiting: transcription category (5 req/min)
    const rl = await checkAiRateLimit(user.id, "ai-transcribe", "transcription");
    if (!rl.allowed) {
      return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }

    // Admin client for data queries (bypasses RLS after manual auth checks)
    // Check medical role
    const { data: profile } = await db.from("profiles")
      .select("professional_type, tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data: userRole } = await db.from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    const clinicalRoles = ["medico", "dentista", "enfermeiro", "tec_enfermagem", "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo", "esteticista", "admin"];
    const isAdmin = userRole?.role === "admin";
    const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
    if (!isAdmin && !hasClinicalRole) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Plan gating
    const aiAccess = await checkAiAccess(profile.tenant_id, user.id, "transcribe");
    if (!aiAccess.allowed) {
      return res.status(403).json({ error: aiAccess.reason });
    }

    const body: TranscribeRequest = req.body;
    const { action } = body;

    // ── Primary path: synchronous transcription via Vertex AI ──
    if (action === "transcribe" || action === "start") {
      const { audio_base64, file_name, content_type, specialty, audio_meta } = body;

      if (!audio_base64 || !content_type) {
        return res.status(400).json({ error: "audio_base64 and content_type are required" });
      }

      // Limite de tamanho: 10 MB em base64 (~7.5 MB de áudio real)
      const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
      if (audio_base64.length > MAX_AUDIO_SIZE) {
        return res.status(400).json({ error: "Áudio muito grande. Máximo: ~7.5 MB." });
      }

      if (audio_meta) {
        console.log(
          `[ai-transcribe] audio_meta: sr=${audio_meta.sample_rate ?? 0}, ` +
            `energy=${audio_meta.avg_energy ?? 0}, duration_ms=${audio_meta.duration_ms ?? 0}, ` +
            `is_bt=${audio_meta.is_bluetooth ? "yes" : "no"}, blob=${audio_meta.blob_size ?? 0}, ` +
            `mime=${audio_meta.mime_type ?? content_type}, track="${audio_meta.track_label ?? ""}"`
        );
      }

      // Synchronous transcription via Google Cloud Speech-to-Text V2 (Chirp)
      const result = await transcribeAudio(
        audio_base64,
        content_type || "audio/webm");

      // Log transcription in DB for analytics
      const jobName = `vertex-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await db.from("transcription_jobs").insert({
        job_name: jobName,
        user_id: user.id,
        tenant_id: profile.tenant_id,
        status: "COMPLETED",
        transcript: result.transcript,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).then(() => {}, () => {}); // fire-and-forget, don't block response

      logAiUsage(profile.tenant_id, user.id, "transcribe").catch(() => {});

      return res.status(200).json({
        status: "COMPLETED",
        transcript: result.transcript,
        confidence: result.confidence,
        duration_seconds: 0,
        is_hallucination: result.isHallucination,
      });
    }

    // ── Legacy "status" action — returns completed for any existing job ──
    if (action === "status") {
      const { job_name } = body;

      if (!job_name) {
        return res.status(400).json({ error: "job_name is required" });
      }

      const { data: job } = await db.from("transcription_jobs")
        .select("*")
        .eq("job_name", job_name)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      return res.status(200).json({
        status: job.status,
        transcript: job.transcript,
        error: job.error_message,
      });
    }

    return res.status(400).json({ error: "Invalid action. Use 'transcribe' or 'start'" });
  } catch (err: any) {
    console.error(`[ai-transcribe] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
