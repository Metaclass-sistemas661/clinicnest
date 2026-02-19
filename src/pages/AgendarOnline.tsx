import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { Scissors, CheckCircle2, ArrowLeft, Loader2, CalendarDays, Clock, User, Sparkles, ShieldCheck } from "lucide-react";

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

  const quickDates = useMemo(() => {
    const today = new Date();
    const d1 = new Date(today);
    const d2 = new Date(today);
    const d3 = new Date(today);
    d1.setDate(d1.getDate() + 0);
    d2.setDate(d2.getDate() + 1);
    d3.setDate(d3.getDate() + 7);
    const toYmd = (d: Date) => d.toISOString().split("T")[0];
    return [
      { key: "today", label: "Hoje", value: toYmd(d1) },
      { key: "tomorrow", label: "Amanhã", value: toYmd(d2) },
      { key: "week", label: "+7 dias", value: toYmd(d3) },
    ];
  }, []);

  const slotLabel = useMemo(() => {
    if (!slot) return "";
    try {
      return new Date(slot).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return "";
    }
  }, [slot]);

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24 pt-10 md:py-10">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <Scissors className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{ctx.tenant.name}</h1>
          <p className="text-muted-foreground text-sm">Agende em poucos passos. Sem WhatsApp, sem espera.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Confirmação imediata
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Horários atualizados
            </span>
          </div>
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

        <div className="grid gap-6 md:grid-cols-[1.6fr_1fr] md:items-start">
          <Card className="overflow-hidden">
            <CardContent className="pt-6">
              {/* Step 1: Serviço + Profissional + Data + Horário */}
              {step === 1 && (
                <div className="space-y-7">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">Escolha o serviço</div>
                        <div className="text-xs text-muted-foreground">Selecione o que você quer fazer</div>
                      </div>
                    </div>

                    <RadioGroup
                      value={serviceId}
                      onValueChange={(v) => {
                        setServiceId(v);
                        setSlot("");
                      }}
                      className="grid gap-2 pt-2"
                    >
                      {ctx.services.map((s) => {
                        const isSelected = serviceId === s.id;
                        return (
                          <label
                            key={s.id}
                            className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all hover:bg-muted/40 ${
                              isSelected ? "border-primary/40 ring-2 ring-primary/20" : "border-border/70"
                            }`}
                          >
                            <RadioGroupItem value={s.id} className="mt-1" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{s.name}</div>
                                  {s.description ? (
                                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</div>
                                  ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-sm font-semibold">{formatCurrency(s.price)}</div>
                                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    {s.duration_minutes}min
                                  </div>
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">Escolha o profissional</div>
                        <div className="text-xs text-muted-foreground">Quem vai te atender</div>
                      </div>
                    </div>

                    <RadioGroup
                      value={professionalId}
                      onValueChange={(v) => {
                        setProfessionalId(v);
                        setSlot("");
                      }}
                      className="grid gap-2 pt-2"
                    >
                      {ctx.professionals.map((p) => {
                        const isSelected = professionalId === p.id;
                        return (
                          <label
                            key={p.id}
                            className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:bg-muted/40 ${
                              isSelected ? "border-primary/40 ring-2 ring-primary/20" : "border-border/70"
                            }`}
                          >
                            <RadioGroupItem value={p.id} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{p.full_name || "Profissional"}</div>
                              <div className="text-xs text-muted-foreground">Atendimento personalizado</div>
                            </div>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <CalendarDays className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="text-base font-semibold">Data</div>
                          <div className="text-xs text-muted-foreground">Escolha o dia</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {quickDates.map((d) => (
                          <Button
                            key={d.key}
                            type="button"
                            size="sm"
                            variant={date === d.value ? "default" : "outline"}
                            className={date === d.value ? "gradient-primary text-primary-foreground" : ""}
                            onClick={() => {
                              setDate(d.value);
                              setSlot("");
                            }}
                          >
                            {d.label}
                          </Button>
                        ))}
                      </div>

                      <div className="pt-2">
                        <Input
                          type="date"
                          min={todayStr}
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value);
                            setSlot("");
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Clock className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="text-base font-semibold">Horário</div>
                          <div className="text-xs text-muted-foreground">Escolha um horário livre</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                        {!canLoadSlots ? (
                          <div className="text-sm text-muted-foreground">
                            Selecione serviço, profissional e data para ver os horários.
                          </div>
                        ) : isLoadingSlots ? (
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 9 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full rounded-md" />
                            ))}
                          </div>
                        ) : slots.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Nenhum horário disponível nesta data.</div>
                        ) : (
                          <ScrollArea className="h-48">
                            <div className="grid grid-cols-3 gap-2 pr-3">
                              {slots.map((s) => {
                                const isSelected = slot === s;
                                const label = new Date(s).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "America/Sao_Paulo",
                                });
                                return (
                                  <Button
                                    key={s}
                                    type="button"
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    className={isSelected ? "gradient-primary text-primary-foreground" : ""}
                                    onClick={() => setSlot(s)}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  </div>

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
                  <div className="space-y-1">
                    <div className="text-base font-semibold">Seus dados</div>
                    <div className="text-xs text-muted-foreground">Só pra confirmarmos o agendamento</div>
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

          {/* Summary (desktop sticky) */}
          <div className="hidden md:block">
            <div className="sticky top-6">
              <Card className="overflow-hidden">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Resumo</div>
                    <div className="text-xs text-muted-foreground">Revise antes de confirmar</div>
                  </div>

                  <Separator />

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Serviço</div>
                        <div className="font-medium truncate">{selectedService?.name || "—"}</div>
                        {selectedService ? (
                          <div className="text-xs text-muted-foreground">
                            {selectedService.duration_minutes}min · {formatCurrency(selectedService.price)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Profissional</div>
                        <div className="font-medium truncate">{selectedProfessional?.full_name || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Data</div>
                        <div className="font-medium truncate">{date ? new Date(date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Horário</div>
                        <div className="font-medium truncate">{slotLabel || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                    Ao confirmar, o horário ficará reservado. Você poderá cancelar pelo link do e-mail (se informado) conforme política do salão.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile sticky action bar */}
        {(step === 1 || step === 2) && (
          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
            <div className="mx-auto w-full max-w-5xl px-4 pb-4">
              <div className="rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {selectedService?.name || "Selecione o serviço"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedProfessional?.full_name || "Profissional"}
                      {date ? ` · ${new Date(date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                      {slotLabel ? ` · ${slotLabel}` : ""}
                    </div>
                  </div>

                  {step === 1 ? (
                    <Button
                      className="gradient-primary text-primary-foreground shrink-0"
                      disabled={!canProceedStep1}
                      onClick={() => setStep(2)}
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      className="gradient-primary text-primary-foreground shrink-0"
                      disabled={isSubmitting || !clientName.trim()}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
