/**
 * Hook de Push Notifications para o portal do paciente.
 * Usa supabasePatient para salvar token FCM e gerenciar permissões.
 */
import { useState, useEffect, useCallback } from "react";
import { supabasePatient } from "@/integrations/supabase/client";
import {
  requestNotificationPermission,
  onForegroundMessage,
  isNotificationEnabled,
  canRequestNotification,
  showLocalNotification,
} from "@/lib/firebase";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";

export function usePatientPushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Check support and current state
  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator;
    setIsSupported(supported);
    setIsEnabled(isNotificationEnabled());
    setCanRequest(canRequestNotification());
  }, []);

  // Foreground message listener
  useEffect(() => {
    if (!isEnabled) return;

    onForegroundMessage((payload) => {
      const notification = payload.notification || payload.data;
      if (notification) {
        toast(notification.title, {
          description: notification.body,
          action: payload.data?.clickAction
            ? {
                label: "Ver",
                onClick: () => {
                  window.location.href = payload.data.clickAction;
                },
              }
            : undefined,
        });
      }
    });
  }, [isEnabled]);

  // Request permission and register token
  const enableNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) {
        toast.error("Faça login para habilitar notificações");
        return false;
      }

      const token = await requestNotificationPermission();
      if (!token) {
        toast.error("Não foi possível habilitar notificações");
        return false;
      }

      setFcmToken(token);

      // Save token in push_subscriptions (same table, no tenant_id for patients)
      const deviceInfo = getDeviceInfo();
      const { error } = await (supabasePatient as any)
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            tenant_id: null, // patient — not linked to a specific tenant
            fcm_token: token,
            device_name: deviceInfo.name,
            platform: deviceInfo.platform,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,fcm_token" }
        );

      if (error) {
        logger.error("Erro ao salvar token FCM (paciente):", error);
      }

      setIsEnabled(true);
      setCanRequest(false);
      toast.success("Notificações habilitadas!");
      return true;
    } catch (error) {
      logger.error("Erro ao habilitar notificações (paciente):", error);
      toast.error("Erro ao habilitar notificações", { description: normalizeError(error, "Verifique as permissões do navegador.") });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disable notifications
  const disableNotifications = useCallback(async () => {
    if (!fcmToken) return;
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return;

      await (supabasePatient as any)
        .from("push_subscriptions")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("fcm_token", fcmToken);

      setIsEnabled(false);
      toast.success("Notificações desabilitadas");
    } catch (error) {
      logger.error("Erro ao desabilitar notificações (paciente):", error);
    }
  }, [fcmToken]);

  // Test notification
  const sendTestNotification = useCallback(() => {
    if (!isEnabled) {
      toast.error("Habilite as notificações primeiro");
      return;
    }
    showLocalNotification("Teste — Portal do Paciente", {
      body: "As notificações push estão funcionando!",
      tag: "patient-test",
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

function getDeviceInfo(): { name: string; platform: string } {
  const ua = navigator.userAgent;
  let platform = "web";
  let name = "Navegador";

  if (/iPhone|iPad|iPod/.test(ua)) {
    platform = "ios";
    name = /iPad/.test(ua) ? "iPad" : "iPhone";
  } else if (/Android/.test(ua)) {
    platform = "android";
    name = "Android";
  } else if (/Windows/.test(ua)) {
    platform = "windows";
    name = "Windows";
  } else if (/Mac/.test(ua)) {
    platform = "macos";
    name = "Mac";
  } else if (/Linux/.test(ua)) {
    platform = "linux";
    name = "Linux";
  }

  if (/Chrome/.test(ua) && !/Edg/.test(ua)) name += " Chrome";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) name += " Safari";
  else if (/Firefox/.test(ua)) name += " Firefox";
  else if (/Edg/.test(ua)) name += " Edge";

  return { name, platform };
}
