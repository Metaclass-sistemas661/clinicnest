import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GoalMotivationProvider } from "@/contexts/GoalMotivationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PatientProtectedRoute } from "@/components/auth/PatientProtectedRoute";
import { AdminProfitRealtimeListener } from "@/components/admin/AdminProfitRealtimeListener";
import { NewOnlineBookingListener } from "@/components/admin/NewOnlineBookingListener";
import { InternalDarkMode } from "@/components/InternalDarkMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useAuth } from "@/contexts/AuthContext";
import { TourProvider } from "@/contexts/TourContext";
import { AppStatusProvider } from "@/contexts/AppStatusContext";

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

const AgendarOnline = lazyWithRetry(() => import("@/pages/AgendarOnline"));
const ConfirmarAgendamento = lazyWithRetry(() => import("@/pages/ConfirmarAgendamento"));

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Financeiro = lazyWithRetry(() => import("@/pages/Financeiro"));
const Produtos = lazyWithRetry(() => import("@/pages/Produtos"));
const Compras = lazyWithRetry(() => import("@/pages/Compras"));
const Fornecedores = lazyWithRetry(() => import("@/pages/Fornecedores"));
const Servicos = lazyWithRetry(() => import("@/pages/Servicos"));
const Clientes = lazyWithRetry(() => import("@/pages/Clientes"));
const Teleconsulta = lazyWithRetry(() => import("@/pages/Teleconsulta"));
const ModelosProntuario = lazyWithRetry(() => import("@/pages/ModelosProntuario"));
const FaturamentoTISS = lazyWithRetry(() => import("@/pages/FaturamentoTISS"));
const Chat = lazyWithRetry(() => import("@/pages/Chat"));
const Unidades = lazyWithRetry(() => import("@/pages/Unidades"));
const Disponibilidade = lazyWithRetry(() => import("@/pages/Disponibilidade"));
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
const Suporte = lazyWithRetry(() => import("@/pages/Suporte"));
const Ajuda = lazyWithRetry(() => import("@/pages/Ajuda"));
const Auditoria = lazyWithRetry(() => import("@/pages/Auditoria"));
const DiagnosticoSeguranca = lazyWithRetry(() => import("@/pages/DiagnosticoSeguranca"));
const Campanhas = lazyWithRetry(() => import("@/pages/Campanhas"));
const RelatorioFinanceiro = lazyWithRetry(() => import("@/pages/RelatorioFinanceiro"));
const Relatorios = lazyWithRetry(() => import("@/pages/Relatorios"));
const Integracoes = lazyWithRetry(() => import("@/pages/Integracoes"));

const Automacoes = lazyWithRetry(() => import("@/pages/Automacoes"));
const NpsPublico = lazyWithRetry(() => import("@/pages/NpsPublico"));

// Portal do Paciente
const PatientLogin = lazyWithRetry(() => import("@/pages/paciente/PatientLogin"));
const PatientRegister = lazyWithRetry(() => import("@/pages/paciente/PatientRegister"));
const PatientDashboard = lazyWithRetry(() => import("@/pages/paciente/PatientDashboard"));

const AgendamentoOnlineAdmin = lazyWithRetry(() => import("@/pages/AgendamentoOnlineAdmin"));
const FidelidadeCashbackAdmin = lazyWithRetry(() => import("@/pages/FidelidadeCashbackAdmin"));
const Vouchers = lazyWithRetry(() => import("@/pages/Vouchers"));
const Cupons = lazyWithRetry(() => import("@/pages/Cupons"));

// Páginas médicas (novas)
const Prontuarios = lazyWithRetry(() => import("@/pages/Prontuarios"));
const Convenios = lazyWithRetry(() => import("@/pages/Convenios"));
const Receituarios = lazyWithRetry(() => import("@/pages/Receituarios"));
const Laudos = lazyWithRetry(() => import("@/pages/Laudos"));
const Triagem = lazyWithRetry(() => import("@/pages/Triagem"));
const Especialidades = lazyWithRetry(() => import("@/pages/Especialidades"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minuto - dados estáticos (categorias, profissionais) ficam em cache
      gcTime: 5 * 60 * 1000, // 5 minutos (antes cacheTime)
    },
  },
});

function GlobalAdminListeners() {
  const auth = useAuth();
  if (!auth?.user || !auth?.isAdmin) return null;
  return (
    <>
      <AdminProfitRealtimeListener />
      <NewOnlineBookingListener />
    </>
  );
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
            <AppStatusProvider>
              <GoalMotivationProvider>
              <TourProvider>
                <InternalDarkMode />
                <GlobalAdminListeners />
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
                <Route path="/agendar/:slug" element={<AgendarOnline />} />
                <Route path="/confirmar/:token" element={<ConfirmarAgendamento />} />
                <Route path="/nps/:token" element={<NpsPublico />} />

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
                  path="/compras"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Compras />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fornecedores"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Fornecedores />
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
                  path="/teleconsulta"
                  element={
                    <ProtectedRoute>
                      <Teleconsulta />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/unidades"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Unidades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/disponibilidade"
                  element={
                    <ProtectedRoute>
                      <Disponibilidade />
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
                  path="/auditoria"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Auditoria />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/diagnostico-seguranca"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DiagnosticoSeguranca />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agendamento-online"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AgendamentoOnlineAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fidelidade-cashback"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FidelidadeCashbackAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vouchers"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Vouchers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cupons"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Cupons />
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

                <Route
                  path="/suporte"
                  element={
                    <ProtectedRoute>
                      <Suporte />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/ajuda"
                  element={
                    <ProtectedRoute>
                      <Ajuda />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campanhas"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Campanhas />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/automacoes"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Automacoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorio-financeiro"
                  element={
                    <ProtectedRoute requireAdmin>
                      <RelatorioFinanceiro />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Relatorios />
                    </ProtectedRoute>
                  }
                />
                {/* Rotas médicas */}
                <Route
                  path="/prontuarios"
                  element={
                    <ProtectedRoute>
                      <Prontuarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/triagem"
                  element={
                    <ProtectedRoute>
                      <Triagem />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/receituarios"
                  element={
                    <ProtectedRoute>
                      <Receituarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/laudos"
                  element={
                    <ProtectedRoute>
                      <Laudos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/especialidades"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Especialidades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/convenios"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Convenios />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/integracoes"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Integracoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modelos-prontuario"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ModelosProntuario />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/faturamento-tiss"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FaturamentoTISS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  }
                />

                <Route path="/contas-pagar" element={<Navigate to="/financeiro?tab=bills_payable" replace />} />
                <Route path="/contas-receber" element={<Navigate to="/financeiro?tab=bills_receivable" replace />} />
                <Route path="/fluxo-de-caixa" element={<Navigate to="/financeiro?tab=projection" replace />} />

                {/* Portal do Paciente — rotas públicas */}
                <Route path="/paciente/login" element={<PatientLogin />} />
                <Route path="/paciente/cadastro" element={<PatientRegister />} />

                {/* Portal do Paciente — rotas protegidas */}
                <Route
                  path="/paciente/dashboard"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/consultas"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/teleconsulta"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/exames"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/receitas"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/atestados"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/perfil"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/configuracoes"
                  element={
                    <PatientProtectedRoute>
                      <PatientDashboard />
                    </PatientProtectedRoute>
                  }
                />

                  {/* Catch all */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                </ErrorBoundary>
              </TourProvider>
              </GoalMotivationProvider>
            </AppStatusProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
