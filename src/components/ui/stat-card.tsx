import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  subtitle,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const variants = {
    default: {
      card: "bg-card border-border hover:border-primary/30",
      icon: "bg-primary/10 text-primary",
      iconRing: "ring-primary/20",
    },
    success: {
      card: "bg-card border-success/20 hover:border-success/40",
      icon: "bg-success/10 text-success",
      iconRing: "ring-success/20",
    },
    warning: {
      card: "bg-card border-warning/20 hover:border-warning/40",
      icon: "bg-warning/10 text-warning",
      iconRing: "ring-warning/20",
    },
    danger: {
      card: "bg-card border-destructive/20 hover:border-destructive/40",
      icon: "bg-destructive/10 text-destructive",
      iconRing: "ring-destructive/20",
    },
    info: {
      card: "bg-card border-info/20 hover:border-info/40",
      icon: "bg-info/10 text-info",
      iconRing: "ring-info/20",
    },
  };

  const style = variants[variant];

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 sm:p-6 transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        style.card,
        className
      )}
    >
      {/* Decorative gradient */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 blur-2xl transition-all duration-500 group-hover:scale-150" />
      
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {(description || subtitle) && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{description || subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className={cn(
                  "text-xs sm:text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">vs mês anterior</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl ring-2 sm:ring-4 transition-all duration-300 flex-shrink-0",
            "group-hover:scale-110 group-hover:rotate-3",
            style.icon,
            style.iconRing
          )}
        >
          <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
      </div>
    </div>
  );
}
