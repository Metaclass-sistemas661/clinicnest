/**
 * notify-patient-invoice-due — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
function paragraph(text: string): string {
  return '<p style="margin: 8px 0; color: #374151; font-size: 14px; line-height: 1.6;">' + text + '</p>';
}

const COLORS = {
  TEAL_PRIMARY: '#0D9488',
  TEAL_DARK: '#0F766E',
  DANGER: '#DC2626',
  WARNING: '#F59E0B',
  SUCCESS: '#10B981',
  INFO: '#3B82F6',
  LIGHT_BG: '#F0FDFA',
  GRAY: '#6B7280',
  WHITE: '#FFFFFF',
};

const log = createLogger("NOTIFY-PATIENT-INVOICE-DUE");
// ─── Push Notification ─────────────────────────────────────────────────────────

async function sendPushNotification(patientId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const { data: clientUser } = await db.from("clients")
      .select("user_id")
      .eq("id", patientId)
      .single();

    if (!clientUser?.user_id) return false;

    const { data: tokens, error } = await db.from("push_tokens")
      .select("token, platform")
      .eq("user_id", clientUser.user_id);

    if (error || !tokens?.length) return false;

    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (!fcmServerKey) return false;

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

function getUrgencyAccent(daysUntilDue: number): string {
  if (daysUntilDue <= 1) return COLORS.DANGER;
  if (daysUntilDue <= 3) return COLORS.WARNING;
  return COLORS.TEAL_PRIMARY;
}

// ─── Edge Function ──────────────────────────────────────────────────────────────

export async function notifyPatientInvoiceDue(req: Request, res: Response) {
  try {
    log("Iniciando verificação de faturas próximas do vencimento");

        const { data: tenantsWithSettings } = await db.from("tenant_settings")
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

        const { data: pendingInvoices, error: invoicesError } = await db.from("patient_invoices")
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
          return res.status(500).json({ error: "Erro ao buscar faturas" });
        }

        if (!pendingInvoices?.length) {
          log("Nenhuma fatura pendente encontrada");
          return res.status(200).json({ success: true, processed: 0, message: "Nenhuma fatura para notificar" });
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

          // Fetch patient + tenant (with email for Reply-To)
          const [patientResult, tenantResult] = await Promise.all([
            db.from("clients").select("id, name, email, phone").eq("id", invoice.patient_id).single(),
            db.from("tenants").select("id, name, email, phone").eq("id", invoice.tenant_id).single(),
          ]);

          if (!patientResult.data?.email) {
            results.skipped++;
            continue;
          }

          const patient = patientResult.data;
          const tenant = tenantResult.data ?? { id: invoice.tenant_id, name: "Clínica", email: null, phone: null };
          const patientName = (patient.name ?? "").split(" ")[0] || "Paciente";
          const clinicName = tenant.name ?? "Sua Clínica";
          const clinic: any = { name: clinicName, email: tenant.email, phone: tenant.phone };

          const amount = formatCurrency(invoice.amount);
          const dueDate = formatDate(invoice.due_date);
          const siteUrl = process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
          const paymentUrl = invoice.payment_url || `${siteUrl}/paciente/financeiro`;
          const urgencyAccent = getUrgencyAccent(daysUntilDue);

          const urgencyText = daysUntilDue === 0
            ? "vence hoje"
            : daysUntilDue === 1
              ? "vence amanhã"
              : `vence em ${daysUntilDue} dias`;

          const subject = daysUntilDue <= 1
            ? `⚠️ Fatura ${urgencyText} - ${clinicName}`
            : `📋 Lembrete: Fatura ${urgencyText} - ${clinicName}`;

          const bodyHtml =
            paragraph(`Olá, ${patientName}!`) +
            paragraph(`Este é um lembrete de que você possui uma fatura que <strong style="color:${urgencyAccent};">${urgencyText}</strong>.`) +
            `<div style="padding:10px;border:1px solid #ddd;border-radius:8px"><p><strong>Descrição:</strong> ${invoice.description || "Procedimentos médicos"}</p><p><strong>Valor:</strong> <span style="font-size:17px;font-weight:700;">${amount}</span></p><p><strong>Vencimento:</strong> <span style="color:${urgencyAccent};font-weight:600;">${dueDate}</span></p></div>` +
            paragraph(`<span style="color:#64748b;font-size:13px;">Se você já realizou o pagamento, por favor desconsidere este email.</span>`);

          const bodyText = `Olá, ${patientName}! Fatura de ${amount} ${urgencyText}. ${invoice.description || "Procedimentos médicos"} - Vencimento: ${dueDate}. Pague em: ${paymentUrl}`;

          const emailResult = await sendEmail(
            patient.email,
            subject,
            bodyHtml,
            bodyText
          );

          if (emailResult.ok) {
            results.emailsSent++;
          }

          const pushSent = await sendPushNotification(invoice.patient_id,
            daysUntilDue <= 1 ? "⚠️ Fatura vence em breve!" : "📋 Lembrete de pagamento",
            `Você tem uma fatura de ${amount} que vence ${daysUntilDue === 0 ? "hoje" : daysUntilDue === 1 ? "amanhã" : `em ${daysUntilDue} dias`}`,
            { type: "invoice_reminder", invoice_id: invoice.id }
          );

          if (pushSent) {
            results.pushSent++;
          }

          await db.from("patient_invoices")
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq("id", invoice.id);

          await db.from("notification_logs").insert({
            tenant_id: invoice.tenant_id,
            recipient_type: "patient",
            recipient_id: invoice.patient_id,
            channel: "email",
            template_type: "invoice_reminder",
            status: emailResult.ok ? "sent" : "failed",
            metadata: { invoice_id: invoice.id, days_until_due: daysUntilDue },
          });

          results.processed++;
        }

        log("Processamento concluído", results);

        return res.status(200).json({
            success: true,
            ...results,
          });
  } catch (error: any) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    console.error(`[notify-patient-invoice-due] Error:`, error.message || error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Erro interno" });
  }
}
