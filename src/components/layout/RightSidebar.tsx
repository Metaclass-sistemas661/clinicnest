import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { NestAvatar } from "@/components/patient/NestAvatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Settings, PanelRightClose, Stethoscope, CreditCard, Bell, BookOpen, Plus, Calendar, Users, DollarSign, Package, ChevronLeft } from "lucide-react";
import { PROFESSIONAL_TYPE_LABELS } from "@/types/database";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { AiAgentChatPanel } from "@/components/ai/AiAgentChatPanel";
import { AiCopilotPanel } from "@/components/ai/AiCopilotPanel";
import { AiGpsNavigator } from "@/components/ai/AiGpsNavigator";
import { useCopilotProntuario } from "@/contexts/CopilotProntuarioContext";
import { useAiActivity } from "@/contexts/AiActivityContext";

const RAIL_WIDTH = "w-14"; // 56px
const PANEL_WIDTH = "w-[380px]";

type SidebarTab = "nest" | "copilot";

export function RightSidebar() {
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { profile } = auth;
  const isAdmin = auth?.isAdmin ?? false;
  const { professionalType } = usePermissions();
  const { hasFeature } = usePlanFeatures();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("nest");
  const copilot = useCopilotProntuario();
  const { isAnyActive: aiActive } = useAiActivity();
  const navigate = useNavigate();

  const showNest = hasFeature("aiAgentChat");
  const showCopilot = copilot.active;

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  // Auto-switch to copilot tab when prontuário becomes active
  useEffect(() => {
    if (showCopilot && !expanded) {
      setActiveTab("copilot");
    }
    if (!showCopilot && activeTab === "copilot") {
      setActiveTab("nest");
    }
  }, [showCopilot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mobile: floating button + Sheet drawer ──────────────────
  if (isMobile) {
    if (!showNest && !showCopilot) return null;

    return (
      <>
        {/* Floating pulsing toggle button */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center h-12 w-7 rounded-l-xl bg-teal-600 dark:bg-teal-700 text-white shadow-lg shadow-teal-600/30 animate-pulse hover:animate-none hover:w-9 transition-all"
            aria-label="Abrir assistente IA"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 border-l border-border/30 bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {activeTab === "nest" ? (
                  <NestAvatar size={28} className="ring-1 ring-teal-500/30" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Stethoscope className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {activeTab === "nest" ? "Copilot Nest" : "Copilot Clínico"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {activeTab === "nest" ? "Assistente IA" : "Sugestões do prontuário"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Switcher */}
            {showNest && showCopilot && (
              <div className="flex border-b border-border/50">
                <button
                  onClick={() => setActiveTab("nest")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                    activeTab === "nest"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <NestAvatar size={16} />
                  Nest
                </button>
                <button
                  onClick={() => setActiveTab("copilot")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                    activeTab === "copilot"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Clínico
                  {aiActive && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "nest" && <AiAgentChatPanel />}
              {activeTab === "copilot" && copilot.input && (
                <div className="h-full overflow-y-auto p-3 space-y-3">
                  <AiGpsNavigator input={copilot.input} />
                  <div className="border-t border-border/30 pt-2">
                    <AiCopilotPanel
                      input={copilot.input}
                      onSelectCid={copilot.callbacks.onSelectCid}
                      onAppendPrescription={copilot.callbacks.onAppendPrescription}
                      onAppendExam={copilot.callbacks.onAppendExam}
                      onAppendPlan={copilot.callbacks.onAppendPlan}
                      className="border-0 shadow-none"
                    />
                  </div>
                </div>
              )}
              {activeTab === "copilot" && !copilot.input && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 text-muted-foreground gap-3">
                  <Stethoscope className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Abra um prontuário para ativar o Copilot Clínico.</p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  const openTab = (tab: SidebarTab) => {
    setActiveTab(tab);
    setExpanded(true);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "absolute top-0 right-0 bottom-0 z-40 flex-col",
          "bg-background/95 backdrop-blur-xl border-l border-border/30",
          "transition-all duration-300 ease-out",
          expanded ? cn("flex", PANEL_WIDTH) : cn("hidden xl:flex", RAIL_WIDTH),
        )}
      >
        {/* ── Rail (always visible) ─────────────────────────── */}
        {!expanded && (
          <div className="flex h-full flex-col items-center py-4 gap-2">
            {/* User Avatar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/minhas-configuracoes"
                  className="flex items-center justify-center rounded-xl p-1 transition-all hover:ring-2 hover:ring-primary/30"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "Avatar"}
                      className="h-9 w-9 rounded-xl object-cover ring-2 ring-primary/20"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-sm font-bold shadow-md shadow-cyan-500/25">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                <p className="font-medium">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin
                    ? "Administrador"
                    : PROFESSIONAL_TYPE_LABELS[professionalType] || "Profissional"}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="mx-auto w-6 border-t border-border/50" />

            {/* Quick Create Button */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  <p className="font-medium">Criar</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="left" sideOffset={8}>
                <DropdownMenuItem onClick={() => navigate("/agenda")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Novo agendamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/pacientes")}>
                  <Users className="mr-2 h-4 w-4" />
                  Novo paciente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/procedimentos")}>
                  <Stethoscope className="mr-2 h-4 w-4" />
                  Novo procedimento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/produtos")}>
                  <Package className="mr-2 h-4 w-4" />
                  Movimentar estoque
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Nest AI Button */}
            {showNest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => openTab("nest")}
                    className={cn(
                      "flex items-center justify-center rounded-xl p-1 transition-all hover:bg-primary/10 hover:ring-2 hover:ring-primary/30 active:scale-95",
                      expanded && activeTab === "nest" && "ring-2 ring-primary/40 bg-primary/10",
                    )}
                  >
                    <NestAvatar size={36} className="rounded-xl ring-2 ring-teal-500/20" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  <p className="font-medium">Copilot Nest</p>
                  <p className="text-xs text-muted-foreground">Assistente IA</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Copilot Clínico Button — only when prontuário is active */}
            {showCopilot && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => openTab("copilot")}
                    className={cn(
                      "flex items-center justify-center rounded-xl p-2 transition-all hover:bg-primary/10 hover:ring-2 hover:ring-primary/30 active:scale-95 text-primary",
                      expanded && activeTab === "copilot" && "ring-2 ring-primary/40 bg-primary/10",
                    )}
                  >
                    <Stethoscope className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  <p className="font-medium">Copilot Clínico</p>
                  <p className="text-xs text-muted-foreground">Sugestões do prontuário</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <div className="mx-auto w-6 border-t border-border/50" />

            {/* Assinatura */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/assinatura"
                  className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                >
                  <CreditCard className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Assinatura
              </TooltipContent>
            </Tooltip>

            {/* Notificações */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/notificacoes"
                  className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                >
                  <Bell className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Notificações
              </TooltipContent>
            </Tooltip>

            {/* Ajuda */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/ajuda"
                  className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                >
                  <BookOpen className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Ajuda
              </TooltipContent>
            </Tooltip>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/minhas-configuracoes"
                  className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-4.5 w-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                Configurações
              </TooltipContent>
            </Tooltip>

            {/* Theme Toggle */}
            <div className="mt-1">
              <ThemeToggle />
            </div>
          </div>
        )}

        {/* ── Expanded Panel ────────────────────────────────── */}
        {expanded && (
          <div className="flex h-full flex-col">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {activeTab === "nest" ? (
                  <NestAvatar size={28} className="ring-1 ring-teal-500/30" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Stethoscope className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {activeTab === "nest" ? "Copilot Nest" : "Copilot Clínico"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {activeTab === "nest" ? "Assistente IA" : "Sugestões do prontuário"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(false)}
                title="Recolher painel"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Switcher — only when both tabs available */}
            {showNest && showCopilot && (
              <div className="flex border-b border-border/50">
                <button
                  onClick={() => setActiveTab("nest")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                    activeTab === "nest"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <NestAvatar size={16} />
                  Nest
                </button>
                <button
                  onClick={() => setActiveTab("copilot")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                    activeTab === "copilot"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Clínico
                  {aiActive && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
              </div>
            )}

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "nest" && <AiAgentChatPanel />}
              {activeTab === "copilot" && copilot.input && (
                <div className="h-full overflow-y-auto p-3 space-y-3">
                  <AiGpsNavigator input={copilot.input} />
                  <div className="border-t border-border/30 pt-2">
                    <AiCopilotPanel
                      input={copilot.input}
                      onSelectCid={copilot.callbacks.onSelectCid}
                      onAppendPrescription={copilot.callbacks.onAppendPrescription}
                      onAppendExam={copilot.callbacks.onAppendExam}
                      onAppendPlan={copilot.callbacks.onAppendPlan}
                      className="border-0 shadow-none"
                    />
                  </div>
                </div>
              )}
              {activeTab === "copilot" && !copilot.input && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 text-muted-foreground gap-3">
                  <Stethoscope className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Abra um prontuário para ativar o Copilot Clínico.</p>
                </div>
              )}
            </div>

            {/* User mini-bar at bottom */}
            <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
              <Link
                to="/minhas-configuracoes"
                className="flex items-center gap-2 min-w-0 flex-1 rounded-lg px-2 py-1.5 transition-all hover:bg-muted"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || "Avatar"}
                    className="h-7 w-7 rounded-lg object-cover ring-1 ring-primary/20 shrink-0"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-xs font-bold">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {profile?.full_name || "Usuário"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isAdmin
                      ? "Administrador"
                      : PROFESSIONAL_TYPE_LABELS[professionalType] || "Profissional"}
                  </p>
                </div>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
