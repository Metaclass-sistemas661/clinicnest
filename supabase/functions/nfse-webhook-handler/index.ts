import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NFEioWebhookPayload {
  event: string;
  data: {
    id: string;
    companyId: string;
    flowStatus: string;
    status: string;
    number?: string;
    checkCode?: string;
    rpsNumber?: number;
    rpsSerialNumber?: string;
    issuedOn?: string;
    cancelledOn?: string;
    flowMessage?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NFEioWebhookPayload = await req.json();
    console.log("[nfse-webhook] Received:", JSON.stringify(payload));

    const { event, data } = payload;

    if (!data?.id) {
      return new Response(
        JSON.stringify({ error: "Missing invoice ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map NFE.io status to our status
    let nfeioStatus = "pending";
    if (event === "ServiceInvoiceIssued" || data.status === "Issued") {
      nfeioStatus = "issued";
    } else if (event === "ServiceInvoiceCancelled" || data.status === "Cancelled") {
      nfeioStatus = "cancelled";
    } else if (event === "ServiceInvoiceIssueFailed" || data.status === "Error") {
      nfeioStatus = "error";
    }

    // Update the invoice record
    const updateData: Record<string, unknown> = {
      nfeio_status: nfeioStatus,
      updated_at: new Date().toISOString(),
    };

    if (data.number) updateData.number = data.number;
    if (data.checkCode) updateData.check_code = data.checkCode;
    if (data.rpsNumber) updateData.rps_number = data.rpsNumber;
    if (data.rpsSerialNumber) updateData.rps_serial = data.rpsSerialNumber;
    if (data.issuedOn) updateData.issued_at = data.issuedOn;
    if (data.cancelledOn) updateData.cancelled_at = data.cancelledOn;
    if (data.flowMessage && nfeioStatus === "error") {
      updateData.error_message = data.flowMessage;
    }

    const { error: updateError } = await supabase
      .from("nfse_invoices")
      .update(updateData)
      .eq("nfeio_invoice_id", data.id);

    if (updateError) {
      console.error("[nfse-webhook] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nfse-webhook] Invoice ${data.id} updated to status: ${nfeioStatus}`);

    return new Response(
      JSON.stringify({ success: true, status: nfeioStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[nfse-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
