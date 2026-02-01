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
      <main className="pl-64 transition-all duration-300">
        <div className="p-8">
          {(title || actions) && (
            <header className="mb-8 flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </header>
          )}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
