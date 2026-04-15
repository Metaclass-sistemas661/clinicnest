/**
 * payment-webhook-handler — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createDbClient } from '../shared/db-builder';
/**
 * Edge Function: payment-webhook-handler
 * Webhook handler unificado para todos os gateways de pagamento
 */

const {} = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-asaas-access-token, x-pagseguro-signature, x-stone-signature",
};

type PaymentStatus = "pending" | "confirmed" | "received" | "overdue" | "refunded" | "cancelled" | "failed";

interface WebhookResult {
  provider: string;
  charge_id: string;
  status: PaymentStatus;
  amount?: number;
  paid_at?: string;
}

function detectProvider(req: Request, body: unknown): string | null {
  const headers = (req.headers as any);

  // Check headers first
  if (headers["x-asaas-access-token"]) return "asaas";
  if (headers["x-pagseguro-signature"]) return "pagseguro";
  if (headers["x-stone-signature"]) return "stone";

  // Check body structure
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  // Asaas: has "event" starting with PAYMENT_
  if (typeof data.event === "string" && data.event.startsWith("PAYMENT_")) {
    return "asaas";
  }

  // PagSeguro: has "charges" array or specific structure
  if (Array.isArray(data.charges) || data.reference_id) {
    return "pagseguro";
  }

  // Stone: has "event" and "data" object
  if (data.event && data.data && typeof data.data === "object") {
    return "stone";
  }

  return null;
}

function parseAsaasWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    event: string;
    payment?: {
      id: string;
      status: string;
      value: number;
      paymentDate?: string;
    };
  };

  if (!data.payment) return null;

  const statusMap: Record<string, PaymentStatus> = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    RECEIVED: "received",
    OVERDUE: "overdue",
    REFUNDED: "refunded",
    CANCELLED: "cancelled",
  };

  return {
    provider: "asaas",
    charge_id: data.payment.id,
    status: statusMap[data.payment.status] || "pending",
    amount: data.payment.value,
    paid_at: data.payment.paymentDate,
  };
}

function parsePagSeguroWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    id: string;
    charges?: Array<{
      id: string;
      status: string;
      amount: { value: number };
      paid_at?: string;
    }>;
  };

  const charge = data.charges?.[0];
  if (!charge) return null;

  const statusMap: Record<string, PaymentStatus> = {
    WAITING: "pending",
    IN_ANALYSIS: "pending",
    AUTHORIZED: "confirmed",
    PAID: "received",
    AVAILABLE: "received",
    REFUNDED: "refunded",
    CANCELED: "cancelled",
    DECLINED: "failed",
  };

  return {
    provider: "pagseguro",
    charge_id: charge.id,
    status: statusMap[charge.status] || "pending",
    amount: charge.amount.value / 100,
    paid_at: charge.paid_at,
  };
}

function parseStoneWebhook(body: unknown): WebhookResult | null {
  const data = body as {
    event: string;
    data: {
      id: string;
      status: string;
      amount: number;
      paid_at?: string;
    };
  };

  if (!data.data) return null;

  const statusMap: Record<string, PaymentStatus> = {
    created: "pending",
    pending: "pending",
    approved: "confirmed",
    settled: "received",
    refunded: "refunded",
    cancelled: "cancelled",
    failed: "failed",
  };

  return {
    provider: "stone",
    charge_id: data.data.id,
    status: statusMap[data.data.status] || "pending",
    amount: data.data.amount / 100,
    paid_at: data.data.paid_at,
  };
}

export async function paymentWebhookHandler(req: Request, res: Response) {
  try {
    const db = createDbClient();
      try {
        // Rate limiting: 100 webhook calls per minute per IP
        const requesterIp = (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() || "unknown";
        const rl = await checkRateLimit(`payment-webhook:${requesterIp}`, 100, 60);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Rate limit exceeded" });
        }
        const body = req.body;
        const provider = detectProvider(req, body);

        if (!provider) {
          console.warn("Unknown webhook provider");
          return res.status(400).json({ error: "Unknown provider" });
        }

        // Validate webhook authenticity per provider
        const webhookSecrets: Record<string, string> = {
          asaas: process.env.ASAAS_WEBHOOK_TOKEN ?? "",
          pagseguro: process.env.PAGSEGURO_WEBHOOK_TOKEN ?? "",
          stone: process.env.STONE_WEBHOOK_TOKEN ?? "",
        };
        const expectedToken = webhookSecrets[provider];
        if (expectedToken) {
          const providedToken =
            (req.headers['x-asaas-access-token'] as string) ||
            (req.headers['x-pagseguro-token'] as string) ||
            (req.headers['x-stone-token'] as string) ||
            (body as Record<string, unknown>)?.webhook_token ||
            "";
          if (providedToken !== expectedToken) {
            console.warn(`[payment-webhook] Invalid webhook token for provider: ${provider}`);
            return res.status(401).json({ error: "Invalid webhook token" });
          }
        }

        // Parse webhook based on provider
        let result: WebhookResult | null = null;
        switch (provider) {
          case "asaas":
            result = parseAsaasWebhook(body);
            break;
          case "pagseguro":
            result = parsePagSeguroWebhook(body);
            break;
          case "stone":
            result = parseStoneWebhook(body);
            break;
        }

        if (!result) {
          console.warn("Could not parse webhook:", provider);
          return res.status(400).json({ error: "Could not parse webhook" });
        }

        // Update split_payment_logs if exists
        const { data: splitLog } = await db.from("split_payment_logs")
          .select("id, tenant_id, appointment_id, professional_id, split_amount")
          .eq("charge_id", result.charge_id)
          .maybeSingle();

        if (splitLog) {
          // Update split log status
          const newStatus = result.status === "received" ? "completed" : result.status;
          await db.from("split_payment_logs")
            .update({
              status: newStatus,
              webhook_received_at: new Date().toISOString(),
              settled_at: result.status === "received" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", splitLog.id);

          // If payment received and split completed, create commission_payment record
          if (result.status === "received" && splitLog.professional_id) {
            // Check if commission_payment already exists
            const { data: existingCommission } = await db.from("commission_payments")
              .select("id")
              .eq("appointment_id", splitLog.appointment_id)
              .eq("professional_id", splitLog.professional_id)
              .maybeSingle();

            if (!existingCommission) {
              await db.from("commission_payments").insert({
                tenant_id: splitLog.tenant_id,
                professional_id: splitLog.professional_id,
                appointment_id: splitLog.appointment_id,
                amount: splitLog.split_amount,
                service_price: result.amount || 0,
                status: "paid",
                payment_date: new Date().toISOString(),
                notes: `Split automático via ${provider}`,
              });
            }
          }
        }

        // Update patient_invoices if exists
        const { data: invoice } = await db.from("patient_invoices")
          .select("id")
          .eq("external_payment_id", result.charge_id)
          .maybeSingle();

        if (invoice) {
          const invoiceStatus = result.status === "received" ? "paid" :
                               result.status === "cancelled" ? "cancelled" :
                               result.status === "refunded" ? "refunded" : "pending";

          await db.from("patient_invoices")
            .update({
              status: invoiceStatus,
              paid_at: result.status === "received" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);
        }

        // Log webhook
        await db.from("webhook_logs").insert({
          provider,
          event_type: result.status,
          payload: body,
          processed_at: new Date().toISOString(),
        }).then((_:any) => _, () => { /* table may not exist */ });

        return res.status(200).json({ success: true, processed: result });
      } catch (error: any) {
        console.error("Webhook error:", error);
        return res.status(500).json({ error: "Internal error" });
      }
  } catch (err: any) {
    console.error(`[payment-webhook-handler] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

