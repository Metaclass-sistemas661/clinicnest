/**
 * ai-weekly-summary — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { completeText, chatCompletion } from '../shared/vertexAi';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
function paragraph(text: string): string {
  return '<p style="margin: 8px 0; color: #374151; font-size: 14px; line-height: 1.6;">' + text + '</p>';
}

export async function aiWeeklySummary(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
    /**
     * ─── ai-weekly-summary ────────────────────────────────────────────────────────
     * Gerador de resumo executivo semanal por IA.
     *
     * Triggered via cron (domingo 08h) ou chamada manual (admin).
     * Para cada tenant ativo, coleta métricas da semana e gera um resumo
     * via Vertex AI, enviando por email aos administradores.
     *
     * Auth: CRON_SECRET (header) ou JWT admin.
     * ─────────────────────────────────────────────────────────────────────────────
     */

    const log = createLogger("AI-WEEKLY-SUMMARY");

    /* ── helpers ───────────────────────────────────────────────────────────────── */

    function weekRange(): { start: string; end: string } {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    function fmtCurrency(v: number): string {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    }

    function fmtPct(n: number, d: number): string {
      if (d === 0) return "0%";
      return ((n / d) * 100).toFixed(1) + "%";
    }

    /* ── metrics collector ─────────────────────────────────────────────────────── */

    interface WeeklyMetrics {
      totalAppointments: number;
      completedAppointments: number;
      cancelledAppointments: number;
      noShowAppointments: number;
      newPatients: number;
      totalRevenue: number;
      totalProcedures: number;
      topProcedures: { name: string; count: number }[];
      topProfessionals: { name: string; count: number }[];
      occupancyRate: string;
      cancelRate: string;
      noShowRate: string;
    }

    async function collectMetrics(
      sb: any,
      tenantId: string,
      period: { start: string; end: string }): Promise<WeeklyMetrics> {
      // Appointments
      const { data: appointments } = await db.from("appointments")
        .select("id, status, procedure:procedures(name), professional:profiles!professional_id(full_name)")
        .eq("tenant_id", tenantId)
        .gte("scheduled_at", period.start)
        .lte("scheduled_at", period.end);

      const appts = appointments ?? [];
      const total = appts.length;
      const completed = appts.filter((a: any) => a.status === "completed").length;
      const cancelled = appts.filter((a: any) => a.status === "cancelled").length;
      const noShow = appts.filter((a: any) => a.status === "no_show").length;

      // Procedure ranking
      const procCount: Record<string, number> = {};
      for (const a of appts) {
        const name = (a as any).procedure?.name || "Outros";
        procCount[name] = (procCount[name] || 0) + 1;
      }
      const topProcedures = Object.entries(procCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Professional ranking
      const profCount: Record<string, number> = {};
      for (const a of appts) {
        const name = (a as any).professional?.full_name || "N/I";
        profCount[name] = (profCount[name] || 0) + 1;
      }
      const topProfessionals = Object.entries(profCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // New patients
      const { count: newPatients } = await db.from("patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .gte("created_at", period.start)
        .lte("created_at", period.end);

      // Revenue (invoices)
      const { data: invoices } = await db.from("invoices")
        .select("total")
        .eq("tenant_id", tenantId)
        .in("status", ["paid", "completed"])
        .gte("paid_at", period.start)
        .lte("paid_at", period.end);

      const totalRevenue = (invoices ?? []).reduce((sum: number, i: any) => sum + (i.total || 0), 0);

      return {
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        newPatients: newPatients ?? 0,
        totalRevenue,
        totalProcedures: topProcedures.reduce((s: number, p) => s + p.count, 0),
        topProcedures,
        topProfessionals,
        occupancyRate: fmtPct(completed, total),
        cancelRate: fmtPct(cancelled, total),
        noShowRate: fmtPct(noShow, total),
      };
    }

    /* ── AI summary generator ──────────────────────────────────────────────────── */

    async function generateSummary(
      clinicName: string,
      metrics: WeeklyMetrics): Promise<string> {
      const prompt = `Você é um consultor de gestão de clínicas médicas e odontológicas no Brasil.
    Gere um RESUMO EXECUTIVO SEMANAL em português brasileiro para a clínica "${clinicName}".

    DADOS DA SEMANA:
    - Agendamentos totais: ${metrics.totalAppointments}
    - Concluídos: ${metrics.completedAppointments}
    - Cancelados: ${metrics.cancelledAppointments} (${metrics.cancelRate})
    - Faltas (no-show): ${metrics.noShowAppointments} (${metrics.noShowRate})
    - Taxa de ocupação: ${metrics.occupancyRate}
    - Novos pacientes: ${metrics.newPatients}
    - Faturamento: ${fmtCurrency(metrics.totalRevenue)}
    - Top 5 procedimentos: ${metrics.topProcedures.map((p: any) => `${p.name} (${p.count})`).join(", ") || "N/A"}
    - Top 5 profissionais (por volume): ${metrics.topProfessionals.map((p: any) => `${p.name} (${p.count})`).join(", ") || "N/A"}

    FORMATO DO RESUMO (em HTML para email):
    1. **Destaques da Semana** — 3-5 bullet points com os principais indicadores.
    2. **Análise de Desempenho** — breve parágrafo (~3 frases) comparando métricas e identificando tendências.
    3. **Pontos de Atenção** — alertas sobre taxas de cancelamento/falta altas, faturamento abaixo do potencial, etc.
    4. **Recomendações** — 2-3 sugestões acionáveis para a próxima semana.

    Use tags HTML simples (<h3>, <ul>, <li>, <p>, <strong>). Seja objetivo e profissional.
    NÃO inclua saudação ou despedida — apenas o conteúdo do resumo.
    Se os dados forem zero, gere um resumo motivacional para início de operação.`;

      const result = await completeText(prompt, { maxTokens: 1500, temperature: 0.4 });
      return result.text;
    }

    /* ── email builder ─────────────────────────────────────────────────────────── */

    function buildEmailBody(clinicName: string, summaryHtml: string, metrics: WeeklyMetrics): string {
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 7);

      const startStr = periodStart.toLocaleDateString("pt-BR");
      const endStr = periodEnd.toLocaleDateString("pt-BR");

      return `
    ${paragraph(`Período: <strong>${startStr}</strong> a <strong>${endStr}</strong>`)}
    <div style="background:#f0fdfa;border-left:4px solid #0d9488;padding:16px;border-radius:8px;margin:16px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:4px 12px;"><strong>Agendamentos:</strong> ${metrics.totalAppointments}</td>
          <td style="padding:4px 12px;"><strong>Concluídos:</strong> ${metrics.completedAppointments}</td>
          <td style="padding:4px 12px;"><strong>Cancelados:</strong> ${metrics.cancelledAppointments}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;"><strong>Faltas:</strong> ${metrics.noShowAppointments}</td>
          <td style="padding:4px 12px;"><strong>Novos pacientes:</strong> ${metrics.newPatients}</td>
          <td style="padding:4px 12px;"><strong>Faturamento:</strong> ${fmtCurrency(metrics.totalRevenue)}</td>
        </tr>
      </table>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    ${summaryHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    ${paragraph('<em>Este resumo foi gerado automaticamente por IA. Os dados refletem o período informado e podem divergir de relatórios contábeis oficiais.</em>')}
      `.trim();
    }

    /* ── main handler ──────────────────────────────────────────────────────────── */
      // CORS handled by middleware

      try {
        // Auth: accept CRON_SECRET or admin JWT
        const authHeader = (req.headers['authorization'] as string) ?? "";
        const cronSecret = process.env.CRON_SECRET;
        let specificTenantId: string | null = null;

        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
          log("Authenticated via CRON_SECRET");
        } else {
          // JWT auth — only admin can trigger manually
          const token = authHeader.replace("Bearer ", "");
          const authResult = (await authAdmin.getUser(token) as any);
          if (authResult.error || !authResult.data) {
            return res.status(401).json({ error: "Unauthorized" });
          }
          const user = authResult.data.user;

          // Check admin role
          const { data: role } = await db.from("user_roles")
            .select("role, tenant_id")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!role) {
            return res.status(403).json({ error: "Admin only" });
          }

          specificTenantId = role.tenant_id;
          log(`Manual trigger by admin for tenant ${specificTenantId}`);
        }

        const period = weekRange();

        // Decide which tenants to process
        let tenants: { id: string; name: string; email: string | null }[];

        if (specificTenantId) {
          const { data } = await db.from("tenants")
            .select("id, name, email")
            .eq("id", specificTenantId)
            .single();
          tenants = data ? [data] : [];
        } else {
          // Cron mode: all active tenants (with subscription)
          const { data } = await db.from("tenants")
            .select("id, name, email")
            .eq("status", "active");
          tenants = data ?? [];
        }

        log(`Processing ${tenants.length} tenant(s)`);

        let sent = 0;
        let errors = 0;

        for (const tenant of tenants) {
          try {
            // Collect metrics
            const metrics = await collectMetrics(db, tenant.id, period);

            // Skip if no activity at all
            if (
              metrics.totalAppointments === 0 &&
              metrics.newPatients === 0 &&
              metrics.totalRevenue === 0
            ) {
              log(`Tenant ${tenant.id} (${tenant.name}): no activity, skipping`);
              continue;
            }

            // Generate AI summary
            const summaryHtml = await generateSummary(tenant.name ?? "Clínica", metrics);

            // Find admin users for this tenant
            const { data: adminRoles } = await db.from("user_roles")
              .select("user_id")
              .eq("tenant_id", tenant.id)
              .eq("role", "admin");

            if (!adminRoles || adminRoles.length === 0) {
              log(`Tenant ${tenant.id}: no admins found, skipping email`);
              continue;
            }

            const adminIds = adminRoles.map((r: any) => r.user_id);
            const { data: adminProfiles } = await db.from("profiles")
              .select("email, full_name")
              .in("user_id", adminIds)
              .not("email", "is", null);

            const recipients = (adminProfiles ?? []).filter((p: any) => p.email);

            if (recipients.length === 0) {
              log(`Tenant ${tenant.id}: no admin emails found, skipping`);
              continue;
            }

            // Build email
            const emailBody = buildEmailBody(tenant.name ?? "Clínica", summaryHtml, metrics);
            const plainText = `Resumo Semanal — ${tenant.name}\n\nAgendamentos: ${metrics.totalAppointments} | Concluídos: ${metrics.completedAppointments} | Cancelados: ${metrics.cancelledAppointments} | Faturamento: ${fmtCurrency(metrics.totalRevenue)}\n\nEste resumo foi gerado automaticamente por IA.`;

            const clinic = {
              name: tenant.name ?? "ClinicNest",
              email: tenant.email,
            };

            // Send to each admin
            for (const admin of recipients) {
              const subject = `📊 Resumo Semanal — ${tenant.name ?? "Sua Clínica"}`;
              const result = await sendEmail(
                admin.email,
                subject,
                emailBody,
                plainText);

              if (result.ok) {
                sent++;
                log(`Email sent to ${admin.email} (${admin.full_name}) for tenant ${tenant.name}`);
              } else {
                errors++;
                log(`Failed to send to ${admin.email}: ${result.error}`);
              }
            }
          } catch (err: any) {
            errors++;
            log(`Error processing tenant ${tenant.id}: ${err}`);
          }
        }

        return res.status(200).json({
            ok: true,
            tenants_processed: tenants.length,
            emails_sent: sent,
            errors,
          });
      } catch (err: any) {
        log(`Fatal error: ${err}`);
        return res.status(500).json({ error: "Internal server error" });
      }

  } catch (err: any) {
    console.error(`[ai-weekly-summary] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
