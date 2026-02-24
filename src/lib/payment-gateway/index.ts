/**
 * Payment Gateway Factory & Service
 * Detecta gateway configurado pelo tenant e roteia para implementação correta
 */

import type { PaymentGateway, GatewayProvider, GatewayConfig } from "./types";
import { AsaasGateway } from "./asaas-gateway";
import { PagSeguroGateway } from "./pagseguro-gateway";
import { StoneGateway } from "./stone-gateway";

export * from "./types";
export { AsaasGateway } from "./asaas-gateway";
export { PagSeguroGateway } from "./pagseguro-gateway";
export { StoneGateway } from "./stone-gateway";

/**
 * Factory para criar instância do gateway correto
 */
export function createPaymentGateway(config: GatewayConfig): PaymentGateway {
  switch (config.provider) {
    case "asaas":
      return new AsaasGateway(config);
    case "pagseguro":
      return new PagSeguroGateway(config);
    case "stone":
      return new StoneGateway(config);
    case "stripe":
      throw new Error("Stripe gateway not implemented yet. Use Asaas, PagSeguro or Stone.");
    default:
      throw new Error(`Unknown payment gateway provider: ${config.provider}`);
  }
}

/**
 * Detecta provider pelo formato do webhook
 */
export function detectWebhookProvider(payload: unknown): GatewayProvider | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;

  // Asaas: tem campo "event" com prefixo PAYMENT_
  if (typeof data.event === "string" && data.event.startsWith("PAYMENT_")) {
    return "asaas";
  }

  // PagSeguro: tem campo "charges" ou "reference_id"
  if (Array.isArray(data.charges) || data.reference_id) {
    return "pagseguro";
  }

  // Stone: tem campo "event" e "data" com estrutura específica
  if (data.event && data.data && typeof data.data === "object") {
    return "stone";
  }

  return null;
}

/**
 * Valida se as credenciais do gateway são válidas
 */
export async function validateGatewayCredentials(config: GatewayConfig): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const gateway = createPaymentGateway(config);
    await gateway.getBalance();
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Erro ao validar credenciais",
    };
  }
}

/**
 * Retorna informações sobre o gateway
 */
export function getGatewayInfo(provider: GatewayProvider): {
  name: string;
  description: string;
  features: string[];
  docsUrl: string;
  supportsSplit: boolean;
  supportsPix: boolean;
  supportsBoleto: boolean;
  supportsCreditCard: boolean;
} {
  const gateways: Record<GatewayProvider, ReturnType<typeof getGatewayInfo>> = {
    asaas: {
      name: "Asaas",
      description: "Plataforma completa de cobranças e pagamentos",
      features: ["PIX", "Boleto", "Cartão de Crédito", "Split de Pagamento", "Subcontas"],
      docsUrl: "https://docs.asaas.com/",
      supportsSplit: true,
      supportsPix: true,
      supportsBoleto: true,
      supportsCreditCard: true,
    },
    pagseguro: {
      name: "PagSeguro / PagBank",
      description: "Gateway de pagamentos do UOL",
      features: ["PIX", "Boleto", "Cartão de Crédito", "Split de Pagamento"],
      docsUrl: "https://dev.pagbank.uol.com.br/",
      supportsSplit: true,
      supportsPix: true,
      supportsBoleto: true,
      supportsCreditCard: true,
    },
    stone: {
      name: "Stone",
      description: "Soluções de pagamento para negócios",
      features: ["PIX", "Boleto", "TEF", "Split de Pagamento", "Conta Digital"],
      docsUrl: "https://docs.stone.com.br/",
      supportsSplit: true,
      supportsPix: true,
      supportsBoleto: true,
      supportsCreditCard: true,
    },
    stripe: {
      name: "Stripe",
      description: "Plataforma global de pagamentos",
      features: ["Cartão de Crédito", "PIX (via parceiros)", "Connect"],
      docsUrl: "https://stripe.com/docs",
      supportsSplit: true,
      supportsPix: false,
      supportsBoleto: false,
      supportsCreditCard: true,
    },
  };

  return gateways[provider];
}

/**
 * Lista todos os gateways disponíveis
 */
export function getAvailableGateways(): Array<{
  provider: GatewayProvider;
  info: ReturnType<typeof getGatewayInfo>;
}> {
  const providers: GatewayProvider[] = ["asaas", "pagseguro", "stone"];
  return providers.map((provider) => ({
    provider,
    info: getGatewayInfo(provider),
  }));
}
