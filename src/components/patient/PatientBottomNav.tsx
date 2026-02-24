import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Heart,
  MessageCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/paciente/dashboard", icon: LayoutDashboard, label: "Início" },
  { href: "/paciente/consultas", icon: Calendar, label: "Consultas" },
  { href: "/paciente/saude", icon: Heart, label: "Saúde" },
  { href: "/paciente/mensagens", icon: MessageCircle, label: "Chat" },
  { href: "/paciente/perfil", icon: User, label: "Perfil" },
];

export function PatientBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border/50 lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg transition-colors",
                  isActive && "bg-teal-100 dark:bg-teal-900"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
