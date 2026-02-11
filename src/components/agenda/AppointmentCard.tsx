import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  User,
  Scissors,
  Phone,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Calendar,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Appointment, AppointmentStatus } from "@/types/database";

interface AppointmentCardProps {
  appointment: Appointment;
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
  compact?: boolean;
}

const statusConfig = {
  pending: {
    label: "Pendente",
    className: "bg-warning/20 text-warning border-warning/30",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-info/20 text-info border-info/30",
    icon: CheckCircle2,
  },
  completed: {
    label: "Concluído",
    className: "bg-success/20 text-success border-success/30",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/20 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

export function AppointmentCard({
  appointment,
  onStatusChange,
  compact = false,
}: AppointmentCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const status = statusConfig[appointment.status];
  const StatusIcon = status.icon;

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(appointment.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirm = () => handleStatusChange("confirmed");
  const handleComplete = () => handleStatusChange("completed");
  const handleCancel = async () => {
    await handleStatusChange("cancelled");
    setShowCancelDialog(false);
  };

  if (compact) {
    return (
      <div className="group relative rounded-xl border bg-card p-3 transition-all duration-200 hover:shadow-md hover:border-primary/30">
        {/* Time badge */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Clock className="h-3 w-3" />
            {formatInAppTz(appointment.scheduled_at, "HH:mm")}
          </div>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>
            {status.label}
          </Badge>
        </div>

        {/* Client name */}
        <p className="font-medium text-sm truncate mb-1">
          {appointment.client?.name || "Cliente não informado"}
        </p>

        {/* Service */}
        <p className="text-xs text-muted-foreground truncate mb-2">
          {appointment.service?.name || "Serviço não informado"}
        </p>

        {/* Quick actions */}
        {appointment.status === "pending" && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 flex-1 text-xs bg-success/10 text-success hover:bg-success/20"
              onClick={handleConfirm}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        )}

        {appointment.status === "confirmed" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full text-xs bg-primary/10 text-primary hover:bg-primary/20"
            onClick={handleComplete}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Concluir"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
        <CardContent className="p-0">
          <div className="flex">
            {/* Time column */}
            <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-primary/5 p-4">
              <span className="text-2xl font-bold text-primary">
                {formatInAppTz(new Date(appointment.scheduled_at), "HH:mm")}
              </span>
              <span className="text-xs text-muted-foreground">
                {appointment.service?.duration_minutes || appointment.duration_minutes} min
              </span>
            </div>

            {/* Main content */}
            <div className="flex flex-1 items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                {/* Client info */}
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">
                    {appointment.client?.name || "Cliente não informado"}
                  </span>
                  {appointment.client?.phone && (
                    <a
                      href={`tel:${appointment.client.phone}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      {appointment.client.phone}
                    </a>
                  )}
                </div>

                {/* Service info */}
                <div className="flex items-center gap-2 mb-1">
                  <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {appointment.service?.name || "Serviço não informado"}
                  </span>
                </div>

                {/* Professional */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {appointment.professional?.full_name || "Profissional não atribuído"}
                  </span>
                </div>

                {/* Notes */}
                {appointment.notes && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 p-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {appointment.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions column */}
              <div className="flex flex-col items-end gap-3 ml-4">
                {/* Price */}
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(appointment.price)}
                </span>

                {/* Status badge */}
                <Badge variant="outline" className={`${status.className}`}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {status.label}
                </Badge>

                {/* Quick actions based on status */}
                <div className="flex items-center gap-2">
                  {appointment.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-success/30 bg-success/10 text-success hover:bg-success/20"
                        onClick={handleConfirm}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Confirmar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={isUpdating}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {appointment.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="gradient-primary text-primary-foreground"
                      onClick={handleComplete}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Concluir
                        </>
                      )}
                    </Button>
                  )}

                  {/* More options menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange("pending")}
                        disabled={appointment.status === "pending"}
                      >
                        <Clock className="mr-2 h-4 w-4 text-warning" />
                        Marcar como Pendente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleConfirm}
                        disabled={appointment.status === "confirmed"}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-info" />
                        Confirmar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleComplete}
                        disabled={appointment.status === "completed"}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                        Marcar como Concluído
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowCancelDialog(true)}
                        className="text-destructive focus:text-destructive"
                        disabled={appointment.status === "cancelled"}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar Agendamento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de{" "}
              <strong>{appointment.client?.name}</strong> para{" "}
              <strong>
                {formatInAppTz(appointment.scheduled_at, "dd/MM/yyyy 'às' HH:mm")}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cancelar Agendamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
