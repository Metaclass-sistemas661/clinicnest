import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PendingItem {
  id: string;
  procedure_name: string;
  procedure_code: string | null;
  tooth_number: number | null;
  surface: string | null;
  plan_title: string;
}

interface Props {
  patientId: string;
  tenantId: string;
  procedures: { id: string; name: string }[];
  onSelectProcedure: (procedureId: string) => void;
}

/**
 * Shows pending treatment plan items for a patient when creating an appointment.
 * Helps the professional pick the next procedure from the active plan.
 */
export function PendingPlanItemsSuggestion({ patientId, tenantId, procedures, onSelectProcedure }: Props) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId || !tenantId) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Fetch pending items from active treatment plans
        const { data, error } = await supabase
          .from("treatment_plan_items" as never)
          .select("id, procedure_name, procedure_code, tooth_number, surface, treatment_plans!inner(title, status, tenant_id, client_id)")
          .eq("status", "pendente")
          .order("sort_order");

        if (error || !data || cancelled) return;

        // Filter by patient and tenant (RLS already filters tenant, but double-check client)
        const filtered = (data as any[])
          .filter((item: any) => {
            const plan = item.treatment_plans;
            return (
              plan &&
              plan.client_id === patientId &&
              plan.tenant_id === tenantId &&
              (plan.status === "aprovado" || plan.status === "em_andamento")
            );
          })
          .map((item: any) => ({
            id: item.id,
            procedure_name: item.procedure_name,
            procedure_code: item.procedure_code,
            tooth_number: item.tooth_number,
            surface: item.surface,
            plan_title: item.treatment_plans?.title || "Plano",
          }));

        if (!cancelled) setItems(filtered);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [patientId, tenantId]);

  if (loading || items.length === 0) return null;

  // Match pending items to available procedures by name
  const matchProcedure = (itemName: string) => {
    const normalized = itemName.toLowerCase().trim();
    return procedures.find((p) => p.name.toLowerCase().trim() === normalized)?.id;
  };

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-300">
        <ClipboardList className="h-4 w-4" />
        Procedimentos pendentes do plano
      </div>
      <div className="space-y-1">
        {items.slice(0, 5).map((item) => {
          const matchedId = matchProcedure(item.procedure_name);
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "w-full flex items-center justify-between p-2 rounded text-sm text-left transition-colors",
                matchedId
                  ? "hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
                  : "opacity-60 cursor-default"
              )}
              onClick={() => matchedId && onSelectProcedure(matchedId)}
              disabled={!matchedId}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium truncate">{item.procedure_name}</span>
                {item.tooth_number && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    D{item.tooth_number}{item.surface ? `/${item.surface}` : ""}
                  </Badge>
                )}
              </div>
              {matchedId && <ChevronRight className="h-3.5 w-3.5 text-teal-600 shrink-0" />}
            </button>
          );
        })}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground pl-2">
            +{items.length - 5} procedimento(s) pendente(s)
          </p>
        )}
      </div>
    </div>
  );
}
