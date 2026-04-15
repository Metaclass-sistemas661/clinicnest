import { useState, useEffect, useCallback } from "react";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

export function useUnreadChatCount() {
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.tenant_id || !profile?.id) return;
    try {
      const { data, error } = await api.rpc("get_unread_chat_count", {
        p_channel: null,
        p_channel_id: null,
      });
      if (error) throw error;
      setUnreadCount(data ?? 0);
    } catch (err) {
      logger.error("useUnreadChatCount:", err);
    }
  }, [profile?.tenant_id, profile?.id]);

  useEffect(() => {
    void fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);

    const channel = api
      .channel(`unread-chat:${profile?.tenant_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_messages",
          filter: profile?.tenant_id ? `tenant_id=eq.${profile.tenant_id}` : undefined,
        },
        () => {
          void fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void api.removeChannel(channel);
    };
  }, [profile?.tenant_id, fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
}
