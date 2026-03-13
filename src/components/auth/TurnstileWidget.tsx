import { useEffect, useRef, useCallback, useState } from "react";

// ─── Turnstile Site Key ────────────────────────────────────────────────────────
// Em produção, defina VITE_TURNSTILE_SITE_KEY no .env
// Se não definida, o widget não será renderizado e o captcha será ignorado.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

/** Indica se o Turnstile está configurado (útil para condicionar canSubmit) */
export const isTurnstileEnabled = !!SITE_KEY;

// ─── Tipos do Turnstile ────────────────────────────────────────────────────────
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          language?: string;
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

// ─── Script loader (singleton) ─────────────────────────────────────────────────
let scriptLoaded = false;
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded && window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if (window.turnstile) {
      scriptLoaded = true;
      resolve();
      return;
    }

    window.onTurnstileLoad = () => {
      scriptLoaded = true;
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Falha ao carregar Turnstile"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  className?: string;
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  theme = "auto",
  size = "normal",
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !containerRef.current || !window.turnstile) return;

    // Remove previous widget if exists
    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      "expired-callback": onExpire,
      "error-callback": onError,
      theme,
      size,
      language: "pt-br",
      appearance: "always",
    });
  }, [onVerify, onExpire, onError, theme, size]);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
          renderWidget();
        }
      })
      .catch(() => {
        // Silently fail — form still works sem captcha
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  // Se não há SITE_KEY configurada, não renderiza o widget
  if (!SITE_KEY) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: isReady ? undefined : 0 }}
    />
  );
}

// ─── Hook para uso simplificado ────────────────────────────────────────────────
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);

  const onVerify = useCallback((t: string) => setToken(t), []);
  const onExpire = useCallback(() => setToken(null), []);
  const onError = useCallback(() => setToken(null), []);
  const reset = useCallback(() => setToken(null), []);

  return { token, onVerify, onExpire, onError, reset };
}
