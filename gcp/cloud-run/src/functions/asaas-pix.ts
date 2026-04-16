/**
 * asaas-pix — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
/**
 * asaas-pix — Criação de cobranças PIX via Asaas
 *
 * POST /functions/v1/asaas-pix
 * Body: {
 *   action: "create_charge" | "get_qrcode" | "cancel_charge",
 *   // create_charge:
 *   customer_name?: string,
 *   customer_cpf_cnpj?: string,
 *   customer_email?: string,
 *   value?: number,
 *   due_date?: string,         // YYYY-MM-DD
 *   description?: string,
 *   // get_qrcode / cancel_charge:
 *   charge_id?: string,
 * }
 *
 * Env secrets required (set in Secret Manager):
 *   ASAAS_API_KEY   — chave de API Asaas do tenant
 *
 * Optionally per-tenant (read from tenants.asaas_api_key if column exists):
 *   Neste MVP, a chave é única por deployment (uma conta Asaas).
 */

const log = createLogger("ASAAS-PIX");

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3";

type CreateChargeBody = {
  action: "create_charge";
  customer_name: string;
  customer_cpf_cnpj?: string;
  customer_email?: string;
  value: number;
  due_date: string;
  description?: string;
};

type GetQrcodeBody = {
  action: "get_qrcode";
  charge_id: string;
};

type CancelChargeBody = {
  action: "cancel_charge";
  charge_id: string;
};

type RequestBody = CreateChargeBody | GetQrcodeBody | CancelChargeBody;

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.description ?? data?.description ?? "Erro Asaas");
  }
  return data;
}

async function ensureAsaasCustomer(
  apiKey: string,
  name: string,
  cpfCnpj?: string,
  email?: string): Promise<string> {
  // Try to find existing customer by cpfCnpj
  if (cpfCnpj) {
    const search = await asaasRequest(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, "GET", apiKey);
    if (search?.data?.length > 0) {
      return search.data[0].id as string;
    }
  }

  // Create new customer
  const created = await asaasRequest("/customers", "POST", apiKey, {
    name,
    cpfCnpj: cpfCnpj ?? undefined,
    email: email ?? undefined,
  });
  return created.uid as string;
}

export async function asaasPix(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      try {
        // Authenticate user
        const profile = (req as any).user;
        const user = (req as any).user;
      const tenant_id = user?.user_metadata?.tenant_id;
      if (!user || !tenant_id) {
          return res.status(401).json({ error: "Não autorizado" });
        }

        // Get Asaas API key: first try tenant column, then env secret
        let apiKey = process.env.ASAAS_API_KEY ?? "";

        // Try to fetch tenant-specific key if column exists
        const { data: tenantRow } = await db.from("tenants")
          .select("asaas_api_key")
          .eq("id", (user as any)?.user_metadata?.tenant_id)
          .single();
        if (tenantRow?.asaas_api_key) {
          apiKey = tenantRow.asaas_api_key as string;
        }

        if (!apiKey) {
          return res.status(400).json({ error: "Chave Asaas não configurada. Configure em Configurações da Clínica." });
        }

        const body = req.body as RequestBody;

        if (body.action === "create_charge") {
          const { customer_name, customer_cpf_cnpj, customer_email, value, due_date, description } = body;

          if (!customer_name || !value || !due_date) {
            return res.status(400).json({ error: "Campos obrigatórios: customer_name, value, due_date" });
          }

          log("Creating Asaas customer...");
          const customerId = await ensureAsaasCustomer(apiKey, customer_name, customer_cpf_cnpj, customer_email);

          log("Creating PIX charge...");
          const charge = await asaasRequest("/payments", "POST", apiKey, {
            customer: customerId,
            billingType: "PIX",
            value,
            dueDate: due_date,
            description: description ?? "Cobrança ClinicNest",
          });

          log("Fetching PIX QR code...");
          const qrcode = await asaasRequest(`/payments/${charge.id}/pixQrCode`, "GET", apiKey);

          return res.json({
            success: true,
            charge_id: charge.id,
            invoice_url: charge.invoiceUrl ?? null,
            pix_encoded_image: qrcode.encodedImage ?? null,
            pix_copy_paste: qrcode.payload ?? null,
            expiration_date: qrcode.expirationDate ?? null,
            status: charge.status,
          });
        }

        if (body.action === "get_qrcode") {
          const { charge_id } = body;
          if (!charge_id) {
            return res.status(400).json({ error: "charge_id obrigatório" });
          }

          const [charge, qrcode] = await Promise.all([
            asaasRequest(`/payments/${charge_id}`, "GET", apiKey),
            asaasRequest(`/payments/${charge_id}/pixQrCode`, "GET", apiKey),
          ]);

          return res.json({
            success: true,
            charge_id,
            status: charge.status,
            pix_encoded_image: qrcode.encodedImage ?? null,
            pix_copy_paste: qrcode.payload ?? null,
            expiration_date: qrcode.expirationDate ?? null,
          });
        }

        if (body.action === "cancel_charge") {
          const { charge_id } = body;
          if (!charge_id) {
            return res.status(400).json({ error: "charge_id obrigatório" });
          }

          await asaasRequest(`/payments/${charge_id}`, "DELETE", apiKey);
          return res.json({ success: true, charge_id });
        }

        return res.status(400).json({ error: "action inválida" });
      } catch (err: any) {
        log("asaas-pix error", err);
        const msg = err instanceof Error ? err.message : "Erro interno";
        return res.status(500).json({ error: msg });
      }
  } catch (err: any) {
    console.error(`[asaas-pix] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

