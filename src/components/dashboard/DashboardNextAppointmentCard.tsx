import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Stethoscope, ArrowRight } from "lucide-react";
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
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-teal-600 to-cyan-500 p-5 text-white">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-teal-100" />
          <span className="text-sm font-medium text-teal-100">Próximo atendimento</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Stethoscope className="h-7 w-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold leading-tight">
              {nextAppointment.patient?.name || "Paciente não informado"}
            </p>
            {nextAppointment.procedure?.name && (
              <p className="mt-0.5 truncate text-sm text-teal-100">
                {nextAppointment.procedure.name}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums text-3xl font-bold leading-none">
              {formatInAppTz(nextAppointment.scheduled_at, "HH:mm")}
            </p>
            <p className="mt-1 text-xs text-teal-100">hoje</p>
          </div>
        </div>
      </div>
      <CardContent className="flex items-center justify-between p-3">
        {getStatusBadge(nextAppointment.status)}
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
        >
          <Link to="/agenda" data-tour="dashboard-next-appointment-view-agenda">
            Ver agenda <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
