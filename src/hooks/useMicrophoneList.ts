import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "clinicnest:preferred-mic";

export interface MicDevice {
  deviceId: string;
  label: string;
}

export function useMicrophoneList() {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const hasPermissionRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      // Só pede permissão na primeira vez — evita re-adquirir stream
      // que pode trocar deviceIds no Chrome/Windows
      if (!hasPermissionRef.current) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((t) => t.stop());
        hasPermissionRef.current = true;
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all
        .filter((d) => d.kind === "audioinput" && d.deviceId)
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfone ${d.deviceId.slice(0, 6)}`,
        }));
      setDevices(mics);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, [refresh]);

  const select = useCallback((deviceId: string) => {
    setSelectedId(deviceId);
    try {
      if (deviceId) {
        localStorage.setItem(STORAGE_KEY, deviceId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* noop */ }
  }, []);

  return { devices, selectedId, select, refresh };
}
