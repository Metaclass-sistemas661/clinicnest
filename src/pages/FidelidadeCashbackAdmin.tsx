import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Gift, Loader2, Save, TrendingUp } from "lucide-react";

export default function FidelidadeCashbackAdmin() {
  const { tenant, refreshProfile } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState("0");

  useEffect(() => {
    if (!tenant) return;
    setEnabled((tenant as any).cashback_enabled === true);
    setPercent(String((tenant as any).cashback_percent ?? 0));
  }, [tenant]);

  const parsedPercent = useMemo(() => Number(percent), [percent]);

  const validate = () => {
    if (!enabled) return true;
    if (Number.isNaN(parsedPercent)) return false;
    if (parsedPercent < 0 || parsedPercent > 100) return false;
    return true;
  };

  const handleSave = async () => {
    if (!tenant?.id) return;

    if (!validate()) {
      toast.error("Percentual de cashback deve estar entre 0 e 100");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ cashback_enabled: enabled, cashback_percent: enabled ? parsedPercent : 0 } as any)
        .eq("id", tenant.id);

      if (error) throw error;

      toast.success("Fidelidade/Cashback salvo!");
      refreshProfile();
    } catch (e) {
      logger.error("[FidelidadeCashbackAdmin] save error", e);
      toast.error("Erro ao salvar fidelidade/cashback");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout
      title="Fidelidade & Cashback"
      subtitle="Configure recompensas para aumentar recorrência e ticket médio"
    >
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Cashback</CardTitle>
                  <CardDescription>Crédito automático para clientes após atendimentos concluídos</CardDescription>
                </div>
              </div>
              <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Ativo" : "Inativo"}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border/70 p-4">
              <div>
                <Label htmlFor="cashback-enabled" className="cursor-pointer">Cashback habilitado</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Ao concluir uma comanda, o sistema credita automaticamente um percentual para o cliente.
                </p>
              </div>
              <Switch id="cashback-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Percentual de cashback (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="Ex: 5"
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Exemplo: 5 significa 5% do valor do atendimento em crédito para o cliente.
                </p>
              </div>

              <div className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Sugestão prática</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Comece com 3% a 5% para estimular recorrência, e aumente em campanhas.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="gradient-primary text-primary-foreground"
                onClick={handleSave}
                disabled={!tenant?.id || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar configurações
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
