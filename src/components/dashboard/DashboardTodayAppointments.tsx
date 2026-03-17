import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, Calendar, UserRound } from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import type { Appointment } from "@/types/database";

type DashboardTodayAppointmentsProps = {
  appointments: Appointment[];
  isAdmin: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
};

const statusDot: Record<string, string> = {
  pending:   "bg-amber-400",
  confirmed: "bg-teal-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const statusTime: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-400 border-red-200 line-through opacity-60",
};

export const DashboardTodayAppointments = memo(function DashboardTodayAppointments({
  appointments,
  isAdmin,
  getStatusBadge,
}: DashboardTodayAppointmentsProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
            <Calendar className="h-4 w-4 text-teal-600" />
          </div>
          <CardTitle className="text-base font-semibold">
            {isAdmin ? "Agenda de hoje" : "Meus atendimentos hoje"}
          </CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 text-xs">
          <Link to="/agenda" data-tour="dashboard-today-appointments-view-all">Ver tudo →</Link>
        </Button>
      </CardHeader>

      <CardContent className="flex-1">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
              <Calendar className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {isAdmin ? "Nenhuma consulta hoje" : "Nenhum atendimento seu hoje"}
            </p>
            <Button variant="link" asChild className="mt-2 h-auto p-0 text-teal-600 text-xs">
              <Link to="/agenda" data-tour="dashboard-today-appointments-create">+ Criar agendamento</Link>
            </Button>
          </div>
        ) : (
          <div className="relative space-y-1">
            {/* Linha vertical da timeline */}
            <div className="absolute left-[1.05rem] top-3 bottom-3 w-px bg-border" />

            {appointments.slice(0, 6).map((appointment) => {
              const st = appointment.status || "pending";
              return (
                <div key={appointment.id} className="relative flex gap-3 pl-1 py-1.5 group">
                  {/* Dot na linha */}
                  <div className={`relative z-10 mt-2.5 h-3 w-3 shrink-0 rounded-full border-2 border-background shadow-sm ${statusDot[st] ?? "bg-gray-400"}`} />

                  {/* Card do agendamento */}
                  <div className="flex-1 min-w-0 rounded-xl border bg-card px-3 py-2.5 transition-all group-hover:shadow-sm group-hover:border-teal-200/80">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Horário + nome */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${statusTime[st] ?? "bg-muted text-muted-foreground border-border"}`}>
                            {formatInAppTz(appointment.scheduled_at, "HH:mm")}
                          </span>
                          <p className="truncate text-sm font-semibold text-foreground">
                            {appointment.patient?.name || "Paciente não informado"}
                          </p>
                        </div>

                        {/* Procedimento + profissional */}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {appointment.procedure?.name && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Stethoscope className="h-3 w-3 shrink-0" />
                              <span className="truncate">{appointment.procedure.name}</span>
                            </span>
                          )}
                          {isAdmin && appointment.professional?.full_name && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <UserRound className="h-3 w-3 shrink-0" />
                              <span className="truncate">{appointment.professional.full_name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 self-center">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {appointments.length > 6 && (
              <div className="relative flex gap-3 pl-1 py-1">
                <div className="relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full bg-muted-foreground/30" />
                <p className="text-xs text-muted-foreground py-1">
                  +{appointments.length - 6} agendamento{appointments.length - 6 > 1 ? "s" : ""} •{" "}
                  <Link to="/agenda" className="text-teal-600 hover:underline font-medium">ver agenda completa</Link>
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
