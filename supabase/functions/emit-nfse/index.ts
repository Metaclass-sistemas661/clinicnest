import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NFEIO_API_URL = "https://api.nfe.io/v1";

interface EmitNFSeRequest {
  tenant_id: string;
  payment_id?: string;
  client_id: string;
  description: string;
  amount: number;
  service_code?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EmitNFSeRequest = await req.json();
    const { tenant_id, payment_id, client_id, description, amount, service_code } = body;

    if (!tenant_id || !client_id || !description || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, client_id, description, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant NFE.io config
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("nfeio_api_key, nfeio_company_id, nfeio_active, nfeio_default_service_code")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.nfeio_active || !tenant.nfeio_api_key || !tenant.nfeio_company_id) {
      return new Response(
        JSON.stringify({ error: "NFE.io integration not configured for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, cpf, email, phone, address, city, state, zip_code")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build NFS-e payload for NFE.io
    const nfsePayload = {
      borrower: {
        name: client.name,
        federalTaxNumber: client.cpf?.replace(/\D/g, ""),
        email: client.email,
        address: client.address ? {
          country: "BRA",
          postalCode: client.zip_code?.replace(/\D/g, ""),
          street: client.address,
          district: "",
          city: {
            name: client.city,
          },
          state: client.state,
        } : undefined,
      },
      cityServiceCode: service_code || tenant.nfeio_default_service_code || "4.03",
      description: description,
      servicesAmount: amount,
      taxationType: "WithinCity",
    };

    // Call NFE.io API to emit NFS-e
    const nfeioResponse = await fetch(
      `${NFEIO_API_URL}/companies/${tenant.nfeio_company_id}/serviceinvoices`,
      {
        method: "POST",
        headers: {
          "Authorization": tenant.nfeio_api_key,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(nfsePayload),
      }
    );

    const nfeioData = await nfeioResponse.json();

    if (!nfeioResponse.ok) {
      console.error("[emit-nfse] NFE.io error:", nfeioData);
      return new Response(
        JSON.stringify({ 
          error: "NFE.io API error", 
          details: nfeioData.message || nfeioData 
        }),
        { status: nfeioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoice = nfeioData.serviceInvoice;

    // Save invoice record
    const { data: savedInvoice, error: saveError } = await supabase
      .from("nfse_invoices")
      .insert({
        tenant_id,
        nfeio_invoice_id: invoice.id,
        nfeio_status: invoice.status?.toLowerCase() || "pending",
        number: invoice.number,
        check_code: invoice.checkCode,
        rps_number: invoice.rpsNumber,
        rps_serial: invoice.rpsSerialNumber,
        borrower_name: client.name,
        borrower_document: client.cpf,
        borrower_email: client.email,
        service_code: service_code || tenant.nfeio_default_service_code || "4.03",
        description,
        services_amount: amount,
        iss_rate: invoice.issRate,
        iss_amount: invoice.issTaxAmount,
        total_amount: invoice.totalAmount || amount,
        payment_id: payment_id || null,
        client_id,
        issued_at: invoice.issuedOn,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[emit-nfse] Save error:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice: {
          id: savedInvoice?.id || invoice.id,
          nfeio_id: invoice.id,
          status: invoice.status,
          number: invoice.number,
          check_code: invoice.checkCode,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[emit-nfse] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
