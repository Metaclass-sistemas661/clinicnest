import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const auth = useAuth();
  const user = auth?.user;
  const isLoading = auth?.isLoading;
  const isAdmin = auth?.isAdmin ?? false;
  const tenant = auth?.tenant;
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Pacientes não podem acessar o painel da clínica
  const accountType = user.user_metadata?.account_type;
  if (accountType === "patient") {
    return <Navigate to="/paciente/dashboard" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const billingCpfCnpj = String(tenant?.billing_cpf_cnpj ?? "").trim();
  if (isAdmin && !billingCpfCnpj && location.pathname !== "/configuracoes") {
    return (
      <Navigate
        to="/configuracoes"
        replace
        state={{ reason: "missing_billing_cpf_cnpj", from: location.pathname }}
      />
    );
  }

  return <div className="min-h-screen">{children}</div>;
}
