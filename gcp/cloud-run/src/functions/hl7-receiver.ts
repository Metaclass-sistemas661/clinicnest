/**
 * hl7-receiver — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createDbClient } from '../shared/db-builder';

// HL7 Delimiters
const HL7_DELIMITERS = {
  FIELD: '|',
  COMPONENT: '^',
  REPETITION: '~',
  ESCAPE: '\\',
  SUBCOMPONENT: '&',
};

interface HL7Segment {
  name: string;
  fields: string[];
}

interface HL7Message {
  raw: string;
  segments: HL7Segment[];
  messageType: string;
  messageControlId: string;
  version: string;
  sendingApplication?: string;
  sendingFacility?: string;
  dateTime: string;
}

interface HL7Patient {
  id: string;
  name: string;
  birthDate?: string;
  gender?: string;
  cpf?: string;
}

interface HL7Result {
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  abnormalFlag?: string;
  status: string;
  observationDateTime: string;
}

// Parse HL7 message
function parseHL7Message(raw: string): HL7Message {
  const lines = raw.trim().split(/\r?\n|\r/);
  const segments: HL7Segment[] = [];

  for (const line of lines) {
    if (line.trim()) {
      const name = line.substring(0, 3);
      const rest = line.substring(4);
      const fields = name === 'MSH'
        ? ['|', rest.substring(0, 4), ...rest.substring(5).split('|')]
        : rest.split('|');
      segments.push({ name, fields });
    }
  }

  const msh = segments.find(s => s.name === 'MSH');
  if (!msh) {
    throw new Error('Invalid HL7 message: MSH segment not found');
  }

  return {
    raw,
    segments,
    messageType: msh.fields[8] || '',
    messageControlId: msh.fields[9] || '',
    version: msh.fields[11] || '2.5',
    sendingApplication: msh.fields[2] || '',
    sendingFacility: msh.fields[3] || '',
    dateTime: msh.fields[6] || '',
  };
}

// Parse patient from PID segment
function parsePatient(segments: HL7Segment[]): HL7Patient {
  const pid = segments.find(s => s.name === 'PID');
  if (!pid) {
    return { id: '', name: 'Unknown' };
  }

  const patientId = pid.fields[3]?.split('^')[0] || '';
  const nameParts = pid.fields[5]?.split('^') || [];
  const fullName = [nameParts[1], nameParts[2], nameParts[0]].filter(Boolean).join(' ');

  const dob = pid.fields[7] || '';
  const birthDate = dob.length >= 8
    ? `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`
    : undefined;

  return {
    id: patientId,
    name: fullName || 'Unknown',
    birthDate,
    gender: pid.fields[8] || undefined,
    cpf: pid.fields[18] || pid.fields[19] || undefined,
  };
}

// Parse results from OBX segments
function parseResults(segments: HL7Segment[]): HL7Result[] {
  const obxSegments = segments.filter(s => s.name === 'OBX');

  return obxSegments.map(obx => {
    const codeParts = obx.fields[3]?.split('^') || [];
    const obsDateTime = obx.fields[14] || '';

    return {
      testCode: codeParts[0] || '',
      testName: codeParts[1] || codeParts[0] || '',
      value: obx.fields[5] || '',
      unit: obx.fields[6]?.split('^')[0] || undefined,
      referenceRange: obx.fields[7] || undefined,
      abnormalFlag: obx.fields[8] || undefined,
      status: obx.fields[11] || 'F',
      observationDateTime: obsDateTime.length >= 8
        ? `${obsDateTime.substring(0, 4)}-${obsDateTime.substring(4, 6)}-${obsDateTime.substring(6, 8)}T${obsDateTime.substring(8, 10) || '00'}:${obsDateTime.substring(10, 12) || '00'}:${obsDateTime.substring(12, 14) || '00'}`
        : new Date().toISOString(),
    };
  });
}

// Generate ACK message
function generateACK(original: HL7Message, ackCode: 'AA' | 'AE' | 'AR', errorMessage?: string): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const messageId = crypto.randomUUID().substring(0, 20);

  const lines = [
    `MSH|^~\\&|ClinicNest||${original.sendingApplication}|${original.sendingFacility}|${timestamp}||ACK|${messageId}|P|${original.version}`,
    `MSA|${ackCode}|${original.messageControlId}|${errorMessage || ''}`,
  ];

  if (ackCode !== 'AA' && errorMessage) {
    lines.push(`ERR||||E|||${errorMessage}`);
  }

  return lines.join('\r');
}

export async function hl7Receiver(req: Request, res: Response) {
  try {
    const db = createDbClient();
      try {
        // Get connection secret from header
        const secret = (req.headers['x-hl7-secret'] as string);

        // Get raw body
        const contentType = (req.headers['content-type'] as string) || "";
        let rawMessage: string;

        if (contentType.includes("application/json")) {
          const body = req.body;
          rawMessage = body.message || body.hl7 || body.data;
        } else {
          rawMessage = await (req as any).text();
        }

        if (!rawMessage) {
          return res.status(400).json({ error: "No HL7 message provided" });
        }

        // Parse HL7 message
        let message: HL7Message;
        try {
          message = parseHL7Message(rawMessage);
        } catch (e: any) {
          return res.status(400).json({ error: `Parse error: ${(e as any).message}` });
        }

        // Create database client
                // Find connection by secret
        let connectionId: string | null = null;
        let tenantId: string | null = null;

        if (secret) {
          const { data: connection } = await db.from("hl7_connections")
            .select("id, tenant_id")
            .eq("webhook_secret", secret)
            .eq("is_active", true)
            .single();

          if (connection) {
            connectionId = connection.uid;
            tenantId = connection.tenant_id;
          }
        }

        // If no connection found by secret, try to find by sending application
        // Only allow fallback if a valid secret was provided (prevents unauthenticated access)
        if (!tenantId && secret && message.sendingApplication) {
          const { data: connection } = await db.from("hl7_connections")
            .select("id, tenant_id")
            .eq("receiving_application", message.sendingApplication)
            .eq("is_active", true)
            .single();

          if (connection) {
            connectionId = connection.uid;
            tenantId = connection.tenant_id;
          }
        }

        if (!tenantId) {
          const ack = generateACK(message, 'AR', 'Unknown sender - no matching connection found');
          return new Response(ack, {
            status: 401,
          });
        }

        // Parse patient and results
        const patient = parsePatient(message.segments);
        const results = parseResults(message.segments);

        // Build parsed data
        const parsedData = {
          messageType: message.messageType,
          messageControlId: message.messageControlId,
          version: message.version,
          sendingApplication: message.sendingApplication,
          sendingFacility: message.sendingFacility,
          dateTime: message.dateTime,
          patient,
          results,
        };

        // Process based on message type
        if (message.messageType.startsWith('ORU')) {
          // Lab result - process and store
          const { data: logId, error } = await db.rpc('process_hl7_lab_result', {
            p_tenant_id: tenantId,
            p_connection_id: connectionId,
            p_raw_message: rawMessage,
            p_parsed_data: parsedData,
          });

          if (error) {
            console.error('[hl7-receiver] Process error:', error);
            const ack = generateACK(message, 'AE', `Processing error: ${error.message}`);
            return new Response(ack, {
              status: 500,
            });
          }

          // Update connection last_connected_at
          await db.from("hl7_connections")
            .update({ last_connected_at: new Date().toISOString(), last_error: null })
            .eq("id", connectionId);

          const ack = generateACK(message, 'AA');
          return new Response(ack, {});

        } else if (message.messageType.startsWith('ADT')) {
          // ADT message - log only for now
          await db.from("hl7_message_log").insert({
            connection_id: connectionId,
            tenant_id: tenantId,
            direction: 'inbound',
            message_type: message.messageType,
            message_control_id: message.messageControlId,
            raw_message: rawMessage,
            parsed_data: parsedData,
            status: 'received',
          });

          const ack = generateACK(message, 'AA');
          return new Response(ack, {});

        } else {
          // Unknown message type - log and acknowledge
          await db.from("hl7_message_log").insert({
            connection_id: connectionId,
            tenant_id: tenantId,
            direction: 'inbound',
            message_type: message.messageType,
            message_control_id: message.messageControlId,
            raw_message: rawMessage,
            parsed_data: parsedData,
            status: 'received',
          });

          const ack = generateACK(message, 'AA');
          return new Response(ack, {});
        }

      } catch (error: any) {
        console.error("[hl7-receiver] Error:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
      }
  } catch (err: any) {
    console.error(`[hl7-receiver] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
