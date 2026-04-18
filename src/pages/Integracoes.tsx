import { Spinner } from "@/components/ui/spinner";
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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
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
  CreditCard,
  Smartphone,
  Wifi,
  FileText,
  Building2,
} from "lucide-react";
import { NFSeConfig } from "@/components/settings/NFSeConfig";
import { RNDSConfigTab } from "@/components/settings/RNDSConfigTab";
import { HL7ConfigTab } from "@/components/settings/HL7ConfigTab";

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
  { id: "appointment.confirmed", label: "Agendamento confirmado",   desc: "Quando o paciente confirma pelo link" },
  { id: "appointment.completed", label: "Atendimento concluído",    desc: "Quando uma conta é finalizada" },
  { id: "appointment.cancelled", label: "Agendamento cancelado",    desc: "Quando um agendamento é cancelado" },
  { id: "nps.submitted",         label: "NPS respondido",           desc: "Quando um paciente envia avaliação NPS" },
  { id: "client.created",        label: "Novo paciente",            desc: "Quando um paciente é cadastrado" },
];

const API_SCOPES = [
  { id: "read:appointments",  label: "Agendamentos (leitura)" },
  { id: "read:clients",       label: "Pacientes (leitura)" },
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
  if (status === "connected")     return <Badge className="bg-success/10 text-success border-success/20">● Conectado</Badge>;
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
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
        const { data } = await (api as any)
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
      await (api as any)
        .from("tenants")
        .update({ google_calendar_email: null, google_calendar_refresh_token: null, google_calendar_auto_sync: false })
        .eq("id", tenantId);
      setConnected(false);
      setCalendarEmail(null);
      toast.success("Google Calendar desconectado.");
    } catch { toast.error("Erro ao desconectar", { description: "Não foi possível desconectar o Google Calendar." }); }
    finally { setIsDisconnecting(false); }
  };

  const handleToggleSync = async (v: boolean) => {
    setAutoSync(v);
    try {
      await (api as any)
        .from("tenants")
        .update({ google_calendar_auto_sync: v })
        .eq("id", tenantId);
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
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
        (api as any).from("outbound_webhooks").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        (api as any).from("outbound_webhook_log").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
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
      const { error } = await (api as any).from("outbound_webhooks").insert({
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
      toast.error("Erro ao salvar webhook", { description: normalizeError(e, "Verifique se a tabela outbound_webhooks existe no banco.") });
    } finally { setIsSaving(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await (api as any).from("outbound_webhooks").update({ active }).eq("id", id).eq("tenant_id", tenantId);
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (api as any).from("outbound_webhooks").delete().eq("id", deleteId).eq("tenant_id", tenantId);
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
        toast.error("Erro no teste de webhook", { description: `O servidor retornou status ${res.status}.` });
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
                  <label key={ev.id} aria-label={ev.label} className={cn(
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
              <Button onClick={handleSave} disabled={isSaving} variant="gradient" className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Registrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks list */}
      {isLoading ? (
        <Card><CardContent className="flex h-32 items-center justify-center"><Spinner size="sm" className="text-muted-foreground" /></CardContent></Card>
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
                        {isTesting === wh.id ? <Spinner size="sm" /> : <Send className="h-3 w-3" />}
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
    "tenant_id": "uuid-da-clinica"
  }
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        itemName="este webhook"
        itemType="webhook"
        warningText="O endpoint não receberá mais notificações."
        confirmButtonText="Remover"
      />
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
      const { data } = await (api as any)
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
      const { error } = await (api as any).from("api_keys").insert({
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
      toast.error("Erro ao gerar chave de API", { description: normalizeError(e, "Verifique se a tabela api_keys existe no banco.") });
    } finally { setIsSaving(false); }
  };

  const handleRevoke = async () => {
    if (!deleteId) return;
    await (api as any).from("api_keys").update({ active: false }).eq("id", deleteId).eq("tenant_id", tenantId);
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
          <div className="flex justify-center py-6"><Spinner size="sm" className="text-muted-foreground" /></div>
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
      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={handleRevoke}
        onCancel={() => setDeleteId(null)}
        itemName="esta chave de API"
        itemType="chave de API"
        warningText="Integrações que usam essa chave deixarão de funcionar imediatamente."
        confirmButtonText="Revogar"
      />
    </div>
  );
}

// ─── Tab: Gateway de Pagamento ────────────────────────────────────────────────

function TabPaymentGateway({ tenantId }: { tenantId: string }) {
  const [gateway, setGateway] = useState<"" | "stripe" | "pagseguro" | "asaas">("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (api as any)
          .from("tenants")
          .select("payment_gateway_type, payment_gateway_config")
          .eq("id", tenantId)
          .maybeSingle();
        if (data) {
          setGateway(data.payment_gateway_type ?? "");
          setApiKey(data.payment_gateway_config?.api_key ?? "");
        }
      } catch { /* column may not exist yet */ } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    if (gateway && !apiKey.trim()) { 
      toast.error("Informe a chave de API do gateway."); 
      return; 
    }
    setIsSaving(true);
    try {
      const { error } = await (api as any)
        .from("tenants")
        .update({
          payment_gateway_type: gateway || null,
          payment_gateway_config: apiKey.trim() ? { api_key: apiKey.trim() } : {},
        })
        .eq("id", tenantId);
      if (error) throw error;
      toast.success("Gateway de pagamento configurado!");
    } catch (e) {
      logger.error("[PaymentGateway] save error", e);
      toast.error("Erro ao salvar configurações de pagamento", { description: normalizeError(e, "Não foi possível salvar o gateway.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await (api as any)
        .from("tenants")
        .update({ payment_gateway_type: null, payment_gateway_config: {} })
        .eq("id", tenantId);
      setGateway(""); setApiKey("");
      toast.success("Gateway de pagamento removido.");
    } catch { toast.error("Erro ao remover gateway", { description: "Não foi possível remover o gateway de pagamento." }); }
    finally { setIsSaving(false); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="text-muted-foreground" /></div>;
  }

  const isConfigured = Boolean(gateway && apiKey);

  const gatewayInfo: Record<string, { name: string; color: string; instructions: React.ReactNode }> = {
    asaas: {
      name: "Asaas",
      color: "bg-teal-500",
      instructions: (
        <>
          <li>Acesse <a href="https://www.asaas.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">asaas.com</a> e crie uma conta</li>
          <li>Vá em <span className="font-medium">Configurações → Integrações → API</span></li>
          <li>Copie a chave de API (access_token)</li>
        </>
      ),
    },
    pagseguro: {
      name: "PagSeguro / PagBank",
      color: "bg-green-500",
      instructions: (
        <>
          <li>Acesse <a href="https://pagseguro.uol.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">pagseguro.uol.com.br</a></li>
          <li>Vá em <span className="font-medium">Vendas → Integrações → Gerar Token</span></li>
          <li>Copie o token gerado</li>
        </>
      ),
    },
    stripe: {
      name: "Stripe",
      color: "bg-indigo-500",
      instructions: (
        <>
          <li>Acesse <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">dashboard.stripe.com</a></li>
          <li>Vá em <span className="font-medium">Developers → API Keys</span></li>
          <li>Copie a Secret Key (sk_live_...)</li>
        </>
      ),
    },
  };

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40">
              <CreditCard className="h-7 w-7 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Gateway de Pagamento</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isConfigured ? `${gatewayInfo[gateway]?.name} configurado` : "Não configurado"}
              </p>
            </div>
            <StatusBadge status={isConfigured ? "connected" : "not_configured"} />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gateway de pagamento</Label>
              <select
                value={gateway}
                onChange={(e) => setGateway(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um gateway...</option>
                <option value="asaas">Asaas (PIX, Boleto, Cartão) - Recomendado</option>
                <option value="pagseguro">PagSeguro / PagBank</option>
                <option value="stripe">Stripe (Internacional)</option>
              </select>
            </div>

            {gateway && (
              <>
                <div className="space-y-1.5">
                  <Label>Chave de API / Token <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Chave secreta do gateway"
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    Como obter as credenciais do {gatewayInfo[gateway]?.name}:
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    {gatewayInfo[gateway]?.instructions}
                  </ol>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2">
              {isConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                >
                  <XCircle className="h-4 w-4" /> Remover gateway
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || (!gateway && !isConfigured)}
                className="ml-auto gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> O que seus pacientes poderão fazer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: CreditCard, title: "Pagar com PIX", desc: "QR Code e código copia-e-cola gerados instantaneamente" },
              { icon: CreditCard, title: "Cartão de Crédito", desc: "Parcelamento em até 12x (conforme gateway)" },
              { icon: CreditCard, title: "Boleto Bancário", desc: "Geração automática com vencimento configurável" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                  <Icon className="h-4 w-4 text-teal-600" />
                </div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 p-4 flex gap-3">
            <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
            <div className="text-xs text-teal-700 dark:text-teal-300 space-y-1">
              <p className="font-semibold">Portal do Paciente</p>
              <p>Após configurar o gateway, seus pacientes poderão pagar faturas diretamente pelo Portal do Paciente. Eles verão as opções de PIX, cartão e boleto conforme disponibilidade do gateway escolhido.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Maquininha Stone ────────────────────────────────────────────────────

function TabMaquininha({ tenantId }: { tenantId: string }) {
  const [apiKey, setApiKey] = useState("");
  const [terminalSerial, setTerminalSerial] = useState("");
  const [active, setActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (api as any)
          .from("tenants")
          .select("stone_api_key, stone_terminal_serial, stone_active")
          .eq("id", tenantId)
          .maybeSingle();
        if (data) {
          setApiKey(data.stone_api_key ?? "");
          setTerminalSerial(data.stone_terminal_serial ?? "");
          setActive(data.stone_active ?? false);
        }
      } catch { /* column may not exist yet */ } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.error("Informe a chave de API Stone."); return; }
    setIsSaving(true);
    try {
      const { error } = await (api as any)
        .from("tenants")
        .update({
          stone_api_key: apiKey.trim(),
          stone_terminal_serial: terminalSerial.trim() || null,
          stone_active: active,
        })
        .eq("id", tenantId);
      if (error) throw error;
      toast.success("Configurações da maquininha salvas!");
    } catch (e) {
      logger.error("[Stone] save error", e);
      toast.error("Erro ao salvar configurações da maquininha", { description: normalizeError(e, "Execute a migration stone_terminal_settings primeiro.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await (api as any)
        .from("tenants")
        .update({ stone_api_key: null, stone_terminal_serial: null, stone_active: false })
        .eq("id", tenantId);
      setApiKey(""); setTerminalSerial(""); setActive(false);
      toast.success("Integração Stone removida.");
    } catch { toast.error("Erro ao remover integração Stone", { description: "Não foi possível remover a integração." }); }
    finally { setIsSaving(false); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="text-muted-foreground" /></div>;
  }

  const isConfigured = Boolean(apiKey);

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
              <CreditCard className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Maquininha Stone</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isConfigured ? "Credenciais configuradas" : "Não configurado"}
              </p>
            </div>
            <StatusBadge status={isConfigured && active ? "connected" : isConfigured ? "disconnected" : "not_configured"} />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stone-api-key">Chave de API Stone <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  id="stone-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="stone_api_key_..."
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre no <span className="font-medium">Portal Stone → Configurações → Credenciais</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stone-serial">Serial do terminal (opcional)</Label>
              <Input
                id="stone-serial"
                value={terminalSerial}
                onChange={(e) => setTerminalSerial(e.target.value)}
                placeholder="Ex: STN1234567"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Número de série impresso na etiqueta traseira da maquininha.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Habilitar integração</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ativa o botão "Cobrar na maquininha" no fluxo financeiro</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="flex items-center justify-between gap-2">
              {isConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                >
                  <XCircle className="h-4 w-4" /> Remover integração
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="ml-auto gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Smartphone, title: "Cobrar na maquininha", desc: "No módulo Financeiro, clique em 'Cobrar na maquininha' ao registrar um pagamento" },
              { icon: Wifi, title: "Disparo remoto", desc: "A API Stone envia o comando diretamente para o terminal configurado via rede" },
              { icon: CheckCircle2, title: "Confirmação automática", desc: "Após aprovação, o pagamento é registrado automaticamente como confirmado" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Requisitos Stone</p>
              <p>A maquininha deve estar ligada, conectada à internet e associada à conta Stone configurada. A conta Stone precisa ter habilitado o acesso à API de pagamentos (disponível para lojistas com contrato POS/TEF ativo).</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => window.open("https://docs.stone.com.br", "_blank")}
          >
            <ExternalLink className="h-3 w-3" /> Documentação Stone API
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: WhatsApp (Meta Cloud API — Official) ──────────────────────────────

// Meta App ID for Facebook SDK (Embedded Signup)
const META_FB_APP_ID = "147900355051780";
const META_FB_CONFIG_ID = "930489586557648";
const META_GRAPH_API_VERSION = "v21.0";

type WhatsAppConnectionState = "not_configured" | "connected" | "invalid_token";

// Declare FB SDK global type
declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, any>) => void;
    };
  }
}

function TabWhatsApp({ tenantId }: { tenantId: string }) {
  const [connectionState, setConnectionState] = useState<WhatsAppConnectionState>("not_configured");
  const [verifiedName, setVerifiedName] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [qualityRating, setQualityRating] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [isEmbeddedSignupLoading, setIsEmbeddedSignupLoading] = useState(false);
  const fbSdkLoaded = useRef(false);

  // ─── Facebook SDK loading ────────────────────────────────────────────
  useEffect(() => {
    if (fbSdkLoaded.current) return;
    fbSdkLoaded.current = true;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: META_FB_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: META_GRAPH_API_VERSION,
      });
    };

    // Load SDK script if not already present
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, []);

  // ─── Session event listener for Embedded Signup ──────────────────────
  const embeddedSignupDataRef = useRef<{ phone_number_id?: string; waba_id?: string }>({});

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.origin === 'string' && !event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
            embeddedSignupDataRef.current = {
              phone_number_id: data.data?.phone_number_id,
              waba_id: data.data?.waba_id,
            };
            logger.info("[WhatsApp] Embedded Signup session data", data.data);
          } else if (data.event === 'CANCEL') {
            logger.info("[WhatsApp] Embedded Signup cancelled", data.data);
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const callManager = async (action: string, extra?: Record<string, string>) => {
    const { data, error } = await api.functions.invoke("meta-whatsapp-manager", {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message || "Erro ao comunicar com servidor");
    return data;
  };

  // Load initial state from Meta Cloud API
  useEffect(() => {
    const load = async () => {
      try {
        const status = await callManager("get-status");
        if (status?.state === "connected") {
          setConnectionState("connected");
          setVerifiedName(status.verifiedName || "");
          setDisplayPhone(status.displayPhoneNumber || "");
          setQualityRating(status.qualityRating || "");
          setWebhookUrl(status.webhookUrl || "");
          setVerifyToken(status.verifyToken || "");
          setPhoneNumberId(status.phoneNumberId || "");
          setBusinessAccountId(status.businessAccountId || "");
        } else if (status?.state === "invalid_token") {
          setConnectionState("invalid_token");
          setPhoneNumberId(status.phoneNumberId || "");
        } else {
          setConnectionState("not_configured");
        }
      } catch {
        setConnectionState("not_configured");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ─── Embedded Signup handler ─────────────────────────────────────────
  const handleEmbeddedSignup = () => {
    if (!window.FB) {
      toast.error("Facebook SDK não carregado", { description: "Recarregue a página e tente novamente." });
      return;
    }

    if (!META_FB_CONFIG_ID) {
      toast.error("Config ID não definido", {
        description: "O administrador precisa configurar o META_FB_CONFIG_ID. Veja a documentação.",
      });
      return;
    }

    setIsEmbeddedSignupLoading(true);
    embeddedSignupDataRef.current = {};

    const fbLoginCallback = async (response: { authResponse?: { code?: string } }) => {
      if (response.authResponse?.code) {
        const code = response.authResponse.code;

        // Wait a brief moment for session message event to fire
        await new Promise(resolve => setTimeout(resolve, 500));

        const sessionData = embeddedSignupDataRef.current;
        if (!sessionData.phone_number_id || !sessionData.waba_id) {
          toast.error("Dados incompletos do Embedded Signup", {
            description: "O flow foi concluído mas não recebemos o Phone Number ID ou WABA ID. Tente novamente.",
          });
          setIsEmbeddedSignupLoading(false);
          return;
        }

        try {
          // Send code + IDs to our backend for server-side token exchange
          const { data, error } = await api.functions.invoke("whatsapp-embedded-signup", {
            body: {
              action: "exchange-token",
              code,
              phone_number_id: sessionData.phone_number_id,
              waba_id: sessionData.waba_id,
            },
          });

          if (error || !data?.ok) {
            toast.error("Erro ao finalizar configuração", {
              description: data?.error || error?.message || "Falha ao trocar código por token.",
            });
            setIsEmbeddedSignupLoading(false);
            return;
          }

          // Success!
          setConnectionState("connected");
          setVerifiedName(data.phoneInfo?.verified_name || "");
          setDisplayPhone(data.phoneInfo?.display_phone_number || "");
          setQualityRating(data.phoneInfo?.quality_rating || "");
          setWebhookUrl(data.webhookUrl || "");
          setVerifyToken(data.verifyToken || "");
          setPhoneNumberId(sessionData.phone_number_id);
          setBusinessAccountId(sessionData.waba_id);

          toast.success("WhatsApp Business conectado com sucesso! 🎉", {
            description: "Sua clínica está pronta para enviar e receber mensagens.",
          });
        } catch (err) {
          logger.error("[WhatsApp] Embedded Signup backend error", err);
          toast.error("Erro ao conectar WhatsApp", {
            description: normalizeError(err, "Falha na comunicação com o servidor."),
          });
        }
      } else {
        toast.info("Cadastro cancelado", { description: "Você pode tentar novamente a qualquer momento." });
      }
      setIsEmbeddedSignupLoading(false);
    };

    window.FB.login(fbLoginCallback, {
      config_id: META_FB_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
      },
    });
  };

  // ─── Manual config handler ───────────────────────────────────────────
  const handleSaveConfig = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      toast.error("Phone Number ID e Access Token são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      const result = await callManager("save-config", {
        phone_number_id: phoneNumberId.trim(),
        access_token: accessToken.trim(),
        business_account_id: businessAccountId.trim(),
      });
      if (!result?.ok) {
        toast.error("Erro ao salvar configuração", { description: result?.error || "Verifique suas credenciais." });
        return;
      }
      setConnectionState("connected");
      setVerifiedName(result.phoneInfo?.verified_name || "");
      setDisplayPhone(result.phoneInfo?.display_phone_number || "");
      setQualityRating(result.phoneInfo?.quality_rating || "");
      setWebhookUrl(result.webhookUrl || "");
      setVerifyToken(result.verifyToken || "");
      setAccessToken("");
      toast.success("WhatsApp Business configurado com sucesso! ✅");
    } catch (err) {
      logger.error("[WhatsApp] save config error", err);
      toast.error("Erro ao salvar configuração", { description: normalizeError(err, "Verifique suas credenciais Meta.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsActioning(true);
    try {
      await callManager("disconnect");
      setConnectionState("not_configured");
      setVerifiedName("");
      setDisplayPhone("");
      setQualityRating("");
      setPhoneNumberId("");
      setAccessToken("");
      setBusinessAccountId("");
      setWebhookUrl("");
      setVerifyToken("");
      toast.success("WhatsApp desconectado.");
    } catch (err) {
      logger.error("[WhatsApp] disconnect error", err);
      toast.error("Erro ao desconectar", { description: normalizeError(err, "Não foi possível desconectar.") });
    } finally {
      setIsActioning(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe um telefone para teste");
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await api.functions.invoke("whatsapp-sender", {
        body: {
          phone: testPhone.trim(),
          message: "✅ Teste de conexão WhatsApp — ClinicNest funcionando!",
        },
      });
      if (error) {
        toast.error("Falha ao testar conexão", { description: normalizeError(error, "O servidor não conseguiu enviar a mensagem.") });
        return;
      }
      if (!data?.success) {
        toast.error("Falha ao testar", { description: normalizeError(data?.error, "O WhatsApp não retornou sucesso.") });
        return;
      }
      toast.success("Mensagem de teste enviada com sucesso!");
    } catch (err) {
      logger.error("[WhatsApp] test error", err);
      toast.error("Erro ao testar WhatsApp", { description: normalizeError(err, "Não foi possível enviar a mensagem de teste.") });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="text-muted-foreground" /></div>;
  }

  const stateConfig = {
    not_configured: { label: "Não configurado", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "bg-gray-400" },
    connected: { label: "Conectado", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", dot: "bg-green-500" },
    invalid_token: { label: "Token inválido", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", dot: "bg-red-500" },
  };

  const currentStateConfig = stateConfig[connectionState];

  const qualityBadge = qualityRating ? {
    GREEN: { label: "Alta", className: "bg-green-100 text-green-700" },
    YELLOW: { label: "Média", className: "bg-yellow-100 text-yellow-700" },
    RED: { label: "Baixa", className: "bg-red-100 text-red-700" },
  }[qualityRating] || null : null;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-950/40">
              <Smartphone className="h-7 w-7 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">WhatsApp Business (API Oficial Meta)</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {connectionState === "connected"
                  ? `${verifiedName || "Conectado"}${displayPhone ? ` — ${displayPhone}` : ""}`
                  : connectionState === "invalid_token"
                  ? "Token inválido ou expirado. Reconfigure suas credenciais."
                  : "Configure sua conta WhatsApp Business Platform da Meta"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {qualityBadge && (
                <Badge className={cn("text-xs", qualityBadge.className)}>
                  Qualidade: {qualityBadge.label}
                </Badge>
              )}
              <Badge className={cn("gap-1.5 text-xs font-medium px-2.5 py-1", currentStateConfig.color)}>
                <span className={cn("h-2 w-2 rounded-full", currentStateConfig.dot)} />
                {currentStateConfig.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Card — Embedded Signup (Primary) + Manual (Fallback) */}
      {(connectionState === "not_configured" || connectionState === "invalid_token") && (
        <>
          {/* Embedded Signup — 1-click onboarding */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" /> Conectar WhatsApp com 1 clique
              </CardTitle>
              <CardDescription>
                Conecte sua conta WhatsApp Business automaticamente via Meta.
                Não é necessário copiar tokens ou IDs manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-green-700 dark:text-green-300">Como funciona</p>
                <ol className="text-xs text-green-600 dark:text-green-400 space-y-1.5 list-decimal list-inside">
                  <li>Clique no botão abaixo para abrir o assistente da Meta</li>
                  <li>Faça login com sua conta do Facebook/Meta Business</li>
                  <li>Selecione ou crie sua Conta WhatsApp Business</li>
                  <li>Escolha e verifique seu número de telefone comercial</li>
                  <li>Pronto! A conexão será estabelecida automaticamente</li>
                </ol>
              </div>

              <Button
                onClick={handleEmbeddedSignup}
                disabled={isEmbeddedSignupLoading}
                className="gap-2 w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#1877F2", color: "#fff" }}
              >
                {isEmbeddedSignupLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                )}
                Conectar WhatsApp Business
              </Button>
            </CardContent>
          </Card>

          {/* Manual Configuration — Fallback */}
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowManualConfig(!showManualConfig)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Configuração manual (avançado)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Para quem já tem um token permanente do Meta Developer Console
                  </CardDescription>
                </div>
                {showManualConfig ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {showManualConfig && (
              <CardContent className="space-y-4 pt-0">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Como obter as credenciais</p>
                  <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    <li>Acesse <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="underline">Meta for Developers</a> e crie um App do tipo Business</li>
                    <li>Adicione o produto "WhatsApp" ao seu App</li>
                    <li>Em API Setup, copie o <strong>Phone Number ID</strong> e gere um <strong>Permanent Access Token</strong></li>
                    <li>O <strong>Business Account ID</strong> está na URL da página do WhatsApp Manager</li>
                  </ol>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp-phone-number-id">Phone Number ID *</Label>
                  <Input
                    id="whatsapp-phone-number-id"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Ex.: 106540352242922"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp-access-token">Access Token (permanente) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="whatsapp-access-token"
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAJBx..."
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use um System User token com permissão <code className="px-1 bg-muted rounded">whatsapp_business_messaging</code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp-business-account-id">Business Account ID</Label>
                  <Input
                    id="whatsapp-business-account-id"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="Ex.: 102938475102938"
                    className="font-mono text-sm"
                  />
                </div>

                <Button onClick={handleSaveConfig} disabled={isSaving} className="gap-2 bg-green-600 hover:bg-green-700">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Salvar e Verificar
                </Button>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Connected Card */}
      {connectionState === "connected" && (
        <Card>
          <CardContent className="pt-6 pb-5 space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">WhatsApp Business API conectado e ativo</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  {verifiedName && `${verifiedName} · `}{displayPhone || phoneNumberId}{" · "}API Oficial Meta
                </p>
              </div>
            </div>

            {/* Webhook config info */}
            {webhookUrl && (
              <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold">Configuração do Webhook (automática via Embedded Signup)</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{webhookUrl}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {verifyToken && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Verify Token:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{verifyToken}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(verifyToken); toast.success("Token copiado!"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Os webhooks foram inscritos automaticamente na WABA do cliente. As mensagens recebidas no número acima serão processadas pelo chatbot do ClinicNest.
                </p>
              </div>
            )}

            <Separator />

            {/* Test connection */}
            <div className="space-y-1.5">
              <Label>Testar conexão</Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Ex.: 5511999999999"
                  inputMode="numeric"
                />
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting}
                >
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Testar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envia uma mensagem de teste para o número informado.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                onClick={handleDisconnect}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remover integração
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Integracoes({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("overview");
  const tenantId = profile?.tenant_id ?? "";

  // Webhook count for badge
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    (api as any)
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
      icon: CreditCard,
      title: "Gateway de Pagamento",
      description: "Receba pagamentos online dos pacientes via PIX, cartão ou boleto",
      status: "not_configured" as const,
      tab: "pagamentos",
      color: "bg-teal-50 dark:bg-teal-950/40 text-teal-600",
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
    {
      icon: CreditCard,
      title: "Maquininha Stone",
      description: "Dispare cobranças diretamente na maquininha via API Stone",
      status: "not_configured" as const,
      tab: "maquininha",
      color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600",
    },
    {
      icon: FileText,
      title: "NFS-e (Nota Fiscal)",
      description: "Emita notas fiscais de serviço automaticamente via NFE.io",
      status: "not_configured" as const,
      tab: "nfse",
      color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600",
    },
    {
      icon: Send,
      title: "WhatsApp",
      description: "Envie mensagens automáticas via WhatsApp Business API (Meta)",
      status: "not_configured" as const,
      tab: "whatsapp",
      color: "bg-green-50 dark:bg-green-950/40 text-green-600",
    },
    {
      icon: Building2,
      title: "RNDS (eSUS)",
      description: "Integração com a Rede Nacional de Dados em Saúde do Ministério da Saúde",
      status: "not_configured" as const,
      tab: "rnds",
      color: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600",
    },
    {
      icon: FileText,
      title: "HL7 (Laboratórios)",
      description: "Receba resultados de exames e envie pedidos via protocolo HL7 v2.x",
      status: "not_configured" as const,
      tab: "hl7",
      color: "bg-violet-50 dark:bg-violet-950/40 text-violet-600",
    },
  ];

  const content = (
    <div className="space-y-6 pb-10">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex flex-wrap">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs sm:text-sm">WhatsApp</TabsTrigger>
          <TabsTrigger value="pagamentos" className="text-xs sm:text-sm">Pagamentos</TabsTrigger>
          <TabsTrigger value="nfse" className="text-xs sm:text-sm">NFS-e</TabsTrigger>
          <TabsTrigger value="google" className="text-xs sm:text-sm">Google</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5 text-xs sm:text-sm">
            Webhooks
            {webhookCount != null && webhookCount > 0 && (
              <Badge className="h-4 w-4 p-0 text-[10px] flex items-center justify-center">{webhookCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="api" className="text-xs sm:text-sm">API & Zapier</TabsTrigger>
          <TabsTrigger value="maquininha" className="text-xs sm:text-sm">Maquininha</TabsTrigger>
          <TabsTrigger value="rnds" className="text-xs sm:text-sm">RNDS</TabsTrigger>
          <TabsTrigger value="hl7" className="text-xs sm:text-sm">HL7</TabsTrigger>
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

        {/* ── Pagamentos ── */}
        <TabsContent value="pagamentos" className="mt-6">
          {tenantId && <TabPaymentGateway tenantId={tenantId} />}
        </TabsContent>

        {/* ── NFS-e ── */}
        <TabsContent value="nfse" className="mt-6">
          {tenantId && <NFSeConfig tenantId={tenantId} />}
        </TabsContent>

        {/* ── Webhooks ── */}
        <TabsContent value="webhooks" className="mt-6">
          {tenantId && <TabWebhooks tenantId={tenantId} />}
        </TabsContent>

        {/* ── API & Zapier ── */}
        <TabsContent value="api" className="mt-6">
          {tenantId && <TabApiZapier tenantId={tenantId} />}
        </TabsContent>

        {/* ── Maquininha Stone ── */}
        <TabsContent value="maquininha" className="mt-6">
          {tenantId && <TabMaquininha tenantId={tenantId} />}
        </TabsContent>

        {/* ── WhatsApp ── */}
        <TabsContent value="whatsapp" className="mt-6">
          {tenantId && <TabWhatsApp tenantId={tenantId} />}
        </TabsContent>

        {/* ── RNDS (eSUS) ── */}
        <TabsContent value="rnds" className="mt-6">
          {tenantId && <RNDSConfigTab />}
        </TabsContent>

        {/* ── HL7 (Laboratórios) ── */}
        <TabsContent value="hl7" className="mt-6">
          {tenantId && <HL7ConfigTab />}
        </TabsContent>
      </Tabs>
    </div>
  );

  if (embedded) return content;

  return (
    <MainLayout title="Integrações" subtitle="Conecte o ClinicNest a ferramentas externas">
      {content}
    </MainLayout>
  );
}
