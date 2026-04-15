/**
 * Firebase Auth module.
 * Provides the same interface used by AuthContext.tsx
 */
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  User,
  sendPasswordResetEmail,
  confirmPasswordReset as fbConfirmPasswordReset,
  updatePassword as firebaseUpdatePassword,
  type Auth,
  type Unsubscribe,
} from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';
import { clearTokenCache } from './client';
import { logger } from '@/lib/logger';

export interface AuthUser {
  id: string;
  email: string | null;
  user_metadata?: Record<string, any>;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
}

let _auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!_auth) {
    const app = getFirebaseApp();
    if (!app) throw new Error('Firebase not initialized');
    _auth = getAuth(app);
  }
  return _auth;
}

function mapUser(fbUser: User | null): AuthUser | null {
  if (!fbUser) return null;
  return {
    id: fbUser.uid,
    email: fbUser.email,
    user_metadata: {
      full_name: fbUser.displayName,
      avatar_url: fbUser.photoURL,
    },
  };
}

async function mapSession(fbUser: User | null): Promise<AuthSession | null> {
  if (!fbUser) return null;
  try {
    const token = await fbUser.getIdToken();
    return {
      user: mapUser(fbUser)!,
      access_token: token,
    };
  } catch (err) {
    logger.warn('[auth] Failed to get ID token for session mapping', err);
    return null;
  }
}

/**
 * Firebase Auth client — API compatible with what AuthContext expects.
 */
export const auth = {
  async signInWithPassword(opts: { email: string; password: string; options?: { captchaToken?: string } }) {
    try {
      const fbAuth = getFirebaseAuth();
      const result = await signInWithEmailAndPassword(fbAuth, opts.email, opts.password);
      const session = await mapSession(result.user);
      return { data: { user: mapUser(result.user), session }, error: null };
    } catch (err: any) {
      logger.error('[auth] signInWithPassword failed', err.code);
      return { data: { user: null, session: null }, error: err };
    }
  },

  async signOut() {
    try {
      const fbAuth = getFirebaseAuth();
      // Sign out from Firebase FIRST, then clear the local cache.
      // This prevents a race where a request could use a stale token.
      await firebaseSignOut(fbAuth);
      clearTokenCache();
      return { error: null };
    } catch (err: any) {
      // Even if Firebase signOut fails, clear local cache to avoid stale state.
      clearTokenCache();
      logger.error('[auth] signOut error', err);
      return { error: err };
    }
  },

  async getSession() {
    try {
      const fbAuth = getFirebaseAuth();
      const user = fbAuth.currentUser;
      const session = await mapSession(user);
      return { data: { session }, error: null };
    } catch (err: any) {
      return { data: { session: null }, error: err };
    }
  },

  async getUser() {
    try {
      const fbAuth = getFirebaseAuth();
      const user = fbAuth.currentUser;
      return { data: { user: mapUser(user) }, error: null };
    } catch (err: any) {
      return { data: { user: null }, error: err };
    }
  },

  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string; captchaToken?: string }) {
    try {
      const fbAuth = getFirebaseAuth();
      await sendPasswordResetEmail(fbAuth, email, {
        url: opts?.redirectTo || window.location.origin + '/login',
      });
      return { data: {}, error: null };
    } catch (err: any) {
      logger.error('[auth] resetPasswordForEmail failed', err.code);
      return { data: null, error: err };
    }
  },

  /**
   * Confirm password reset using the oobCode from the Firebase email link.
   */
  async confirmPasswordReset(oobCode: string, newPassword: string) {
    try {
      const fbAuth = getFirebaseAuth();
      await fbConfirmPasswordReset(fbAuth, oobCode, newPassword);
      return { data: {}, error: null };
    } catch (err: any) {
      logger.error('[auth] confirmPasswordReset failed', err.code);
      return { data: null, error: err };
    }
  },

  async updateUser(updates: { password?: string }) {
    try {
      const fbAuth = getFirebaseAuth();
      const user = fbAuth.currentUser;
      if (!user) return { data: null, error: new Error('Not authenticated') };

      if (updates.password) {
        await firebaseUpdatePassword(user, updates.password);
      }
      return { data: { user: mapUser(user) }, error: null };
    } catch (err: any) {
      logger.error('[auth] updateUser failed', err.code);
      return { data: null, error: err };
    }
  },

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): { data: { subscription: { unsubscribe: Unsubscribe } } } {
    const fbAuth = getFirebaseAuth();
    let isFirst = true;
    let destroyed = false;

    // Use onIdTokenChanged (fires on both auth state AND token refresh)
    const unsubscribe = onIdTokenChanged(fbAuth, async (user) => {
      if (destroyed) return;

      const session = await mapSession(user);
      const event = isFirst ? 'INITIAL_SESSION' : (user ? 'SIGNED_IN' : 'SIGNED_OUT');
      isFirst = false;

      if (!user) {
        clearTokenCache();
      }

      if (!destroyed) {
        callback(event, session);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            destroyed = true;
            unsubscribe();
          },
        },
      },
    };
  },
};

export type { User as FirebaseUser };
