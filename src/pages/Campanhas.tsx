import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import { Send, Plus, Loader2, Eye, Mail, Users, UserCheck } from "lucide-react";
import type { CampaignRow, CampaignDeliveryRow, CampaignStatus } from "@/types/database-extensions";
import EmailBuilder from "@/components/campanhas/EmailBuilder";

const statusConfig: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft:     { label: "Rascunho", variant: "secondary" },
  sending:   { label: "Enviando", variant: "secondary" },
  sent:      { label: "Enviada",  variant: "default"   },
  cancelled: { label: "Cancelada",variant: "outline"   },
};

type PatientEntry = { id: string; name: string | null; email: string };

export default function Campanhas() {
  const { profile, tenant, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<CampaignRow | null>(null);

  // ── Send dialog state ───────────────────────────────────────────────────────
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [sendCampaign, setSendCampaign] = useState<CampaignRow | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendMode, setSendMode] = useState<"all" | "selected">("all");
  const [patients, setPatients] = useState<PatientEntry[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendStats, setSendStats] = useState({ sent: 0, skipped: 0, failed: 0, opted_out: 0, already_sent: 0 });
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [afterClientId, setAfterClientId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // ── Deliveries dialog ───────────────────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
  const [deliveries, setDeliveries] = useState<CampaignDeliveryRow[]>([]);
  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) fetchCampaigns();
  }, [profile?.tenant_id]);

  const fetchCampaigns = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("campaigns")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns((data as CampaignRow[]) || []);
    } catch (err) {
      logger.error("[Campanhas] fetch error", err);
      toast.error("Erro ao carregar campanhas", { description: normalizeError(err, "Não foi possível listar as campanhas.") });
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
      const db: any = api;
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
      toast.error("Erro ao criar campanha", { description: normalizeError(err, "Não foi possível criar a campanha.") });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Load clients for recipient selection ────────────────────────────────────
  const loadPatients = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoadingPatients(true);
    try {
      const { data, error } = await api
        .from("patients")
        .select("id, name, email")
        .eq("tenant_id", profile.tenant_id)
        .not("email", "is", null)
        .order("name", { ascending: true })
        .limit(500) as any;
      if (error) throw error;
      setPatients(
        ((data || []) as { id: string; name: string | null; email: string | null }[])
          .filter((c) => !!c.email)
          .map((c) => ({ id: c.id, name: c.name, email: c.email! }))
      );
    } catch (err) {
      logger.error("[Campanhas] load clients error", err);
    } finally {
      setIsLoadingPatients(false);
    }
  }, [profile?.tenant_id]);

  const openSend = (campaign: CampaignRow) => {
    setSendCampaign(campaign);
    setTestEmail("");
    setSendMode("all");
    setSelectedIds(new Set());
    setClientSearch("");
    setSendStats({ sent: 0, skipped: 0, failed: 0, opted_out: 0, already_sent: 0 });
    setHasMore(null);
    setAfterClientId(null);
    setIsSendOpen(true);
    loadPatients();
  };

  const openPreview = (campaign: CampaignRow) => {
    setPreviewCampaign(campaign);
    setIsPreviewOpen(true);
  };

  // ── Filtered clients list ───────────────────────────────────────────────────
  const filteredPatients = patients.filter((c) => {
    const q = patientSearch.toLowerCase();
    return !q || (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const togglePatient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((c) => c.id)));
    }
  };

  // ── Auth header helper ──────────────────────────────────────────────────────
  const getAuthHeaders = async () => {
    const { data, error } = await api.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão ausente. Faça login novamente.");
    return { Authorization: `Bearer ${token}` };
  };

  // ── Test send ───────────────────────────────────────────────────────────────
  const runTestSend = async () => {
    if (!sendCampaign) return;
    if (!testEmail.trim()) { toast.error("Informe um email para teste"); return; }
    setIsSending(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await api.functions.invoke("run-campaign", {
        headers,
        body: { campaignId: sendCampaign.id, testEmail: testEmail.trim() },
      });
      if (error) { toast.error("Erro ao enviar teste", { description: normalizeError(error, "Verifique os dados e tente novamente.") }); return; }
      if (!data?.success) { toast.error("Erro ao enviar teste", { description: normalizeError(data?.error, "O servidor não conseguiu processar o envio.") }); return; }
      toast.success("Email de teste enviado! Verifique sua caixa de entrada.");
    } catch (err) {
      logger.error("[Campanhas] test send error", err);
      toast.error("Erro ao enviar teste", { description: normalizeError(err, "Não foi possível enviar o teste.") });
    } finally {
      setIsSending(false);
    }
  };

  // ── Batch / selected send ───────────────────────────────────────────────────
  const runBatch = async () => {
    if (!sendCampaign) return;

    if (sendMode === "selected" && selectedIds.size === 0) {
      toast.error("Selecione pelo menos um destinatário.");
      return;
    }

    setIsSending(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = { campaignId: sendCampaign.id };

      if (sendMode === "selected") {
        body.clientIds = Array.from(selectedIds);
      } else {
        body.limit = 200;
        if (afterClientId) body.afterClientId = afterClientId;
      }

      const { data, error } = await api.functions.invoke("run-campaign", { headers, body });
      if (error) { toast.error("Erro ao enviar campanha", { description: normalizeError(error, "Verifique os dados e tente novamente.") }); return; }
      if (!data?.success) { toast.error("Erro ao enviar campanha", { description: normalizeError(data?.error, "O servidor não conseguiu processar o envio.") }); return; }

      setSendStats((prev) => ({
        sent:         prev.sent         + Number(data?.sent         || 0),
        skipped:      prev.skipped      + Number(data?.skipped      || 0),
        failed:       prev.failed       + Number(data?.failed       || 0),
        opted_out:    prev.opted_out    + Number(data?.opted_out    || 0),
        already_sent: prev.already_sent + Number(data?.already_sent || 0),
      }));
      setHasMore(sendMode === "selected" ? false : Boolean(data?.has_more));
      setAfterClientId(typeof data?.next_after_client_id === "string" ? data.next_after_client_id : null);
      await fetchCampaigns();
      toast.success(`Lote concluído: ${Number(data?.sent || 0)} enviados`);
    } catch (err) {
      logger.error("[Campanhas] batch send error", err);
      toast.error("Erro ao enviar campanha", { description: normalizeError(err, "Não foi possível enviar a campanha.") });
    } finally {
      setIsSending(false);
    }
  };

  // ── Deliveries ──────────────────────────────────────────────────────────────
  const loadDeliveries = async (campaign: CampaignRow) => {
    setSelectedCampaign(campaign);
    setIsDeliveriesOpen(true);
    setIsLoadingDeliveries(true);
    try {
      const db: any = api;
      const { data, error } = await db
        .from("campaign_deliveries")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDeliveries((data as CampaignDeliveryRow[]) || []);
    } catch (err) {
      logger.error("[Campanhas] deliveries error", err);
      toast.error("Erro ao carregar entregas", { description: normalizeError(err, "Não foi possível listar as entregas.") });
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  const deliveryStatusBadge = (status: string) => {
    if (status === "sent" || status === "delivered") return <Badge variant="default">Enviado</Badge>;
    if (status === "error" || status === "failed") return <Badge variant="destructive">Erro</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const defaultClinicName = tenant?.name ?? profile?.full_name ?? "Minha Clínica";

  return (
    <MainLayout
      title="Campanhas"
      subtitle="Gerencie campanhas de email marketing"
      actions={
        <Button
          variant="gradient"
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
          description="Crie sua primeira campanha de email para engajar seus pacientes."
          action={
            <Button
              variant="gradient"
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
                        <TableCell className="text-muted-foreground">{(c as any).sent_at ? new Date((c as any).sent_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
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

      {/* ── Email Builder Dialog ──────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isSaving) setIsDialogOpen(open); }}>
        <DialogContent
          className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Nova Campanha</DialogTitle>
          {/* absolute inset-0 bypasses the DialogContent grid layout that prevents h-full from resolving correctly */}
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <EmailBuilder
              defaultClinicName={defaultClinicName}
              onSave={handleCreateFromBuilder}
              onCancel={() => setIsDialogOpen(false)}
              isSaving={isSaving}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────────────────────────────── */}
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

      {/* ── Send Dialog ───────────────────────────────────────────────────── */}
      {sendCampaign && (
        <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
              <DialogTitle>Enviar: {sendCampaign.name}</DialogTitle>
              <DialogDescription>{sendCampaign.subject}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">

              {/* Stats */}
              <div className="rounded-lg border p-3 text-sm">
                <div className="grid grid-cols-4 gap-2">
                  <div><div className="text-xs text-muted-foreground">Enviados</div><div className="font-semibold">{sendStats.sent}</div></div>
                  <div><div className="text-xs text-muted-foreground">Falhas</div><div className="font-semibold">{sendStats.failed}</div></div>
                  <div><div className="text-xs text-muted-foreground">Opt-out</div><div className="font-semibold">{sendStats.opted_out}</div></div>
                  <div><div className="text-xs text-muted-foreground">Já enviados</div><div className="font-semibold">{sendStats.already_sent}</div></div>
                </div>
                {hasMore !== null && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {hasMore ? "Ainda há mais pacientes para enviar. Clique em 'Continuar' para o próximo lote." : "✓ Todos os pacientes processados."}
                  </div>
                )}
              </div>

              {/* Test email */}
              <div className="space-y-2">
                <Label>Email de teste</Label>
                <div className="flex gap-2">
                  <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="seuemail@dominio.com" />
                  <Button variant="outline" onClick={runTestSend} disabled={isSending}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Envie um email de teste antes de disparar para a base.</p>
              </div>

              {/* Recipient mode */}
              <div className="space-y-3">
                <Label>Destinatários</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMode("all")}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all ${
                      sendMode === "all"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Todos os pacientes</div>
                      <div className="text-xs text-muted-foreground">{patients.length} com email</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("selected")}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all ${
                      sendMode === "selected"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Selecionar pacientes</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Escolha individualmente"}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Client list */}
                {sendMode === "selected" && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="p-2 border-b bg-muted/30 flex items-center gap-2">
                      <Input
                        placeholder="Buscar por nome ou email..."
                        value={patientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs whitespace-nowrap"
                        onClick={toggleAll}
                        disabled={filteredPatients.length === 0}
                      >
                        {selectedIds.size === filteredPatients.length && filteredPatients.length > 0 ? "Desmarcar todos" : "Marcar todos"}
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y">
                      {isLoadingPatients ? (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando pacientes...
                        </div>
                      ) : filteredPatients.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Nenhum paciente encontrado
                        </div>
                      ) : (
                        filteredPatients.map((c) => (
                          <label
                            key={c.id}
                            htmlFor={`patient-cb-${c.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer"
                          >
                            <Checkbox
                              id={`patient-cb-${c.id}`}
                              checked={selectedIds.has(c.id)}
                              onCheckedChange={() => togglePatient(c.id)}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{c.name || "—"}</div>
                              <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                        {selectedIds.size} paciente(s) selecionado(s)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Send button */}
              <Button
                variant="gradient" className="w-full"
                onClick={runBatch}
                disabled={isSending || (sendMode === "selected" && selectedIds.size === 0)}
              >
                {isSending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : sendMode === "selected" ? (
                  `Enviar para ${selectedIds.size} paciente(s)`
                ) : hasMore === false ? (
                  "Reenviar"
                ) : afterClientId ? (
                  "Continuar envio"
                ) : (
                  "Disparar para todos"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                A campanha é marcada como enviada após todos os pacientes serem processados. Pacientes que fizeram opt-out são ignorados automaticamente.
              </p>
            </div>

            <DialogFooter className="px-6 pb-4 flex-shrink-0">
              <Button variant="outline" onClick={() => setIsSendOpen(false)} disabled={isSending}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Deliveries Dialog ─────────────────────────────────────────────── */}
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
