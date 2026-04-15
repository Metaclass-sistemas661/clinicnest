/**
 * Database connection — Cloud SQL PostgreSQL * 
 * Uses pg Pool with Cloud SQL connection.
 * Sets session variables (current_user_id, jwt_claims, user_role)
 * so that RLS policies work via current_setting().
 */
import { Pool, PoolClient } from 'pg';
import { Request, Response, NextFunction } from 'express';

const pool = new Pool({
  connectionString: process.env.CLOUDSQL_CONNECTION_STRING,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Get a raw pool connection (for admin/internal operations).
 */
export async function getAdminClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Execute a query with admin privileges (no RLS context).
 */
export async function adminQuery(text: string, params?: any[]) {
  return pool.query(text, params);
}

/**
 * Execute a query with user context (RLS-aware).
 * Sets session variables so current_setting() works in policies.
 */
export async function userQuery(
  userId: string,
  tenantId: string,
  role: string,
  text: string,
  params?: any[]
) {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.jwt_claims', $1, true)", [
      JSON.stringify({ sub: userId, tenant_id: tenantId, role })
    ]);
    await client.query("SELECT set_config('app.user_role', $1, true)", [role]);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Express middleware: attach db helpers to req for authenticated routes.
 * Sets PostgreSQL session variables for RLS enforcement.
 */
export function dbMiddleware(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user) {
    (req as any).db = {
      query: (text: string, params?: any[]) =>
        userQuery(user.uid, user.tenant_id, user.role || 'authenticated', text, params),
      adminQuery,
    };
  } else {
    (req as any).db = { query: adminQuery, adminQuery };
  }
  next();
}

export { pool };
