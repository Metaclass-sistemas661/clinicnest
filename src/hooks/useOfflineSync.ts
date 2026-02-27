import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStatus } from "@/contexts/AppStatusContext";
import { supabase } from "@/integrations/supabase/client";
import { offlineCache } from "@/lib/offline-cache";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface UseOfflineSyncOptions {
  autoSync?: boolean;
  syncIntervalMinutes?: number;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const { autoSync = true, syncIntervalMinutes = 15 } = options;
  const { profile } = useAuth();
  const { isOnline } = useAppStatus();
  const tenantId = profile?.tenant_id;

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  // Sync data from server to cache
  const syncFromServer = useCallback(async () => {
    if (!tenantId || !isOnline) return;

    setSyncing(true);
    try {
      // Fetch today's and tomorrow's appointments
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [appointmentsRes, patientsRes, servicesRes, professionalsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, client:clients(id, full_name, phone), service:services(id, name), professional:profiles(id, full_name)")
          .eq("tenant_id", tenantId)
          .gte("scheduled_at", today.toISOString().split("T")[0])
          .lte("scheduled_at", tomorrow.toISOString().split("T")[0] + "T23:59:59")
          .order("scheduled_at"),
        supabase
          .from("patients")
          .select("id, full_name, phone, email, cpf, birth_date")
          .eq("tenant_id", tenantId)
          .order("full_name")
          .limit(500),
        supabase
          .from("procedures")
          .select("id, name, price, duration_minutes, category")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("profiles")
          .select("id, full_name, professional_type")
          .eq("tenant_id", tenantId)
          .order("full_name"),
      ]);

      // Cache the data
      if (appointmentsRes.data) {
        await offlineCache.cacheItems("appointments", appointmentsRes.data, tenantId);
      }
      if (patientsRes.data) {
        await offlineCache.cacheItems("patients", patientsRes.data, tenantId);
      }
      if (servicesRes.data) {
        await offlineCache.cacheItems("services", servicesRes.data, tenantId);
      }
      if (professionalsRes.data) {
        await offlineCache.cacheItems("professionals", professionalsRes.data, tenantId);
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      await offlineCache.setMetadata(`last_full_sync_${tenantId}`, now);
    } catch (e) {
      logger.error("[offline-sync] Error syncing from server:", e);
    } finally {
      setSyncing(false);
    }
  }, [tenantId, isOnline]);

  // Sync pending changes to server
  const syncToServer = useCallback(async () => {
    if (!isOnline) return;

    const queue = await offlineCache.getSyncQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of queue) {
      try {
        if (item.action === "create") {
          await supabase.from(item.table as any).insert(item.data);
        } else if (item.action === "update") {
          await supabase.from(item.table as any).update(item.data).eq("id", item.data.id);
        } else if (item.action === "delete") {
          await supabase.from(item.table as any).delete().eq("id", item.data.id);
        }

        await offlineCache.removeSyncItem(item.id);
        successCount++;
      } catch (e) {
        logger.error(`[offline-sync] Error syncing item ${item.id}:`, e);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} alterações sincronizadas`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} alterações falharam ao sincronizar`);
    }

    setPendingSyncs(errorCount);
    setSyncing(false);
  }, [isOnline]);

  // Load pending syncs count
  useEffect(() => {
    async function loadPendingSyncs() {
      const queue = await offlineCache.getSyncQueue();
      setPendingSyncs(queue.length);
    }
    loadPendingSyncs();
  }, []);

  // Auto sync when coming online
  useEffect(() => {
    if (isOnline && autoSync) {
      syncToServer();
      syncFromServer();
    }
  }, [isOnline, autoSync, syncToServer, syncFromServer]);

  // Periodic sync
  useEffect(() => {
    if (!autoSync || !isOnline) return;

    const interval = setInterval(() => {
      syncFromServer();
    }, syncIntervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoSync, isOnline, syncIntervalMinutes, syncFromServer]);

  // Initial sync
  useEffect(() => {
    if (tenantId && isOnline && autoSync) {
      syncFromServer();
    }
  }, [tenantId]);

  return {
    syncing,
    lastSyncAt,
    pendingSyncs,
    isOnline,
    syncFromServer,
    syncToServer,
    forceSync: async () => {
      await syncToServer();
      await syncFromServer();
    },
  };
}

// Hook to get cached data with fallback to server
export function useOfflineData<T>(
  store: "appointments" | "patients" | "services" | "professionals",
  fetchFn: () => Promise<T[]>,
  deps: any[] = []
) {
  const { profile } = useAuth();
  const { isOnline } = useAppStatus();
  const tenantId = profile?.tenant_id;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!tenantId) return;

      setLoading(true);

      // Try to get from cache first
      const cached = await offlineCache.getCachedItems<T>(store, tenantId);
      if (cached.length > 0) {
        setData(cached);
        setFromCache(true);
        setLoading(false);
      }

      // If online, fetch fresh data
      if (isOnline) {
        try {
          const fresh = await fetchFn();
          setData(fresh);
          setFromCache(false);
          await offlineCache.cacheItems(store, fresh as any[], tenantId);
        } catch (e) {
          logger.error(`[useOfflineData] Error fetching ${store}:`, e);
          // Keep cached data if fetch fails
          if (cached.length === 0) {
            setData([]);
          }
        }
      }

      setLoading(false);
    }

    loadData();
  }, [tenantId, isOnline, store, ...deps]);

  return { data, loading, fromCache, isOnline };
}
