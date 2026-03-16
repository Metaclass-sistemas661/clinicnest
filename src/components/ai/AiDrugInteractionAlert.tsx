import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, ShieldAlert, Shield, Info, Loader2, Pill, ArrowRightLeft, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────

interface Interaction {
  drugs: string[];
  severity: "critical" | "major" | "moderate" | "minor";
  description: string;
  recommendation: string;
}

interface AllergyAlert {
  drug: string;
  allergen: string;
  severity: "critical" | "major" | "moderate";
  description: string;
  alternative: string;
}

interface DrugCheckResult {
  interactions: Interaction[];
  allergy_alerts: AllergyAlert[];
  contraindications: { description: string; severity: string }[];
  dose_alerts: { description: string; severity: string }[];
  safe_count?: number;
  checked_pairs?: number;
}

interface Props {
  prescriptions: string;
  currentMedications?: string;
  allergies?: string;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function parseMedsList(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/[\n;,]+/)
    .map((s) => s.replace(/[-–—]\s*.*/g, "").trim())
    .filter((s) => s.length > 1);
}

const severityConfig = {
  critical: { icon: ShieldAlert, color: "text-red-700 bg-red-50 border-red-300", badge: "bg-red-600 text-white" },
  major: { icon: AlertTriangle, color: "text-orange-700 bg-orange-50 border-orange-300", badge: "bg-orange-600 text-white" },
  moderate: { icon: Info, color: "text-amber-700 bg-amber-50 border-amber-300", badge: "bg-amber-600 text-white" },
  minor: { icon: Shield, color: "text-blue-700 bg-blue-50 border-blue-300", badge: "bg-blue-600 text-white" },
};

// ── Component ───────────────────────────────────────────────────

export function AiDrugInteractionAlert({ prescriptions, currentMedications, allergies, className }: Props) {
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInteractions = useCallback(async () => {
    const prescribed = parseMedsList(prescriptions);
    if (prescribed.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await supabase.functions.invoke("ai-drug-interactions", {
        body: {
          prescribed_medications: prescribed,
          current_medications: parseMedsList(currentMedications || ""),
          allergies: parseMedsList(allergies || ""),
        },
      });

      if (resp.error) throw resp.error;
      setResult(resp.data as DrugCheckResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar interações");
    } finally {
      setLoading(false);
    }
  }, [prescriptions, currentMedications, allergies]);

  const prescribed = parseMedsList(prescriptions);
  if (prescribed.length === 0) return null;

  const totalAlerts =
    (result?.interactions?.length ?? 0) +
    (result?.allergy_alerts?.length ?? 0) +
    (result?.contraindications?.length ?? 0) +
    (result?.dose_alerts?.length ?? 0);

  const hasCritical =
    result?.interactions?.some((i) => i.severity === "critical") ||
    result?.allergy_alerts?.some((a) => a.severity === "critical");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={result && totalAlerts === 0 ? "outline" : hasCritical ? "destructive" : "outline"}
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={checkInteractions}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Verificando...</>
          ) : (
            <><ArrowRightLeft className="h-3 w-3" /> Verificar Interações ({prescribed.length} med.)</>
          )}
        </Button>
        {result && totalAlerts === 0 && (
          <Badge variant="outline" className="text-[10px] h-5 text-green-700 border-green-300 bg-green-50 gap-1">
            <Check className="h-3 w-3" /> Sem interações detectadas
          </Badge>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && totalAlerts > 0 && (
        <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">
              {totalAlerts} alerta{totalAlerts > 1 ? "s" : ""} encontrado{totalAlerts > 1 ? "s" : ""}
            </span>
          </div>

          {/* Allergy alerts first (most dangerous) */}
          {result.allergy_alerts?.map((alert, i) => {
            const cfg = severityConfig[alert.severity] || severityConfig.moderate;
            const Icon = cfg.icon;
            return (
              <div key={`allergy-${i}`} className={cn("flex items-start gap-2 p-2.5 rounded-md border text-xs", cfg.color)}>
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{alert.drug} × {alert.allergen}</span>
                    <Badge className={cn("text-[9px] h-4", cfg.badge)}>ALERGIA</Badge>
                  </div>
                  <p>{alert.description}</p>
                  {alert.alternative && (
                    <p className="font-medium">Alternativa: {alert.alternative}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Drug-drug interactions */}
          {result.interactions?.map((inter, i) => {
            const cfg = severityConfig[inter.severity] || severityConfig.moderate;
            const Icon = cfg.icon;
            return (
              <div key={`inter-${i}`} className={cn("flex items-start gap-2 p-2.5 rounded-md border text-xs", cfg.color)}>
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{inter.drugs.join(" × ")}</span>
                    <Badge className={cn("text-[9px] h-4", cfg.badge)}>
                      {inter.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p>{inter.description}</p>
                  <p className="font-medium">Recomendação: {inter.recommendation}</p>
                </div>
              </div>
            );
          })}

          {/* Contraindications */}
          {result.contraindications?.map((c, i) => (
            <div key={`contra-${i}`} className="flex items-start gap-2 p-2 rounded-md border text-xs text-red-700 bg-red-50 border-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{c.description}</span>
            </div>
          ))}

          {/* Dose alerts */}
          {result.dose_alerts?.map((d, i) => (
            <div key={`dose-${i}`} className="flex items-start gap-2 p-2 rounded-md border text-xs text-amber-700 bg-amber-50 border-amber-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{d.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
