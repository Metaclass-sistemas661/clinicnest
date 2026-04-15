/**
 * hl7-sender — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
const {} = {
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

export async function hl7Sender(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
      try {
        // Verify authentication
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

        // Get user profile
        const { data: profile } = await db.from("profiles")
          .select("tenant_id, full_name")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          return res.status(404).json({ error: "Profile not found" });
        }

        const body: LabOrderRequest = req.body;
        const { connection_id, patient_id, tests, priority, notes } = body;

        if (!connection_id || !patient_id || !tests || tests.length === 0) {
          return res.status(400).json({ error: "connection_id, patient_id, and tests are required" });
        }

        // Get connection details
        const { data: connection, error: connError } = await db.from("hl7_connections")
          .select("*")
          .eq("id", connection_id)
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .single();

        if (connError || !connection) {
          return res.status(404).json({ error: "Connection not found or inactive" });
        }

        if (connection.connection_type === 'inbound') {
          return res.status(400).json({ error: "This connection is inbound-only" });
        }

        // Get patient details
        const { data: patient, error: patientError } = await db.from("clients")
          .select("id, full_name, birth_date, gender, cpf")
          .eq("id", patient_id)
          .eq("tenant_id", profile.tenant_id)
          .single();

        if (patientError || !patient) {
          return res.status(404).json({ error: "Patient not found" });
        }

        // Get tenant details
        const { data: tenant } = await db.from("tenants")
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
        const { data: logEntry, error: logError } = await db.from("hl7_message_log")
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
              body: hl7Message,
            });

            const responseText = await response.text();
            sendResult = {
              success: response.ok,
              error: response.ok ? '' : `HTTP ${response.status}`,
              response: responseText,
            };
          } catch (e: any) {
            sendResult = {
              success: false,
              error: e.message,
              response: '',
            };
          }
        }

        // Update log with result
        if (logEntry) {
          await db.from("hl7_message_log")
            .update({
              status: sendResult.success ? 'acknowledged' : 'failed',
              error_message: sendResult.error || null,
              ack_message: sendResult.response || null,
              processed_at: new Date().toISOString(),
            })
            .eq("id", logEntry.id);
        }

        // Update connection status
        await db.from("hl7_connections")
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
          { headers: { ...{}, "Content-Type": "application/json" } }
        );

      } catch (error: any) {
        console.error("[hl7-sender] Error:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
      }
  } catch (err: any) {
    console.error(`[hl7-sender] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
