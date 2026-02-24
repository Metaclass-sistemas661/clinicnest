import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, CheckCircle2, XCircle, Calendar, UserCheck } from "lucide-react";
import type { Profile, AppointmentStatus } from "@/types/database";

interface AgendaFiltersProps {
  statusFilter: AppointmentStatus | "all";
  onStatusFilterChange: (status: AppointmentStatus | "all") => void;
  professionalFilter: string;
  onProfessionalFilterChange: (professionalId: string) => void;
  professionals: Profile[];
  isAdmin?: boolean;
  appointmentCounts: {
    total: number;
    pending: number;
    confirmed: number;
    arrived: number;
    completed: number;
    cancelled: number;
  };
}

export function AgendaFilters({
  statusFilter,
  onStatusFilterChange,
  professionalFilter,
  onProfessionalFilterChange,
  professionals,
  isAdmin = false,
  appointmentCounts,
}: AgendaFiltersProps) {
  const statusOptions = [
    {
      value: "all" as const,
      label: "Todos",
      count: appointmentCounts.total,
      className: "bg-muted text-muted-foreground",
      icon: Calendar,
    },
    {
      value: "pending" as const,
      label: "Pendentes",
      count: appointmentCounts.pending,
      className: "bg-warning/20 text-warning",
      icon: Clock,
    },
    {
      value: "confirmed" as const,
      label: "Confirmados",
      count: appointmentCounts.confirmed,
      className: "bg-info/20 text-info",
      icon: CheckCircle2,
    },
    {
      value: "arrived" as const,
      label: "Chegou",
      count: appointmentCounts.arrived,
      className: "bg-violet-500/20 text-violet-600",
      icon: UserCheck,
    },
    {
      value: "completed" as const,
      label: "Concluídos",
      count: appointmentCounts.completed,
      className: "bg-success/20 text-success",
      icon: CheckCircle2,
    },
    {
      value: "cancelled" as const,
      label: "Cancelados",
      count: appointmentCounts.cancelled,
      className: "bg-destructive/20 text-destructive",
      icon: XCircle,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 text-foreground">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => {
          const Icon = option.icon;
          const isActive = statusFilter === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={`gap-2 ${isActive ? "gradient-primary text-primary-foreground" : ""}`}
              onClick={() => onStatusFilterChange(option.value)}
              data-tour={`agenda-filter-status-${option.value}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
              <Badge
                variant="secondary"
                className={`ml-1 px-1.5 py-0 text-xs ${!isActive ? option.className : ""}`}
              >
                {option.count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Professional filter - apenas admin */}
      {isAdmin && (
      <div className="w-full sm:w-auto sm:ml-auto">
        <Select value={professionalFilter} onValueChange={onProfessionalFilterChange}>
          <SelectTrigger className="w-full sm:w-48" data-tour="agenda-filter-professional">
            <SelectValue placeholder="Todos os profissionais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                {prof.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      )}
    </div>
  );
}
