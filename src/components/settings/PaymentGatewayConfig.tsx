/**
 * Payment Gateway Configuration Component
 * UI para clínica configurar gateway de pagamento com suporte a split
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  CreditCard,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Zap,
  Users,
  Info,
} from "lucide-react";
import { getAvailableGateways, validateGatewayCredentials, type GatewayProvider } from "@/lib/payment-gateway";

interface GatewayConfig {
  id?: string;
  provider: GatewayProvider | "";
  apiKey: string;
  webhookSecret: string;
  environment: "sandbox" | "production";
  isSplitEnabled: boolean;
  splitFeePayer: "clinic" | "professional" | "split";
  validationStatus: "pending" | "valid" | "invalid";
}

interface PaymentGatewayConfigProps {
  tenantId: string;
}

export function PaymentGatewayConfig({ tenantId }: PaymentGatewayConfigProps) {
  const [config, setConfig] = useState<GatewayConfig>({
    provider: "",
    apiKey: "",
    webhookSecret: "",
    environment: "sandbox",
    isSplitEnabled: false,
    splitFeePayer: "clinic",
    validationStatus: "pending",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const availableGateways = getAvailableGateways();

  useEffect(() => {
    loadConfig();
  }, [tenantId]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_payment_gateways")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfig({
          id: data.id,
          provider: data.provider as GatewayProvider,
          apiKey: data.api_key_encrypted || "",
          webhookSecret: data.webhook_secret_encrypted || "",
          environment: data.environment as "sandbox" | "production",
          isSplitEnabled: data.is_split_enabled || false,
          splitFeePayer: (data.split_fee_payer as "clinic" | "professional" | "split") || "clinic",
          validationStatus: (data.validation_status as "pending" | "valid" | "invalid") || "pending",
        });
      }
    } catch (error) {
      logger.error("Error loading gateway config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!config.provider || !config.apiKey) {
      toast.error("Selecione um gateway e informe a chave de API");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateGatewayCredentials({
        provider: config.provider as GatewayProvider,
        apiKey: config.apiKey,
        environment: config.environment,
      });

      if (result.valid) {
        setConfig((prev) => ({ ...prev, validationStatus: "valid" }));
        toast.success("Credenciais válidas!");
      } else {
        setConfig((prev) => ({ ...prev, validationStatus: "invalid" }));
        toast.error(result.error || "Credenciais inválidas");
      }
    } catch (error) {
      setConfig((prev) => ({ ...prev, validationStatus: "invalid" }));
      toast.error("Erro ao validar credenciais");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!config.provider) {
      toast.error("Selecione um gateway de pagamento");
      return;
    }
    if (!config.apiKey.trim()) {
      toast.error("Informe a chave de API");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        provider: config.provider,
        api_key_encrypted: config.apiKey.trim(),
        webhook_secret_encrypted: config.webhookSecret.trim() || null,
        environment: config.environment,
        is_split_enabled: config.isSplitEnabled,
        split_fee_payer: config.splitFeePayer,
        is_active: true,
        validation_status: config.validationStatus,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .from("tenant_payment_gateways")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_payment_gateways")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Gateway configurado com sucesso!");
      loadConfig();
    } catch (error) {
      logger.error("Error saving gateway config:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!config.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_payment_gateways")
        .update({ is_active: false })
        .eq("id", config.id);

      if (error) throw error;

      setConfig({
        provider: "",
        apiKey: "",
        webhookSecret: "",
        environment: "sandbox",
        isSplitEnabled: false,
        splitFeePayer: "clinic",
        validationStatus: "pending",
      });
      toast.success("Gateway removido");
    } catch (error) {
      toast.error("Erro ao remover gateway");
    } finally {
      setIsSaving(false);
      setShowRemoveDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedGateway = availableGateways.find((g) => g.provider === config.provider);
  const isConfigured = Boolean(config.provider && config.apiKey && config.validationStatus === "valid");

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40">
              <CreditCard className="h-7 w-7 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Gateway de Pagamento</p>
              <p className="text-sm text-muted-foreground">
                {isConfigured
                  ? `${selectedGateway?.info.name} configurado`
                  : config.provider
                  ? "Aguardando validação"
                  : "Não configurado"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                isConfigured
                  ? "bg-green-50 text-green-700 border-green-200"
                  : config.validationStatus === "invalid"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }
            >
              {isConfigured ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" /> Conectado
                </>
              ) : config.validationStatus === "invalid" ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" /> Inválido
                </>
              ) : (
                "Não configurado"
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do Gateway</CardTitle>
          <CardDescription>
            Configure o gateway de pagamento para receber pagamentos dos pacientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gateway Selection */}
          <div className="space-y-2">
            <Label>Gateway de Pagamento</Label>
            <Select
              value={config.provider}
              onValueChange={(v) =>
                setConfig((prev) => ({
                  ...prev,
                  provider: v as GatewayProvider,
                  validationStatus: "pending",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um gateway..." />
              </SelectTrigger>
              <SelectContent>
                {availableGateways.map((g) => (
                  <SelectItem key={g.provider} value={g.provider}>
                    <div className="flex items-center gap-2">
                      <span>{g.info.name}</span>
                      {g.info.supportsSplit && (
                        <Badge variant="outline" className="text-xs">
                          Split
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.provider && (
            <>
              {/* Gateway Features */}
              <div className="flex flex-wrap gap-2">
                {selectedGateway?.info.supportsPix && (
                  <Badge variant="secondary">PIX</Badge>
                )}
                {selectedGateway?.info.supportsBoleto && (
                  <Badge variant="secondary">Boleto</Badge>
                )}
                {selectedGateway?.info.supportsCreditCard && (
                  <Badge variant="secondary">Cartão</Badge>
                )}
                {selectedGateway?.info.supportsSplit && (
                  <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                    <Zap className="h-3 w-3 mr-1" />
                    Split Automático
                  </Badge>
                )}
              </div>

              {/* Environment */}
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select
                  value={config.environment}
                  onValueChange={(v) =>
                    setConfig((prev) => ({
                      ...prev,
                      environment: v as "sandbox" | "production",
                      validationStatus: "pending",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        Sandbox (Testes)
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Produção
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {config.environment === "sandbox" && (
                  <p className="text-xs text-amber-600">
                    Modo de testes - pagamentos não serão processados de verdade
                  </p>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>Chave de API</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={config.apiKey}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                        validationStatus: "pending",
                      }))
                    }
                    placeholder="Chave secreta do gateway"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Webhook Secret (optional) */}
              <div className="space-y-2">
                <Label>
                  Webhook Secret <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  type="password"
                  value={config.webhookSecret}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, webhookSecret: e.target.value }))
                  }
                  placeholder="Secret para validar webhooks"
                />
              </div>

              <Separator />

              {/* Split Configuration */}
              {selectedGateway?.info.supportsSplit && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Split de Pagamento
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Divide automaticamente o pagamento entre clínica e profissional
                      </p>
                    </div>
                    <Switch
                      checked={config.isSplitEnabled}
                      onCheckedChange={(v) =>
                        setConfig((prev) => ({ ...prev, isSplitEnabled: v }))
                      }
                    />
                  </div>

                  {config.isSplitEnabled && (
                    <div className="space-y-2 pl-6 border-l-2 border-teal-200">
                      <Label>Quem paga a taxa do gateway?</Label>
                      <Select
                        value={config.splitFeePayer}
                        onValueChange={(v) =>
                          setConfig((prev) => ({
                            ...prev,
                            splitFeePayer: v as "clinic" | "professional" | "split",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinic">Clínica paga toda a taxa</SelectItem>
                          <SelectItem value="professional">Profissional paga toda a taxa</SelectItem>
                          <SelectItem value="split">Dividir proporcionalmente</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-blue-700 dark:text-blue-300">
                          Com split ativado, o profissional precisa ter uma conta configurada no gateway.
                          Configure em <strong>Equipe → Configurar Recebimento</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Documentation Link */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
                <a
                  href={selectedGateway?.info.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  Documentação do {selectedGateway?.info.name}
                </a>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4">
            {config.provider && config.apiKey && (
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={isValidating || isSaving}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!config.provider || !config.apiKey || isSaving}
              className="gradient-primary text-primary-foreground"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar Configurações
            </Button>
            {config.id && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setShowRemoveDialog(true)}
                disabled={isSaving}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Remover Gateway
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remove Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Gateway de Pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desativar o gateway configurado. Pagamentos via Portal do Paciente
              deixarão de funcionar até que um novo gateway seja configurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
