/**
 * Generic REST proxy for database operations.
 * REST proxy — allows frontend to do .from('table').select().eq()...
 * All queries run with RLS context (user_id, tenant_id set via session vars).
 */
import { Request, Response } from 'express';

interface QueryFilter {
  column: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'contains' | 'overlaps';
  value: any;
}

interface QueryOrder {
  column: string;
  ascending: boolean;
}

interface RestQuery {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns?: string;
  filters?: QueryFilter[];
  order?: QueryOrder[];
  limit?: number;
  offset?: number;
  single?: boolean;
  data?: Record<string, any> | Record<string, any>[];
  onConflict?: string;
  count?: 'exact' | 'planned' | 'estimated';
  returning?: string;
}

// Whitelist of tables the frontend may access (prevents arbitrary table access)
const ALLOWED_TABLES = new Set([
  'profiles', 'tenants', 'user_roles', 'patients', 'appointments', 'procedures',
  'medical_records', 'medical_record_versions', 'prescriptions', 'medical_certificates',
  'medical_reports', 'exam_results', 'referrals', 'specialties', 'notifications',
  'commission_rules', 'commission_payments', 'commission_disputes', 'commission_settings',
  'transactions', 'patient_invoices', 'patient_invoice_items', 'patient_payments',
  'insurance_plans', 'tiss_guides', 'tiss_glosa_appeals',
  'automations', 'automation_logs', 'contract_templates', 'contact_messages',
  'waitlist', 'clinic_rooms', 'room_occupancies', 'clinic_units',
  'triage_records', 'nursing_evolutions',
  'treatment_plans', 'treatment_plan_items',
  'dental_anamnesis', 'dental_prescriptions', 'dental_images',
  'aesthetic_sessions', 'aesthetic_protocols', 'aesthetic_areas',
  'consent_templates', 'consent_signatures', 'consent_signing_links',
  'products', 'stock_movements', 'suppliers', 'supplier_orders', 'supplier_order_items',
  'chat_channels', 'chat_messages', 'chat_participants',
  'campaigns', 'campaign_recipients',
  'goal_suggestions', 'goals', 'goal_milestones',
  'nps_responses', 'support_messages', 'support_tickets',
  'video_tutorials', 'user_video_progress',
  'report_executions', 'scheduled_reports',
  'lgpd_data_requests', 'lgpd_consent_logs',
  'hl7_connections', 'hl7_message_log',
  'rnds_certificates',
  'record_field_templates',
  'patient_packages', 'package_consumptions',
  'client_marketing_preferences',
  'audit_logs', 'access_logs',
  'subscription_plans', 'subscriptions',
  'cashback_transactions',
  'salary_payments', 'professional_salaries',
  'cash_sessions', 'cash_movements',
  'professional_working_hours', 'schedule_blocks',
  'inventory_alerts', 'purchase_orders', 'purchase_order_items',
]);

// Sanitize column name: only allow alphanumeric, underscore, parentheses (for aggregates), comma, space, asterisk, dot
function isSafeColumn(col: string): boolean {
  return /^[\w\s,.*()":]+$/.test(col) && col.length <= 2000;
}

function isSafeIdentifier(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(name) && name.length <= 128;
}

/**
 * Validate and parse onConflict — may be a single column or comma-separated.
 * Returns validated column names or null if invalid.
 */
function parseOnConflict(raw: string): string[] | null {
  const parts = raw.split(',').map(s => s.trim());
  for (const p of parts) {
    if (!isSafeIdentifier(p)) return null;
  }
  return parts;
}

function buildFilterClause(filters: QueryFilter[], params: any[], startIdx: number): { clause: string; nextIdx: number } {
  const clauses: string[] = [];
  let idx = startIdx;

  for (const f of filters) {
    if (!isSafeIdentifier(f.column)) continue;

    switch (f.op) {
      case 'eq':
        clauses.push(`"${f.column}" = $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'neq':
        clauses.push(`"${f.column}" != $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'gt':
        clauses.push(`"${f.column}" > $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'gte':
        clauses.push(`"${f.column}" >= $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'lt':
        clauses.push(`"${f.column}" < $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'lte':
        clauses.push(`"${f.column}" <= $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'like':
        clauses.push(`"${f.column}" LIKE $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'ilike':
        clauses.push(`"${f.column}" ILIKE $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'in':
        if (Array.isArray(f.value) && f.value.length > 0) {
          const placeholders = f.value.map(() => `$${idx++}`);
          clauses.push(`"${f.column}" IN (${placeholders.join(',')})`);
          params.push(...f.value);
        }
        break;
      case 'is':
        if (f.value === null) {
          clauses.push(`"${f.column}" IS NULL`);
        } else {
          clauses.push(`"${f.column}" IS NOT NULL`);
        }
        break;
      case 'contains':
        clauses.push(`"${f.column}" @> $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'overlaps':
        clauses.push(`"${f.column}" && $${idx}`);
        params.push(f.value);
        idx++;
        break;
    }
  }

  return { clause: clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '', nextIdx: idx };
}

export async function restProxy(req: Request, res: Response) {
  const q: RestQuery = req.body;

  if (!q.table || !q.operation) {
    return res.status(400).json({ error: 'Missing table or operation' });
  }

  if (!ALLOWED_TABLES.has(q.table)) {
    return res.status(403).json({ error: `Table '${q.table}' is not accessible` });
  }

  const db = (req as any).db;
  if (!db?.query) {
    return res.status(500).json({ error: 'Database context not available' });
  }

  try {
    switch (q.operation) {
      case 'select': {
        const cols = q.columns && isSafeColumn(q.columns) ? q.columns : '*';
        const params: any[] = [];
        const { clause: where } = buildFilterClause(q.filters || [], params, 1);

        let sql = `SELECT ${cols} FROM "${q.table}"${where}`;

        if (q.order?.length) {
          const orderParts = q.order
            .filter(o => isSafeIdentifier(o.column))
            .map(o => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`);
          if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;
        }

        if (q.limit) sql += ` LIMIT ${Math.min(Math.max(0, Math.floor(q.limit)), 5000)}`;
        if (q.offset) sql += ` OFFSET ${Math.max(0, Math.floor(q.offset))}`;

        const result = await db.query(sql, params);

        if (q.single) {
          if (result.rows.length === 0) {
            return res.json({ data: null, error: { message: 'No rows found', code: 'PGRST116' } });
          }
          return res.json({ data: result.rows[0], error: null });
        }

        if (q.count) {
          const countResult = await db.query(
            `SELECT COUNT(*) as total FROM "${q.table}"${where}`,
            params
          );
          return res.json({ data: result.rows, error: null, count: parseInt(countResult.rows[0]?.total || '0') });
        }

        return res.json({ data: result.rows, error: null });
      }

      case 'insert': {
        if (!q.data) return res.status(400).json({ error: 'Missing data for insert' });

        const rows = Array.isArray(q.data) ? q.data : [q.data];
        if (rows.length === 0) return res.status(400).json({ error: 'Empty data' });

        const columns = Object.keys(rows[0]).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });

        const params: any[] = [];
        const valueSets: string[] = [];
        let idx = 1;

        for (const row of rows) {
          const placeholders = columns.map(col => {
            params.push(row[col] ?? null);
            return `$${idx++}`;
          });
          valueSets.push(`(${placeholders.join(', ')})`);
        }

        const returning = q.returning && isSafeColumn(q.returning) ? q.returning : '*';
        const sql = `INSERT INTO "${q.table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} RETURNING ${returning}`;

        const result = await db.query(sql, params);

        if (q.single || !Array.isArray(q.data)) {
          return res.json({ data: result.rows[0] || null, error: null });
        }
        return res.json({ data: result.rows, error: null });
      }

      case 'update': {
        if (!q.data || !q.filters?.length) {
          return res.status(400).json({ error: 'Update requires data and at least one filter' });
        }

        const data = Array.isArray(q.data) ? q.data[0] : q.data;
        const columns = Object.keys(data).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'No valid columns for update' });

        const params: any[] = [];
        let idx = 1;

        const setClauses = columns.map(col => {
          params.push(data[col] ?? null);
          return `"${col}" = $${idx++}`;
        });

        const { clause: where } = buildFilterClause(q.filters, params, idx);
        const returning = q.returning && isSafeColumn(q.returning) ? q.returning : '*';
        const sql = `UPDATE "${q.table}" SET ${setClauses.join(', ')}${where} RETURNING ${returning}`;

        const result = await db.query(sql, params);
        return res.json({ data: result.rows, error: null });
      }

      case 'upsert': {
        if (!q.data) return res.status(400).json({ error: 'Missing data for upsert' });

        const rows = Array.isArray(q.data) ? q.data : [q.data];
        const columns = Object.keys(rows[0]).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });

        // Validate onConflict — supports single or comma-separated column names
        const conflictCols = parseOnConflict(q.onConflict || 'id');
        if (!conflictCols || conflictCols.length === 0) {
          return res.status(400).json({ error: 'Invalid onConflict column(s)' });
        }

        const params: any[] = [];
        const valueSets: string[] = [];
        let idx = 1;

        for (const row of rows) {
          const placeholders = columns.map(col => {
            params.push(row[col] ?? null);
            return `$${idx++}`;
          });
          valueSets.push(`(${placeholders.join(', ')})`);
        }

        const conflictKey = conflictCols.map(c => `"${c}"`).join(', ');
        const conflictSet = new Set(conflictCols);
        const updateCols = columns
          .filter(c => !conflictSet.has(c))
          .map(c => `"${c}" = EXCLUDED."${c}"`);

        const returning = q.returning && isSafeColumn(q.returning) ? q.returning : '*';

        let sql: string;
        if (updateCols.length > 0) {
          sql = `INSERT INTO "${q.table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} ON CONFLICT (${conflictKey}) DO UPDATE SET ${updateCols.join(', ')} RETURNING ${returning}`;
        } else {
          // All columns are conflict columns — DO NOTHING
          sql = `INSERT INTO "${q.table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} ON CONFLICT (${conflictKey}) DO NOTHING RETURNING ${returning}`;
        }

        const result = await db.query(sql, params);
        return res.json({ data: result.rows, error: null });
      }

      case 'delete': {
        if (!q.filters?.length) {
          return res.status(400).json({ error: 'Delete requires at least one filter' });
        }

        const params: any[] = [];
        const { clause: where } = buildFilterClause(q.filters, params, 1);
        const sql = `DELETE FROM "${q.table}"${where} RETURNING *`;

        const result = await db.query(sql, params);
        return res.json({ data: result.rows, error: null });
      }

      default:
        return res.status(400).json({ error: `Unknown operation: ${q.operation}` });
    }
  } catch (err: any) {
    console.error(`[rest-proxy] ${q.operation} on ${q.table}:`, err.message);
    // Don't leak internal PostgreSQL error details to the client
    const safeMessage = err.code?.startsWith?.('23')
      ? `Database constraint violation (${err.code})`
      : err.code?.startsWith?.('42')
      ? 'Invalid query syntax or missing object'
      : 'Internal server error';
    return res.status(500).json({ error: safeMessage, code: err.code || 'INTERNAL' });
  }
}

/**
 * Generic RPC proxy: calls a PostgreSQL function by name.
 */
export async function rpcProxy(req: Request, res: Response) {
  const name = req.params.name as string;
  const params = req.body || {};

  if (!name || !isSafeIdentifier(name)) {
    return res.status(400).json({ error: 'Invalid function name' });
  }

  const db = (req as any).db;
  if (!db?.query) {
    return res.status(500).json({ error: 'Database context not available' });
  }

  try {
    const paramKeys = Object.keys(params).filter(isSafeIdentifier);
    const namedArgList = paramKeys.map((k, i) => `"${k}" := $${i + 1}`).join(', ');

    const sql = paramKeys.length > 0
      ? `SELECT * FROM "${name}"(${namedArgList})`
      : `SELECT * FROM "${name}"()`;

    const values = paramKeys.map(k => params[k]);
    const result = await db.query(sql, values);

    // Always return { data, error } — never undefined
    if (result.rows.length === 0) {
      return res.json({ data: null, error: null });
    }
    if (result.rows.length === 1) {
      return res.json({ data: result.rows[0], error: null });
    }
    return res.json({ data: result.rows, error: null });
  } catch (err: any) {
    console.error(`[rpc-proxy] ${name}:`, err.message);
    return res.status(500).json({ error: err.message || 'RPC failed', code: err.code });
  }
}

/**
 * Storage proxy: generate signed URLs for Cloud Storage.
 */
export async function storageProxy(req: Request, res: Response) {
  const bucket = req.params.bucket as string;
  const { operation, path: rawPath, contentType } = req.body;

  if (!bucket || !rawPath || typeof rawPath !== 'string') {
    return res.status(400).json({ error: 'Missing bucket or path' });
  }

  // Path traversal protection
  const normalizedPath = rawPath.replace(/\\/g, '/');
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/') || /[\x00-\x1f]/.test(normalizedPath)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  // Validate bucket name (only alphanumeric and hyphens)
  if (!/^[a-z0-9-]+$/.test(bucket)) {
    return res.status(400).json({ error: 'Invalid bucket name' });
  }

  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const file = storage.bucket(`${process.env.GCP_PROJECT_ID}-${bucket}`).file(normalizedPath);

    switch (operation) {
      case 'upload': {
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + 15 * 60 * 1000,
          contentType: contentType || 'application/octet-stream',
        });
        return res.json({ data: { signedUrl: url }, error: null });
      }
      case 'download': {
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });
        return res.json({ data: { signedUrl: url }, error: null });
      }
      case 'getPublicUrl': {
        const publicUrl = `https://storage.googleapis.com/${process.env.GCP_PROJECT_ID}-${bucket}/${encodeURI(normalizedPath)}`;
        return res.json({ data: { publicUrl }, error: null });
      }
      case 'delete': {
        await file.delete({ ignoreNotFound: true });
        return res.json({ data: { deleted: true }, error: null });
      }
      default:
        return res.status(400).json({ error: `Unknown storage operation: ${operation}` });
    }
  } catch (err: any) {
    console.error(`[storage-proxy] ${bucket}/${normalizedPath}:`, err.message);
    return res.status(500).json({ error: 'Storage operation failed' });
  }
}
