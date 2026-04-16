/**
 * Firebase Auth Admin — Firebase Auth Admin
 * 
 * 100% GCP — uses firebase-admin for user management.
 * Provides the same method signatures used by the migrated functions.
 */
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

// Ensure Firebase Admin is initialized (auth.ts already initializes it,
// but this is a safe guard in case this module loads first)
function getAuth() {
  if (!admin.apps.length) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (key) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
    } else {
      admin.initializeApp();
    }
  }
  return admin.auth();
}

// ─── Types ────────────────────────────────────────────────────────────────
interface AuthResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface CreateUserParams {
  email: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface UpdateUserParams {
  email?: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  displayName?: string;
}

interface GenerateLinkParams {
  type: 'signup' | 'magiclink' | 'invite' | 'recovery' | 'email_change_new' | 'email_change_current';
  email: string;
  password?: string;
  options?: {
    redirectTo?: string;
    data?: Record<string, any>;
  };
}

// ─── Admin Auth Methods ───────────────────────────────────────────────────
async function createUser(params: CreateUserParams): Promise<AuthResult<{ user: admin.auth.UserRecord }>> {
  try {
    const auth = getAuth();
    // Generate UUID for Firebase UID — ensures compatibility with PostgreSQL UUID columns
    const uid = randomUUID();
    const userRecord = await auth.createUser({
      uid,
      email: params.email,
      password: params.password,
      emailVerified: params.email_confirm ?? false,
      displayName: params.user_metadata?.full_name || params.user_metadata?.name,
    });

    // Store custom claims (tenant_id, role, etc.)
    if (params.app_metadata || params.user_metadata) {
      await auth.setCustomUserClaims(userRecord.uid, {
        ...(params.app_metadata || {}),
        ...(params.user_metadata || {}),
      });
    }

    return { data: { user: userRecord }, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

async function deleteUser(uid: string): Promise<AuthResult<void>> {
  try {
    const auth = getAuth();
    await auth.deleteUser(uid);
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

async function updateUserById(uid: string, params: UpdateUserParams): Promise<AuthResult<{ user: admin.auth.UserRecord }>> {
  try {
    const auth = getAuth();
    const updateRequest: admin.auth.UpdateRequest = {};

    if (params.email) updateRequest.email = params.email;
    if (params.password) updateRequest.password = params.password;
    if (params.email_confirm !== undefined) updateRequest.emailVerified = params.email_confirm;
    if (params.displayName) updateRequest.displayName = params.displayName;

    const userRecord = await auth.updateUser(uid, updateRequest);

    if (params.user_metadata || params.app_metadata) {
      const existingClaims = userRecord.customClaims || {};
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        ...(params.app_metadata || {}),
        ...(params.user_metadata || {}),
      });
    }

    return { data: { user: userRecord }, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

async function getUserByEmail(email: string): Promise<AuthResult<admin.auth.UserRecord>> {
  try {
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    return { data: user, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

async function generateLink(params: GenerateLinkParams): Promise<AuthResult<{ properties: { action_link: string } }>> {
  try {
    const auth = getAuth();
    let link: string;

    const actionCodeSettings = {
      url: params.options?.redirectTo || process.env.APP_URL || 'https://clinicnest.metaclass.com.br',
      handleCodeInApp: true,
    };

    switch (params.type) {
      case 'signup':
      case 'invite':
        // Create user first if needed, then send verification
        link = await auth.generateEmailVerificationLink(params.email, actionCodeSettings);
        break;
      case 'recovery':
        link = await auth.generatePasswordResetLink(params.email, actionCodeSettings);
        break;
      case 'magiclink':
        link = await auth.generateSignInWithEmailLink(params.email, actionCodeSettings);
        break;
      case 'email_change_new':
      case 'email_change_current':
        link = await auth.generateEmailVerificationLink(params.email, actionCodeSettings);
        break;
      default:
        link = await auth.generateEmailVerificationLink(params.email, actionCodeSettings);
    }

    return { data: { properties: { action_link: link } }, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

// ─── getUser (verify token) ───────────────────────────────────────────────
async function getUser(token: string): Promise<AuthResult<{ user: { id: string; email: string; user_metadata: any } }>> {
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    const userRecord = await auth.getUser(decoded.uid);

    return {
      data: {
        user: {
          id: userRecord.uid,
          email: userRecord.email || '',
          user_metadata: userRecord.customClaims || {},
        }
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

// ─── Auth Client (mimics admin auth API) ─────────────────────────────
export interface AuthAdminClient {
  admin: {
    createUser: typeof createUser;
    deleteUser: typeof deleteUser;
    updateUserById: typeof updateUserById;
    getUserByEmail: typeof getUserByEmail;
    generateLink: typeof generateLink;
  };
  getUser: typeof getUser;
}

export function createAuthAdmin(): AuthAdminClient {
  return {
    admin: {
      createUser,
      deleteUser,
      updateUserById,
      getUserByEmail,
      generateLink,
    },
    getUser,
  };
}
