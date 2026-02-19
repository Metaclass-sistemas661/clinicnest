import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Loader2, CalendarCheck, Scissors } from "lucide-react";

type State = "loading" | "confirmed" | "already_confirmed" | "cancelled" | "not_found" | "error";

export default function ConfirmarAgendamento() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setState("not_found");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("public-booking", {
          body: { action: "confirm", token },
        });

        if (error) {
          setState("error");
          return;
        }

        if (!data?.success) {
          const msg = String(data?.message ?? "");
          if (msg.toLowerCase().includes("cancelado")) {
            setState("cancelled");
          } else if (msg.toLowerCase().includes("não encontrado")) {
            setState("not_found");
          } else {
            setState("error");
          }
          return;
        }

        setState(data.already_confirmed ? "already_confirmed" : "confirmed");
      } catch {
        setState("error");
      }
    };

    run();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
          {state === "loading" && (
            <>
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando sua presença...
              </div>
            </>
          )}

          {(state === "confirmed" || state === "already_confirmed") && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 ring-4 ring-green-100/60 dark:ring-green-900/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {state === "already_confirmed" ? "Já confirmado!" : "Presença confirmada!"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  {state === "already_confirmed"
                    ? "Sua presença já havia sido confirmada anteriormente. Até logo!"
                    : "Obrigado por confirmar! Seu horário está reservado. Esperamos você."}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.history.back()}
                >
                  <CalendarCheck className="h-4 w-4" />
                  Voltar
                </Button>
              </div>
            </>
          )}

          {state === "cancelled" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <XCircle className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Agendamento cancelado</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Este agendamento já foi cancelado e não pode ser confirmado. Se precisar, faça um novo agendamento.
                </p>
              </div>
            </>
          )}

          {state === "not_found" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Scissors className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Link inválido</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Não encontramos um agendamento associado a este link. Verifique o e-mail ou entre em contato com a clínica.
                </p>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Erro ao confirmar</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Ocorreu um problema ao processar sua confirmação. Tente novamente ou entre em contato com a clínica.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setState("loading");
                  window.location.reload();
                }}
              >
                Tentar novamente
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
