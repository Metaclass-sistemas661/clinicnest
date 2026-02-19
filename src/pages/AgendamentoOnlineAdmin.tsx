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
import { Copy, ExternalLink, Globe, Loader2, Save } from "lucide-react";

export default function AgendamentoOnlineAdmin() {
  const { tenant, refreshProfile } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [minLeadMinutes, setMinLeadMinutes] = useState(60);
  const [cancelMinLeadMinutes, setCancelMinLeadMinutes] = useState(240);

  useEffect(() => {
    if (!tenant) return;
    setEnabled(tenant.online_booking_enabled === true);
    setSlug(tenant.online_booking_slug || "");
    setMinLeadMinutes(Number(tenant.online_booking_min_lead_minutes ?? 60));
    setCancelMinLeadMinutes(Number(tenant.online_booking_cancel_min_lead_minutes ?? 240));
  }, [tenant]);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const s = slug.trim();
    if (!s) return "";
    return `${window.location.origin}/agendar/${s}`;
  }, [slug]);

  const canSave = !!tenant?.id;

  const handleCopy = async () => {
    if (!publicUrl) {
      toast.error("Defina o slug para gerar o link");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    } catch (e) {
      logger.warn("[AgendamentoOnlineAdmin] clipboard error", e);
      toast.error("Não foi possível copiar automaticamente. Selecione e copie o link.");
    }
  };

  const handleOpen = () => {
    if (!publicUrl) {
      toast.error("Defina o slug para gerar o link");
      return;
    }
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  };

  const handleSave = async () => {
    if (!tenant?.id) return;

    const s = slug.trim();
    if (enabled && !s) {
      toast.error("Informe um slug para habilitar o agendamento online");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        online_booking_enabled: enabled,
        online_booking_slug: s ? s : null,
        online_booking_min_lead_minutes: Number(minLeadMinutes || 0) || 60,
        online_booking_cancel_min_lead_minutes: Number(cancelMinLeadMinutes || 0) || 240,
      };

      const { error } = await supabase.from("tenants").update(payload as any).eq("id", tenant.id);
      if (error) throw error;

      toast.success("Agendamento online salvo!");
      refreshProfile();
    } catch (e) {
      logger.error("[AgendamentoOnlineAdmin] save error", e);
      toast.error("Erro ao salvar agendamento online");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout
      title="Agendamento Online"
      subtitle="Configure o link público para seus clientes agendarem com uma experiência fluida"
    >
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Link público</CardTitle>
                  <CardDescription>Ative, personalize e compartilhe o agendamento online</CardDescription>
                </div>
              </div>
              <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Ativo" : "Inativo"}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border/70 p-4">
              <div>
                <Label htmlFor="online-booking-enabled" className="cursor-pointer">
                  Habilitar agendamento online
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Recomendado para captar clientes e reduzir trabalho no WhatsApp.
                </p>
              </div>
              <Switch id="online-booking-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Slug do link</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="meu-salao" />
                <p className="text-xs text-muted-foreground">O link ficará em /agendar/&lt;slug&gt;</p>
              </div>

              <div className="space-y-2">
                <Label>Link público</Label>
                <Input readOnly value={publicUrl} placeholder="Defina o slug para ver o link" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleCopy} disabled={!publicUrl}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button type="button" variant="outline" onClick={handleOpen} disabled={!publicUrl}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Antecedência mínima (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={String(minLeadMinutes)}
                  onChange={(e) => setMinLeadMinutes(Number(e.target.value || 0))}
                  placeholder="60"
                />
                <p className="text-xs text-muted-foreground">
                  Evita agendamentos muito em cima da hora.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Antecedência p/ cancelar (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={String(cancelMinLeadMinutes)}
                  onChange={(e) => setCancelMinLeadMinutes(Number(e.target.value || 0))}
                  placeholder="240"
                />
                <p className="text-xs text-muted-foreground">
                  Define a janela mínima para cancelamento.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="gradient-primary text-primary-foreground"
                onClick={handleSave}
                disabled={!canSave || isSaving}
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
