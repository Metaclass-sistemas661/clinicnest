import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import { Loader2, Save, Smartphone, Key, Send } from "lucide-react";

const SMS_PROVIDERS = [
  { value: "zenvia", label: "Zenvia", description: "Plataforma brasileira mais popular" },
  { value: "twilio", label: "Twilio", description: "Plataforma global" },
  { value: "vonage", label: "Vonage (Nexmo)", description: "Plataforma global" },
  { value: "generic", label: "Outro (webhook)", description: "Integração via HTTP genérica" },
] as const;

interface SmsConfigData {
  sms_provider: string;
  sms_api_key: string;
  sms_sender: string;
  sms_enabled: boolean;
}

export default function SmsConfig() {
  const { tenant, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [form, setForm] = useState<SmsConfigData>({
    sms_provider: "",
    sms_api_key: "",
    sms_sender: "",
    sms_enabled: false,
  });

  useEffect(() => {
    if (!tenant?.id) return;
    void fetchConfig();
  }, [tenant?.id]);

  const fetchConfig = async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("tenants")
        .select("sms_provider, sms_api_key, sms_sender")
        .eq("id", tenant.id)
        .single();

      if (error) throw error;

      const d = data as any;
      setForm({
        sms_provider: d.sms_provider || "",
        sms_api_key: d.sms_api_key || "",
        sms_sender: d.sms_sender || "",
        sms_enabled: !!d.sms_provider && !!d.sms_api_key,
      });
    } catch (err) {
      logger.error("[SmsConfig] fetch error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;

    if (form.sms_enabled && !form.sms_provider) {
      toast.error("Selecione um provedor de SMS");
      return;
    }
    if (form.sms_enabled && !form.sms_api_key) {
      toast.error("Informe a chave da API");
      return;
    }

    setIsSaving(true);
    try {
      const payload = form.sms_enabled
        ? {
            sms_provider: form.sms_provider,
            sms_api_key: form.sms_api_key,
            sms_sender: form.sms_sender || null,
          }
        : {
            sms_provider: null,
            sms_api_key: null,
            sms_sender: null,
          };

      const { error } = await api
        .from("tenants")
        .update(payload as any)
        .eq("id", tenant.id);

      if (error) throw error;

      toast.success("Configuração de SMS salva!");
      refreshProfile();
    } catch (err) {
      logger.error("[SmsConfig] save error", err);
      toast.error("Erro ao salvar configuração de SMS", { description: normalizeError(err, "Verifique os dados e tente novamente.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe um número para teste");
      return;
    }
    setIsTesting(true);
    try {
      const { data: { session } } = await api.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/sms-sender`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            to: testPhone.trim(),
            message: `Teste de SMS - ${tenant?.name || "ClinicNest"}. Se você recebeu esta mensagem, a integração está funcionando! ✅`,
          }),
        },
      );

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error((body as any).error || `HTTP ${resp.status}`);
      }

      toast.success("SMS de teste enviado!");
    } catch (err: any) {
      logger.error("[SmsConfig] test error", err);
      toast.error("Erro ao enviar SMS de teste", { description: normalizeError(err, "Verifique o número e tente novamente.") });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ativação */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>SMS</CardTitle>
              <CardDescription>
                Envie notificações por SMS para seus pacientes (agendamentos, retornos, faturas etc.)
              </CardDescription>
            </div>
            <Switch
              checked={form.sms_enabled}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, sms_enabled: checked }))}
            />
          </div>
        </CardHeader>
      </Card>

      {form.sms_enabled && (
        <>
          {/* Provedor */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Provedor & Credenciais</CardTitle>
                  <CardDescription>Configure a integração com seu provedor de SMS</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <Select
                  value={form.sms_provider}
                  onValueChange={(v) => setForm((p) => ({ ...p, sms_provider: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SMS_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex flex-col">
                          <span>{p.label}</span>
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chave da API (API Key / Token)</Label>
                <Input
                  type="password"
                  value={form.sms_api_key}
                  onChange={(e) => setForm((p) => ({ ...p, sms_api_key: e.target.value }))}
                  placeholder={
                    form.sms_provider === "zenvia"
                      ? "Token da API Zenvia"
                      : form.sms_provider === "twilio"
                        ? "Account SID:Auth Token"
                        : "Sua chave de API"
                  }
                />
                {form.sms_provider === "twilio" && (
                  <p className="text-xs text-muted-foreground">
                    Para Twilio, informe no formato: <code>ACCOUNT_SID:AUTH_TOKEN</code>
                  </p>
                )}
                {form.sms_provider === "generic" && (
                  <p className="text-xs text-muted-foreground">
                    Informe a URL do webhook no campo Remetente abaixo
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  {form.sms_provider === "generic"
                    ? "URL do Webhook"
                    : form.sms_provider === "twilio"
                      ? "Número Twilio (from)"
                      : "Remetente (sender)"}
                </Label>
                <Input
                  value={form.sms_sender}
                  onChange={(e) => setForm((p) => ({ ...p, sms_sender: e.target.value }))}
                  placeholder={
                    form.sms_provider === "generic"
                      ? "https://api.exemplo.com/sms"
                      : form.sms_provider === "twilio"
                        ? "+5511999999999"
                        : "ClinicNest"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Teste */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Testar SMS</CardTitle>
                  <CardDescription>Envie um SMS de teste para validar a configuração</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Número de teste</Label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <Button
                  onClick={handleTestSms}
                  disabled={isTesting || !form.sms_provider || !form.sms_api_key}
                  variant="outline"
                >
                  {isTesting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Enviar teste
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="gradient"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar configuração SMS
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
