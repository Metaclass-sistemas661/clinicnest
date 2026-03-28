import { useState, useEffect, useCallback } from "react";

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

  const refresh = useCallback(async () => {
    try {
      // Precisa de permissão prévia para ver labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all
        .filter((d) => d.kind === "audioinput" && d.deviceId)
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfone ${d.deviceId.slice(0, 6)}`,
        }));
      setDevices(mics);

      // Se o dispositivo salvo não está mais disponível, limpa
      if (selectedId && !mics.some((m) => m.deviceId === selectedId)) {
        setSelectedId("");
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      }
    } catch {
      // Sem permissão — lista vazia
      setDevices([]);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    // Atualiza quando dispositivos mudam (plug/desplug)
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
