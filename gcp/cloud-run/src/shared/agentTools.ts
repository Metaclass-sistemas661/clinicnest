/**
 * Agent Tools — Function calling for AI agents
 * Replaces: _shared/agentTools.ts
 */
import { adminQuery } from './db';

export const PROFESSIONAL_TOOLS = [
  { name: 'search_patients', description: 'Search patients by name, CPF, or phone', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'get_today_appointments', description: 'List today appointments', parameters: { type: 'object', properties: {} } },
  { name: 'get_week_appointments', description: 'List this week appointments', parameters: { type: 'object', properties: {} } },
  { name: 'schedule_appointment', description: 'Schedule new appointment', parameters: { type: 'object', properties: { patient_id: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, service_id: { type: 'string' } }, required: ['patient_id', 'date', 'time'] } },
  { name: 'get_patient_history', description: 'Get patient medical records', parameters: { type: 'object', properties: { patient_id: { type: 'string' } }, required: ['patient_id'] } },
  { name: 'get_financial_summary', description: 'Get today/week financial summary', parameters: { type: 'object', properties: { period: { type: 'string', enum: ['today', 'week', 'month'] } } } },
  { name: 'get_pending_invoices', description: 'List pending invoices', parameters: { type: 'object', properties: {} } },
  { name: 'get_services_list', description: 'List available services/procedures', parameters: { type: 'object', properties: {} } },
  { name: 'get_products_list', description: 'List products in stock', parameters: { type: 'object', properties: {} } },
  { name: 'send_patient_message', description: 'Send message to patient', parameters: { type: 'object', properties: { patient_id: { type: 'string' }, message: { type: 'string' } }, required: ['patient_id', 'message'] } },
  { name: 'get_clinic_metrics', description: 'Get clinic dashboard metrics', parameters: { type: 'object', properties: {} } },
  { name: 'get_queue_status', description: 'Get current queue/waiting status', parameters: { type: 'object', properties: {} } },
];

export const PATIENT_TOOLS = [
  { name: 'get_my_appointments', description: 'List my upcoming appointments', parameters: { type: 'object', properties: {} } },
  { name: 'get_available_services', description: 'List services offered by clinic', parameters: { type: 'object', properties: {} } },
  { name: 'get_clinic_info', description: 'Get clinic contact and hours', parameters: { type: 'object', properties: {} } },
];

function maskCpf(cpf: string): string {
  if (!cpf) return cpf;
  return `***.***.${cpf.slice(-6, -2)}-${cpf.slice(-2)}`;
}

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  tenantId: string
): Promise<any> {
  switch (toolName) {
    case 'search_patients': {
      const result = await adminQuery(
        `SELECT id, full_name, phone, email FROM patients 
         WHERE tenant_id = $1 AND (full_name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
         LIMIT 10`,
        [tenantId, `%${args.query}%`]
      );
      return result.rows.map((r: any) => ({ ...r, cpf: r.cpf ? maskCpf(r.cpf) : null }));
    }
    case 'get_today_appointments': {
      const result = await adminQuery(
        `SELECT a.id, a.start_time, a.end_time, a.status, p.full_name as patient_name, s.name as service_name
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.tenant_id = $1 AND a.start_time::date = CURRENT_DATE
         ORDER BY a.start_time`,
        [tenantId]
      );
      return result.rows;
    }
    case 'get_financial_summary': {
      const period = args.period || 'today';
      const dateFilter = period === 'today' ? 'CURRENT_DATE' : period === 'week' ? 'CURRENT_DATE - INTERVAL \'7 days\'' : 'CURRENT_DATE - INTERVAL \'30 days\'';
      const result = await adminQuery(
        `SELECT COUNT(*) as total_payments, COALESCE(SUM(amount), 0) as total_amount
         FROM payments WHERE tenant_id = $1 AND created_at >= ${dateFilter}`,
        [tenantId]
      );
      return result.rows[0];
    }
    case 'get_services_list': {
      const result = await adminQuery(
        `SELECT id, name, price, duration_minutes FROM services WHERE tenant_id = $1 AND active = true ORDER BY name`,
        [tenantId]
      );
      return result.rows;
    }
    default:
      return { error: `Tool '${toolName}' not implemented` };
  }
}
