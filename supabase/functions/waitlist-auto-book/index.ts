import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("WAITLIST-AUTO-BOOK");

type Action = "check" | "book";

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
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Configuração incompleta" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  let body: { action: Action; waitlist_id: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { action, waitlist_id, token } = body;

  if (!waitlist_id) {
    return new Response(JSON.stringify({ error: "waitlist_id obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`waitlist-auto-book:${ip}`, 20, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Limite de requisições atingido" }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch the waitlist entry + related notification
    const { data: entry, error: wErr } = await supabase
      .from("waitlist")
      .select("id, tenant_id, patient_id, service_id, professional_id, status")
      .eq("id", waitlist_id)
      .maybeSingle();

    if (wErr || !entry) {
      return new Response(JSON.stringify({ success: false, error: "Entrada não encontrada" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Only notified entries can be auto-booked
    if (entry.status !== "notificado") {
      return new Response(JSON.stringify({ success: false, expired: true, error: "Vaga não disponível" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Find the notification for slot info
    const { data: notif } = await supabase
      .from("waitlist_notifications")
      .select("appointment_date, service_id, professional_id")
      .eq("waitlist_id", waitlist_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appointmentDate = (notif as any)?.appointment_date;
    if (!appointmentDate) {
      return new Response(JSON.stringify({ success: false, error: "Dados da vaga não encontrados" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check if slot date is still in the future
    if (new Date(appointmentDate) < new Date()) {
      return new Response(JSON.stringify({ success: false, expired: true, error: "A vaga já passou" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const serviceId = entry.service_id || (notif as any)?.service_id;
    const professionalId = entry.professional_id || (notif as any)?.professional_id;

    // Fetch enrichment data
    const [serviceRes, profRes, tenantRes] = await Promise.all([
      serviceId
        ? supabase.from("services").select("name, duration_minutes").eq("id", serviceId).maybeSingle()
        : Promise.resolve({ data: null }),
      professionalId
        ? supabase.from("profiles").select("full_name").eq("id", professionalId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("tenants").select("name").eq("id", entry.tenant_id).maybeSingle(),
    ]);

    if (action === "check") {
      return new Response(JSON.stringify({
        success: true,
        slot: {
          appointment_date: appointmentDate,
          service_name: (serviceRes.data as any)?.name ?? "Consulta",
          professional_name: (profRes.data as any)?.full_name ?? "Profissional",
          clinic_name: (tenantRes.data as any)?.name ?? "Clínica",
        },
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "book") {
      // Double-check no one else took the slot
      const { data: existingAppt } = await supabase
        .from("appointments")
        .select("id")
        .eq("tenant_id", entry.tenant_id)
        .eq("scheduled_at", appointmentDate)
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingAppt) {
        // Slot already taken
        await supabase.from("waitlist").update({ status: "aguardando", updated_at: new Date().toISOString() }).eq("id", waitlist_id);
        return new Response(JSON.stringify({ success: false, expired: true, error: "Vaga já preenchida" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const duration = (serviceRes.data as any)?.duration_minutes ?? 30;

      // Create the appointment
      const { data: newAppt, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          tenant_id: entry.tenant_id,
          patient_id: entry.patient_id,
          client_id: entry.patient_id,
          service_id: serviceId,
          procedure_id: serviceId,
          professional_id: professionalId,
          scheduled_at: appointmentDate,
          duration_minutes: duration,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          source: "waitlist",
          created_via: "waitlist_auto_book",
          notes: "Agendado automaticamente via lista de espera",
        })
        .select("id")
        .single();

      if (apptErr) {
        log("Error creating appointment", { error: apptErr.message });
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar agendamento" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Update waitlist entry
      await supabase
        .from("waitlist")
        .update({ status: "agendado", updated_at: new Date().toISOString() })
        .eq("id", waitlist_id);

      // Update notification status
      await supabase
        .from("waitlist_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("waitlist_id", waitlist_id)
        .eq("status", "pending");

      log("Auto-booked from waitlist", { waitlist_id, appointment_id: (newAppt as any)?.id });

      return new Response(JSON.stringify({ success: true, appointment_id: (newAppt as any)?.id }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inválida" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Exception", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
