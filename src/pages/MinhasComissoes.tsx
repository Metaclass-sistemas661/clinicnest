// Página desativada - tabela commission_payments não existe
// TODO: Criar tabela commission_payments no banco de dados para ativar esta página

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MinhasComissoes() {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <MainLayout title="Minhas Comissões" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Administradores acessam comissões pelo painel Financeiro
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Minhas Comissões" subtitle="Histórico de comissões">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center">
            Funcionalidade de comissões em desenvolvimento.
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Em breve você poderá acompanhar suas comissões pendentes e pagas.
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
