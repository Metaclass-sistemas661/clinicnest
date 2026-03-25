import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ModuleErrorBoundary } from "@/components/ModuleErrorBoundary";
import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
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
  Wallet,
  MessageCircle,
  Search,
  Users,
  CreditCard,
  Files,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabasePatient } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PatientNotificationsBell } from "@/components/patient/PatientNotificationsBell";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { PatientGlobalSearch, usePatientGlobalSearch } from "@/components/patient/PatientGlobalSearch";
import { DependentBanner } from "@/components/patient/DependentSelector";
import { DependentsProvider, useDependentsOptional } from "@/hooks/useDependents";
import { AiPatientChat } from "@/components/ai";
import { usePatientShell } from "./PatientShellContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Início", href: "/paciente/dashboard", icon: LayoutDashboard },
  { label: "Agendar", href: "/paciente/agendar", icon: CalendarPlus },
  { label: "Minhas Consultas", href: "/paciente/consultas", icon: Calendar },
  { label: "Teleconsulta", href: "/paciente/teleconsulta", icon: Video },
  { label: "Minha Saúde", href: "/paciente/saude", icon: Heart },
  { label: "Planos de Tratamento", href: "/paciente/planos", icon: ClipboardList },
  { label: "Documentos", href: "/paciente/documentos", icon: Files },
  { label: "Questionários", href: "/paciente/proms", icon: ClipboardList },
  { label: "Cartão de Saúde", href: "/paciente/cartao-saude", icon: CreditCard },
  { label: "Mensagens", href: "/paciente/mensagens", icon: MessageCircle },
  { label: "Financeiro", href: "/paciente/financeiro", icon: Wallet },
  { label: "Exames", href: "/paciente/exames", icon: FileText },
  { label: "Laudos", href: "/paciente/laudos", icon: Stethoscope },
  { label: "Receitas", href: "/paciente/receitas", icon: Pill },
  { label: "Atestados", href: "/paciente/atestados", icon: ClipboardList },
  { label: "Dependentes", href: "/paciente/dependentes", icon: Users },
  { label: "Créditos de Saúde", href: "/paciente/creditos", icon: Heart },
];

const bottomItems: NavItem[] = [
  { label: "Meu Perfil", href: "/paciente/perfil", icon: User },
  { label: "Configurações", href: "/paciente/configuracoes", icon: Settings },
];

export function SidebarContent({
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
    supabasePatient.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.full_name ?? "Paciente");
    });
  }, []);

  const handleSignOut = async () => {
    await supabasePatient.auth.signOut();
    navigate("/paciente/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/15">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
          <Heart className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none overflow-hidden">
            <div className="flex items-baseline gap-0">
              <span className="font-display text-lg font-bold text-white tracking-tight leading-none">
                Clinic
              </span>
              <span className="font-display text-lg font-bold text-white/80 tracking-tight leading-none">
                Nest
              </span>
            </div>
            <span className="text-[9px] text-white/50 tracking-[0.12em] leading-none mt-0.5">
              Portal do Paciente
            </span>
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 hidden lg:flex text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-1">
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
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5 flex-shrink-0", isActive && "text-teal-600")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/15 px-3 py-3 space-y-1">
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
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="border-t border-white/15 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 flex-shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate text-white">{userName}</div>
              <div className="text-[11px] text-white/50">Paciente</div>
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
  const shell = usePatientShell();

  // ── Lightweight mode: inside PatientShellRoute (sidebar is persistent in shell) ──
  if (shell.inShell) {
    return (
      <PatientLayoutLightweight
        title={title}
        subtitle={subtitle}
        actions={actions}
        shell={shell}
      >
        {children}
      </PatientLayoutLightweight>
    );
  }

  // ── Full layout mode (standalone, not inside shell) ──
  return (
    <PatientLayoutFull title={title} subtitle={subtitle} actions={actions}>
      {children}
    </PatientLayoutFull>
  );
}

/** Lightweight: only page header + content (sidebar lives in PatientShellRoute) */
function PatientLayoutLightweight({
  title,
  subtitle,
  actions,
  children,
  shell,
}: PatientLayoutProps & { shell: { setSearchOpen: (v: boolean) => void } }) {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Page header */}
      <div className={cn(
        "flex items-center justify-between mb-6",
        isMobile && "flex-col gap-3"
      )}>
        <div className={cn("space-y-0.5", isMobile && "pl-12")}>
          <h1 className={cn(
            "font-display font-bold tracking-tight text-foreground",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn(
          "flex items-center gap-2 sm:gap-3 flex-shrink-0",
          isMobile && "w-full justify-center flex-wrap"
        )}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shell.setSearchOpen(true)}
            className="hidden sm:flex gap-2 text-muted-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="text-xs">Buscar</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => shell.setSearchOpen(true)}
            className="sm:hidden"
          >
            <Search className="h-4 w-4" />
          </Button>
          <PatientNotificationsBell />
          <ThemeToggle />
          {actions}
        </div>
      </div>

      <ModuleErrorBoundary moduleName="Portal do Paciente">
        {children}
      </ModuleErrorBoundary>
    </>
  );
}

/** Full standalone layout with sidebar (used for backwards compat / routes outside shell) */
function PatientLayoutFull({ title, subtitle, actions, children }: PatientLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isOpen: searchOpen, setIsOpen: setSearchOpen } = usePatientGlobalSearch();

  return (
    <DependentsProvider>
      <PatientLayoutInner
        title={title}
        subtitle={subtitle}
        actions={actions}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        sheetOpen={sheetOpen}
        setSheetOpen={setSheetOpen}
        isMobile={isMobile}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
      >
        {children}
      </PatientLayoutInner>
    </DependentsProvider>
  );
}

function PatientLayoutInner({ 
  title, 
  subtitle, 
  actions, 
  children,
  collapsed,
  setCollapsed,
  sheetOpen,
  setSheetOpen,
  isMobile,
  searchOpen,
  setSearchOpen,
}: PatientLayoutProps & {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
  isMobile: boolean;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}) {
  const dependentsContext = useDependentsOptional();

  return (
    <div className={cn(
      "h-screen w-screen overflow-hidden",
      !isMobile && "bg-teal-600 dark:bg-teal-700 p-2"
    )}>
    <div className={cn(
      "h-full w-full bg-background relative flex overflow-hidden",
      !isMobile && "rounded-2xl"
    )}>
      {/* Global Search */}
      <PatientGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden lg:flex flex-col bg-teal-600 dark:bg-teal-700 transition-all duration-300 flex-shrink-0 overflow-hidden",
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
          <SheetContent side="left" className="p-0 w-[280px] bg-teal-600 dark:bg-teal-700 border-none">
            <SidebarContent collapsed={false} onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className={cn("flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col", isMobile && "pb-20")}>
        {/* Dependent context banner */}
        {dependentsContext?.activeDependent && (
          <DependentBanner
            dependent={dependentsContext.activeDependent}
            onClear={() => dependentsContext.setActiveDependent(null)}
          />
        )}

        {/* Content */}
        <div className={cn(
          "animate-fade-in flex-1",
          isMobile ? "p-4" : "px-8 pt-6 pb-8"
        )}>
          {/* Page title — inline, like clinic portal */}
          <div className={cn(
            "flex items-center justify-between mb-6",
            isMobile && "flex-col gap-3"
          )}>
            <div className={cn("space-y-0.5", isMobile && "pl-12")}>
              <h1 className={cn(
                "font-display font-bold tracking-tight text-foreground",
                isMobile ? "text-xl" : "text-2xl"
              )}>
                {title}
              </h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className={cn(
              "flex items-center gap-2 sm:gap-3 flex-shrink-0",
              isMobile && "w-full justify-center flex-wrap"
            )}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex gap-2 text-muted-foreground"
              >
                <Search className="h-4 w-4" />
                <span className="text-xs">Buscar</span>
                <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="sm:hidden"
              >
                <Search className="h-4 w-4" />
              </Button>
              <PatientNotificationsBell />
              <ThemeToggle />
              {actions}
            </div>
          </div>

          <ModuleErrorBoundary moduleName="Portal do Paciente">
            {children}
          </ModuleErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && <PatientBottomNav />}

      {/* Chat IA para pacientes */}
      <AiPatientChat />
    </div>
    </div>
  );
}
