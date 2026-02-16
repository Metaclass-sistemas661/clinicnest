import { useCallback, useEffect, useMemo, useState } from "react";

function storageKey(tenantId: string) {
  return `beautygest:simple_mode:${tenantId}`;
}

export function getSimpleMode(tenantId: string | null | undefined): boolean {
  if (!tenantId) return false;
  try {
    return localStorage.getItem(storageKey(tenantId)) === "1";
  } catch {
    return false;
  }
}

export function setSimpleMode(tenantId: string | null | undefined, enabled: boolean) {
  if (!tenantId) return;
  try {
    localStorage.setItem(storageKey(tenantId), enabled ? "1" : "0");
    window.dispatchEvent(new Event("beautygest:simple_mode_changed"));
  } catch {
    // ignore
  }
}

export function useSimpleMode(tenantId: string | null | undefined) {
  const [enabled, setEnabled] = useState(() => getSimpleMode(tenantId));

  useEffect(() => {
    setEnabled(getSimpleMode(tenantId));
  }, [tenantId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!tenantId) return;
      if (e.key === storageKey(tenantId)) {
        setEnabled(getSimpleMode(tenantId));
      }
    };

    const onCustom = () => {
      setEnabled(getSimpleMode(tenantId));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("beautygest:simple_mode_changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beautygest:simple_mode_changed", onCustom);
    };
  }, [tenantId]);

  const set = useCallback(
    (next: boolean) => {
      setSimpleMode(tenantId, next);
      setEnabled(next);
    },
    [tenantId]
  );

  return useMemo(() => ({ enabled, set }), [enabled, set]);
}
