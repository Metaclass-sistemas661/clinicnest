/**
 * Security tests — Auth middleware, CORS, path traversal, tenant isolation.
 * Validates that security boundaries are enforced correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { restProxy, storageProxy, rpcProxy } from '../routes/rest-proxy';
import { corsMiddleware } from '../shared/cors';
import { errorHandler } from '../shared/errorHandler';

// ─── Helpers ────────────────────────────────────────────────────────

function createAuthApp(user: any, dbRows: any[] = []) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (user) {
      (req as any).user = user;
      (req as any).db = {
        query: vi.fn().mockResolvedValue({ rows: dbRows, rowCount: dbRows.length }),
        adminQuery: vi.fn().mockResolvedValue({ rows: dbRows, rowCount: dbRows.length }),
      };
    }
    next();
  });
  app.post('/api/rest', restProxy);
  app.post('/api/rpc/:name', rpcProxy);
  app.post('/api/storage/:bucket', storageProxy);
  app.use(errorHandler);
  return app;
}

// ─── CORS Tests ─────────────────────────────────────────────────────

describe('CORS Security', () => {
  function createCorsApp() {
    const app = express();
    app.use(corsMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows requests from clinicnest.com.br', async () => {
    const app = createCorsApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://clinicnest.com.br');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://clinicnest.com.br');
  });

  it('allows requests from app.clinicnest.com.br', async () => {
    const app = createCorsApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://app.clinicnest.com.br');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.clinicnest.com.br');
  });

  it('blocks request from evil-domain.com', async () => {
    const app = createCorsApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://evil-domain.com');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CORS');
  });

  it('blocks request from subdomain-spoofed origin', async () => {
    const app = createCorsApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://evil.clinicnest.com.br.attacker.com');
    expect(res.status).toBe(403);
  });

  it('handles preflight OPTIONS correctly', async () => {
    const app = createCorsApp();
    const res = await request(app)
      .options('/test')
      .set('Origin', 'https://clinicnest.com.br');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

// ─── Rest Proxy SQL Injection Tests ─────────────────────────────────

describe('SQL Injection Prevention', () => {
  const user = { uid: 'u1', tenant_id: 't1', role: 'admin' };

  it('blocks SQL injection in table name', async () => {
    const app = createAuthApp(user);
    const payloads = [
      "patients' OR 1=1 --",
      'patients; DROP TABLE users;',
      'patients" UNION SELECT * FROM pg_shadow --',
      "patients\x00; DELETE FROM users;",
    ];

    for (const table of payloads) {
      const res = await request(app).post('/api/rest').send({ table, operation: 'select' });
      expect(res.status).toBe(403);
    }
  });

  it('blocks SQL injection in column names', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      adminQuery: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    await request(app).post('/api/rest').send({
      table: 'patients',
      operation: 'insert',
      data: { '"; DROP TABLE patients; --': 'hacked', name: 'legitimate' },
    });

    const sql = mockDb.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('"name"');
    expect(sql).not.toContain('DROP');
  });

  it('blocks SQL injection in filter column name', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      adminQuery: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    await request(app).post('/api/rest').send({
      table: 'patients',
      operation: 'select',
      filters: [{ column: '1=1; DROP TABLE--', op: 'eq', value: 'x' }],
    });

    const sql = mockDb.query.mock.calls[0]?.[0] as string;
    // Unsafe column should be filtered out — no WHERE with injection
    expect(sql).not.toContain('DROP');
  });

  it('blocks SQL injection in RPC function name', async () => {
    const app = createAuthApp(user);
    const payloads = [
      "get_data'; DROP TABLE users;--",
      'get_data" UNION SELECT * FROM pg_shadow',
      'fn(); DROP TABLE patients;--',
    ];

    for (const name of payloads) {
      const res = await request(app).post(`/api/rpc/${encodeURIComponent(name)}`).send({});
      expect(res.status).toBe(400);
    }
  });

  it('blocks SQL injection in RPC parameter keys', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ ok: true }], rowCount: 1 }),
      adminQuery: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rpc/:name', rpcProxy);

    await request(app).post('/api/rpc/safe_func').send({
      safe_param: 'ok',
      '"; DROP TABLE--': 'attack',
    });

    const sql = mockDb.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain('"safe_param"');
    expect(sql).not.toContain('DROP');
  });

  it('prevents numeric LIMIT/OFFSET overflow', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      adminQuery: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    await request(app).post('/api/rest').send({
      table: 'patients',
      operation: 'select',
      limit: 999999,
      offset: -5,
    });

    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT 5000');
    expect(sql).toContain('OFFSET 0');
  });
});

// ─── Path Traversal Prevention ──────────────────────────────────────

describe('Path Traversal Prevention', () => {
  const user = { uid: 'u1', tenant_id: 't1', role: 'admin' };

  const traversalPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '/etc/shadow',
    'a/../../../etc/passwd',
    'file\x00.jpg',
    'file\n.jpg',
    'file\r.jpg',
    'file\t.jpg',
  ];

  for (const path of traversalPayloads) {
    it(`blocks path "${path.replace(/[\x00-\x1f]/g, '\\x' + '??')}"`, async () => {
      const app = createAuthApp(user);
      const res = await request(app)
        .post('/api/storage/avatars')
        .send({ operation: 'download', path });
      expect(res.status).toBe(400);
    });
  }

  it('accepts legitimate paths', async () => {
    // This will fail at Storage level (no real GCS), but the validation should pass
    const app = createAuthApp(user);
    const res = await request(app)
      .post('/api/storage/avatars')
      .send({ operation: 'download', path: 'tenant-abc/users/photo.jpg' });
    // Should get 500 (storage not configured in test) not 400 (validation)
    expect(res.status).toBe(500);
  });
});

// ─── Tenant Isolation (RLS Context) ────────────────────────────────

describe('Tenant Isolation', () => {
  it('queries use the user context from auth middleware', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 }),
      adminQuery: vi.fn(),
    };

    const user = { uid: 'user-1', tenant_id: 'tenant-A', role: 'staff' };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    await request(app).post('/api/rest').send({
      table: 'patients',
      operation: 'select',
      filters: [{ column: 'tenant_id', op: 'eq', value: 'tenant-A' }],
    });

    // The db.query is called (RLS context set by dbMiddleware in production)
    expect(mockDb.query).toHaveBeenCalled();
    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE');
    expect(sql).toContain('"tenant_id"');
  });

  it('each user gets their own DB context (no cross-contamination)', async () => {
    const tenantADb = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'a1', tenant_id: 'A' }], rowCount: 1 }),
      adminQuery: vi.fn(),
    };
    const tenantBDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'b1', tenant_id: 'B' }], rowCount: 1 }),
      adminQuery: vi.fn(),
    };

    // Simulate two users from different tenants
    const appA = express();
    appA.use(express.json());
    appA.use((req, _res, next) => {
      (req as any).user = { uid: 'uA', tenant_id: 'tenant-A', role: 'admin' };
      (req as any).db = tenantADb;
      next();
    });
    appA.post('/api/rest', restProxy);

    const appB = express();
    appB.use(express.json());
    appB.use((req, _res, next) => {
      (req as any).user = { uid: 'uB', tenant_id: 'tenant-B', role: 'admin' };
      (req as any).db = tenantBDb;
      next();
    });
    appB.post('/api/rest', restProxy);

    const resA = await request(appA).post('/api/rest').send({ table: 'patients', operation: 'select' });
    const resB = await request(appB).post('/api/rest').send({ table: 'patients', operation: 'select' });

    // Verify independent DB calls
    expect(tenantADb.query).toHaveBeenCalledTimes(1);
    expect(tenantBDb.query).toHaveBeenCalledTimes(1);
    expect(resA.body.data[0].tenant_id).toBe('A');
    expect(resB.body.data[0].tenant_id).toBe('B');
  });
});

// ─── Error Message Sanitization ─────────────────────────────────────

describe('Error Sanitization', () => {
  const user = { uid: 'u1', tenant_id: 't1', role: 'admin' };

  it('never leaks PostgreSQL error details (23xxx constraint)', async () => {
    const mockDb = {
      query: vi.fn().mockRejectedValue({
        message: 'duplicate key value violates unique constraint "patients_cpf_key"',
        code: '23505',
        detail: 'Key (cpf)=(12345678901) already exists.',
      }),
      adminQuery: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    const res = await request(app).post('/api/rest').send({ table: 'patients', operation: 'select' });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain('cpf');
    expect(res.body.error).not.toContain('12345678901');
    expect(res.body.error).not.toContain('patients_cpf_key');
    expect(res.body.error).toContain('constraint violation');
  });

  it('never leaks PostgreSQL error details (42xxx syntax)', async () => {
    const mockDb = {
      query: vi.fn().mockRejectedValue({
        message: 'relation "secret_table" does not exist',
        code: '42P01',
      }),
      adminQuery: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = user;
      (req as any).db = mockDb;
      next();
    });
    app.post('/api/rest', restProxy);

    const res = await request(app).post('/api/rest').send({ table: 'patients', operation: 'select' });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain('secret_table');
    expect(res.body.error).toContain('Invalid query');
  });

  it('production error handler does not leak stack traces', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const app = express();
    app.use(express.json());
    app.post('/crash', (_req, _res) => {
      throw new Error('Sensitive internal details about database config');
    });
    app.use(errorHandler);

    const res = await request(app).post('/crash').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.error).not.toContain('Sensitive');

    process.env.NODE_ENV = origEnv;
  });
});

// ─── Table Whitelist ────────────────────────────────────────────────

describe('Table Whitelist', () => {
  const user = { uid: 'u1', tenant_id: 't1', role: 'admin' };

  const dangerousTables = [
    'pg_shadow',
    'pg_authid',
    'information_schema.columns',
    'pg_catalog.pg_proc',
    'auth.users',
    '__migrations',
    'schema_migrations',
  ];

  for (const table of dangerousTables) {
    it(`blocks access to system table "${table}"`, async () => {
      const app = createAuthApp(user);
      const res = await request(app).post('/api/rest').send({ table, operation: 'select' });
      expect(res.status).toBe(403);
    });
  }
});
