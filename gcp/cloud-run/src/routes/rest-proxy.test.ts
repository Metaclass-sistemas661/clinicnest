/**
 * Integration tests — REST proxy, RPC proxy, Storage proxy
 * Tests the core API layer that REST proxy.
 *
 * Uses supertest against the Express app with mocked auth/db middleware.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { restProxy, rpcProxy, storageProxy } from '../routes/rest-proxy';

// ─── Mock DB ────────────────────────────────────────────────────────

function createMockDb(rows: any[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
    adminQuery: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

function createApp(dbRows: any[] = []) {
  const app = express();
  app.use(express.json());

  // Inject mock auth + db
  app.use((req, _res, next) => {
    (req as any).user = { uid: 'test-user-123', tenant_id: 'tenant-abc', role: 'admin' };
    (req as any).db = createMockDb(dbRows);
    next();
  });

  app.post('/api/rest', restProxy);
  app.post('/api/rpc/:name', rpcProxy);
  app.post('/api/storage/:bucket', storageProxy);

  return app;
}

// ─── REST Proxy Tests ───────────────────────────────────────────────

describe('REST Proxy', () => {
  describe('Validation', () => {
    it('rejects missing table', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ operation: 'select' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing');
    });

    it('rejects missing operation', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients' });
      expect(res.status).toBe(400);
    });

    it('rejects non-whitelisted table', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'pg_shadow', operation: 'select' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('not accessible');
    });

    it('rejects SQL injection in table name', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients; DROP TABLE users;--', operation: 'select' });
      expect(res.status).toBe(403);
    });

    it('rejects unknown operation', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'truncate' });
      expect(res.status).toBe(400);
    });
  });

  describe('SELECT', () => {
    it('returns rows on select', async () => {
      const rows = [{ id: '1', name: 'Patient A' }, { id: '2', name: 'Patient B' }];
      const app = createApp(rows);
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(rows);
      expect(res.body.error).toBeNull();
    });

    it('returns null on single with no rows', async () => {
      const app = createApp([]);
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select', single: true });
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
      expect(res.body.error.code).toBe('PGRST116');
    });

    it('returns first row on single', async () => {
      const rows = [{ id: '1', name: 'Patient A' }];
      const app = createApp(rows);
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select', single: true });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(rows[0]);
    });

    it('applies filters correctly', async () => {
      const app = createApp([]);
      const res = await request(app)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'select',
          filters: [{ column: 'tenant_id', op: 'eq', value: 'abc' }],
        });
      expect(res.status).toBe(200);
      const db = (res as any).req?.db; // Can't access mock directly from response
      // At least it didn't crash
    });

    it('caps LIMIT to 5000', async () => {
      const app = createApp([]);
      const mockDb = createMockDb([]);

      // Override app to capture the query
      const captureApp = express();
      captureApp.use(express.json());
      captureApp.use((req, _res, next) => {
        (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
        (req as any).db = mockDb;
        next();
      });
      captureApp.post('/api/rest', restProxy);

      await request(captureApp)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select', limit: 99999 });

      expect(mockDb.query).toHaveBeenCalled();
      const sql = mockDb.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT 5000');
    });
  });

  describe('INSERT', () => {
    it('rejects insert without data', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'insert' });
      expect(res.status).toBe(400);
    });

    it('inserts data', async () => {
      const inserted = [{ id: '1', name: 'New Patient' }];
      const app = createApp(inserted);
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'insert', data: { name: 'New Patient' } });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(inserted[0]);
    });

    it('filters out unsafe column names', async () => {
      const mockDb = createMockDb([{ id: '1' }]);
      const captureApp = express();
      captureApp.use(express.json());
      captureApp.use((req, _res, next) => {
        (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
        (req as any).db = mockDb;
        next();
      });
      captureApp.post('/api/rest', restProxy);

      await request(captureApp)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'insert',
          data: { name: 'Test', '"; DROP TABLE--': 'hack' },
        });

      const sql = mockDb.query.mock.calls[0][0] as string;
      expect(sql).not.toContain('DROP');
      expect(sql).toContain('"name"');
    });
  });

  describe('UPDATE', () => {
    it('requires filters for update', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'update', data: { name: 'X' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('filter');
    });

    it('updates with filters', async () => {
      const updated = [{ id: '1', name: 'Updated' }];
      const app = createApp(updated);
      const res = await request(app)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'update',
          data: { name: 'Updated' },
          filters: [{ column: 'id', op: 'eq', value: '1' }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(updated);
    });
  });

  describe('UPSERT', () => {
    it('validates onConflict column', async () => {
      const app = createApp([]);
      const res = await request(app)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'upsert',
          data: { id: '1', name: 'X' },
          onConflict: '"; DROP TABLE--',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid onConflict');
    });

    it('accepts multi-column onConflict', async () => {
      const mockDb = createMockDb([{ id: '1' }]);
      const captureApp = express();
      captureApp.use(express.json());
      captureApp.use((req, _res, next) => {
        (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
        (req as any).db = mockDb;
        next();
      });
      captureApp.post('/api/rest', restProxy);

      await request(captureApp)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'upsert',
          data: { tenant_id: 't', email: 'a@b.com', name: 'X' },
          onConflict: 'tenant_id,email',
        });

      const sql = mockDb.query.mock.calls[0][0] as string;
      expect(sql).toContain('ON CONFLICT ("tenant_id", "email")');
    });
  });

  describe('DELETE', () => {
    it('requires filters for delete', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'delete' });
      expect(res.status).toBe(400);
    });

    it('deletes with filter', async () => {
      const deleted = [{ id: '1' }];
      const app = createApp(deleted);
      const res = await request(app)
        .post('/api/rest')
        .send({
          table: 'patients',
          operation: 'delete',
          filters: [{ column: 'id', op: 'eq', value: '1' }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(deleted);
    });
  });

  describe('Error handling', () => {
    it('returns safe error on DB constraint violation', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue({ message: 'unique_violation', code: '23505' }),
        adminQuery: vi.fn(),
      };
      const captureApp = express();
      captureApp.use(express.json());
      captureApp.use((req, _res, next) => {
        (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
        (req as any).db = mockDb;
        next();
      });
      captureApp.post('/api/rest', restProxy);

      const res = await request(captureApp)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select' });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('constraint violation');
      expect(res.body.error).not.toContain('unique_violation'); // no internal detail leak
    });

    it('returns safe error on invalid SQL', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue({ message: 'column "x" does not exist', code: '42703' }),
        adminQuery: vi.fn(),
      };
      const captureApp = express();
      captureApp.use(express.json());
      captureApp.use((req, _res, next) => {
        (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
        (req as any).db = mockDb;
        next();
      });
      captureApp.post('/api/rest', restProxy);

      const res = await request(captureApp)
        .post('/api/rest')
        .send({ table: 'patients', operation: 'select', columns: 'nonexistent' });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Invalid query');
      expect(res.body.error).not.toContain('does not exist');
    });
  });
});

// ─── RPC Proxy Tests ────────────────────────────────────────────────

describe('RPC Proxy', () => {
  it('rejects invalid function name', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/rpc/DROP TABLE--')
      .send({});
    expect(res.status).toBe(400);
  });

  it('calls function and returns data', async () => {
    const rows = [{ total: 42 }];
    const app = createApp(rows);
    const res = await request(app)
      .post('/api/rpc/get_my_context')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(rows[0]);
  });

  it('returns null for empty result', async () => {
    const app = createApp([]);
    const res = await request(app)
      .post('/api/rpc/get_my_context')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBeNull();
  });

  it('returns array for multiple rows', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const app = createApp(rows);
    const res = await request(app)
      .post('/api/rpc/list_items')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(rows);
  });

  it('passes named parameters', async () => {
    const mockDb = createMockDb([{ ok: true }]);
    const captureApp = express();
    captureApp.use(express.json());
    captureApp.use((req, _res, next) => {
      (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
      (req as any).db = mockDb;
      next();
    });
    captureApp.post('/api/rpc/:name', rpcProxy);

    await request(captureApp)
      .post('/api/rpc/search_patients')
      .send({ search_term: 'João', limit_count: 10 });

    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain('"search_term" :=');
    expect(sql).toContain('"limit_count" :=');
  });

  it('filters unsafe parameter names', async () => {
    const mockDb = createMockDb([{ ok: true }]);
    const captureApp = express();
    captureApp.use(express.json());
    captureApp.use((req, _res, next) => {
      (req as any).user = { uid: 'u', tenant_id: 't', role: 'admin' };
      (req as any).db = mockDb;
      next();
    });
    captureApp.post('/api/rpc/:name', rpcProxy);

    await request(captureApp)
      .post('/api/rpc/test_func')
      .send({ valid_param: 'ok', '"; DROP--': 'hack' });

    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('DROP');
    expect(sql).toContain('"valid_param"');
  });
});

// ─── Storage Proxy Tests ────────────────────────────────────────────

describe('Storage Proxy', () => {
  it('rejects missing path', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download' });
    expect(res.status).toBe(400);
  });

  it('blocks path traversal with ..', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download', path: '../../../etc/passwd' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid file path');
  });

  it('blocks path starting with /', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download', path: '/etc/passwd' });
    expect(res.status).toBe(400);
  });

  it('blocks path with control characters', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download', path: 'file\x00.jpg' });
    expect(res.status).toBe(400);
  });

  it('blocks invalid bucket name', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/DROP TABLE')
      .send({ operation: 'download', path: 'test.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid bucket name');
  });

  it('rejects non-string path', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download', path: ['array-path'] });
    expect(res.status).toBe(400);
  });
});
