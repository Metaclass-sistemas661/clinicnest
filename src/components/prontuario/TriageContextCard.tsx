import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Activity,
  Thermometer,
  Wind,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

type Priority = "emergencia" | "urgente" | "pouco_urgente" | "nao_urgente";

const priorityConfig: Record<Priority, { label: string; color: string; icon: React.ElementType }> = {
  emergencia: { label: "Emergência", color: "bg-red-500/20 text-red-600 border-red-500/30", icon: AlertTriangle },
  urgente: { label: "Urgente", color: "bg-orange-500/20 text-orange-600 border-orange-500/30", icon: AlertTriangle },
  pouco_urgente: { label: "Pouco Urgente", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30", icon: Clock },
  nao_urgente: { label: "Não Urgente", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
};

export interface TriageData {
  id: string;
  priority: Priority;
  triaged_at: string;
  performed_by: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  chief_complaint: string;
  pain_scale: number | null;
  allergies: string | null;
  current_medications: string | null;
  medical_history: string | null;
  notes: string | null;
}

export function TriageContextCard({ triage }: { triage: TriageData }) {
  const config = priorityConfig[triage.priority];
  const PIcon = config.icon;

  const imc = () => {
    if (!triage.weight_kg || !triage.height_cm) return null;
    const h = triage.height_cm / 100;
    return (triage.weight_kg / (h * h)).toFixed(1);
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Triagem desta Visita</h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${config.color} flex items-center gap-1 text-xs`}>
            <PIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(triage.triaged_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-background px-3 py-2 text-sm">
        <span className="font-medium">Queixa: </span>{triage.chief_complaint}
        {triage.pain_scale != null && (
          <span className="ml-2 text-muted-foreground">(Dor: {triage.pain_scale}/10)</span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {triage.blood_pressure_systolic != null && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <Heart className="h-3 w-3 text-red-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">PA</p>
            <p className="text-xs font-semibold">{triage.blood_pressure_systolic}/{triage.blood_pressure_diastolic}</p>
          </div>
        )}
        {triage.heart_rate != null && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <Activity className="h-3 w-3 text-pink-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">FC</p>
            <p className="text-xs font-semibold">{triage.heart_rate} bpm</p>
          </div>
        )}
        {triage.temperature != null && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <Thermometer className="h-3 w-3 text-orange-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Temp</p>
            <p className="text-xs font-semibold">{triage.temperature}°C</p>
          </div>
        )}
        {triage.oxygen_saturation != null && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <Wind className="h-3 w-3 text-blue-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">SpO₂</p>
            <p className="text-xs font-semibold">{triage.oxygen_saturation}%</p>
          </div>
        )}
        {triage.respiratory_rate != null && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <Wind className="h-3 w-3 text-teal-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">FR</p>
            <p className="text-xs font-semibold">{triage.respiratory_rate} irpm</p>
          </div>
        )}
        {imc() && (
          <div className="rounded-lg border bg-background p-2 text-center">
            <User className="h-3 w-3 text-purple-500 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">IMC</p>
            <p className="text-xs font-semibold">{imc()}</p>
          </div>
        )}
      </div>

      {(triage.allergies || triage.current_medications || triage.medical_history) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {triage.allergies && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5">
              <p className="font-medium text-destructive mb-0.5">Alergias</p>
              <p className="text-muted-foreground">{triage.allergies}</p>
            </div>
          )}
          {triage.current_medications && (
            <div className="rounded-lg border px-2 py-1.5">
              <p className="font-medium mb-0.5">Medicamentos</p>
              <p className="text-muted-foreground">{triage.current_medications}</p>
            </div>
          )}
          {triage.medical_history && (
            <div className="rounded-lg border px-2 py-1.5">
              <p className="font-medium mb-0.5">Histórico</p>
              <p className="text-muted-foreground">{triage.medical_history}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
