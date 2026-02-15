import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatInAppTz } from "@/lib/date";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  status: string;
  plan: string | null;
  current_period_end: string | null;
  trial_end: string;
  billing_provider?: string | null;
  asaas_subscription_id?: string | null;
};

type TierKey = "basic" | "pro" | "premium";
type IntervalKey = "monthly" | "quarterly" | "annual";

const tierNames: Record<TierKey, string> = {
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
};

const intervalNames: Record<IntervalKey, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

function formatPlanLabel(plan: string | null): string {
  if (!plan) return "-";
  const s = plan.trim();
  if (!s) return "-";

  // Legacy format: "monthly" | "quarterly" | "annual"
  if (s === "monthly" || s === "quarterly" || s === "annual") {
    return `Básico (${intervalNames[s]})`;
  }

  const [tierRaw, intervalRaw] = s.split("_");
  if (
    (tierRaw === "basic" || tierRaw === "pro" || tierRaw === "premium") &&
    (intervalRaw === "monthly" || intervalRaw === "quarterly" || intervalRaw === "annual")
  ) {
    return `${tierNames[tierRaw]} (${intervalNames[intervalRaw]})`;
  }

  return s;
}

export default function GerenciarAssinatura() {
  const navigate = useNavigate();
  const { user, isAdmin, session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  const statusLabel = useMemo(() => {
    const s = subscription?.status;
    if (!s) return "Indisponível";
    if (s === "active") return "Ativa";
    if (s === "trialing") return "Em teste";
    if (s === "inactive") return "Inativa";
    return s;
  }, [subscription?.status]);

  const statusVariant = useMemo(() => {
    const s = subscription?.status;
    if (s === "active") return "default";
    if (s === "trialing") return "secondary";
    if (s === "inactive") return "destructive";
    return "secondary";
  }, [subscription?.status]);

  const fetchSubscription = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.tenant_id) {
        setSubscription(null);
        return;
      }

      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select(
          "id,tenant_id,status,plan,current_period_end,trial_end,billing_provider,asaas_subscription_id"
        )
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (subError) throw subError;
      setSubscription((sub as SubscriptionRow) ?? null);
    } catch {
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancel = async () => {
    if (!user?.id) return;

    setIsCancelling(true);
    try {
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Assinatura cancelada");
      setShowCancelDialog(false);
      await fetchSubscription();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar assinatura";
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Gerenciar assinatura" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-muted-foreground">Apenas administradores podem gerenciar a assinatura</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Gerenciar assinatura"
      subtitle="Cancelar e acompanhar status"
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate("/assinatura")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Status da assinatura</CardTitle>
            <CardDescription>As informações abaixo refletem o que está registrado no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-52" />
              </div>
            ) : !subscription ? (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada para este salão.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant}>{statusLabel}</Badge>
                  {subscription.billing_provider && (
                    <Badge variant="outline">{subscription.billing_provider}</Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Plano</p>
                    <p className="font-medium">{formatPlanLabel(subscription.plan)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Renovação / fim do período</p>
                    <p className="font-medium">
                      {subscription.current_period_end
                        ? formatInAppTz(subscription.current_period_end, "dd 'de' MMMM 'de' yyyy")
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Para cancelar, a assinatura será inativada no Asaas e novas cobranças não serão geradas.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={subscription.status !== "active" && subscription.status !== "trialing"}
                  >
                    Cancelar assinatura
                  </Button>

                  <Button variant="outline" onClick={() => fetchSubscription()} disabled={isLoading || isCancelling}>
                    Atualizar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Ajuda</CardTitle>
            <CardDescription>Precisa de suporte com pagamentos?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Se você tiver um pagamento pendente (Pix ou boleto), finalize o pagamento para evitar interrupções.
            </p>
            <p>
              Em caso de dúvidas, fale com o suporte pelo canal de contato.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar? Você perderá o acesso aos recursos pagos após o término do período atual.
              Esta ação pode ser revertida apenas criando uma nova assinatura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
