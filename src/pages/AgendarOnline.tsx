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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import {
  Scissors,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  CalendarDays,
  Clock,
  User,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronsUpDown,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ContextResponse = {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    min_lead_minutes: number;
    cancel_min_lead_minutes: number;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
  }>;
  professionals: Array<{ id: string; full_name: string | null }>;
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getInitials(name: string | null): string {
  if (!name) return "P";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Service Combobox ──────────────────────────────────────────────────────────
function ServiceCombobox({
  services,
  value,
  onChange,
}: {
  services: ContextResponse["services"];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = services.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-12 text-left font-normal transition-all",
            selected
              ? "border-primary/40 ring-1 ring-primary/20 text-foreground"
              : "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selected ? selected.name : "Selecione um serviço..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Buscar serviço..." className="h-10" />
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            Nenhum serviço encontrado.
          </CommandEmpty>
          <CommandGroup>
            <ScrollArea className="max-h-72">
              {services.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className="py-3 cursor-pointer aria-selected:bg-primary/5"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary",
                      value === s.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-1 items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate leading-tight">
                        {s.name}
                      </div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {s.description}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold">
                        {formatCurrency(s.price)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end mt-0.5">
                        <Clock className="h-3 w-3" />
                        {s.duration_minutes}min
                      </div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </ScrollArea>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Professional Combobox ─────────────────────────────────────────────────────
function ProfessionalCombobox({
  professionals,
  value,
  onChange,
}: {
  professionals: ContextResponse["professionals"];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = professionals.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-12 text-left font-normal transition-all",
            selected
              ? "border-primary/40 ring-1 ring-primary/20 text-foreground"
              : "text-muted-foreground"
          )}
        >
          {selected ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {getInitials(selected.full_name)}
              </div>
              <span className="truncate">
                {selected.full_name || "Profissional"}
              </span>
            </div>
          ) : (
            <span>Selecione o profissional...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Buscar profissional..." className="h-10" />
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            Nenhum profissional encontrado.
          </CommandEmpty>
          <CommandGroup>
            <ScrollArea className="max-h-60">
              {professionals.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.full_name ?? p.id}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className="py-3 cursor-pointer aria-selected:bg-primary/5"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary",
                      value === p.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-sm font-bold">
                      {getInitials(p.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.full_name || "Profissional"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Atendimento especializado
                      </div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </ScrollArea>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({
  num,
  icon: Icon,
  title,
  subtitle,
  done,
}: {
  num: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors",
          done
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-primary/10 text-primary"
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Passo {num}
          </span>
          {done && (
            <Badge variant="outline" className="h-4 text-[10px] px-1.5 border-green-300 text-green-600 dark:border-green-700 dark:text-green-400">
              Selecionado
            </Badge>
          )}
        </div>
        <div className="text-sm font-semibold leading-tight">{title}</div>
        {!done && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ── Hex → HSL (for CSS variable injection) ───────────────────────────────────
function hexToHsl(hex: string): string | null {
  const clean = hex.replace("#", "");
  const res = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(clean);
  if (!res) return null;
  const r = parseInt(res[1], 16) / 255;
  const g = parseInt(res[2], 16) / 255;
  const b = parseInt(res[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AgendarOnline() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const cancelToken   = searchParams.get("cancelToken") || "";
  const primaryParam  = searchParams.get("primary") || "";   // hex without #
  const welcomeParam  = searchParams.get("welcome") || "";
  const logoParam     = searchParams.get("logo") || "";
  const _isEmbed      = searchParams.get("embed") === "1";

  const [isLoading, setIsLoading] = useState(true);
  const [ctx, setCtx] = useState<ContextResponse | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [showDateInput, setShowDateInput] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [slots, setSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Inject custom primary color when widget is embedded with ?primary=HEX
  useEffect(() => {
    if (!primaryParam) return;
    const hsl = hexToHsl(primaryParam);
    if (!hsl) return;
    const id = "bg-embed-theme";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `:root { --primary: ${hsl}; --ring: ${hsl}; }`;
    return () => { document.getElementById(id)?.remove(); };
  }, [primaryParam]);

  const canLoadSlots = useMemo(
    () => Boolean(serviceId && professionalId && date),
    [serviceId, professionalId, date]
  );

  const selectedService = useMemo(
    () => ctx?.services.find((s) => s.id === serviceId) ?? null,
    [ctx?.services, serviceId]
  );

  const selectedProfessional = useMemo(
    () => ctx?.professionals.find((p) => p.id === professionalId) ?? null,
    [ctx?.professionals, professionalId]
  );

  const canProceedStep1 = Boolean(serviceId && professionalId && date && slot);

  // 14-day scrollable date strip
  const dateStrip = useMemo(() => {
    const today = new Date();
    const dayNamesAbbr = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ymd = d.toISOString().split("T")[0];
      const label =
        i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dayNamesAbbr[d.getDay()];
      return {
        ymd,
        label,
        dayNum: d.getDate(),
        monthShort: d
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
      };
    });
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

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
        const { data, error } = await supabase.functions.invoke(
          "public-booking",
          { body: { action: "get_context", slug: s } }
        );
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
        const { data, error } = await supabase.functions.invoke(
          "public-booking",
          { body: { action: "cancel", token: cancelToken, reason: null } }
        );
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
        const { data, error } = await supabase.functions.invoke(
          "public-booking",
          {
            body: {
              action: "get_slots",
              slug: String(slug || "").trim(),
              professional_id: professionalId,
              service_id: serviceId,
              date,
            },
          }
        );
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
      const { data, error } = await supabase.functions.invoke(
        "public-booking",
        {
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
        }
      );
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
    setShowDateInput(false);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
          <div className="flex flex-col items-center gap-3 py-6">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Card>
            <CardContent className="pt-6 space-y-5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (!ctx) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Scissors className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Agendamento indisponível</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Não foi possível carregar este link. Verifique o endereço ou
              entre em contato com o estabelecimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Cancel flow ─────────────────────────────────────────────────────────────
  if (cancelToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            {isCancelling ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Cancelando agendamento...
                </p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold">
                  Cancelamento processado
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Seu agendamento foi cancelado. Você pode fazer um novo
                  agendamento a qualquer momento.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.location.assign(`/agendar/${slug}`)
                  }
                >
                  Fazer novo agendamento
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-28 pt-8 md:pb-10 md:pt-10">

        {/* Branding */}
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10 overflow-hidden">
            {logoParam ? (
              <img src={logoParam} alt={ctx.tenant.name} className="h-full w-full object-contain p-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <Scissors className="h-8 w-8" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {ctx.tenant.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {welcomeParam || "Agende em segundos. Sem WhatsApp, sem espera."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              Confirmação imediata
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Horários em tempo real
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[
            { n: 1, label: "Agendamento" },
            { n: 2, label: "Seus dados" },
            { n: 3, label: "Confirmação" },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    step === n
                      ? "gradient-primary text-primary-foreground shadow-sm"
                      : step > n
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > n ? <Check className="h-4 w-4" /> : n}
                </div>
                <span
                  className={cn(
                    "hidden sm:block text-xs transition-colors",
                    step === n
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  className={cn(
                    "mb-4 h-px w-10 sm:w-16 transition-colors",
                    step > n ? "bg-green-400" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">

          {/* ── Main card ── */}
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="pt-6">

              {/* ══ Step 1 ══════════════════════════════════════════════════ */}
              {step === 1 && (
                <div className="space-y-8">

                  {/* Section 1: Serviço */}
                  <div className="space-y-3">
                    <SectionHeader
                      num={1}
                      icon={Sparkles}
                      title="Qual serviço você deseja?"
                      subtitle="Escolha o procedimento"
                      done={!!serviceId}
                    />
                    <ServiceCombobox
                      services={ctx.services}
                      value={serviceId}
                      onChange={(v) => {
                        setServiceId(v);
                        setSlot("");
                      }}
                    />
                    {selectedService && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">
                              {selectedService.name}
                            </div>
                            {selectedService.description && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {selectedService.description}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <Badge className="gradient-primary text-primary-foreground border-0 text-xs">
                              {formatCurrency(selectedService.price)}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {selectedService.duration_minutes} minutos
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Section 2: Profissional */}
                  <div className="space-y-3">
                    <SectionHeader
                      num={2}
                      icon={User}
                      title="Com qual profissional?"
                      subtitle="Escolha quem vai te atender"
                      done={!!professionalId}
                    />
                    <ProfessionalCombobox
                      professionals={ctx.professionals}
                      value={professionalId}
                      onChange={(v) => {
                        setProfessionalId(v);
                        setSlot("");
                      }}
                    />
                    {selectedProfessional && (
                      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-sm ring-1 ring-primary/20">
                          {getInitials(selectedProfessional.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {selectedProfessional.full_name || "Profissional"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Atendimento especializado
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Section 3: Data */}
                  <div className="space-y-3">
                    <SectionHeader
                      num={3}
                      icon={CalendarDays}
                      title="Quando você quer vir?"
                      subtitle="Escolha a data"
                      done={!!date}
                    />

                    {/* 14-day strip */}
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {dateStrip.map((d) => {
                        const isSelected = date === d.ymd;
                        return (
                          <button
                            key={d.ymd}
                            type="button"
                            onClick={() => {
                              setDate(d.ymd);
                              setSlot("");
                              setShowDateInput(false);
                            }}
                            className={cn(
                              "flex shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isSelected
                                ? "gradient-primary text-primary-foreground border-transparent shadow-md"
                                : "border-border/70 bg-background hover:bg-muted/50 hover:border-border text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "text-[10px] font-medium uppercase tracking-wide leading-none mb-1",
                                isSelected
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {d.label}
                            </span>
                            <span className="text-xl font-bold leading-none">
                              {d.dayNum}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] mt-1 leading-none",
                                isSelected
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {d.monthShort}
                            </span>
                          </button>
                        );
                      })}
                      {/* Outro dia button */}
                      <button
                        type="button"
                        onClick={() => setShowDateInput((v) => !v)}
                        className={cn(
                          "flex shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2.5 gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          showDateInput
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : "border-dashed border-border/70 bg-background hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <Calendar className="h-4 w-4" />
                        <span className="text-[10px] font-medium whitespace-nowrap">
                          Outro dia
                        </span>
                      </button>
                    </div>

                    {showDateInput && (
                      <Input
                        type="date"
                        min={todayStr}
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setSlot("");
                        }}
                        className="h-11"
                      />
                    )}

                    {date && (
                      <p className="text-xs text-muted-foreground pl-1">
                        Data selecionada:{" "}
                        <span className="font-medium text-foreground">
                          {new Date(date + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                            { weekday: "long", day: "numeric", month: "long" }
                          )}
                        </span>
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Section 4: Horário */}
                  <div className="space-y-3">
                    <SectionHeader
                      num={4}
                      icon={Clock}
                      title="Escolha um horário"
                      subtitle="Horários disponíveis para a data selecionada"
                      done={!!slot}
                    />

                    {!canLoadSlots ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-8 text-center">
                        <Clock className="h-7 w-7 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Selecione serviço, profissional e data para ver os
                          horários disponíveis.
                        </p>
                      </div>
                    ) : isLoadingSlots ? (
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-8 text-center">
                        <CalendarDays className="h-7 w-7 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum horário disponível nesta data.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tente outro dia ou profissional.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-52">
                        <div className="grid grid-cols-4 gap-2 pr-2">
                          {slots.map((s) => {
                            const isSelected = slot === s;
                            const label = new Date(s).toLocaleTimeString(
                              "pt-BR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "America/Sao_Paulo",
                              }
                            );
                            return (
                              <Button
                                key={s}
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className={cn(
                                  "h-10 text-sm font-medium transition-all",
                                  isSelected
                                    ? "gradient-primary text-primary-foreground shadow-sm border-transparent"
                                    : "border-border/70 hover:border-primary/40 hover:bg-primary/5"
                                )}
                                onClick={() => setSlot(s)}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}

                    {slot && (
                      <p className="text-xs text-muted-foreground pl-1">
                        Horário selecionado:{" "}
                        <span className="font-medium text-foreground">
                          {slotLabel}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Next button (desktop) */}
                  <div className="hidden md:flex justify-end pt-2">
                    <Button
                      className="gradient-primary text-primary-foreground px-8"
                      disabled={!canProceedStep1}
                      onClick={() => setStep(2)}
                    >
                      Continuar
                      <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ══ Step 2 ══════════════════════════════════════════════════ */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <div className="text-base font-semibold">Seus dados</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Precisamos das suas informações para confirmar o
                      agendamento.
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Nome completo{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Seu nome"
                        className="h-11"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone / WhatsApp</Label>
                      <Input
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="h-11"
                        inputMode="tel"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enviaremos a confirmação e o link de cancelamento.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Alguma preferência ou informação que devemos saber?"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="gap-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar
                    </Button>
                    <Button
                      className="gradient-primary text-primary-foreground px-8"
                      disabled={isSubmitting || !clientName.trim()}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirmando...
                        </>
                      ) : (
                        <>
                          Confirmar agendamento
                          <ChevronRight className="ml-1.5 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ══ Step 3 (Confirmação) ═════════════════════════════════════ */}
              {step === 3 && (
                <div className="flex flex-col items-center gap-5 py-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 ring-4 ring-green-100 dark:ring-green-900/20">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      Agendamento confirmado!
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                      Seu horário está reservado com{" "}
                      <span className="font-medium text-foreground">
                        {ctx.tenant.name}
                      </span>
                      .{" "}
                      {clientEmail
                        ? "Confira seu e-mail para mais detalhes."
                        : ""}
                    </p>
                  </div>

                  <div className="w-full max-w-sm rounded-xl border bg-muted/30 p-4 text-sm space-y-3 text-left">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Serviço
                        </div>
                        <div className="font-medium">
                          {selectedService?.name}
                        </div>
                        {selectedService && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(selectedService.price)} ·{" "}
                            {selectedService.duration_minutes}min
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Profissional
                        </div>
                        <div className="font-medium">
                          {selectedProfessional?.full_name || "—"}
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Data e horário
                        </div>
                        <div className="font-medium">
                          {date &&
                            new Date(
                              date + "T12:00:00"
                            ).toLocaleDateString("pt-BR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}{" "}
                          às {slotLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="mt-2 gap-2"
                  >
                    <Scissors className="h-4 w-4" />
                    Fazer outro agendamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Sticky summary (desktop) ── */}
          <div className="hidden md:block">
            <div className="sticky top-6">
              <Card className="overflow-hidden shadow-sm">
                <CardContent className="pt-6 space-y-5">
                  <div>
                    <div className="text-sm font-semibold">Resumo</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Revise antes de confirmar
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    {/* Service summary */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          Serviço
                        </div>
                        {selectedService ? (
                          <>
                            <div className="font-medium text-sm truncate">
                              {selectedService.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(selectedService.price)} ·{" "}
                              {selectedService.duration_minutes}min
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Não selecionado
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Professional summary */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          Profissional
                        </div>
                        {selectedProfessional ? (
                          <div className="font-medium text-sm truncate">
                            {selectedProfessional.full_name || "Profissional"}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Não selecionado
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Date summary */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          Data
                        </div>
                        {date ? (
                          <div className="font-medium text-sm">
                            {new Date(
                              date + "T12:00:00"
                            ).toLocaleDateString("pt-BR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Não selecionada
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Time summary */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          Horário
                        </div>
                        {slotLabel ? (
                          <div className="font-medium text-sm">{slotLabel}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Não selecionado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {canProceedStep1 && step === 1 && (
                    <>
                      <Separator />
                      <Button
                        className="gradient-primary text-primary-foreground w-full"
                        onClick={() => setStep(2)}
                      >
                        Continuar
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </>
                  )}

                  <Separator />
                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                    Ao confirmar, o horário fica reservado. Cancelamentos
                    conforme a política do estabelecimento.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky action bar ─────────────────────────────────────────── */}
      {(step === 1 || step === 2) && (
        <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
          <div className="mx-auto w-full max-w-5xl px-4 pb-safe-area-inset-bottom pb-4">
            <div className="rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/85">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {selectedService?.name || (
                      <span className="text-muted-foreground">
                        Selecione o serviço
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      selectedProfessional?.full_name,
                      date
                        ? new Date(
                            date + "T12:00:00"
                          ).toLocaleDateString("pt-BR", {
                            day: "numeric",
                            month: "short",
                          })
                        : null,
                      slotLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Preencha as informações acima"}
                  </div>
                </div>

                {step === 1 ? (
                  <Button
                    className="gradient-primary text-primary-foreground shrink-0"
                    disabled={!canProceedStep1}
                    onClick={() => setStep(2)}
                  >
                    Continuar
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="gradient-primary text-primary-foreground"
                      disabled={isSubmitting || !clientName.trim()}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
