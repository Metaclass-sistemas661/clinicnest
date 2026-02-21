import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "lucide-react";

export default function PatientReceitas() {
  return (
    <PatientLayout title="Receitas" subtitle="Prescrições médicas">
      <Card className="mb-6 border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            <strong>Em breve:</strong> Aqui você poderá acessar suas receitas e prescrições médicas digitais.
          </p>
        </CardContent>
      </Card>

      <EmptyState
        icon={Pill}
        title="Nenhuma receita disponível"
        description="Quando seu médico emitir uma receita digital, ela aparecerá aqui."
      />
    </PatientLayout>
  );
}
