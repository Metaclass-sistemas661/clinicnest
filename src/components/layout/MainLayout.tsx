import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SubscriptionGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "ml-0" : "ml-72"
        )}>
          {/* Header */}
          {(title || actions) && (
            <header className={cn(
              "sticky top-0 z-30 glass border-b border-border",
              isMobile && "top-14" // Account for mobile header
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
                {actions && (
                  <div className={cn(
                    "flex items-center gap-2 sm:gap-3",
                    isMobile && "w-full justify-center sm:w-auto sm:justify-end flex-wrap"
                  )}>
                    {actions}
                  </div>
                )}
              </div>
            </header>
          )}

          {/* Content */}
          <div className={cn(
            "animate-fade-in",
            isMobile ? "p-4" : "p-8"
          )}>
            {children}
          </div>
        </main>
      </div>
    </SubscriptionGuard>
  );
}
