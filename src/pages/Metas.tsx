// Página desativada - tabela goals não existe
// TODO: Criar tabela goals no banco de dados para ativar esta página

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function Metas() {
  return (
    <MainLayout title="Metas" subtitle="Defina e acompanhe as metas do salão">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center">
            Funcionalidade de metas em desenvolvimento.
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Em breve você poderá definir e acompanhar metas para sua equipe.
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
