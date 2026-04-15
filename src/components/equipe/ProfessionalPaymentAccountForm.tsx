import { Spinner } from "@/components/ui/spinner";
/**
 * Professional Payment Account Configuration
 * UI para configurar conta de recebimento do profissional
 */

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Loader2,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Building2,
  CreditCard,
  Info,
} from "lucide-react";
import type { GatewayProvider } from "@/lib/payment-gateway";

interface GatewayConfig {
  id: string;
  provider: GatewayProvider;
  is_split_enabled: boolean;
}

interface PaymentAccount {
  id?: string;
  recipientId: string;
  walletId: string;
  accountId: string;
  pixKey: string;
  isVerified: boolean;
}

interface ProfessionalPaymentAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  professionalId: string;
  professionalName: string;
  onSave?: () => void;
}

const BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "077", name: "Inter" },
  { code: "260", name: "Nubank" },
  { code: "336", name: "C6 Bank" },
  { code: "212", name: "Original" },
  { code: "422", name: "Safra" },
];

export function ProfessionalPaymentAccountForm({
  open,
  onOpenChange,
  tenantId,
  professionalId,
  professionalName,
  onSave,
}: ProfessionalPaymentAccountFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [account, setAccount] = useState<PaymentAccount>({
    recipientId: "",
    walletId: "",
    accountId: "",
    pixKey: "",
    isVerified: false,
  });

  // Bank account fields (for creating new recipient)
  const [bankCode, setBankCode] = useState("");
  const [agency, setAgency] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountDigit, setAccountDigit] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, tenantId, professionalId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load gateway config
      const { data: gatewayData } = await api
        .from("tenant_payment_gateways")
        .select("id, provider, is_split_enabled")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("validation_status", "valid")
        .maybeSingle();

      if (gatewayData) {
        setGateway(gatewayData as GatewayConfig);

        // Load existing account
        const { data: accountData } = await api
          .from("professional_payment_accounts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId)
          .eq("gateway_id", gatewayData.id)
          .maybeSingle();

        if (accountData) {
          setAccount({
            id: accountData.id,
            recipientId: accountData.recipient_id || "",
            walletId: accountData.wallet_id || "",
            accountId: accountData.account_id || "",
            pixKey: accountData.pix_key || "",
            isVerified: accountData.is_verified || false,
          });
        }
      }
    } catch (error) {
      logger.error("Error loading payment account data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!gateway) {
      toast.error("Nenhum gateway configurado");
      return;
    }

    const hasIdentifier = account.recipientId || account.walletId || account.accountId || account.pixKey;
    if (!hasIdentifier) {
      toast.error("Informe pelo menos um identificador de conta");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        professional_id: professionalId,
        gateway_id: gateway.id,
        provider: gateway.provider,
        recipient_id: account.recipientId || null,
        wallet_id: account.walletId || null,
        account_id: account.accountId || null,
        pix_key: account.pixKey || null,
        is_verified: false,
        verification_status: "pending",
        updated_at: new Date().toISOString(),
      };

      if (account.id) {
        const { error } = await api
          .from("professional_payment_accounts")
          .update(payload)
          .eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await api
          .from("professional_payment_accounts")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Conta de recebimento configurada!");
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      logger.error("Error saving payment account:", error);
      toast.error("Erro ao salvar conta de recebimento");
    } finally {
      setIsSaving(false);
    }
  };

  const getProviderFields = () => {
    if (!gateway) return null;

    switch (gateway.provider) {
      case "asaas":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wallet ID (Asaas)</Label>
              <Input
                value={account.walletId}
                onChange={(e) => setAccount((prev) => ({ ...prev, walletId: e.target.value }))}
                placeholder="Ex: wal_xxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Asaas → Configurações → Dados da Conta → Wallet ID
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                <strong>Dica:</strong> O profissional precisa ter uma conta Asaas própria.
                O Wallet ID é usado para receber os splits automaticamente.
              </p>
            </div>
          </div>
        );

      case "pagseguro":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account ID (PagSeguro Connect)</Label>
              <Input
                value={account.accountId}
                onChange={(e) => setAccount((prev) => ({ ...prev, accountId: e.target.value }))}
                placeholder="Ex: ACCT_xxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                ID da conta conectada no PagSeguro Connect
              </p>
            </div>
          </div>
        );

      case "stone":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient ID (Stone)</Label>
              <Input
                value={account.recipientId}
                onChange={(e) => setAccount((prev) => ({ ...prev, recipientId: e.target.value }))}
                placeholder="Ex: re_xxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                ID do recebedor cadastrado na Stone
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Configurar Recebimento
          </SheetTitle>
          <SheetDescription>
            Configure a conta de recebimento de <strong>{professionalName}</strong> para
            receber splits automáticos.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="text-muted-foreground" />
          </div>
        ) : !gateway ? (
          <div className="py-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <p className="font-medium">Nenhum gateway configurado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure um gateway de pagamento em Integrações → Pagamentos antes de
                configurar contas de profissionais.
              </p>
            </div>
          </div>
        ) : !gateway.is_split_enabled ? (
          <div className="py-8 text-center space-y-4">
            <Info className="h-12 w-12 text-blue-500 mx-auto" />
            <div>
              <p className="font-medium">Split não habilitado</p>
              <p className="text-sm text-muted-foreground mt-1">
                O split de pagamento não está habilitado no gateway. Ative em
                Integrações → Pagamentos para usar recebimento automático.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* Gateway Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Gateway: {gateway.provider.charAt(0).toUpperCase() + gateway.provider.slice(1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Split automático habilitado
                </p>
              </div>
              <Badge variant="outline" className="ml-auto bg-green-50 text-green-700">
                Ativo
              </Badge>
            </div>

            {/* Status */}
            {account.id && (
              <div className="flex items-center gap-2">
                {account.isVerified ? (
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Pendente de verificação
                  </Badge>
                )}
              </div>
            )}

            {/* Provider-specific fields */}
            {getProviderFields()}

            {/* PIX Key (universal) */}
            <div className="space-y-2">
              <Label>Chave PIX (alternativa)</Label>
              <Input
                value={account.pixKey}
                onChange={(e) => setAccount((prev) => ({ ...prev, pixKey: e.target.value }))}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
              <p className="text-xs text-muted-foreground">
                Usada como fallback se o split direto não estiver disponível
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                variant="gradient" className="flex-1"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
