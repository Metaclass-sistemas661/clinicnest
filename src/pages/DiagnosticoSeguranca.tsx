import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getSecurityDiagnosticsV1, type SecurityDiagnosticsV1 } from "@/lib/supabase-typed-rpc";
import { CheckCircle2, XCircle, RefreshCw, Shield } from "lucide-react";

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-destructive"}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {ok ? "OK" : "FAIL"}
    </span>
  );
}

export default function DiagnosticoSeguranca() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<SecurityDiagnosticsV1 | null>(null);

  const run = useCallback(async (opts?: { spinner?: boolean }) => {
    const spinner = opts?.spinner ?? false;
    if (spinner) setIsRefreshing(true);
    try {
      const { data, error } = await getSecurityDiagnosticsV1();
      if (error) throw error;
      setData(data);
    } catch (e) {
      logger.error("Error loading security diagnostics:", e);
      toast.error("Erro ao carregar diagnóstico");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const summary = useMemo(() => {
    const rlsOk = (data?.rls ?? []).every((r) => r.rls_enabled);
    const trgOk = (data?.triggers ?? []).every((t) => t.exists);
    const fnOk = (data?.functions ?? []).every((f) => f.exists);
    const idxOk = (data?.indexes ?? []).every((i) => i.exists);
    const totalOk = rlsOk && trgOk && fnOk && idxOk;
    return { rlsOk, trgOk, fnOk, idxOk, totalOk };
  }, [data]);

  return (
    <MainLayout
      title="Diagnóstico de Segurança"
      subtitle="Checks read-only do baseline (RLS, triggers, RPCs e índices)"
      actions={
        <Button variant="outline" onClick={() => run({ spinner: true })} disabled={isRefreshing}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
    >
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>RLS</span>
            <StatusBadge ok={summary.rlsOk} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Triggers</span>
            <StatusBadge ok={summary.trgOk} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>RPCs</span>
            <StatusBadge ok={summary.fnOk} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Índices</span>
            <StatusBadge ok={summary.idxOk} />
          </div>
          <div className="md:col-span-4 flex items-center justify-between rounded-lg border p-3">
            <span className="font-medium">Baseline</span>
            <StatusBadge ok={summary.totalOk} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data ? (
            <div className="py-8 text-center text-muted-foreground">Sem dados.</div>
          ) : (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Tenant: <span className="font-mono">{data.tenant_id}</span>
              </div>

              <div className="space-y-2">
                <div className="font-medium">RLS</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {data.rls.map((r) => (
                    <div key={r.table} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-mono text-xs">{r.table}</span>
                      <StatusBadge ok={r.rls_enabled} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Write-guard triggers</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {data.triggers.map((t) => (
                    <div key={t.name} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-mono text-xs">{t.name}</span>
                      <StatusBadge ok={t.exists} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Funções/RPCs</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {data.functions.map((f) => (
                    <div key={f.name} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-mono text-xs">{f.name}</span>
                      <StatusBadge ok={f.exists} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Índices</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {data.indexes.map((i) => (
                    <div key={i.name} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-mono text-xs">{i.name}</span>
                      <StatusBadge ok={i.exists} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
