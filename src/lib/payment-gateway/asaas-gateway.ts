/**
 * Asaas Gateway Implementation
 * https://docs.asaas.com/
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

const ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3";
const ASAAS_PRODUCTION_URL = "https://api.asaas.com/v3";

function mapAsaasStatus(status: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    RECEIVED: "received",
    OVERDUE: "overdue",
    REFUNDED: "refunded",
    REFUND_REQUESTED: "refunded",
    CANCELLED: "cancelled",
    DELETED: "cancelled",
  };
  return statusMap[status] || "pending";
}

export class AsaasGateway implements PaymentGateway {
  readonly provider = "asaas" as const;
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret?: string;

  constructor(config: GatewayConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.environment === "production" 
      ? ASAAS_PRODUCTION_URL 
      : ASAAS_SANDBOX_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "access_token": this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors?.[0]?.description || `Asaas API error: ${response.status}`);
    }

    return response.json();
  }

  async createCustomer(data: CustomerData): Promise<string> {
    const result = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        phone: data.phone,
        externalReference: data.externalId,
      }),
    });
    return result.id;
  }

  async getCustomer(customerId: string): Promise<CustomerData | null> {
    try {
      const result = await this.request<{
        name: string;
        email: string;
        cpfCnpj: string;
        phone: string;
        externalReference: string;
      }>(`/customers/${customerId}`);
      
      return {
        name: result.name,
        email: result.email,
        cpfCnpj: result.cpfCnpj,
        phone: result.phone,
        externalId: result.externalReference,
      };
    } catch {
      return null;
    }
  }

  async createCharge(request: ChargeRequest): Promise<ChargeResponse> {
    let customerId = request.customerId;

    if (!customerId && request.customer) {
      const existingCustomers = await this.request<{ data: { id: string }[] }>(
        `/customers?email=${encodeURIComponent(request.customer.email)}`
      );
      
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        customerId = await this.createCustomer(request.customer);
      }
    }

    const billingType = request.paymentMethods?.includes("pix") 
      ? "PIX" 
      : request.paymentMethods?.includes("boleto") 
        ? "BOLETO" 
        : "UNDEFINED";

    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: request.amount,
      dueDate: request.dueDate,
      description: request.description,
      externalReference: request.externalReference,
    };

    if (request.split && request.split.length > 0) {
      payload.split = request.split.map((s) => ({
        walletId: s.recipientId,
        fixedValue: s.type === "fixed" ? s.value : undefined,
        percentualValue: s.type === "percentage" ? s.value : undefined,
      }));
    }

    const result = await this.request<{
      id: string;
      status: string;
      value: number;
      netValue: number;
      invoiceUrl: string;
      bankSlipUrl: string;
      nossoNumero: string;
      dueDate: string;
      dateCreated: string;
    }>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    let pixData: { encodedImage: string; payload: string } | null = null;
    if (billingType === "PIX") {
      try {
        pixData = await this.request<{ encodedImage: string; payload: string }>(
          `/payments/${result.id}/pixQrCode`
        );
      } catch {
        // PIX QR code may not be available immediately
      }
    }

    return {
      id: result.id,
      status: mapAsaasStatus(result.status),
      amount: result.value,
      netAmount: result.netValue,
      paymentUrl: result.invoiceUrl,
      boletoUrl: result.bankSlipUrl,
      boletoBarcode: result.nossoNumero,
      pixQrCode: pixData?.encodedImage,
      pixCopyPaste: pixData?.payload,
      dueDate: result.dueDate,
      provider: "asaas",
      rawResponse: result,
    };
  }

  async getCharge(chargeId: string): Promise<ChargeResponse | null> {
    try {
      const result = await this.request<{
        id: string;
        status: string;
        value: number;
        netValue: number;
        invoiceUrl: string;
        bankSlipUrl: string;
        dueDate: string;
        paymentDate: string;
      }>(`/payments/${chargeId}`);

      return {
        id: result.id,
        status: mapAsaasStatus(result.status),
        amount: result.value,
        netAmount: result.netValue,
        paymentUrl: result.invoiceUrl,
        boletoUrl: result.bankSlipUrl,
        dueDate: result.dueDate,
        paidAt: result.paymentDate,
        provider: "asaas",
        rawResponse: result,
      };
    } catch {
      return null;
    }
  }

  async cancelCharge(chargeId: string): Promise<boolean> {
    try {
      await this.request(`/payments/${chargeId}`, { method: "DELETE" });
      return true;
    } catch {
      return false;
    }
  }

  async refundCharge(request: RefundRequest): Promise<RefundResponse> {
    const result = await this.request<{ id: string; value: number; status: string }>(
      `/payments/${request.chargeId}/refund`,
      {
        method: "POST",
        body: JSON.stringify({
          value: request.amount,
          description: request.reason,
        }),
      }
    );

    return {
      id: result.id,
      chargeId: request.chargeId,
      amount: result.value,
      status: result.status === "DONE" ? "completed" : "pending",
      provider: "asaas",
    };
  }

  async createRecipient(data: RecipientData): Promise<RecipientResponse> {
    const result = await this.request<{ id: string; walletId: string }>("/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        companyType: data.cpfCnpj.length > 11 ? "LIMITED" : null,
        bankAccount: data.bankAccount ? {
          bank: { code: data.bankAccount.bank },
          accountName: data.name,
          ownerName: data.name,
          cpfCnpj: data.cpfCnpj,
          agency: data.bankAccount.agency,
          account: data.bankAccount.account,
          accountDigit: data.bankAccount.accountDigit,
          bankAccountType: data.bankAccount.accountType === "checking" ? "CONTA_CORRENTE" : "CONTA_POUPANCA",
        } : undefined,
      }),
    });

    return {
      id: result.id,
      walletId: result.walletId,
      status: "active",
      provider: "asaas",
    };
  }

  async getRecipient(recipientId: string): Promise<RecipientResponse | null> {
    try {
      const result = await this.request<{ id: string; walletId: string }>(`/accounts/${recipientId}`);
      return {
        id: result.id,
        walletId: result.walletId,
        status: "active",
        provider: "asaas",
      };
    } catch {
      return null;
    }
  }

  async transfer(request: TransferRequest): Promise<TransferResponse> {
    const result = await this.request<{ id: string; value: number; status: string }>("/transfers", {
      method: "POST",
      body: JSON.stringify({
        walletId: request.recipientId,
        value: request.amount,
        description: request.description,
      }),
    });

    return {
      id: result.id,
      recipientId: request.recipientId,
      amount: result.value,
      status: result.status === "DONE" ? "completed" : "pending",
      provider: "asaas",
    };
  }

  async getBalance(): Promise<BalanceResponse> {
    const result = await this.request<{ balance: number; pendingBalance: number }>("/finance/balance");
    return {
      available: result.balance,
      pending: result.pendingBalance,
      provider: "asaas",
    };
  }

  parseWebhook(payload: unknown): WebhookEvent | null {
    const data = payload as {
      event: string;
      payment?: {
        id: string;
        status: string;
        value: number;
        paymentDate: string;
      };
    };

    if (!data.event || !data.payment) return null;

    return {
      id: data.payment.id,
      type: data.event,
      chargeId: data.payment.id,
      status: mapAsaasStatus(data.payment.status),
      amount: data.payment.value,
      paidAt: data.payment.paymentDate,
      provider: "asaas",
      rawPayload: payload,
    };
  }

  validateWebhook(payload: unknown, signature: string): boolean {
    if (!this.webhookSecret) return true;
    // Asaas uses access_token validation in webhook
    return signature === this.webhookSecret;
  }
}
