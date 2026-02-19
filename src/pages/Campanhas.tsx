import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Send, Plus, Loader2, Eye, Mail } from "lucide-react";
import type { CampaignRow, CampaignDeliveryRow, CampaignStatus } from "@/types/supabase-extensions";
import EmailBuilder from "@/components/campanhas/EmailBuilder";

const statusConfig: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  sending: { label: "Enviando", variant: "secondary" },
  sent: { label: "Enviada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

export default function Campanhas() {
  const { profile, tenant, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<CampaignRow | null>(null);

  const [isSendOpen, setIsSendOpen] = useState(false);
  const [sendCampaign, setSendCampaign] = useState<CampaignRow | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [batchLimit, setBatchLimit] = useState(200);
  const [afterClientId, setAfterClientId] = useState<string | null>(null);
  const [sendStats, setSendStats] = useState({ sent: 0, skipped: 0, failed: 0, opted_out: 0, already_sent: 0 });
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);

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
      const db: any = supabase;
      const { data, error } = await db
        .from("campaigns")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns((data as CampaignRow[]) || []);
    } catch (err) {
      logger.error("[Campanhas] fetch error", err);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromBuilder = async (payload: {
    name: string;
    subject: string;
    html: string;
    banner_url: string | null;
    preheader: string | null;
  }) => {
    if (!profile?.tenant_id) return;
    setIsSaving(true);
    try {
      const db: any = supabase;
      const { error } = await db.from("campaigns").insert({
        tenant_id: profile.tenant_id,
        name: payload.name,
        subject: payload.subject,
        banner_url: payload.banner_url,
        preheader: payload.preheader,
        html: payload.html,
        status: "draft" as CampaignStatus,
        created_by: profile.user_id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      setIsDialogOpen(false);
      await fetchCampaigns();
    } catch (err) {
      logger.error("[Campanhas] create error", err);
      toast.error("Erro ao criar campanha");
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = (campaign: CampaignRow) => {
    setPreviewCampaign(campaign);
    setIsPreviewOpen(true);
  };

  const openSend = (campaign: CampaignRow) => {
    setSendCampaign(campaign);
    setTestEmail("");
    setBatchLimit(200);
    setAfterClientId(null);
    setSendStats({ sent: 0, skipped: 0, failed: 0, opted_out: 0, already_sent: 0 });
    setHasMore(null);
    setIsSendOpen(true);
  };

  const getAuthHeaders = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão ausente. Faça login novamente.");
    return { Authorization: `Bearer ${token}` };
  };

  const runTestSend = async () => {
    if (!sendCampaign) return;
    if (!testEmail.trim()) { toast.error("Informe um email para teste"); return; }
    setIsSending(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke("run-campaign", {
        headers,
        body: { campaignId: sendCampaign.id, testEmail: testEmail.trim() },
      });
      if (error) { toast.error(error.message || "Erro ao enviar teste"); return; }
      if (!data?.success) { toast.error(data?.error || "Erro ao enviar teste"); return; }
      toast.success("Email de teste enviado! Verifique sua caixa de entrada.");
    } catch (err) {
      logger.error("[Campanhas] test send error", err);
      toast.error("Erro ao enviar teste");
    } finally {
      setIsSending(false);
    }
  };

  const runBatch = async () => {
    if (!sendCampaign) return;
    setIsSending(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke("run-campaign", {
        headers,
        body: { campaignId: sendCampaign.id, limit: batchLimit, afterClientId: afterClientId || undefined },
      });
      if (error) { toast.error(error.message || "Erro ao enviar lote"); return; }
      if (!data?.success) { toast.error(data?.error || "Erro ao enviar lote"); return; }
      setSendStats((prev) => ({
        sent: prev.sent + Number(data?.sent || 0),
        skipped: prev.skipped + Number(data?.skipped || 0),
        failed: prev.failed + Number(data?.failed || 0),
        opted_out: prev.opted_out + Number(data?.opted_out || 0),
        already_sent: prev.already_sent + Number(data?.already_sent || 0),
      }));
      setHasMore(Boolean(data?.has_more));
      setAfterClientId(typeof data?.next_after_client_id === "string" ? data.next_after_client_id : null);
      await fetchCampaigns();
      toast.success(`Lote concluído: ${Number(data?.sent || 0)} enviados`);
    } catch (err) {
      logger.error("[Campanhas] batch send error", err);
      toast.error("Erro ao enviar lote");
    } finally {
      setIsSending(false);
    }
  };

  const loadDeliveries = async (campaign: CampaignRow) => {
    setSelectedCampaign(campaign);
    setIsDeliveriesOpen(true);
    setIsLoadingDeliveries(true);
    try {
      const db: any = supabase;
      const { data, error } = await db
        .from("campaign_deliveries")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDeliveries((data as CampaignDeliveryRow[]) || []);
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

  const defaultSalonName = tenant?.name ?? profile?.full_name ?? "Meu Salão";

  return (
    <MainLayout
      title="Campanhas"
      subtitle="Gerencie campanhas de email marketing"
      actions={
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={() => setIsDialogOpen(true)}
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
              onClick={() => setIsDialogOpen(true)}
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
            {/* Mobile */}
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
                      <Mail className="inline h-3 w-3 mr-1" />{c.subject}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openPreview(c)}>
                          <Eye className="h-3 w-3 mr-1" />Preview
                        </Button>
                        {isAdmin && (c.status === "draft" || c.status === "sending") && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSend(c)}>
                            <Send className="h-3 w-3 mr-1" />Enviar
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => loadDeliveries(c)}>
                          <Eye className="h-3 w-3 mr-1" />Entregas
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
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
                          <Button variant="ghost" size="sm" onClick={() => openPreview(c)}>
                            <Eye className="h-4 w-4 mr-1" />Preview
                          </Button>
                          {isAdmin && (c.status === "draft" || c.status === "sending") && (
                            <Button variant="ghost" size="sm" onClick={() => openSend(c)}>
                              <Send className="h-4 w-4 mr-1" />Enviar
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => loadDeliveries(c)}>
                            <Eye className="h-4 w-4 mr-1" />Entregas
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

      {/* ── Email Builder Dialog ─────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isSaving) setIsDialogOpen(open); }}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden [&>button]:hidden">
          <EmailBuilder
            defaultSalonName={defaultSalonName}
            onSave={handleCreateFromBuilder}
            onCancel={() => setIsDialogOpen(false)}
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ───────────────────────────────────────────────── */}
      {previewCampaign && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewCampaign.name}</DialogTitle>
              <DialogDescription>{previewCampaign.subject}</DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-background">
              <iframe
                title={`preview-${previewCampaign.id}`}
                className="w-full h-[540px] rounded-md"
                srcDoc={previewCampaign.html}
                sandbox="allow-same-origin"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Send Dialog ──────────────────────────────────────────────────── */}
      {sendCampaign && (
        <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enviar: {sendCampaign.name}</DialogTitle>
              <DialogDescription>Envio por lotes idempotente. Você pode reexecutar sem reenviar para quem já recebeu.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-xs text-muted-foreground">Enviados</div><div className="font-semibold">{sendStats.sent}</div></div>
                  <div><div className="text-xs text-muted-foreground">Falhas</div><div className="font-semibold">{sendStats.failed}</div></div>
                  <div><div className="text-xs text-muted-foreground">Opt-out</div><div className="font-semibold">{sendStats.opted_out}</div></div>
                  <div><div className="text-xs text-muted-foreground">Já enviados</div><div className="font-semibold">{sendStats.already_sent}</div></div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {hasMore === null ? "" : hasMore ? "Ainda há mais clientes para enviar." : "✓ Todos os clientes processados."}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email de teste</Label>
                <div className="flex gap-2">
                  <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="seuemail@dominio.com" />
                  <Button variant="outline" onClick={runTestSend} disabled={isSending}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Envie para seu email antes de disparar para toda a base.</p>
              </div>

              <div className="space-y-2">
                <Label>Tamanho do lote</Label>
                <div className="flex gap-2">
                  <Input value={String(batchLimit)} onChange={(e) => setBatchLimit(Number(e.target.value || 0))} inputMode="numeric" className="w-24" />
                  <Button className="flex-1 gradient-primary text-primary-foreground" onClick={runBatch} disabled={isSending}>
                    {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : hasMore === false ? "Reenviar lote" : afterClientId ? "Continuar envio" : "Disparar campanha"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">A campanha só é marcada como enviada quando todos forem processados.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSendOpen(false)} disabled={isSending}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Deliveries Dialog ────────────────────────────────────────────── */}
      {selectedCampaign && (
        <Dialog open={isDeliveriesOpen} onOpenChange={setIsDeliveriesOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregas: {selectedCampaign.name}</DialogTitle>
              <DialogDescription>Histórico de envios desta campanha</DialogDescription>
            </DialogHeader>
            {isLoadingDeliveries ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : deliveries.length === 0 ? (
              <EmptyState icon={Mail} title="Nenhuma entrega" description="Esta campanha ainda não possui envios registrados." />
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
