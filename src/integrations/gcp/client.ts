/**
 * GCP API Client.
 * 
 * Provides a chainable query builder interface compatible with the
 * existing codebase (from().select().eq()...) but routes all requests
 * through the Cloud Run REST proxy with Firebase Auth tokens.
 * 
 * Usage:
 *   import { api } from '@/integrations/gcp/client';
 *   const { data, error } = await api.from('patients').select('*').eq('tenant_id', tid);
 */

import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import { logger } from '@/lib/logger';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

// ─── Token Management (with mutex to prevent parallel refreshes) ───

let _cachedToken: string | null = null;
let _tokenExpiry = 0;
let _tokenPromise: Promise<string | null> | null = null;

async function _fetchToken(): Promise<string | null> {
  const app = getFirebaseApp();
  if (!app) {
    logger.warn('[gcp-client] Firebase not initialized — returning null token');
    return null;
  }

  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // forceRefresh=true when close to expiry; false otherwise (SDK handles refresh)
    const nearExpiry = _tokenExpiry > 0 && Date.now() > _tokenExpiry - 120_000;
    const token = await user.getIdToken(nearExpiry);
    _cachedToken = token;
    _tokenExpiry = Date.now() + 3600_000;
    return token;
  } catch (err) {
    logger.error('[gcp-client] Token refresh failed', err);
    _cachedToken = null;
    _tokenExpiry = 0;
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  // Fast path: return cached token if still valid (2 min buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 120_000) {
    return _cachedToken;
  }

  // Mutex: only one in-flight token refresh at a time
  if (_tokenPromise) return _tokenPromise;

  _tokenPromise = _fetchToken().finally(() => { _tokenPromise = null; });
  return _tokenPromise;
}

export function clearTokenCache() {
  _cachedToken = null;
  _tokenExpiry = 0;
  _tokenPromise = null;
}

// ─── HTTP Helpers (with timeout, retries, structured errors) ───────

export interface ApiResponse<T = any> {
  data: T | null;
  error: { message: string; code?: string; details?: any } | null;
  count?: number;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

async function apiPost<T = any>(path: string, body: any, requireAuth = true): Promise<ApiResponse<T>> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (requireAuth) {
      const token = await getAuthToken();
      if (!token && requireAuth) {
        return { data: null, error: { message: 'Não autenticado. Faça login novamente.', code: '401' } };
      }
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Try parse body (may be text/html on 500)
      let json: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        json = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        try { json = JSON.parse(text); } catch { json = { error: text || `HTTP ${res.status}` }; }
      }

      if (!res.ok) {
        // Token expired → clear cache and retry once
        if (res.status === 401 && attempt === 0) {
          clearTokenCache();
          continue;
        }

        // Retryable server errors
        if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
          lastError = { message: json?.error || `HTTP ${res.status}`, code: String(res.status) };
          continue;
        }

        return {
          data: null,
          error: {
            message: json?.error || json?.message || `Erro do servidor (HTTP ${res.status})`,
            code: String(res.status),
            details: json,
          },
        };
      }

      // Normalize: some endpoints return { data, error }, others return the data directly
      if (json && typeof json === 'object' && 'data' in json && 'error' in json) {
        return json as ApiResponse<T>;
      }
      return { data: json as T, error: null };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        lastError = { message: 'Tempo limite excedido. Tente novamente.', code: 'TIMEOUT' };
      } else {
        lastError = { message: err.message || 'Erro de rede. Verifique sua conexão.', code: 'NETWORK' };
      }

      if (attempt < MAX_RETRIES) continue;
    }
  }

  return { data: null, error: lastError || { message: 'Erro desconhecido', code: 'UNKNOWN' } };
}

// ─── Query Builder (.from().select().eq()...) ─────

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'contains' | 'overlaps';

interface QueryFilter { column: string; op: FilterOp; value: any }
interface QueryOrder { column: string; ascending: boolean }

class QueryBuilder<T = any> {
  private _table: string;
  private _operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _columns = '*';
  private _filters: QueryFilter[] = [];
  private _order: QueryOrder[] = [];
  private _limit?: number;
  private _offset?: number;
  private _single = false;
  private _data?: any;
  private _onConflict?: string;
  private _count?: 'exact' | 'planned' | 'estimated';
  private _returning?: string;

  constructor(table: string) {
    this._table = table;
  }

  select(columns?: string, opts?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    this._operation = 'select';
    if (columns) this._columns = columns;
    if (opts?.count) this._count = opts.count;
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this._operation = 'insert';
    this._data = data;
    return this;
  }

  update(data: Record<string, any>): this {
    this._operation = 'update';
    this._data = data;
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], opts?: { onConflict?: string }): this {
    this._operation = 'upsert';
    this._data = data;
    if (opts?.onConflict) this._onConflict = opts.onConflict;
    return this;
  }

  delete(): this {
    this._operation = 'delete';
    return this;
  }

  // ─── Filters ─────────────────────────────────────────────────

  eq(column: string, value: any): this { this._filters.push({ column, op: 'eq', value }); return this; }
  neq(column: string, value: any): this { this._filters.push({ column, op: 'neq', value }); return this; }
  gt(column: string, value: any): this { this._filters.push({ column, op: 'gt', value }); return this; }
  gte(column: string, value: any): this { this._filters.push({ column, op: 'gte', value }); return this; }
  lt(column: string, value: any): this { this._filters.push({ column, op: 'lt', value }); return this; }
  lte(column: string, value: any): this { this._filters.push({ column, op: 'lte', value }); return this; }
  like(column: string, value: string): this { this._filters.push({ column, op: 'like', value }); return this; }
  ilike(column: string, value: string): this { this._filters.push({ column, op: 'ilike', value }); return this; }
  in(column: string, values: any[]): this { this._filters.push({ column, op: 'in', value: values }); return this; }
  is(column: string, value: null | boolean): this { this._filters.push({ column, op: 'is', value }); return this; }
  contains(column: string, value: any): this { this._filters.push({ column, op: 'contains', value }); return this; }
  overlaps(column: string, value: any): this { this._filters.push({ column, op: 'overlaps', value }); return this; }
  not(column: string, op: string, value: any): this { this._filters.push({ column, op: `not_${op}` as any, value }); return this; }

  // ─── Modifiers ───────────────────────────────────────────────

  order(column: string, opts?: { ascending?: boolean }): this {
    this._order.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number): this { this._limit = count; return this; }
  range(from: number, to: number): this { this._offset = from; this._limit = to - from + 1; return this; }
  single(): this { this._single = true; return this; }
  maybeSingle(): this { this._single = true; return this; }

  // ─── Execute ─────────────────────────────────────────────────

  async then<TResult1 = ApiResponse<T>, TResult2 = never>(
    resolve?: (value: ApiResponse<T>) => TResult1 | PromiseLike<TResult1>,
    reject?: (reason: any) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return resolve ? resolve(result) : result as any;
    } catch (err) {
      return reject ? reject(err) : Promise.reject(err);
    }
  }

  private async execute(): Promise<ApiResponse<T>> {
    return apiPost<T>('/api/rest', {
      table: this._table,
      operation: this._operation,
      columns: this._columns,
      filters: this._filters,
      order: this._order,
      limit: this._limit,
      offset: this._offset,
      single: this._single,
      data: this._data,
      onConflict: this._onConflict,
      count: this._count,
      returning: this._returning,
    });
  }
}

// ─── Storage Builder ───────────────────────────────────────────────

class StorageBucketClient {
  private _bucket: string;

  constructor(bucket: string) {
    this._bucket = bucket;
  }

  async upload(path: string, file: File | Blob, opts?: { contentType?: string; upsert?: boolean }) {
    const { data, error } = await apiPost<{ signedUrl: string }>(`/api/storage/${this._bucket}`, {
      operation: 'upload',
      path,
      contentType: opts?.contentType || file.type || 'application/octet-stream',
    });

    if (error || !data?.signedUrl) {
      return { data: null, error: error || { message: 'Falha ao obter URL de upload' } };
    }

    try {
      const res = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': opts?.contentType || file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) {
        return { data: null, error: { message: `Upload falhou: HTTP ${res.status}` } };
      }
      return { data: { path }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Upload falhou' } };
    }
  }

  async download(path: string) {
    const { data, error } = await apiPost<{ signedUrl: string }>(`/api/storage/${this._bucket}`, {
      operation: 'download',
      path,
    });
    if (error || !data?.signedUrl) return { data: null, error: error || { message: 'Falha ao obter URL de download' } };

    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) return { data: null, error: { message: `Download falhou: HTTP ${res.status}` } };
      const blob = await res.blob();
      return { data: blob, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Download falhou' } };
    }
  }

  async remove(paths: string[]) {
    const results = await Promise.all(
      paths.map(p => apiPost(`/api/storage/${this._bucket}`, { operation: 'delete', path: p }))
    );
    const firstError = results.find(r => r.error);
    return { data: null, error: firstError?.error || null };
  }

  getPublicUrl(path: string) {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    return {
      data: {
        publicUrl: `https://storage.googleapis.com/${projectId}-${this._bucket}/${path}`,
      },
    };
  }

  async createSignedUrl(path: string, _expiresIn: number) {
    return apiPost<{ signedUrl: string }>(`/api/storage/${this._bucket}`, {
      operation: 'download',
      path,
    });
  }
}

class StorageClient {
  from(bucket: string) {
    return new StorageBucketClient(bucket);
  }
}

// ─── Functions Client (calls Cloud Run API endpoints) ──────────────

class FunctionsClient {
  async invoke<T = any>(name: string, options?: { body?: any; headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    const publicFunctions = new Set([
      'register-user', 'verify-email-code', 'send-custom-auth-email',
      'activate-patient-account', 'submit-contact-message', 'public-booking',
      'landing-chat', 'jwt-probe',
    ]);

    const requireAuth = !publicFunctions.has(name);
    return apiPost<T>(`/api/${name}`, options?.body || {}, requireAuth);
  }
}

// ─── RealtimeChannel (polling with backoff, error recovery, unsubscribe guard) ─

type RealtimeCallback = (payload: { new: any; old: any; eventType: string }) => void;

export class RealtimeChannel {
  private _name: string;
  private _table?: string;
  private _event?: string;
  private _filter?: string;
  private _callback?: RealtimeCallback;
  private _interval?: ReturnType<typeof setInterval>;
  private _lastData: any[] = [];
  private _unsubscribed = false;
  private _consecutiveErrors = 0;
  private _pollMs = 5_000;
  private static readonly MAX_POLL_MS = 60_000;
  private static readonly MAX_CONSECUTIVE_ERRORS = 5;

  constructor(name: string) {
    this._name = name;
  }

  on(
    event: string,
    opts: { event?: string; schema?: string; table?: string; filter?: string } | string,
    filterOrCallback?: string | RealtimeCallback,
    callback?: RealtimeCallback,
  ): this {
    if (typeof opts === 'object') {
      this._table = opts.table;
      this._filter = opts.filter;
      this._event = opts.event;
    }
    if (typeof filterOrCallback === 'function') {
      this._callback = filterOrCallback;
    }
    if (typeof callback === 'function') {
      this._callback = callback;
    }
    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    if (this._table && this._callback) {
      const table = this._table;
      const cb = this._callback;
      const filter = this._filter;
      const eventFilter = this._event; // INSERT, UPDATE, DELETE, or undefined (all)

      const poll = async () => {
        if (this._unsubscribed) return;

        try {
          const builder = new QueryBuilder(table)
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);

          // Parse filter like "tenant_id=eq.xxx"
          if (filter) {
            const eqMatch = filter.match(/^(\w+)=eq\.(.+)$/);
            if (eqMatch) {
              builder.eq(eqMatch[1], eqMatch[2]);
            }
          }

          const { data, error } = await builder;

          if (error) {
            throw new Error(error.message);
          }

          if (data && Array.isArray(data)) {
            const oldMap = new Map(this._lastData.map((r: any) => [r.id, r]));
            const newMap = new Map(data.map((r: any) => [r.id, r]));

            // Detect INSERTs
            if (!eventFilter || eventFilter === 'INSERT' || eventFilter === '*') {
              for (const row of data) {
                if (!oldMap.has(row.id)) {
                  cb({ new: row, old: null, eventType: 'INSERT' });
                }
              }
            }

            // Detect UPDATEs
            if (!eventFilter || eventFilter === 'UPDATE' || eventFilter === '*') {
              for (const row of data) {
                const old = oldMap.get(row.id);
                if (old && JSON.stringify(old) !== JSON.stringify(row)) {
                  cb({ new: row, old, eventType: 'UPDATE' });
                }
              }
            }

            // Detect DELETEs
            if (!eventFilter || eventFilter === 'DELETE' || eventFilter === '*') {
              for (const old of this._lastData) {
                if (!newMap.has(old.id)) {
                  cb({ new: null, old, eventType: 'DELETE' });
                }
              }
            }

            this._lastData = data;
          }

          // Success: reset backoff
          this._consecutiveErrors = 0;
          this._pollMs = 5_000;
        } catch (err) {
          this._consecutiveErrors++;
          if (this._consecutiveErrors <= RealtimeChannel.MAX_CONSECUTIVE_ERRORS) {
            // Exponential backoff: 5s → 10s → 20s → 40s → 60s (capped)
            this._pollMs = Math.min(
              this._pollMs * 2,
              RealtimeChannel.MAX_POLL_MS,
            );
            logger.warn(`[RealtimeChannel:${this._name}] Poll error #${this._consecutiveErrors}, backoff ${this._pollMs}ms`, err);
          } else {
            logger.error(`[RealtimeChannel:${this._name}] Too many consecutive errors, stopping`);
            this.unsubscribe();
            return;
          }
        }

        // Schedule next poll (dynamic interval)
        if (!this._unsubscribed) {
          this._interval = setTimeout(poll, this._pollMs) as any;
        }
      };

      // Initial fetch
      poll();
    }

    callback?.('SUBSCRIBED');
    return this;
  }

  unsubscribe() {
    this._unsubscribed = true;
    if (this._interval) {
      clearTimeout(this._interval as any);
      clearInterval(this._interval);
      this._interval = undefined;
    }
    return Promise.resolve();
  }
}

// ─── Main API Client ───────────────────────────────────────────────

// Auth is lazily loaded to avoid circular imports
let _authModule: typeof import('./auth') | null = null;
async function getAuthModule() {
  if (!_authModule) {
    _authModule = await import('./auth');
  }
  return _authModule;
}

// Auth proxy — delegates to the auth module (lazy-loaded)
const authProxy = {
  async signInWithPassword(opts: { email: string; password: string; options?: { captchaToken?: string } }) {
    const m = await getAuthModule();
    return m.auth.signInWithPassword(opts);
  },
  async signOut() {
    const m = await getAuthModule();
    return m.auth.signOut();
  },
  async getSession() {
    const m = await getAuthModule();
    return m.auth.getSession();
  },
  async getUser() {
    const m = await getAuthModule();
    return m.auth.getUser();
  },
  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string; captchaToken?: string }) {
    const m = await getAuthModule();
    return m.auth.resetPasswordForEmail(email, opts);
  },
  async updateUser(updates: { password?: string }) {
    const m = await getAuthModule();
    return m.auth.updateUser(updates);
  },
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Lazy-load auth module and subscribe.
    // We store a pending queue to avoid losing the first event.
    let unsubFn: (() => void) | null = null;
    let pendingEvents: Array<[string, any]> = [];
    let ready = false;

    getAuthModule().then(m => {
      const { data } = m.auth.onAuthStateChange((event, session) => {
        if (ready) {
          callback(event, session);
        } else {
          pendingEvents.push([event, session]);
        }
      });
      unsubFn = data?.subscription?.unsubscribe ?? null;

      // Flush pending events
      ready = true;
      for (const [ev, sess] of pendingEvents) {
        callback(ev, sess);
      }
      pendingEvents = [];
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            ready = false; // Stop forwarding events
            unsubFn?.();
          },
        },
      },
    };
  },
  // setSession is a no-op for Firebase Auth — password reset uses different flow
  async setSession(_opts: { access_token: string; refresh_token: string }) {
    // Firebase doesn't support setting sessions from raw tokens.
    // The ResetPassword page should check if user is already signed in via Firebase.
    return { data: { session: null }, error: null };
  },
};

export const api = {
  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },

  async rpc<T = any>(name: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return apiPost<T>(`/api/rpc/${name}`, params || {});
  },

  functions: new FunctionsClient(),

  storage: new StorageClient(),

  auth: authProxy,

  channel(name: string): RealtimeChannel {
    return new RealtimeChannel(name);
  },

  removeChannel(channel: RealtimeChannel) {
    channel.unsubscribe();
    return Promise.resolve();
  },
};

// For files that import specific named exports
export { getAuthToken, apiPost, API_BASE };
export type { ApiResponse, QueryBuilder };

/**
 * Patient portal alias — same API client, same Cloud Run backend.
 * Firebase Auth handles the user context (staff vs patient) via the JWT token.
 */
export const apiPatient = api;
