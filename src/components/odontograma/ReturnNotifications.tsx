/**
 * ReturnNotifications — Agendamento automático de retorno perio (F18)
 *
 * Verifica diagnóstico periodontal e sugere data de retorno baseado na severidade.
 * Registra notificação pendente para acompanhamento.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/** Intervalo de retorno (meses) baseado na severidade do diagnóstico */
const RETURN_INTERVALS: Record<string, number> = {
  healthy: 12,
  gingivitis: 6,
  mild_periodontitis: 4,
  moderate_periodontitis: 3,
  severe_periodontitis: 2,
  aggressive_periodontitis: 1,
};

const DIAGNOSIS_LABELS: Record<string, string> = {
  healthy: "Saudável",
  gingivitis: "Gengivite",
  mild_periodontitis: "Periodontite Leve",
  moderate_periodontitis: "Periodontite Moderada",
  severe_periodontitis: "Periodontite Severa",
  aggressive_periodontitis: "Periodontite Agressiva",
};

interface Props {
  patientId: string;
  tenantId: string;
  diagnosis: string;
  periogramId?: string;
  onScheduled?: () => void;
}

export function ReturnNotifications({
  patientId,
  tenantId,
  diagnosis,
  periogramId,
  onScheduled,
}: Props) {
  const months = RETURN_INTERVALS[diagnosis] ?? 6;
  const suggestedDate = new Date();
  suggestedDate.setMonth(suggestedDate.getMonth() + months);

  const [returnDate, setReturnDate] = useState(suggestedDate.toISOString().split("T")[0]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const handleSchedule = async () => {
    setScheduling(true);
    try {
      const { error } = await supabase.from("notifications" as any).insert({
        tenant_id: tenantId,
        patient_id: patientId,
        type: "dental_return",
        scheduled_date: returnDate,
        message: `Retorno periodontal - ${DIAGNOSIS_LABELS[diagnosis] ?? diagnosis}`,
        metadata: { periogram_id: periogramId, diagnosis },
        status: "pending",
      });
      if (error) throw error;
      toast.success("Retorno agendado com sucesso");
      setScheduled(true);
      onScheduled?.();
    } catch (err) {
      logger.error("Erro ao agendar retorno:", err);
      toast.error("Erro ao agendar retorno");
    } finally {
      setScheduling(false);
    }
  };

  if (scheduled) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
        <CardContent className="py-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Retorno agendado</p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {new Date(returnDate).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4" />
          Agendamento de Retorno
        </CardTitle>
        <CardDescription className="text-xs">
          Baseado no diagnóstico:{" "}
          <Badge variant="outline" className="text-xs">
            {DIAGNOSIS_LABELS[diagnosis] ?? diagnosis}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Recomendação: retorno em <strong>{months} {months === 1 ? "mês" : "meses"}</strong>
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Data de retorno</Label>
            <Input
              type="date"
              value={returnDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleSchedule} disabled={scheduling}>
            <Calendar className="h-4 w-4 mr-1" />
            {scheduling ? "Agendando..." : "Agendar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
