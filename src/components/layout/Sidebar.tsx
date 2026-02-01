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
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Scissors className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold text-sidebar-foreground">
              {tenant?.name || "BeautySalon"}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "animate-scale-in")} />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {!isCollapsed && (
          <div className="mb-3 rounded-lg bg-sidebar-accent p-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {profile?.full_name || "Usuário"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : "Profissional"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive",
            isCollapsed && "justify-center px-2"
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
