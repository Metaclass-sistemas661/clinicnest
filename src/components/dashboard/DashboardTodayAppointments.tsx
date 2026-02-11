import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import type { Appointment } from "@/types/database";

type DashboardTodayAppointmentsProps = {
  appointments: Appointment[];
  isAdmin: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
};

export const DashboardTodayAppointments = memo(function DashboardTodayAppointments({
  appointments,
  isAdmin,
  getStatusBadge,
}: DashboardTodayAppointmentsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">
            {isAdmin ? "Agenda de Hoje" : "Meus agendamentos hoje"}
          </CardTitle>
          <CardDescription>
            {formatInAppTz(new Date(), "EEEE, d 'de' MMMM")}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/agenda">Ver tudo</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {isAdmin ? "Nenhum agendamento para hoje" : "Nenhum agendamento seu para hoje"}
            </p>
            <Button variant="link" asChild className="mt-2">
              <Link to="/agenda">Criar agendamento</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {appointments.slice(0, 5).map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 transition-colors hover:bg-muted/50 gap-2 sm:gap-4"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <Clock className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">
                      {appointment.client?.name || "Cliente não informado"}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {appointment.service?.name} •{" "}
                      {formatInAppTz(appointment.scheduled_at, "HH:mm")}
                    </p>
                  </div>
                </div>
                <div className="self-end sm:self-auto">
                  {getStatusBadge(appointment.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
