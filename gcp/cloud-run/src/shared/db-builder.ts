/**
 * PostgreSQL Query Builder — compatible chainable API
 * 
 * 100% GCP — uses pg Pool from ./db.ts
 * Provides `.from().select().eq().single()` patterns that map to SQL.
 * 
 * This allows migrated functions to keep their chain-style queries
 * while running entirely on Cloud SQL PostgreSQL.
 */
import { adminQuery } from './db';

// ─── Types ────────────────────────────────────────────────────────────────
interface QueryResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains' | 'containedBy' | 'overlaps';

interface Filter {
  column: string;
  op: FilterOp;
  value: any;
  negate?: boolean;
}

interface OrderClause {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

// ─── Query Builder ────────────────────────────────────────────────────────
class PostgrestQueryBuilder {
  private _table: string;
  private _schema: string;
  private _operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _columns: string = '*';
  private _filters: Filter[] = [];
  private _orFilters: string[] = [];
  private _orders: OrderClause[] = [];
  private _limitVal?: number;
  private _offsetVal?: number;
  private _singleRow: boolean = false;
  private _maybeSingle: boolean = false;
  private _body: any;
  private _onConflict?: string;
  private _returning: string = '*';

  constructor(table: string, schema: string = 'public') {
    this._table = table;
    this._schema = schema;
  }

  // ── SELECT ──────────────────────────────────────────────────────────
  select(columns: string = '*'): this {
    this._operation = 'select';
    this._columns = columns;
    return this;
  }

  // ── INSERT ──────────────────────────────────────────────────────────
  insert(body: Record<string, any> | Record<string, any>[]): this {
    this._operation = 'insert';
    this._body = body;
    return this;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────
  update(body: Record<string, any>): this {
    this._operation = 'update';
    this._body = body;
    return this;
  }

  // ── UPSERT ──────────────────────────────────────────────────────────
  upsert(body: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): this {
    this._operation = 'upsert';
    this._body = body;
    this._onConflict = options?.onConflict ?? 'id';
    return this;
  }

  // ── DELETE ──────────────────────────────────────────────────────────
  delete(): this {
    this._operation = 'delete';
    return this;
  }

  // ── FILTERS ─────────────────────────────────────────────────────────
  eq(column: string, value: any): this {
    this._filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: any): this {
    this._filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: any): this {
    this._filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: any): this {
    this._filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: any): this {
    this._filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: any): this {
    this._filters.push({ column, op: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, op: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: null | boolean): this {
    this._filters.push({ column, op: 'is', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this._filters.push({ column, op: 'in', value: values });
    return this;
  }

  contains(column: string, value: any): this {
    this._filters.push({ column, op: 'contains', value });
    return this;
  }

  containedBy(column: string, value: any): this {
    this._filters.push({ column, op: 'containedBy', value });
    return this;
  }

  overlaps(column: string, value: any[]): this {
    this._filters.push({ column, op: 'overlaps', value });
    return this;
  }

  not(column: string, op: string, value: any): this {
    this._filters.push({ column, op: op as FilterOp, value, negate: true });
    return this;
  }

  filter(column: string, op: string, value: any): this {
    this._filters.push({ column, op: op as FilterOp, value });
    return this;
  }

  match(query: Record<string, any>): this {
    for (const [col, val] of Object.entries(query)) {
      this.eq(col, val);
    }
    return this;
  }

  or(conditions: string, opts?: { foreignTable?: string }): this {
    this._orFilters.push(conditions);
    return this;
  }

  textSearch(column: string, query: string, options?: { type?: string; config?: string }): this {
    const config = options?.config || 'portuguese';
    this._filters.push({ column, op: 'eq', value: `@@plainto_tsquery('${config}', ${query})` });
    return this;
  }

  // ── MODIFIERS ───────────────────────────────────────────────────────
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  single(): Promise<QueryResult> {
    this._singleRow = true;
    return this._execute();
  }

  maybeSingle(): Promise<QueryResult> {
    this._maybeSingle = true;
    return this._execute();
  }

  // ── THEN (allows await) ─────────────────────────────────────────────
  then(
    resolve: (value: QueryResult) => any,
    reject?: (reason: any) => any
  ): Promise<any> {
    return this._execute().then(resolve, reject);
  }

  // ── SQL Generation & Execution ──────────────────────────────────────
  private async _execute(): Promise<QueryResult> {
    try {
      const { sql, params } = this._buildSQL();
      const result = await adminQuery(sql, params);

      if (this._singleRow) {
        if (result.rows.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
        }
        return { data: result.rows[0], error: null };
      }

      if (this._maybeSingle) {
        return { data: result.rows[0] || null, error: null };
      }

      if (this._operation === 'insert' || this._operation === 'update' || this._operation === 'upsert') {
        return { data: result.rows[0] || result.rows, error: null, count: result.rowCount ?? 0 };
      }

      if (this._operation === 'delete') {
        return { data: result.rows, error: null, count: result.rowCount ?? 0 };
      }

      return { data: result.rows, error: null, count: result.rowCount ?? undefined };
    } catch (err: any) {
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  private _buildSQL(): { sql: string; params: any[] } {
    const params: any[] = [];
    let paramIdx = 1;

    const nextParam = (value: any): string => {
      params.push(value);
      return `$${paramIdx++}`;
    };

    // ── Build WHERE clause ──
    const whereParts: string[] = [];

    for (const f of this._filters) {
      const col = `"${f.column}"`;
      const prefix = f.negate ? 'NOT ' : '';

      switch (f.op) {
        case 'eq':
          whereParts.push(`${prefix}${col} = ${nextParam(f.value)}`);
          break;
        case 'neq':
          whereParts.push(`${prefix}${col} != ${nextParam(f.value)}`);
          break;
        case 'gt':
          whereParts.push(`${prefix}${col} > ${nextParam(f.value)}`);
          break;
        case 'gte':
          whereParts.push(`${prefix}${col} >= ${nextParam(f.value)}`);
          break;
        case 'lt':
          whereParts.push(`${prefix}${col} < ${nextParam(f.value)}`);
          break;
        case 'lte':
          whereParts.push(`${prefix}${col} <= ${nextParam(f.value)}`);
          break;
        case 'like':
          whereParts.push(`${prefix}${col} LIKE ${nextParam(f.value)}`);
          break;
        case 'ilike':
          whereParts.push(`${prefix}${col} ILIKE ${nextParam(f.value)}`);
          break;
        case 'is':
          if (f.value === null) {
            whereParts.push(`${prefix}${col} IS NULL`);
          } else {
            whereParts.push(`${prefix}${col} IS ${f.value ? 'TRUE' : 'FALSE'}`);
          }
          break;
        case 'in':
          if (Array.isArray(f.value) && f.value.length > 0) {
            const placeholders = f.value.map((v: any) => nextParam(v)).join(', ');
            whereParts.push(`${prefix}${col} IN (${placeholders})`);
          } else {
            whereParts.push('FALSE'); // empty IN = no match
          }
          break;
        case 'contains':
          whereParts.push(`${prefix}${col} @> ${nextParam(JSON.stringify(f.value))}`);
          break;
        case 'containedBy':
          whereParts.push(`${prefix}${col} <@ ${nextParam(JSON.stringify(f.value))}`);
          break;
        case 'overlaps':
          whereParts.push(`${prefix}${col} && ${nextParam(f.value)}`);
          break;
        default:
          whereParts.push(`${col} ${f.op} ${nextParam(f.value)}`);
      }
    }

    // OR filters (PostgREST style: "col1.eq.val1,col2.eq.val2")
    for (const orFilter of this._orFilters) {
      const parts = orFilter.split(',').map(part => {
        const m = part.trim().match(/^(\w+)\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.+)$/);
        if (!m) return part;
        const [, col, op, val] = m;
        switch (op) {
          case 'eq': return `"${col}" = ${nextParam(val)}`;
          case 'neq': return `"${col}" != ${nextParam(val)}`;
          case 'gt': return `"${col}" > ${nextParam(val)}`;
          case 'gte': return `"${col}" >= ${nextParam(val)}`;
          case 'lt': return `"${col}" < ${nextParam(val)}`;
          case 'lte': return `"${col}" <= ${nextParam(val)}`;
          case 'like': return `"${col}" LIKE ${nextParam(val)}`;
          case 'ilike': return `"${col}" ILIKE ${nextParam(val)}`;
          case 'is': return `"${col}" IS ${val === 'null' ? 'NULL' : val}`;
          default: return `"${col}" ${op} ${nextParam(val)}`;
        }
      });
      if (parts.length > 0) {
        whereParts.push(`(${parts.join(' OR ')})`);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // ── Build ORDER BY ──
    const orderClause = this._orders.length > 0
      ? `ORDER BY ${this._orders.map(o => {
          const dir = o.ascending ? 'ASC' : 'DESC';
          const nulls = o.nullsFirst !== undefined
            ? (o.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST')
            : '';
          return `"${o.column}" ${dir} ${nulls}`.trim();
        }).join(', ')}`
      : '';

    // ── Build LIMIT/OFFSET ──
    const limitClause = this._limitVal !== undefined ? `LIMIT ${this._limitVal}` : '';
    const offsetClause = this._offsetVal !== undefined ? `OFFSET ${this._offsetVal}` : '';

    // ── Build final SQL per operation ──
    const table = `"${this._schema}"."${this._table}"`;

    switch (this._operation) {
      case 'select': {
        // Parse select columns: "id, name, tenant:tenants(id, name)"
        const selectCols = this._parseSelectColumns(this._columns);
        const sql = `SELECT ${selectCols} FROM ${table} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`.replace(/\s+/g, ' ').trim();
        return { sql, params };
      }

      case 'insert': {
        const rows = Array.isArray(this._body) ? this._body : [this._body];
        if (rows.length === 0) return { sql: 'SELECT 1 WHERE FALSE', params: [] };

        const keys = Object.keys(rows[0]);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const valueSets = rows.map(row =>
          `(${keys.map(k => nextParam(row[k])).join(', ')})`
        ).join(', ');

        const sql = `INSERT INTO ${table} (${cols}) VALUES ${valueSets} RETURNING *`;
        return { sql, params };
      }

      case 'update': {
        const keys = Object.keys(this._body);
        const setClauses = keys.map(k => `"${k}" = ${nextParam(this._body[k])}`).join(', ');
        const sql = `UPDATE ${table} SET ${setClauses} ${whereClause} RETURNING *`;
        return { sql, params };
      }

      case 'upsert': {
        const rows = Array.isArray(this._body) ? this._body : [this._body];
        if (rows.length === 0) return { sql: 'SELECT 1 WHERE FALSE', params: [] };

        const keys = Object.keys(rows[0]);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const valueSets = rows.map(row =>
          `(${keys.map(k => nextParam(row[k])).join(', ')})`
        ).join(', ');

        const updateCols = keys
          .filter(k => k !== this._onConflict)
          .map(k => `"${k}" = EXCLUDED."${k}"`)
          .join(', ');

        const sql = `INSERT INTO ${table} (${cols}) VALUES ${valueSets} ON CONFLICT ("${this._onConflict}") DO UPDATE SET ${updateCols} RETURNING *`;
        return { sql, params };
      }

      case 'delete': {
        const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`;
        return { sql, params };
      }

      default:
        return { sql: 'SELECT 1', params: [] };
    }
  }

  /**
   * Parse PostgREST-style select into SQL columns.
   * "id, name" → "id", "name"
   * "id, name, patients(name, phone)" → "id", "name" (relations ignored for now)
   * "*, profiles!appointments_professional_id_fkey(full_name)" → simplified
   */
  private _parseSelectColumns(cols: string): string {
    if (cols === '*') return '*';

    // Remove relation expressions (PostgREST join syntax)
    // e.g. "patients(name, phone)" or "profiles!fk(full_name)"
    const cleaned = cols.replace(/\w+[!]?\w*\([^)]*\)/g, '').trim();

    // Split, clean, and quote
    return cleaned
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(c => c === '*' ? '*' : `"${c}"`)
      .join(', ') || '*';
  }
}

// ─── RPC Caller ───────────────────────────────────────────────────────────
async function rpc(
  functionName: string,
  params?: Record<string, any>
): Promise<QueryResult> {
  try {
    if (!params || Object.keys(params).length === 0) {
      const result = await adminQuery(`SELECT * FROM "${functionName}"()`);
      return { data: result.rows.length === 1 ? result.rows[0] : result.rows, error: null };
    }

    const keys = Object.keys(params);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const namedParams = keys.map((k, i) => `"${k}" := $${i + 1}`).join(', ');
    const values = keys.map(k => params[k]);

    const result = await adminQuery(
      `SELECT * FROM "${functionName}"(${namedParams})`,
      values
    );
    return { data: result.rows.length === 1 ? result.rows[0] : result.rows, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

// ─── DB Client Factory ───────────────────────────────────────────────────
export interface DbClient {
  from: (table: string) => PostgrestQueryBuilder;
  rpc: (fn: string, params?: Record<string, any>) => Promise<QueryResult>;
}

export function createDbClient(): DbClient {
  return {
    from: (table: string) => new PostgrestQueryBuilder(table),
    rpc: (fn: string, params?: Record<string, any>) => rpc(fn, params),
  };
}
