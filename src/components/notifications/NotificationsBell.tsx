// Componente desativado - tabela notifications não existe
// TODO: Criar tabela notifications no banco de dados para ativar este componente

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationsBell() {
  // Retorna um ícone desativado pois a tabela notifications não existe
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 rounded-xl opacity-50 cursor-not-allowed"
      title="Notificações (em breve)"
      disabled
    >
      <Bell className="h-5 w-5" />
    </Button>
  );
}
