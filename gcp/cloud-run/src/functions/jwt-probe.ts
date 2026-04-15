/**
 * jwt-probe — Cloud Run handler */

import { Request, Response } from 'express';
import { createAuthAdmin } from '../shared/auth-admin';

export async function jwtProbe(req: Request, res: Response) {
  try {
    // CORS handled by middleware
      const authResult = await await (async () => { const authAdmin = createAuthAdmin(); const token = ((req.headers['authorization'] as string) || '').replace('Bearer ', ''); return authAdmin.getUser(token); })();
      if (authResult.error) return authResult.error;

      return new Response(
        JSON.stringify({ ok: true, userId: authResult.data?.user.id }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
  } catch (err: any) {
    console.error(`[jwt-probe] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

