import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-72 min-h-screen transition-all duration-300">
        {/* Header */}
        {(title || actions) && (
          <header className="sticky top-0 z-30 glass border-b border-white/20">
            <div className="flex h-20 items-center justify-between px-8">
              <div className="space-y-1">
                {title && (
                  <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </header>
        )}

        {/* Content */}
        <div className="p-8">
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
