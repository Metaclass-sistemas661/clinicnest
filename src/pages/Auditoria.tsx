import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { Download, Eye, RefreshCw } from "lucide-react";
import { useSimpleMode } from "@/lib/simple-mode";

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

  return (
    <MainLayout
      title="Auditoria"
      subtitle="Rastreamento de ações críticas (últimos 200 registros no período)"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchAuditLogs({ showSpinner: true, reset: true })} disabled={isRefreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      }
    >
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Registros</CardTitle>
        </CardHeader>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMetadata(r.metadata);
                            setIsMetadataOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && rows.length > 0 ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                disabled={isRefreshing || !hasMore}
                onClick={() => fetchAuditLogs({ showSpinner: true, reset: false })}
              >
                {hasMore ? "Carregar mais" : "Fim"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
