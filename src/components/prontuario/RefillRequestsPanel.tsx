import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pill,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  User,
} from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { cn } from "@/lib/utils";

interface RefillRequest {
  id: string;
  patient_id: string;
  medication_name: string;
  reason: string | null;
  status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  patient: { name: string } | null;
}

export function RefillRequestsPanel() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["refill-requests", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data, error } = await api
        .from("prescription_refill_requests" as never)
        .select("id, patient_id, medication_name, reason, status, reviewer_notes, reviewed_at, created_at, patients:patient_id(name)")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((r: Record<string, unknown>) => ({
        ...r,
        patient: r.patients as { name: string } | null,
      })) as RefillRequest[];
    },
    enabled: !!profile?.tenant_id,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await api.auth.getUser();
      const { error } = await api
        .from("prescription_refill_requests" as never)
        .update({
          status,
          reviewer_id: user?.id,
          reviewer_notes: notes.trim() || null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "Renovação aprovada!" : "Pedido recusado.");
      setActiveId(null);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["refill-requests"] });
    },
    onError: (err) => toast.error("Erro ao processar", { description: normalizeError(err, "Não foi possível processar o pedido de renovação.") }),
  });

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  if (isLoading) {
    return <Card><CardContent className="py-4"><Skeleton className="h-32 w-full" /></CardContent></Card>;
  }

  if (!requests?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-teal-600" /> Pedidos de Renovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum pedido de renovação de receita.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Pill className="h-4 w-4 text-teal-600" />
          Pedidos de Renovação
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingRequests.length} pendente{pendingRequests.length > 1 ? "s" : ""}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pending */}
        {pendingRequests.map((req) => (
          <div key={req.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-sm">{req.medication_name}</span>
              </div>
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700">Pendente</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {req.patient?.name || "Paciente"}
              <span className="ml-2">
                {new Date(req.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {req.reason && <p className="text-sm text-muted-foreground">{req.reason}</p>}

            {activeId === req.id ? (
              <div className="space-y-2 pt-2 border-t">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas para o paciente (opcional)..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => reviewMutation.mutate({ id: req.id, status: "approved" })}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? <Spinner size="sm" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => reviewMutation.mutate({ id: req.id, status: "rejected" })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setNotes(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setActiveId(req.id)} className="gap-1">
                Revisar
              </Button>
            )}
          </div>
        ))}

        {/* Processed */}
        {processedRequests.slice(0, 5).map((req) => {
          const isApproved = req.status === "approved";
          return (
            <div key={req.id} className={cn("p-2 rounded border text-sm flex items-center gap-2",
              isApproved ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
            )}>
              {isApproved ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{req.medication_name}</span>
                <span className="text-xs text-muted-foreground ml-2">{req.patient?.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString("pt-BR") : ""}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
