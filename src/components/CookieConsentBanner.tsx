import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getCookieConsentStatus,
  setCookieConsentStatus,
  type CookieConsentStatus,
} from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsentStatus>(null);

  useEffect(() => {
    setConsent(getCookieConsentStatus());
  }, []);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          Utilizamos cookies para estatísticas e melhoria da experiência. Ao clicar em
          {" "}
          <strong className="text-foreground">Aceitar</strong>, você autoriza o uso de cookies
          analíticos. Veja nossos
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
            }}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCookieConsentStatus("granted");
              setConsent("granted");
            }}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
