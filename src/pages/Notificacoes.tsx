// Página desativada - tabela notifications não existe
// TODO: Criar tabela notifications no banco de dados para ativar esta página

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function Notificacoes() {
  return (
    <MainLayout title="Notificações" subtitle="Suas notificações">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>
                  Funcionalidade em desenvolvimento
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Sistema de notificações em desenvolvimento.</p>
              <p className="text-sm mt-2">Em breve você receberá alertas de agendamentos, metas e comissões.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
