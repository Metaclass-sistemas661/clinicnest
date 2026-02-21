import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Calendar,
  Video,
  FileText,
  Pill,
  ClipboardList,
  LogOut,
  Menu,
  Heart,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Início", href: "/paciente/dashboard", icon: LayoutDashboard },
  { label: "Minhas Consultas", href: "/paciente/consultas", icon: Calendar },
  { label: "Teleconsulta", href: "/paciente/teleconsulta", icon: Video },
  { label: "Exames e Laudos", href: "/paciente/exames", icon: FileText },
  { label: "Receitas", href: "/paciente/receitas", icon: Pill },
  { label: "Atestados", href: "/paciente/atestados", icon: ClipboardList },
];

const bottomItems: NavItem[] = [
  { label: "Meu Perfil", href: "/paciente/perfil", icon: User },
  { label: "Configurações", href: "/paciente/configuracoes", icon: Settings },
];

function SidebarContent({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.full_name ?? "Paciente");
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/paciente/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border/50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 flex-shrink-0">
          <Heart className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none overflow-hidden">
            <div className="flex items-baseline gap-0">
              <span className="font-display text-lg font-bold text-purple-600 dark:text-purple-400 tracking-tight leading-none">
                Clinic
              </span>
              <span className="font-display text-lg font-bold text-foreground tracking-tight leading-none">
                Nest
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground tracking-[0.12em] leading-none mt-0.5">
              Portal do Paciente
            </span>
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 hidden lg:flex"
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5 flex-shrink-0", isActive && "text-purple-600 dark:text-purple-400")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/50 px-3 py-3 space-y-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <div className="flex items-center gap-2 px-3 py-1">
          {!collapsed && <ThemeToggle />}
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 flex-shrink-0">
              <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-[11px] text-muted-foreground">Paciente</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PatientLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PatientLayout({ title, subtitle, actions, children }: PatientLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-300 flex-shrink-0",
            collapsed ? "w-[68px]" : "w-[260px]"
          )}
        >
          <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        </aside>
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-3 left-3 z-50 lg:hidden h-10 w-10 rounded-xl bg-background/80 backdrop-blur-sm border shadow-sm"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SidebarContent collapsed={false} onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className={cn(isMobile && "pl-12")}>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
