import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PatientExames() {
  return (
    <PatientLayout title="Exames e Laudos" subtitle="Resultados de exames e laudos médicos">
      <Card className="mb-6 border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            <strong>Em breve:</strong> Aqui você poderá acessar resultados de exames e laudos enviados pela sua clínica.
          </p>
        </CardContent>
      </Card>

      <EmptyState
        icon={FileText}
        title="Nenhum exame disponível"
        description="Quando sua clínica enviar resultados de exames ou laudos, eles aparecerão aqui."
      />
    </PatientLayout>
  );
}
