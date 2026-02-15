import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GoalMotivationProvider } from "@/contexts/GoalMotivationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminProfitRealtimeListener } from "@/components/admin/AdminProfitRealtimeListener";
import { InternalDarkMode } from "@/components/InternalDarkMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useAuth } from "@/contexts/AuthContext";

// Todas as páginas usam lazy loading para reduzir bundle inicial e habilitar code splitting
const LandingPage = lazyWithRetry(() => import("@/pages/LandingPage"));
const Login = lazyWithRetry(() => import("@/pages/auth/Login"));
const Register = lazyWithRetry(() => import("@/pages/auth/Register"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/auth/ResetPassword"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const TermosDeUso = lazyWithRetry(() => import("@/pages/TermosDeUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("@/pages/PoliticaPrivacidade"));
const Contato = lazyWithRetry(() => import("@/pages/Contato"));
const CanalLgpd = lazyWithRetry(() => import("@/pages/CanalLgpd"));

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Financeiro = lazyWithRetry(() => import("@/pages/Financeiro"));
const Produtos = lazyWithRetry(() => import("@/pages/Produtos"));
const Servicos = lazyWithRetry(() => import("@/pages/Servicos"));
const Clientes = lazyWithRetry(() => import("@/pages/Clientes"));
const Equipe = lazyWithRetry(() => import("@/pages/Equipe"));
const Configuracoes = lazyWithRetry(() => import("@/pages/Configuracoes"));
const Assinatura = lazyWithRetry(() => import("@/pages/Assinatura"));
const GerenciarAssinatura = lazyWithRetry(() => import("@/pages/GerenciarAssinatura"));
const MinhasComissoes = lazyWithRetry(() => import("@/pages/MinhasComissoes"));
const MeusSalarios = lazyWithRetry(() => import("@/pages/MeusSalarios"));
const Metas = lazyWithRetry(() => import("@/pages/Metas"));
const MinhasMetas = lazyWithRetry(() => import("@/pages/MinhasMetas"));
const Notificacoes = lazyWithRetry(() => import("@/pages/Notificacoes"));
const MinhasConfiguracoes = lazyWithRetry(() => import("@/pages/MinhasConfiguracoes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minuto - dados estáticos (categorias, profissionais) ficam em cache
      gcTime: 5 * 60 * 1000, // 5 minutos (antes cacheTime)
    },
  },
});

function GlobalAdminProfitListener() {
  const auth = useAuth();
  if (!auth?.user || !auth?.isAdmin) return null;
  return <AdminProfitRealtimeListener />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <GoogleAnalytics />
          <CookieConsentBanner />
          <AuthProvider>
            <GoalMotivationProvider>
            <InternalDarkMode />
            <GlobalAdminProfitListener />
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/contato" element={<Contato />} />
                <Route path="/canal-lgpd" element={<CanalLgpd />} />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <>
                        <WelcomeModal />
                        <Dashboard />
                      </>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agenda"
                  element={
                    <ProtectedRoute>
                      <Agenda />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/financeiro"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Financeiro />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/minhas-comissoes"
                  element={
                    <ProtectedRoute>
                      <MinhasComissoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meus-salarios"
                  element={
                    <ProtectedRoute>
                      <MeusSalarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/produtos"
                  element={
                    <ProtectedRoute>
                      <Produtos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/servicos"
                  element={
                    <ProtectedRoute>
                      <Servicos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clientes"
                  element={
                    <ProtectedRoute>
                      <Clientes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/metas"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Metas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/minhas-metas"
                  element={
                    <ProtectedRoute>
                      <MinhasMetas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notificacoes"
                  element={
                    <ProtectedRoute>
                      <Notificacoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/minhas-configuracoes"
                  element={
                    <ProtectedRoute>
                      <MinhasConfiguracoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/equipe"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Equipe />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Configuracoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assinatura"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Assinatura />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assinatura/gerenciar"
                  element={
                    <ProtectedRoute requireAdmin>
                      <GerenciarAssinatura />
                    </ProtectedRoute>
                  }
                />

                  {/* Catch all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
            </GoalMotivationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
