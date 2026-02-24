import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import type { ProfessionalType, PermissionAction } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Legado — mantido para compatibilidade. Equivale a allowedTypes:['admin']. */
  requireAdmin?: boolean;
  /** Recurso RBAC que a rota exige (ex: 'prontuarios', 'financeiro'). */
  resource?: string;
  /** Ação mínima exigida sobre o recurso. Default: 'view'. */
  action?: PermissionAction;
  /** Tipos profissionais explicitamente permitidos (OR com resource check). */
  allowedTypes?: ProfessionalType[];
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  resource,
  action = "view",
  allowedTypes,
}: ProtectedRouteProps) {
  const auth = useAuth();
  const { can, professionalType, isAdmin } = usePermissions();
  const user = auth?.user;
  const isLoading = auth?.isLoading;
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

  const accountType = user.user_metadata?.account_type;
  if (accountType === "patient") {
    return <Navigate to="/paciente/dashboard" replace />;
  }

  // Admin sempre tem acesso total
  if (!isAdmin) {
    let denied = false;
    let deniedResource = resource ?? "unknown";

    // Legado: requireAdmin
    if (requireAdmin) {
      denied = true;
      deniedResource = "admin_only";
    }

    // RBAC: allowedTypes (tipo profissional explícito)
    if (!denied && allowedTypes && allowedTypes.length > 0) {
      if (!allowedTypes.includes(professionalType)) {
        if (!resource || !can(resource, action)) {
          denied = true;
        }
      }
    } else if (!denied && resource) {
      if (!can(resource, action)) {
        denied = true;
      }
    }

    if (denied) {
      (supabase as any)
        .rpc("log_access_denied", {
          p_resource: deniedResource,
          p_action: action,
          p_metadata: { path: location.pathname },
        })
        .catch((err: unknown) => logger.error("Audit log_access_denied failed:", err));

      return <Navigate to="/403" replace />;
    }
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
