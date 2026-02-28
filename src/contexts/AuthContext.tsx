import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { Profile, UserRole, Tenant, ProfessionalType, PermissionsMap } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  tenant: Tenant | null;
  /** Atalho para profile?.tenant_id — usado por dezenas de hooks (useRooms, usePatientQueue, etc.) */
  tenantId: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  professionalType: ProfessionalType;
  permissions: PermissionsMap;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    clinicName: string,
    phone: string,
    legalAcceptedAt?: string,
    professionalData?: {
      professional_type?: string;
      council_type?: string;
      council_number?: string;
      council_state?: string;
    }
  ) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Retorna a URL base do site para redirecionamentos de autenticação.
 * Em produção, sempre usa a URL de produção para evitar links de localhost em emails.
 * Em desenvolvimento (localhost), usa localhost para facilitar testes.
 */
function getAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return "";
  
  const origin = window.location.origin;
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  
  // Em produção, sempre usar URL de produção
  // Em desenvolvimento, usar localhost para facilitar testes locais
  if (!isLocalhost) {
    return origin;
  }
  
  // Para desenvolvimento: verificar se há uma variável de ambiente de produção
  // Se VITE_PRODUCTION_URL estiver definida, usar ela para emails (evita localhost em emails)
  const productionUrl = import.meta.env.VITE_PRODUCTION_URL;
  if (productionUrl && typeof productionUrl === "string") {
    return productionUrl.replace(/\/+$/, "");
  }
  
  // Fallback: usar URL de produção via env var para evitar localhost em emails
  return import.meta.env.VITE_APP_URL || "https://clinicnest.metaclass.com.br";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const siteOrigin = getAuthRedirectOrigin();

  const isAdmin = userRole?.role === 'admin';
  const professionalType: ProfessionalType = profile?.professional_type ?? 'secretaria';
  const tenantId = profile?.tenant_id ?? null;

  const fetchUserData = async (userId: string): Promise<{ profile: Profile | null; userRole: UserRole | null; tenant: Tenant | null; permissions: PermissionsMap }> => {
    try {
      // Prefer single-roundtrip context load via RPC (enterprise hardening)
      try {
        const { data: ctx, error: ctxError } = await (supabase as any).rpc("get_my_context");
        if (!ctxError && ctx) {
          const ctxAny = ctx as any;
          const profileData = (ctxAny.profile ?? null) as Profile | null;
          const roleData = (ctxAny.role ?? null) as UserRole | null;
          const tenantData = (ctxAny.tenant ?? null) as Tenant | null;
          const permsData = (ctxAny.permissions ?? {}) as PermissionsMap;

          if (profileData?.user_id === userId) {
            return { profile: profileData, userRole: roleData, tenant: tenantData, permissions: permsData };
          }
        }
      } catch {
        // Fallback to legacy multi-query path
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profileData) return { profile: null, userRole: null, tenant: null, permissions: {} };

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
        permissions: {},
      };
    } catch (error) {
      logger.error('Error fetching user data:', error);
      return { profile: null, userRole: null, tenant: null, permissions: {} };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchUserData(user.id);
      if (data.profile) setProfile(data.profile);
      setUserRole(data.userRole);
      setTenant(data.tenant);
      setPermissions(data.permissions);
    }
  };

  /**
   * Aplica a sessão e garante que profile/tenant estejam carregados antes de liberar a UI.
   * Atualiza profile, userRole e tenant em batch junto com isLoading para evitar race
   * entre state updates e re-render do Dashboard.
   */
  const applySession = async (session: Session | null) => {
    // Ignorar sessões de paciente — o portal do paciente usa seu próprio client isolado.
    // Isso evita que login de paciente em outra aba derrube a sessão da clínica.
    if (session?.user?.user_metadata?.account_type === 'patient') {
      // Não alterar estado — manter sessão atual da clínica intacta
      setIsLoading(false);
      return;
    }

    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      const data = await fetchUserData(session.user.id);
      setProfile(data.profile);
      setUserRole(data.userRole);
      setTenant(data.tenant);
      setPermissions(data.permissions);
    } else {
      setProfile(null);
      setUserRole(null);
      setTenant(null);
      setPermissions({});
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

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    clinicName: string,
    phone: string,
    legalAcceptedAt?: string,
    professionalData?: {
      professional_type?: string;
      council_type?: string;
      council_number?: string;
      council_state?: string;
    }
  ) => {
    // Cria usuário no Auth. O trigger handle_new_user() cria automaticamente:
    // tenant, profile, user_roles (admin) e subscription - garantindo admin sempre
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: siteOrigin ? `${siteOrigin}/login` : undefined,
        data: {
          full_name: fullName,
          clinic_name: clinicName,
          phone,
          terms_accepted: true,
          privacy_policy_accepted: true,
          legal_accepted_at: legalAcceptedAt || new Date().toISOString(),
          ...(professionalData?.professional_type && {
            professional_type: professionalData.professional_type,
          }),
          ...(professionalData?.council_type && {
            council_type: professionalData.council_type,
          }),
          ...(professionalData?.council_number && {
            council_number: professionalData.council_number,
          }),
          ...(professionalData?.council_state && {
            council_state: professionalData.council_state,
          }),
        },
      },
    });

    if (authError) {
      return { error: authError };
    }

    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const redirectTo = siteOrigin ? `${siteOrigin}/reset-password` : undefined;
    try {
      // Chamar Edge Function para enviar email customizado
      // A Edge Function buscará o nome do usuário internamente
      // Não precisa de autenticação para reset de senha
      const { data, error } = await supabase.functions.invoke("send-custom-auth-email", {
        body: {
          email,
          type: "password_reset",
          redirectTo,
        },
      });

      if (error) {
        // Fallback para método padrão do Supabase se Edge Function falhar
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        return { error: fallbackError || error };
      }

      if (!data?.success) {
        // Fallback para método padrão
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        return { error: fallbackError || new Error(data?.message || "Erro ao enviar email") };
      }

      return { error: null };
    } catch (err) {
      // Fallback para método padrão em caso de erro
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
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
    setPermissions({});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        tenant,
        tenantId,
        isAdmin,
        isLoading,
        professionalType,
        permissions,
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
