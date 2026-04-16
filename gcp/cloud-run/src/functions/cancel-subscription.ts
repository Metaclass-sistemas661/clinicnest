/**
 * cancel-subscription — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const logStep = createLogger("CANCEL-SUBSCRIPTION");

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      const user = (req as any).user;

      try {
        logStep("Function started");

        if (!user?.id || !user.email) {
          return res.status(403).json({ error: "Usuário não autenticado" });
        }

        const rl = await checkRateLimit(`cancel-sub:${user.id}`, 5, 60);
        if (!rl.allowed) {
          return res.status(429).json({ error: "Muitas requisições" });
        }

        // DB accessed via shared/db module
        const { data: profileData, error: profileError } = await db.from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          logStep("ERROR", { message: profileError.message });
          return res.status(500).json({ error: "Erro ao buscar tenant" });
        }

        const tenantId = profileData?.tenant_id;
        if (!tenantId) {
          return res.status(403).json({ error: "Tenant não encontrado" });
        }

        const { data: subscriptionData, error: subscriptionError } = await db.from("subscriptions")
          .select("id,status,asaas_subscription_id,billing_provider")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (subscriptionError) {
          logStep("ERROR", { message: subscriptionError.message });
          return res.status(500).json({ error: "Erro ao buscar assinatura" });
        }

        if (!subscriptionData?.id) {
          return res.status(404).json({ error: "Assinatura não encontrada" });
        }

        if (!subscriptionData.asaas_subscription_id) {
          return res.status(400).json({ error: "Assinatura Asaas não vinculada neste tenant" });
        }

        const asaasApiKey = process.env.ASAAS_API_KEY;
        if (!asaasApiKey) {
          return res.status(500).json({ error: "ASAAS_API_KEY não configurada" });
        }

        const apiBase = process.env.ASAAS_API_BASE_URL || "https://api.asaas.com";

        const asaasResp = await fetch(
          `${apiBase}/v3/subscriptions/${encodeURIComponent(subscriptionData.asaas_subscription_id)}`,
          {
            method: "PUT",
            body: JSON.stringify({ status: "INACTIVE" }),
          });

        const asaasText = await asaasResp.text();
        if (!asaasResp.ok) {
          logStep("ERROR: Asaas cancel failed", { status: asaasResp.status, body: asaasText.slice(0, 500) });
          return res.status(500).json({ error: `Erro ao cancelar no Asaas (${asaasResp.status})` });
        }

        await db.from("subscriptions")
          .update({
            status: "inactive",
            billing_provider: "asaas",
          })
          .eq("id", subscriptionData.id);

        logStep("Subscription inactivated", { tenantId, asaasSubscriptionId: subscriptionData.asaas_subscription_id });

        return res.json({ ok: true });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("ERROR", { message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }
  } catch (err: any) {
    console.error(`[cancel-subscription] Error:`, err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
