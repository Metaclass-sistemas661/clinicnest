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
          return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
            status: 403,
          });
        }

        const rl = await checkRateLimit(`cancel-sub:${user.id}`, 5, 60);
        if (!rl.allowed) {
          return new Response(JSON.stringify({ error: "Muitas requisições" }), {
            status: 429,
          });
        }

        // DB accessed via shared/db module
        const { data: profileData, error: profileError } = await db.from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          logStep("ERROR", { message: profileError.message });
          return new Response(JSON.stringify({ error: "Erro ao buscar tenant" }), {
            status: 500,
          });
        }

        const tenantId = profileData?.tenant_id;
        if (!tenantId) {
          return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
            status: 403,
          });
        }

        const { data: subscriptionData, error: subscriptionError } = await db.from("subscriptions")
          .select("id,status,asaas_subscription_id,billing_provider")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (subscriptionError) {
          logStep("ERROR", { message: subscriptionError.message });
          return new Response(JSON.stringify({ error: "Erro ao buscar assinatura" }), {
            status: 500,
          });
        }

        if (!subscriptionData?.id) {
          return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
            status: 404,
          });
        }

        if (!subscriptionData.asaas_subscription_id) {
          return new Response(
            JSON.stringify({ error: "Assinatura Asaas não vinculada neste tenant" }),
            { headers: { "Content-Type": "application/json" }, status: 400 });
        }

        const asaasApiKey = process.env.ASAAS_API_KEY;
        if (!asaasApiKey) {
          return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurada" }), {
            status: 500,
          });
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
          return new Response(
            JSON.stringify({ error: `Erro ao cancelar no Asaas (${asaasResp.status})` }),
            { headers: { "Content-Type": "application/json" }, status: 500 });
        }

        await db.from("subscriptions")
          .update({
            status: "inactive",
            billing_provider: "asaas",
          })
          .eq("id", subscriptionData.id);

        logStep("Subscription inactivated", { tenantId, asaasSubscriptionId: subscriptionData.asaas_subscription_id });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
        });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("ERROR", { message: errorMessage });
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
        });
      }
  } catch (err: any) {
    console.error(`[cancel-subscription] Error:`, err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
