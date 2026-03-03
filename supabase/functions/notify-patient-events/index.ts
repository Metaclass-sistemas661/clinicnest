import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import {
  sendClinicEmail,
  greeting,
  paragraph,
  infoBox,
  type ClinicInfo,
  COLORS,
} from "../_shared/clinicEmail.ts";

const log = createLogger("NOTIFY-PATIENT-EVENTS");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EventType =
  | "consent_signed"
  | "return_scheduled"
  | "return_reminder"
  | "exam_ready"
  | "appointment_cancelled";

interface EventPayload {
  event_type: EventType;
  tenant_id: string;
  client_id: string;
  metadata?: Record<string, unknown>;
}

// ─── Push Notification ─────────────────────────────────────────────────────────

async function sendPushNotification(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  title: string,
  body: string,
): Promise<boolean> {
  try {
    const { data: clientUser } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .eq("id", clientId)
      .single();

    if (!clientUser?.user_id) return false;

    const { data: tokens } = await supabaseAdmin
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", clientUser.user_id);

    if (!tokens?.length) return false;

    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmServerKey) return false;

    for (const { token } of tokens) {
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: { Authorization: `key=${fcmServerKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: token, notification: { title, body } }),
      });
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Email Content Builders ────────────────────────────────────────────────────

function consentSignedContent(clientName: string, templateTitle: string): { headline: string; icon: string; bodyHtml: string; bodyText: string } {
  const now = new Date();
  return {
    headline: "Termo Assinado",
    icon: "✅",
    bodyHtml:
      greeting(clientName) +
      paragraph(`Confirmamos que o termo <strong>"${templateTitle}"</strong> foi assinado com sucesso em nosso sistema.`) +
      infoBox([
        { label: "📋 Documento", value: templateTitle },
        { label: "📅 Data", value: now.toLocaleDateString("pt-BR") },
        { label: "🕐 Hora", value: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
      ], COLORS.SUCCESS) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Uma cópia deste documento pode ser acessada no seu portal do paciente.</span>`),
    bodyText: `Olá, ${clientName}! O termo "${templateTitle}" foi assinado com sucesso em ${now.toLocaleDateString("pt-BR")}.`,
  };
}

function returnScheduledContent(clientName: string, returnDate: string, reason: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const dateParts = returnDate.split("-");
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : returnDate;

  const items: Array<{ label: string; value: string }> = [
    { label: "📅 Data prevista", value: formattedDate },
  ];
  if (reason) items.push({ label: "📋 Motivo", value: reason });

  return {
    headline: "Retorno Agendado",
    icon: "📅",
    bodyHtml:
      greeting(clientName) +
      paragraph("Um retorno foi agendado para você:") +
      infoBox(items) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Entre em contato conosco caso precise reagendar.</span>`),
    bodyText: `Olá, ${clientName}! Seu retorno está agendado para ${formattedDate}${reason ? ` (${reason})` : ""}.`,
  };
}

function examReadyContent(clientName: string, examName: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; ctaLabel?: string; ctaUrl?: string } {
  const siteUrl = Deno.env.get("SITE_URL") || "https://clinicnest.metaclass.com.br";
  return {
    headline: "Exame Disponível",
    icon: "🔬",
    bodyHtml:
      greeting(clientName) +
      paragraph(`O resultado do seu exame <strong>"${examName}"</strong> está disponível.`) +
      infoBox([{ label: "🔬 Exame", value: examName }], COLORS.INFO) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Acesse seu portal do paciente para visualizar o resultado completo.</span>`),
    bodyText: `Olá, ${clientName}! O resultado do exame "${examName}" está disponível. Acesse seu portal para visualizar.`,
    ctaLabel: "Ver Resultado",
    ctaUrl: `${siteUrl}/paciente/exames`,
  };
}

function appointmentCancelledContent(clientName: string, date: string, time: string, serviceName: string): { headline: string; icon: string; bodyHtml: string; bodyText: string; headerColor: string } {
  return {
    headline: "Consulta Cancelada",
    icon: "❌",
    headerColor: COLORS.DANGER,
    bodyHtml:
      greeting(clientName) +
      paragraph("Informamos que sua consulta foi cancelada.") +
      infoBox([
        { label: "📌 Serviço", value: serviceName },
        { label: "📅 Data", value: date },
        { label: "🕐 Horário", value: time },
      ], COLORS.DANGER) +
      paragraph(`<span style="color:#64748b;font-size:13px;">Se deseja reagendar, entre em contato conosco ou acesse o portal do paciente.</span>`),
    bodyText: `Olá, ${clientName}! Sua consulta de ${serviceName} em ${date} às ${time} foi cancelada. Entre em contato para reagendar.`,
  };
}

// ─── Edge Function ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const payload: EventPayload = await req.json();
    const { event_type, tenant_id, client_id, metadata } = payload;

    if (!event_type || !tenant_id || !client_id) {
      return new Response(
        JSON.stringify({ error: "event_type, tenant_id e client_id são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    log("Processando evento", { event_type, tenant_id });

    // Fetch client and tenant data (include tenant email for Reply-To)
    const [clientResult, tenantResult] = await Promise.all([
      supabaseAdmin.from("clients").select("id, name, email, phone, user_id").eq("id", client_id).single(),
      supabaseAdmin.from("tenants").select("id, name, email, phone, address").eq("id", tenant_id).single(),
    ]);

    if (!clientResult.data) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const client = clientResult.data;
    const tenant = tenantResult.data ?? { id: tenant_id, name: "Clínica", email: null, phone: null, address: null };
    const clientName = (client.name ?? "").split(" ")[0] || "Paciente";
    const clinicName = tenant.name ?? "Sua Clínica";
    const clinic: ClinicInfo = { name: clinicName, email: tenant.email, phone: tenant.phone };

    let emailContent: {
      headline: string;
      icon: string;
      bodyHtml: string;
      bodyText: string;
      headerColor?: string;
      ctaLabel?: string;
      ctaUrl?: string;
    } | null = null;
    let subject = "";
    let pushTitle = "";
    let pushBody = "";

    switch (event_type) {
      case "consent_signed": {
        const templateTitle = String(metadata?.template_title ?? "Termo de Consentimento");
        emailContent = consentSignedContent(clientName, templateTitle);
        subject = `✅ Termo assinado com sucesso - ${clinicName}`;
        pushTitle = "Termo Assinado ✅";
        pushBody = `O termo "${templateTitle}" foi assinado com sucesso.`;
        break;
      }

      case "return_scheduled": {
        const returnDate = String(metadata?.return_date ?? "");
        const reason = String(metadata?.reason ?? "");
        emailContent = returnScheduledContent(clientName, returnDate, reason);
        subject = `📅 Retorno agendado - ${clinicName}`;
        pushTitle = "Retorno Agendado 📅";
        pushBody = `Seu retorno está previsto para ${returnDate}${reason ? ` (${reason})` : ""}`;
        break;
      }

      case "return_reminder": {
        const returnDate = String(metadata?.return_date ?? "");
        const reason = String(metadata?.reason ?? "");
        emailContent = returnScheduledContent(clientName, returnDate, reason);
        subject = `⏰ Lembrete de retorno - ${clinicName}`;
        pushTitle = "Lembrete de Retorno ⏰";
        pushBody = `Não esqueça! Seu retorno está marcado para ${returnDate}`;
        break;
      }

      case "exam_ready": {
        const examName = String(metadata?.exam_name ?? "Exame");
        emailContent = examReadyContent(clientName, examName);
        subject = `🔬 Resultado de exame disponível - ${clinicName}`;
        pushTitle = "Exame Disponível 🔬";
        pushBody = `O resultado do exame "${examName}" está disponível.`;
        break;
      }

      case "appointment_cancelled": {
        const date = String(metadata?.date ?? "");
        const time = String(metadata?.time ?? "");
        const serviceName = String(metadata?.service_name ?? "Consulta");
        emailContent = appointmentCancelledContent(clientName, date, time, serviceName);
        subject = `❌ Consulta cancelada - ${clinicName}`;
        pushTitle = "Consulta Cancelada ❌";
        pushBody = `Sua consulta de ${serviceName} foi cancelada.`;
        break;
      }
    }

    const results: Record<string, boolean> = {};

    // Send email via shared clinic email module
    if (emailContent && client.email) {
      const res = await sendClinicEmail({
        to: client.email,
        subject,
        clinic,
        headline: emailContent.headline,
        icon: emailContent.icon,
        bodyHtml: emailContent.bodyHtml,
        bodyText: emailContent.bodyText,
        headerColor: emailContent.headerColor,
        ctaLabel: emailContent.ctaLabel,
        ctaUrl: emailContent.ctaUrl,
      });
      results.email = res.ok;
    }

    // Send push
    if (pushTitle && client.id) {
      const pushSent = await sendPushNotification(supabaseAdmin, client.id, pushTitle, pushBody);
      results.push = pushSent;
    }

    // Log notification
    await supabaseAdmin.from("notification_logs").insert({
      tenant_id,
      recipient_type: "patient",
      recipient_id: client_id,
      channel: "email",
      template_type: event_type,
      status: results.email ? "sent" : "failed",
      metadata: { event_type, ...(metadata ?? {}) },
    });

    log("Evento processado", { event_type, results });

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
