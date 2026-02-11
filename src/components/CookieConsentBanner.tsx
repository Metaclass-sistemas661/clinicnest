import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  getCookieConsentStatus,
  setCookieConsentStatus,
  type CookieConsentStatus,
} from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsentStatus>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const currentConsent = getCookieConsentStatus();
    setConsent(currentConsent);
    setIsOpen(currentConsent === null);
  }, []);

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
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
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

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
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
            onClick={() => {
              setCookieConsentStatus("granted");
              setConsent("granted");
              setIsOpen(false);
            }}
          >
            Aceitar analíticos
          </Button>
          {consent !== null ? (
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
