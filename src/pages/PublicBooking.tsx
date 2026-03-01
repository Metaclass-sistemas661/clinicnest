import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  Stethoscope,
  Tag,
  Loader2,
  CheckCircle2,
  Heart,
  AlertTriangle,
  XCircle,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/formatCurrency";

/* ── Types ── */
interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
}

interface Professional {
  id: string;
  full_name: string;
}

interface TenantContext {
  id: string;
  name: string;
  slug: string;
  min_lead_minutes: number;
  cancel_min_lead_minutes: number;
}

type Step = "loading" | "error" | "disabled" | "select" | "slots" | "form" | "success" | "cancel";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callBookingApi(body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/public-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.error || data.message || "Erro desconhecido");
  }
  return data;
}

/* ── Component ── */
export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const cancelToken = searchParams.get("cancelToken");

  const [step, setStep] = useState<Step>("loading");
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  // Selection
  const [selectedService, setSelectedService] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancel
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Initial load
  useEffect(() => {
    if (!slug) { setStep("error"); return; }

    if (cancelToken) {
      setStep("cancel");
      return;
    }

    (async () => {
      try {
        const data = await callBookingApi({ action: "get_context", slug });
        if (!data.success) {
          if (data.details === "BOOKING_DISABLED") {
            setStep("disabled");
          } else {
            setStep("error");
          }
          return;
        }
        setTenant(data.tenant);
        setServices(data.services || []);
        setProfessionals(data.professionals || []);
        setStep("select");
      } catch (err) {
        logger.error("PublicBooking context:", err);
        setStep("error");
      }
    })();
  }, [slug, cancelToken]);

  // Load slots when date changes
  const fetchSlots = useCallback(async () => {
    if (!slug || !selectedService || !selectedProfessional || !selectedDate) return;
    setIsLoadingSlots(true);
    setSlots([]);
    setSelectedSlot("");
    try {
      const data = await callBookingApi({
        action: "get_slots",
        slug,
        professional_id: selectedProfessional,
        service_id: selectedService,
        date: selectedDate,
      });
      setSlots(data.slots || []);
    } catch (err) {
      logger.error("PublicBooking slots:", err);
      toast.error("Erro ao carregar horários");
    } finally {
      setIsLoadingSlots(false);
    }
  }, [slug, selectedService, selectedProfessional, selectedDate]);

  useEffect(() => { void fetchSlots(); }, [fetchSlots]);

  const selectedServiceObj = services.find((s) => s.id === selectedService);

  // Generate date options (next 30 days)
  const dateOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      opts.push({
        value: format(d, "yyyy-MM-dd"),
        label: format(d, "EEEE, dd/MM", { locale: ptBR }),
      });
    }
    return opts;
  }, []);

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setIsSubmitting(true);
    try {
      await callBookingApi({
        action: "create",
        slug,
        service_id: selectedService,
        professional_id: selectedProfessional,
        scheduled_at: selectedSlot,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        notes: notes.trim() || null,
      });
      setStep("success");
    } catch (err: any) {
      logger.error("PublicBooking create:", err);
      toast.error(err.message || "Erro ao agendar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelToken) return;
    setIsCancelling(true);
    try {
      await callBookingApi({
        action: "cancel",
        token: cancelToken,
        reason: cancelReason.trim() || null,
      });
      toast.success("Agendamento cancelado com sucesso");
      setStep("success");
    } catch (err: any) {
      logger.error("PublicBooking cancel:", err);
      toast.error(err.message || "Erro ao cancelar");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600">
            <Heart className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{tenant?.name ?? "Agendamento Online"}</h1>
            <p className="text-xs text-muted-foreground">Agendamento online seguro</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Loading */}
        {step === "loading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-muted-foreground">Carregando informações da clínica...</p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {step === "error" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <h2 className="text-lg font-semibold">Clínica não encontrada</h2>
              <p className="text-sm text-muted-foreground text-center">
                Verifique o link de agendamento e tente novamente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Disabled */}
        {step === "disabled" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <XCircle className="h-10 w-10 text-red-500" />
              <h2 className="text-lg font-semibold">Agendamento online indisponível</h2>
              <p className="text-sm text-muted-foreground text-center">
                Esta clínica não está aceitando agendamentos online no momento. Entre em contato diretamente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cancel flow */}
        {step === "cancel" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Cancelar Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
              </p>
              <div>
                <Label>Motivo do cancelamento (opcional)</Label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Informe o motivo, se desejar"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={() => void handleCancel()}
                  disabled={isCancelling}
                >
                  {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Cancelamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {step === "success" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">
                {cancelToken ? "Agendamento cancelado" : "Agendamento realizado!"}
              </h2>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                {cancelToken
                  ? "Seu agendamento foi cancelado com sucesso."
                  : "Você receberá um e-mail com a confirmação. Obrigado por agendar conosco!"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select service, professional, date */}
        {step === "select" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-teal-600" />
                  Escolha o serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedService === svc.id
                        ? "border-teal-600 bg-teal-50 dark:bg-teal-950"
                        : "border-border hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{svc.name}</span>
                      <div className="flex items-center gap-2">
                        {svc.price > 0 && (
                          <Badge variant="secondary">{formatCurrency(svc.price)}</Badge>
                        )}
                        <Badge variant="outline">{svc.duration_minutes} min</Badge>
                      </div>
                    </div>
                    {svc.description && (
                      <p className="text-xs text-muted-foreground mt-1">{svc.description}</p>
                    )}
                  </button>
                ))}
                {services.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum serviço disponível no momento.
                  </p>
                )}
              </CardContent>
            </Card>

            {selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-teal-600" />
                    Profissional
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {selectedService && selectedProfessional && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-teal-600" />
                    Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedDate} onValueChange={setSelectedDate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a data" />
                    </SelectTrigger>
                    <SelectContent>
                      {dateOptions.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" />
                    Horário disponível
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum horário disponível nesta data. Tente outra data.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {slots.map((slot) => {
                        const time = format(new Date(slot), "HH:mm");
                        return (
                          <button
                            key={slot}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep("form");
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                              selectedSlot === slot
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-border hover:border-teal-400"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Client info form */}
        {step === "form" && (
          <div className="space-y-6">
            {/* Service summary */}
            <Card className="bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800">
              <CardContent className="pt-4 pb-3 space-y-1 text-sm">
                <p><strong>Serviço:</strong> {selectedServiceObj?.name}</p>
                <p><strong>Profissional:</strong> {professionals.find((p) => p.id === selectedProfessional)?.full_name}</p>
                <p><strong>Data/Hora:</strong> {format(new Date(selectedSlot), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <Button variant="link" size="sm" className="px-0" onClick={() => setStep("select")}>
                  ← Alterar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Seus dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Nome completo *
                  </Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> E-mail
                  </Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="seu@email.com (para receber a confirmação)"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Telefone
                  </Label>
                  <Input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais (opcional)"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep("select")}>
                    Voltar
                  </Button>
                  <Button onClick={() => void handleSubmit()} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Agendamento seguro por <span className="font-semibold text-teal-600">ClinicFlow</span>
      </footer>
    </div>
  );
}
