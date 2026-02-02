import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// VynloBella pricing plans mapping
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_TuB7bc1lxNBAoz": "monthly",
  "prod_TuB8arh8d4qyt2": "quarterly",
  "prod_TuB88hjDHGS60T": "annual",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get subscription from database first
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profileData?.tenant_id) {
      logStep("No tenant found for user");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        trialing: false,
        trial_expired: false,
        days_remaining: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: subscriptionData } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', profileData.tenant_id)
      .single();

    logStep("Subscription data from DB", subscriptionData);

    // Check trial status
    const now = new Date();
    const trialEnd = subscriptionData?.trial_end ? new Date(subscriptionData.trial_end) : null;
    const isTrialing = subscriptionData?.status === 'trialing';
    const trialExpired = trialEnd ? now > trialEnd : false;
    const daysRemaining = trialEnd 
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Check Stripe for active subscription
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    let hasActiveSubscription = false;
    let planKey = null;
    let subscriptionEnd = null;
    let stripeCustomerId = null;
    let stripeSubscriptionId = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      stripeCustomerId = customerId;
      logStep("Found Stripe customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        hasActiveSubscription = true;
        const subscription = subscriptions.data[0];
        stripeSubscriptionId = subscription.id;
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        
        const productId = subscription.items.data[0].price.product as string;
        planKey = PRODUCT_TO_PLAN[productId] || null;
        logStep("Active subscription found", { subscriptionId: subscription.id, productId, planKey });

        // Update subscription in database
        await supabaseClient
          .from('subscriptions')
          .update({
            status: 'active',
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan: planKey,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: subscriptionEnd,
          })
          .eq('tenant_id', profileData.tenant_id);
      }
    }

    // Determine access
    const hasAccess = hasActiveSubscription || (isTrialing && !trialExpired);

    logStep("Access check complete", {
      hasActiveSubscription,
      isTrialing,
      trialExpired,
      daysRemaining,
      hasAccess,
    });

    return new Response(JSON.stringify({
      subscribed: hasActiveSubscription,
      trialing: isTrialing && !trialExpired,
      trial_expired: isTrialing && trialExpired,
      days_remaining: daysRemaining,
      plan: planKey,
      subscription_end: subscriptionEnd,
      has_access: hasAccess,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
