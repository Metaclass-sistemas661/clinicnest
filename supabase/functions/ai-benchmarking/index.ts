/**
 * AI Benchmarking — Comparação anônima de métricas entre clínicas.
 *
 * Agrega dados anônimos de todas as clínicas no sistema e compara com a
 * clínica atual. Todas as métricas são agregadas anonimamente — nenhuma
 * clínica é identificável.
 *
 * Métricas comparadas:
 * - Taxa de ocupação de agenda
 * - Taxa de no-show
 * - Ticket médio
 * - Tempo médio de atendimento
 * - Retenção de pacientes
 *
 * Tier: Premium only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAiAccess } from "../_shared/planGating.ts";

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    // Check premium access
    const accessCheck = await checkAiAccess(supabaseUser, tenantId, "weekly_summary");
    if (!accessCheck.allowed) {
      return new Response(JSON.stringify({ error: accessCheck.reason }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Use service role for cross-tenant aggregation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const since = threeMonthsAgo.toISOString();

    // Get own clinic metrics
    const [ownAppts, ownPayments, ownPatients] = await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select("id, status, scheduled_at")
        .eq("tenant_id", tenantId)
        .gte("scheduled_at", since),
      supabaseAdmin
        .from("payments")
        .select("id, amount, status")
        .eq("tenant_id", tenantId)
        .gte("payment_date", since.split("T")[0]),
      supabaseAdmin
        .from("patients")
        .select("id")
        .eq("tenant_id", tenantId),
    ]);

    const ownApptsData = ownAppts.data ?? [];
    const ownCompleted = ownApptsData.filter(
      (a: { status: string }) => a.status === "completed"
    ).length;
    const ownNoShow = ownApptsData.filter(
      (a: { status: string }) => a.status === "no_show"
    ).length;
    const ownTotal = ownApptsData.length;
    const ownPaid = (ownPayments.data ?? [])
      .filter((p: { status: string }) => p.status === "paid" || p.status === "confirmed");
    const ownRevenue = ownPaid.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0);
    const ownAvgTicket = ownPaid.length > 0 ? ownRevenue / ownPaid.length : 0;
    const ownNoShowRate = ownTotal > 0 ? ownNoShow / ownTotal : 0;
    const ownOccupancy = ownTotal > 0 ? ownCompleted / ownTotal : 0;

    // Get aggregate (global) metrics — counts only, no identifying data
    const [globalAppts, globalPayments, globalTenants] = await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select("id, status, tenant_id")
        .gte("scheduled_at", since),
      supabaseAdmin
        .from("payments")
        .select("id, amount, status, tenant_id")
        .gte("payment_date", since.split("T")[0]),
      supabaseAdmin
        .from("tenants")
        .select("id"),
    ]);

    const allAppts = globalAppts.data ?? [];
    const allPayments = globalPayments.data ?? [];
    const totalTenants = (globalTenants.data ?? []).length;

    // Per-tenant aggregation (anonymized)
    const tenantMetrics = new Map<
      string,
      { total: number; completed: number; noShow: number; revenue: number; payments: number }
    >();

    for (const a of allAppts) {
      const t = (a as { tenant_id: string }).tenant_id;
      if (!tenantMetrics.has(t)) {
        tenantMetrics.set(t, { total: 0, completed: 0, noShow: 0, revenue: 0, payments: 0 });
      }
      const m = tenantMetrics.get(t)!;
      m.total++;
      if ((a as { status: string }).status === "completed") m.completed++;
      if ((a as { status: string }).status === "no_show") m.noShow++;
    }

    for (const p of allPayments) {
      const t = (p as { tenant_id: string }).tenant_id;
      if (!tenantMetrics.has(t)) {
        tenantMetrics.set(t, { total: 0, completed: 0, noShow: 0, revenue: 0, payments: 0 });
      }
      const m = tenantMetrics.get(t)!;
      if ((p as { status: string }).status === "paid" || (p as { status: string }).status === "confirmed") {
        m.revenue += (p as { amount: number }).amount || 0;
        m.payments++;
      }
    }

    // Compute aggregated averages
    const clinicCount = tenantMetrics.size || 1;
    const metrics = Array.from(tenantMetrics.values());

    const avgNoShowRate =
      metrics.reduce((s, m) => s + (m.total > 0 ? m.noShow / m.total : 0), 0) / clinicCount;
    const avgOccupancy =
      metrics.reduce((s, m) => s + (m.total > 0 ? m.completed / m.total : 0), 0) / clinicCount;
    const avgTickets = metrics
      .filter((m) => m.payments > 0)
      .map((m) => m.revenue / m.payments);
    const avgTicket =
      avgTickets.length > 0
        ? avgTickets.reduce((s, v) => s + v, 0) / avgTickets.length
        : 0;

    // Compute percentile rank for own clinic
    const computePercentile = (ownValue: number, allValues: number[], higherIsBetter: boolean) => {
      if (allValues.length === 0) return 50;
      const sorted = [...allValues].sort((a, b) => a - b);
      const idx = sorted.filter((v) => (higherIsBetter ? v < ownValue : v > ownValue)).length;
      return Math.round((idx / sorted.length) * 100);
    };

    const noShowRates = metrics.map((m) => (m.total > 0 ? m.noShow / m.total : 0));
    const occupancyRates = metrics.map((m) => (m.total > 0 ? m.completed / m.total : 0));
    const ticketValues = metrics.filter((m) => m.payments > 0).map((m) => m.revenue / m.payments);

    const result = {
      clinic_count: clinicCount,
      period: "últimos 3 meses",
      metrics: {
        occupancy: {
          own: Math.round(ownOccupancy * 100),
          average: Math.round(avgOccupancy * 100),
          percentile: computePercentile(ownOccupancy, occupancyRates, true),
          unit: "%",
        },
        no_show_rate: {
          own: Math.round(ownNoShowRate * 100),
          average: Math.round(avgNoShowRate * 100),
          percentile: computePercentile(ownNoShowRate, noShowRates, false),
          unit: "%",
        },
        avg_ticket: {
          own: Math.round(ownAvgTicket * 100) / 100,
          average: Math.round(avgTicket * 100) / 100,
          percentile: computePercentile(ownAvgTicket, ticketValues, true),
          unit: "BRL",
        },
        total_patients: {
          own: (ownPatients.data ?? []).length,
        },
        total_appointments: {
          own: ownTotal,
        },
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
