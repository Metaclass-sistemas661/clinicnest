import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  getCookieConsentStatus,
  setCookieConsentStatus,
  type CookieConsentStatus,
} from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const location = useLocation();
  const [consent, setConsent] = useState<CookieConsentStatus>(null);
  const [isOpen, setIsOpen] = useState(false);
  const shouldAutoOpen =
    location.pathname === "/" ||
    location.pathname === "/contato" ||
    location.pathname === "/termos-de-uso" ||
    location.pathname === "/politica-de-privacidade";

  useEffect(() => {
    setConsent(getCookieConsentStatus());
  }, [location.pathname]);

  useEffect(() => {
    if (shouldAutoOpen) {
      setIsOpen(true);
      return;
    }
    setIsOpen(false);
  }, [shouldAutoOpen, location.pathname]);

  useEffect(() => {
    const syncConsent = () => setConsent(getCookieConsentStatus());
    const openPreferences = () => setIsOpen(true);

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-6xl rounded-2xl border-2 border-violet-300 bg-gradient-to-r from-violet-50 via-background to-fuchsia-50 shadow-2xl shadow-violet-500/25 ring-1 ring-violet-200/80 backdrop-blur supports-[backdrop-filter]:bg-background/95">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Privacidade e Cookies (LGPD)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {consent === null ? (
                  <>
                    Utilizamos cookies estritamente necessários para o funcionamento do site.
                    Mediante seu consentimento, também utilizamos cookies analíticos para mensurar
                    audiência, desempenho e aprimorar nossos serviços, nos termos da LGPD.
                  </>
                ) : (
                  <>
                    Gestão de consentimento: atualmente os cookies analíticos estão{" "}
                    <strong className="text-foreground">
                      {consent === "granted" ? "ativados" : "desativados"}
                    </strong>
                    . Você pode revisar e alterar sua escolha a qualquer momento.
                  </>
                )}
                {" "}Consulte nossos
                {" "}
                <Link to="/termos-de-uso" className="underline underline-offset-2 hover:text-foreground">
                  Termos de Uso
                </Link>
                {" "}e{" "}
                <Link
                  to="/politica-de-privacidade"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="border-violet-300 bg-white/80 hover:bg-white"
              onClick={() => {
                setCookieConsentStatus("denied");
                setConsent("denied");
                setIsOpen(false);
              }}
            >
              Recusar analíticos
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-violet-600 to-fuchsia-500 font-semibold hover:from-violet-700 hover:to-fuchsia-600"
              onClick={() => {
                setCookieConsentStatus("granted");
                setConsent("granted");
                setIsOpen(false);
              }}
            >
              Aceitar analíticos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
