import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VitalRecord {
  record_date: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight_kg: number | null;
  respiratory_rate: number | null;
}

interface Props {
  records: VitalRecord[];
  className?: string;
}

const VITAL_CONFIGS = [
  { key: "blood_pressure_systolic", label: "PA Sis", color: "#ef4444", unit: "mmHg" },
  { key: "blood_pressure_diastolic", label: "PA Dia", color: "#f97316", unit: "mmHg" },
  { key: "heart_rate", label: "FC", color: "#ec4899", unit: "bpm" },
  { key: "temperature", label: "Temp", color: "#f59e0b", unit: "°C" },
  { key: "oxygen_saturation", label: "SpO₂", color: "#3b82f6", unit: "%" },
  { key: "weight_kg", label: "Peso", color: "#8b5cf6", unit: "kg" },
  { key: "respiratory_rate", label: "FR", color: "#14b8a6", unit: "irpm" },
] as const;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-xs font-semibold mb-1.5">{label}</p>
      {payload.map((entry: any) => {
        const config = VITAL_CONFIGS.find((c) => c.key === entry.dataKey);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{config?.label}:</span>
            <span className="font-medium">{entry.value}{config?.unit ? ` ${config.unit}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export function VitalSignsChart({ records, className }: Props) {
  const chartData = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );
    return sorted.map((r) => ({
      date: format(new Date(r.record_date), "dd/MM/yy", { locale: ptBR }),
      blood_pressure_systolic: r.blood_pressure_systolic,
      blood_pressure_diastolic: r.blood_pressure_diastolic,
      heart_rate: r.heart_rate,
      temperature: r.temperature,
      oxygen_saturation: r.oxygen_saturation,
      weight_kg: r.weight_kg,
      respiratory_rate: r.respiratory_rate,
    }));
  }, [records]);

  const availableVitals = useMemo(() => {
    return VITAL_CONFIGS.filter((config) =>
      chartData.some((d) => (d as any)[config.key] != null)
    );
  }, [chartData]);

  if (chartData.length < 2 || availableVitals.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Dados insuficientes para exibir tendências.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            São necessários ao menos 2 prontuários com sinais vitais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Tendência de Sinais Vitais
          <Badge variant="outline" className="text-[10px] font-normal ml-auto">
            {chartData.length} registros
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                iconSize={8}
              />
              {availableVitals.map((config) => (
                <Line
                  key={config.key}
                  type="monotone"
                  dataKey={config.key}
                  name={config.label}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
