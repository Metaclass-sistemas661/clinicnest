import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { NestAvatar } from "@/components/patient/NestAvatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, PanelRightClose } from "lucide-react";
import { PROFESSIONAL_TYPE_LABELS } from "@/types/database";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { AiAgentChatPanel } from "@/components/ai/AiAgentChatPanel";

const RAIL_WIDTH = "w-14"; // 56px
const PANEL_WIDTH = "w-[380px]";

export function RightSidebar() {
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { profile } = auth;
  const isAdmin = auth?.isAdmin ?? false;
  const { professionalType } = usePermissions();
  const { hasFeature } = usePlanFeatures();
  const [expanded, setExpanded] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  // Hide on mobile — the chat is accessible elsewhere
  if (isMobile) return null;

  const showNest = hasFeature("aiAgentChat");

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "fixed top-0 right-0 z-40 flex h-screen flex-col",
          "bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-xl",
          "transition-all duration-300 ease-out",
          expanded ? PANEL_WIDTH : RAIL_WIDTH,
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

            {/* Nest AI Button */}
            {showNest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setExpanded(true)}
                    className="flex items-center justify-center rounded-xl p-1 transition-all hover:bg-primary/10 hover:ring-2 hover:ring-primary/30 active:scale-95"
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
                <NestAvatar size={28} className="ring-1 ring-teal-500/30" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Copilot Nest</h3>
                  <p className="text-[11px] text-muted-foreground">Assistente IA</p>
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

            {/* Chat Panel */}
            <div className="flex-1 overflow-hidden">
              <AiAgentChatPanel />
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
