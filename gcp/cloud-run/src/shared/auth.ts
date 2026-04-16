/**
 * Firebase Auth middleware
 * Replaces: _shared/auth.ts (JWT validation)
 * 
 * Validates Firebase ID token from Authorization header,
 * extracts user info, and attaches to req.user.
 */
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { adminQuery } from './db';

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or default SA)
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      process.stderr.write(`[auth] Firebase Admin initialized with SA key for project: ${serviceAccount.project_id}\n`);
    } catch (parseErr: any) {
      process.stderr.write(`[auth] FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${parseErr.message}\n`);
      admin.initializeApp();
    }
  } else {
    process.stderr.write('[auth] WARNING: No FIREBASE_SERVICE_ACCOUNT_KEY, using default credentials\n');
    admin.initializeApp();
  }
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  tenant_id: string;
  role: string;
  professional_type?: string;
}

/**
 * Express middleware: validates Firebase JWT and loads tenant from DB.
 * Attaches req.user with uid, email, tenant_id, role.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Load tenant_id and role from profiles table
    let profile: any = null;
    try {
      const result = await adminQuery(
        `SELECT p.tenant_id, ur.role, p.professional_type
         FROM profiles p
         LEFT JOIN user_roles ur ON ur.user_id = p.user_id AND ur.tenant_id = p.tenant_id
         WHERE p.user_id = $1
         LIMIT 1`,
        [decoded.uid]
      );
      profile = result.rows[0] || null;
    } catch (dbErr: any) {
      // DB error (e.g. UUID cast failure) — don't mask as 401
      process.stderr.write(`[authMiddleware] DB error loading profile: ${dbErr.message}\n`);
    }
    
    // Auto-provision: if Firebase user is verified but has no profile, create one
    if (!profile && decoded.email_verified) {
      try {
        const firebaseUser = await admin.auth().getUser(decoded.uid);
        const claims = firebaseUser.customClaims || {};
        const fullName = claims.full_name || firebaseUser.displayName || decoded.email || '';
        const clinicName = claims.clinic_name || fullName;
        const phone = claims.phone || firebaseUser.phoneNumber || '';
        const userEmail = decoded.email || '';

        const tenantResult = await adminQuery(
          `INSERT INTO tenants (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
          [clinicName, userEmail, phone]
        );
        const tenantId = tenantResult.rows[0].id;

        await adminQuery(
          `INSERT INTO profiles (user_id, tenant_id, full_name, email, phone, professional_type, council_type, council_number, council_state)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [decoded.uid, tenantId, fullName, userEmail, phone,
           claims.professional_type || null, claims.council_type || null,
           claims.council_number || null, claims.council_state || null]
        );

        await adminQuery(
          `INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin')`,
          [decoded.uid, tenantId]
        );

        await adminQuery(
          `INSERT INTO subscriptions (tenant_id, status, plan) VALUES ($1, 'trialing', 'trial')`,
          [tenantId]
        );

        process.stderr.write(`[authMiddleware] Auto-provisioned profile for ${decoded.uid}\n`);
        profile = { tenant_id: tenantId, role: 'admin', professional_type: claims.professional_type || null };
      } catch (provErr: any) {
        process.stderr.write(`[authMiddleware] Auto-provision failed: ${provErr.message}\n`);
      }
    }
    
    (req as any).user = {
      uid: decoded.uid,
      email: decoded.email || '',
      tenant_id: profile?.tenant_id || '',
      role: profile?.role || 'authenticated',
      professional_type: profile?.professional_type || null,
    } as AuthenticatedUser;
    
    next();
  } catch (error: any) {
    process.stderr.write(`[authMiddleware] FAIL: code=${error.code} msg=${error.message}\n`);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token', detail: error.code || error.message });
  }
}

/**
 * Verify internal/cron requests (by secret key, not JWT).
 */
export function internalAuthMiddleware(secretEnvVar: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const expected = process.env[secretEnvVar];
    const provided = req.headers['x-secret-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!expected || provided !== expected) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
