import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

type TourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  adminOnly?: boolean;
  staffOnly?: boolean;
};

type TourKey = "vynlobella_core";

const TOUR_KEY: TourKey = "vynlobella_core";

const STEPS: TourStep[] = [
  {
    id: "nav-dashboard",
    route: "/dashboard",
    target: "sidebar-dashboard",
    title: "Seu painel principal",
    description: "Aqui você acompanha o resumo do dia/mês e acessa os módulos mais usados.",
    placement: "right",
  },
  {
    id: "nav-agenda",
    route: "/dashboard",
    target: "sidebar-agenda",
    title: "Agenda (o coração do salão)",
    description: "Agende horários e finalize atendimentos para alimentar o financeiro e relatórios.",
    placement: "right",
  },
  {
    id: "agenda-new",
    route: "/agenda",
    target: "agenda-new-appointment",
    title: "Criar um agendamento",
    description: "Use este botão para criar novos atendimentos com cliente, serviço e profissional.",
    placement: "bottom",
  },
  {
    id: "nav-clientes",
    route: "/agenda",
    target: "sidebar-clientes",
    title: "Clientes",
    description: "Mantenha histórico, observações e dados de contato centralizados.",
    placement: "right",
  },
  {
    id: "nav-servicos",
    route: "/agenda",
    target: "sidebar-servicos",
    title: "Serviços",
    description: "Catálogo com preços e duração — ajuda a padronizar e acelerar o agendamento.",
    placement: "right",
  },
  {
    id: "nav-produtos",
    route: "/agenda",
    target: "sidebar-produtos",
    title: "Produtos & estoque",
    description: "Controle quantidade e evite falta de itens. Perdas ficam mais rastreáveis.",
    placement: "right",
  },
  {
    id: "nav-financeiro",
    route: "/agenda",
    target: "sidebar-financeiro",
    title: "Financeiro",
    description: "Visualize caixa, comissões e relatórios. Admin tem visão completa.",
    placement: "right",
    adminOnly: true,
  },
  {
    id: "nav-minhas-comissoes",
    route: "/agenda",
    target: "sidebar-minhas-comissoes",
    title: "Minhas comissões",
    description: "Como profissional, você acompanha o que tem a receber.",
    placement: "right",
    staffOnly: true,
  },
  {
    id: "nav-ajuda",
    route: "/agenda",
    target: "sidebar-ajuda",
    title: "Ajuda & documentação",
    description: "Guia oficial do VynloBella com busca e atalhos. Você pode reiniciar o tutorial por lá.",
    placement: "right",
  },
  {
    id: "nav-suporte",
    route: "/ajuda",
    target: "sidebar-suporte",
    title: "Suporte",
    description: "Abra tickets e acompanhe a conversa. Pro/Premium: WhatsApp; Básico: e-mail.",
    placement: "right",
  },
  {
    id: "support-new-ticket",
    route: "/suporte",
    target: "support-new-ticket",
    title: "Abrir um ticket",
    description: "Quanto mais detalhes, mais rápido a equipe resolve. Tickets ficam salvos por tenant.",
    placement: "bottom",
  },
];

type TourContextType = {
  isOpen: boolean;
  start: () => void;
  stop: () => void;
  reset: () => Promise<void>;
};

const TourContext = createContext<TourContextType | undefined>(undefined);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildTargetSelector(target: string) {
  return `[data-tour="${target}"], [data-tour='${target}'], [data-tour=${target}]`;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tenantId = profile?.tenant_id ?? null;

  const steps = useMemo(() => {
    return STEPS.filter((s) => {
      if (s.adminOnly && !isAdmin) return false;
      if (s.staffOnly && isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const retryTimer = useRef<number | null>(null);

  const persistProgress = useCallback(
    async (idx: number, completed: boolean) => {
      if (!tenantId || !user?.id) return;
      try {
        await supabase.rpc("upsert_user_tour_progress", {
          p_tenant_id: tenantId,
          p_tour_key: TOUR_KEY,
          p_step_index: idx,
          p_completed: completed,
        });
      } catch {
        // ignore
      }
    },
    [tenantId, user?.id]
  );

  const loadProgress = useCallback(async () => {
    if (!tenantId || !user?.id) return;
    try {
      const { data, error } = await supabase
        .from("user_tour_progress")
        .select("step_index, completed_at")
        .eq("user_id", user.id)
        .eq("tour_key", TOUR_KEY)
        .maybeSingle();

      if (error) return;

      const row = data as null | { step_index: number | null; completed_at: string | null };

      const completed = Boolean(row?.completed_at);
      
      if (completed) return;

      const idx = Number(row?.step_index ?? 0);
      if (Number.isFinite(idx) && idx >= 0) {
        setStepIndex(idx);
      }
    } catch {
      // ignore
    }
  }, [tenantId, user?.id]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const stop = useCallback(() => {
    setIsOpen(false);
    setTargetRect(null);
    setTargetMissing(false);
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const reset = useCallback(async () => {
    try {
      await supabase.rpc("reset_user_tour_progress", { p_tour_key: TOUR_KEY });
    } catch {
      // ignore
    }
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const goTo = useCallback(
    async (idx: number) => {
      const nextIdx = clamp(idx, 0, steps.length - 1);
      setStepIndex(nextIdx);
      setTargetRect(null);
      setTargetMissing(false);
      await persistProgress(nextIdx, false);

      const step = steps[nextIdx];
      if (!step) return;
      if (location.pathname !== step.route) {
        navigate(step.route);
      }
    },
    [location.pathname, navigate, persistProgress, steps]
  );

  const next = useCallback(async () => {
    if (stepIndex >= steps.length - 1) {
      await persistProgress(stepIndex, true);
      stop();
      return;
    }
    await goTo(stepIndex + 1);
  }, [goTo, persistProgress, stepIndex, steps.length, stop]);

  const prev = useCallback(async () => {
    await goTo(stepIndex - 1);
  }, [goTo, stepIndex]);

  const currentStep = steps[stepIndex] ?? null;

  const computeTarget = useCallback(() => {
    if (!isOpen || !currentStep) return;

    const selector = buildTargetSelector(currentStep.target);
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      setTargetMissing(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setTargetMissing(false);
  }, [currentStep, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (retryTimer.current) {
      window.clearInterval(retryTimer.current);
      retryTimer.current = null;
    }

    let tries = 0;
    retryTimer.current = window.setInterval(() => {
      tries += 1;
      computeTarget();
      if (tries >= 20) {
        if (retryTimer.current) window.clearInterval(retryTimer.current);
        retryTimer.current = null;
      }
    }, 150);

    return () => {
      if (retryTimer.current) window.clearInterval(retryTimer.current);
      retryTimer.current = null;
    };
  }, [computeTarget, currentStep?.id, isOpen, location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => computeTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [computeTarget, isOpen]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect || !currentStep) return null;

    const margin = 12;
    const maxWidth = 360;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const placement = currentStep.placement ?? "bottom";

    const preferred = {
      left: targetRect.left,
      top: targetRect.bottom + margin,
    };

    if (placement === "top") {
      preferred.left = targetRect.left;
      preferred.top = targetRect.top - margin;
    }
    if (placement === "left") {
      preferred.left = targetRect.left - margin;
      preferred.top = targetRect.top;
    }
    if (placement === "right") {
      preferred.left = targetRect.right + margin;
      preferred.top = targetRect.top;
    }

    const left = clamp(preferred.left, 16, Math.max(16, vw - maxWidth - 16));
    const top = clamp(preferred.top, 16, Math.max(16, vh - 220));

    return {
      left,
      top,
      maxWidth,
    };
  }, [currentStep, targetRect]);

  const value = useMemo<TourContextType>(() => {
    return {
      isOpen,
      start,
      stop,
      reset,
    };
  }, [isOpen, reset, start, stop]);

  return (
    <TourContext.Provider value={value}>
      {children}

      {isOpen && currentStep && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/60" />

          {targetRect && (
            <div
              className="absolute rounded-2xl"
              style={{
                left: Math.max(0, targetRect.left - 6),
                top: Math.max(0, targetRect.top - 6),
                width: Math.min(window.innerWidth, targetRect.width + 12),
                height: Math.min(window.innerHeight, targetRect.height + 12),
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.60)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            />
          )}

          <div
            className="absolute rounded-2xl border bg-card p-4 shadow-2xl"
            style={tooltipStyle ?? { left: 16, top: 16, maxWidth: 360 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tutorial • Passo {stepIndex + 1} de {steps.length}
                </div>
                <div className="mt-1 font-display text-base font-bold text-foreground">{currentStep.title}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={stop} aria-label="Fechar tutorial">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">{currentStep.description}</div>

            {targetMissing && (
              <div className="mt-3 rounded-xl border border-amber-200/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Não encontrei o elemento deste passo ainda. Vou tentar novamente…
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" onClick={prev} disabled={stepIndex === 0}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={stop}>
                  <SkipForward className="h-4 w-4 mr-2" />
                  Pular
                </Button>
                <Button className="gradient-primary text-primary-foreground" onClick={next}>
                  {stepIndex >= steps.length - 1 ? "Concluir" : "Avançar"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}
