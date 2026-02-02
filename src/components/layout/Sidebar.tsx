import { Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", href: "/agenda", icon: Calendar },
  { title: "Financeiro", href: "/financeiro", icon: DollarSign, adminOnly: true },
  { title: "Produtos", href: "/produtos", icon: Package, adminOnly: true },
  { title: "Serviços", href: "/servicos", icon: Scissors },
  { title: "Clientes", href: "/clientes", icon: Users },
  { title: "Equipe", href: "/equipe", icon: UserCog, adminOnly: true },
  { title: "Configurações", href: "/configuracoes", icon: Settings, adminOnly: true },
  { title: "Assinatura", href: "/assinatura", icon: CreditCard, adminOnly: true },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, tenant, isAdmin, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
        "glass-sidebar border-r border-white/20 shadow-xl",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-display text-lg font-bold text-foreground">
                {tenant?.name || "ProBeleza"}
              </span>
              <p className="text-xs text-muted-foreground">Gestão Profissional</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

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

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
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
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4">
        {!isCollapsed && (
          <div className="mb-4 rounded-xl border-gradient bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-accent text-white font-bold">
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
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all",
            isCollapsed && "justify-center px-3"
          )}
          onClick={signOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </div>
    </aside>
  );
}