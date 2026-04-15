import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  AlertTriangle,
  Clock,
  FileText,
  Pill,
  CalendarDays,
  Heart,
  Stethoscope,
  TrendingDown,
} from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { cn } from "@/lib/utils";
import { formatInAppTz } from "@/lib/date";
import type { Appointment, Patient } from "@/types/database";

interface NextPatientDashboardProps {
  appointment: Appointment;
  className?: string;
}

interface LastRecord {
  id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  cid_code: string | null;
  created_at: string;
}

interface PromSummary {
  severity: string | null;
  total_score: number | null;
  max_score: number | null;
  created_at: string;
}

function calculateAge(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

export function NextPatientDashboard({ appointment, className }: NextPatientDashboardProps) {
  const patient = appointment.patient;
  const patientId = appointment.patient_id;

  // Last prontuário
  const { data: lastRecord, isLoading: loadingRecord } = useQuery({
    queryKey: ["next-patient-last-record", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await api
        .from("medical_records")
        .select("id, chief_complaint, diagnosis, treatment_plan, cid_code, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data as LastRecord | null;
    },
    enabled: !!patientId,
  });

  // Upcoming appointments count
  const { data: futureCount } = useQuery({
    queryKey: ["next-patient-future-apts", patientId],
    queryFn: async () => {
      if (!patientId) return 0;
      const { count } = await api
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .gt("scheduled_at", new Date().toISOString())
        .neq("id", appointment.id);
      return count || 0;
    },
    enabled: !!patientId,
  });

  // Latest PROM
  const { data: latestProm } = useQuery({
    queryKey: ["next-patient-prom", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await api
        .from("patient_proms" as never)
        .select("severity, total_score, max_score, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data as PromSummary | null;
    },
    enabled: !!patientId,
  });

  if (!patient) return null;

  const age = calculateAge(patient.date_of_birth);
  const hasAllergies = !!patient.allergies && patient.allergies.trim().length > 0;
  const promWorrisome = latestProm?.severity === "severe" || latestProm?.severity === "moderate";

  return (
    <Card className={cn("border-l-4 border-l-teal-500", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-teal-600" />
          Próximo Paciente
          <Badge variant="secondary" className="ml-auto text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {formatInAppTz(appointment.scheduled_at, "HH:mm")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Patient info */}
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-lg">{patient.name}</p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {age && <span>{age}</span>}
              {patient.cpf && <span>CPF: {patient.cpf}</span>}
              {patient.insurance_plan_id && (
                <Badge variant="outline" className="text-xs">Convênio</Badge>
              )}
            </div>
          </div>
          {(futureCount ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{futureCount} consulta{futureCount! > 1 ? "s" : ""} agendada{futureCount! > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Alerts */}
        {hasAllergies && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>Alergias:</strong> {patient.allergies}</span>
          </div>
        )}

        {promWorrisome && latestProm && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded text-sm border",
            latestProm.severity === "severe"
              ? "bg-destructive/10 border-destructive/20 text-destructive"
              : "bg-amber-50 border-amber-200 text-amber-700"
          )}>
            <TrendingDown className="h-4 w-4 shrink-0" />
            <span>
              <strong>PROMs:</strong> Paciente reportou bem-estar{" "}
              {latestProm.severity === "severe" ? "preocupante" : "em atenção"}{" "}
              ({latestProm.total_score}/{latestProm.max_score}) em{" "}
              {new Date(latestProm.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        {/* Last record summary */}
        {loadingRecord ? (
          <Skeleton className="h-20 w-full" />
        ) : lastRecord ? (
          <div className="space-y-2 p-3 rounded bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-teal-600" />
              Último Prontuário
              <span className="text-xs text-muted-foreground ml-auto">
                {formatInAppTz(lastRecord.created_at, "dd/MM/yyyy")}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {lastRecord.chief_complaint && (
                <div>
                  <span className="text-muted-foreground text-xs">Queixa:</span>
                  <p className="truncate">{lastRecord.chief_complaint}</p>
                </div>
              )}
              {lastRecord.diagnosis && (
                <div>
                  <span className="text-muted-foreground text-xs">Diagnóstico:</span>
                  <p className="truncate">{lastRecord.diagnosis}</p>
                </div>
              )}
              {lastRecord.treatment_plan && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground text-xs">Conduta:</span>
                  <p className="truncate">{lastRecord.treatment_plan}</p>
                </div>
              )}
              {lastRecord.cid_code && (
                <Badge variant="outline" className="text-xs w-fit">
                  CID: {lastRecord.cid_code}
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 rounded bg-muted/30">
            <Stethoscope className="h-4 w-4" />
            Primeira consulta — sem prontuário anterior
          </div>
        )}

        {/* Appointment details */}
        <div className="flex flex-wrap gap-2 text-xs">
          {appointment.procedure && (
            <Badge variant="outline" className="gap-1">
              <Pill className="h-3 w-3" />
              {appointment.procedure.name}
            </Badge>
          )}
          {appointment.consultation_type && (
            <Badge variant="outline" className="gap-1">
              {appointment.consultation_type === "return" ? "Retorno" :
               appointment.consultation_type === "first" ? "1ª Consulta" :
               appointment.consultation_type}
            </Badge>
          )}
          {appointment.notes && (
            <Badge variant="outline" className="gap-1 max-w-[300px] truncate">
              <CalendarDays className="h-3 w-3" />
              {appointment.notes}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
