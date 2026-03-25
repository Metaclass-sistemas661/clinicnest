import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Clock,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  CalendarPlus,
  User,
  MapPin,
  CreditCard,
  Timer,
  Star,
  Search,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SlotPicker } from "@/components/patient/SlotPicker";
import { ProfessionalList } from "@/components/patient/ProfessionalCard";
import { DependentSelector } from "@/components/patient/DependentSelector";
import { useDependents, DependentsProvider, Dependent } from "@/hooks/useDependents";

interface ProcedureOption {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string | null;
}

interface Professional {
  id: string;
  full_name: string;
  avatar_url: string | null;
  professional_type: string;
  council_type: string | null;
  council_number: string | null;
  council_state: string | null;
  avg_rating: number;
}

interface Slot {
  slot_date: string;
  slot_time: string;
  slot_datetime: string;
}

interface BookingSettings {
  enabled: boolean;
  min_hours_advance: number;
  max_days_advance: number;
  max_pending: number;
  clinic_name: string;
  reason?: string;
}

type Step = "service" | "professional" | "datetime" | "confirm";

function PatientAgendarInner() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("service");
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Dependents
  const { dependents, isLoading: isLoadingDependents } = useDependents();
  const [selectedDependent, setSelectedDependent] = useState<Dependent | null>(null);
  const [userName, setUserName] = useState("Eu mesmo");

  // Data
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Loading states
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selections
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureOption | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Search/filter for services
  const [serviceSearch, setServiceSearch] = useState("");

  // Load user name
  useEffect(() => {
    supabasePatient.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.full_name?.split(" ")[0] || "Eu mesmo");
    });
  }, []);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await (supabasePatient as any).rpc("get_patient_booking_settings");
        if (error) throw error;
        setSettings(data as BookingSettings);
      } catch (err) {
        logger.error("Error loading booking settings:", err);
        setSettings({ enabled: false, reason: "error" } as BookingSettings);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    void loadSettings();
  }, []);

  // Load procedures
  useEffect(() => {
    if (!settings?.enabled) return;

    const loadServices = async () => {
      setIsLoadingServices(true);
      try {
        const { data, error } = await (supabasePatient as any).rpc("get_patient_bookable_services");
        if (error) throw error;
        setProcedures((data as ProcedureOption[]) || []);
      } catch (err) {
        logger.error("Error loading procedures:", err);
        toast.error("Erro ao carregar procedimentos");
      } finally {
        setIsLoadingServices(false);
      }
    };
    void loadServices();
  }, [settings?.enabled]);

  // Load professionals when procedure is selected
  useEffect(() => {
    if (!selectedProcedure) {
      setProfessionals([]);
      return;
    }

    const loadProfessionals = async () => {
      setIsLoadingProfessionals(true);
      try {
        const { data, error } = await (supabasePatient as any).rpc(
          "get_patient_bookable_professionals",
          { p_service_id: selectedProcedure.id }
        );
        if (error) throw error;
        setProfessionals((data as Professional[]) || []);
      } catch (err) {
        logger.error("Error loading professionals:", err);
        toast.error("Erro ao carregar profissionais");
      } finally {
        setIsLoadingProfessionals(false);
      }
    };
    void loadProfessionals();
  }, [selectedProcedure]);

  // Load slots
  const loadSlots = useCallback(
    async (startDate: Date, endDate: Date) => {
      if (!selectedProcedure || !selectedProfessional) return;

      setIsLoadingSlots(true);
      try {
        const { data, error } = await (supabasePatient as any).rpc(
          "get_available_slots_for_patient",
          {
            p_service_id: selectedProcedure.id,
            p_professional_id: selectedProfessional.id,
            p_date_from: format(startDate, "yyyy-MM-dd"),
            p_date_to: format(endDate, "yyyy-MM-dd"),
          }
        );
        if (error) throw error;
        setSlots((data as Slot[]) || []);
      } catch (err) {
        logger.error("Error loading slots:", err);
        toast.error("Erro ao carregar horários");
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [selectedProcedure, selectedProfessional]
  );

  // Handle procedure selection
  const handleSelectProcedure = (proc: ProcedureOption) => {
    setSelectedProcedure(proc);
    setSelectedProfessional(null);
    setSelectedSlot(null);
    setCurrentStep("professional");
  };

  // Handle professional selection
  const handleSelectProfessional = (professional: Professional) => {
    setSelectedProfessional(professional);
    setSelectedSlot(null);
    setCurrentStep("datetime");
  };

  // Handle slot selection
  const handleSelectSlot = (slot: Slot) => {
    setSelectedSlot(slot);
    setCurrentStep("confirm");
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedProcedure || !selectedProfessional || !selectedSlot) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("patient_create_appointment", {
        p_procedure_id: selectedProcedure.id,
        p_professional_id: selectedProfessional.id,
        p_scheduled_at: selectedSlot.slot_datetime,
        p_for_dependent_id: selectedDependent?.dependent_id || null,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string };
      if (result?.success) {
        toast.success(result.message || "Agendamento realizado com sucesso!");
        navigate("/paciente/consultas");
      }
    } catch (err: any) {
      logger.error("Error creating appointment:", err);
      toast.error(err?.message || "Erro ao criar agendamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back
  const goBack = () => {
    if (currentStep === "professional") {
      setCurrentStep("service");
      setSelectedProcedure(null);
    } else if (currentStep === "datetime") {
      setCurrentStep("professional");
      setSelectedProfessional(null);
    } else if (currentStep === "confirm") {
      setCurrentStep("datetime");
      setSelectedSlot(null);
    }
  };

  // Loading state
  if (isLoadingSettings) {
    return (
      <PatientLayout title="Agendar Consulta" subtitle="Carregando...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PatientLayout>
    );
  }

  // Not enabled
  if (!settings?.enabled) {
    return (
      <PatientLayout title="Agendar Consulta" subtitle="Agendamento online">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="font-semibold text-lg mb-2">Agendamento Online Indisponível</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {settings?.reason === "not_linked"
                ? "Seu cadastro ainda não está vinculado a uma clínica. Entre em contato com a clínica para vincular seu acesso."
                : "O agendamento online não está habilitado para esta clínica. Entre em contato diretamente para agendar sua consulta."}
            </p>
          </CardContent>
        </Card>
      </PatientLayout>
    );
  }

  // Steps config
  const steps = [
    { key: "service" as const, label: "Procedimento", icon: Stethoscope },
    { key: "professional" as const, label: "Profissional", icon: User },
    { key: "datetime" as const, label: "Data/Hora", icon: Calendar },
    { key: "confirm" as const, label: "Confirmar", icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const filteredProcedures = procedures.filter(
    (p) =>
      p.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      p.category?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      p.description?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  // Group procedures by category
  const groupedProcedures = filteredProcedures.reduce<Record<string, ProcedureOption[]>>(
    (acc, proc) => {
      const cat = proc.category || "Geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(proc);
      return acc;
    },
    {}
  );

  return (
    <PatientLayout
      title="Agendar Consulta"
      subtitle={settings.clinic_name ? `em ${settings.clinic_name}` : "Agendamento online"}
    >
      {/* Dependent selector */}
      {dependents.length > 0 && (
        <div className="mb-5">
          <DependentSelector
            dependents={dependents}
            selectedDependent={selectedDependent}
            onSelect={setSelectedDependent}
            userName={userName}
            disabled={currentStep === "confirm"}
          />
        </div>
      )}

      {/* ── Steps indicator ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between relative">
          {/* Progress bar background */}
          <div className="absolute top-5 left-0 right-0 h-[3px] bg-muted mx-12 rounded-full" />
          {/* Progress bar fill */}
          <div
            className="absolute top-5 left-0 h-[3px] bg-teal-500 mx-12 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStepIndex / (steps.length - 1)) * (100 - 16)}%` }}
          />

          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.key === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div
                key={step.key}
                className="flex flex-col items-center relative z-10 flex-1"
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-full text-sm font-semibold transition-all duration-300 border-2",
                    isActive
                      ? "bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-600/30 scale-110"
                      : isCompleted
                      ? "bg-teal-500 text-white border-teal-500"
                      : "bg-background text-muted-foreground border-muted"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] mt-2 font-medium text-center transition-colors",
                    isActive
                      ? "text-teal-700 dark:text-teal-400"
                      : isCompleted
                      ? "text-teal-600 dark:text-teal-500"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {currentStep !== "service" && (
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              className="h-9 gap-1.5 rounded-full px-4 border-teal-200 hover:bg-teal-50 dark:border-teal-800 dark:hover:bg-teal-950/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {currentStep === "service" && "Escolha o Procedimento"}
              {currentStep === "professional" && "Escolha o Profissional"}
              {currentStep === "datetime" && "Escolha Data e Horário"}
              {currentStep === "confirm" && "Confirme seu Agendamento"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentStep === "service" && `Etapa ${currentStepIndex + 1} de ${steps.length} — Selecione o procedimento desejado`}
              {currentStep === "professional" && `Etapa ${currentStepIndex + 1} de ${steps.length} — Escolha o profissional de sua preferência`}
              {currentStep === "datetime" && `Etapa ${currentStepIndex + 1} de ${steps.length} — Selecione o melhor horário para você`}
              {currentStep === "confirm" && `Etapa ${currentStepIndex + 1} de ${steps.length} — Revise os dados e confirme`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Service selection ── */}
      {currentStep === "service" && (
        <div className="space-y-4">
          {/* Search */}
          {procedures.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar procedimento..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
              />
            </div>
          )}

          {isLoadingServices ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex gap-3 p-4">
                      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : procedures.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Nenhum procedimento disponível"
              description="Não há procedimentos disponíveis para agendamento online no momento."
            />
          ) : filteredProcedures.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum resultado para "{serviceSearch}"</p>
              <p className="text-xs mt-1">Tente buscar por outro termo</p>
            </div>
          ) : (
            Object.entries(groupedProcedures).map(([category, procs]) => (
              <div key={category}>
                {Object.keys(groupedProcedures).length > 1 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    <h3 className="text-sm font-semibold text-foreground/80">{category}</h3>
                    <Badge variant="secondary" className="text-[10px] h-5">{procs.length}</Badge>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {procs.map((procedure) => (
                    <Card
                      key={procedure.id}
                      className="group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/10 hover:border-teal-300 dark:hover:border-teal-700 border-l-4 border-l-teal-500/30 hover:border-l-teal-500"
                      onClick={() => handleSelectProcedure(procedure)}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 p-4">
                          <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/50 dark:to-teal-900/50 flex items-center justify-center group-hover:from-teal-100 group-hover:to-teal-200 dark:group-hover:from-teal-900/50 dark:group-hover:to-teal-800/50 transition-colors">
                            <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                              {procedure.name}
                            </h4>
                            {procedure.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {procedure.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2.5 mt-1.5">
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Timer className="h-3 w-3" />
                                {procedure.duration_minutes}min
                              </span>
                              <span className="font-bold text-xs text-teal-600 dark:text-teal-400">
                                R$ {procedure.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Step 2: Professional selection ── */}
      {currentStep === "professional" && (
        <div className="space-y-4">
          {/* Selected procedure pill */}
          {selectedProcedure && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60">
              <div className="h-9 w-9 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70 font-semibold">
                  Procedimento
                </p>
                <p className="text-sm font-medium truncate">{selectedProcedure.name}</p>
              </div>
              <div className="ml-auto text-right flex-shrink-0">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  R$ {selectedProcedure.price.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <ProfessionalList
            professionals={professionals}
            selectedId={selectedProfessional?.id || null}
            onSelect={handleSelectProfessional}
            isLoading={isLoadingProfessionals}
          />
        </div>
      )}

      {/* ── Step 3: DateTime selection ── */}
      {currentStep === "datetime" && (
        <div className="space-y-4">
          {/* Selected summary pills */}
          {selectedProcedure && selectedProfessional && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60">
                <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70 font-semibold">Procedimento</p>
                  <p className="text-xs font-medium truncate">{selectedProcedure.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/60">
                <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70 font-semibold">Profissional</p>
                  <p className="text-xs font-medium truncate">{selectedProfessional.full_name}</p>
                </div>
              </div>
            </div>
          )}

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <SlotPicker
                slots={slots}
                isLoading={isLoadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSelectSlot}
                onWeekChange={loadSlots}
                minDate={new Date()}
                maxDate={addDays(new Date(), settings.max_days_advance)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {currentStep === "confirm" && selectedProcedure && selectedProfessional && selectedSlot && (
        <div className="space-y-5">
          {/* Summary card */}
          <Card className="overflow-hidden border-teal-200 dark:border-teal-800">
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-4">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-bold text-base">Resumo do Agendamento</h3>
              </div>
              <p className="text-teal-100 text-xs mt-1">Revise os dados abaixo antes de confirmar</p>
            </div>

            <CardContent className="p-0 divide-y divide-border">
              {selectedDependent && (
                <div className="flex items-center gap-3 px-5 py-3.5 bg-teal-50/40 dark:bg-teal-950/20">
                  <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                    <User className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Paciente</p>
                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 truncate">
                      {selectedDependent.dependent_name}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-9 w-9 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                  <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Procedimento</p>
                  <p className="text-sm font-semibold truncate">{selectedProcedure.name}</p>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {selectedProcedure.duration_minutes}min
                </span>
              </div>

              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-9 w-9 rounded-full bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center">
                  <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Profissional</p>
                  <p className="text-sm font-semibold truncate">{selectedProfessional.full_name}</p>
                </div>
                {selectedProfessional.avg_rating > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 flex-shrink-0">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {selectedProfessional.avg_rating.toFixed(1)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-9 w-9 rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data e Horário</p>
                  <p className="text-sm font-semibold capitalize">
                    {format(new Date(selectedSlot.slot_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-900 dark:text-teal-200 text-sm font-bold flex-shrink-0">
                  {selectedSlot.slot_time.slice(0, 5)}
                </Badge>
              </div>

              <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/30">
                <div className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor</p>
                  <p className="text-lg font-bold text-teal-600 dark:text-teal-400">
                    R$ {selectedProcedure.price.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info banner */}
          <div className="flex gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60">
            <ShieldCheck className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Status Pendente</p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                Após confirmar, seu agendamento ficará pendente até a confirmação da clínica. Você receberá uma notificação quando for confirmado.
              </p>
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 shadow-lg shadow-teal-600/20 h-12 text-base font-semibold rounded-xl"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <CalendarPlus className="mr-2 h-5 w-5" />
                Confirmar Agendamento
              </>
            )}
          </Button>
        </div>
      )}
    </PatientLayout>
  );
}

export default function PatientAgendar() {
  return (
    <DependentsProvider>
      <PatientAgendarInner />
    </DependentsProvider>
  );
}