import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import type { Appointment } from "@/types/database";

type DashboardNextAppointmentCardProps = {
  nextAppointment: Appointment;
  getStatusBadge: (status: string) => React.ReactNode;
};

export const DashboardNextAppointmentCard = memo(function DashboardNextAppointmentCard({
  nextAppointment,
  getStatusBadge,
}: DashboardNextAppointmentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Próximo atendimento</CardTitle>
        <CardDescription>
          Seu próximo agendamento de hoje
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm md:text-base truncate">
                {nextAppointment.client?.name || "Cliente não informado"}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {nextAppointment.service?.name} •{" "}
                {formatInAppTz(nextAppointment.scheduled_at, "HH:mm")}
              </p>
            </div>
          </div>
          <div className="self-end sm:self-auto">
            {getStatusBadge(nextAppointment.status)}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="mt-4">
          <Link to="/agenda">Ver agenda</Link>
        </Button>
      </CardContent>
    </Card>
  );
});
