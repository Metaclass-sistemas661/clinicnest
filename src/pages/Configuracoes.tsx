import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Loader2, Building, Save, ShieldCheck, History, Archive } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type LgpdRequestStatus = "pending" | "in_progress" | "completed" | "rejected";
type LgpdRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "portability"
  | "consent_revocation"
  | "opposition";

interface LgpdDataRequest {
  id: string;
  requester_user_id: string;
  requester_email: string | null;
  request_type: LgpdRequestType;
  request_details: string | null;
  status: LgpdRequestStatus;
  assigned_admin_user_id: string | null;
  resolution_notes: string | null;
  requested_at: string;
  resolved_at: string | null;
}

interface LgpdRetentionPolicy {
  tenant_id: string;
  client_data_retention_days: number;
  financial_data_retention_days: number;
  audit_log_retention_days: number;
  auto_cleanup_enabled: boolean;
  last_reviewed_at: string | null;
}

interface AdminAuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const lgpdRequestTypeLabel: Record<LgpdRequestType, string> = {
  access: "Acesso aos dados",
  correction: "Correção de dados",
  deletion: "Eliminação de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogação de consentimento",
  opposition: "Oposição ao tratamento",
};

const lgpdStatusLabel: Record<LgpdRequestStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  rejected: "Rejeitada",
};

export default function Configuracoes() {
  const { user, profile: _profile, tenant, isAdmin, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [isUpdatingRequests, setIsUpdatingRequests] = useState(false);
  const [isLoadingGovernance, setIsLoadingGovernance] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [lgpdRequests, setLgpdRequests] = useState<LgpdDataRequest[]>([]);
  const [requestDrafts, setRequestDrafts] = useState<
    Record<string, { status: LgpdRequestStatus; resolution_notes: string }>
  >({});
  const [retentionPolicy, setRetentionPolicy] = useState<LgpdRetentionPolicy>({
    tenant_id: "",
    client_data_retention_days: 1825,
    financial_data_retention_days: 3650,
    audit_log_retention_days: 730,
    auto_cleanup_enabled: false,
    last_reviewed_at: null,
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [actorNameByUserId, setActorNameByUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        address: tenant.address || "",
      });
    }
  }, [tenant]);

  const getStatusBadgeVariant = (status: LgpdRequestStatus): "secondary" | "default" | "destructive" => {
    if (status === "completed") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  const writeAuditLog = async (
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>
  ) => {
    if (!tenant?.id) return;
    const { error } = await supabase.rpc("log_admin_action", {
      p_tenant_id: tenant.id,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) {
      logger.warn("Falha ao gravar trilha de auditoria", { action, entityType, error });
    }
  };

  const fetchGovernanceData = async () => {
    if (!tenant?.id || !isAdmin) return;
    setIsLoadingGovernance(true);

    try {
      const [requestsRes, retentionRes, logsRes] = await Promise.all([
        supabase
          .from("lgpd_data_requests")
          .select(
            "id, requester_user_id, requester_email, request_type, request_details, status, assigned_admin_user_id, resolution_notes, requested_at, resolved_at"
          )
          .eq("tenant_id", tenant.id)
          .order("requested_at", { ascending: false })
          .limit(50),
        supabase
          .from("lgpd_retention_policies")
          .select(
            "tenant_id, client_data_retention_days, financial_data_retention_days, audit_log_retention_days, auto_cleanup_enabled, last_reviewed_at"
          )
          .eq("tenant_id", tenant.id)
          .maybeSingle(),
        supabase
          .from("admin_audit_logs")
          .select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (retentionRes.error) throw retentionRes.error;
      if (logsRes.error) throw logsRes.error;

      const requestData = (requestsRes.data || []) as LgpdDataRequest[];
      setLgpdRequests(requestData);
      setRequestDrafts(
        Object.fromEntries(
          requestData.map((request) => [
            request.id,
            {
              status: request.status,
              resolution_notes: request.resolution_notes || "",
            },
          ])
        )
      );

      if (retentionRes.data) {
        setRetentionPolicy(retentionRes.data as LgpdRetentionPolicy);
      } else {
        setRetentionPolicy((prev) => ({ ...prev, tenant_id: tenant.id }));
      }

      const logData = (logsRes.data || []) as AdminAuditLog[];
      setAuditLogs(logData);

      const actorIds = [...new Set(logData.map((log) => log.actor_user_id).filter(Boolean))];
      if (actorIds.length > 0) {
        const { data: profilesRes, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds);
        if (profilesError) throw profilesError;
        setActorNameByUserId(
          Object.fromEntries((profilesRes || []).map((p) => [p.user_id, p.full_name || "Administrador"]))
        );
      } else {
        setActorNameByUserId({});
      }
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao carregar dados de governança LGPD");
    } finally {
      setIsLoadingGovernance(false);
    }
  };

  useEffect(() => {
    if (tenant?.id && isAdmin) {
      fetchGovernanceData();
    }
  }, [tenant?.id, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
        })
        .eq("id", tenant.id);

      if (error) throw error;

      await writeAuditLog("tenant_settings_updated", "tenants", tenant.id, {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
      });

      toast.success("Configurações salvas com sucesso!");
      refreshProfile();
    } catch (error) {
      toast.error("Erro ao salvar configurações");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRetentionPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !user?.id) return;

    setIsSavingRetention(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        client_data_retention_days: retentionPolicy.client_data_retention_days,
        financial_data_retention_days: retentionPolicy.financial_data_retention_days,
        audit_log_retention_days: retentionPolicy.audit_log_retention_days,
        auto_cleanup_enabled: retentionPolicy.auto_cleanup_enabled,
        last_reviewed_at: new Date().toISOString(),
        created_by: user.id,
      };

      const { error } = await supabase
        .from("lgpd_retention_policies")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;

      await writeAuditLog("lgpd_retention_policy_updated", "lgpd_retention_policies", tenant.id, {
        client_data_retention_days: payload.client_data_retention_days,
        financial_data_retention_days: payload.financial_data_retention_days,
        audit_log_retention_days: payload.audit_log_retention_days,
        auto_cleanup_enabled: payload.auto_cleanup_enabled,
      });

      toast.success("Política de retenção LGPD salva");
      await fetchGovernanceData();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao salvar política de retenção");
    } finally {
      setIsSavingRetention(false);
    }
  };

  const handleUpdateRequest = async (requestId: string) => {
    if (!tenant?.id || !user?.id) return;

    const draft = requestDrafts[requestId];
    if (!draft) return;

    setIsUpdatingRequests(true);
    try {
      const willBeResolved = draft.status === "completed" || draft.status === "rejected";

      const { error } = await supabase
        .from("lgpd_data_requests")
        .update({
          status: draft.status,
          resolution_notes: draft.resolution_notes.trim() || null,
          assigned_admin_user_id: user.id,
          resolved_at: willBeResolved ? new Date().toISOString() : null,
        })
        .eq("id", requestId)
        .eq("tenant_id", tenant.id);

      if (error) throw error;

      await writeAuditLog("lgpd_request_status_updated", "lgpd_data_requests", requestId, {
        status: draft.status,
      });

      toast.success("Solicitação LGPD atualizada");
      await fetchGovernanceData();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao atualizar solicitação LGPD");
    } finally {
      setIsUpdatingRequests(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Configurações" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar as configurações
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Configurações"
      subtitle="Dados do salão e governança LGPD"
    >
      <div className="grid w-full gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Dados do Salão</CardTitle>
                <CardDescription>Informações básicas do estabelecimento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Nome do Salão</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do seu salão"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@salao.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A comissão de cada profissional é definida na aba Equipe (percentual ou valor fixo por atendimento).
              </p>
              <Button
                type="submit"
                disabled={isSaving}
                className="gradient-primary text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Retenção operacional (LGPD)</CardTitle>
            </div>
            <CardDescription>
              Defina janelas de retenção e revisão periódica dos dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveRetentionPolicy} className="space-y-4">
              <div className="space-y-2">
                <Label>Dias para retenção de dados de clientes</Label>
                <Input
                  type="number"
                  min={30}
                  max={7300}
                  value={retentionPolicy.client_data_retention_days}
                  onChange={(e) =>
                    setRetentionPolicy((prev) => ({
                      ...prev,
                      client_data_retention_days: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dias para retenção de dados financeiros</Label>
                <Input
                  type="number"
                  min={365}
                  max={7300}
                  value={retentionPolicy.financial_data_retention_days}
                  onChange={(e) =>
                    setRetentionPolicy((prev) => ({
                      ...prev,
                      financial_data_retention_days: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dias para retenção da trilha de auditoria</Label>
                <Input
                  type="number"
                  min={30}
                  max={3650}
                  value={retentionPolicy.audit_log_retention_days}
                  onChange={(e) =>
                    setRetentionPolicy((prev) => ({
                      ...prev,
                      audit_log_retention_days: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <Label htmlFor="auto-cleanup" className="cursor-pointer">
                  Habilitar limpeza automática
                </Label>
                <Switch
                  id="auto-cleanup"
                  checked={retentionPolicy.auto_cleanup_enabled}
                  onCheckedChange={(checked) =>
                    setRetentionPolicy((prev) => ({ ...prev, auto_cleanup_enabled: checked }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Última revisão:{" "}
                {retentionPolicy.last_reviewed_at
                  ? new Date(retentionPolicy.last_reviewed_at).toLocaleString("pt-BR")
                  : "não registrada"}
              </p>
              <Button type="submit" disabled={isSavingRetention} className="w-full" variant="outline">
                {isSavingRetention ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar política
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <CardTitle>Solicitações de titulares (LGPD)</CardTitle>
            </div>
            <CardDescription>
              Controle de solicitações de acesso, correção, eliminação, portabilidade e direitos correlatos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingGovernance ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando solicitações...
              </div>
            ) : lgpdRequests.length === 0 ? (
              <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                Nenhuma solicitação LGPD aberta para este salão.
              </div>
            ) : (
              lgpdRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{lgpdRequestTypeLabel[request.request_type]}</p>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {lgpdStatusLabel[request.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Solicitante: {request.requester_email || request.requester_user_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abertura: {new Date(request.requested_at).toLocaleString("pt-BR")}
                  </p>
                  {request.request_details ? (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {request.request_details}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <select
                        value={requestDrafts[request.id]?.status ?? request.status}
                        onChange={(e) =>
                          setRequestDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              status: e.target.value as LgpdRequestStatus,
                              resolution_notes: prev[request.id]?.resolution_notes ?? "",
                            },
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="completed">Concluída</option>
                        <option value="rejected">Rejeitada</option>
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Resposta / Observações</Label>
                      <Textarea
                        value={requestDrafts[request.id]?.resolution_notes ?? ""}
                        onChange={(e) =>
                          setRequestDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              status: prev[request.id]?.status ?? request.status,
                              resolution_notes: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Descreva a resposta da solicitação para o titular."
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdatingRequests}
                      onClick={() => handleUpdateRequest(request.id)}
                    >
                      {isUpdatingRequests ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Salvar status
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Trilha de auditoria</CardTitle>
            </div>
            <CardDescription>
              Últimas ações administrativas registradas para fins de conformidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingGovernance ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando trilha...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                Nenhum log administrativo recente.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border/70 p-3">
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {actorNameByUserId[log.actor_user_id] || "Administrador"} ·{" "}
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {log.entity_type}
                    {log.entity_id ? ` (${log.entity_id})` : ""}
                  </p>
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground break-all">
                      {JSON.stringify(log.metadata)}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
