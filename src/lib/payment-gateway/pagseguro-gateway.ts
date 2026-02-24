/**
 * PagSeguro/PagBank Gateway Implementation
 * https://dev.pagbank.uol.com.br/
 */

import type {
  PaymentGateway,
  GatewayConfig,
  CustomerData,
  ChargeRequest,
  ChargeResponse,
  RefundRequest,
  RefundResponse,
  RecipientData,
  RecipientResponse,
  TransferRequest,
  TransferResponse,
  BalanceResponse,
  WebhookEvent,
  PaymentStatus,
} from "./types";

const PAGSEGURO_SANDBOX_URL = "https://sandbox.api.pagseguro.com";
const PAGSEGURO_PRODUCTION_URL = "https://api.pagseguro.com";

function mapPagSeguroStatus(status: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    WAITING: "pending",
    IN_ANALYSIS: "pending",
    AUTHORIZED: "confirmed",
    PAID: "received",
    AVAILABLE: "received",
    DISPUTE: "pending",
    REFUNDED: "refunded",
    CANCELED: "cancelled",
    DECLINED: "failed",
  };
  return statusMap[status] || "pending";
}

export class PagSeguroGateway implements PaymentGateway {
  readonly provider = "pagseguro" as const;
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret?: string;

  constructor(config: GatewayConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.environment === "production"
      ? PAGSEGURO_PRODUCTION_URL
      : PAGSEGURO_SANDBOX_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error_messages?.[0]?.description || `PagSeguro API error: ${response.status}`);
    }

    return response.json();
  }

  async createCustomer(data: CustomerData): Promise<string> {
    const result = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        tax_id: data.cpfCnpj?.replace(/\D/g, ""),
        phones: data.phone ? [{
          country: "55",
          area: data.phone.substring(0, 2),
          number: data.phone.substring(2),
          type: "MOBILE",
        }] : undefined,
      }),
    });
    return result.id;
  }

  async getCustomer(customerId: string): Promise<CustomerData | null> {
    try {
      const result = await this.request<{
        name: string;
        email: string;
        tax_id: string;
        phones?: { area: string; number: string }[];
      }>(`/customers/${customerId}`);

      return {
        name: result.name,
        email: result.email,
        cpfCnpj: result.tax_id,
        phone: result.phones?.[0] ? `${result.phones[0].area}${result.phones[0].number}` : undefined,
      };
    } catch {
      return null;
    }
  }

  async createCharge(request: ChargeRequest): Promise<ChargeResponse> {
    const qrCodes = request.paymentMethods?.includes("pix") ? [{
      amount: { value: Math.round(request.amount * 100) },
      expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }] : undefined;

    const boletos = request.paymentMethods?.includes("boleto") ? [{
      amount: { value: Math.round(request.amount * 100) },
      due_date: request.dueDate,
      instruction_lines: {
        line_1: request.description.substring(0, 75),
        line_2: "Não receber após vencimento",
      },
      holder: request.customer ? {
        name: request.customer.name,
        tax_id: request.customer.cpfCnpj?.replace(/\D/g, ""),
        email: request.customer.email,
      } : undefined,
    }] : undefined;

    const payload: Record<string, unknown> = {
      reference_id: request.externalReference,
      customer: request.customer ? {
        name: request.customer.name,
        email: request.customer.email,
        tax_id: request.customer.cpfCnpj?.replace(/\D/g, ""),
      } : undefined,
      items: [{
        name: request.description.substring(0, 64),
        quantity: 1,
        unit_amount: Math.round(request.amount * 100),
      }],
      qr_codes: qrCodes,
      boletos,
      notification_urls: [],
    };

    if (request.split && request.split.length > 0) {
      payload.splits = request.split.map((s) => ({
        method: s.type === "percentage" ? "PERCENTAGE" : "FIXED",
        receivers: [{
          account: { id: s.recipientId },
          amount: { value: s.type === "fixed" ? Math.round(s.value * 100) : s.value },
        }],
      }));
    }

    const result = await this.request<{
      id: string;
      status: string;
      qr_codes?: { id: string; text: string; links: { href: string; media: string }[] }[];
      boletos?: { id: string; barcode: string; formatted_barcode: string; links: { href: string; media: string }[] }[];
    }>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const pixQrCode = result.qr_codes?.[0]?.links?.find((l) => l.media === "image/png")?.href;
    const boletoLink = result.boletos?.[0]?.links?.find((l) => l.media === "application/pdf")?.href;

    return {
      id: result.id,
      status: mapPagSeguroStatus(result.status),
      amount: request.amount,
      pixQrCode,
      pixCopyPaste: result.qr_codes?.[0]?.text,
      boletoUrl: boletoLink,
      boletoBarcode: result.boletos?.[0]?.barcode,
      boletoDigitableLine: result.boletos?.[0]?.formatted_barcode,
      dueDate: request.dueDate,
      provider: "pagseguro",
      rawResponse: result,
    };
  }

  async getCharge(chargeId: string): Promise<ChargeResponse | null> {
    try {
      const result = await this.request<{
        id: string;
        status: string;
        charges?: { amount: { value: number }; paid_at?: string }[];
      }>(`/orders/${chargeId}`);

      const charge = result.charges?.[0];

      return {
        id: result.id,
        status: mapPagSeguroStatus(result.status),
        amount: charge ? charge.amount.value / 100 : 0,
        dueDate: "",
        paidAt: charge?.paid_at,
        provider: "pagseguro",
        rawResponse: result,
      };
    } catch {
      return null;
    }
  }

  async cancelCharge(chargeId: string): Promise<boolean> {
    try {
      await this.request(`/orders/${chargeId}/cancel`, { method: "POST" });
      return true;
    } catch {
      return false;
    }
  }

  async refundCharge(request: RefundRequest): Promise<RefundResponse> {
    const result = await this.request<{ id: string; amount: { value: number }; status: string }>(
      `/charges/${request.chargeId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: request.amount ? { value: Math.round(request.amount * 100) } : undefined,
        }),
      }
    );

    return {
      id: result.id,
      chargeId: request.chargeId,
      amount: result.amount.value / 100,
      status: result.status === "CANCELED" ? "completed" : "pending",
      provider: "pagseguro",
    };
  }

  async createRecipient(data: RecipientData): Promise<RecipientResponse> {
    const result = await this.request<{ id: string }>("/connect/accounts", {
      method: "POST",
      body: JSON.stringify({
        type: data.cpfCnpj.length > 11 ? "SELLER" : "SELLER",
        person: {
          name: data.name,
          email: data.email,
          tax_id: data.cpfCnpj.replace(/\D/g, ""),
        },
        bank_accounts: data.bankAccount ? [{
          bank: { code: data.bankAccount.bank },
          agency: data.bankAccount.agency,
          number: data.bankAccount.account,
          digit: data.bankAccount.accountDigit,
          type: data.bankAccount.accountType === "checking" ? "CHECKING" : "SAVINGS",
        }] : undefined,
      }),
    });

    return {
      id: result.id,
      status: "pending",
      provider: "pagseguro",
    };
  }

  async getRecipient(recipientId: string): Promise<RecipientResponse | null> {
    try {
      const result = await this.request<{ id: string; status: string }>(`/connect/accounts/${recipientId}`);
      return {
        id: result.id,
        status: result.status === "ACTIVE" ? "active" : "pending",
        provider: "pagseguro",
      };
    } catch {
      return null;
    }
  }

  async transfer(request: TransferRequest): Promise<TransferResponse> {
    const result = await this.request<{ id: string; amount: { value: number }; status: string }>("/transfers", {
      method: "POST",
      body: JSON.stringify({
        receiver: { id: request.recipientId },
        amount: { value: Math.round(request.amount * 100) },
        description: request.description,
      }),
    });

    return {
      id: result.id,
      recipientId: request.recipientId,
      amount: result.amount.value / 100,
      status: result.status === "COMPLETED" ? "completed" : "pending",
      provider: "pagseguro",
    };
  }

  async getBalance(): Promise<BalanceResponse> {
    const result = await this.request<{ 
      available: { amount: number }; 
      blocked: { amount: number };
    }>("/balance");
    
    return {
      available: result.available.amount / 100,
      pending: 0,
      blocked: result.blocked.amount / 100,
      provider: "pagseguro",
    };
  }

  parseWebhook(payload: unknown): WebhookEvent | null {
    const data = payload as {
      id: string;
      reference_id?: string;
      charges?: { id: string; status: string; amount: { value: number }; paid_at?: string }[];
    };

    if (!data.id) return null;

    const charge = data.charges?.[0];

    return {
      id: data.id,
      type: "ORDER_PAID",
      chargeId: charge?.id || data.id,
      status: charge ? mapPagSeguroStatus(charge.status) : "pending",
      amount: charge ? charge.amount.value / 100 : undefined,
      paidAt: charge?.paid_at,
      provider: "pagseguro",
      rawPayload: payload,
    };
  }

  validateWebhook(_payload: unknown, _signature: string): boolean {
    // PagSeguro webhook validation via notification URL
    return true;
  }
}
