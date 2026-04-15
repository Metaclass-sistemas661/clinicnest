/**
 * nfse-webhook-handler — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createDbClient } from '../shared/db-builder';

interface NFEioWebhookPayload {
  event: string;
  data: {
    id: string;
    companyId: string;
    flowStatus: string;
    status: string;
    number?: string;
    checkCode?: string;
    rpsNumber?: number;
    rpsSerialNumber?: string;
    issuedOn?: string;
    cancelledOn?: string;
    flowMessage?: string;
  };
}

export async function nfseWebhookHandler(req: Request, res: Response) {
  try {
    const db = createDbClient();
      try {
        const payload: NFEioWebhookPayload = req.body;

        const { event, data } = payload;

        if (!data?.id) {
          return res.status(400).json({ error: "Missing invoice ID" });
        }

        // Map NFE.io status to our status
        let nfeioStatus = "pending";
        if (event === "ServiceInvoiceIssued" || data.status === "Issued") {
          nfeioStatus = "issued";
        } else if (event === "ServiceInvoiceCancelled" || data.status === "Cancelled") {
          nfeioStatus = "cancelled";
        } else if (event === "ServiceInvoiceIssueFailed" || data.status === "Error") {
          nfeioStatus = "error";
        }

        // Update the invoice record
        const updateData: Record<string, unknown> = {
          nfeio_status: nfeioStatus,
          updated_at: new Date().toISOString(),
        };

        if (data.number) updateData.number = data.number;
        if (data.checkCode) updateData.check_code = data.checkCode;
        if (data.rpsNumber) updateData.rps_number = data.rpsNumber;
        if (data.rpsSerialNumber) updateData.rps_serial = data.rpsSerialNumber;
        if (data.issuedOn) updateData.issued_at = data.issuedOn;
        if (data.cancelledOn) updateData.cancelled_at = data.cancelledOn;
        if (data.flowMessage && nfeioStatus === "error") {
          updateData.error_message = data.flowMessage;
        }

        const { error: updateError } = await db.from("nfse_invoices")
          .update(updateData)
          .eq("nfeio_invoice_id", data.id);

        if (updateError) {
          console.error("[nfse-webhook] Update error:", updateError);
          return res.status(500).json({ error: "Failed to update invoice", details: updateError });
        }

        return res.status(200).json({ success: true, status: nfeioStatus });
      } catch (error: any) {
        console.error("[nfse-webhook] Error:", error);
        return res.status(500).json({ error: error.message });
      }
  } catch (err: any) {
    console.error(`[nfse-webhook-handler] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

