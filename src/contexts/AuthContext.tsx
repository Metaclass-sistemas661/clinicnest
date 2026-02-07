import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, UserRole, Tenant } from '@/types/database';

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
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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

  const fetchUserData = async (userId: string): Promise<{ profile: Profile | null; userRole: UserRole | null; tenant: Tenant | null }> => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profileData) return { profile: null, userRole: null, tenant: null };

      let roleData: UserRole | null = null;
      let tenantData: Tenant | null = null;

      const { data: role } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', profileData.tenant_id)
        .single();
      if (role) roleData = role as UserRole;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profileData.tenant_id)
        .single();
      if (tenant) tenantData = tenant as Tenant;

      return {
        profile: profileData as Profile,
        userRole: roleData,
        tenant: tenantData,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, userRole: null, tenant: null };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchUserData(user.id);
      if (data.profile) setProfile(data.profile);
      setUserRole(data.userRole);
      setTenant(data.tenant);
    }
  };

  /**
   * Aplica a sessão e garante que profile/tenant estejam carregados antes de liberar a UI.
   * Atualiza profile, userRole e tenant em batch junto com isLoading para evitar race
   * entre state updates e re-render do Dashboard.
   */
  const applySession = async (session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      const data = await fetchUserData(session.user.id);
      setProfile(data.profile);
      setUserRole(data.userRole);
      setTenant(data.tenant);
    } else {
      setProfile(null);
      setUserRole(null);
      setTenant(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const applySessionSafe = async (session: Session | null) => {
      await applySession(session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) applySessionSafe(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) applySessionSafe(session);
    });

    return () => {
      cancelled = true;
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
    // Cria usuário no Auth. O trigger handle_new_user() cria automaticamente:
    // tenant, profile, user_roles (admin) e subscription - garantindo admin sempre
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Sempre usar vynlobella.com para evitar redirect para vercel.app no mobile
        emailRedirectTo: "https://vynlobella.com/login",
        data: {
          full_name: fullName,
          salon_name: salonName,
        },
      },
    });

    if (authError) {
      return { error: authError };
    }

    return { error: null };
  };

  const resetPassword = async (email: string) => {
    try {
      // Chamar Edge Function para enviar email customizado
      // A Edge Function buscará o nome do usuário internamente
      // Não precisa de autenticação para reset de senha
      const { data, error } = await supabase.functions.invoke("send-custom-auth-email", {
        body: {
          email,
          type: "password_reset",
        },
      });

      if (error) {
        // Fallback para método padrão do Supabase se Edge Function falhar
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: "https://vynlobella.com/reset-password",
        });
        return { error: fallbackError || error };
      }

      if (!data?.success) {
        // Fallback para método padrão
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: "https://vynlobella.com/reset-password",
        });
        return { error: fallbackError || new Error(data?.message || "Erro ao enviar email") };
      }

      return { error: null };
    } catch (err) {
      // Fallback para método padrão em caso de erro
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://vynlobella.com/reset-password",
      });
      return { error: error || (err instanceof Error ? err : new Error("Erro ao solicitar recuperação de senha")) };
    }
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
        resetPassword,
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
