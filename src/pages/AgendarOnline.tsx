import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { Scissors, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

type ContextResponse = {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    min_lead_minutes: number;
    cancel_min_lead_minutes: number;
  };
  services: Array<{ id: string; name: string; description: string | null; duration_minutes: number; price: number }>;
  professionals: Array<{ id: string; full_name: string | null }>;
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AgendarOnline() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const cancelToken = searchParams.get("cancelToken") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [ctx, setCtx] = useState<ContextResponse | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [serviceId, setServiceId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [slot, setSlot] = useState<string>("");

  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [slots, setSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const canLoadSlots = useMemo(() => Boolean(serviceId && professionalId && date), [serviceId, professionalId, date]);

  const selectedService = useMemo(
    () => ctx?.services.find((s) => s.id === serviceId) ?? null,
    [ctx?.services, serviceId]
  );

  const selectedProfessional = useMemo(
    () => ctx?.professionals.find((p) => p.id === professionalId) ?? null,
    [ctx?.professionals, professionalId]
  );

  const canProceedStep1 = Boolean(serviceId && professionalId && date && slot);

  // Load context
  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const s = String(slug || "").trim();
        if (!s) {
          toast.error("Link inválido");
          return;
        }

        const { data, error } = await supabase.functions.invoke("public-booking", {
          body: { action: "get_context", slug: s },
        });

        if (error) {
          toast.error(error.message || "Erro ao carregar agendamento");
          return;
        }

        if (!data?.success) {
          toastRpcError(toast, data, "Agendamento indisponível");
          return;
        }

        setCtx(data as ContextResponse);
      } finally {
        setIsLoading(false);
      }
    };

    run().catch(() => {});
  }, [slug]);

  // Cancel flow
  useEffect(() => {
    const run = async () => {
      if (!cancelToken || !slug) return;

      setIsCancelling(true);
      try {
        const { data, error } = await supabase.functions.invoke("public-booking", {
          body: { action: "cancel", token: cancelToken, reason: null },
        });

        if (error) {
          toast.error(error.message || "Erro ao cancelar");
          return;
        }

        if (!data?.success) {
          toastRpcError(toast, data, "Não foi possível cancelar");
          return;
        }

        toast.success("Agendamento cancelado com sucesso!");
      } finally {
        setIsCancelling(false);
      }
    };

    run().catch(() => {});
  }, [cancelToken, slug]);

  // Load slots
  useEffect(() => {
    const run = async () => {
      if (!canLoadSlots) {
        setSlots([]);
        setSlot("");
        return;
      }

      setIsLoadingSlots(true);
      try {
        const { data, error } = await supabase.functions.invoke("public-booking", {
          body: {
            action: "get_slots",
            slug: String(slug || "").trim(),
            professional_id: professionalId,
            service_id: serviceId,
            date,
          },
        });

        if (error) {
          toast.error(error.message || "Erro ao carregar horários");
          return;
        }

        setSlots((data?.slots || []) as string[]);
        setSlot("");
      } finally {
        setIsLoadingSlots(false);
      }
    };

    run().catch(() => {});
  }, [canLoadSlots, slug, professionalId, serviceId, date]);

  const handleSubmit = async () => {
    if (!slug || !clientName.trim()) {
      toast.error("Preencha seu nome para continuar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-booking", {
        body: {
          action: "create",
          slug: String(slug).trim(),
          service_id: serviceId,
          professional_id: professionalId,
          scheduled_at: slot,
          client_name: clientName.trim(),
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          notes: notes || null,
        },
      });

      if (error) {
        toast.error(error.message || "Erro ao criar agendamento");
        return;
      }

      if (!data?.success) {
        toastRpcError(toast, data, "Erro ao criar agendamento");
        return;
      }

      setStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setServiceId("");
    setProfessionalId("");
    setDate("");
    setSlot("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setNotes("");
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
          <div className="flex flex-col items-center gap-3 py-6">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error / unavailable
  if (!ctx) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Scissors className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Agendamento indisponível</h2>
            <p className="text-muted-foreground text-sm">
              Não foi possível carregar este link. Verifique o endereço ou entre em contato com o salão.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cancel token UI
  if (cancelToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {isCancelling ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Cancelando agendamento...</p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold">Cancelamento processado</h2>
                <p className="text-muted-foreground text-sm">
                  Seu agendamento foi cancelado. Você pode fazer um novo agendamento a qualquer momento.
                </p>
                <Button variant="outline" onClick={() => window.location.assign(`/agendar/${slug}`)}>
                  Fazer novo agendamento
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Scissors className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">{ctx.tenant.name}</h1>
          <p className="text-muted-foreground text-sm">Agende seu horário de forma rápida e fácil</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  step === s
                    ? "gradient-primary text-primary-foreground"
                    : step > s
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              {s < 3 && (
                <div className={`h-0.5 w-8 sm:w-12 ${step > s ? "bg-green-400" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Serviço + Profissional + Data + Horário */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select value={serviceId} onValueChange={(v) => { setServiceId(v); setSlot(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {ctx.services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {s.duration_minutes}min · {formatCurrency(s.price)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedService && (
                    <div className="flex gap-2">
                      <Badge variant="secondary">{selectedService.duration_minutes} min</Badge>
                      <Badge variant="secondary">{formatCurrency(selectedService.price)}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select value={professionalId} onValueChange={(v) => { setProfessionalId(v); setSlot(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {ctx.professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || "Profissional"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    min={todayStr}
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setSlot(""); }}
                  />
                </div>

                {/* Horários - Grid visual */}
                {canLoadSlots && (
                  <div className="space-y-2">
                    <Label>Horário disponível</Label>
                    {isLoadingSlots ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhum horário disponível nesta data.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant={slot === s ? "default" : "outline"}
                            className={slot === s ? "gradient-primary text-primary-foreground" : ""}
                            onClick={() => setSlot(s)}
                          >
                            {new Date(s).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    className="gradient-primary text-primary-foreground"
                    disabled={!canProceedStep1}
                    onClick={() => setStep(2)}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Dados do cliente */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Resumo da seleção */}
                <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/50">
                  <div className="font-medium">{selectedService?.name}</div>
                  <div className="text-muted-foreground">
                    {selectedProfessional?.full_name} · {date && new Date(date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                    {slot && new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </div>
                  <div className="text-muted-foreground">
                    {selectedService && `${selectedService.duration_minutes}min · ${formatCurrency(selectedService.price)}`}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Seu nome *</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label>Seu telefone</Label>
                    <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Seu e-mail</Label>
                  <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Algo que devemos saber?" />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    className="gradient-primary text-primary-foreground"
                    disabled={isSubmitting || !clientName.trim()}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Confirmar agendamento"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmação */}
            {step === 3 && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold">Agendamento confirmado!</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Seu horário foi reservado com sucesso. {clientEmail ? "Você receberá uma confirmação por e-mail." : ""} Obrigado por agendar com{" "}
                  <span className="font-medium text-foreground">{ctx.tenant.name}</span>!
                </p>
                <div className="rounded-lg border p-4 text-sm space-y-1 text-left w-full max-w-sm">
                  <div><span className="text-muted-foreground">Serviço:</span> {selectedService?.name}</div>
                  <div><span className="text-muted-foreground">Profissional:</span> {selectedProfessional?.full_name}</div>
                  <div>
                    <span className="text-muted-foreground">Data:</span>{" "}
                    {date && new Date(date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                    {slot && new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </div>
                  <div><span className="text-muted-foreground">Valor:</span> {selectedService && formatCurrency(selectedService.price)}</div>
                </div>
                <Button variant="outline" onClick={resetForm} className="mt-2">
                  Fazer outro agendamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
