import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStatus } from "@/contexts/AppStatusContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { offlineCache } from "@/lib/offline-cache";
import { toast } from "sonner";
import {
  Wifi, WifiOff, RefreshCw, Trash2, Database, Calendar, Users, Briefcase, UserCog,
  CheckCircle2, AlertCircle, Loader2, CloudOff, Cloud
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CacheStats {
  appointments: { count: number; lastSync: string | null };
  patients: { count: number; lastSync: string | null };
  services: { count: number; lastSync: string | null };
  professionals: { count: number; lastSync: string | null };
  pendingSyncs: number;
}

export function OfflineSettings() {
  const { profile } = useAuth();
  const { isOnline } = useAppStatus();
  const { syncing, lastSyncAt, pendingSyncs, forceSync } = useOfflineSync({ autoSync: false });
  const tenantId = profile?.tenant_id;

  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadStats();
  }, [tenantId, lastSyncAt]);

  async function loadStats() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const cacheStats = await offlineCache.getCacheStats(tenantId);
      setStats(cacheStats);
    } catch (e) {
      console.error("Error loading cache stats:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    await forceSync();
    await loadStats();
    toast.success("Dados sincronizados!");
  }

  async function handleClearCache() {
    setClearing(true);
    try {
      await offlineCache.clearAll();
      await loadStats();
      toast.success("Cache limpo com sucesso!");
    } catch (e) {
      toast.error("Erro ao limpar cache");
    } finally {
      setClearing(false);
    }
  }

  function formatLastSync(date: string | null): string {
    if (!date) return "Nunca";
    const d = new Date(date);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Agora mesmo";
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return d.toLocaleDateString("pt-BR");
  }

  const totalCached = stats
    ? stats.appointments.count + stats.patients.count + stats.services.count + stats.professionals.count
    : 0;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className={cn(isOnline ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20")}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <Wifi className="h-6 w-6 text-success" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <WifiOff className="h-6 w-6 text-amber-600" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{isOnline ? "Online" : "Offline"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isOnline
                    ? "Conectado ao servidor. Dados sincronizados em tempo real."
                    : "Sem conexão. Usando dados em cache."}
                </p>
              </div>
            </div>
            <Badge variant={isOnline ? "default" : "secondary"} className={cn(isOnline ? "bg-success" : "bg-amber-500")}>
              {isOnline ? <Cloud className="h-3 w-3 mr-1" /> : <CloudOff className="h-3 w-3 mr-1" />}
              {isOnline ? "Conectado" : "Offline"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Cache Offline
          </CardTitle>
          <CardDescription>
            Dados armazenados localmente para uso sem internet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" className="text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.appointments.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Agendamentos</p>
                    <p className="text-xs text-muted-foreground">{formatLastSync(stats?.appointments.lastSync || null)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-8 w-8 text-violet-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.patients.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Pacientes</p>
                    <p className="text-xs text-muted-foreground">{formatLastSync(stats?.patients.lastSync || null)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Briefcase className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.services.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Procedimentos</p>
                    <p className="text-xs text-muted-foreground">{formatLastSync(stats?.services.lastSync || null)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <UserCog className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats?.professionals.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Profissionais</p>
                    <p className="text-xs text-muted-foreground">{formatLastSync(stats?.professionals.lastSync || null)}</p>
                  </div>
                </div>
              </div>

              {/* Pending Syncs */}
              {pendingSyncs > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {pendingSyncs} alterações pendentes
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Serão sincronizadas quando a conexão for restabelecida
                    </p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Total em cache</p>
                  <p className="text-xl font-bold">{totalCached} registros</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Última sincronização</p>
                  <p className="font-medium">{formatLastSync(lastSyncAt)}</p>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClearCache} disabled={clearing || syncing}>
              {clearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Limpar Cache
            </Button>
            <Button onClick={handleSync} disabled={syncing || !isOnline}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o modo offline?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <CheckCircle2 className="h-4 w-4 inline mr-2 text-green-500" />
            <strong>Visualização:</strong> Você pode ver agendamentos, pacientes e procedimentos mesmo sem internet.
          </p>
          <p>
            <CheckCircle2 className="h-4 w-4 inline mr-2 text-green-500" />
            <strong>Sincronização automática:</strong> Os dados são atualizados automaticamente quando você está online.
          </p>
          <p>
            <AlertCircle className="h-4 w-4 inline mr-2 text-amber-500" />
            <strong>Limitações:</strong> Algumas ações como criar agendamentos ou editar prontuários requerem conexão.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
