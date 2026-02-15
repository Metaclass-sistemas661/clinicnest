import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const logStep = createLogger("CHECK-SUBSCRIPTION");

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUser(req, cors);
  if (authResult.error) return authResult.error;
  const user = authResult.user;

  try {
    logStep("Function started");

    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const rl = await checkRateLimit(`check-sub:${user.id}`, 30, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Get subscription from database first
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profileData?.tenant_id) {
      logStep("No tenant found for user");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        trialing: false,
        trial_expired: false,
        days_remaining: 0 
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: subscriptionData } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", profileData.tenant_id)
      .single();

    logStep("Subscription data from DB", subscriptionData);

    // Check trial status
    const now = new Date();
    const trialEnd = subscriptionData?.trial_end ? new Date(subscriptionData.trial_end) : null;
    const periodEnd = subscriptionData?.current_period_end ? new Date(subscriptionData.current_period_end) : null;
    const isTrialing = subscriptionData?.status === 'trialing';
    const isActive = subscriptionData?.status === 'active';
    const trialExpired = trialEnd ? now > trialEnd : false;
    const daysRemaining = trialEnd 
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const periodNotExpired = periodEnd ? now <= periodEnd : false;
    const subscribed = Boolean(isActive && periodNotExpired);
    const hasAccess = subscribed || (isTrialing && !trialExpired);

    logStep("Access check complete", {
      subscribed,
      isTrialing,
      trialExpired,
      daysRemaining,
      hasAccess,
    });

    return new Response(JSON.stringify({
      subscribed,
      trialing: isTrialing && !trialExpired,
      trial_expired: isTrialing && trialExpired,
      days_remaining: daysRemaining,
      plan: subscriptionData?.plan ?? null,
      subscription_end: periodEnd?.toISOString() ?? null,
      has_access: hasAccess,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
