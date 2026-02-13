import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Package,
  Scissors,
  Users,
  UserCog,
  Settings,
  LogOut,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Menu,
  Wallet,
  Target,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
    label: "Operacional",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", href: "/agenda", icon: Calendar },
      { title: "Serviços", href: "/servicos", icon: Scissors },
      { title: "Clientes", href: "/clientes", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", href: "/financeiro", icon: DollarSign, adminOnly: true },
      { title: "Minhas Comissões", href: "/minhas-comissoes", icon: Wallet, staffOnly: true },
      { title: "Meus Salários", href: "/meus-salarios", icon: DollarSign, staffOnly: true },
      { title: "Produtos", href: "/produtos", icon: Package },
    ],
  },
  {
    label: "Administrativo",
    items: [
      { title: "Metas", href: "/metas", icon: Target, adminOnly: true },
      { title: "Minhas Metas", href: "/minhas-metas", icon: Target, staffOnly: true },
      { title: "Equipe", href: "/equipe", icon: UserCog, adminOnly: true },
      { title: "Configurações", href: "/configuracoes", icon: Settings, adminOnly: true },
      { title: "Minhas Configurações", href: "/minhas-configuracoes", icon: Settings, staffOnly: true },
      { title: "Notificações", href: "/notificacoes", icon: Bell, staffOnly: true },
      { title: "Assinatura", href: "/assinatura", icon: CreditCard, adminOnly: true },
    ],
  },
];

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
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-display text-base md:text-lg font-bold text-foreground">
                {tenant?.name || "VynloBella"}
              </span>
              <p className="text-xs text-muted-foreground">Gestão Profissional</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
        {navCategories.map((category) => {
          const filteredItems = category.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.staffOnly && isAdmin) return false;
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
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
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
              <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl gradient-accent text-white font-bold text-sm md:text-base">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {profile?.full_name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Administrador" : "Profissional"}
                </p>
              </div>
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

export function Sidebar() {
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
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">VynloBella</span>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
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
        variant="ghost"
        size="icon"
        className={cn(
          "absolute -right-4 top-24 z-50 h-8 w-8 rounded-full border bg-card shadow-lg hover:bg-primary hover:text-primary-foreground transition-all",
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
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
