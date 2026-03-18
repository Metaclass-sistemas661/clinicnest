import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GoalMotivationProvider } from "@/contexts/GoalMotivationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PatientProtectedRoute } from "@/components/auth/PatientProtectedRoute";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { TriageRealtimeListener } from "@/components/admin/TriageRealtimeListener";
import { InternalDarkMode } from "@/components/InternalDarkMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useAuth } from "@/contexts/AuthContext";
import { TourProvider } from "@/contexts/TourContext";
import { AppStatusProvider } from "@/contexts/AppStatusContext";
import { AiActivityProvider } from "@/contexts/AiActivityContext";
import { initBirdId } from "@/lib/birdid-integration";

// Inicializa BirdID se credenciais estiverem configuradas
const birdIdClientId = import.meta.env.VITE_BIRDID_CLIENT_ID;
if (birdIdClientId) {
  initBirdId({
    clientId: birdIdClientId,
    clientSecret: import.meta.env.VITE_BIRDID_CLIENT_SECRET || "",
    redirectUri: import.meta.env.VITE_BIRDID_REDIRECT_URI || `${window.location.origin}/auth/birdid/callback`,
    environment: (import.meta.env.VITE_BIRDID_ENVIRONMENT as "sandbox" | "production") || "sandbox",
  });
}

// Todas as páginas usam lazy loading para reduzir bundle inicial e habilitar code splitting
const LandingPage = lazyWithRetry(() => import("@/pages/LandingPage"));
const SolucoesPage = lazyWithRetry(() => import("@/pages/landing/SolucoesPage"));
const SobreNosPage = lazyWithRetry(() => import("@/pages/landing/SobreNosPage"));
const AgendarDemonstracaoPage = lazyWithRetry(() => import("@/pages/landing/AgendarDemonstracaoPage"));
const Login = lazyWithRetry(() => import("@/pages/auth/Login"));
const Register = lazyWithRetry(() => import("@/pages/auth/Register"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/auth/ResetPassword"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Forbidden = lazyWithRetry(() => import("@/pages/Forbidden"));
const TermosDeUso = lazyWithRetry(() => import("@/pages/TermosDeUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("@/pages/PoliticaPrivacidade"));
const Contato = lazyWithRetry(() => import("@/pages/Contato"));
const CanalLgpd = lazyWithRetry(() => import("@/pages/CanalLgpd"));

const ConfirmarAgendamento = lazyWithRetry(() => import("@/pages/ConfirmarAgendamento"));
const TeleconsultaPublica = lazyWithRetry(() => import("@/pages/TeleconsultaPublica"));
const AssinarTermosPublico = lazyWithRetry(() => import("@/pages/AssinarTermosPublico"));

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Financeiro = lazyWithRetry(() => import("@/pages/Financeiro"));
const Repasses = lazyWithRetry(() => import("@/pages/Repasses"));
const RepassesComissoes = lazyWithRetry(() => import("@/pages/RepassesComissoes"));
const RepassesSalarios = lazyWithRetry(() => import("@/pages/RepassesSalarios"));
const ConfigurarRegras = lazyWithRetry(() => import("@/pages/repasses/ConfigurarRegras"));
const Produtos = lazyWithRetry(() => import("@/pages/Produtos"));
const Compras = lazyWithRetry(() => import("@/pages/Compras"));
const Fornecedores = lazyWithRetry(() => import("@/pages/Fornecedores"));
const Procedimentos = lazyWithRetry(() => import("@/pages/Procedimentos"));
const Pacientes = lazyWithRetry(() => import("@/pages/Pacientes"));
const Teleconsulta = lazyWithRetry(() => import("@/pages/Teleconsulta"));
const ModelosProntuario = lazyWithRetry(() => import("@/pages/ModelosProntuario"));
const FaturamentoTISS = lazyWithRetry(() => import("@/pages/FaturamentoTISS"));
const Chat = lazyWithRetry(() => import("@/pages/Chat"));
const Unidades = lazyWithRetry(() => import("@/pages/Unidades"));
const Disponibilidade = lazyWithRetry(() => import("@/pages/Disponibilidade"));
const Equipe = lazyWithRetry(() => import("@/pages/Equipe"));
const Configuracoes = lazyWithRetry(() => import("@/pages/Configuracoes"));
const ClinicaAutonoma = lazyWithRetry(() => import("@/pages/ClinicaAutonoma"));
const Assinatura = lazyWithRetry(() => import("@/pages/Assinatura"));
const GerenciarAssinatura = lazyWithRetry(() => import("@/pages/GerenciarAssinatura"));

const MeuFinanceiro = lazyWithRetry(() => import("@/pages/MeuFinanceiro"));
const Notificacoes = lazyWithRetry(() => import("@/pages/Notificacoes"));
const MinhasConfiguracoes = lazyWithRetry(() => import("@/pages/MinhasConfiguracoes"));
const Suporte = lazyWithRetry(() => import("@/pages/Suporte"));
const Ajuda = lazyWithRetry(() => import("@/pages/Ajuda"));
const Auditoria = lazyWithRetry(() => import("@/pages/Auditoria"));
const AdminOverrides = lazyWithRetry(() => import("@/pages/AdminOverrides"));
const DiagnosticoSeguranca = lazyWithRetry(() => import("@/pages/DiagnosticoSeguranca"));
const Campanhas = lazyWithRetry(() => import("@/pages/Campanhas"));
const Relatorios = lazyWithRetry(() => import("@/pages/Relatorios"));
const Automacoes = lazyWithRetry(() => import("@/pages/Automacoes"));
const NpsPublico = lazyWithRetry(() => import("@/pages/NpsPublico"));
const ExamesRecebidos = lazyWithRetry(() => import("@/pages/ExamesRecebidos"));
const FaturasPacientes = lazyWithRetry(() => import("@/pages/FaturasPacientes"));

// Portal do Paciente
const PatientLogin = lazyWithRetry(() => import("@/pages/paciente/PatientLogin"));
// PatientRegister removed — registration is now part of PatientLogin flow via access code
const PatientDashboard = lazyWithRetry(() => import("@/pages/paciente/PatientDashboard"));
const PatientAgendar = lazyWithRetry(() => import("@/pages/paciente/PatientAgendar"));
const PatientConsultas = lazyWithRetry(() => import("@/pages/paciente/PatientConsultas"));
const PatientFinanceiro = lazyWithRetry(() => import("@/pages/paciente/PatientFinanceiro"));
const PatientMensagens = lazyWithRetry(() => import("@/pages/paciente/PatientMensagens"));
const PatientSaude = lazyWithRetry(() => import("@/pages/paciente/PatientSaude"));
const PatientTeleconsulta = lazyWithRetry(() => import("@/pages/paciente/PatientTeleconsulta"));
const PatientExames = lazyWithRetry(() => import("@/pages/paciente/PatientExames"));
const PatientReceitas = lazyWithRetry(() => import("@/pages/paciente/PatientReceitas"));
const PatientAtestados = lazyWithRetry(() => import("@/pages/paciente/PatientAtestados"));
const PatientLaudos = lazyWithRetry(() => import("@/pages/paciente/PatientLaudos"));
const PatientConsentSigning = lazyWithRetry(() => import("@/pages/paciente/PatientConsentSigning"));
const PatientProfile = lazyWithRetry(() => import("@/pages/paciente/PatientProfile"));
const PatientSettings = lazyWithRetry(() => import("@/pages/paciente/PatientSettings"));
const PatientDependentes = lazyWithRetry(() => import("@/pages/paciente/PatientDependentes"));
const PatientPROMs = lazyWithRetry(() => import("@/pages/paciente/PatientPROMs"));
const PatientHealthCard = lazyWithRetry(() => import("@/pages/paciente/PatientHealthCard"));
const PatientRefillRequest = lazyWithRetry(() => import("@/pages/paciente/PatientRefillRequest"));
const PatientHealthCredits = lazyWithRetry(() => import("@/pages/paciente/PatientHealthCredits"));
const PatientTreatmentPlans = lazyWithRetry(() => import("@/pages/paciente/PatientTreatmentPlans"));

const MensagensPacientes = lazyWithRetry(() => import("@/pages/MensagensPacientes"));

const TermosConsentimento = lazyWithRetry(() => import("@/pages/TermosConsentimento"));
const ContratosTermos = lazyWithRetry(() => import("@/pages/ContratosTermos"));

// Páginas médicas (novas)
const Prontuarios = lazyWithRetry(() => import("@/pages/Prontuarios"));
const ProntuarioDetalhe = lazyWithRetry(() => import("@/pages/ProntuarioDetalhe"));
const Convenios = lazyWithRetry(() => import("@/pages/Convenios"));
const Receituarios = lazyWithRetry(() => import("@/pages/Receituarios"));
const Laudos = lazyWithRetry(() => import("@/pages/Laudos"));
const Triagem = lazyWithRetry(() => import("@/pages/Triagem"));
const Atestados = lazyWithRetry(() => import("@/pages/Atestados"));
const Especialidades = lazyWithRetry(() => import("@/pages/Especialidades"));
const Encaminhamentos = lazyWithRetry(() => import("@/pages/Encaminhamentos"));
const ListaEspera = lazyWithRetry(() => import("@/pages/ListaEspera"));
const Odontograma = lazyWithRetry(() => import("@/pages/Odontograma"));
const PlanosTratamento = lazyWithRetry(() => import("@/pages/PlanosTratamento"));
const Periograma = lazyWithRetry(() => import("@/pages/Periograma"));
const GestaoSalas = lazyWithRetry(() => import("@/pages/GestaoSalas"));
const Evolucoes = lazyWithRetry(() => import("@/pages/Evolucoes"));
const ApiDocumentation = lazyWithRetry(() => import("@/pages/ApiDocumentation"));
const EsteticaMapping = lazyWithRetry(() => import("@/pages/estetica/EsteticaMapping"));

// Páginas FASE 13D — Dialog → Página
const PacienteDetalhe = lazyWithRetry(() => import("@/pages/PacienteDetalhe"));
const PatientFormPage = lazyWithRetry(() => import("@/pages/pacientes/PatientFormPage"));
const NovaCompra = lazyWithRetry(() => import("@/pages/NovaCompra"));
const NovaCampanha = lazyWithRetry(() => import("@/pages/NovaCampanha"));
const ModeloProntuarioEditor = lazyWithRetry(() => import("@/pages/ModeloProntuarioEditor"));
const TermoConsentimentoEditor = lazyWithRetry(() => import("@/pages/TermoConsentimentoEditor"));
const NovaGuiaTISS = lazyWithRetry(() => import("@/pages/NovaGuiaTISS"));
const ContratoTermoEditor = lazyWithRetry(() => import("@/pages/ContratoTermoEditor"));
const TransmissaoSNGPC = lazyWithRetry(() => import("@/pages/TransmissaoSNGPC"));
const Compliance = lazyWithRetry(() => import("@/pages/Compliance"));
const DashboardONA = lazyWithRetry(() => import("@/pages/DashboardONA"));
const RetencaoDados = lazyWithRetry(() => import("@/pages/RetencaoDados"));
const RetornosPendentes = lazyWithRetry(() => import("@/pages/RetornosPendentes"));
const PainelChamada = lazyWithRetry(() => import("@/pages/PainelChamada"));
const PublicBooking = lazyWithRetry(() => import("@/pages/PublicBooking"));
const WaitlistAutoBooking = lazyWithRetry(() => import("@/pages/WaitlistAutoBooking"));
// FilaAtendimento merged into DashboardRecepcao (tabs)
const DashboardRecepcao = lazyWithRetry(() => import("@/pages/recepcao/DashboardRecepcao"));
const ConfirmarRetornoPublico = lazyWithRetry(() => import("@/pages/ConfirmarRetornoPublico"));
const VerificarDocumento = lazyWithRetry(() => import("@/pages/VerificarDocumento"));
const BirdIdCallback = lazyWithRetry(() => import("@/pages/auth/BirdIdCallback"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function GlobalAdminListeners() {
  return null;
}

/** Redirect /clientes/:id → /pacientes/:id interpolando o parâmetro */
function ClienteRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/pacientes/${id}`} replace />;
}

function GlobalStaffListeners() {
  const auth = useAuth();
  if (!auth?.user) return null;
  return <TriageRealtimeListener />;
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
              <AiActivityProvider>
              <GoalMotivationProvider>
              <TourProvider>
                <InternalDarkMode />
                <GlobalAdminListeners />
                <GlobalStaffListeners />
                <ErrorBoundary>
                  <Suspense fallback={<RouteFallback />}>
                  <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/solucoes" element={<SolucoesPage />} />
                <Route path="/sobre" element={<SobreNosPage />} />
                <Route path="/agendar-demonstracao" element={<AgendarDemonstracaoPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/contato" element={<Contato />} />
                <Route path="/canal-lgpd" element={<CanalLgpd />} />
                <Route path="/confirmar/:token" element={<ConfirmarAgendamento />} />
                <Route path="/nps/:token" element={<NpsPublico />} />
                <Route path="/teleconsulta-publica/:token" element={<TeleconsultaPublica />} />
                <Route path="/assinar-termos/:token" element={<AssinarTermosPublico />} />
                <Route path="/confirmar-retorno/:token" element={<ConfirmarRetornoPublico />} />
                <Route path="/verificar/:hash" element={<VerificarDocumento />} />
                <Route path="/auth/birdid/callback" element={<BirdIdCallback />} />
                <Route path="/painel-chamada" element={<PainelChamada />} />
                <Route path="/agendar/:slug" element={<PublicBooking />} />
                <Route path="/waitlist-booking/:waitlistId" element={<WaitlistAutoBooking />} />

                {/* 403 — Acesso Negado (precisa estar autenticado, mas sem resource) */}
                <Route
                  path="/403"
                  element={
                    <ProtectedRoute>
                      <Forbidden />
                    </ProtectedRoute>
                  }
                />

                {/* ── Rotas protegidas ─────────────────────────────── */}

                {/* Geral */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute resource="dashboard">
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
                    <ProtectedRoute resource="agenda">
                      <Agenda />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pacientes"
                  element={
                    <ProtectedRoute resource="pacientes">
                      <Pacientes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pacientes/novo"
                  element={
                    <ProtectedRoute resource="pacientes">
                      <PatientFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pacientes/:id/editar"
                  element={
                    <ProtectedRoute resource="pacientes">
                      <PatientFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pacientes/:id"
                  element={
                    <ProtectedRoute resource="pacientes">
                      <PacienteDetalhe />
                    </ProtectedRoute>
                  }
                />
                {/* Redirect de compatibilidade */}
                <Route path="/clientes" element={<Navigate to="/pacientes" replace />} />
                <Route path="/clientes/:id" element={<ClienteRedirect />} />
                <Route
                  path="/mensagens-pacientes"
                  element={
                    <ProtectedRoute resource="clientes">
                      <MensagensPacientes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lista-espera"
                  element={
                    <ProtectedRoute resource="lista_espera">
                      <ListaEspera />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/disponibilidade"
                  element={
                    <ProtectedRoute resource="disponibilidade">
                      <Disponibilidade />
                    </ProtectedRoute>
                  }
                />

                {/* Atendimento */}
                <Route
                  path="/triagem"
                  element={
                    <ProtectedRoute resource="triagem">
                      <Triagem />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teleconsulta"
                  element={
                    <ProtectedRoute resource="teleconsulta">
                      <Teleconsulta />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute resource="chat">
                      <Chat />
                    </ProtectedRoute>
                  }
                />

                {/* Prontuário & Docs */}
                <Route
                  path="/prontuarios"
                  element={
                    <ProtectedRoute resource="prontuarios">
                      <Prontuarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prontuarios/:id"
                  element={
                    <ProtectedRoute resource="prontuarios">
                      <ProntuarioDetalhe />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/evolucoes"
                  element={
                    <ProtectedRoute resource="evolucoes">
                      <Evolucoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/receituarios"
                  element={
                    <ProtectedRoute resource="receituarios">
                      <Receituarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/laudos"
                  element={
                    <ProtectedRoute resource="laudos">
                      <Laudos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/atestados"
                  element={
                    <ProtectedRoute resource="atestados">
                      <Atestados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/encaminhamentos"
                  element={
                    <ProtectedRoute resource="encaminhamentos">
                      <Encaminhamentos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/evolucao-enfermagem"
                  element={<Navigate to="/evolucoes?tipo=enfermagem" replace />}
                />
                <Route
                  path="/odontograma"
                  element={
                    <ProtectedRoute resource="odontograma">
                      <Odontograma />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/planos-tratamento"
                  element={
                    <ProtectedRoute resource="odontograma">
                      <PlanosTratamento />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/periograma"
                  element={
                    <ProtectedRoute resource="periograma">
                      <Periograma />
                    </ProtectedRoute>
                  }
                />

                {/* Estética */}
                <Route
                  path="/estetica/mapeamento"
                  element={
                    <ProtectedRoute resource="estetica">
                      <EsteticaMapping />
                    </ProtectedRoute>
                  }
                />

                {/* Financeiro */}
                <Route
                  path="/financeiro"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <Financeiro />
                    </ProtectedRoute>
                  }
                />

                {/* Repasses */}
                <Route
                  path="/repasses"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <Repasses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/repasses/comissoes"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <RepassesComissoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/repasses/salarios"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <RepassesSalarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/repasses/relatorios"
                  element={<Navigate to="/relatorios?tab=comissoes" replace />}
                />
                <Route
                  path="/repasses/regras"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <ConfigurarRegras />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/repasses/captacao"
                  element={<Navigate to="/relatorios?tab=captacao" replace />}
                />


                <Route
                  path="/faturamento-tiss"
                  element={
                    <ProtectedRoute resource="faturamento_tiss">
                      <FaturamentoTISS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/faturamento-tiss/nova-guia"
                  element={
                    <ProtectedRoute resource="faturamento_tiss">
                      <NovaGuiaTISS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sngpc"
                  element={
                    <ProtectedRoute resource="sngpc">
                      <TransmissaoSNGPC />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/convenios"
                  element={
                    <ProtectedRoute resource="convenios">
                      <Convenios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/minhas-comissoes"
                  element={<Navigate to="/meu-financeiro?tab=comissoes" replace />}
                />
                <Route
                  path="/meus-salarios"
                  element={<Navigate to="/meu-financeiro?tab=salarios" replace />}
                />
                <Route
                  path="/meu-financeiro"
                  element={
                    <ProtectedRoute>
                      <MeuFinanceiro />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorio-financeiro"
                  element={<Navigate to="/relatorios?tab=financeiro" replace />}
                />
                <Route
                  path="/relatorios"
                  element={
                    <ProtectedRoute resource="relatorios">
                      <Relatorios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios-customizaveis"
                  element={<Navigate to="/relatorios?tab=customizaveis" replace />}
                />

                {/* Estoque */}
                <Route
                  path="/produtos"
                  element={
                    <ProtectedRoute resource="produtos">
                      <Produtos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compras"
                  element={
                    <ProtectedRoute resource="compras">
                      <Compras />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compras/nova"
                  element={
                    <ProtectedRoute resource="compras">
                      <NovaCompra />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fornecedores"
                  element={
                    <ProtectedRoute resource="fornecedores">
                      <Fornecedores />
                    </ProtectedRoute>
                  }
                />

                {/* Operacional */}
                <Route
                  path="/equipe"
                  element={
                    <ProtectedRoute resource="equipe">
                      <Equipe />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gerenciar-permissoes"
                  element={<Navigate to="/configuracoes?tab=permissoes" replace />}
                />
                <Route
                  path="/unidades"
                  element={
                    <ProtectedRoute resource="unidades">
                      <Unidades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gestao-salas"
                  element={
                    <ProtectedRoute resource="gestao_salas">
                      <GestaoSalas />
                    </ProtectedRoute>
                  }
                />

                {/* Cadastros & Modelos */}
                <Route
                  path="/procedimentos"
                  element={
                    <ProtectedRoute resource="procedimentos">
                      <Procedimentos />
                    </ProtectedRoute>
                  }
                />
                {/* Redirect de compatibilidade */}
                <Route path="/servicos" element={<Navigate to="/procedimentos" replace />} />
                <Route
                  path="/especialidades"
                  element={
                    <ProtectedRoute resource="especialidades">
                      <Especialidades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modelos-prontuario"
                  element={
                    <ProtectedRoute resource="modelos_prontuario">
                      <ModelosProntuario />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modelos-prontuario/:id"
                  element={
                    <ProtectedRoute resource="modelos_prontuario">
                      <ModeloProntuarioEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/termos-consentimento"
                  element={
                    <ProtectedRoute resource="termos_consentimento">
                      <TermosConsentimento />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/termos-consentimento/:id"
                  element={
                    <ProtectedRoute resource="termos_consentimento">
                      <TermoConsentimentoEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contratos-termos"
                  element={
                    <ProtectedRoute resource="contratos_termos">
                      <ContratosTermos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contratos-termos/:id"
                  element={
                    <ProtectedRoute resource="contratos_termos">
                      <ContratoTermoEditor />
                    </ProtectedRoute>
                  }
                />

                {/* Marketing & CRM */}
                <Route
                  path="/campanhas"
                  element={
                    <ProtectedRoute resource="campanhas">
                      <Campanhas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campanhas/nova"
                  element={
                    <ProtectedRoute resource="campanhas">
                      <NovaCampanha />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/automacoes"
                  element={
                    <ProtectedRoute resource="automacoes">
                      <Automacoes />
                    </ProtectedRoute>
                  }
                />

                {/* Administração */}
                <Route
                  path="/integracoes"
                  element={<Navigate to="/configuracoes?tab=integracoes" replace />}
                />
                <Route
                  path="/api-docs"
                  element={
                    <ProtectedRoute resource="api_docs">
                      <ApiDocumentation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auditoria"
                  element={
                    <ProtectedRoute resource="auditoria">
                      <Auditoria />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/overrides"
                  element={
                    <ProtectedRoute resource="configuracoes">
                      <AdminOverrides />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/diagnostico-seguranca"
                  element={
                    <ProtectedRoute resource="auditoria">
                      <DiagnosticoSeguranca />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compliance"
                  element={
                    <ProtectedRoute resource="auditoria">
                      <Compliance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard-ona"
                  element={
                    <ProtectedRoute resource="auditoria">
                      <DashboardONA />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/retencao-dados"
                  element={
                    <ProtectedRoute resource="auditoria">
                      <RetencaoDados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/retornos-pendentes"
                  element={
                    <ProtectedRoute resource="agenda">
                      <RetornosPendentes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recepcao/fila"
                  element={<Navigate to="/recepcao?tab=fila" replace />}
                />
                <Route
                  path="/recepcao"
                  element={
                    <ProtectedRoute resource="agenda">
                      <DashboardRecepcao />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <ProtectedRoute resource="configuracoes">
                      <Configuracoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clinica-autonoma"
                  element={
                    <ProtectedRoute resource="configuracoes">
                      <ClinicaAutonoma />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/exames-recebidos"
                  element={
                    <ProtectedRoute resource="pacientes">
                      <ExamesRecebidos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/faturas-pacientes"
                  element={
                    <ProtectedRoute resource="financeiro">
                      <FaturasPacientes />
                    </ProtectedRoute>
                  }
                />

                {/* Conta */}
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
                  path="/assinatura"
                  element={
                    <ProtectedRoute resource="assinatura">
                      <Assinatura />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assinatura/gerenciar"
                  element={
                    <ProtectedRoute resource="assinatura">
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

                {/* Redirects legados */}
                <Route path="/contas-pagar" element={<Navigate to="/financeiro?tab=bills_payable" replace />} />
                <Route path="/contas-receber" element={<Navigate to="/financeiro?tab=bills_receivable" replace />} />
                <Route path="/fluxo-de-caixa" element={<Navigate to="/financeiro?tab=projection" replace />} />

                {/* Portal do Paciente — rotas públicas */}
                <Route path="/paciente/login" element={<PatientLogin />} />
                <Route path="/paciente/cadastro" element={<Navigate to="/paciente/login" replace />} />

                {/* Portal do Paciente — rotas protegidas */}
                <Route
                  path="/paciente/termos"
                  element={
                    <PatientProtectedRoute>
                      <PatientConsentSigning />
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/dashboard"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientDashboard />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/agendar"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientAgendar />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/consultas"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientConsultas />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/teleconsulta"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientTeleconsulta />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/financeiro"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientFinanceiro />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/mensagens"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientMensagens />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/saude"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientSaude />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/proms"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientPROMs />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/cartao-saude"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientHealthCard />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/renovar-receita"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientRefillRequest />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/creditos"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientHealthCredits />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/planos"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientTreatmentPlans />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/exames"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientExames />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/receitas"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientReceitas />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/atestados"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientAtestados />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/laudos"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientLaudos />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/perfil"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientProfile />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/configuracoes"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientSettings />
                      </ConsentGate>
                    </PatientProtectedRoute>
                  }
                />
                <Route
                  path="/paciente/dependentes"
                  element={
                    <PatientProtectedRoute>
                      <ConsentGate>
                        <PatientDependentes />
                      </ConsentGate>
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
              </AiActivityProvider>
            </AppStatusProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
