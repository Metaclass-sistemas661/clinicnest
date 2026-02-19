import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("PUBLIC-BOOKING");

type Action = "get_context" | "get_slots" | "create" | "cancel" | "confirm";

type Body =
  | { action: "get_context"; slug: string }
  | { action: "get_slots"; slug: string; professional_id: string; service_id: string; date: string }
  | {
      action: "create";
      slug: string;
      service_id: string;
      professional_id: string;
      scheduled_at: string;
      client_name: string;
      client_email?: string | null;
      client_phone?: string | null;
      notes?: string | null;
    }
  | { action: "cancel"; token: string; reason?: string | null }
  | { action: "confirm"; token: string };

function toTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidISODate(value: string): boolean {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSiteUrl(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

async function sendEmailViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    log("EMAIL: RESEND_API_KEY não configurada. E-mail não enviado.");
    return false;
  }

  const emailFrom = Deno.env.get("EMAIL_FROM") || "BeautyGest <no-reply@metaclass.com.br>";

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("EMAIL: Erro ao enviar via Resend", { status: response.status, error: errorText });
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

function getBookingConfirmationEmailHtml(input: {
  tenantName: string;
  serviceName: string;
  professionalName: string;
  scheduledAtLocal: string;
  cancelUrl: string;
  confirmUrl: string;
  clientName: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de agendamento</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);padding:28px;color:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:800;">${escapeHtml(input.tenantName)}</div>
              <div style="opacity:.92;margin-top:6px;">Agendamento online</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 22px;">
              <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Agendamento confirmado</h2>
              <p style="margin:0 0 14px;color:#374151;line-height:1.6;">Olá, ${escapeHtml(input.clientName)}. Seu agendamento foi registrado com sucesso.</p>
              <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fff;">
                <div style="color:#6b7280;font-size:13px;margin-bottom:8px;">Detalhes</div>
                <div style="color:#111827;font-size:14px;font-weight:700;margin-bottom:6px;">${escapeHtml(input.serviceName)}</div>
                <div style="color:#374151;font-size:14px;margin-bottom:6px;">Profissional: <strong>${escapeHtml(input.professionalName)}</strong></div>
                <div style="color:#374151;font-size:14px;">Horário: <strong>${escapeHtml(input.scheduledAtLocal)}</strong></div>
              </div>
              ${input.confirmUrl ? `<p style="margin:14px 0 0;"><a href="${input.confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-weight:700;padding:10px 22px;border-radius:8px;text-decoration:none;">Confirmar presença</a></p>` : ""}
              <p style="margin:14px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">Se precisar cancelar, utilize o link abaixo (sujeito à política de antecedência do salão):</p>
              <p style="margin:10px 0 0;"><a href="${input.cancelUrl}" style="color:#7c3aed;font-weight:700;">Cancelar agendamento</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 18px;text-align:center;color:#6b7280;font-size:12px;">
              Mensagem automática. Não responda este e-mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getBookingConfirmationEmailText(input: {
  tenantName: string;
  serviceName: string;
  professionalName: string;
  scheduledAtLocal: string;
  cancelUrl: string;
  confirmUrl: string;
  clientName: string;
}): string {
  return `
${input.tenantName} - Confirmação de agendamento

Olá, ${input.clientName}.

Seu agendamento foi registrado com sucesso:
- Serviço: ${input.serviceName}
- Profissional: ${input.professionalName}
- Horário: ${input.scheduledAtLocal}

${input.confirmUrl ? `Confirmar presença:\n${input.confirmUrl}\n` : ""}
Para cancelar (sujeito à política do salão):
${input.cancelUrl}
  `.trim();
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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const requesterIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = (body as any)?.action as Action;
  if (!action) {
    return new Response(JSON.stringify({ error: "action é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rl = await checkRateLimit(`public-booking:${action}:${requesterIp}`, 30, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    if (action === "get_context") {
      const slug = toTrimmedString((body as any).slug, 80);
      if (!slug) {
        return new Response(JSON.stringify({ error: "slug é obrigatório" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: tenant, error: tenantError } = await supabaseAdmin.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );

      if (tenantError || !tenant) {
        return new Response(JSON.stringify({ error: "Salão não encontrado" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if ((tenant as any).online_booking_enabled !== true) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Agendamento online indisponível",
            details: "BOOKING_DISABLED",
          }),
          {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }

      const tenantId = String((tenant as any).id);

      const [servicesRes, profsRes] = await Promise.all([
        supabaseAdmin
          .from("services")
          .select("id, name, description, duration_minutes, price")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("tenant_id", tenantId)
          .order("full_name", { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (profsRes.error) throw profsRes.error;

      return new Response(
        JSON.stringify({
          success: true,
          tenant: {
            id: tenantId,
            name: (tenant as any).name,
            slug: (tenant as any).online_booking_slug,
            min_lead_minutes: (tenant as any).online_booking_min_lead_minutes,
            cancel_min_lead_minutes: (tenant as any).online_booking_cancel_min_lead_minutes,
          },
          services: servicesRes.data || [],
          professionals: profsRes.data || [],
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_slots") {
      const slug = toTrimmedString((body as any).slug, 80);
      const professionalId = toTrimmedString((body as any).professional_id, 60);
      const serviceId = toTrimmedString((body as any).service_id, 60);
      const date = toTrimmedString((body as any).date, 10);

      if (!slug || !professionalId || !serviceId || !date) {
        return new Response(JSON.stringify({ error: "slug, professional_id, service_id e date são obrigatórios" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (!isValidISODate(date)) {
        return new Response(JSON.stringify({ error: "date inválida" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: tenant, error: tenantError } = await supabaseAdmin.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );
      if (tenantError || !tenant) {
        return new Response(JSON.stringify({ error: "Salão não encontrado" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const tenantId = String((tenant as any).id);

      const [{ data: service, error: serviceError }, { data: wh, error: whError }] = await Promise.all([
        supabaseAdmin
          .from("services")
          .select("id, duration_minutes")
          .eq("tenant_id", tenantId)
          .eq("id", serviceId)
          .maybeSingle(),
        supabaseAdmin
          .from("professional_working_hours")
          .select("start_time, end_time, is_active, day_of_week")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId),
      ]);

      if (serviceError) throw serviceError;
      if (whError) throw whError;

      const duration = Math.max(1, Number((service as any)?.duration_minutes ?? 45));

      const targetDate = new Date(`${date}T00:00:00-03:00`);
      const dayOfWeek = (targetDate.getDay() + 6) % 7; // convert JS (0=Sun) to 0=Mon

      const whRow = (wh || []).find((r: any) => Number(r.day_of_week) === dayOfWeek && r.is_active === true);
      if (!whRow) {
        return new Response(JSON.stringify({ success: true, slots: [] }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const startTime = String((whRow as any).start_time);
      const endTime = String((whRow as any).end_time);

      const dayStart = new Date(`${date}T00:00:00-03:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59-03:00`).toISOString();

      const [aptsRes, blocksRes] = await Promise.all([
        supabaseAdmin
          .from("appointments")
          .select("scheduled_at, duration_minutes, status")
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId)
          .neq("status", "cancelled")
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd),
        supabaseAdmin
          .from("schedule_blocks")
          .select("start_at, end_at, professional_id")
          .eq("tenant_id", tenantId)
          .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
          .gte("end_at", dayStart)
          .lte("start_at", dayEnd),
      ]);

      if (aptsRes.error) throw aptsRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const busyRanges: Array<{ start: number; end: number }> = [];
      for (const a of aptsRes.data || []) {
        const s = new Date((a as any).scheduled_at).getTime();
        const e = s + Number((a as any).duration_minutes ?? 0) * 60_000;
        busyRanges.push({ start: s, end: e });
      }
      for (const b of blocksRes.data || []) {
        const s = new Date((b as any).start_at).getTime();
        const e = new Date((b as any).end_at).getTime();
        busyRanges.push({ start: s, end: e });
      }

      const slots: string[] = [];
      const slotStart = new Date(`${date}T${startTime}-03:00`).getTime();
      const slotEnd = new Date(`${date}T${endTime}-03:00`).getTime();
      const stepMinutes = 15;

      for (let t = slotStart; t + duration * 60_000 <= slotEnd; t += stepMinutes * 60_000) {
        const tEnd = t + duration * 60_000;
        const overlaps = busyRanges.some((r) => t < r.end && tEnd > r.start);
        if (!overlaps) {
          slots.push(new Date(t).toISOString());
        }
      }

      return new Response(JSON.stringify({ success: true, slots }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const slug = toTrimmedString((body as any).slug, 80);
      const serviceId = toTrimmedString((body as any).service_id, 60);
      const professionalId = toTrimmedString((body as any).professional_id, 60);
      const scheduledAt = toTrimmedString((body as any).scheduled_at, 80);
      const clientName = toTrimmedString((body as any).client_name, 120);
      const clientEmailRaw = toTrimmedString((body as any).client_email, 160);
      const clientPhone = toTrimmedString((body as any).client_phone, 40);
      const notes = toTrimmedString((body as any).notes, 500);

      if (!slug || !serviceId || !professionalId || !scheduledAt || !clientName) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const clientEmail = clientEmailRaw ? clientEmailRaw : "";
      if (clientEmail && !isValidEmail(clientEmail)) {
        return new Response(JSON.stringify({ error: "E-mail inválido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: createRes, error: createErr } = await supabaseAdmin.rpc("create_public_appointment_v1", {
        p_tenant_slug: slug,
        p_service_id: serviceId,
        p_professional_profile_id: professionalId,
        p_scheduled_at: scheduledAt,
        p_client_name: clientName,
        p_client_email: clientEmail || null,
        p_client_phone: clientPhone || null,
        p_notes: notes || null,
      });

      if (createErr) {
        return new Response(
          JSON.stringify({
            success: false,
            message: createErr.message,
            details: (createErr as any).details,
            code: (createErr as any).code,
          }),
          {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }

      const appointmentId = String((createRes as any)?.appointment_id ?? "");
      const token = String((createRes as any)?.public_booking_token ?? "");

      const { data: tenant, error: tenantError } = await supabaseAdmin.rpc(
        "get_tenant_by_booking_slug_v1",
        { p_slug: slug }
      );
      if (tenantError || !tenant) {
        return new Response(JSON.stringify({ success: true, appointment_id: appointmentId, token }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const tenantId = String((tenant as any).id);
      const [{ data: service }, { data: prof }] = await Promise.all([
        supabaseAdmin
          .from("services")
          .select("name")
          .eq("tenant_id", tenantId)
          .eq("id", serviceId)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("tenant_id", tenantId)
          .eq("id", professionalId)
          .maybeSingle(),
      ]);

      const siteUrl = normalizeSiteUrl(Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_SITE_URL"));
      const cancelUrl  = siteUrl ? `${siteUrl}/agendar/${encodeURIComponent(slug)}?cancelToken=${encodeURIComponent(token)}` : "";
      const confirmUrl = siteUrl ? `${siteUrl}/confirmar/${encodeURIComponent(token)}` : "";

      if (clientEmail) {
        const scheduledLocal = new Date(scheduledAt).toLocaleString("pt-BR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        });

        const html = getBookingConfirmationEmailHtml({
          tenantName: String((tenant as any).name ?? "BeautyGest"),
          serviceName: String((service as any)?.name ?? "Serviço"),
          professionalName: String((prof as any)?.full_name ?? "Profissional"),
          scheduledAtLocal: scheduledLocal,
          cancelUrl: cancelUrl || "",
          confirmUrl: confirmUrl || "",
          clientName,
        });

        const text = getBookingConfirmationEmailText({
          tenantName: String((tenant as any).name ?? "BeautyGest"),
          serviceName: String((service as any)?.name ?? "Serviço"),
          professionalName: String((prof as any)?.full_name ?? "Profissional"),
          scheduledAtLocal: scheduledLocal,
          cancelUrl: cancelUrl || "",
          confirmUrl: confirmUrl || "",
          clientName,
        });

        await sendEmailViaResend(clientEmail, "Confirmação de agendamento", html, text);
      }

      return new Response(JSON.stringify({ success: true, appointment_id: appointmentId, token }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      const token = toTrimmedString((body as any).token, 80);
      const reason = toTrimmedString((body as any).reason, 300);

      if (!token) {
        return new Response(JSON.stringify({ error: "token é obrigatório" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin.rpc("cancel_public_appointment_v1", {
        p_public_booking_token: token,
        p_reason: reason || null,
      });

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message,
            details: (error as any).details,
            code: (error as any).code,
          }),
          {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ success: true, ...(data as any) }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm") {
      const token = toTrimmedString((body as any).token, 80);

      if (!token) {
        return new Response(JSON.stringify({ error: "token é obrigatório" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Busca o agendamento pelo token público
      const { data: apt, error: aptError } = await supabaseAdmin
        .from("appointments")
        .select("id, status, confirmed_at")
        .eq("public_booking_token", token)
        .maybeSingle();

      if (aptError) {
        return new Response(JSON.stringify({ success: false, message: aptError.message }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (!apt) {
        return new Response(JSON.stringify({ success: false, message: "Agendamento não encontrado" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if ((apt as any).status === "cancelled") {
        return new Response(
          JSON.stringify({ success: false, message: "Este agendamento já foi cancelado" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Se já confirmado, retorna sucesso silencioso (idempotente)
      if ((apt as any).confirmed_at) {
        return new Response(JSON.stringify({ success: true, already_confirmed: true }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("appointments")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("public_booking_token", token);

      if (updateError) {
        return new Response(JSON.stringify({ success: false, message: updateError.message }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, already_confirmed: false }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR: Exceção não tratada", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
