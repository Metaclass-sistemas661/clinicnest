import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { goalTypeLabels, periodLabels, type GoalType, type GoalPeriod } from "@/lib/goals";

interface GoalSuggestion {
  id: string;
  tenant_id: string;
  professional_id: string;
  name: string | null;
  goal_type: string;
  target_value: number;
  period: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  user_id?: string;
}

interface GoalSuggestionsAdminSectionProps {
  tenantId: string;
  professionals: Profile[];
  onApprovedOrRejected: () => void;
  /** Exibir seção mesmo quando não há sugestões pendentes */
  showEmptyState?: boolean;
}

export function GoalSuggestionsAdminSection({
  tenantId,
  professionals,
  onApprovedOrRejected,
  showEmptyState = false,
}: GoalSuggestionsAdminSectionProps) {
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ suggestion: GoalSuggestion; reason: string } | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from("goal_suggestions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSuggestions((data || []) as GoalSuggestion[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar sugestões");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchSuggestions();
  }, [tenantId]);

  const handleApprove = async (suggestion: GoalSuggestion) => {
    setActionLoading(suggestion.id);
    try {
      const { data: goal, error: insertError } = await supabase
        .from("goals")
        .insert({
          tenant_id: tenantId,
          name: suggestion.name || `Meta ${goalTypeLabels[suggestion.goal_type as GoalType]} - ${professionals.find((p) => p.id === suggestion.professional_id)?.full_name || "Profissional"}`,
          goal_type: suggestion.goal_type,
          target_value: suggestion.target_value,
          period: suggestion.period,
          professional_id: suggestion.professional_id,
          product_id: null,
          show_in_header: false,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("goal_suggestions")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          created_goal_id: goal?.id,
        })
        .eq("id", suggestion.id);

      if (updateError) throw updateError;

      // Notificar profissional (user_id = auth.users id do profissional)
      const profUserId = professionals.find((p) => p.id === suggestion.professional_id)?.user_id;
      const { data: prefs } = profUserId
        ? await supabase
            .from("user_notification_preferences")
            .select("goal_approved")
            .eq("user_id", profUserId)
            .maybeSingle()
        : { data: null };
      const shouldNotify = profUserId && prefs?.goal_approved !== false;
      if (shouldNotify && profUserId) {
        await supabase.from("notifications").insert({
          tenant_id: tenantId,
          user_id: profUserId,
          type: "goal_approved",
          title: "Meta aprovada",
          body: `Sua sugestão "${suggestion.name || "Meta"}" foi aprovada e a meta foi criada.`,
          metadata: { goal_suggestion_id: suggestion.id, created_goal_id: goal?.id },
        });
      }

      toast.success("Sugestão aprovada! Meta criada.");
      fetchSuggestions();
      onApprovedOrRejected();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || "Erro ao aprovar sugestão");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;

    setActionLoading(rejectDialog.suggestion.id);
    try {
      const { error } = await supabase
        .from("goal_suggestions")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          rejection_reason: rejectDialog.reason.trim() || null,
        })
        .eq("id", rejectDialog.suggestion.id);

      if (error) throw error;

      // Notificar profissional (user_id = auth.users id do profissional)
      const profUserId = professionals.find((p) => p.id === rejectDialog.suggestion.professional_id)?.user_id;
      const { data: prefs } = profUserId
        ? await supabase
            .from("user_notification_preferences")
            .select("goal_rejected")
            .eq("user_id", profUserId)
            .maybeSingle()
        : { data: null };
      const shouldNotify = profUserId && prefs?.goal_rejected !== false;
      if (shouldNotify && profUserId) {
        await supabase.from("notifications").insert({
          tenant_id: tenantId,
          user_id: profUserId,
          type: "goal_rejected",
          title: "Meta rejeitada",
          body: rejectDialog.reason.trim()
            ? `Sua sugestão foi rejeitada. Motivo: ${rejectDialog.reason.trim()}`
            : "Sua sugestão foi rejeitada.",
          metadata: { goal_suggestion_id: rejectDialog.suggestion.id, rejection_reason: rejectDialog.reason || null },
        });
      }

      toast.success("Sugestão rejeitada.");
      setRejectDialog(null);
      fetchSuggestions();
      onApprovedOrRejected();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || "Erro ao rejeitar sugestão");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) return null;
  if (!showEmptyState && suggestions.length === 0) return null;

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Sugestões dos profissionais
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{suggestions.length} pendente(s)</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {suggestions.length > 0
              ? "Profissionais sugeriram metas. Aprove ou rejeite."
              : "Nenhuma sugestão pendente no momento. Os profissionais podem sugerir metas em Minhas Metas."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Nenhuma sugestão aguardando aprovação
            </div>
          ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const prof = professionals.find((p) => p.id === s.professional_id)?.full_name ?? "Profissional";
              const isProcessing = actionLoading === s.id;

              return (
                <li
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {s.name || `Meta ${goalTypeLabels[s.goal_type as GoalType]}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {prof} · {goalTypeLabels[s.goal_type as GoalType]} · {periodLabels[s.period as GoalPeriod]} ·{" "}
                      {s.goal_type === "revenue" || s.goal_type === "ticket_medio"
                        ? formatCurrency(s.target_value)
                        : s.target_value}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="text-green-600 hover:text-green-700"
                      onClick={() => handleApprove(s)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRejectDialog({ suggestion: s, reason: "" })}
                      disabled={isProcessing}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar sugestão</DialogTitle>
            <DialogDescription>
              Informe um motivo (opcional) para o profissional entender a rejeição.
            </DialogDescription>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <div>
                <Label>Motivo da rejeição (opcional)</Label>
                <Input
                  placeholder="Ex: Meta fora do padrão definido..."
                  value={rejectDialog.reason}
                  onChange={(e) =>
                    setRejectDialog({ ...rejectDialog, reason: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
