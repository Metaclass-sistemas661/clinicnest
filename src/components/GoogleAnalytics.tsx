import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getCookieConsentStatus, type CookieConsentStatus } from "@/lib/cookieConsent";

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Google Analytics 4 - carrega apenas se VITE_GA_MEASUREMENT_ID estiver configurado.
 * Crie uma propriedade GA4 em analytics.google.com e defina a variável de ambiente.
 */
export function GoogleAnalytics() {
  const location = useLocation();
  const [consentStatus, setConsentStatus] = useState<CookieConsentStatus>(() =>
    getCookieConsentStatus()
  );

  useEffect(() => {
    const syncConsent = () => setConsentStatus(getCookieConsentStatus());
    window.addEventListener("cookie-consent-changed", syncConsent);
    window.addEventListener("storage", syncConsent);
    return () => {
      window.removeEventListener("cookie-consent-changed", syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
    if (consentStatus !== "granted") return;

    // Injetar script gtag se ainda não existir
    if (!window.gtag) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function (...args: unknown[]) {
        window.dataLayer?.push(args);
      };
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, {
        send_page_view: false,
      });
    }

    // Enviar page_view na navegação
    window.gtag?.("event", "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search, consentStatus]);

  return null;
}
