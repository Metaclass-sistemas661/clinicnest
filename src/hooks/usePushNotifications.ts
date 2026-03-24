// Hook para gerenciar Push Notifications
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  requestNotificationPermission, 
  onForegroundMessage, 
  isNotificationEnabled,
  canRequestNotification,
  showLocalNotification,
  PushNotificationPayload
} from '@/lib/firebase';
import { toast } from 'sonner';
import { normalizeError } from "@/utils/errorMessages";
import { logger } from '@/lib/logger';

export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_name: string;
  platform: string;
  is_active: boolean;
  created_at: string;
}

export function usePushNotifications() {
  const { profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Verificar suporte e status
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);
      setIsEnabled(isNotificationEnabled());
      setCanRequest(canRequestNotification());
    };
    checkSupport();
  }, []);

  // Configurar listener de mensagens em foreground
  useEffect(() => {
    if (!isEnabled) return;

    onForegroundMessage((payload) => {
      const notification = payload.notification || payload.data;
      if (notification) {
        // Mostrar toast em vez de notificação nativa (app está aberto)
        toast(notification.title, {
          description: notification.body,
          action: payload.data?.clickAction ? {
            label: 'Ver',
            onClick: () => window.location.href = payload.data.clickAction,
          } : undefined,
        });
      }
    });
  }, [isEnabled]);

  // Solicitar permissão e registrar token
  const enableNotifications = useCallback(async () => {
    if (!profile?.id) {
      toast.error('Faça login para habilitar notificações');
      return false;
    }

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();
      
      if (!token) {
        toast.error('Não foi possível habilitar notificações');
        return false;
      }

      setFcmToken(token);

      // Salvar token no banco
      const deviceInfo = getDeviceInfo();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          fcm_token: token,
          device_name: deviceInfo.name,
          platform: deviceInfo.platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,fcm_token',
        });

      if (error) {
        logger.error('Erro ao salvar token FCM:', error);
        // Não falhar se tabela não existir ainda
      }

      setIsEnabled(true);
      setCanRequest(false);
      toast.success('Notificações habilitadas!');
      return true;

    } catch (error) {
      logger.error('Erro ao habilitar notificações:', error);
      toast.error('Erro ao habilitar notificações', { description: normalizeError(error, 'Verifique as permissões do navegador.') });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, profile?.tenant_id]);

  // Desabilitar notificações
  const disableNotifications = useCallback(async () => {
    if (!profile?.id || !fcmToken) return;

    try {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', profile.id)
        .eq('fcm_token', fcmToken);

      setIsEnabled(false);
      toast.success('Notificações desabilitadas');
    } catch (error) {
      logger.error('Erro ao desabilitar notificações:', error);
    }
  }, [profile?.id, fcmToken]);

  // Enviar notificação de teste
  const sendTestNotification = useCallback(() => {
    if (!isEnabled) {
      toast.error('Habilite as notificações primeiro');
      return;
    }

    showLocalNotification('Teste de Notificação', {
      body: 'As notificações estão funcionando corretamente!',
      tag: 'test',
    });
  }, [isEnabled]);

  return {
    isSupported,
    isEnabled,
    canRequest,
    isLoading,
    fcmToken,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  };
}

// Obter informações do dispositivo
function getDeviceInfo(): { name: string; platform: string } {
  const ua = navigator.userAgent;
  let platform = 'web';
  let name = 'Navegador';

  if (/iPhone|iPad|iPod/.test(ua)) {
    platform = 'ios';
    name = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Android/.test(ua)) {
    platform = 'android';
    name = 'Android';
  } else if (/Windows/.test(ua)) {
    platform = 'windows';
    name = 'Windows';
  } else if (/Mac/.test(ua)) {
    platform = 'macos';
    name = 'Mac';
  } else if (/Linux/.test(ua)) {
    platform = 'linux';
    name = 'Linux';
  }

  // Adicionar navegador
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    name += ' Chrome';
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    name += ' Safari';
  } else if (/Firefox/.test(ua)) {
    name += ' Firefox';
  } else if (/Edg/.test(ua)) {
    name += ' Edge';
  }

  return { name, platform };
}
