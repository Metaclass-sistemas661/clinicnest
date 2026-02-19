import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";

const log = createLogger("SEND-SUPPORT-TICKET-EMAIL");

type Body = {
  ticketId: string;
};

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEmailViaResend(
  to: string,
  replyTo: string | null,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  const emailFrom = Deno.env.get("SUPPORT_EMAIL_FROM") || "ClinicNest <no-reply@metaclass.com.br>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return false;
    }

    const result = await response.json();
    log("EMAIL: E-mail enviado com sucesso via Resend", { emailId: result.id });
    return true;
  } catch (error) {
    log("EMAIL: Exceção ao enviar e-mail", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const auth = await getAuthenticatedUserWithTenant(req, cors);
  if (auth.error) return auth.error;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
  if (!ticketId) {
    return new Response(JSON.stringify({ error: "ticketId é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rl = await checkRateLimit(`support-email:${auth.tenantId}:${auth.user.id}`, 10, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("support_tickets")
    .select("id, tenant_id, subject, category, priority, status, channel, created_at, created_by")
    .eq("id", ticketId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (ticketError || !ticket) {
    return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const [{ data: tenant }, { data: profile }, { data: lastMessage }] = await Promise.all([
    supabaseAdmin.from("tenants").select("name").eq("id", auth.tenantId).maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("user_id", auth.user.id).maybeSingle(),
    supabaseAdmin
      .from("support_messages")
      .select("message, metadata, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const tenantName = (tenant?.name || "BeautyGest").trim();
  const fullName = (profile?.full_name || "Usuário").trim();

  const supportTo = Deno.env.get("SUPPORT_EMAIL_TO") || "suporte@metaclass.com.br";
  const replyTo = auth.user.email ?? null;

  const createdAt = new Date(ticket.created_at).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  const safeSubject = escapeHtml(ticket.subject);
  const safeMessage = escapeHtml(String(lastMessage?.message || ""));
  const safeCategory = escapeHtml(String(ticket.category || "general"));
  const safePriority = escapeHtml(String(ticket.priority || "normal"));
  const safeStatus = escapeHtml(String(ticket.status || "open"));

  const subject = `Suporte - ${tenantName}: ${ticket.subject}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket de suporte - BeautyGest</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);padding:22px 20px;color:#fff;">
        <div style="font-size:20px;font-weight:800;">BeautyGest</div>
        <div style="opacity:.92;margin-top:6px;">Novo ticket de suporte</div>
      </div>
      <div style="padding:18px 20px;">
        <p style="margin:0 0 12px;color:#111827;">
          <strong>${escapeHtml(fullName)}</strong> abriu um ticket no tenant <strong>${escapeHtml(tenantName)}</strong>.
        </p>
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 12px 4px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;width:160px;">Ticket</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${escapeHtml(ticket.id)}</td></tr>
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Assunto</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeSubject}</td></tr>
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Categoria</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeCategory}</td></tr>
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Prioridade</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safePriority}</td></tr>
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Status</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${safeStatus}</td></tr>
            <tr><td style="padding:0 0 8px;color:#6b7280;font-size:13px;">Criado em</td><td style="padding:0 0 8px;color:#111827;font-size:14px;font-weight:700;">${escapeHtml(createdAt)}</td></tr>
          </table>
        </div>
        <div style="margin-top:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
          <div style="font-size:13px;color:#111827;font-weight:800;margin-bottom:6px;">Mensagem</div>
          <div style="font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${safeMessage}</div>
        </div>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 20px;text-align:center;color:#6b7280;font-size:12px;">
        Email transacional do módulo de suporte.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = [
    "Novo ticket de suporte - BeautyGest",
    "",
    `Tenant: ${tenantName}`,
    `Usuário: ${fullName} (${replyTo ?? "sem email"})`,
    `Ticket: ${ticket.id}`,
    `Assunto: ${ticket.subject}`,
    `Categoria: ${ticket.category}`,
    `Prioridade: ${ticket.priority}`,
    `Status: ${ticket.status}`,
    `Criado em: ${createdAt}`,
    "",
    "Mensagem:",
    String(lastMessage?.message || ""),
  ].join("\n");

  const sent = await sendEmailViaResend(supportTo, replyTo, subject, html, text);

  return new Response(
    JSON.stringify({ success: true, notificationSent: sent }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
