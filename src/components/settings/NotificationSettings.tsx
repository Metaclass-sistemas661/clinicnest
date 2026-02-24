import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Smartphone, CheckCircle2, AlertTriangle, Loader2, Send } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationSettings() {
  const {
    isSupported,
    isEnabled,
    canRequest,
    isLoading,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            Notificações Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Não suportado</p>
              <p className="text-sm text-yellow-700">
                Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Safari.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações Push
            </CardTitle>
            <CardDescription>
              Receba alertas mesmo quando o app estiver fechado
            </CardDescription>
          </div>
          {isEnabled ? (
            <Badge className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary">Desativado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isEnabled && canRequest && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">Habilitar notificações</p>
              <p className="text-sm text-blue-700">
                Receba alertas de novos agendamentos, chegada de pacientes e mensagens.
              </p>
            </div>
            <Button onClick={enableNotifications} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Habilitar
            </Button>
          </div>
        )}

        {!isEnabled && !canRequest && (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Permissão negada</p>
              <p className="text-sm text-yellow-700">
                Você bloqueou as notificações. Para habilitar, acesse as configurações do navegador.
              </p>
            </div>
          </div>
        )}

        {isEnabled && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Novos agendamentos</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando um paciente agendar consulta
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Chegada de pacientes</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando paciente fizer check-in
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Triagem concluída</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando paciente estiver pronto para atendimento
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mensagens</Label>
                  <p className="text-sm text-muted-foreground">
                    Novas mensagens no chat
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Lembretes</Label>
                  <p className="text-sm text-muted-foreground">
                    Lembretes de consultas próximas
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={sendTestNotification} className="gap-2">
                <Send className="h-4 w-4" />
                Enviar teste
              </Button>
              <Button variant="ghost" onClick={disableNotifications} className="text-destructive">
                Desativar notificações
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
