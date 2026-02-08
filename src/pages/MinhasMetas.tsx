// Página desativada - tabela goals não existe
// TODO: Criar tabela goals no banco de dados para ativar esta página

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function MinhasMetas() {
  return (
    <MainLayout title="Minhas Metas" subtitle="Acompanhe o progresso das suas metas">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center">
            Funcionalidade de metas em desenvolvimento.
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Em breve você poderá acompanhar suas metas pessoais.
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
