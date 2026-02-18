import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { Send, Plus, Loader2, Eye, Mail } from "lucide-react";
import type { CampaignRow, CampaignDeliveryRow, CampaignStatus } from "@/types/supabase-extensions";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  html: z.string().min(1, "Conteúdo é obrigatório"),
});

const statusConfig: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  sent: { label: "Enviada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

export default function Campanhas() {
  const { profile, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", subject: "", html: "" });

  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
  const [deliveries, setDeliveries] = useState<CampaignDeliveryRow[]>([]);
  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchCampaigns();
    }
  }, [profile?.tenant_id]);

  const fetchCampaigns = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns((data as unknown as CampaignRow[]) || []);
    } catch (err) {
      logger.error("[Campanhas] fetch error", err);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    const parsed = campaignFormSchema.safeParse(formData);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }
    if (!profile?.tenant_id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("campaigns").insert({
        tenant_id: profile.tenant_id,
        name: parsed.data.name,
        subject: parsed.data.subject,
        html: parsed.data.html,
        status: "draft" as CampaignStatus,
        created_by: profile.user_id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Campanha criada!");
      setIsDialogOpen(false);
      setFormData({ name: "", subject: "", html: "" });
      await fetchCampaigns();
    } catch (err) {
      logger.error("[Campanhas] create error", err);
      toast.error("Erro ao criar campanha");
    } finally {
      setIsSaving(false);
    }
  };

  const loadDeliveries = async (campaign: CampaignRow) => {
    setSelectedCampaign(campaign);
    setIsDeliveriesOpen(true);
    setIsLoadingDeliveries(true);
    try {
      const { data, error } = await supabase
        .from("campaign_deliveries")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDeliveries((data as unknown as CampaignDeliveryRow[]) || []);
    } catch (err) {
      logger.error("[Campanhas] deliveries error", err);
      toast.error("Erro ao carregar entregas");
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  const deliveryStatusBadge = (status: string) => {
    if (status === "sent" || status === "delivered") return <Badge variant="default">Enviado</Badge>;
    if (status === "error" || status === "failed") return <Badge variant="destructive">Erro</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <MainLayout
      title="Campanhas"
      subtitle="Gerencie campanhas de email marketing"
      actions={
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={() => {
            setFormData({ name: "", subject: "", html: "" });
            setIsDialogOpen(true);
          }}
          data-tour="campaigns-new"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Nenhuma campanha criada"
          description="Crie sua primeira campanha de email para engajar seus clientes."
          action={
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={() => { setFormData({ name: "", subject: "", html: "" }); setIsDialogOpen(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Campanha
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Campanhas ({campaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: Card Layout */}
            <div className="block md:hidden space-y-3">
              {campaigns.map((c) => {
                const cfg = statusConfig[c.status] || statusConfig.draft;
                return (
                  <div key={c.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{c.name}</p>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      <Mail className="inline h-3 w-3 mr-1" />
                      {c.subject}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => loadDeliveries(c)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Entregas
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead>Enviada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => {
                    const cfg = statusConfig[c.status] || statusConfig.draft;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{c.subject}</TableCell>
                        <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadDeliveries(c)}
                            aria-label={`Ver entregas da campanha ${c.name}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Entregas
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Crie um rascunho de campanha de email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Promoção de Natal"
              />
            </div>
            <div className="space-y-2">
              <Label>Assunto do email</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ex: Aproveite 20% de desconto!"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo (HTML)</Label>
              <Textarea
                value={formData.html}
                onChange={(e) => setFormData({ ...formData, html: e.target.value })}
                rows={8}
                placeholder="Cole o HTML do email aqui..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Cole o conteúdo HTML do email. O envio será feito ao alterar o status para "enviada".
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de entregas */}
      {selectedCampaign && (
        <Dialog open={isDeliveriesOpen} onOpenChange={setIsDeliveriesOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregas: {selectedCampaign.name}</DialogTitle>
              <DialogDescription>Histórico de envios desta campanha</DialogDescription>
            </DialogHeader>
            {isLoadingDeliveries ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="Nenhuma entrega"
                description="Esta campanha ainda não possui envios registrados."
              />
            ) : (
              <div className="rounded-lg border divide-y text-sm">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-3 py-2 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.to_email}</div>
                      {d.error && <div className="text-xs text-destructive">{d.error}</div>}
                      <div className="text-xs text-muted-foreground">
                        {d.sent_at ? new Date(d.sent_at).toLocaleString("pt-BR") : new Date(d.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    {deliveryStatusBadge(d.status)}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
}
