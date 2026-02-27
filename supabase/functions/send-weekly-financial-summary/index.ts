import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklySummary {
  professional_id: string;
  professional_name: string;
  email: string;
  tenant_name: string;
  commissions_generated: number;
  commissions_paid: number;
  salaries_paid: number;
  pending_total: number;
  appointments_completed: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    // Buscar profissionais que optaram por receber resumo semanal
    const { data: preferences, error: prefError } = await supabase
      .from("user_notification_preferences")
      .select("user_id")
      .eq("weekly_financial_summary", true);

    if (prefError) throw prefError;

    if (!preferences || preferences.length === 0) {
      return new Response(
        JSON.stringify({ message: "No professionals opted in for weekly summary" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map((p) => p.user_id);

    // Buscar dados dos profissionais
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, tenant_id, tenants(name)")
      .in("user_id", userIds);

    if (profileError) throw profileError;

    const summaries: WeeklySummary[] = [];

    for (const profile of profiles || []) {
      if (!profile.email || !profile.tenant_id) continue;

      // Comissões geradas na semana
      const { data: commissionsGenerated } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      const totalGenerated = (commissionsGenerated || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );

      // Comissões pagas na semana
      const { data: commissionsPaid } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", weekStart.toISOString())
        .lte("payment_date", weekEnd.toISOString());

      const totalCommPaid = (commissionsPaid || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );

      // Salários pagos na semana
      const { data: salariesPaid } = await supabase
        .from("salary_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", weekStart.toISOString())
        .lte("payment_date", weekEnd.toISOString());

      const totalSalPaid = (salariesPaid || []).reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
      );

      // Total pendente
      const { data: pendingCommissions } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "pending");

      const totalPending = (pendingCommissions || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );

      // Consultas completadas na semana
      const { count: appointmentsCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "completed")
        .gte("scheduled_at", weekStart.toISOString())
        .lte("scheduled_at", weekEnd.toISOString());

      summaries.push({
        professional_id: profile.user_id,
        professional_name: profile.full_name || "Profissional",
        email: profile.email,
        tenant_name: (profile.tenants as any)?.name || "Clínica",
        commissions_generated: totalGenerated,
        commissions_paid: totalCommPaid,
        salaries_paid: totalSalPaid,
        pending_total: totalPending,
        appointments_completed: appointmentsCount || 0,
      });
    }

    // Enviar emails
    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    for (const summary of summaries) {
      const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
            .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
            .highlight { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .pending { color: #f59e0b; }
            .paid { color: #10b981; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Resumo Financeiro Semanal</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${summary.tenant_name}</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${summary.professional_name}</strong>!</p>
            <p>Aqui está o resumo da sua semana:</p>
            
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-value">${summary.appointments_completed}</div>
                <div class="stat-label">Consultas Realizadas</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${formatCurrency(summary.commissions_generated)}</div>
                <div class="stat-label">Comissões Geradas</div>
              </div>
              <div class="stat-card">
                <div class="stat-value paid">${formatCurrency(summary.commissions_paid + summary.salaries_paid)}</div>
                <div class="stat-label">Recebido na Semana</div>
              </div>
              <div class="stat-card">
                <div class="stat-value pending">${formatCurrency(summary.pending_total)}</div>
                <div class="stat-label">Pendente Total</div>
              </div>
            </div>

            ${summary.pending_total > 0 ? `
              <div class="highlight">
                <strong>Você tem ${formatCurrency(summary.pending_total)} em comissões pendentes.</strong>
                <p style="margin: 10px 0 0 0; font-size: 14px;">Acesse o portal para ver detalhes.</p>
              </div>
            ` : ""}

            <p style="margin-top: 30px;">Continue assim! Bom trabalho.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Para desativar, acesse suas preferências de notificação.</p>
            <p>${summary.tenant_name} - Powered by ClinicNest</p>
          </div>
        </body>
        </html>
      `;

      if (resendApiKey) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "ClinicNest <noreply@ClinicNest.com.br>",
              to: summary.email,
              subject: `Resumo Financeiro Semanal - ${summary.tenant_name}`,
              html: emailHtml,
            }),
          });

          if (response.ok) {
            emailsSent.push(summary.email);
          } else {
            emailsFailed.push(summary.email);
          }
        } catch (e) {
          emailsFailed.push(summary.email);
        }
      } else {
        console.log(`[DEV] Would send email to ${summary.email}`);
        emailsSent.push(summary.email);
      }

      // Log notification
      await supabase.from("notification_logs").insert({
        tenant_id: profiles?.find((p) => p.user_id === summary.professional_id)?.tenant_id,
        type: "weekly_financial_summary",
        recipient: summary.email,
        channel: "email",
        status: emailsFailed.includes(summary.email) ? "failed" : "sent",
        metadata: {
          professional_id: summary.professional_id,
          summary: {
            commissions_generated: summary.commissions_generated,
            commissions_paid: summary.commissions_paid,
            salaries_paid: summary.salaries_paid,
            pending_total: summary.pending_total,
            appointments_completed: summary.appointments_completed,
          },
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: emailsSent.length,
        emails_failed: emailsFailed.length,
        details: { sent: emailsSent, failed: emailsFailed },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending weekly summaries:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
