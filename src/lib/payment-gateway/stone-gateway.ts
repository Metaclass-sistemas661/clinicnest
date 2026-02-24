/**
 * Stone Gateway Implementation
 * https://docs.stone.com.br/
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

const STONE_SANDBOX_URL = "https://sandbox-api.openbank.stone.com.br/api/v1";
const STONE_PRODUCTION_URL = "https://api.openbank.stone.com.br/api/v1";

function mapStoneStatus(status: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    created: "pending",
    pending: "pending",
    approved: "confirmed",
    settled: "received",
    refunded: "refunded",
    cancelled: "cancelled",
    failed: "failed",
  };
  return statusMap[status] || "pending";
}

export class StoneGateway implements PaymentGateway {
  readonly provider = "stone" as const;
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret?: string;

  constructor(config: GatewayConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.environment === "production"
      ? STONE_PRODUCTION_URL
      : STONE_SANDBOX_URL;
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
      throw new Error(error.message || `Stone API error: ${response.status}`);
    }

    return response.json();
  }

  async createCustomer(data: CustomerData): Promise<string> {
    const result = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        document: data.cpfCnpj?.replace(/\D/g, ""),
        phone: data.phone,
      }),
    });
    return result.id;
  }

  async getCustomer(customerId: string): Promise<CustomerData | null> {
    try {
      const result = await this.request<{
        name: string;
        email: string;
        document: string;
        phone: string;
      }>(`/customers/${customerId}`);

      return {
        name: result.name,
        email: result.email,
        cpfCnpj: result.document,
        phone: result.phone,
      };
    } catch {
      return null;
    }
  }

  async createCharge(request: ChargeRequest): Promise<ChargeResponse> {
    const payload: Record<string, unknown> = {
      amount: Math.round(request.amount * 100),
      description: request.description,
      due_date: request.dueDate,
      external_id: request.externalReference,
      customer: request.customer ? {
        name: request.customer.name,
        email: request.customer.email,
        document: request.customer.cpfCnpj?.replace(/\D/g, ""),
      } : undefined,
    };

    if (request.split && request.split.length > 0) {
      payload.split_rules = request.split.map((s) => ({
        recipient_id: s.recipientId,
        type: s.type,
        amount: s.type === "fixed" ? Math.round(s.value * 100) : undefined,
        percentage: s.type === "percentage" ? s.value : undefined,
        charge_processing_fee: s.chargeProcessingFee ?? false,
      }));
    }

    const result = await this.request<{
      id: string;
      status: string;
      amount: number;
      pix_qr_code?: string;
      pix_copy_paste?: string;
      boleto_url?: string;
      boleto_barcode?: string;
      due_date: string;
    }>("/charges", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      id: result.id,
      status: mapStoneStatus(result.status),
      amount: result.amount / 100,
      pixQrCode: result.pix_qr_code,
      pixCopyPaste: result.pix_copy_paste,
      boletoUrl: result.boleto_url,
      boletoBarcode: result.boleto_barcode,
      dueDate: result.due_date,
      provider: "stone",
      rawResponse: result,
    };
  }

  async getCharge(chargeId: string): Promise<ChargeResponse | null> {
    try {
      const result = await this.request<{
        id: string;
        status: string;
        amount: number;
        due_date: string;
        paid_at?: string;
      }>(`/charges/${chargeId}`);

      return {
        id: result.id,
        status: mapStoneStatus(result.status),
        amount: result.amount / 100,
        dueDate: result.due_date,
        paidAt: result.paid_at,
        provider: "stone",
        rawResponse: result,
      };
    } catch {
      return null;
    }
  }

  async cancelCharge(chargeId: string): Promise<boolean> {
    try {
      await this.request(`/charges/${chargeId}/cancel`, { method: "POST" });
      return true;
    } catch {
      return false;
    }
  }

  async refundCharge(request: RefundRequest): Promise<RefundResponse> {
    const result = await this.request<{ id: string; amount: number; status: string }>(
      `/charges/${request.chargeId}/refund`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: request.amount ? Math.round(request.amount * 100) : undefined,
        }),
      }
    );

    return {
      id: result.id,
      chargeId: request.chargeId,
      amount: result.amount / 100,
      status: result.status === "completed" ? "completed" : "pending",
      provider: "stone",
    };
  }

  async createRecipient(data: RecipientData): Promise<RecipientResponse> {
    const result = await this.request<{ id: string; status: string }>("/recipients", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        document: data.cpfCnpj.replace(/\D/g, ""),
        bank_account: data.bankAccount ? {
          bank_code: data.bankAccount.bank,
          agency: data.bankAccount.agency,
          account: data.bankAccount.account,
          account_digit: data.bankAccount.accountDigit,
          type: data.bankAccount.accountType,
        } : undefined,
        pix_key: data.pixKey,
      }),
    });

    return {
      id: result.id,
      status: result.status === "active" ? "active" : "pending",
      provider: "stone",
    };
  }

  async getRecipient(recipientId: string): Promise<RecipientResponse | null> {
    try {
      const result = await this.request<{ id: string; status: string }>(`/recipients/${recipientId}`);
      return {
        id: result.id,
        status: result.status === "active" ? "active" : "pending",
        provider: "stone",
      };
    } catch {
      return null;
    }
  }

  async transfer(request: TransferRequest): Promise<TransferResponse> {
    const result = await this.request<{ id: string; amount: number; status: string }>("/transfers", {
      method: "POST",
      body: JSON.stringify({
        recipient_id: request.recipientId,
        amount: Math.round(request.amount * 100),
        description: request.description,
      }),
    });

    return {
      id: result.id,
      recipientId: request.recipientId,
      amount: result.amount / 100,
      status: result.status === "completed" ? "completed" : "pending",
      provider: "stone",
    };
  }

  async getBalance(): Promise<BalanceResponse> {
    const result = await this.request<{
      available_amount: number;
      pending_amount: number;
      blocked_amount: number;
    }>("/balance");

    return {
      available: result.available_amount / 100,
      pending: result.pending_amount / 100,
      blocked: result.blocked_amount / 100,
      provider: "stone",
    };
  }

  parseWebhook(payload: unknown): WebhookEvent | null {
    const data = payload as {
      event: string;
      data: {
        id: string;
        status: string;
        amount: number;
        paid_at?: string;
      };
    };

    if (!data.event || !data.data) return null;

    return {
      id: data.data.id,
      type: data.event,
      chargeId: data.data.id,
      status: mapStoneStatus(data.data.status),
      amount: data.data.amount / 100,
      paidAt: data.data.paid_at,
      provider: "stone",
      rawPayload: payload,
    };
  }

  validateWebhook(_payload: unknown, signature: string): boolean {
    if (!this.webhookSecret) return true;
    return signature === this.webhookSecret;
  }
}
