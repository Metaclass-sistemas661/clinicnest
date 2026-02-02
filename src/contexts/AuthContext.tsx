import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, UserRole, Tenant, AppRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  tenant: Tenant | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, salonName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userRole?.role === 'admin';

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);

        // Fetch user role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .eq('tenant_id', profileData.tenant_id)
          .single();

        if (roleData) {
          setUserRole(roleData as UserRole);
        }

        // Fetch tenant
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single();

        if (tenantData) {
          setTenant(tenantData as Tenant);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setUserRole(null);
          setTenant(null);
        }
        setIsLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, salonName: string) => {
    // First create the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          salon_name: salonName,
        },
      },
    });

    if (authError) {
      return { error: authError };
    }

    // If signup successful and we have a user, create tenant, profile, and role
    if (authData.user && authData.session) {
      try {
        // Create tenant - the user is now authenticated
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            name: salonName,
          })
          .select('id')
          .single();

        if (tenantError) {
          console.error('Tenant creation error:', tenantError);
          throw tenantError;
        }

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            tenant_id: tenantData.id,
            full_name: fullName,
            email: email,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw profileError;
        }

        // Create admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            tenant_id: tenantData.id,
            role: 'admin' as AppRole,
          });

        if (roleError) {
          console.error('Role creation error:', roleError);
          throw roleError;
        }

        // Create subscription with 5-day trial
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            tenant_id: tenantData.id,
            status: 'trialing',
          });

        if (subscriptionError) {
          console.error('Subscription creation error:', subscriptionError);
          // Don't throw - subscription is not critical for signup
        }

        return { error: null };
      } catch (error) {
        console.error('Signup process error:', error);
        return { error: error as Error };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        tenant,
        isAdmin,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
