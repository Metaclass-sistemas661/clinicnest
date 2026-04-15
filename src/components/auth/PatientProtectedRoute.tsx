import { Spinner } from "@/components/ui/spinner";
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiPatient } from "@/integrations/gcp/client";
import { Loader2 } from "lucide-react";
import { PatientSubscriptionGuard } from "@/components/subscription/PatientSubscriptionGuard";

interface PatientProtectedRouteProps {
  children: ReactNode;
}

export function PatientProtectedRoute({ children }: PatientProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [patientUser, setPatientUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await apiPatient.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setPatientUser(null);
        setIsLoading(false);
        return;
      }

      const accountType = session.user.user_metadata?.account_type;
      if (accountType !== "patient") {
        setPatientUser(null);
        setIsLoading(false);
        return;
      }

      setPatientUser(session.user);
      setIsLoading(false);
    };

    void check();

    const { data: { subscription } } = apiPatient.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user || session.user.user_metadata?.account_type !== "patient") {
        setPatientUser(null);
      } else {
        setPatientUser(session.user);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" className="text-teal-600" />
      </div>
    );
  }

  if (!patientUser) {
    return <Navigate to="/paciente/login" replace />;
  }

  return <PatientSubscriptionGuard>{children}</PatientSubscriptionGuard>;
}
