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
        toast.error("Erro ao carregar serviços");
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
        p_service_id: selectedProcedure.id,
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

  // Steps indicator
  const steps = [
    { key: "service", label: "Serviço", icon: Stethoscope },
    { key: "professional", label: "Profissional", icon: Stethoscope },
    { key: "datetime", label: "Data/Hora", icon: Calendar },
    { key: "confirm", label: "Confirmar", icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <PatientLayout
      title="Agendar Consulta"
      subtitle={settings.clinic_name ? `em ${settings.clinic_name}` : "Agendamento online"}
    >
      {/* Dependent selector */}
      {dependents.length > 0 && (
        <div className="mb-4">
          <DependentSelector
            dependents={dependents}
            selectedDependent={selectedDependent}
            onSelect={setSelectedDependent}
            userName={userName}
            disabled={currentStep === "confirm"}
          />
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isCompleted = index < currentStepIndex;

          return (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium transition-colors",
                  isActive
                    ? "bg-teal-600 text-white"
                    : isCompleted
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-1",
                    index < currentStepIndex ? "bg-teal-600" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {currentStep === "service" && "Selecione o Serviço"}
              {currentStep === "professional" && "Selecione o Profissional"}
              {currentStep === "datetime" && "Escolha Data e Horário"}
              {currentStep === "confirm" && "Confirme seu Agendamento"}
            </CardTitle>
            {currentStep !== "service" && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Service */}
          {currentStep === "service" && (
            <div className="space-y-3">
              {isLoadingServices ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : procedures.length === 0 ? (
                <EmptyState
                  icon={Stethoscope}
                  title="Nenhum serviço disponível"
                  description="Não há serviços disponíveis para agendamento online no momento."
                />
              ) : (
                procedures.map((procedure) => (
                  <Card
                    key={procedure.id}
                    className="cursor-pointer hover:shadow-md hover:border-teal-200 transition-all"
                    onClick={() => handleSelectProcedure(procedure)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{procedure.name}</h3>
                          {procedure.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {procedure.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {procedure.duration_minutes} min
                            </span>
                            {procedure.category && (
                              <Badge variant="secondary" className="text-[10px]">
                                {procedure.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-teal-600">
                            R$ {procedure.price.toFixed(2)}
                          </span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground mt-2 ml-auto" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Step 2: Professional */}
          {currentStep === "professional" && (
            <div>
              {selectedProcedure && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Serviço selecionado:</p>
                  <p className="font-medium">{selectedProcedure.name}</p>
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

          {/* Step 3: DateTime */}
          {currentStep === "datetime" && (
            <div>
              {selectedProcedure && selectedProfessional && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span className="font-medium">{selectedProcedure.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profissional:</span>
                    <span className="font-medium">{selectedProfessional.full_name}</span>
                  </div>
                </div>
              )}
              <SlotPicker
                slots={slots}
                isLoading={isLoadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSelectSlot}
                onWeekChange={loadSlots}
                minDate={new Date()}
                maxDate={addDays(new Date(), settings.max_days_advance)}
              />
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === "confirm" && selectedProcedure && selectedProfessional && selectedSlot && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                <h3 className="font-semibold text-teal-800 dark:text-teal-200 mb-3">
                  Resumo do Agendamento
                </h3>
                <div className="space-y-2 text-sm">
                  {selectedDependent && (
                    <div className="flex justify-between pb-2 border-b border-teal-200 dark:border-teal-700">
                      <span className="text-muted-foreground">Paciente:</span>
                      <span className="font-medium text-teal-700 dark:text-teal-300">
                        {selectedDependent.dependent_name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span className="font-medium">{selectedProcedure.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional:</span>
                    <span className="font-medium">{selectedProfessional.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium capitalize">
                      {format(new Date(selectedSlot.slot_date), "EEEE, dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="font-medium">{selectedSlot.slot_time.slice(0, 5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duração:</span>
                    <span className="font-medium">{selectedProcedure.duration_minutes} minutos</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-semibold text-teal-600">
                      R$ {selectedProcedure.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Após confirmar, seu agendamento ficará com status
                  "Pendente" até a confirmação da clínica. Você receberá uma notificação quando for
                  confirmado.
                </p>
              </div>

              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
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