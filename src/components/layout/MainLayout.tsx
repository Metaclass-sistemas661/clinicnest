import { ReactNode, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { useAuth } from "@/contexts/AuthContext";
import { AdminCommissionReminderDialog } from "@/components/admin/AdminCommissionReminderDialog";
import { GoalsProgressBar } from "@/components/header/GoalsProgressBar";
import { ProfessionalGoalMotivationDialog } from "@/components/admin/ProfessionalGoalMotivationDialog";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { AdverseEventButton } from "@/components/quality/AdverseEventButton";
import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";
import { useAppStatus, usePersistedLastRefresh } from "@/contexts/AppStatusContext";
import { formatInAppTz } from "@/lib/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { GlobalSearch } from "@/components/header/GlobalSearch";
import { KeyboardShortcutsDialog } from "@/components/help/KeyboardShortcutsDialog";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { CopilotProntuarioProvider } from "@/contexts/CopilotProntuarioContext";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const auth = useAuth();
  const isAdmin = auth?.isAdmin ?? false;
  const isMobile = useIsMobile();
  const { isOnline } = useAppStatus();
  const tenantId = auth?.tenant?.id ?? null;
  const userId = auth?.user?.id ?? null;
  const { lastRefreshedAt } = usePersistedLastRefresh(tenantId, userId);
  const [now, setNow] = useState(() => new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const headerClock = useMemo(() => {
    try {
      return formatInAppTz(now, "EEE, dd/MM · HH:mm");
    } catch {
      return "";
    }
  }, [now]);

  const lastRefreshLabel = useMemo(() => {
    if (!lastRefreshedAt) return null;
    const ms = Date.now() - new Date(lastRefreshedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const min = Math.floor(ms / 60000);
    if (min <= 0) return "Atualizado agora";
    if (min === 1) return "Atualizado há 1 min";
    if (min < 60) return `Atualizado há ${min} min`;
    const h = Math.floor(min / 60);
    if (h === 1) return "Atualizado há 1 h";
    return `Atualizado há ${h} h`;
  }, [lastRefreshedAt]);

  return (
    <SubscriptionGuard>
      <CopilotProntuarioProvider>
      {isAdmin && (
        <>
          <AdminCommissionReminderDialog />
        </>
      )}
      {!isAdmin && <ProfessionalGoalMotivationDialog />}
      <KeyboardShortcutsDialog />
      <div className="min-h-screen bg-background">
        <Sidebar onCollapsedChange={setSidebarCollapsed} />
        <main className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "ml-0" : sidebarCollapsed ? "ml-20" : "ml-72",
          !isMobile && "mr-14"
        )}>
          <GoalsProgressBar />
          {/* Header: título + sino (staff) + actions */}
          <header className={cn(
            "sticky top-0 z-30 glass border-b border-border",
            isMobile && "top-[88px]"
          )}>
            <div className={cn(
              "flex items-center justify-between",
              isMobile ? "h-auto min-h-16 flex-col gap-3 px-4 py-4 sm:flex-row sm:h-16 sm:py-0" : "h-20 px-8"
            )}>
              <div className={cn(
                "space-y-0.5",
                isMobile && "w-full text-center sm:text-left sm:w-auto"
              )}>
                {title && (
                  <h1 className={cn(
                    "font-display font-bold tracking-tight text-foreground",
                    isMobile ? "text-xl" : "text-2xl"
                  )}>
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <div className={cn(
                "flex items-center gap-2 sm:gap-3",
                isMobile && "w-full justify-center sm:w-auto sm:justify-end flex-wrap"
              )}>
                <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                  <GlobalSearch />
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isOnline ? "bg-success" : "bg-destructive"
                      )}
                    />
                    <span>{isOnline ? "Online" : "Offline"}</span>
                  </span>
                  <span className="tabular-nums">{headerClock}</span>
                  {lastRefreshLabel ? <span>{lastRefreshLabel}</span> : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Criar</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/agenda">Novo agendamento</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/pacientes">Novo paciente</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/servicos">Novo procedimento</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/produtos">Movimentar estoque</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {!isAdmin && <NotificationsBell />}
                {actions}
              </div>
            </div>
          </header>

          {/* Content */}
          <div className={cn(
            "animate-fade-in",
            isMobile ? "p-4" : "p-8"
          )}>
            <ModuleErrorBoundary moduleName="Página">
              {children}
            </ModuleErrorBoundary>
          </div>
          
          {/* Botão flutuante para notificar eventos adversos */}
          <AdverseEventButton />
        </main>

        {/* Right Sidebar — Copilot Nest + Copilot Clínico */}
        <RightSidebar />
      </div>
      </CopilotProntuarioProvider>
    </SubscriptionGuard>
  );
}
