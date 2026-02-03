import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InternalDarkMode } from "@/components/InternalDarkMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

import Dashboard from "@/pages/Dashboard";
import Agenda from "@/pages/Agenda";
import Financeiro from "@/pages/Financeiro";
import Produtos from "@/pages/Produtos";
import Servicos from "@/pages/Servicos";
import Clientes from "@/pages/Clientes";
import Equipe from "@/pages/Equipe";
import Configuracoes from "@/pages/Configuracoes";
import Assinatura from "@/pages/Assinatura";

// Lazy apenas para páginas públicas (evita flash ao navegar no dashboard)
const LandingPage = lazyWithRetry(() => import("@/pages/LandingPage"));
const Login = lazyWithRetry(() => import("@/pages/auth/Login"));
const Register = lazyWithRetry(() => import("@/pages/auth/Register"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("@/pages/auth/ResetPassword"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const TermosDeUso = lazyWithRetry(() => import("@/pages/TermosDeUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("@/pages/PoliticaPrivacidade"));
const Contato = lazyWithRetry(() => import("@/pages/Contato"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <InternalDarkMode />
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
