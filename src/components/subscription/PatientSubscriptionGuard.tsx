import { ReactNode } from "react";
import { useClinicSubscriptionStatus } from "@/hooks/useClinicSubscriptionStatus";
import { Building2, Clock } from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PatientSubscriptionGuardProps {
  children: ReactNode;
}

/**
 * Bloqueia o portal do paciente quando a clínica vinculada não possui assinatura ativa.
 * Exibe uma tela informativa explicando que a clínica precisa regularizar.
 */
export function PatientSubscriptionGuard({ children }: PatientSubscriptionGuardProps) {
  const { isLoading, clinicHasAccess, clinicName } = useClinicSubscriptionStatus();
  const navigate = useNavigate();

  // Enquanto carrega, renderiza normalmente (evita flash)
  if (isLoading) return <>{children}</>;

  if (!clinicHasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md text-center space-y-6">
          {/* Ícone */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* Título */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Portal temporariamente indisponível
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {clinicName ? (
                <>
                  A clínica <strong className="text-foreground">{clinicName}</strong> está
                  regularizando sua assinatura. O portal do paciente ficará disponível assim
                  que a situação for resolvida.
                </>
              ) : (
                <>
                  A clínica vinculada está regularizando sua assinatura. O portal do paciente
                  ficará disponível novamente em breve.
                </>
              )}
            </p>
          </div>

          {/* Card informativo */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-left">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-medium">O que isso significa?</p>
                <p className="text-amber-700 dark:text-amber-300">
                  O período de teste ou a assinatura da clínica expirou. 
                  Entre em contato com a clínica para mais informações.
                </p>
              </div>
            </div>
          </div>

          {/* Botão sair */}
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await apiPatient.auth.signOut();
              navigate("/paciente/login", { replace: true });
            }}
          >
            Sair do portal
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
