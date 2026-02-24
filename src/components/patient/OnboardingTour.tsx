import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  FileText,
  MessageCircle,
  Heart,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const tourSteps = [
  {
    title: "Bem-vindo ao Portal do Paciente!",
    description:
      "Aqui você tem acesso completo às suas informações de saúde. Vamos fazer um tour rápido pelas principais funcionalidades.",
    icon: Sparkles,
    color: "text-teal-600 bg-teal-100",
  },
  {
    title: "Agende suas Consultas",
    description:
      "Você pode agendar consultas diretamente pelo portal, escolhendo o profissional, data e horário que preferir.",
    icon: Calendar,
    color: "text-blue-600 bg-blue-100",
  },
  {
    title: "Acompanhe sua Saúde",
    description:
      "Veja seu histórico de consultas, exames, receitas e acompanhe a evolução dos seus sinais vitais ao longo do tempo.",
    icon: Heart,
    color: "text-red-600 bg-red-100",
  },
  {
    title: "Documentos Sempre à Mão",
    description:
      "Acesse e baixe suas receitas, atestados e resultados de exames a qualquer momento, direto do seu celular.",
    icon: FileText,
    color: "text-emerald-600 bg-emerald-100",
  },
  {
    title: "Converse com a Clínica",
    description:
      "Use o chat para tirar dúvidas, solicitar informações ou enviar mensagens para a clínica.",
    icon: MessageCircle,
    color: "text-violet-600 bg-violet-100",
  },
  {
    title: "Área Financeira",
    description:
      "Visualize suas faturas, acompanhe pagamentos e pague diretamente pelo portal quando disponível.",
    icon: CreditCard,
    color: "text-amber-600 bg-amber-100",
  },
];

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await (supabasePatient as any).rpc("update_patient_onboarding", {
        p_tour_completed: true,
      });
    } catch (err) {
      logger.error("Error completing onboarding:", err);
    }
    setIsOpen(false);
    onComplete();
  };

  const handleSkip = async () => {
    try {
      await (supabasePatient as any).rpc("update_patient_onboarding", {
        p_tour_skipped: true,
      });
    } catch (err) {
      logger.error("Error skipping onboarding:", err);
    }
    setIsOpen(false);
    onSkip();
  };

  const step = tourSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full",
                step.color
              )}
            >
              <Icon className="h-8 w-8" />
            </div>
          </div>
          <DialogTitle className="text-center">{step.title}</DialogTitle>
          <DialogDescription className="text-center">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {tourSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                index === currentStep
                  ? "bg-teal-600 w-6"
                  : index < currentStep
                  ? "bg-teal-300"
                  : "bg-muted"
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Pular tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isLastStep ? (
                "Começar"
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useOnboardingTour() {
  const [showTour, setShowTour] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data, error } = await (supabasePatient as any).rpc(
          "get_patient_onboarding_status"
        );
        if (error) throw error;
        setShowTour(data?.show_tour === true);
      } catch (err) {
        logger.error("Error checking onboarding:", err);
      } finally {
        setIsLoading(false);
      }
    };
    void checkOnboarding();
  }, []);

  const completeTour = useCallback(() => setShowTour(false), []);
  const skipTour = useCallback(() => setShowTour(false), []);

  return { showTour, isLoading, completeTour, skipTour };
}
