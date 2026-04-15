/**
 * emit-nfse — Cloud Run handler */

import { Request, Response } from 'express';
import { createDbClient } from '../shared/db-builder';
const {} = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NFEIO_API_URL = "https://api.nfe.io/v1";

interface EmitNFSeRequest {
  tenant_id: string;
  payment_id?: string;
  client_id: string;
  description: string;
  amount: number;
  service_code?: string;
}

export async function emitNfse(req: Request, res: Response) {
  try {
    const db = createDbClient();
        const body: EmitNFSeRequest = req.body;
        const { tenant_id, payment_id, client_id, description, amount, service_code } = body;

        if (!tenant_id || !client_id || !description || !amount) {
          return res.status(400).json({ error: "Missing required fields: tenant_id, client_id, description, amount" });
        }

        // Get tenant NFE.io config
        const { data: tenant, error: tenantError } = await db.from("tenants")
          .select("nfeio_api_key, nfeio_company_id, nfeio_active, nfeio_default_service_code")
          .eq("id", tenant_id)
          .single();

        if (tenantError || !tenant) {
          return res.status(404).json({ error: "Tenant not found" });
        }

        if (!tenant.nfeio_active || !tenant.nfeio_api_key || !tenant.nfeio_company_id) {
          return res.status(400).json({ error: "NFE.io integration not configured for this tenant" });
        }

        // Get client data
        const { data: client, error: clientError } = await db.from("clients")
          .select("name, cpf, email, phone, address, city, state, zip_code")
          .eq("id", client_id)
          .single();

        if (clientError || !client) {
          return res.status(404).json({ error: "Client not found" });
        }

        // Build NFS-e payload for NFE.io
        const nfsePayload = {
          borrower: {
            name: client.name,
            federalTaxNumber: client.cpf?.replace(/\D/g, ""),
            email: client.email,
            address: client.address ? {
              country: "BRA",
              postalCode: client.zip_code?.replace(/\D/g, ""),
              street: client.address,
              district: "",
              city: {
                name: client.city,
              },
              state: client.state,
            } : undefined,
          },
          cityServiceCode: service_code || tenant.nfeio_default_service_code || "4.03",
          description: description,
          servicesAmount: amount,
          taxationType: "WithinCity",
        };

        // Call NFE.io API to emit NFS-e
        const nfeioResponse = await fetch(
          `${NFEIO_API_URL}/companies/${tenant.nfeio_company_id}/serviceinvoices`,
          {
            method: "POST",
            headers: {
              "Authorization": tenant.nfeio_api_key,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(nfsePayload),
          }
        );

        const nfeioData = await nfeioResponse.json() as any;

        if (!nfeioResponse.ok) {
          console.error("[emit-nfse] NFE.io error:", nfeioData);
          return res.status(nfeioResponse.status).json({
            error: "NFE.io API error",
            details: nfeioData.message || nfeioData,
          });
        }

        const invoice = nfeioData.serviceInvoice;

        // Save invoice record
        const { data: savedInvoice, error: saveError } = await db.from("nfse_invoices")
          .insert({
            tenant_id,
            nfeio_invoice_id: invoice.id,
            nfeio_status: invoice.status?.toLowerCase() || "pending",
            number: invoice.number,
            check_code: invoice.checkCode,
            rps_number: invoice.rpsNumber,
            rps_serial: invoice.rpsSerialNumber,
            borrower_name: client.name,
            borrower_document: client.cpf,
            borrower_email: client.email,
            service_code: service_code || tenant.nfeio_default_service_code || "4.03",
            description,
            services_amount: amount,
            iss_rate: invoice.issRate,
            iss_amount: invoice.issTaxAmount,
            total_amount: invoice.totalAmount || amount,
            payment_id: payment_id || null,
            client_id,
            issued_at: invoice.issuedOn,
          })
          .select()
          .single();

        if (saveError) {
          console.error("[emit-nfse] Save error:", saveError);
        }

        return res.status(200).json({
          success: true,
          invoice: {
            id: savedInvoice?.id || invoice.id,
            nfeio_id: invoice.id,
            status: invoice.status,
            number: invoice.number,
            check_code: invoice.checkCode,
          },
        });
  } catch (err: any) {
    console.error(`[emit-nfse] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
