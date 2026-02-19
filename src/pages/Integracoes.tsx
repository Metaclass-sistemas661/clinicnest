import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Webhook,
  Key,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Loader2,
  Send,
  Globe,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
  last_triggered_at?: string | null;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  status: "success" | "failed" | "pending";
  response_code: number | null;
  error_message: string | null;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_full?: string; // only set on creation
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  { id: "appointment.created",   label: "Agendamento criado",      desc: "Quando um novo agendamento é registrado" },
  { id: "appointment.confirmed", label: "Agendamento confirmado",   desc: "Quando o cliente confirma pelo link" },
  { id: "appointment.completed", label: "Atendimento concluído",    desc: "Quando uma comanda é finalizada" },
  { id: "appointment.cancelled", label: "Agendamento cancelado",    desc: "Quando um agendamento é cancelado" },
  { id: "nps.submitted",         label: "NPS respondido",           desc: "Quando um cliente envia avaliação NPS" },
  { id: "client.created",        label: "Novo cliente",             desc: "Quando um cliente é cadastrado" },
];

const API_SCOPES = [
  { id: "read:appointments",  label: "Agendamentos (leitura)" },
  { id: "read:clients",       label: "Clientes (leitura)" },
  { id: "read:financeiro",    label: "Financeiro (leitura)" },
  { id: "write:appointments", label: "Agendamentos (escrita)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return "whsec_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return "bg_live_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status }: { status: "connected" | "disconnected" | "not_configured" }) {
  if (status === "connected")     return <Badge className="bg-green-500/10 text-green-600 border-green-200">● Conectado</Badge>;
  if (status === "disconnected")  return <Badge variant="secondary">● Desconectado</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>;
}

// ─── Overview Card ────────────────────────────────────────────────────────────

function IntegrationCard({
  icon: Icon,
  title,
  description,
  status,
  onClick,
  color = "bg-primary/10 text-primary",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  status: "connected" | "disconnected" | "not_configured";
  onClick: () => void;
  color?: string;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold text-foreground">{title}</p>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Google Calendar ─────────────────────────────────────────────────────

function TabGoogleCalendar({ tenantId }: { tenantId: string }) {
  const [connected, setConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase as any)
          .from("tenants")
          .select("google_calendar_email, google_calendar_auto_sync")
          .eq("id", tenantId)
          .maybeSingle();
        if (data?.google_calendar_email) {
          setConnected(true);
          setCalendarEmail(data.google_calendar_email);
          setAutoSync(data.google_calendar_auto_sync !== false);
        }
      } catch { /* column may not exist yet */ } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tenantId]);

  const handleConnect = () => {
    // In production: redirect to Google OAuth. Requires GOOGLE_CLIENT_ID env var.
    const clientId = (window as any).__GOOGLE_CLIENT_ID__;
    if (!clientId) {
      toast.info(
        "Configuração necessária",
        { description: "Solicite ao suporte a ativação da integração com Google Calendar para sua conta." }
      );
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/integracoes?code=google`);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events");
    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await (supabase as any)
        .from("tenants")
        .update({ google_calendar_email: null, google_calendar_refresh_token: null, google_calendar_auto_sync: false })
        .eq("id", tenantId);
      setConnected(false);
      setCalendarEmail(null);
      toast.success("Google Calendar desconectado.");
    } catch { toast.error("Erro ao desconectar."); }
    finally { setIsDisconnecting(false); }
  };

  const handleToggleSync = async (v: boolean) => {
    setAutoSync(v);
    try {
      await (supabase as any)
        .from("tenants")
        .update({ google_calendar_auto_sync: v })
        .eq("id", tenantId);
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
                <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3z" fill="#4285F4"/>
                <path d="M3 8.5h18" stroke="white" strokeWidth="1.5"/>
                <path d="M8.5 3v18M15.5 3v18" stroke="white" strokeWidth="1" opacity="0.5"/>
                <rect x="6" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.9"/>
                <rect x="10.5" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.9"/>
                <rect x="15" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Google Calendar</p>
              {connected ? (
                <p className="text-sm text-muted-foreground mt-0.5">{calendarEmail}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Não conectado</p>
              )}
            </div>
            <StatusBadge status={connected ? "connected" : "disconnected"} />
          </div>

          <Separator className="my-4" />

          {connected ? (
            <div className="space-y-4">
              {/* Auto sync toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Sincronização automática</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cria eventos no Google Calendar ao confirmar agendamentos
                  </p>
                </div>
                <Switch checked={autoSync} onCheckedChange={handleToggleSync} />
              </div>

              {/* What syncs */}
              <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que é sincronizado</p>
                {[
                  "Novo agendamento → evento criado no Google",
                  "Agendamento cancelado → evento removido do Google",
                  "Horário do agendamento → título, descrição e lembrete",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissões solicitadas</p>
                {[
                  { icon: Calendar, text: "Criar e editar eventos no Google Calendar" },
                  { icon: Globe, text: "Acesso apenas à agenda selecionada" },
                  { icon: Lock, text: "Nunca lemos e-mails ou outros dados do Google" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {text}
                  </div>
                ))}
              </div>
              <Button
                className="w-full gap-2 bg-white text-gray-700 border shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={handleConnect}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Conectar com Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 flex gap-3">
        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">Como funciona a sincronização</p>
          <p>Quando um agendamento é confirmado, o sistema cria automaticamente um evento no Google Calendar do profissional responsável. Cancelamentos removem o evento. A sincronização é unidirecional (ClinicNest → Google).</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Webhooks ────────────────────────────────────────────────────────────

function TabWebhooks({ tenantId }: { tenantId: string }) {
  const [webhooks, setWebhooks] = useState<OutboundWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // New webhook form
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["appointment.created"]);
  const [formSecret] = useState(generateSecret);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [whRes, dlRes] = await Promise.all([
        (supabase as any).from("outbound_webhooks").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        (supabase as any).from("outbound_webhook_log").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      ]);
      setWebhooks((whRes.data ?? []) as OutboundWebhook[]);
      setDeliveries((dlRes.data ?? []) as WebhookDelivery[]);
    } catch { /* table may not exist */ } finally { setIsLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) { toast.error("Preencha nome e URL."); return; }
    if (!formUrl.startsWith("https://") && !formUrl.startsWith("http://")) { toast.error("URL deve começar com http:// ou https://"); return; }
    if (formEvents.length === 0) { toast.error("Selecione ao menos um evento."); return; }
    setIsSaving(true);
    try {
      const { error } = await (supabase as any).from("outbound_webhooks").insert({
        tenant_id: tenantId,
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents,
        secret: formSecret,
        active: true,
      });
      if (error) throw error;
      toast.success("Webhook registrado com sucesso!");
      setShowForm(false);
      setFormName(""); setFormUrl(""); setFormEvents(["appointment.created"]);
      load();
    } catch (e) {
      logger.error("[Webhooks] save error", e);
      toast.error("Erro ao salvar. Verifique se a tabela outbound_webhooks existe no banco.");
    } finally { setIsSaving(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await (supabase as any).from("outbound_webhooks").update({ active }).eq("id", id).eq("tenant_id", tenantId);
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase as any).from("outbound_webhooks").delete().eq("id", deleteId).eq("tenant_id", tenantId);
    setWebhooks((prev) => prev.filter((w) => w.id !== deleteId));
    setDeleteId(null);
    toast.success("Webhook removido.");
  };

  const handleTest = async (wh: OutboundWebhook) => {
    setIsTesting(wh.id);
    const payload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { message: "Teste de webhook ClinicNest", tenant_id: tenantId },
    };
    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": wh.secret },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`Teste enviado! Resposta: ${res.status}`);
      } else {
        toast.error(`Servidor retornou ${res.status}`);
      }
    } catch {
      toast.info("Teste enviado (CORS bloqueou a resposta, verifique no seu servidor)");
    } finally { setIsTesting(null); }
  };

  const toggleEvent = (ev: string) => {
    setFormEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Receba notificações HTTP em tempo real quando eventos ocorrem no ClinicNest.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" /> Novo Webhook
        </Button>
      </div>

      {/* New webhook form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registrar Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Minha integração" />
              </div>
              <div className="space-y-1.5">
                <Label>URL do endpoint <span className="text-destructive">*</span></Label>
                <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://meusite.com/webhook" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Eventos para receber</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.id} className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors",
                    formEvents.includes(ev.id) ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  )}>
                    <input
                      type="checkbox"
                      checked={formEvents.includes(ev.id)}
                      onChange={() => toggleEvent(ev.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">{ev.label}</p>
                      <p className="text-[11px] text-muted-foreground">{ev.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Secret de assinatura</Label>
              <div className="flex gap-2">
                <Input value={formSecret} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(formSecret); toast.success("Copiado!"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use este secret para validar que as requisições vêm do ClinicNest (header <code className="font-mono">X-Webhook-Secret</code>).</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving} className="gradient-primary text-primary-foreground gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Registrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks list */}
      {isLoading ? (
        <Card><CardContent className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Webhook className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum webhook configurado</p>
            <p className="text-xs text-muted-foreground max-w-xs">Clique em "Novo Webhook" para receber notificações em tempo real nos seus sistemas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const whDeliveries = deliveries.filter((d) => d.webhook_id === wh.id);
            const isExpanded = expandedId === wh.id;
            return (
              <Card key={wh.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full flex-shrink-0",
                      wh.active ? "bg-green-500" : "bg-muted-foreground/40"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{wh.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{wh.url}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={wh.active}
                        onCheckedChange={(v) => handleToggle(wh.id, v)}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleTest(wh)} disabled={isTesting === wh.id}>
                        {isTesting === wh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Testar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedId(isExpanded ? null : wh.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(wh.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {wh.events?.map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-[10px] font-mono">{ev}</Badge>
                    ))}
                  </div>

                  {/* Expanded: delivery log */}
                  {isExpanded && (
                    <div className="mt-4 space-y-2">
                      <Separator />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Últimas entregas</p>
                      {whDeliveries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma entrega registrada ainda.</p>
                      ) : (
                        <div className="divide-y rounded-lg border overflow-hidden">
                          {whDeliveries.map((d) => (
                            <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                              {d.status === "success"
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              <span className="text-xs font-mono text-muted-foreground">{d.event_type}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{fmtDate(d.created_at)}</span>
                              {d.response_code && (
                                <Badge variant={d.status === "success" ? "secondary" : "destructive"} className="text-[10px]">
                                  {d.response_code}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payload example */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Exemplo de payload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted/60 p-4 text-xs font-mono overflow-x-auto text-muted-foreground leading-relaxed">
{`POST https://seu-servidor.com/webhook
Content-Type: application/json
X-Webhook-Secret: whsec_...

{
  "event": "appointment.created",
  "timestamp": "2026-02-19T15:30:00Z",
  "data": {
    "id": "uuid-do-agendamento",
    "client_name": "Maria Silva",
    "service_name": "Consulta Clínica Geral",
    "professional_name": "Ana Lima",
    "scheduled_at": "2026-02-20T10:00:00Z",
    "tenant_id": "uuid-do-salao"
  }
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação é irreversível. O endpoint não receberá mais notificações.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab: API & Zapier ────────────────────────────────────────────────────────

function TabApiZapier({ tenantId }: { tenantId: string }) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>(["read:appointments"]);
  const [isSaving, setIsSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("api_keys")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      setApiKeys((data ?? []) as ApiKey[]);
    } catch { /* table may not exist */ } finally { setIsLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!formName.trim()) { toast.error("Informe um nome para a chave."); return; }
    if (formScopes.length === 0) { toast.error("Selecione ao menos um escopo."); return; }
    setIsSaving(true);
    const key = generateApiKey();
    try {
      const { error } = await (supabase as any).from("api_keys").insert({
        tenant_id: tenantId,
        name: formName.trim(),
        key_prefix: key.slice(0, 14), // "bg_live_XXXXXX"
        key_hash: key, // In production, store bcrypt hash
        scopes: formScopes,
        active: true,
      });
      if (error) throw error;
      setNewKey(key);
      setShowForm(false);
      setFormName(""); setFormScopes(["read:appointments"]);
      load();
    } catch (e) {
      logger.error("[ApiKeys] generate error", e);
      toast.error("Erro ao gerar chave. Verifique se a tabela api_keys existe no banco.");
    } finally { setIsSaving(false); }
  };

  const handleRevoke = async () => {
    if (!deleteId) return;
    await (supabase as any).from("api_keys").update({ active: false }).eq("id", deleteId).eq("tenant_id", tenantId);
    setApiKeys((prev) => prev.map((k) => k.id === deleteId ? { ...k, active: false } : k));
    setDeleteId(null);
    toast.success("Chave revogada.");
  };

  const toggleScope = (s: string) => {
    setFormScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  return (
    <div className="space-y-8">
      {/* API Keys section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Chaves de API</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Autentique integrações externas com chaves seguras.</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="h-4 w-4" /> Gerar Chave
          </Button>
        </div>

        {/* New key shown once */}
        {newKey && (
          <Card className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30">
            <CardContent className="pt-4 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Chave gerada! Guarde agora — não será exibida novamente.</p>
              </div>
              <div className="flex items-center gap-2">
                <code className={cn("flex-1 rounded-lg bg-background border px-3 py-2 text-xs font-mono overflow-x-auto", !showKey && "blur-sm select-none")}>
                  {newKey}
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Chave copiada!"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setNewKey(null)}>
                Já guardei, fechar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {showForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da chave</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Integração Zapier" />
              </div>
              <div className="space-y-2">
                <Label>Escopos de acesso</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {API_SCOPES.map((sc) => (
                    <label key={sc.id} className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors text-xs",
                      formScopes.includes(sc.id) ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    )}>
                      <input type="checkbox" checked={formScopes.includes(sc.id)} onChange={() => toggleScope(sc.id)} className="accent-primary" />
                      {sc.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  Gerar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chave gerada ainda.</p>
        ) : (
          <div className="divide-y rounded-xl border">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    {!k.active && <Badge variant="destructive" className="text-[10px]">Revogada</Badge>}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}••••••••</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {k.last_used_at && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {fmtDate(k.last_used_at)}
                    </span>
                  )}
                  {k.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(k.id)}
                    >
                      Revogar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Zapier / Make guide */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40">
            <Zap className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Zapier & Make</h3>
            <p className="text-xs text-muted-foreground">Automatize com 5.000+ apps usando webhooks</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Zapier card */}
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">Z</span>
                </div>
                <p className="font-semibold text-sm">Zapier</p>
              </div>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-1.5"><span className="font-bold text-foreground">1.</span>Crie um novo Zap → Trigger: "Webhooks by Zapier"</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">2.</span>Selecione "Catch Hook" e copie a URL gerada</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">3.</span>Registre essa URL aqui na aba Webhooks</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">4.</span>Configure as ações desejadas no Zapier</li>
              </ol>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => window.open("https://zapier.com/apps/webhooks", "_blank")}>
                <ExternalLink className="h-3 w-3" /> Abrir Zapier
              </Button>
            </CardContent>
          </Card>

          {/* Make card */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">M</span>
                </div>
                <p className="font-semibold text-sm">Make (Integromat)</p>
              </div>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-1.5"><span className="font-bold text-foreground">1.</span>Crie um cenário → Módulo: "Webhooks"</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">2.</span>Selecione "Custom Webhook" e copie a URL</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">3.</span>Registre a URL na aba Webhooks deste painel</li>
                <li className="flex gap-1.5"><span className="font-bold text-foreground">4.</span>Dispare um teste e configure os módulos seguintes</li>
              </ol>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => window.open("https://make.com", "_blank")}>
                <ExternalLink className="h-3 w-3" /> Abrir Make
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revoke dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave de API?</AlertDialogTitle>
            <AlertDialogDescription>Integrações que usam essa chave deixarão de funcionar imediatamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleRevoke}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Integracoes() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("overview");
  const tenantId = profile?.tenant_id ?? "";

  // Webhook count for badge
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    (supabase as any)
      .from("outbound_webhooks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .then(({ count }: { count: number | null }) => setWebhookCount(count));
  }, [tenantId]);

  const overviewCards = [
    {
      icon: Calendar,
      title: "Google Calendar",
      description: "Sincronize agendamentos com a agenda do Google dos seus profissionais",
      status: "not_configured" as const,
      tab: "google",
      color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600",
    },
    {
      icon: Webhook,
      title: "Webhooks",
      description: "Notifique sistemas externos em tempo real quando eventos ocorrem",
      status: webhookCount && webhookCount > 0 ? "connected" as const : "not_configured" as const,
      tab: "webhooks",
      color: "bg-violet-50 dark:bg-violet-950/40 text-violet-600",
    },
    {
      icon: Key,
      title: "API & Chaves",
      description: "Autentique integrações REST com chaves seguras por escopo",
      status: "not_configured" as const,
      tab: "api",
      color: "bg-amber-50 dark:bg-amber-950/40 text-amber-600",
    },
    {
      icon: Zap,
      title: "Zapier & Make",
      description: "Conecte o ClinicNest a mais de 5.000 aplicativos sem código",
      status: "not_configured" as const,
      tab: "api",
      color: "bg-orange-50 dark:bg-orange-950/40 text-orange-600",
    },
  ];

  return (
    <MainLayout title="Integrações" subtitle="Conecte o ClinicNest a ferramentas externas">
      <div className="space-y-6 pb-10">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
            <TabsTrigger value="google" className="text-xs sm:text-sm">Google</TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5 text-xs sm:text-sm">
              Webhooks
              {webhookCount != null && webhookCount > 0 && (
                <Badge className="h-4 w-4 p-0 text-[10px] flex items-center justify-center">{webhookCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs sm:text-sm">API & Zapier</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {overviewCards.map((card) => (
                <IntegrationCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  status={card.status}
                  onClick={() => setTab(card.tab)}
                  color={card.color}
                />
              ))}
            </div>

            {/* Integration tips */}
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Como as integrações funcionam
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  {[
                    { title: "Webhooks", desc: "Eventos em tempo real enviados para seus sistemas quando algo acontece no ClinicNest." },
                    { title: "API Keys", desc: "Acesse dados do ClinicNest de forma programática via endpoints REST autenticados." },
                    { title: "Zapier/Make", desc: "Conecte sem código a 5.000+ apps usando o módulo de Webhooks de cada plataforma." },
                  ].map((item) => (
                    <div key={item.title} className="space-y-1">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Google Calendar ── */}
          <TabsContent value="google" className="mt-6">
            {tenantId && <TabGoogleCalendar tenantId={tenantId} />}
          </TabsContent>

          {/* ── Webhooks ── */}
          <TabsContent value="webhooks" className="mt-6">
            {tenantId && <TabWebhooks tenantId={tenantId} />}
          </TabsContent>

          {/* ── API & Zapier ── */}
          <TabsContent value="api" className="mt-6">
            {tenantId && <TabApiZapier tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
