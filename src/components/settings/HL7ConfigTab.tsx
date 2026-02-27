import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Trash2, Copy, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Activity, ArrowDownToLine, ArrowUpFromLine, Settings2, Eye, EyeOff,
  Loader2, FileText, Clock, Building2
} from "lucide-react";

interface HL7Connection {
  id: string;
  name: string;
  description: string | null;
  connection_type: "inbound" | "outbound" | "bidirectional";
  remote_host: string | null;
  remote_port: number | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  supported_message_types: string[];
  hl7_version: string;
  sending_application: string;
  sending_facility: string | null;
  receiving_application: string | null;
  receiving_facility: string | null;
  is_active: boolean;
  last_connected_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface HL7Stats {
  total_messages: number;
  processed: number;
  failed: number;
  pending_review: number;
  active_connections: number;
  by_type: Array<{ type: string; count: number }>;
  by_day: Array<{ date: string; inbound: number; outbound: number }>;
}

interface MessageLog {
  id: string;
  direction: string;
  message_type: string;
  status: string;
  error_message: string | null;
  received_at: string;
  patient_id: string | null;
}

export function HL7ConfigTab() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [connections, setConnections] = useState<HL7Connection[]>([]);
  const [stats, setStats] = useState<HL7Stats | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [newConnection, setNewConnection] = useState({
    name: "",
    description: "",
    connection_type: "inbound" as const,
    remote_host: "",
    remote_port: "",
    webhook_url: "",
    hl7_version: "2.5",
    sending_application: "CLINICAFLOW",
    sending_facility: "",
    receiving_application: "",
    receiving_facility: "",
  });

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  async function loadData() {
    setLoading(true);
    try {
      const [connRes, statsRes, logsRes] = await Promise.all([
        supabase.from("hl7_connections").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.rpc("get_hl7_dashboard_stats", { p_tenant_id: tenantId, p_days: 30 }),
        supabase.from("hl7_message_log").select("id, direction, message_type, status, error_message, received_at, patient_id")
          .eq("tenant_id", tenantId).order("received_at", { ascending: false }).limit(50),
      ]);

      if (connRes.data) setConnections(connRes.data);
      if (statsRes.data) setStats(statsRes.data as HL7Stats);
      if (logsRes.data) setLogs(logsRes.data);
    } catch (e) {
      console.error("Error loading HL7 data:", e);
    } finally {
      setLoading(false);
    }
  }

  function generateSecret(): string {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return "hl7sec_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function createConnection() {
    if (!newConnection.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const webhookSecret = generateSecret();
    const baseUrl = window.location.origin.includes("localhost")
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

    const { error } = await supabase.from("hl7_connections").insert({
      tenant_id: tenantId,
      name: newConnection.name,
      description: newConnection.description || null,
      connection_type: newConnection.connection_type,
      remote_host: newConnection.remote_host || null,
      remote_port: newConnection.remote_port ? parseInt(newConnection.remote_port) : null,
      webhook_url: newConnection.connection_type === "inbound" ? `${baseUrl}/hl7-receiver` : (newConnection.webhook_url || null),
      webhook_secret: webhookSecret,
      hl7_version: newConnection.hl7_version,
      sending_application: newConnection.sending_application,
      sending_facility: newConnection.sending_facility || null,
      receiving_application: newConnection.receiving_application || null,
      receiving_facility: newConnection.receiving_facility || null,
    });

    if (error) {
      toast.error("Erro ao criar conexão: " + error.message);
      return;
    }

    toast.success("Conexão criada com sucesso!");
    setShowNewDialog(false);
    setNewConnection({
      name: "", description: "", connection_type: "inbound", remote_host: "", remote_port: "",
      webhook_url: "", hl7_version: "2.5", sending_application: "CLINICAFLOW",
      sending_facility: "", receiving_application: "", receiving_facility: "",
    });
    loadData();
  }

  async function toggleConnection(id: string, active: boolean) {
    const { error } = await supabase.from("hl7_connections").update({ is_active: active }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar conexão");
      return;
    }
    setConnections(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
    toast.success(active ? "Conexão ativada" : "Conexão desativada");
  }

  async function deleteConnection(id: string) {
    const { error } = await supabase.from("hl7_connections").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir conexão");
      return;
    }
    setConnections(prev => prev.filter(c => c.id !== id));
    toast.success("Conexão excluída");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_messages ?? 0}</p>
                <p className="text-xs text-muted-foreground">Mensagens (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.processed ?? 0}</p>
                <p className="text-xs text-muted-foreground">Processadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failed ?? 0}</p>
                <p className="text-xs text-muted-foreground">Com erro</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pending_review ?? 0}</p>
                <p className="text-xs text-muted-foreground">Revisão pendente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Conexões HL7
            </CardTitle>
            <CardDescription>Configure integrações com laboratórios e hospitais</CardDescription>
          </div>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conexão</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Conexão HL7</DialogTitle>
                <DialogDescription>Configure uma nova integração com laboratório ou hospital</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome *</Label>
                  <Input placeholder="Ex: Laboratório XYZ" value={newConnection.name}
                    onChange={e => setNewConnection(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Input placeholder="Descrição opcional" value={newConnection.description}
                    onChange={e => setNewConnection(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de Conexão</Label>
                  <Select value={newConnection.connection_type}
                    onValueChange={v => setNewConnection(p => ({ ...p, connection_type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Entrada (receber resultados)</SelectItem>
                      <SelectItem value="outbound">Saída (enviar pedidos)</SelectItem>
                      <SelectItem value="bidirectional">Bidirecional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Versão HL7</Label>
                    <Select value={newConnection.hl7_version}
                      onValueChange={v => setNewConnection(p => ({ ...p, hl7_version: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2.3">2.3</SelectItem>
                        <SelectItem value="2.4">2.4</SelectItem>
                        <SelectItem value="2.5">2.5</SelectItem>
                        <SelectItem value="2.5.1">2.5.1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Aplicação Remetente</Label>
                    <Input value={newConnection.sending_application}
                      onChange={e => setNewConnection(p => ({ ...p, sending_application: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Aplicação Destino</Label>
                    <Input placeholder="Ex: LAB_SYSTEM" value={newConnection.receiving_application}
                      onChange={e => setNewConnection(p => ({ ...p, receiving_application: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Facility Destino</Label>
                    <Input placeholder="Ex: LAB001" value={newConnection.receiving_facility}
                      onChange={e => setNewConnection(p => ({ ...p, receiving_facility: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
                <Button onClick={createConnection}>Criar Conexão</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma conexão configurada</p>
              <p className="text-sm">Crie uma conexão para começar a receber resultados de laboratório</p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map(conn => (
                <div key={conn.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        conn.connection_type === "inbound" ? "bg-blue-100 dark:bg-blue-900/30" :
                        conn.connection_type === "outbound" ? "bg-orange-100 dark:bg-orange-900/30" :
                        "bg-purple-100 dark:bg-purple-900/30"
                      }`}>
                        {conn.connection_type === "inbound" ? <ArrowDownToLine className="h-5 w-5 text-blue-600" /> :
                         conn.connection_type === "outbound" ? <ArrowUpFromLine className="h-5 w-5 text-orange-600" /> :
                         <RefreshCw className="h-5 w-5 text-purple-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{conn.name}</h4>
                          <Badge variant={conn.is_active ? "default" : "secondary"}>
                            {conn.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline">{conn.hl7_version}</Badge>
                        </div>
                        {conn.description && <p className="text-sm text-muted-foreground">{conn.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {conn.last_connected_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Última conexão: {formatDate(conn.last_connected_at)}
                            </span>
                          )}
                          {conn.last_error && (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="h-3 w-3" /> {conn.last_error}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={conn.is_active} onCheckedChange={v => toggleConnection(conn.id, v)} />
                      <Button variant="ghost" size="icon" onClick={() => deleteConnection(conn.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {conn.connection_type !== "outbound" && conn.webhook_url && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Webhook URL (para o laboratório enviar resultados)</Label>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(conn.webhook_url!)}>
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                      </div>
                      <code className="text-xs block bg-background p-2 rounded border">{conn.webhook_url}</code>
                      
                      <div className="flex items-center justify-between mt-2">
                        <Label className="text-xs">Secret (header X-HL7-Secret)</Label>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setShowSecrets(p => ({ ...p, [conn.id]: !p[conn.id] }))}>
                            {showSecrets[conn.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(conn.webhook_secret!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <code className="text-xs block bg-background p-2 rounded border">
                        {showSecrets[conn.id] ? conn.webhook_secret : "••••••••••••••••••••"}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Log de Mensagens
          </CardTitle>
          <CardDescription>Últimas 50 mensagens HL7 recebidas/enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma mensagem registrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paciente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{formatDate(log.received_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.direction === "inbound" ? "↓ Entrada" : "↑ Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.message_type}</TableCell>
                    <TableCell>
                      <Badge variant={
                        log.status === "processed" || log.status === "acknowledged" ? "default" :
                        log.status === "failed" ? "destructive" : "secondary"
                      } className="text-xs">
                        {log.status === "processed" ? "Processado" :
                         log.status === "acknowledged" ? "Confirmado" :
                         log.status === "failed" ? "Erro" :
                         log.status === "processing" ? "Processando" : "Recebido"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.patient_id ? "Vinculado" : log.status === "failed" ? log.error_message : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
