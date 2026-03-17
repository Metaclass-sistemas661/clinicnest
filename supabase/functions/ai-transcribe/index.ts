import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  transcribeAudioBase64,
  type MedicalSpecialty,
} from "../_shared/vertex-transcribe-client.ts";
import { checkAiRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiAccess, logAiUsage } from "../_shared/planGating.ts";

interface TranscribeRequest {
  action: "transcribe" | "start" | "status";
  // For "transcribe" / "start" action
  audio_base64?: string;
  file_name?: string;
  content_type?: string;
  specialty?: MedicalSpecialty;
  // Legacy "status" action (kept for backward compat, returns immediately)
  job_name?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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

    // Rate limiting: transcription category (5 req/min)
    const rl = await checkAiRateLimit(user.id, "ai-transcribe", "transcription");
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
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("is_admin")
      .eq("user_id", user.id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    const clinicalRoles = ["medico", "dentista", "enfermeiro", "tec_enfermagem", "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo", "admin"];
    const isAdmin = userRole?.is_admin === true;
    const hasClinicalRole = clinicalRoles.includes(profile.professional_type ?? "");
    if (!isAdmin && !hasClinicalRole) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plan gating
    const aiAccess = await checkAiAccess(profile.tenant_id, user.id, "transcribe");
    if (!aiAccess.allowed) {
      return new Response(JSON.stringify({ error: aiAccess.reason }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TranscribeRequest = await req.json();
    const { action } = body;

    // ── Primary path: synchronous transcription via Vertex AI ──
    if (action === "transcribe" || action === "start") {
      const { audio_base64, file_name, content_type, specialty } = body;

      if (!audio_base64 || !content_type) {
        return new Response(
          JSON.stringify({ error: "audio_base64 and content_type are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Limite de tamanho: 10 MB em base64 (~7.5 MB de áudio real)
      const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
      if (audio_base64.length > MAX_AUDIO_SIZE) {
        return new Response(
          JSON.stringify({ error: "Áudio muito grande. Máximo: ~7.5 MB." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Synchronous transcription via Google Cloud Speech-to-Text V2 (Chirp)
      const result = await transcribeAudioBase64(
        audio_base64,
        content_type || "audio/webm",
        specialty || "PRIMARYCARE",
      );

      // Log transcription in DB for analytics
      const jobName = `vertex-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      await supabaseClient.from("transcription_jobs").insert({
        job_name: jobName,
        user_id: user.id,
        tenant_id: profile.tenant_id,
        status: "COMPLETED",
        transcript: result.transcript,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).then(() => {}, () => {}); // fire-and-forget, don't block response

      console.log(
        `[ai-transcribe] Vertex AI transcription complete for user: ${user.id}, ` +
        `${result.durationSeconds.toFixed(1)}s audio, ${result.transcript.length} chars`
      );
      logAiUsage(profile.tenant_id, user.id, "transcribe").catch(() => {});

      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          transcript: result.transcript,
          confidence: result.confidence,
          duration_seconds: result.durationSeconds,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Legacy "status" action — returns completed for any existing job ──
    if (action === "status") {
      const { job_name } = body;

      if (!job_name) {
        return new Response(JSON.stringify({ error: "job_name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job } = await supabaseClient
        .from("transcription_jobs")
        .select("*")
        .eq("job_name", job_name)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          status: job.status,
          transcript: job.transcript,
          error: job.error_message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'transcribe' or 'start'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[ai-transcribe] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
