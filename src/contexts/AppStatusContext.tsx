import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AppStatus = {
  isOnline: boolean;
  lastRefreshedAt: string | null;
  markRefreshed: (source?: string) => void;
};

const AppStatusContext = createContext<AppStatus | null>(null);

function storageKey(tenantId: string, userId: string) {
  return `beautygest:last_refresh:${tenantId}:${userId}`;
}

export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const markRefreshed = useCallback((source?: string) => {
    const iso = new Date().toISOString();
    setLastRefreshedAt(iso);

    try {
      window.dispatchEvent(
        new CustomEvent("beautygest:app_refreshed", {
          detail: { at: iso, source: source ?? null },
        })
      );
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ isOnline, lastRefreshedAt, markRefreshed }), [isOnline, lastRefreshedAt, markRefreshed]);

  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

export function useAppStatus() {
  const ctx = useContext(AppStatusContext);
  if (!ctx) throw new Error("useAppStatus must be used within an AppStatusProvider");
  return ctx;
}

export function usePersistedLastRefresh(tenantId: string | null | undefined, userId: string | null | undefined) {
  const { lastRefreshedAt, markRefreshed } = useAppStatus();
  const [persisted, setPersisted] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !userId) {
      setPersisted(null);
      return;
    }
    try {
      setPersisted(localStorage.getItem(storageKey(tenantId, userId)));
    } catch {
      setPersisted(null);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    if (!tenantId || !userId || !lastRefreshedAt) return;
    try {
      localStorage.setItem(storageKey(tenantId, userId), lastRefreshedAt);
      setPersisted(lastRefreshedAt);
    } catch {
      // ignore
    }
  }, [tenantId, userId, lastRefreshedAt]);

  useEffect(() => {
    if (!tenantId || !userId) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(tenantId, userId)) {
        setPersisted(e.newValue);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tenantId, userId]);

  return useMemo(
    () => ({ lastRefreshedAt: persisted, markRefreshed }),
    [persisted, markRefreshed]
  );
}
