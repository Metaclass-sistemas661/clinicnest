/**
 * Alertas de anormalidade em sinais vitais.
 * Mostra badges inline quando valores estão fora dos ranges normais.
 * Puramente frontend — sem chamadas de API.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Vitals {
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  pain_scale: number | null;
}

interface Alert {
  label: string;
  severity: "warning" | "critical";
  message: string;
}

const RANGES = {
  blood_pressure_systolic: { low: 90, high: 140, criticalLow: 70, criticalHigh: 180 },
  blood_pressure_diastolic: { low: 60, high: 90, criticalLow: 40, criticalHigh: 120 },
  heart_rate: { low: 50, high: 100, criticalLow: 40, criticalHigh: 150 },
  respiratory_rate: { low: 12, high: 20, criticalLow: 8, criticalHigh: 30 },
  temperature: { low: 35.5, high: 37.8, criticalLow: 34.0, criticalHigh: 39.5 },
  oxygen_saturation: { low: 95, high: 100, criticalLow: 90, criticalHigh: 101 },
  pain_scale: { low: 0, high: 3, criticalLow: -1, criticalHigh: 7 },
} as const;

const LABELS: Record<string, string> = {
  blood_pressure_systolic: "PAS",
  blood_pressure_diastolic: "PAD",
  heart_rate: "FC",
  respiratory_rate: "FR",
  temperature: "Temp",
  oxygen_saturation: "SpO₂",
  pain_scale: "Dor",
};

function checkVitals(vitals: Vitals): Alert[] {
  const alerts: Alert[] = [];

  for (const [key, range] of Object.entries(RANGES)) {
    const value = vitals[key as keyof Vitals];
    if (value == null) continue;

    const label = LABELS[key] || key;

    if (key === "oxygen_saturation") {
      if (value < range.criticalLow) {
        alerts.push({ label, severity: "critical", message: `${label} ${value}% — hipoxemia grave` });
      } else if (value < range.low) {
        alerts.push({ label, severity: "warning", message: `${label} ${value}% — abaixo do normal` });
      }
    } else if (key === "pain_scale") {
      if (value >= range.criticalHigh) {
        alerts.push({ label, severity: "critical", message: `Dor ${value}/10 — dor intensa` });
      } else if (value > range.high) {
        alerts.push({ label, severity: "warning", message: `Dor ${value}/10 — dor moderada` });
      }
    } else {
      if (value < range.criticalLow || value > range.criticalHigh) {
        const dir = value < range.criticalLow ? "muito baixo" : "muito alto";
        alerts.push({ label, severity: "critical", message: `${label} ${value} — ${dir}` });
      } else if (value < range.low || value > range.high) {
        const dir = value < range.low ? "baixo" : "alto";
        alerts.push({ label, severity: "warning", message: `${label} ${value} — ${dir}` });
      }
    }
  }

  return alerts;
}

interface Props {
  vitals: Vitals;
  className?: string;
}

export function VitalsAbnormalityAlert({ vitals, className }: Props) {
  const alerts = checkVitals(vitals);
  if (alerts.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        {alerts.map((alert, i) => (
          <Badge
            key={i}
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${
              alert.severity === "critical"
                ? "border-red-400 text-red-700 bg-red-50"
                : "border-amber-400 text-amber-700 bg-amber-50"
            }`}
            title={alert.message}
          >
            {alert.message}
          </Badge>
        ))}
      </div>
    </div>
  );
}
