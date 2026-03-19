import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { Download, Eye, RefreshCw, AlertTriangle, ShieldAlert, FileText, ClipboardList, ShieldCheck, Archive, Loader2 } from "lucide-react";
import { useSimpleMode } from "@/lib/simple-mode";
import {
  BasePremiumPDFLayout,
  FONT,
  COLORS,
  renderPremiumTable,
} from "@/lib/pdf";
import autoTable from "jspdf-autotable";

type AuditLogRow = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  created_at: string;
};

type ClinicalAccessRow = {
  log_id: string;
  created_at: string;
  actor_user_id: string;
  actor_name: string;
  actor_professional_type: string;
  action: string;
  resource: string;
  resource_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  is_flagged: boolean;
  metadata: any;
};

type TeamMember = { user_id: string; full_name: string };

const RESOURCE_LABELS: Record<string, string> = {
  medical_records: "Prontuários",
  clinical_evolutions: "Evoluções",
  prescriptions: "Receituários",
  medical_certificates: "Atestados",
  referrals: "Encaminhamentos",
  nursing_evolutions: "Evol. Enfermagem",
  triage_records: "Triagens",
};

// ─── LGPD Types ────────────────────────────────────────────────────────────────

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
  due_at: string;
  sla_days: number;
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

interface LgpdAnonymizationPreview {
  target_user_id: string;
  target_profile_id: string;
  confirmation_token: string;
  warnings: string[];
  summary: Record<string, number>;
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

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function Auditoria() {
  const { user, profile, isAdmin, tenant } = useAuth();
  const { enabled: simpleModeEnabled } = useSimpleMode(profile?.tenant_id);

  const [activeTab, setActiveTab] = useState("geral");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [pageSize] = useState(200);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);

  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<unknown>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [actorUserIdFilter, setActorUserIdFilter] = useState("");

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatInAppTz(d, "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState<string>(() => formatInAppTz(new Date(), "yyyy-MM-dd"));

  // Clinical access tab state (12F.3)
  const [clinicalRows, setClinicalRows] = useState<ClinicalAccessRow[]>([]);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clinicalProfFilter, setClinicalProfFilter] = useState("all");
  const [clinicalResourceFilter, setClinicalResourceFilter] = useState("all");
  const [clinicalFlaggedOnly, setClinicalFlaggedOnly] = useState(false);

  // LGPD tab state
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
  const [isLoadingLgpd, setIsLoadingLgpd] = useState(false);
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [isUpdatingRequests, setIsUpdatingRequests] = useState(false);
  const [exportingRequestKey, setExportingRequestKey] = useState<string | null>(null);
  const [previewingRequestId, setPreviewingRequestId] = useState<string | null>(null);
  const [executingAnonymizationRequestId, setExecutingAnonymizationRequestId] = useState<string | null>(null);
  const [anonymizationPreviewByRequestId, setAnonymizationPreviewByRequestId] = useState<
    Record<string, LgpdAnonymizationPreview>
  >({});
  const [anonymizationConfirmationByRequestId, setAnonymizationConfirmationByRequestId] = useState<
    Record<string, string>
  >({});

  const canUse = !!profile?.tenant_id && !!isAdmin;

  const queryRange = useMemo(() => {
    // inclusive dates
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [startDate, endDate]);

  const fetchAuditLogs = useCallback(async (opts?: { showSpinner?: boolean; reset?: boolean }) => {
    if (!canUse) return;

    const showSpinner = opts?.showSpinner ?? false;
    const reset = opts?.reset ?? false;
    if (showSpinner) setIsRefreshing(true);

    try {
      const nextPage = reset ? 0 : pageRef.current;
      let q = supabase
        .from("audit_logs")
        .select("id,tenant_id,actor_user_id,action,entity_type,entity_id,metadata,created_at")
        .eq("tenant_id", profile!.tenant_id)
        .gte("created_at", queryRange.startIso)
        .lte("created_at", queryRange.endIso)
        .order("created_at", { ascending: false })
        .range(nextPage * pageSize, nextPage * pageSize + pageSize - 1);

      const a = actionFilter.trim();
      const et = entityTypeFilter.trim();
      const eid = entityIdFilter.trim();
      const au = actorUserIdFilter.trim();

      if (a) q = q.ilike("action", `%${a}%`);
      if (et) q = q.ilike("entity_type", `%${et}%`);
      if (eid) q = q.ilike("entity_id", `%${eid}%`);
      if (au) q = q.eq("actor_user_id", au);

      const { data, error } = await q;
      if (error) throw error;

      const newRows = (data as AuditLogRow[]) || [];
      setRows((current) => (reset ? newRows : [...current, ...newRows]));
      setHasMore(newRows.length === pageSize);
      pageRef.current = nextPage + 1;
      setPage(pageRef.current);
    } catch (e) {
      logger.error("Error fetching audit logs:", e);
      toast.error("Erro ao carregar auditoria");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canUse, profile, queryRange.startIso, queryRange.endIso, actionFilter, entityTypeFilter, entityIdFilter, actorUserIdFilter, pageSize]);

  useEffect(() => {
    setRows([]);
    pageRef.current = 0;
    setPage(0);
    setHasMore(true);
    fetchAuditLogs({ reset: true });
  }, [fetchAuditLogs]);

  // Fetch team members for filter dropdown
  useEffect(() => {
    if (!canUse) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", profile!.tenant_id)
      .order("full_name")
      .then(({ data }) => setTeamMembers((data ?? []) as TeamMember[]));
  }, [canUse, profile?.tenant_id]);

  // Fetch clinical access report (12F.3)
  const fetchClinicalAccess = useCallback(async () => {
    if (!canUse) return;
    setClinicalLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_clinical_access_report", {
        p_start_date: `${startDate}T00:00:00.000Z`,
        p_end_date: `${endDate}T23:59:59.999Z`,
        p_professional_id: clinicalProfFilter !== "all" ? clinicalProfFilter : null,
        p_resource_filter: clinicalResourceFilter !== "all" ? clinicalResourceFilter : null,
        p_flagged_only: clinicalFlaggedOnly,
        p_limit_rows: 500,
      });
      if (error) throw error;
      setClinicalRows((data ?? []) as ClinicalAccessRow[]);
    } catch (e) {
      logger.error("Error fetching clinical access report:", e);
      toast.error("Erro ao carregar acessos clínicos");
    } finally {
      setClinicalLoading(false);
    }
  }, [canUse, startDate, endDate, clinicalProfFilter, clinicalResourceFilter, clinicalFlaggedOnly]);

  useEffect(() => {
    if (activeTab === "clinico") fetchClinicalAccess();
  }, [activeTab, fetchClinicalAccess]);

  // ─── LGPD Functions ────────────────────────────────────────────────────────────

  const getStatusBadgeVariant = (status: LgpdRequestStatus): "secondary" | "default" | "destructive" => {
    if (status === "completed") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  const getSlaInfo = (request: LgpdDataRequest): {
    label: string;
    variant: "default" | "secondary" | "destructive";
  } => {
    if (request.status === "completed" || request.status === "rejected") {
      return { label: "Encerrada", variant: "default" };
    }
    const dueAtMs = new Date(request.due_at).getTime();
    const nowMs = Date.now();
    const daysRemaining = Math.ceil((dueAtMs - nowMs) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) {
      return { label: `Atrasada (${Math.abs(daysRemaining)} dia(s))`, variant: "destructive" };
    }
    if (daysRemaining <= 3) {
      return { label: `Prazo crítico (${daysRemaining} dia(s))`, variant: "secondary" };
    }
    return { label: `No prazo (${daysRemaining} dia(s))`, variant: "default" };
  };

  const sanitizeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

  const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const raw =
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const toCsvLgpd = (rows: Record<string, unknown>[]): string => {
    if (!rows.length) return "";
    const headers = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    );
    if (!headers.length) return "";
    const headerLine = headers.map(csvEscape).join(",");
    const lines = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","));
    return [headerLine, ...lines].join("\n");
  };

  const normalizeDatasetRows = (dataset: unknown): Record<string, unknown>[] => {
    if (Array.isArray(dataset)) {
      return dataset.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
    }
    if (dataset && typeof dataset === "object" && !Array.isArray(dataset)) {
      return [dataset as Record<string, unknown>];
    }
    return [];
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
      p_metadata: (metadata ?? {}) as unknown as Json,
    });
    if (error) {
      logger.warn("Falha ao gravar trilha de auditoria", { action, entityType, error });
    }
  };

  const fetchLgpdData = useCallback(async () => {
    if (!tenant?.id || !isAdmin) return;
    setIsLoadingLgpd(true);

    try {
      const [requestsRes, retentionRes] = await Promise.all([
        supabase
          .from("lgpd_data_requests")
          .select(
            "id, requester_user_id, requester_email, request_type, request_details, status, assigned_admin_user_id, resolution_notes, requested_at, due_at, sla_days, resolved_at"
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
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (retentionRes.error) throw retentionRes.error;

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
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao carregar dados LGPD");
    } finally {
      setIsLoadingLgpd(false);
    }
  }, [tenant?.id, isAdmin]);

  useEffect(() => {
    if (activeTab === "lgpd") fetchLgpdData();
  }, [activeTab, fetchLgpdData]);

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
      await fetchLgpdData();
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
      await fetchLgpdData();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao atualizar solicitação LGPD");
    } finally {
      setIsUpdatingRequests(false);
    }
  };

  const handleExportSubjectData = async (
    request: LgpdDataRequest,
    format: "json" | "csv"
  ) => {
    if (!tenant?.id) return;

    const loadingKey = `${request.id}:${format}`;
    setExportingRequestKey(loadingKey);
    try {
      const { data, error } = await supabase.rpc("export_lgpd_data_subject", {
        p_tenant_id: tenant.id,
        p_target_user_id: request.requester_user_id,
        p_format: format,
      });

      if (error) throw error;

      const safeBase = sanitizeFilePart(
        `lgpd-${request.requester_email || request.requester_user_id}-${new Date().toISOString().slice(0, 10)}`
      );

      if (format === "json") {
        downloadTextFile(
          `${safeBase}.json`,
          JSON.stringify(data, null, 2),
          "application/json;charset=utf-8"
        );
      } else {
        const payload = (data || {}) as Record<string, unknown>;
        const datasets = ((payload.datasets || {}) as Record<string, unknown>) ?? {};
        const sections: string[] = [];

        for (const [datasetName, rawDataset] of Object.entries(datasets)) {
          const rows = normalizeDatasetRows(rawDataset);
          const csv = toCsvLgpd(rows);
          if (csv) {
            sections.push(`# ${datasetName}\n${csv}`);
          }
        }

        if (!sections.length) {
          throw new Error("Nenhum dado disponível para CSV.");
        }

        downloadTextFile(`${safeBase}.csv`, sections.join("\n\n"), "text/csv;charset=utf-8");
      }

      toast.success(`Exportação ${format.toUpperCase()} concluída`);
    } catch (e) {
      logger.error(e);
      toast.error(`Erro ao exportar dados em ${format.toUpperCase()}`);
    } finally {
      setExportingRequestKey(null);
    }
  };

  const handlePreviewAnonymization = async (request: LgpdDataRequest) => {
    if (!tenant?.id) return;

    setPreviewingRequestId(request.id);
    try {
      const { data, error } = await supabase.rpc("preview_lgpd_anonymization", {
        p_tenant_id: tenant.id,
        p_target_user_id: request.requester_user_id,
      });
      if (error) throw error;

      setAnonymizationPreviewByRequestId((prev) => ({
        ...prev,
        [request.id]: data as unknown as LgpdAnonymizationPreview,
      }));
      setAnonymizationConfirmationByRequestId((prev) => ({
        ...prev,
        [request.id]: "",
      }));
      toast.success("Prévia de anonimização gerada");
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao gerar prévia de anonimização");
    } finally {
      setPreviewingRequestId(null);
    }
  };

  const handleExecuteAnonymization = async (request: LgpdDataRequest) => {
    if (!tenant?.id) return;

    const confirmation = anonymizationConfirmationByRequestId[request.id]?.trim() || "";
    if (!confirmation) {
      toast.error("Digite o token de confirmação da anonimização");
      return;
    }

    setExecutingAnonymizationRequestId(request.id);
    try {
      const { error } = await supabase.rpc("execute_lgpd_anonymization", {
        p_tenant_id: tenant.id,
        p_target_user_id: request.requester_user_id,
        p_confirmation_token: confirmation,
        p_request_id: request.id,
      });
      if (error) throw error;

      toast.success("Anonimização executada com sucesso");
      await fetchLgpdData();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao executar anonimização");
    } finally {
      setExecutingAnonymizationRequestId(null);
    }
  };

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nada para exportar");
      return;
    }

    const headers = [
      "created_at",
      "action",
      "entity_type",
      "entity_id",
      "actor_user_id",
      "metadata",
    ];

    const lines = rows.map((r) => {
      const cols = [
        r.created_at,
        r.action,
        r.entity_type ?? "",
        r.entity_id ?? "",
        r.actor_user_id ?? "",
        toCsvValue(r.metadata),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      return cols.join(",");
    });

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  // 12F.5: Export clinical access CSV
  const exportClinicalCsv = () => {
    if (!clinicalRows.length) {
      toast.error("Nada para exportar");
      return;
    }
    const headers = ["data", "profissional", "tipo", "acao", "recurso", "paciente", "alerta"];
    const lines = clinicalRows.map((r) => {
      const cols = [
        formatInAppTz(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
        r.actor_name,
        r.actor_professional_type,
        r.action === "clinical_access" ? "Acesso" : "Negado",
        RESOURCE_LABELS[r.resource] ?? r.resource,
        r.patient_name ?? "",
        r.is_flagged ? "SIM" : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      return cols.join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acessos-clinicos-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  // 12F.5: Export clinical access PDF
  const exportClinicalPdf = async () => {
    if (!clinicalRows.length) {
      toast.error("Nada para exportar");
      return;
    }
    const layout = new BasePremiumPDFLayout(
      { name: "ClinicNest" },
      {
        title: "Relatório de Acessos Clínicos",
        accentColor: "#3b82f6",
        orientation: "landscape",
        subtitle: `Período: ${startDate} a ${endDate}`,
      },
    );
    await layout.init();
    const doc = layout.doc;
    const m = layout.margin;
    let y = layout.contentStartY;

    const tableData = clinicalRows.map((r) => [
      formatInAppTz(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
      r.actor_name,
      r.actor_professional_type,
      r.action === "clinical_access" ? "Acesso" : "Negado",
      RESOURCE_LABELS[r.resource] ?? r.resource,
      r.patient_name ?? "—",
      r.is_flagged ? "⚠️ SIM" : "",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Data", "Profissional", "Tipo", "Ação", "Recurso", "Paciente", "Alerta"]],
      body: tableData,
      styles: { fontSize: FONT.SMALL, font: FONT.FAMILY, lineWidth: 0.1, lineColor: COLORS.BORDER },
      headStyles: { fillColor: layout.accent, textColor: COLORS.WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.BG_ZEBRA },
      margin: { left: m, right: m },
      tableWidth: layout.contentW,
      didParseCell: (data) => {
        if (data.column.index === 6 && data.cell.raw === "⚠️ SIM") {
          data.cell.styles.textColor = COLORS.DANGER;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    layout.finalize(`acessos-clinicos-${startDate}-to-${endDate}.pdf`);
    toast.success("PDF exportado");
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Auditoria" subtitle="Acesso restrito">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Apenas administradores podem acessar a auditoria.
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  if (simpleModeEnabled) {
    return (
      <MainLayout title="Auditoria" subtitle="Indisponível no modo simples">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Este recurso fica oculto no modo simples para reduzir opções avançadas.
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const flaggedCount = clinicalRows.filter((r) => r.is_flagged).length;
  const deniedCount = clinicalRows.filter((r) => r.action === "access_denied").length;

  return (
    <MainLayout
      title="Auditoria"
      subtitle="Rastreamento de ações e acessos clínicos (LGPD/ONA)"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => activeTab === "geral" ? fetchAuditLogs({ showSpinner: true, reset: true }) : fetchClinicalAccess()} disabled={isRefreshing || clinicalLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          {activeTab === "geral" ? (
            <Button onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={exportClinicalCsv} disabled={!clinicalRows.length}>
                <Download className="mr-2 h-4 w-4" />CSV
              </Button>
              <Button onClick={exportClinicalPdf} disabled={!clinicalRows.length}>
                <FileText className="mr-2 h-4 w-4" />PDF
              </Button>
            </>
          )}
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="geral" className="gap-2">
            <ClipboardList className="h-4 w-4" />Geral
          </TabsTrigger>
          <TabsTrigger value="clinico" className="gap-2">
            <ShieldAlert className="h-4 w-4" />Acessos Clínicos
            {flaggedCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">{flaggedCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="lgpd" className="gap-2">
            <ShieldCheck className="h-4 w-4" />LGPD
          </TabsTrigger>
        </TabsList>

        {/* Tab Geral */}
        <TabsContent value="geral" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>De</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ação</Label>
                <Input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="ex: appointment_created" />
              </div>
              <div className="space-y-2">
                <Label>Tipo entidade</Label>
                <Input value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} placeholder="ex: appointment" />
              </div>
              <div className="space-y-2">
                <Label>ID entidade</Label>
                <Input value={entityIdFilter} onChange={(e) => setEntityIdFilter(e.target.value)} placeholder="uuid" />
              </div>
              <div className="space-y-2">
                <Label>Actor user_id</Label>
                <Input value={actorUserIdFilter} onChange={(e) => setActorUserIdFilter(e.target.value)} placeholder="uuid" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Button variant="secondary" onClick={() => fetchAuditLogs({ showSpinner: true, reset: true })} disabled={isRefreshing}>
                  Aplicar filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Registros</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Nenhum registro no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Metadata</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{formatInAppTz(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="font-mono text-xs">{r.action}</TableCell>
                          <TableCell className="font-mono text-xs">{r.entity_type ?? ""}</TableCell>
                          <TableCell className="font-mono text-xs">{r.entity_id ?? ""}</TableCell>
                          <TableCell className="font-mono text-xs">{r.actor_user_id ?? ""}</TableCell>
                          <TableCell className="max-w-[520px] truncate font-mono text-xs">{toCsvValue(r.metadata)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedMetadata(r.metadata); setIsMetadataOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!isLoading && rows.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" disabled={isRefreshing || !hasMore} onClick={() => fetchAuditLogs({ showSpinner: true, reset: false })}>
                    {hasMore ? "Carregar mais" : "Fim"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Acessos Clínicos (12F.3 + 12F.4) */}
        <TabsContent value="clinico" className="space-y-4">
          {/* KPIs */}
          {(flaggedCount > 0 || deniedCount > 0) && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{flaggedCount}</p>
                    <p className="text-xs text-muted-foreground">Acessos incomuns</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <ShieldAlert className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">{deniedCount}</p>
                    <p className="text-xs text-muted-foreground">Acessos negados</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>De</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={clinicalProfFilter} onValueChange={setClinicalProfFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {teamMembers.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recurso</Label>
                <Select value={clinicalResourceFilter} onValueChange={setClinicalResourceFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(RESOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 md:col-span-2 lg:col-span-4">
                <Checkbox id="flagged" checked={clinicalFlaggedOnly} onCheckedChange={(c) => setClinicalFlaggedOnly(!!c)} />
                <Label htmlFor="flagged" className="text-sm cursor-pointer">Apenas acessos incomuns (sem agendamento recente)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Acessos a Dados Clínicos</CardTitle></CardHeader>
            <CardContent>
              {clinicalLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : clinicalRows.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Nenhum acesso clínico registrado no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Alerta</TableHead>
                        <TableHead className="text-right">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clinicalRows.map((r) => (
                        <TableRow key={r.log_id} className={r.is_flagged ? "bg-amber-500/5" : r.action === "access_denied" ? "bg-red-500/5" : ""}>
                          <TableCell className="whitespace-nowrap">{formatInAppTz(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="font-medium">{r.actor_name}</TableCell>
                          <TableCell className="text-xs">{r.actor_professional_type}</TableCell>
                          <TableCell>
                            <Badge variant={r.action === "access_denied" ? "destructive" : "secondary"} className="text-xs">
                              {r.action === "clinical_access" ? "Acesso" : "Negado"}
                            </Badge>
                          </TableCell>
                          <TableCell>{RESOURCE_LABELS[r.resource] ?? r.resource}</TableCell>
                          <TableCell>{r.patient_name ?? "—"}</TableCell>
                          <TableCell>
                            {r.is_flagged && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1">
                                <AlertTriangle className="h-3 w-3" />Incomum
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedMetadata(r.metadata); setIsMetadataOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab LGPD */}
        <TabsContent value="lgpd" className="space-y-6">
          {/* Política de Retenção */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Política de Retenção</CardTitle>
                  <CardDescription>
                    Defina janelas de retenção e revisão periódica dos dados
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRetentionPolicy} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Dados de pacientes (dias)</Label>
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
                    <Label>Dados financeiros (dias)</Label>
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
                    <Label>Trilha de auditoria (dias)</Label>
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
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-cleanup" className="cursor-pointer font-medium">
                      Habilitar limpeza automática
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Remove dados automaticamente após o período de retenção
                    </p>
                  </div>
                  <Switch
                    id="auto-cleanup"
                    checked={retentionPolicy.auto_cleanup_enabled}
                    onCheckedChange={(checked) =>
                      setRetentionPolicy((prev) => ({ ...prev, auto_cleanup_enabled: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Última revisão:{" "}
                    {retentionPolicy.last_reviewed_at
                      ? new Date(retentionPolicy.last_reviewed_at).toLocaleString("pt-BR")
                      : "não registrada"}
                  </p>
                  <Button type="submit" disabled={isSavingRetention} variant="outline">
                    {isSavingRetention ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar política
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Solicitações de Titulares */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Solicitações de Titulares</CardTitle>
                  <CardDescription>
                    Controle de solicitações de acesso, correção, eliminação, portabilidade e direitos correlatos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLgpd ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando solicitações...
                </div>
              ) : lgpdRequests.length === 0 ? (
                <div className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground text-center">
                  Nenhuma solicitação LGPD aberta para esta clínica.
                </div>
              ) : (
                lgpdRequests.map((request) => {
                  const slaInfo = getSlaInfo(request);
                  return (
                    <div key={request.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{lgpdRequestTypeLabel[request.request_type]}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(request.status)}>
                            {lgpdStatusLabel[request.status]}
                          </Badge>
                          <Badge variant={slaInfo.variant}>{slaInfo.label}</Badge>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Solicitante: {request.requester_email || request.requester_user_id}</p>
                        <p>Abertura: {new Date(request.requested_at).toLocaleString("pt-BR")}</p>
                        <p>Prazo LGPD: {new Date(request.due_at).toLocaleString("pt-BR")} ({request.sla_days} dia(s))</p>
                      </div>

                      {request.request_details && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded">
                          {request.request_details}
                        </p>
                      )}

                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={exportingRequestKey === `${request.id}:json`}
                          onClick={() => handleExportSubjectData(request, "json")}
                        >
                          {exportingRequestKey === `${request.id}:json` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Exportar JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={exportingRequestKey === `${request.id}:csv`}
                          onClick={() => handleExportSubjectData(request, "csv")}
                        >
                          {exportingRequestKey === `${request.id}:csv` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Exportar CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={previewingRequestId === request.id}
                          onClick={() => handlePreviewAnonymization(request)}
                        >
                          {previewingRequestId === request.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldAlert className="mr-2 h-4 w-4" />
                          )}
                          Prévia anonimização
                        </Button>
                      </div>

                      {anonymizationPreviewByRequestId[request.id] && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Dry-run de anonimização
                          </p>
                          <div className="grid gap-1">
                            {Object.entries(anonymizationPreviewByRequestId[request.id].summary).map(
                              ([key, value]) => (
                                <p key={key} className="text-xs text-amber-900/80 dark:text-amber-300">
                                  {key}: {value}
                                </p>
                              )
                            )}
                          </div>
                          {(anonymizationPreviewByRequestId[request.id].warnings || []).length > 0 && (
                            <div className="space-y-1">
                              {anonymizationPreviewByRequestId[request.id].warnings.map((warning) => (
                                <p key={warning} className="text-xs text-amber-800 dark:text-amber-400">
                                  ⚠ {warning}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-amber-900 dark:text-amber-200">
                            Confirme digitando o token:{" "}
                            <span className="font-mono font-semibold">
                              {anonymizationPreviewByRequestId[request.id].confirmation_token}
                            </span>
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={anonymizationConfirmationByRequestId[request.id] || ""}
                              onChange={(e) =>
                                setAnonymizationConfirmationByRequestId((prev) => ({
                                  ...prev,
                                  [request.id]: e.target.value,
                                }))
                              }
                              placeholder="Digite o token de confirmação"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={executingAnonymizationRequestId === request.id}
                              onClick={() => handleExecuteAnonymization(request)}
                            >
                              {executingAnonymizationRequestId === request.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Executar anonimização
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
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
                            rows={2}
                            placeholder="Descreva a resposta da solicitação para o titular."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingRequests}
                          onClick={() => handleUpdateRequest(request.id)}
                        >
                          {isUpdatingRequests && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar status
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Metadata</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
            {(() => {
              try {
                return JSON.stringify(selectedMetadata, null, 2);
              } catch {
                return String(selectedMetadata ?? "");
              }
            })()}
          </pre>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
