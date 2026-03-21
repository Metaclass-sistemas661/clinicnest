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
import { KeyboardShortcutsDialog } from "@/components/help/KeyboardShortcutsDialog";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { CopilotProntuarioProvider } from "@/contexts/CopilotProntuarioContext";
import { TrialBanner } from "@/components/subscription/TrialBanner";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      {/* Outer teal background — fixed viewport, never scrolls */}
      <div className={cn(
        "h-screen w-screen overflow-hidden",
        !isMobile && "bg-teal-600 dark:bg-teal-700 p-2"
      )}>
        {/* Inner container — rounded card with border, fills viewport */}
        <div className={cn(
          "h-full w-full bg-background relative flex",
          !isMobile && "rounded-2xl overflow-hidden"
        )}>
          <Sidebar onCollapsedChange={setSidebarCollapsed} />

          {/* Scrollable main area */}
          <main className={cn(
            "flex-1 min-w-0 overflow-y-auto transition-all duration-300",
            isMobile ? "ml-0" : sidebarCollapsed ? "ml-[88px]" : "ml-[288px]",
            !isMobile && "xl:mr-[56px]"
          )}>
            <GoalsProgressBar />
            <TrialBanner />

            {/* Content */}
            <div className={cn(
              "animate-fade-in",
              isMobile ? "p-4" : "px-8 pt-6 pb-8"
            )}>
              {/* Page title — inline, no header bar */}
              {(title || actions) && (
                <div className={cn(
                  "flex items-center justify-between mb-6",
                  isMobile && "flex-col gap-3"
                )}>
                  <div className="space-y-0.5">
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
                    isMobile && "w-full justify-center flex-wrap"
                  )}>
                    {!isAdmin && <NotificationsBell />}
                    {actions}
                  </div>
                </div>
              )}

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
      </div>
      </CopilotProntuarioProvider>
    </SubscriptionGuard>
  );
}
