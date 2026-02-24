import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { Download, Eye, RefreshCw, AlertTriangle, ShieldAlert, FileText, ClipboardList } from "lucide-react";
import { useSimpleMode } from "@/lib/simple-mode";
import jsPDF from "jspdf";
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
  const { profile, isAdmin } = useAuth();
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
  const exportClinicalPdf = () => {
    if (!clinicalRows.length) {
      toast.error("Nada para exportar");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório de Acessos Clínicos", 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 22);
    doc.text(`Gerado em: ${formatInAppTz(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

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
      startY: 34,
      head: [["Data", "Profissional", "Tipo", "Ação", "Recurso", "Paciente", "Alerta"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.cell.raw === "⚠️ SIM") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`acessos-clinicos-${startDate}-to-${endDate}.pdf`);
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="geral" className="gap-2">
            <ClipboardList className="h-4 w-4" />Geral
          </TabsTrigger>
          <TabsTrigger value="clinico" className="gap-2">
            <ShieldAlert className="h-4 w-4" />Acessos Clínicos
            {flaggedCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">{flaggedCount}</Badge>}
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
