import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Loader2, CalendarCheck, Clock, Stethoscope } from "lucide-react";

type State = "loading" | "available" | "booked" | "expired" | "error";

interface SlotInfo {
  appointment_date: string;
  service_name: string;
  professional_name: string;
  clinic_name: string;
}

export default function WaitlistAutoBooking() {
  const { waitlistId } = useParams<{ waitlistId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const [state, setState] = useState<State>("loading");
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!waitlistId) { setState("error"); return; }

      try {
        const { data, error } = await supabase.functions.invoke("waitlist-auto-book", {
          body: { action: "check", waitlist_id: waitlistId, token },
        });

        if (error || !data?.success) {
          setState(data?.expired ? "expired" : "error");
          return;
        }

        setSlot(data.slot);
        setState("available");
      } catch {
        setState("error");
      }
    };

    void load();
  }, [waitlistId, token]);

  const handleBook = async () => {
    if (!waitlistId) return;
    setIsBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("waitlist-auto-book", {
        body: { action: "book", waitlist_id: waitlistId, token },
      });

      if (error || !data?.success) {
        setState(data?.expired ? "expired" : "error");
        return;
      }

      setState("booked");
    } catch {
      setState("error");
    } finally {
      setIsBooking(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/20 flex items-center justify-center px-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
          {state === "loading" && (
            <>
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando disponibilidade...
              </div>
            </>
          )}

          {state === "available" && slot && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 ring-4 ring-emerald-100/60 dark:ring-emerald-900/20">
                <CalendarCheck className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Vaga Disponível!</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Uma vaga ficou disponível para você na lista de espera.
                </p>
              </div>

              <div className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{formatDate(slot.appointment_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Stethoscope className="h-4 w-4 text-emerald-600" />
                  <span>{slot.service_name} com {slot.professional_name}</span>
                </div>
              </div>

              <Button
                onClick={handleBook}
                disabled={isBooking}
                className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                size="lg"
              >
                {isBooking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-4 w-4" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Ao confirmar, a consulta será agendada automaticamente.
              </p>
            </>
          )}

          {state === "booked" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 ring-4 ring-green-100/60 dark:ring-green-900/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Agendado com Sucesso!</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Sua consulta foi confirmada. Você receberá um lembrete antes do horário.
                </p>
              </div>
            </>
          )}

          {state === "expired" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <XCircle className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Vaga não disponível</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Esta vaga já foi preenchida ou o link expirou. Você permanece na lista de espera.
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
                <h1 className="text-xl font-bold">Erro</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  Não foi possível processar sua solicitação. Entre em contato com a clínica.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
