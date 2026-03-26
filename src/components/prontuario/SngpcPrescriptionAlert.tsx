/**
 * Badge SNGPC — Exibe alertas de medicamentos controlados.
 * Usado dentro do ReceitaDrawer para indicar requisitos ANVISA.
 */
import { AlertTriangle, Shield, ShieldAlert, FileText, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  detectControlledInText,
  validateSngpcPrescription,
  type SngpcClassification,
} from "@/lib/sngpc-validation";

// ── Inline Medication Badge ─────────────────────────────────────

interface MedBadgeProps {
  medication: string;
  classification: SngpcClassification;
}

function SngpcMedBadge({ medication, classification }: MedBadgeProps) {
  const colorMap: Record<string, string> = {
    amarela: "border-yellow-400 text-yellow-800 bg-yellow-50",
    azul: "border-blue-400 text-blue-800 bg-blue-50",
    branca: "border-gray-400 text-gray-800 bg-gray-50",
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${colorMap[classification.recipeColor] || colorMap.branca}`}
      >
        {classification.lista}
      </Badge>
      <span className="font-medium">{medication}</span>
      <span className="text-muted-foreground">— {classification.recipeType}</span>
    </div>
  );
}

// ── Main SNGPC Alert ────────────────────────────────────────────

interface SngpcPrescriptionAlertProps {
  prescriptionText: string;
  prescriptionType: "simples" | "especial" | "controle_especial";
  hasCRM: boolean;
  hasPatientCPF?: boolean;
  className?: string;
}

export function SngpcPrescriptionAlert({
  prescriptionText,
  prescriptionType,
  hasCRM,
  hasPatientCPF = false,
  className,
}: SngpcPrescriptionAlertProps) {
  const detected = detectControlledInText(prescriptionText);

  if (detected.length === 0) return null;

  const medications = detected.map((d) => d.medication);
  const validation = validateSngpcPrescription({
    medications,
    prescriptionType,
    hasCRM,
    hasPatientCPF,
    hasPatientAddress: false, // Simplificação — não temos esse dado aqui
  });

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className={className}>
      <Alert variant={hasErrors ? "destructive" : "default"} className="py-3">
        <div className="flex items-center gap-2 mb-2">
          {hasErrors ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Shield className="h-4 w-4 text-blue-600" />
          )}
          <AlertTitle className="text-xs font-semibold m-0">
            SNGPC — {detected.length} medicamento{detected.length > 1 ? "s" : ""} controlado{detected.length > 1 ? "s" : ""} detectado{detected.length > 1 ? "s" : ""}
          </AlertTitle>
        </div>
        <AlertDescription className="space-y-2">
          {/* Detected medications */}
          <div className="space-y-1">
            {detected.map((d, i) => (
              <SngpcMedBadge key={i} medication={d.medication} classification={d.classification} />
            ))}
          </div>

          {/* Errors */}
          {hasErrors && (
            <div className="space-y-1 pt-1">
              {validation.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                  <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="space-y-1 pt-1">
              {validation.warnings.map((warn, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  {warn}
                </div>
              ))}
            </div>
          )}

          {/* Recipe requirement summary */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t mt-2">
            <FileText className="h-3 w-3" />
            Tipo necessário: {validation.classification.recipeType} · Validade máx: {validation.classification.maxValidityDays} dias
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
