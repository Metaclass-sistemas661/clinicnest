import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("NOTIFY-PATIENT-INVOICE-DUE");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface InvoiceWithPatient {
  id: string;
  amount: number;
  description: string;
  due_date: string;
  status: string;
  payment_url?: string;
  patient_id: string;
  tenant_id: string;
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  tenant: {
    id: string;
    name: string;
    phone?: string;
  };
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada");
    return false;
  }

  try {
    const emailFrom = Deno.env.get("EMAIL_FROM") || "ClinicNest <no-reply@metaclass.com.br>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar", { status: response.status, error: errorText });
      return false;
    }

    log("EMAIL: Enviado com sucesso", { to });
    return true;
  } catch (error) {
    log("EMAIL: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function sendPushNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  patientId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const { data: clientUser } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("id", patientId)
      .single();

    if (!clientUser?.user_id) {
      return false;
    }

    const { data: tokens, error } = await supabaseAdmin
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", clientUser.user_id);

    if (error || !tokens?.length) {
      return false;
    }

    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmServerKey) {
      return false;
    }

    for (const { token } of tokens) {
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Authorization": `key=${fcmServerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data: data ?? {},
        }),
      });
    }

    return true;
  } catch {
    return false;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEmailTemplate(invoice: InvoiceWithPatient, daysUntilDue: number): { subject: string; html: string; text: string } {
  const patientName = invoice.patient.name.split(" ")[0];
  const clinicName = invoice.tenant.name;
  const amount = formatCurrency(invoice.amount);
  const dueDate = formatDate(invoice.due_date);
  const siteUrl = Deno.env.get("SITE_URL") || "https://clinicnest.metaclass.com.br";
  const paymentUrl = invoice.payment_url || `${siteUrl}/paciente/financeiro`;

  const urgencyColor = daysUntilDue <= 1 ? "#ef4444" : daysUntilDue <= 3 ? "#f59e0b" : "#3b82f6";
  const urgencyText = daysUntilDue === 0 
    ? "vence hoje" 
    : daysUntilDue === 1 
      ? "vence amanhã" 
      : `vence em ${daysUntilDue} dias`;

  const subject = daysUntilDue <= 1 
    ? `⚠️ Fatura ${urgencyText} - ${clinicName}`
    : `📋 Lembrete: Fatura ${urgencyText} - ${clinicName}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: ${urgencyColor}; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Lembrete de Pagamento</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">Olá, <strong>${patientName}</strong>!</p>
              
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Este é um lembrete de que você possui uma fatura que <strong style="color: ${urgencyColor};">${urgencyText}</strong>.
              </p>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid ${urgencyColor};">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Descrição:</span>
                      <span style="color: #1f2937; font-size: 14px; font-weight: 600; float: right;">${invoice.description || "Serviços médicos"}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Valor:</span>
                      <span style="color: #1f2937; font-size: 18px; font-weight: 700; float: right;">${amount}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 14px;">Vencimento:</span>
                      <span style="color: ${urgencyColor}; font-size: 14px; font-weight: 600; float: right;">${dueDate}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${paymentUrl}" style="display: inline-block; background: ${urgencyColor}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                      Pagar Agora
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                Se você já realizou o pagamento, por favor desconsidere este email.
              </p>

              ${invoice.tenant.phone ? `
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                Dúvidas? Entre em contato: <strong>${invoice.tenant.phone}</strong>
              </p>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${clinicName}. Enviado via ClinicNest.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Lembrete de Pagamento

Olá, ${patientName}!

Este é um lembrete de que você possui uma fatura que ${urgencyText}.

Detalhes:
- Descrição: ${invoice.description || "Serviços médicos"}
- Valor: ${amount}
- Vencimento: ${dueDate}

Acesse para pagar: ${paymentUrl}

Se você já realizou o pagamento, por favor desconsidere este email.

${invoice.tenant.phone ? `Dúvidas? Entre em contato: ${invoice.tenant.phone}` : ""}

© ${new Date().getFullYear()} ${clinicName}
`.trim();

  return { subject, html, text };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    log("Iniciando verificação de faturas próximas do vencimento");

    const { data: tenantsWithSettings } = await supabaseAdmin
      .from("tenant_settings")
      .select("tenant_id, invoice_reminder_days")
      .not("invoice_reminder_days", "is", null);

    const tenantReminderDays = new Map<string, number>();
    for (const ts of tenantsWithSettings ?? []) {
      tenantReminderDays.set(ts.tenant_id, ts.invoice_reminder_days ?? 3);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDaysAhead = 7;
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + maxDaysAhead);

    const { data: pendingInvoices, error: invoicesError } = await supabaseAdmin
      .from("patient_invoices")
      .select(`
        id,
        amount,
        description,
        due_date,
        status,
        payment_url,
        patient_id,
        tenant_id,
        last_reminder_sent_at
      `)
      .eq("status", "pending")
      .gte("due_date", today.toISOString().split("T")[0])
      .lte("due_date", futureDate.toISOString().split("T")[0]);

    if (invoicesError) {
      log("Erro ao buscar faturas", { error: invoicesError.message });
      return new Response(
        JSON.stringify({ error: "Erro ao buscar faturas" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!pendingInvoices?.length) {
      log("Nenhuma fatura pendente encontrada");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "Nenhuma fatura para notificar" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Faturas encontradas", { count: pendingInvoices.length });

    const results = {
      processed: 0,
      emailsSent: 0,
      pushSent: 0,
      skipped: 0,
    };

    for (const invoice of pendingInvoices) {
      const reminderDays = tenantReminderDays.get(invoice.tenant_id) ?? 3;
      const daysUntilDue = getDaysUntilDue(invoice.due_date);

      if (daysUntilDue > reminderDays) {
        results.skipped++;
        continue;
      }

      if (invoice.last_reminder_sent_at) {
        const lastSent = new Date(invoice.last_reminder_sent_at);
        const hoursSinceLastReminder = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
        
        if (daysUntilDue > 1 && hoursSinceLastReminder < 24) {
          results.skipped++;
          continue;
        }
        if (daysUntilDue <= 1 && hoursSinceLastReminder < 12) {
          results.skipped++;
          continue;
        }
      }

      const [patientResult, tenantResult] = await Promise.all([
        supabaseAdmin.from("clients").select("id, name, email, phone").eq("id", invoice.patient_id).single(),
        supabaseAdmin.from("tenants").select("id, name, phone").eq("id", invoice.tenant_id).single(),
      ]);

      if (!patientResult.data?.email) {
        results.skipped++;
        continue;
      }

      const invoiceWithDetails: InvoiceWithPatient = {
        ...invoice,
        patient: patientResult.data,
        tenant: tenantResult.data ?? { id: invoice.tenant_id, name: "Clínica" },
      };

      const emailTemplate = getEmailTemplate(invoiceWithDetails, daysUntilDue);

      const emailSent = await sendEmailViaResend(
        invoiceWithDetails.patient.email,
        emailTemplate.subject,
        emailTemplate.html,
        emailTemplate.text
      );

      if (emailSent) {
        results.emailsSent++;
      }

      const pushSent = await sendPushNotification(
        supabaseAdmin,
        invoice.patient_id,
        daysUntilDue <= 1 ? "⚠️ Fatura vence em breve!" : "📋 Lembrete de pagamento",
        `Você tem uma fatura de ${formatCurrency(invoice.amount)} que vence ${daysUntilDue === 0 ? "hoje" : daysUntilDue === 1 ? "amanhã" : `em ${daysUntilDue} dias`}`,
        { type: "invoice_reminder", invoice_id: invoice.id }
      );

      if (pushSent) {
        results.pushSent++;
      }

      await supabaseAdmin
        .from("patient_invoices")
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq("id", invoice.id);

      await supabaseAdmin.from("notification_logs").insert({
        tenant_id: invoice.tenant_id,
        recipient_type: "patient",
        recipient_id: invoice.patient_id,
        channel: "email",
        template_type: "invoice_reminder",
        status: emailSent ? "sent" : "failed",
        metadata: { invoice_id: invoice.id, days_until_due: daysUntilDue },
      });

      results.processed++;
    }

    log("Processamento concluído", results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
