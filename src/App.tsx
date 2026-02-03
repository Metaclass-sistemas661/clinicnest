import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load com retry (evita erro "Failed to fetch dynamically imported module" após deploys)
const LandingPage = lazyWithRetry(() => import("@/pages/LandingPage"));
const Login = lazyWithRetry(() => import("@/pages/auth/Login"));
const Register = lazyWithRetry(() => import("@/pages/auth/Register"));
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Financeiro = lazyWithRetry(() => import("@/pages/Financeiro"));
const Produtos = lazyWithRetry(() => import("@/pages/Produtos"));
const Servicos = lazyWithRetry(() => import("@/pages/Servicos"));
const Clientes = lazyWithRetry(() => import("@/pages/Clientes"));
const Equipe = lazyWithRetry(() => import("@/pages/Equipe"));
const Configuracoes = lazyWithRetry(() => import("@/pages/Configuracoes"));
const Assinatura = lazyWithRetry(() => import("@/pages/Assinatura"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const TermosDeUso = lazyWithRetry(() => import("@/pages/TermosDeUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("@/pages/PoliticaPrivacidade"));
const Contato = lazyWithRetry(() => import("@/pages/Contato"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/contato" element={<Contato />} />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
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
                  path="/produtos"
                  element={
                    <ProtectedRoute requireAdmin>
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

                {/* Catch all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
