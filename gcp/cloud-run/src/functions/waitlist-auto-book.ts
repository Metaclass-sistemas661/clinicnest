/**
 * waitlist-auto-book — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const log = createLogger("WAITLIST-AUTO-BOOK");

type Action = "check" | "book";

export async function waitlistAutoBook(req: Request, res: Response) {
  try {
    const db = createDbClient();
    // CORS handled by middleware
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }
      if (!(process.env.CLOUD_RUN_URL || 'https://clinicnest-api-294286835536.southamerica-east1.run.app') || !process.env.INTERNAL_API_KEY || '') {
        return res.status(500).json({ error: "Configuração incompleta" });
      }
      let body: { action: Action; waitlist_id: string; token?: string };
      try {
        body = req.body;
      } catch {
        return res.status(400).json({ error: "Body inválido" });
      }

      const { action, waitlist_id, token } = body;

      if (!waitlist_id) {
        return res.status(400).json({ error: "waitlist_id obrigatório" });
      }

      // Rate limit by IP
      const ip = (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() || "unknown";
      const rl = await checkRateLimit(`waitlist-auto-book:${ip}`, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Limite de requisições atingido" });
      }

      try {
        // Fetch the waitlist entry + related notification
        const { data: entry, error: wErr } = await db.from("waitlist")
          .select("id, tenant_id, patient_id, service_id, professional_id, status")
          .eq("id", waitlist_id)
          .maybeSingle();

        if (wErr || !entry) {
          return res.status(404).json({ success: false, error: "Entrada não encontrada" });
        }

        // Only notified entries can be auto-booked
        if (entry.status !== "notificado") {
          return res.status(400).json({ success: false, expired: true, error: "Vaga não disponível" });
        }

        // Find the notification for slot info
        const { data: notif } = await db.from("waitlist_notifications")
          .select("appointment_date, service_id, professional_id")
          .eq("waitlist_id", waitlist_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const appointmentDate = (notif as any)?.appointment_date;
        if (!appointmentDate) {
          return res.status(400).json({ success: false, error: "Dados da vaga não encontrados" });
        }

        // Check if slot date is still in the future
        if (new Date(appointmentDate) < new Date()) {
          return res.status(400).json({ success: false, expired: true, error: "A vaga já passou" });
        }

        const serviceId = entry.service_id || (notif as any)?.service_id;
        const professionalId = entry.professional_id || (notif as any)?.professional_id;

        // Fetch enrichment data
        const [serviceRes, profRes, tenantRes] = await Promise.all([
          serviceId
            ? db.from("services").select("name, duration_minutes").eq("id", serviceId).maybeSingle()
            : Promise.resolve({ data: null }),
          professionalId
            ? db.from("profiles").select("full_name").eq("id", professionalId).maybeSingle()
            : Promise.resolve({ data: null }),
          db.from("tenants").select("name").eq("id", entry.tenant_id).maybeSingle(),
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
          });
        }

        if (action === "book") {
          // Double-check no one else took the slot
          const { data: existingAppt } = await db.from("appointments")
            .select("id")
            .eq("tenant_id", entry.tenant_id)
            .eq("scheduled_at", appointmentDate)
            .eq("professional_id", professionalId)
            .neq("status", "cancelled")
            .maybeSingle();

          if (existingAppt) {
            // Slot already taken
            await db.from("waitlist").update({ status: "aguardando", updated_at: new Date().toISOString() }).eq("id", waitlist_id);
            return res.status(400).json({ success: false, expired: true, error: "Vaga já preenchida" });
          }

          const duration = (serviceRes.data as any)?.duration_minutes ?? 30;

          // Create the appointment
          const { data: newAppt, error: apptErr } = await db.from("appointments")
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
            return res.status(500).json({ success: false, error: "Erro ao criar agendamento" });
          }

          // Update waitlist entry
          await db.from("waitlist")
            .update({ status: "agendado", updated_at: new Date().toISOString() })
            .eq("id", waitlist_id);

          // Update notification status
          await db.from("waitlist_notifications")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("waitlist_id", waitlist_id)
            .eq("status", "pending");

          log("Auto-booked from waitlist", { waitlist_id, appointment_id: (newAppt as any)?.id });

          return new Response(JSON.stringify({ success: true, appointment_id: (newAppt as any)?.id }), {
            status: 200,
          });
        }

        return res.status(400).json({ error: "Action inválida" });
      } catch (error: any) {
        log("Exception", { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, error: "Erro interno" });
      }
  } catch (err: any) {
    console.error(`[waitlist-auto-book] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

