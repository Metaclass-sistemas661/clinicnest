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
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: Error | null }>;
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
    },
    captchaToken?: string,
  ) => Promise<{ error: Error | null; emailSent?: boolean }>;
  resetPassword: (email: string, captchaToken?: string) => Promise<{ error: Error | null }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ error: Error | null; message?: string }>;
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

/** Normaliza erros de signup/auth do Supabase e Edge Functions para PT-BR */
function normalizeSignUpError(message: string): string {
  const m = message.toLowerCase();
  // Email já existe
  if (m.includes("already been registered") || m.includes("already exists") || m.includes("já está cadastrado") || m.includes("already registered"))
    return "Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.";
  // Senha fraca
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("length")))
    return "A senha é muito fraca. Use no mínimo 6 caracteres.";
  // Rate limit
  if (m.includes("rate limit") || m.includes("too many") || m.includes("exceeded"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  // Captcha
  if (m.includes("captcha"))
    return "Erro na verificação de segurança. Recarregue a página e tente novamente.";
  // Email inválido
  if (m.includes("invalid") && m.includes("email"))
    return "O e-mail informado não é válido.";
  // Signup desabilitado
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "O cadastro de novas contas está temporariamente desabilitado.";
  // Network / fetch
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  // Já está em PT-BR ou mensagem desconhecida — retornar como está
  return message;
}

/** Normaliza erros genéricos de auth (login, reset, etc.) para PT-BR */
function normalizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (m.includes("user not found"))
    return "Nenhuma conta encontrada com esse e-mail.";
  if (m.includes("captcha"))
    return "Erro na verificação de segurança. Recarregue a página e tente novamente.";
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  if (m.includes("session expired") || m.includes("refresh_token"))
    return "Sua sessão expirou. Faça login novamente.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short")))
    return "A senha é muito fraca. Use no mínimo 6 caracteres.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "O cadastro está temporariamente desabilitado.";
  return message;
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
        if (ctxError) {
          logger.warn('[AuthContext] get_my_context RPC failed:', ctxError.message);
        }
        if (!ctxError && ctx) {
          const ctxAny = ctx as any;
          const profileData = (ctxAny.profile ?? null) as Profile | null;
          const roleData = (ctxAny.role ?? null) as UserRole | null;
          const tenantData = (ctxAny.tenant ?? null) as Tenant | null;
          const permsData = (ctxAny.permissions ?? {}) as PermissionsMap;

          if (profileData?.user_id === userId) {
            logger.info('[AuthContext] Loaded via RPC — role:', roleData?.role, 'isAdmin:', roleData?.role === 'admin');
            return { profile: profileData, userRole: roleData, tenant: tenantData, permissions: permsData };
          }
        }
      } catch (rpcErr) {
        logger.warn('[AuthContext] get_my_context exception:', rpcErr);
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
   * Usa um ref para serializar chamadas e evitar que applySession rode em paralelo
   * (ex: INITIAL_SESSION + TOKEN_REFRESHED disparados em sequência).
   */
  const applyRef = React.useRef(0);

  const applySession = async (session: Session | null, event?: string) => {
    const seq = ++applyRef.current; // gera número de sequência

    // Ignorar sessões de paciente — o portal do paciente usa seu próprio client isolado.
    if (session?.user?.user_metadata?.account_type === 'patient') {
      setIsLoading(false);
      return;
    }

    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      // Garante que isLoading = true enquanto os dados do perfil/role/tenant são carregados.
      // Sem isso, ProtectedRoute avalia permissões antes de userRole estar disponível → 403 falso.
      // EXCEÇÃO: TOKEN_REFRESHED — o usuário já está autenticado e o perfil já foi carregado.
      // Mostrar o spinner nesse caso desmonta a página atual e apaga qualquer estado local
      // (ex: formulário de prontuário aberto), péssima UX.
      if (event !== 'TOKEN_REFRESHED') {
        setIsLoading(true);
      }

      const data = await fetchUserData(session.user.id);
      // Se outra chamada mais recente já disparou, descartar este resultado
      if (applyRef.current !== seq) {
        logger.info('[AuthContext] applySession descartado (seq antigo)');
        return;
      }
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

    // Supabase v2 onAuthStateChange emits INITIAL_SESSION on subscribe,
    // so there is no need for a separate getSession() call.
    // This avoids race conditions where both fire and cause double processing.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        logger.info('[AuthContext] onAuthStateChange event:', event);
        applySession(session, event);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
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
    },
    _captchaToken?: string,
  ) => {
    // Usa Edge Function register-user para:
    // 1. Criar usuário via admin.createUser (NÃO envia email padrão do Supabase)
    // 2. Gerar link de confirmação
    // 3. Enviar email customizado via Resend com template ClinicNest
    // O trigger handle_new_user() continua criando tenant, profile, user_roles e subscription
    try {
      const { data, error } = await supabase.functions.invoke("register-user", {
        body: {
          email,
          password,
          fullName,
          clinicName,
          phone,
          legalAcceptedAt,
          professionalData,
        },
      });

      // Edge Function retornou resposta (pode ser erro de negócio no body)
      if (!error && data) {
        if (data.success) {
          return { error: null, emailSent: data.emailSent !== false };
        }
        // Erro de negócio (email já existe, validação, etc.)
        const msg = data.error || "Erro ao criar conta";
        return { error: new Error(normalizeSignUpError(msg)) };
      }

      // A partir daqui, não usamos fallback nativo:
      // o fluxo oficial de cadastro deve passar pela edge function (Resend + template customizado).
      const edgeMsg =
        error?.message ||
        data?.error ||
        data?.message ||
        "Falha ao criar conta via serviço de cadastro";
      return { error: new Error(normalizeSignUpError(edgeMsg)) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: new Error(normalizeSignUpError(msg)) };
    }
  };

  const verifyEmailCode = async (email: string, code: string): Promise<{ error: Error | null; message?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-email-code", {
        body: { email, code },
      });

      if (!error && data) {
        if (data.success) {
          return { error: null, message: data.message };
        }
        const msg = data.error || "Código inválido";
        return { error: new Error(msg) };
      }

      const edgeMsg = error?.message || data?.error || "Erro ao verificar código";
      return { error: new Error(edgeMsg) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: new Error(msg) };
    }
  };

  const resetPassword = async (email: string, captchaToken?: string) => {
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
          captchaToken,
        });
        return { error: fallbackError || error };
      }

      if (!data?.success) {
        // Fallback para método padrão
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
          captchaToken,
        });
        return { error: fallbackError || new Error(data?.message || "Erro ao enviar email") };
      }

      return { error: null };
    } catch (err) {
      // Fallback para método padrão em caso de erro
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
        captchaToken,
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
        verifyEmailCode,
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
