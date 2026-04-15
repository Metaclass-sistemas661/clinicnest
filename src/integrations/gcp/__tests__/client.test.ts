/**
 * Unit tests for the GCP API client (QueryBuilder, StorageClient, FunctionsClient).
 * Mocks fetch + Firebase Auth to test the client in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('mock-jwt-token') },
  })),
  onIdTokenChanged: vi.fn((_auth: any, _cb: any) => vi.fn()), // returns unsubscribe
  onAuthStateChanged: vi.fn((_auth: any, _cb: any) => vi.fn()),
}));

// Mock firebase app
vi.mock('@/lib/firebase', () => ({
  getFirebaseApp: vi.fn(() => ({ name: 'test-app' })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// We need to import AFTER mocks are set up
let api: any;
let clearTokenCache: any;
let RealtimeChannel: any;

beforeEach(async () => {
  vi.resetModules();
  // Re-import to get fresh state
  const mod = await import('../client');
  api = mod.api;
  clearTokenCache = mod.clearTokenCache;
  RealtimeChannel = mod.RealtimeChannel;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── QueryBuilder Tests ─────────────────────────────────────────────

describe('QueryBuilder', () => {
  it('builds a select query and sends POST /api/rest', async () => {
    const mockRows = [{ id: '1', name: 'João' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: mockRows, error: null }),
    });

    const { data, error } = await api.from('patients').select('*');

    expect(error).toBeNull();
    expect(data).toEqual(mockRows);

    // Verify fetch was called correctly
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toContain('/api/rest');
    const body = JSON.parse(call[1].body);
    expect(body.table).toBe('patients');
    expect(body.operation).toBe('select');
    expect(body.columns).toBe('*');
  });

  it('chains eq/neq/gt/gte/lt/lte filters', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], error: null }),
    });

    await api.from('appointments')
      .select('*')
      .eq('tenant_id', 't1')
      .neq('status', 'cancelled')
      .gte('date', '2025-01-01')
      .lt('date', '2025-12-31')
      .limit(10);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.filters).toHaveLength(4);
    expect(body.filters[0]).toEqual({ column: 'tenant_id', op: 'eq', value: 't1' });
    expect(body.filters[1]).toEqual({ column: 'status', op: 'neq', value: 'cancelled' });
    expect(body.limit).toBe(10);
  });

  it('sends insert with data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: { id: 'new-1' }, error: null }),
    });

    const { data } = await api.from('patients').insert({ name: 'Maria', email: 'm@x.com' });
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.operation).toBe('insert');
    expect(body.data).toEqual({ name: 'Maria', email: 'm@x.com' });
    expect(data).toEqual({ id: 'new-1' });
  });

  it('sends update with filters', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [{ id: '1' }], error: null }),
    });

    await api.from('patients').update({ name: 'Updated' }).eq('id', '1');
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.operation).toBe('update');
    expect(body.data).toEqual({ name: 'Updated' });
    expect(body.filters).toEqual([{ column: 'id', op: 'eq', value: '1' }]);
  });

  it('sends upsert with onConflict', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [{ id: '1' }], error: null }),
    });

    await api.from('profiles').upsert({ id: '1', name: 'X' }, { onConflict: 'id' });
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.operation).toBe('upsert');
    expect(body.onConflict).toBe('id');
  });

  it('sends delete with filters', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [{ id: 'd1' }], error: null }),
    });

    await api.from('notifications').delete().eq('id', 'd1');
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.operation).toBe('delete');
    expect(body.filters).toEqual([{ column: 'id', op: 'eq', value: 'd1' }]);
  });

  it('uses single() modifier', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: { id: '1' }, error: null }),
    });

    await api.from('patients').select('*').eq('id', '1').single();
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.single).toBe(true);
  });

  it('uses order and range modifiers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], error: null }),
    });

    await api.from('patients').select('*').order('created_at', { ascending: false }).range(0, 19);
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.order).toEqual([{ column: 'created_at', ascending: false }]);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
  });

  it('uses ilike filter', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], error: null }),
    });

    await api.from('patients').select('*').ilike('name', '%João%');
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.filters).toEqual([{ column: 'name', op: 'ilike', value: '%João%' }]);
  });

  it('uses in filter', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], error: null }),
    });

    await api.from('patients').select('*').in('status', ['active', 'pending']);
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.filters).toEqual([{ column: 'status', op: 'in', value: ['active', 'pending'] }]);
  });

  it('uses is filter for null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], error: null }),
    });

    await api.from('patients').select('*').is('deleted_at', null);
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.filters).toEqual([{ column: 'deleted_at', op: 'is', value: null }]);
  });
});

// ─── FunctionsClient Tests ──────────────────────────────────────────

describe('FunctionsClient', () => {
  it('invokes public function without auth', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: { ok: true }, error: null }),
    });

    const { data, error } = await api.functions.invoke('submit-contact-message', {
      body: { name: 'Test', email: 'test@x.com' },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });

    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toContain('/api/submit-contact-message');
    // Public function should NOT send Authorization header
    const headers = call[1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('invokes auth-required function with Bearer token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: { status: 'active' }, error: null }),
    });

    const { data } = await api.functions.invoke('check-subscription', { body: {} });

    expect(data).toEqual({ status: 'active' });
    const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer mock-jwt-token');
  });
});

// ─── StorageClient Tests ────────────────────────────────────────────

describe('StorageClient', () => {
  it('getPublicUrl builds correct URL', () => {
    const { data } = api.storage.from('avatars').getPublicUrl('user/photo.jpg');
    expect(data.publicUrl).toContain('avatars');
    expect(data.publicUrl).toContain('user/photo.jpg');
    expect(data.publicUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//);
  });
});

// ─── Error Handling Tests ───────────────────────────────────────────

describe('Error Handling', () => {
  it('returns error on 500 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    const { data, error } = await api.from('patients').select('*');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error!.code).toBe('500');
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const { data, error } = await api.from('patients').select('*');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error!.code).toBe('NETWORK');
  });

  it('returns error on timeout (AbortError)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

    const { data, error } = await api.from('patients').select('*');
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error!.code).toBe('TIMEOUT');
  });

  it('retries on 503 and succeeds on second attempt', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ error: 'Service unavailable' }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: [{ id: '1' }], error: null }),
      };
    });

    const { data, error } = await api.from('patients').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: '1' }]);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('clears token cache and retries on 401', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: [{ id: '1' }], error: null }),
      };
    });

    const { data, error } = await api.from('patients').select('*');
    expect(data).toEqual([{ id: '1' }]);
    expect(callCount).toBe(2);
  });
});

// ─── Auth Proxy Tests ───────────────────────────────────────────────

describe('AuthProxy', () => {
  it('onAuthStateChange returns unsubscribe function', () => {
    const { data } = api.auth.onAuthStateChange(() => {});
    expect(data).toBeTruthy();
    expect(data.subscription).toBeTruthy();
    expect(typeof data.subscription.unsubscribe).toBe('function');
  });
});
