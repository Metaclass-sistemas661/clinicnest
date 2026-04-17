/**
 * Generic REST proxy for database operations.
 * REST proxy — allows frontend to do .from('table').select().eq()...
 * All queries run with RLS context (user_id, tenant_id set via session vars).
 */
import { Request, Response } from 'express';

interface QueryFilter {
  column: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not_is' | 'not_in' | 'contains' | 'overlaps';
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
  orFilters?: string[];
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
  'patient_consents', 'clinical_evolutions',
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
  'financial_transactions',
]);

// Sanitize column name: only allow alphanumeric, underscore, parentheses (for aggregates), comma, space, asterisk, dot
function isSafeColumn(col: string): boolean {
  return /^[\w\s,.*()":]+$/.test(col) && col.length <= 2000;
}

// ─── PostgREST-style relation parser ──────────────────────────────
// Parses select strings like "*, patient:patients(name), profiles(full_name)"
// into flat columns + join descriptors. Supports up to 2 levels of nesting.

interface FlatJoin {
  pathAlias: string;     // dotted alias for result nesting: "patient" or "appointments.patients"
  table: string;         // actual table name
  columns: string[];     // columns to select from this join
  sqlAlias: string;      // SQL table alias
  parentSqlAlias: string; // SQL alias of parent table (or main table name)
  fkColumn: string;      // FK column in parent
  pkColumn: string;      // PK column in joined table
}

interface ParsedSelect {
  flatCols: string;
  joins: FlatJoin[];
}

function parseSelectWithJoins(raw: string, mainTable: string): ParsedSelect {
  const joins: FlatJoin[] = [];
  const flat: string[] = [];

  const parts = splitTopLevelSelect(raw);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const joinMatch = trimmed.match(/^(?:(\w+):)?(\w+)\((.+)\)$/s);
    if (joinMatch) {
      const alias = joinMatch[1] || joinMatch[2];
      const table = joinMatch[2];
      if (!isSafeIdentifier(table) || !isSafeIdentifier(alias)) continue;
      if (!ALLOWED_TABLES.has(table)) continue;

      const fkInfo = FK_OVERRIDES[mainTable]?.[table] || FK_OVERRIDES['*']?.[table];
      if (!fkInfo) continue;

      const sqlAlias = `_j_${alias}`;
      const innerParts = splitTopLevelSelect(joinMatch[3]);
      const safeCols: string[] = [];

      for (const ip of innerParts) {
        const t = ip.trim();
        if (!t) continue;

        // Check for nested joins: alias:table(cols) or table(cols)
        const nestedMatch = t.match(/^(?:(\w+):)?(\w+)\((.+)\)$/s);
        if (nestedMatch) {
          const nAlias = nestedMatch[1] || nestedMatch[2];
          const nTable = nestedMatch[2];
          if (!isSafeIdentifier(nTable) || !isSafeIdentifier(nAlias)) continue;
          if (!ALLOWED_TABLES.has(nTable)) continue;

          const nFkInfo = FK_OVERRIDES[table]?.[nTable] || FK_OVERRIDES['*']?.[nTable];
          if (!nFkInfo) continue;

          const nSqlAlias = `_j_${alias}_${nAlias}`;
          const nInnerParts = nestedMatch[3].split(',').map(s => s.trim());
          const nSafeCols: string[] = [];
          for (const nc of nInnerParts) {
            const colName = nc.replace(/^"/, '').replace(/"$/, '');
            if (isSafeIdentifier(colName)) nSafeCols.push(colName);
          }
          if (nSafeCols.length > 0) {
            joins.push({
              pathAlias: `${alias}.${nAlias}`,
              table: nTable,
              columns: nSafeCols,
              sqlAlias: nSqlAlias,
              parentSqlAlias: sqlAlias,
              fkColumn: nFkInfo.fk,
              pkColumn: nFkInfo.pk,
            });
          }
        } else {
          const colName = t.replace(/^"/, '').replace(/"$/, '');
          if (isSafeIdentifier(colName)) safeCols.push(colName);
        }
      }

      // Add the parent join (even if no direct columns, nested joins need it)
      if (safeCols.length > 0 || joins.some(j => j.parentSqlAlias === sqlAlias)) {
        joins.unshift({
          pathAlias: alias,
          table,
          columns: safeCols,
          sqlAlias,
          parentSqlAlias: `"${mainTable}"`,
          fkColumn: fkInfo.fk,
          pkColumn: fkInfo.pk,
        });
      }
    } else {
      flat.push(trimmed);
    }
  }

  return {
    flatCols: flat.length > 0 ? flat.join(', ') : '*',
    joins,
  };
}

function splitTopLevelSelect(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(s.substring(start));
  return parts;
}

/**
 * Resolve FK column: given main table and joined table, find the FK column
 * using convention (e.g., patients → patient_id) and a manual override map.
 */
const FK_OVERRIDES: Record<string, Record<string, { fk: string; pk: string }>> = {
  // table -> joined_table -> { fk column in main table, pk column in joined table }
  // profiles is special: FK is professional_id or user_id depending on context
  '*': {
    profiles: { fk: 'professional_id', pk: 'id' },
    patients: { fk: 'patient_id', pk: 'id' },
    procedures: { fk: 'procedure_id', pk: 'id' },
    specialties: { fk: 'specialty_id', pk: 'id' },
    appointments: { fk: 'appointment_id', pk: 'id' },
    tenants: { fk: 'tenant_id', pk: 'id' },
    insurance_plans: { fk: 'insurance_plan_id', pk: 'id' },
    clinic_rooms: { fk: 'room_id', pk: 'id' },
    consent_templates: { fk: 'template_id', pk: 'id' },
  },
  // Per-table overrides
  appointments: {
    patients: { fk: 'patient_id', pk: 'id' },
    profiles: { fk: 'professional_id', pk: 'id' },
    procedures: { fk: 'procedure_id', pk: 'id' },
    specialties: { fk: 'specialty_id', pk: 'id' },
  },
  referrals: {
    profiles: { fk: 'from_professional_id', pk: 'id' },
  },
  financial_transactions: {
    appointments: { fk: 'appointment_id', pk: 'id' },
  },
};

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

function buildFilterClause(filters: QueryFilter[], params: any[], startIdx: number, tablePrefix?: string): { clause: string; nextIdx: number } {
  const clauses: string[] = [];
  let idx = startIdx;
  const colRef = (col: string) => tablePrefix ? `${tablePrefix}."${col}"` : `"${col}"`;

  for (const f of filters) {
    if (!isSafeIdentifier(f.column)) continue;

    switch (f.op) {
      case 'eq':
        clauses.push(`${colRef(f.column)} = $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'neq':
        clauses.push(`${colRef(f.column)} != $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'gt':
        clauses.push(`${colRef(f.column)} > $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'gte':
        clauses.push(`${colRef(f.column)} >= $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'lt':
        clauses.push(`${colRef(f.column)} < $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'lte':
        clauses.push(`${colRef(f.column)} <= $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'like':
        clauses.push(`${colRef(f.column)} LIKE $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'ilike':
        clauses.push(`${colRef(f.column)} ILIKE $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'in':
        if (Array.isArray(f.value) && f.value.length > 0) {
          const placeholders = f.value.map(() => `$${idx++}`);
          clauses.push(`${colRef(f.column)} IN (${placeholders.join(',')})`);
          params.push(...f.value);
        }
        break;
      case 'is':
        if (f.value === null) {
          clauses.push(`${colRef(f.column)} IS NULL`);
        } else {
          clauses.push(`${colRef(f.column)} IS NOT NULL`);
        }
        break;
      case 'not_is':
        if (f.value === null) {
          clauses.push(`${colRef(f.column)} IS NOT NULL`);
        } else {
          clauses.push(`${colRef(f.column)} IS NULL`);
        }
        break;
      case 'not_in':
        if (typeof f.value === 'string') {
          const inner = f.value.replace(/^\(/, '').replace(/\)$/, '');
          const vals = inner.split(',').map((v: string) => v.replace(/^"|"$/g, '').trim());
          if (vals.length > 0) {
            const placeholders = vals.map(() => `$${idx++}`);
            clauses.push(`${colRef(f.column)} NOT IN (${placeholders.join(',')})`);
            params.push(...vals);
          }
        } else if (Array.isArray(f.value) && f.value.length > 0) {
          const placeholders = f.value.map(() => `$${idx++}`);
          clauses.push(`${colRef(f.column)} NOT IN (${placeholders.join(',')})`);
          params.push(...f.value);
        }
        break;
      case 'contains':
        clauses.push(`${colRef(f.column)} @> $${idx}`);
        params.push(f.value);
        idx++;
        break;
      case 'overlaps':
        clauses.push(`${colRef(f.column)} && $${idx}`);
        params.push(f.value);
        idx++;
        break;
    }
  }

  return { clause: clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '', nextIdx: idx };
}

/**
 * Parse a single PostgREST-style filter expression like "column.op.value"
 * Returns SQL fragment + params, or null if invalid.
 */
function parseOrAtom(expr: string, params: any[], idx: number, tablePrefix?: string): { sql: string; nextIdx: number } | null {
  const colRef = (col: string) => tablePrefix ? `${tablePrefix}."${col}"` : `"${col}"`;

  // Handle and(...) grouping
  const andMatch = expr.match(/^and\((.+)\)$/);
  if (andMatch) {
    const inner = splitTopLevel(andMatch[1]);
    const parts: string[] = [];
    let curIdx = idx;
    for (const part of inner) {
      const parsed = parseOrAtom(part.trim(), params, curIdx, tablePrefix);
      if (!parsed) return null;
      parts.push(parsed.sql);
      curIdx = parsed.nextIdx;
    }
    return { sql: `(${parts.join(' AND ')})`, nextIdx: curIdx };
  }

  // column.op.value
  const dotIdx = expr.indexOf('.');
  if (dotIdx < 0) return null;
  const column = expr.substring(0, dotIdx);
  if (!isSafeIdentifier(column)) return null;

  const rest = expr.substring(dotIdx + 1);
  const dotIdx2 = rest.indexOf('.');
  let op: string, value: string;
  if (dotIdx2 >= 0) {
    op = rest.substring(0, dotIdx2);
    value = rest.substring(dotIdx2 + 1);
  } else {
    op = rest;
    value = '';
  }

  switch (op) {
    case 'eq':
      params.push(value);
      return { sql: `${colRef(column)} = $${idx}`, nextIdx: idx + 1 };
    case 'neq':
      params.push(value);
      return { sql: `${colRef(column)} != $${idx}`, nextIdx: idx + 1 };
    case 'gt':
      params.push(value);
      return { sql: `${colRef(column)} > $${idx}`, nextIdx: idx + 1 };
    case 'gte':
      params.push(value);
      return { sql: `${colRef(column)} >= $${idx}`, nextIdx: idx + 1 };
    case 'lt':
      params.push(value);
      return { sql: `${colRef(column)} < $${idx}`, nextIdx: idx + 1 };
    case 'lte':
      params.push(value);
      return { sql: `${colRef(column)} <= $${idx}`, nextIdx: idx + 1 };
    case 'like':
      params.push(value);
      return { sql: `${colRef(column)} LIKE $${idx}`, nextIdx: idx + 1 };
    case 'ilike':
      params.push(value);
      return { sql: `${colRef(column)} ILIKE $${idx}`, nextIdx: idx + 1 };
    case 'is':
      if (value === 'null') return { sql: `${colRef(column)} IS NULL`, nextIdx: idx };
      if (value === 'true') return { sql: `${colRef(column)} IS TRUE`, nextIdx: idx };
      if (value === 'false') return { sql: `${colRef(column)} IS FALSE`, nextIdx: idx };
      return null;
    default:
      return null;
  }
}

/**
 * Split a PostgREST-style filter string at top-level commas,
 * respecting parentheses for and() / or() grouping.
 */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(s.substring(start));
  return parts;
}

/**
 * Parse a full PostgREST-style .or() filter string into SQL.
 * Returns OR-joined clause + updated param index.
 */
function buildOrClause(filterStr: string, params: any[], startIdx: number, tablePrefix?: string): { clause: string; nextIdx: number } | null {
  const atoms = splitTopLevel(filterStr);
  const sqlParts: string[] = [];
  let idx = startIdx;

  for (const atom of atoms) {
    const parsed = parseOrAtom(atom.trim(), params, idx, tablePrefix);
    if (!parsed) return null; // Invalid filter — skip entire .or()
    sqlParts.push(parsed.sql);
    idx = parsed.nextIdx;
  }

  if (sqlParts.length === 0) return null;
  return { clause: `(${sqlParts.join(' OR ')})`, nextIdx: idx };
}

export async function restProxy(req: Request, res: Response) {
  const q: RestQuery = req.body;

  if (!q.table || !q.operation) {
    return res.status(400).json({ error: 'Requisição inválida: tabela ou operação não informada.' });
  }

  if (!ALLOWED_TABLES.has(q.table)) {
    return res.status(403).json({ error: `Acesso negado: a tabela '${q.table}' não está disponível.` });
  }

  const db = (req as any).db;
  if (!db?.query) {
    return res.status(500).json({ error: 'Erro interno: conexão com o banco de dados indisponível.' });
  }

  try {
    switch (q.operation) {
      case 'select': {
        const rawCols = q.columns && isSafeColumn(q.columns) ? q.columns : '*';
        const { flatCols, joins } = parseSelectWithJoins(rawCols, q.table);
        const hasJoins = joins.length > 0;

        // When joins exist, qualify all column refs with main table to prevent ambiguity
        const tblPrefix = hasJoins ? `"${q.table}"` : undefined;
        const params: any[] = [];
        const { clause: where, nextIdx } = buildFilterClause(q.filters || [], params, 1, tblPrefix);

        // Append .or() filters — each becomes an AND-ed (... OR ...) group
        let orExtra = '';
        let paramIdx = nextIdx;
        if (q.orFilters?.length) {
          for (const orStr of q.orFilters) {
            const parsed = buildOrClause(orStr, params, paramIdx, tblPrefix);
            if (parsed) {
              orExtra += (where || orExtra ? ' AND ' : ' WHERE ') + parsed.clause;
              paramIdx = parsed.nextIdx;
            }
          }
        }

        // Build SELECT columns (prefix main table columns when joins exist)
        let selectExpr: string;
        let joinClause = '';

        if (hasJoins) {
          // Qualify all flat columns with main table to prevent ambiguous column refs
          if (flatCols === '*') {
            selectExpr = `"${q.table}".*`;
          } else {
            selectExpr = flatCols.split(',').map(c => {
              const t = c.trim();
              if (t === '*') return `"${q.table}".*`;
              if (isSafeIdentifier(t)) return `"${q.table}"."${t}"`;
              return t; // pass through complex expressions as-is
            }).join(', ');
          }

          // Join columns + LEFT JOIN clauses using FlatJoin descriptors
          for (const j of joins) {
            const parentRef = j.parentSqlAlias.startsWith('"')
              ? j.parentSqlAlias // already quoted main table
              : `"${j.parentSqlAlias}"`; // sql alias

            joinClause += ` LEFT JOIN "${j.table}" "${j.sqlAlias}" ON "${j.sqlAlias}"."${j.pkColumn}" = ${parentRef}."${j.fkColumn}"`;

            for (const col of j.columns) {
              selectExpr += `, "${j.sqlAlias}"."${col}" AS "${j.pathAlias}.${col}"`;
            }
          }
        } else {
          selectExpr = flatCols;
        }

        let sql = `SELECT ${selectExpr} FROM "${q.table}"${joinClause}${where}${orExtra}`;

        if (q.order?.length) {
          const orderParts = q.order
            .filter(o => isSafeIdentifier(o.column))
            .map(o => `"${q.table}"."${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`);
          if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;
        }

        if (q.limit) sql += ` LIMIT ${Math.min(Math.max(0, Math.floor(q.limit)), 5000)}`;
        if (q.offset) sql += ` OFFSET ${Math.max(0, Math.floor(q.offset))}`;

        if (process.env.NODE_ENV !== 'production') {
          console.log('[rest-proxy] SQL:', sql, '| params:', params);
        }

        const result = await db.query(sql, params);

        // Post-process: nest joined columns into sub-objects (supports multi-level nesting)
        const rows = joins.length > 0
          ? result.rows.map((row: any) => {
              const out: any = {};
              for (const [key, val] of Object.entries(row)) {
                const dotIdx = key.indexOf('.');
                if (dotIdx > 0) {
                  // key is like "patient.name" or "appointments.patients.name"
                  const segments = key.split('.');
                  let target = out;
                  for (let i = 0; i < segments.length - 1; i++) {
                    if (!target[segments[i]]) target[segments[i]] = {};
                    target = target[segments[i]];
                  }
                  target[segments[segments.length - 1]] = val;
                } else {
                  out[key] = val;
                }
              }
              // If all join columns are null, set the sub-object to null
              for (const j of joins) {
                const segments = j.pathAlias.split('.');
                let target = out;
                for (let i = 0; i < segments.length - 1; i++) {
                  if (!target[segments[i]]) break;
                  target = target[segments[i]];
                }
                const lastSeg = segments[segments.length - 1];
                if (target[lastSeg] && typeof target[lastSeg] === 'object' &&
                    Object.values(target[lastSeg]).every(v => v === null)) {
                  target[lastSeg] = null;
                }
              }
              return out;
            })
          : result.rows;

        if (q.single) {
          if (rows.length === 0) {
            return res.json({ data: null, error: { message: 'Nenhum registro encontrado.', code: 'PGRST116' } });
          }
          return res.json({ data: rows[0], error: null });
        }

        if (q.count) {
          // Use count on main table only (subquery) to avoid inflation from LEFT JOINs
          const countSql = hasJoins
            ? `SELECT COUNT(*) as total FROM "${q.table}"${where}${orExtra}`
            : `SELECT COUNT(*) as total FROM "${q.table}"${where}${orExtra}`;
          const countResult = await db.query(countSql, params);
          return res.json({ data: rows, error: null, count: parseInt(countResult.rows[0]?.total || '0') });
        }

        return res.json({ data: rows, error: null });
      }

      case 'insert': {
        if (!q.data) return res.status(400).json({ error: 'Dados obrigatórios não enviados para inserção.' });

        const rows = Array.isArray(q.data) ? q.data : [q.data];
        if (rows.length === 0) return res.status(400).json({ error: 'Nenhum registro para inserir.' });

        const columns = Object.keys(rows[0]).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'Nenhuma coluna válida para inserção.' });

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
          return res.status(400).json({ error: 'Atualização requer dados e ao menos um filtro.' });
        }

        const data = Array.isArray(q.data) ? q.data[0] : q.data;
        const columns = Object.keys(data).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'Nenhuma coluna válida para atualização.' });

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
        if (!q.data) return res.status(400).json({ error: 'Dados obrigatórios não enviados.' });

        const rows = Array.isArray(q.data) ? q.data : [q.data];
        const columns = Object.keys(rows[0]).filter(isSafeIdentifier);
        if (columns.length === 0) return res.status(400).json({ error: 'Nenhuma coluna válida.' });

        // Validate onConflict — supports single or comma-separated column names
        const conflictCols = parseOnConflict(q.onConflict || 'id');
        if (!conflictCols || conflictCols.length === 0) {
          return res.status(400).json({ error: 'Coluna de conflito (onConflict) inválida.' });
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
          return res.status(400).json({ error: 'Exclusão requer ao menos um filtro de segurança.' });
        }

        const params: any[] = [];
        const { clause: where } = buildFilterClause(q.filters, params, 1);
        const sql = `DELETE FROM "${q.table}"${where} RETURNING *`;

        const result = await db.query(sql, params);
        return res.json({ data: result.rows, error: null });
      }

      default:
        return res.status(400).json({ error: `Operação desconhecida: ${q.operation}` });
    }
  } catch (err: any) {
    // Structured error logging for production debugging (never sent to client)
    const errCode = err.code || '';
    console.error(`[rest-proxy] ${q.operation} on ${q.table}: code=${errCode} msg=${err.message}`,
      q.operation === 'select' ? `| columns=${q.columns || '*'} filters=${JSON.stringify(q.filters?.map(f => `${f.column}.${f.op}`) || [])}` : '');

    let safeMessage: string;
    const code = err.code || '';
    if (code === '23505') safeMessage = 'Registro duplicado: já existe um registro com esses dados.';
    else if (code === '23503') safeMessage = 'Não é possível completar: registro referenciado não existe.';
    else if (code === '23502') safeMessage = 'Campo obrigatório não preenchido.';
    else if (code === '23514') safeMessage = 'Valor informado fora do intervalo permitido.';
    else if (code.startsWith('23')) safeMessage = 'Violação de regra do banco de dados.';
    else if (code === '42P01') safeMessage = 'Recurso não encontrado no sistema.';
    else if (code === '42703') safeMessage = 'Campo solicitado não existe nesta tabela.';
    else if (code.startsWith('42')) safeMessage = 'Erro na consulta ao banco de dados.';
    else if (code === '42501' || code === '42000') safeMessage = 'Sem permissão para esta operação.';
    else if (code === '08006' || code === '08003') safeMessage = 'Conexão com o banco de dados perdida. Tente novamente.';
    else if (code === '57014') safeMessage = 'A consulta excedeu o tempo limite. Tente filtrar melhor.';
    else safeMessage = 'Erro interno do servidor. Tente novamente ou contate o suporte.';
    return res.status(500).json({ error: safeMessage, code: code || 'INTERNAL' });
  }
}

/**
 * Generic RPC proxy: calls a PostgreSQL function by name.
 */
export async function rpcProxy(req: Request, res: Response) {
  const name = req.params.name as string;
  const params = req.body || {};

  if (!name || !isSafeIdentifier(name)) {
    return res.status(400).json({ error: 'Nome de função inválido.' });
  }

  const db = (req as any).db;
  if (!db?.query) {
    return res.status(500).json({ error: 'Erro interno: conexão com o banco de dados indisponível.' });
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
    // Erros do PostgreSQL P0001 são RAISE EXCEPTION das nossas funções — mensagem já é em PT
    const msg = err.message || '';
    const code = err.code || '';
    let safeMessage: string;
    if (code === 'P0001') {
      // Erro de aplicação (nossas funções) — mensagem já é em português
      safeMessage = msg;
    } else if (code === '42883') {
      safeMessage = `Função '${name}' não encontrada ou parâmetros incompatíveis.`;
    } else if (code.startsWith('23')) {
      safeMessage = 'Violação de regra do banco de dados.';
    } else if (code.startsWith('42')) {
      safeMessage = 'Erro na consulta ao banco de dados.';
    } else {
      safeMessage = 'Erro interno ao executar operação. Tente novamente.';
    }
    return res.status(code === 'P0001' ? 400 : 500).json({ error: safeMessage, code: code || 'INTERNAL' });
  }
}

/**
 * Storage proxy: generate signed URLs for Cloud Storage.
 */
export async function storageProxy(req: Request, res: Response) {
  const bucket = req.params.bucket as string;
  const { operation, path: rawPath, contentType } = req.body;

  if (!bucket || !rawPath || typeof rawPath !== 'string') {
    return res.status(400).json({ error: 'Parâmetros obrigatórios não informados (bucket/path).' });
  }

  // Path traversal protection
  const normalizedPath = rawPath.replace(/\\/g, '/');
  // eslint-disable-next-line no-control-regex
  const controlCharRegex = new RegExp('[\\u0000-\\u001f]');
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/') || controlCharRegex.test(normalizedPath)) {
    return res.status(400).json({ error: 'Caminho de arquivo inválido.' });
  }

  // Validate bucket name (only alphanumeric and hyphens)
  if (!/^[a-z0-9-]+$/.test(bucket)) {
    return res.status(400).json({ error: 'Nome de bucket inválido.' });
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
        return res.status(400).json({ error: `Operação de armazenamento desconhecida: ${operation}` });
    }
  } catch (err: any) {
    console.error(`[storage-proxy] ${bucket}/${normalizedPath}:`, err.message);
    return res.status(500).json({ error: 'Erro ao acessar armazenamento de arquivos.' });
  }
}
