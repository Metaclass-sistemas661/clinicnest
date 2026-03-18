/**
 * UnifiedDentalRecord — Prontuário odontológico unificado (F19)
 *
 * Timeline consolidando odontograma, periograma, planos de tratamento, prescrições
 * e anamnese em uma visão cronológica única.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smile, Activity, ClipboardList, Pill, FileText,
  Calendar, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface TimelineEvent {
  id: string;
  type: "odontogram" | "periogram" | "treatment_plan" | "prescription";
  title: string;
  date: string;
  summary: string;
  icon: typeof Smile;
  color: string;
}

interface Props {
  patientId: string;
}

export function UnifiedDentalRecord({ patientId }: Props) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!patientId || !profile?.tenant_id) return;
    loadRecords();
  }, [patientId, profile?.tenant_id]);

  const loadRecords = async () => {
    try {
      const tenantId = profile!.tenant_id;
      const all: TimelineEvent[] = [];

      // Odontograms
      const { data: odontograms } = await supabase
        .from("odontograms")
        .select("id, created_at, notes")
        .eq("tenant_id", tenantId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      (odontograms ?? []).forEach((o: any) => {
        all.push({
          id: `o-${o.id}`,
          type: "odontogram",
          title: "Odontograma",
          date: o.created_at,
          summary: o.notes || "Registro odontograma",
          icon: Smile,
          color: "text-blue-600",
        });
      });

      // Periograms
      const { data: periograms } = await supabase
        .from("periograms")
        .select("id, created_at, diagnosis")
        .eq("tenant_id", tenantId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      (periograms ?? []).forEach((p: any) => {
        all.push({
          id: `p-${p.id}`,
          type: "periogram",
          title: "Periograma",
          date: p.created_at,
          summary: p.diagnosis || "Avaliação periodontal",
          icon: Activity,
          color: "text-purple-600",
        });
      });

      // Treatment Plans
      const { data: plans } = await supabase
        .from("treatment_plans")
        .select("id, created_at, title, status")
        .eq("tenant_id", tenantId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      (plans ?? []).forEach((t: any) => {
        all.push({
          id: `t-${t.id}`,
          type: "treatment_plan",
          title: t.title || "Plano de Tratamento",
          date: t.created_at,
          summary: `Status: ${t.status}`,
          icon: ClipboardList,
          color: "text-amber-600",
        });
      });

      // Prescriptions
      const { data: prescriptions } = await supabase
        .from("dental_prescriptions" as any)
        .select("id, prescription_date, diagnosis")
        .eq("tenant_id", tenantId)
        .eq("patient_id", patientId)
        .order("prescription_date", { ascending: false });

      (prescriptions ?? []).forEach((rx: any) => {
        all.push({
          id: `rx-${rx.id}`,
          type: "prescription",
          title: "Prescrição",
          date: rx.prescription_date,
          summary: rx.diagnosis || "Prescrição odontológica",
          icon: Pill,
          color: "text-green-600",
        });
      });

      // Sort all by date desc
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(all);
    } catch (err) {
      logger.error("Erro ao carregar prontuário unificado:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (activeTab === "all") return events;
    return events.filter((e) => e.type === activeTab);
  }, [events, activeTab]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [events]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span className="text-muted-foreground">Carregando prontuário...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Prontuário Odontológico Unificado
        </CardTitle>
        <CardDescription>
          {events.length} registro{events.length !== 1 ? "s" : ""} encontrado{events.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              Todos ({events.length})
            </TabsTrigger>
            <TabsTrigger value="odontogram">
              Odontograma ({typeCounts["odontogram"] ?? 0})
            </TabsTrigger>
            <TabsTrigger value="periogram">
              Periograma ({typeCounts["periogram"] ?? 0})
            </TabsTrigger>
            <TabsTrigger value="treatment_plan">
              Planos ({typeCounts["treatment_plan"] ?? 0})
            </TabsTrigger>
            <TabsTrigger value="prescription">
              Prescrições ({typeCounts["prescription"] ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum registro encontrado nesta categoria.
              </p>
            ) : (
              <div className="space-y-0 relative">
                {filtered.map((event, idx) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="flex gap-3 pb-4 relative">
                      {idx < filtered.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                      )}
                      <div
                        className={`mt-1 h-8 w-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 bg-background ${event.color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{event.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {event.type === "odontogram" && "Odontograma"}
                            {event.type === "periogram" && "Periograma"}
                            {event.type === "treatment_plan" && "Plano"}
                            {event.type === "prescription" && "Prescrição"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.date), "dd/MM/yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {event.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
