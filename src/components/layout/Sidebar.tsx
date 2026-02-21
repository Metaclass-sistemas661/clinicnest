import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Settings,
  LogOut,
  CreditCard,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Menu,
  Clock,
  Target,
  Bell,
  BookOpen,
  Shield,
  Send,
  BarChart3,
  Globe,
  Gift,
  Zap,
  Tag,
  Ticket,
  Plug,
  ClipboardList,
  HeartPulse,
  Building2,
  FlaskConical,
  Activity,
  FilePlus2,
  Stethoscope,
  Video,
  MessageSquare,
  FileCode2,
  Building,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSimpleMode } from "@/lib/simple-mode";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  staffOnly?: boolean;
}

interface NavCategory {
  label: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    label: "Atendimento",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", href: "/agenda", icon: Calendar },
      { title: "Teleconsulta", href: "/teleconsulta", icon: Video },
      { title: "Disponibilidade", href: "/disponibilidade", icon: Clock },
      { title: "Pacientes", href: "/clientes", icon: Users },
    ],
  },
  {
    label: "Clínico",
    items: [
      { title: "Triagem & Anamnese", href: "/triagem", icon: Activity },
      { title: "Prontuários", href: "/prontuarios", icon: ClipboardList },
      { title: "Receituários", href: "/receituarios", icon: FilePlus2 },
      { title: "Laudos & Exames", href: "/laudos", icon: FlaskConical },
      { title: "Procedimentos", href: "/servicos", icon: Stethoscope, adminOnly: true },
      { title: "Especialidades", href: "/especialidades", icon: HeartPulse, adminOnly: true },
      { title: "Convênios", href: "/convenios", icon: Building2, adminOnly: true },
      { title: "Modelos de Prontuário", href: "/modelos-prontuario", icon: FileCode2, adminOnly: true },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", href: "/financeiro", icon: DollarSign, adminOnly: true },
      { title: "Faturamento TISS", href: "/faturamento-tiss", icon: Calculator, adminOnly: true },
      { title: "Minhas Comissões", href: "/minhas-comissoes", icon: Wallet, staffOnly: true },
      { title: "Meus Salários", href: "/meus-salarios", icon: DollarSign, staffOnly: true },
      { title: "Relatório DRE", href: "/relatorio-financeiro", icon: BarChart3, adminOnly: true },
      { title: "Relatórios & BI", href: "/relatorios", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: "Estoque",
    items: [
      { title: "Insumos & Produtos", href: "/produtos", icon: Package },
      { title: "Compras", href: "/compras", icon: ShoppingCart, adminOnly: true },
      { title: "Fornecedores", href: "/fornecedores", icon: Truck, adminOnly: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Agendamento Online", href: "/agendamento-online", icon: Globe, adminOnly: true },
      { title: "Campanhas", href: "/campanhas", icon: Send, adminOnly: true },
      { title: "Automações", href: "/automacoes", icon: Zap, adminOnly: true },
      { title: "Fidelidade & Cashback", href: "/fidelidade-cashback", icon: Gift, adminOnly: true },
      { title: "Vouchers", href: "/vouchers", icon: Ticket, adminOnly: true },
      { title: "Cupons", href: "/cupons", icon: Tag, adminOnly: true },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Metas", href: "/metas", icon: Target, adminOnly: true },
      { title: "Minhas Metas", href: "/minhas-metas", icon: Target, staffOnly: true },
      { title: "Equipe", href: "/equipe", icon: UserCog, adminOnly: true },
      { title: "Unidades", href: "/unidades", icon: Building, adminOnly: true },
      { title: "Chat Interno", href: "/chat", icon: MessageSquare },
      { title: "Integrações", href: "/integracoes", icon: Plug, adminOnly: true },
      { title: "Auditoria", href: "/auditoria", icon: Shield, adminOnly: true },
      { title: "Configurações", href: "/configuracoes", icon: Settings, adminOnly: true },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Notificações", href: "/notificacoes", icon: Bell },
      { title: "Assinatura", href: "/assinatura", icon: CreditCard, adminOnly: true },
      { title: "Ajuda", href: "/ajuda", icon: BookOpen },
    ],
  },
];

const prefetchByHref: Record<string, () => void> = {
  "/dashboard": () => void import("@/pages/Dashboard"),
  "/agenda": () => void import("@/pages/Agenda"),
  "/teleconsulta": () => void import("@/pages/Teleconsulta"),
  "/modelos-prontuario": () => void import("@/pages/ModelosProntuario"),
  "/faturamento-tiss": () => void import("@/pages/FaturamentoTISS"),
  "/chat": () => void import("@/pages/Chat"),
  "/unidades": () => void import("@/pages/Unidades"),
  "/disponibilidade": () => void import("@/pages/Disponibilidade"),
  "/servicos": () => void import("@/pages/Servicos"),
  "/clientes": () => void import("@/pages/Clientes"),
  "/prontuarios": () => void import("@/pages/Prontuarios"),
  "/triagem": () => void import("@/pages/Triagem"),
  "/receituarios": () => void import("@/pages/Receituarios"),
  "/laudos": () => void import("@/pages/Laudos"),
  "/especialidades": () => void import("@/pages/Especialidades"),
  "/convenios": () => void import("@/pages/Convenios"),
  "/financeiro": () => void import("@/pages/Financeiro"),
  "/produtos": () => void import("@/pages/Produtos"),
  "/compras": () => void import("@/pages/Compras"),
  "/fornecedores": () => void import("@/pages/Fornecedores"),
  "/metas": () => void import("@/pages/Metas"),
  "/auditoria": () => void import("@/pages/Auditoria"),
  "/minhas-metas": () => void import("@/pages/MinhasMetas"),
  "/equipe": () => void import("@/pages/Equipe"),
  "/configuracoes": () => void import("@/pages/Configuracoes"),
  "/agendamento-online": () => void import("@/pages/AgendamentoOnlineAdmin"),
  "/fidelidade-cashback": () => void import("@/pages/FidelidadeCashbackAdmin"),
  "/minhas-configuracoes": () => void import("@/pages/MinhasConfiguracoes"),
  "/notificacoes": () => void import("@/pages/Notificacoes"),
  "/assinatura": () => void import("@/pages/Assinatura"),
  "/assinatura/gerenciar": () => void import("@/pages/GerenciarAssinatura"),
  "/minhas-comissoes": () => void import("@/pages/MinhasComissoes"),
  "/meus-salarios": () => void import("@/pages/MeusSalarios"),
  "/campanhas": () => void import("@/pages/Campanhas"),
  "/automacoes": () => void import("@/pages/Automacoes"),
  "/relatorio-financeiro": () => void import("@/pages/RelatorioFinanceiro"),
  "/relatorios": () => void import("@/pages/Relatorios"),
  "/ajuda": () => void import("@/pages/Ajuda"),
  "/suporte": () => void import("@/pages/Suporte"),
  "/vouchers": () => void import("@/pages/Vouchers"),
  "/cupons": () => void import("@/pages/Cupons"),
  "/integracoes": () => void import("@/pages/Integracoes"),
};

function prefetchRoute(href: string) {
  try {
    prefetchByHref[href]?.();
  } catch {
    // no-op
  }
}

// Persist nav scroll position across re-renders / route changes
let savedNavScroll = 0;

function SidebarContent({
  isCollapsed,
  onNavigate
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { profile, tenant, signOut } = auth;
  const isAdmin = auth?.isAdmin ?? false;
  const { enabled: simpleModeEnabled } = useSimpleMode(profile?.tenant_id);
  const navRef = useRef<HTMLElement>(null);

  // Restore scroll position after render
  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = savedNavScroll;
    }
  });

  // Save scroll position on scroll
  const handleNavScroll = useCallback(() => {
    if (navRef.current) {
      savedNavScroll = navRef.current.scrollTop;
    }
  }, []);

  const handleSignOut = async () => {
    onNavigate?.();
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* Header */}
      <div className="flex h-16 md:h-20 items-center justify-between border-b border-white/10 px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-display text-base md:text-lg font-bold text-foreground">
                {tenant?.name || "ClinicNest"}
              </span>
              <p className="text-xs text-muted-foreground">Gestão de Clínicas</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {navCategories.map((category) => {
          const filteredItems = category.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.staffOnly && isAdmin) return false;
            if (simpleModeEnabled && item.href === "/auditoria") return false;
            return true;
          });
          if (filteredItems.length === 0) return null;
          return (
            <div key={category.label} className="space-y-1.5">
              {!isCollapsed && (
                <p className="px-3 md:px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {category.label}
                </p>
              )}
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const tourKey =
                    item.href === "/dashboard" ? "sidebar-dashboard" :
                    item.href === "/agenda" ? "sidebar-agenda" :
                    item.href === "/clientes" ? "sidebar-clientes" :
                    item.href === "/servicos" ? "sidebar-servicos" :
                    item.href === "/produtos" ? "sidebar-produtos" :
                    item.href === "/financeiro" ? "sidebar-financeiro" :
                    item.href === "/minhas-comissoes" ? "sidebar-minhas-comissoes" :
                    item.href === "/meus-salarios" ? "sidebar-meus-salarios" :
                    item.href === "/ajuda" ? "sidebar-ajuda" :
                    undefined;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
                      onMouseEnter={() => prefetchRoute(item.href)}
                      data-tour={tourKey}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "gradient-primary text-white shadow-glow"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                        isCollapsed && "justify-center px-3"
                      )}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <item.icon className={cn(
                        "h-5 w-5 shrink-0 transition-transform duration-200",
                        isActive && "scale-110",
                        !isActive && "group-hover:scale-110"
                      )} />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3 md:p-4">
        {!isCollapsed && (
          <div className="mb-3 md:mb-4 rounded-xl border-gradient bg-card p-3 md:p-4">
            <div className="flex items-center gap-3">
              <Link
                to="/minhas-configuracoes"
                onClick={onNavigate}
                onMouseEnter={() => prefetchRoute("/minhas-configuracoes")}
                className="flex flex-1 items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                title="Meu Perfil"
              >
                {/* Avatar: foto ou inicial */}
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || "Avatar"}
                    className="h-9 w-9 md:h-10 md:w-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl gradient-accent text-white font-bold text-sm md:text-base">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {profile?.full_name || "Usuário"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? "Administrador" : "Profissional"}
                  </p>
                </div>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mb-3 flex justify-center">
            <ThemeToggle />
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all",
            isCollapsed && "justify-center px-3"
          )}
          onClick={handleSignOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </div>
    </>
  );
}

export function Sidebar({ onCollapsedChange }: { onCollapsedChange?: (collapsed: boolean) => void } = {}) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Close mobile menu on route change
  const location = useLocation();
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Mobile: Sheet/Drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile Header Bar */}
        <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-vibrant shadow-glow">
              <HeartPulse className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">ClinicNest</span>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 glass-sidebar">
              <div className="flex h-full flex-col">
                <SidebarContent isCollapsed={false} onNavigate={() => setIsOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {/* Spacer for fixed header */}
        <div className="h-14" />
      </>
    );
  }

  // Desktop: Fixed Sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
        "glass-sidebar border-r border-border shadow-xl",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      <SidebarContent isCollapsed={isCollapsed} />

      {/* Collapse Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "absolute -right-4 top-24 z-50 h-8 w-8 rounded-full border bg-card shadow-lg hover:bg-primary hover:text-primary-foreground transition-all",
        )}
        aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        onClick={() => {
          const next = !isCollapsed;
          setIsCollapsed(next);
          onCollapsedChange?.(next);
        }}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </aside>
  );
}

export function useSidebarWidth() {
  const isMobile = useIsMobile();
  return isMobile ? 0 : 288; // 72 * 4 = 288px (w-72)
}
