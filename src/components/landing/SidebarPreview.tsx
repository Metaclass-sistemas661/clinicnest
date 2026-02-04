import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Package,
  Scissors,
  Users,
  UserCog,
  Settings,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navCategories = [
  {
    label: "Operacional",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, active: false },
      { title: "Agenda", icon: Calendar, active: false },
      { title: "Serviços", icon: Scissors, active: false },
      { title: "Clientes", icon: Users, active: false },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", icon: DollarSign, active: false },
      { title: "Produtos", icon: Package, active: false },
    ],
  },
  {
    label: "Administrativo",
    items: [
      { title: "Equipe", icon: UserCog, active: false },
      { title: "Configurações", icon: Settings, active: false },
      { title: "Assinatura", icon: CreditCard, active: false },
    ],
  },
];

interface SidebarPreviewProps {
  activePage?: string;
}

export function SidebarPreview({ activePage }: SidebarPreviewProps) {
  const getActiveState = (title: string) => {
    if (!activePage) return false;
    const pageMap: Record<string, string> = {
      dashboard: "Dashboard",
      agenda: "Agenda",
      clientes: "Clientes",
      financeiro: "Financeiro",
      estoque: "Produtos",
    };
    return pageMap[activePage] === title;
  };

  return (
    <div 
      className="fixed left-0 top-0 h-full w-72 border-r border-border flex flex-col"
      style={{ 
        backgroundColor: "hsl(250 25% 8%)",
        background: "linear-gradient(180deg, hsl(250 25% 8%) 0%, hsl(250 25% 7%) 100%)"
      }}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-display text-lg font-bold text-foreground">
              Salão Beauty
            </span>
            <p className="text-xs text-muted-foreground">Gestão Profissional</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-4">
        {navCategories.map((category) => (
          <div key={category.label} className="space-y-1.5">
            <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {category.label}
            </p>
            <div className="space-y-1">
              {category.items.map((item) => {
                const isActive = getActiveState(item.title);
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "gradient-primary text-white shadow-glow"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      isActive && "scale-110",
                      !isActive && "group-hover:scale-110"
                    )} />
                    <span>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-4 rounded-xl border-gradient bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-accent text-white font-bold text-base">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Ana Silva
              </p>
              <p className="text-xs text-muted-foreground">
                Administrador
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer">
          <span className="h-5 w-5 shrink-0">🚪</span>
          <span>Sair</span>
        </div>
      </div>
    </div>
  );
}
