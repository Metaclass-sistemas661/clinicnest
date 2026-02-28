import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  transcribeAudio,
  getMedicalTranscriptionJob,
} from "../_shared/transcribe-client.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiAccess, logAiUsage } from "../_shared/planGating.ts";

interface TranscribeRequest {
  action: "start" | "status";
  // For "start" action
  audio_base64?: string;
  file_name?: string;
  content_type?: string;
  specialty?: "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY";
  // For "status" action
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

    // Rate limiting: 5 requests per minute per user (transcription is expensive)
    const rl = await checkRateLimit(`ai-transcribe:${user.id}`, 5, 60);
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

    const allowedRoles = ["medico", "dentista", "enfermeiro", "admin"];
    if (!profile || !allowedRoles.includes(profile.professional_type)) {
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

    if (action === "start") {
      const { audio_base64, file_name, content_type, specialty } = body;

      if (!audio_base64 || !file_name || !content_type) {
        return new Response(
          JSON.stringify({ error: "audio_base64, file_name, and content_type are required" }),
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

      // Decode base64 audio
      const binaryString = atob(audio_base64);
      const audioData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioData[i] = binaryString.charCodeAt(i);
      }

      // Generate unique file name with tenant prefix
      const uniqueFileName = `${profile.tenant_id}/${Date.now()}-${file_name}`;

      // Start transcription
      const result = await transcribeAudio(
        audioData,
        uniqueFileName,
        content_type,
        specialty || "PRIMARYCARE"
      );

      // Store job reference in database for tracking
      await supabaseClient.from("transcription_jobs").insert({
        job_name: result.jobName,
        s3_uri: result.s3Uri,
        user_id: user.id,
        tenant_id: profile.tenant_id,
        status: "IN_PROGRESS",
        created_at: new Date().toISOString(),
      });

      console.log(`[ai-transcribe] Started job: ${result.jobName} for user: ${user.id}`);
      logAiUsage(profile.tenant_id, user.id, "transcribe").catch(() => {});

      return new Response(
        JSON.stringify({
          job_name: result.jobName,
          status: "IN_PROGRESS",
          message: "Transcrição iniciada. Use o job_name para verificar o status.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "status") {
      const { job_name } = body;

      if (!job_name) {
        return new Response(JSON.stringify({ error: "job_name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify job belongs to user's tenant
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

      // Get status from AWS
      const result = await getMedicalTranscriptionJob(job_name);

      // Update local status
      if (result.status !== job.status) {
        await supabaseClient
          .from("transcription_jobs")
          .update({
            status: result.status,
            transcript: result.transcript,
            error: result.error,
            completed_at: result.status === "COMPLETED" ? new Date().toISOString() : null,
          })
          .eq("job_name", job_name);
      }

      console.log(`[ai-transcribe] Status check: ${job_name} = ${result.status}`);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'start' or 'status'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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
