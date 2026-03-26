import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LabOrderRequest {
  connection_id: string;
  patient_id: string;
  tests: Array<{ code: string; name: string }>;
  priority?: 'S' | 'A' | 'R'; // Stat, ASAP, Routine
  notes?: string;
}

// Format date to HL7 format
function formatDateToHL7(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Generate HL7 ORM^O01 message
function generateLabOrder(
  patient: { id: string; name: string; birthDate?: string; gender?: string; cpf?: string },
  order: { id: string; tests: Array<{ code: string; name: string }>; priority: string },
  provider: { name: string; crm?: string },
  clinic: { name: string; cnes?: string },
  connection: { sendingApplication: string; sendingFacility: string; receivingApplication: string; receivingFacility: string; hl7Version: string }
): string {
  const now = new Date();
  const timestamp = formatDateToHL7(now);
  const messageControlId = crypto.randomUUID().substring(0, 20);
  
  const lines: string[] = [];
  
  // MSH Segment
  lines.push([
    'MSH',
    '^~\\&',
    connection.sendingApplication || 'ClinicNest',
    connection.sendingFacility || clinic.cnes || clinic.name,
    connection.receivingApplication || 'LAB',
    connection.receivingFacility || '',
    timestamp,
    '',
    'ORM^O01',
    messageControlId,
    'P',
    connection.hl7Version || '2.5',
  ].join('|'));
  
  // PID Segment
  const nameParts = patient.name.split(' ');
  const familyName = nameParts.length > 1 ? nameParts.slice(-1).join(' ') : patient.name;
  const givenName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
  const birthDateHL7 = patient.birthDate?.replace(/-/g, '') || '';
  
  lines.push([
    'PID',
    '1',
    '',
    patient.id,
    '',
    `${familyName}^${givenName}`,
    '',
    birthDateHL7,
    patient.gender || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    patient.cpf || '',
  ].join('|'));
  
  // PV1 Segment (Patient Visit)
  lines.push([
    'PV1',
    '1',
    'O', // Outpatient
    '',
    '',
    '',
    '',
    `^${provider.name}^^^^^${provider.crm || ''}`,
  ].join('|'));
  
  // ORC Segment (Common Order)
  lines.push([
    'ORC',
    'NW', // New Order
    order.id,
    '',
    '',
    '',
    '',
    `^^^${timestamp}^^${order.priority || 'R'}`,
    '',
    timestamp,
    '',
    `^${provider.name}`,
    '',
    '',
    '',
    '',
    clinic.name,
  ].join('|'));
  
  // OBR Segments (one per test)
  order.tests.forEach((test, index) => {
    lines.push([
      'OBR',
      String(index + 1),
      order.id,
      '',
      `${test.code}^${test.name}`,
      order.priority || 'R',
      timestamp,
    ].join('|'));
  });
  
  return lines.join('\r');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: LabOrderRequest = await req.json();
    const { connection_id, patient_id, tests, priority, notes } = body;

    if (!connection_id || !patient_id || !tests || tests.length === 0) {
      return new Response(
        JSON.stringify({ error: "connection_id, patient_id, and tests are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection details
    const { data: connection, error: connError } = await supabaseClient
      .from("hl7_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (connection.connection_type === 'inbound') {
      return new Response(
        JSON.stringify({ error: "This connection is inbound-only" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get patient details
    const { data: patient, error: patientError } = await supabaseClient
      .from("clients")
      .select("id, full_name, birth_date, gender, cpf")
      .eq("id", patient_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (patientError || !patient) {
      return new Response(JSON.stringify({ error: "Patient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant details
    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("name, cnes")
      .eq("id", profile.tenant_id)
      .single();

    // Generate order ID
    const orderId = `CF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Generate HL7 message
    const hl7Message = generateLabOrder(
      {
        id: patient.id,
        name: patient.full_name,
        birthDate: patient.birth_date,
        gender: patient.gender,
        cpf: patient.cpf,
      },
      {
        id: orderId,
        tests,
        priority: priority || 'R',
      },
      {
        name: profile.full_name,
      },
      {
        name: tenant?.name || 'ClinicNest',
        cnes: tenant?.cnes,
      },
      {
        sendingApplication: connection.sending_application,
        sendingFacility: connection.sending_facility,
        receivingApplication: connection.receiving_application,
        receivingFacility: connection.receiving_facility,
        hl7Version: connection.hl7_version,
      }
    );

    // Log the outbound message
    const { data: logEntry, error: logError } = await supabaseClient
      .from("hl7_message_log")
      .insert({
        connection_id: connection.id,
        tenant_id: profile.tenant_id,
        direction: 'outbound',
        message_type: 'ORM^O01',
        message_control_id: orderId,
        raw_message: hl7Message,
        parsed_data: { patient_id, tests, priority, notes },
        status: 'processing',
        patient_id: patient.id,
      })
      .select()
      .single();

    if (logError) {
      console.error('[hl7-sender] Log error:', logError);
    }

    // Send to remote endpoint if configured
    let sendResult = { success: false, error: '', response: '' };
    
    if (connection.remote_host && connection.remote_port) {
      // For TCP connections, we'd need a different approach
      // For now, we'll check if there's a webhook URL for HTTP-based labs
      sendResult = {
        success: false,
        error: 'TCP connections not supported in Edge Functions. Use webhook URL instead.',
        response: '',
      };
    } else if (connection.webhook_url) {
      // Send via HTTP POST
      try {
        const response = await fetch(connection.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'X-HL7-Secret': connection.webhook_secret || '',
          },
          body: hl7Message,
        });
        
        const responseText = await response.text();
        sendResult = {
          success: response.ok,
          error: response.ok ? '' : `HTTP ${response.status}`,
          response: responseText,
        };
      } catch (e) {
        sendResult = {
          success: false,
          error: e.message,
          response: '',
        };
      }
    }

    // Update log with result
    if (logEntry) {
      await supabaseClient
        .from("hl7_message_log")
        .update({
          status: sendResult.success ? 'acknowledged' : 'failed',
          error_message: sendResult.error || null,
          ack_message: sendResult.response || null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    // Update connection status
    await supabaseClient
      .from("hl7_connections")
      .update({
        last_connected_at: new Date().toISOString(),
        last_error: sendResult.success ? null : sendResult.error,
      })
      .eq("id", connection.id);

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        order_id: orderId,
        message_id: logEntry?.id,
        hl7_message: hl7Message,
        error: sendResult.error || undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[hl7-sender] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
