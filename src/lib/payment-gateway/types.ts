/**
 * Payment Gateway Abstraction Layer - Types
 * Padrão Strategy para suportar múltiplos gateways de pagamento
 */

export type GatewayProvider = "asaas" | "stone" | "pagseguro" | "stripe";

export type PaymentMethod = "pix" | "boleto" | "credit_card" | "debit_card";

export type PaymentStatus = 
  | "pending" 
  | "confirmed" 
  | "received" 
  | "overdue" 
  | "refunded" 
  | "cancelled"
  | "failed";

export type SplitType = "percentage" | "fixed";

export interface GatewayConfig {
  provider: GatewayProvider;
  apiKey: string;
  webhookSecret?: string;
  environment: "sandbox" | "production";
  baseUrl?: string;
}

export interface CustomerData {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  externalId?: string;
}

export interface SplitRule {
  recipientId: string;
  type: SplitType;
  value: number;
  chargeProcessingFee?: boolean;
}

export interface ChargeRequest {
  customerId?: string;
  customer?: CustomerData;
  amount: number;
  description: string;
  dueDate: string;
  paymentMethods?: PaymentMethod[];
  externalReference?: string;
  split?: SplitRule[];
  metadata?: Record<string, unknown>;
}

export interface ChargeResponse {
  id: string;
  status: PaymentStatus;
  amount: number;
  netAmount?: number;
  paymentUrl?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  boletoDigitableLine?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  dueDate: string;
  paidAt?: string;
  provider: GatewayProvider;
  rawResponse?: unknown;
}

export interface RefundRequest {
  chargeId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResponse {
  id: string;
  chargeId: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  provider: GatewayProvider;
}

export interface RecipientData {
  name: string;
  email: string;
  cpfCnpj: string;
  bankAccount?: {
    bank: string;
    accountType: "checking" | "savings";
    agency: string;
    account: string;
    accountDigit?: string;
  };
  pixKey?: string;
}

export interface RecipientResponse {
  id: string;
  walletId?: string;
  status: "pending" | "active" | "inactive";
  provider: GatewayProvider;
}

export interface TransferRequest {
  recipientId: string;
  amount: number;
  description?: string;
}

export interface TransferResponse {
  id: string;
  recipientId: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  provider: GatewayProvider;
}

export interface BalanceResponse {
  available: number;
  pending: number;
  blocked?: number;
  provider: GatewayProvider;
}

export interface WebhookEvent {
  id: string;
  type: string;
  chargeId?: string;
  paymentId?: string;
  status?: PaymentStatus;
  amount?: number;
  paidAt?: string;
  provider: GatewayProvider;
  rawPayload: unknown;
}

export interface PaymentGateway {
  readonly provider: GatewayProvider;
  
  createCustomer(data: CustomerData): Promise<string>;
  getCustomer(customerId: string): Promise<CustomerData | null>;
  
  createCharge(request: ChargeRequest): Promise<ChargeResponse>;
  getCharge(chargeId: string): Promise<ChargeResponse | null>;
  cancelCharge(chargeId: string): Promise<boolean>;
  refundCharge(request: RefundRequest): Promise<RefundResponse>;
  
  createRecipient(data: RecipientData): Promise<RecipientResponse>;
  getRecipient(recipientId: string): Promise<RecipientResponse | null>;
  
  transfer(request: TransferRequest): Promise<TransferResponse>;
  getBalance(): Promise<BalanceResponse>;
  
  parseWebhook(payload: unknown, signature?: string): WebhookEvent | null;
  validateWebhook(payload: unknown, signature: string): boolean;
}
