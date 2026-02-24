import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProfessionalType, PermissionAction } from "@/types/database";

interface PermissionGateProps {
  children: ReactNode;
  /** Recurso RBAC (ex: 'receituarios', 'prontuarios'). */
  resource?: string;
  /** Ação exigida. Default: 'view'. */
  action?: PermissionAction;
  /** Tipos profissionais permitidos (OR — basta estar na lista). */
  allowedTypes?: ProfessionalType[];
  /** Conteúdo alternativo quando sem permissão. */
  fallback?: ReactNode;
}

export function PermissionGate({
  children,
  resource,
  action = "view",
  allowedTypes,
  fallback = null,
}: PermissionGateProps) {
  const { isAdmin, can, professionalType } = usePermissions();

  if (isAdmin) return <>{children}</>;

  if (allowedTypes && allowedTypes.length > 0) {
    if (allowedTypes.includes(professionalType)) return <>{children}</>;
  }

  if (resource && can(resource, action)) return <>{children}</>;

  // Se nenhum critério foi fornecido, renderiza normalmente
  if (!resource && (!allowedTypes || allowedTypes.length === 0)) return <>{children}</>;

  return <>{fallback}</>;
}
