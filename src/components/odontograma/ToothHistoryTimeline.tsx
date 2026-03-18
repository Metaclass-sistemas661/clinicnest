/**
 * ToothHistoryTimeline — Histórico de alterações de um dente (F2 - Audit Trail UI)
 *
 * Exibe timeline de mudanças no dente, consumindo a RPC get_tooth_history.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { TOOTH_CONDITIONS } from "./odontogramConstants";
import { format } from "date-fns";

interface HistoryEntry {
  id: string;
  previous_condition: string | null;
  new_condition: string | null;
  previous_surfaces: string[] | null;
  new_surfaces: string[] | null;
  change_reason: string | null;
  changed_at: string;
  changed_by: string;
  notes: string | null;
}

interface Props {
  odontogramId: string;
  toothNumber: number;
}

export function ToothHistoryTimeline({ odontogramId, toothNumber }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [odontogramId, toothNumber]);

  const loadHistory = async () => {
    try {
      const { data, error } = await (supabase.rpc as any)("get_tooth_history", {
        p_odontogram_id: odontogramId,
        p_tooth_number: toothNumber,
      });
      if (error) throw error;
      setEntries((data ?? []) as HistoryEntry[]);
    } catch (err) {
      logger.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  const conditionLabel = (c: string | null) =>
    c ? TOOTH_CONDITIONS.find((t) => t.value === c)?.label ?? c : "—";

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span className="text-sm text-muted-foreground">Carregando histórico...</span>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Nenhuma alteração registrada para o dente {toothNumber}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4" />
          Histórico — Dente {toothNumber}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3 pb-4 relative">
              {/* Timeline line */}
              {idx < entries.length - 1 && (
                <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
              )}

              {/* Dot */}
              <div className="mt-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex-shrink-0 z-10" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm")}
                </p>

                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {conditionLabel(entry.previous_condition)}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge className="text-xs">
                    {conditionLabel(entry.new_condition)}
                  </Badge>
                </div>

                {entry.new_surfaces && entry.new_surfaces.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Faces: {entry.new_surfaces.join(", ")}
                  </p>
                )}

                {entry.change_reason && (
                  <p className="text-xs italic text-muted-foreground mt-0.5">
                    "{entry.change_reason}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
