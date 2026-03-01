import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("WHATSAPP-CHATBOT");

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SelectResult<T> = { data: T; error?: unknown };

interface TenantConfig {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  whatsapp_api_url: string | null;
  whatsapp_api_key: string | null;
  whatsapp_instance: string | null;
}

interface ChatbotSettings {
  is_active: boolean;
  welcome_message: string;
  menu_message: string;
  outside_hours_message: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  auto_confirm_booking: boolean;
  max_future_days: number;
}

interface Conversation {
  id: string;
  tenant_id: string;
  phone: string;
  client_id: string | null;
  state: string;
  context: Record<string, unknown>;
  last_message_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
}

interface ProfessionalRow {
  id: string;
  full_name: string;
}

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  start_time: string;
  status: string;
  service_id: string;
  professional_id: string;
}

interface IncomingWebhook {
  tenant_id: string;
  phone: string;
  message: string;
  message_id?: string;
  message_type?: string;
  button_payload?: string;
  list_reply_id?: string;
}

// ─── Constantes de estado ────────────────────────────────────────────────────

const STATE = {
  IDLE: "idle",
  MENU: "menu",
  BOOKING_SERVICE: "booking_service",
  BOOKING_PROFESSIONAL: "booking_professional",
  BOOKING_DATE: "booking_date",
  BOOKING_TIME: "booking_time",
  BOOKING_CONFIRM: "booking_confirm",
  CANCEL_SELECT: "cancel_select",
  CANCEL_CONFIRM: "cancel_confirm",
  VIEW_APPOINTMENTS: "view_appointments",
  TALK_TO_HUMAN: "talk_to_human",
  WAITING_HUMAN: "waiting_human",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isWithinBusinessHours(settings: ChatbotSettings): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (!settings.business_days.includes(day)) return false;

  const [startH, startM] = settings.business_hours_start.split(":").map(Number);
  const [endH, endM] = settings.business_hours_end.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function generateSlots(date: Date, durationMinutes: number): string[] {
  const slots: string[] = [];
  const start = 8 * 60; // 8:00
  const end = 18 * 60; // 18:00
  for (let m = start; m + durationMinutes <= end; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

// ─── Enviar mensagem via Evolution API ────────────────────────────────────────

async function sendWhatsAppMessage(
  tenant: TenantConfig,
  phone: string,
  message: string,
): Promise<boolean> {
  const apiUrl = (tenant.whatsapp_api_url ?? "").trim();
  const apiKey = (tenant.whatsapp_api_key ?? "").trim();
  const instance = (tenant.whatsapp_instance ?? "").trim();
  if (!apiUrl || !apiKey || !instance) return false;

  const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: phone, text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWhatsAppButtons(
  tenant: TenantConfig,
  phone: string,
  title: string,
  message: string,
  buttons: Array<{ id: string; text: string }>,
): Promise<boolean> {
  const apiUrl = (tenant.whatsapp_api_url ?? "").trim();
  const apiKey = (tenant.whatsapp_api_key ?? "").trim();
  const instance = (tenant.whatsapp_instance ?? "").trim();
  if (!apiUrl || !apiKey || !instance) return false;

  const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendButtons/${encodeURIComponent(instance)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: phone,
        title,
        description: message,
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          buttonId: b.id,
          buttonText: { displayText: b.text },
        })),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWhatsAppList(
  tenant: TenantConfig,
  phone: string,
  title: string,
  description: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ title: string; rowId: string; description?: string }>;
  }>,
): Promise<boolean> {
  const apiUrl = (tenant.whatsapp_api_url ?? "").trim();
  const apiKey = (tenant.whatsapp_api_key ?? "").trim();
  const instance = (tenant.whatsapp_instance ?? "").trim();
  if (!apiUrl || !apiKey || !instance) return false;

  const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendList/${encodeURIComponent(instance)}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: phone,
        title,
        description,
        buttonText,
        sections,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Estado do Chatbot ──────────────────────────────────────────────────────

async function getOrCreateConversation(
  supabase: SupabaseClient,
  tenantId: string,
  phone: string,
): Promise<Conversation> {
  const { data: existing } = (await supabase
    .from("chatbot_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle()) as unknown as SelectResult<Conversation | null>;

  if (existing) {
    // Update last_message_at
    await supabase
      .from("chatbot_conversations")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing;
  }

  // Try to find matching client
  const { data: client } = (await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(`phone.eq.${phone},phone.eq.${phone.replace(/^55/, "")}`)
    .maybeSingle()) as unknown as SelectResult<{ id: string } | null>;

  const { data: newConv } = (await supabase
    .from("chatbot_conversations")
    .insert({
      tenant_id: tenantId,
      phone,
      client_id: client?.id ?? null,
      state: STATE.IDLE,
      context: {},
    })
    .select("*")
    .single()) as unknown as SelectResult<Conversation>;

  return newConv;
}

async function updateConversation(
  supabase: SupabaseClient,
  convId: string,
  state: string,
  context: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("chatbot_conversations")
    .update({ state, context, updated_at: new Date().toISOString() })
    .eq("id", convId);
}

async function logMessage(
  supabase: SupabaseClient,
  convId: string,
  tenantId: string,
  direction: "inbound" | "outbound",
  content: string,
  messageType = "text",
): Promise<void> {
  await supabase.from("chatbot_messages").insert({
    conversation_id: convId,
    tenant_id: tenantId,
    direction,
    message_type: messageType,
    content,
  });
}

// ─── Handlers por estado ────────────────────────────────────────────────────

async function handleIdle(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  settings: ChatbotSettings,
  _message: string,
): Promise<void> {
  // Enviar boas-vindas + menu
  const clientName = conv.client_id
    ? await getClientName(supabase, conv.client_id)
    : null;

  const greeting = clientName
    ? settings.welcome_message.replace("{{nome}}", clientName)
    : settings.welcome_message;

  await sendWhatsAppMessage(tenant, conv.phone, greeting);
  await logMessage(supabase, conv.id, conv.tenant_id, "outbound", greeting);

  // Enviar menu com botões
  await sendWhatsAppButtons(tenant, conv.phone, "📋 Menu Principal", settings.menu_message, [
    { id: "btn_agendar", text: "📅 Agendar" },
    { id: "btn_consultas", text: "📋 Minhas Consultas" },
    { id: "btn_falar", text: "💬 Falar c/ Atendente" },
  ]);

  await logMessage(supabase, conv.id, conv.tenant_id, "outbound", "[MENU] Options: Agendar, Consultas, Falar", "interactive");
  await updateConversation(supabase, conv.id, STATE.MENU, {});
}

async function handleMenu(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  _settings: ChatbotSettings,
  message: string,
  buttonPayload?: string,
): Promise<void> {
  const input = (buttonPayload ?? message).toLowerCase().trim();

  if (input === "btn_agendar" || input.includes("agendar") || input === "1") {
    await startBookingFlow(supabase, conv, tenant);
  } else if (input === "btn_consultas" || input.includes("consulta") || input === "2") {
    await showAppointments(supabase, conv, tenant);
  } else if (input === "btn_falar" || input.includes("falar") || input.includes("atendente") || input === "3") {
    await transferToHuman(supabase, conv, tenant);
  } else if (input.includes("cancelar")) {
    await startCancelFlow(supabase, conv, tenant);
  } else {
    await sendWhatsAppMessage(
      tenant,
      conv.phone,
      "Desculpe, não entendi. Por favor, escolha uma das opções do menu:",
    );
    await sendWhatsAppButtons(tenant, conv.phone, "📋 Menu Principal", "Escolha uma opção:", [
      { id: "btn_agendar", text: "📅 Agendar" },
      { id: "btn_consultas", text: "📋 Minhas Consultas" },
      { id: "btn_falar", text: "💬 Falar c/ Atendente" },
    ]);
  }
}

// ─── Fluxo de Agendamento ────────────────────────────────────────────────────

async function startBookingFlow(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
): Promise<void> {
  // Buscar serviços ativos
  const { data: services } = (await supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("tenant_id", conv.tenant_id)
    .eq("is_active", true)
    .order("name")
    .limit(10)) as unknown as SelectResult<ServiceRow[] | null>;

  if (!services?.length) {
    await sendWhatsAppMessage(tenant, conv.phone, "No momento não temos serviços disponíveis para agendamento online. Por favor, entre em contato diretamente com a clínica.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const sections = [{
    title: "Serviços Disponíveis",
    rows: services.map((s, i) => ({
      title: s.name.slice(0, 24),
      rowId: `svc_${s.id}`,
      description: s.price ? `R$ ${Number(s.price).toFixed(2)} • ${s.duration_minutes}min` : `${s.duration_minutes}min`,
    })),
  }];

  await sendWhatsAppList(
    tenant,
    conv.phone,
    "📅 Agendamento",
    "Selecione o serviço desejado:",
    "Ver Serviços",
    sections,
  );

  await logMessage(supabase, conv.id, conv.tenant_id, "outbound", `[LIST] ${services.length} serviços`, "interactive");
  await updateConversation(supabase, conv.id, STATE.BOOKING_SERVICE, { services: services.map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes })) });
}

async function handleBookingService(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  message: string,
  listReplyId?: string,
): Promise<void> {
  const input = listReplyId ?? message;

  // Parse service selection
  let serviceId: string | null = null;
  if (input.startsWith("svc_")) {
    serviceId = input.replace("svc_", "");
  } else {
    // Try to match by name or number
    const services = (conv.context.services as Array<{ id: string; name: string; duration: number }>) ?? [];
    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < services.length) {
      serviceId = services[idx].id;
    } else {
      const match = services.find((s) => s.name.toLowerCase().includes(input.toLowerCase()));
      serviceId = match?.id ?? null;
    }
  }

  if (!serviceId) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não encontrei esse serviço. Por favor, selecione da lista ou digite o número.");
    return;
  }

  const services = (conv.context.services as Array<{ id: string; name: string; duration: number }>) ?? [];
  const selectedService = services.find((s) => s.id === serviceId);

  // Buscar profissionais que oferecem este serviço
  const { data: profs } = (await supabase
    .from("professional_services")
    .select("professional_id, profiles!inner(id, full_name)")
    .eq("service_id", serviceId)
    .eq("tenant_id", conv.tenant_id)
    .limit(10)) as unknown as SelectResult<Array<{ professional_id: string; profiles: { id: string; full_name: string } }> | null>;

  if (!profs?.length) {
    // Se não houver relação, buscar qualquer profissional ativo
    const { data: anyProfs } = (await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", conv.tenant_id)
      .eq("role", "professional")
      .limit(10)) as unknown as SelectResult<ProfessionalRow[] | null>;

    if (!anyProfs?.length) {
      await sendWhatsAppMessage(tenant, conv.phone, "No momento não há profissionais disponíveis. Tente novamente mais tarde.");
      await updateConversation(supabase, conv.id, STATE.MENU, {});
      return;
    }

    const sections = [{
      title: "Profissionais",
      rows: anyProfs.map((p) => ({
        title: p.full_name.slice(0, 24),
        rowId: `prof_${p.id}`,
      })),
    }];

    await sendWhatsAppList(tenant, conv.phone, "👨‍⚕️ Profissional", "Selecione o profissional:", "Ver Profissionais", sections);
    await logMessage(supabase, conv.id, conv.tenant_id, "outbound", `[LIST] ${anyProfs.length} profissionais`, "interactive");
    await updateConversation(supabase, conv.id, STATE.BOOKING_PROFESSIONAL, {
      ...conv.context,
      selected_service_id: serviceId,
      selected_service_name: selectedService?.name ?? "",
      selected_service_duration: selectedService?.duration ?? 30,
      professionals: anyProfs.map((p) => ({ id: p.id, name: p.full_name })),
    });
    return;
  }

  const profList = profs.map((p) => ({ id: p.profiles.id, name: p.profiles.full_name }));
  const sections = [{
    title: "Profissionais",
    rows: profList.map((p) => ({
      title: p.name.slice(0, 24),
      rowId: `prof_${p.id}`,
    })),
  }];

  await sendWhatsAppList(tenant, conv.phone, "👨‍⚕️ Profissional", "Selecione o profissional:", "Ver Profissionais", sections);
  await updateConversation(supabase, conv.id, STATE.BOOKING_PROFESSIONAL, {
    ...conv.context,
    selected_service_id: serviceId,
    selected_service_name: selectedService?.name ?? "",
    selected_service_duration: selectedService?.duration ?? 30,
    professionals: profList,
  });
}

async function handleBookingProfessional(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  settings: ChatbotSettings,
  message: string,
  listReplyId?: string,
): Promise<void> {
  const input = listReplyId ?? message;
  let profId: string | null = null;

  if (input.startsWith("prof_")) {
    profId = input.replace("prof_", "");
  } else {
    const profs = (conv.context.professionals as Array<{ id: string; name: string }>) ?? [];
    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < profs.length) {
      profId = profs[idx].id;
    } else {
      const match = profs.find((p) => p.name.toLowerCase().includes(input.toLowerCase()));
      profId = match?.id ?? null;
    }
  }

  if (!profId) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não encontrei esse profissional. Por favor, selecione da lista.");
    return;
  }

  const profs = (conv.context.professionals as Array<{ id: string; name: string }>) ?? [];
  const selectedProf = profs.find((p) => p.id === profId);

  // Oferecer próximos dias disponíveis
  const today = new Date();
  const dates: Array<{ label: string; value: string }> = [];
  for (let i = 1; i <= Math.min(settings.max_future_days, 7); i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const dayOfWeek = d.getDay();
    if (settings.business_days.includes(dayOfWeek)) {
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      dates.push({ label, value: dateStr });
    }
  }

  if (!dates.length) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não há datas disponíveis nos próximos dias. Por favor, entre em contato diretamente.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const sections = [{
    title: "Datas Disponíveis",
    rows: dates.map((d) => ({
      title: d.label,
      rowId: `date_${d.value}`,
    })),
  }];

  await sendWhatsAppList(tenant, conv.phone, "📆 Data", "Selecione a data desejada:", "Ver Datas", sections);
  await updateConversation(supabase, conv.id, STATE.BOOKING_DATE, {
    ...conv.context,
    selected_professional_id: profId,
    selected_professional_name: selectedProf?.name ?? "",
    available_dates: dates,
  });
}

async function handleBookingDate(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  message: string,
  listReplyId?: string,
): Promise<void> {
  const input = listReplyId ?? message;
  let dateStr: string | null = null;

  if (input.startsWith("date_")) {
    dateStr = input.replace("date_", "");
  } else {
    const dates = (conv.context.available_dates as Array<{ label: string; value: string }>) ?? [];
    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < dates.length) {
      dateStr = dates[idx].value;
    }
  }

  if (!dateStr) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não entendi a data. Por favor, selecione da lista.");
    return;
  }

  // Buscar horários já ocupados nesse dia
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;
  const profId = conv.context.selected_professional_id as string;
  const duration = (conv.context.selected_service_duration as number) ?? 30;

  const { data: busyAppts } = (await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("tenant_id", conv.tenant_id)
    .eq("professional_id", profId)
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)
    .neq("status", "cancelled")) as unknown as SelectResult<Array<{ start_time: string; end_time: string }> | null>;

  const busyMinutes = new Set<number>();
  for (const appt of busyAppts ?? []) {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    for (let m = start.getHours() * 60 + start.getMinutes(); m < end.getHours() * 60 + end.getMinutes(); m += 30) {
      busyMinutes.add(m);
    }
  }

  const allSlots = generateSlots(new Date(dateStr), duration);
  const availableSlots = allSlots.filter((slot) => {
    const [h, m] = slot.split(":").map(Number);
    const slotMinute = h * 60 + m;
    // Check if any part of the service duration overlaps with busy slots
    for (let dm = 0; dm < duration; dm += 30) {
      if (busyMinutes.has(slotMinute + dm)) return false;
    }
    return true;
  });

  if (!availableSlots.length) {
    await sendWhatsAppMessage(tenant, conv.phone, `Infelizmente não há horários disponíveis em ${formatDateBR(dateStr + "T12:00:00")}. Deseja escolher outra data?`);
    await sendWhatsAppButtons(tenant, conv.phone, "📅 Outra Data", "O que deseja fazer?", [
      { id: "btn_outra_data", text: "📅 Outra Data" },
      { id: "btn_menu", text: "🏠 Menu" },
    ]);
    return;
  }

  // Show max 10 slots
  const sections = [{
    title: "Horários Disponíveis",
    rows: availableSlots.slice(0, 10).map((slot) => ({
      title: slot,
      rowId: `time_${slot}`,
    })),
  }];

  await sendWhatsAppList(tenant, conv.phone, "🕐 Horário", `Horários para ${formatDateBR(dateStr + "T12:00:00")}:`, "Ver Horários", sections);
  await updateConversation(supabase, conv.id, STATE.BOOKING_TIME, {
    ...conv.context,
    selected_date: dateStr,
    available_slots: availableSlots,
  });
}

async function handleBookingTime(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  message: string,
  listReplyId?: string,
): Promise<void> {
  const input = listReplyId ?? message;
  let timeStr: string | null = null;

  if (input.startsWith("time_")) {
    timeStr = input.replace("time_", "");
  } else {
    // Try to match time format HH:MM
    const match = input.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      timeStr = `${match[1].padStart(2, "0")}:${match[2]}`;
    }
  }

  const availableSlots = (conv.context.available_slots as string[]) ?? [];
  if (!timeStr || !availableSlots.includes(timeStr)) {
    await sendWhatsAppMessage(tenant, conv.phone, "Horário inválido. Por favor, selecione da lista.");
    return;
  }

  const dateStr = conv.context.selected_date as string;
  const serviceName = conv.context.selected_service_name as string;
  const profName = conv.context.selected_professional_name as string;

  const summary = `📋 *Resumo do Agendamento*\n\n` +
    `📌 Serviço: ${serviceName}\n` +
    `👨‍⚕️ Profissional: ${profName}\n` +
    `📅 Data: ${formatDateBR(dateStr + "T12:00:00")}\n` +
    `🕐 Horário: ${timeStr}\n` +
    `📍 Local: ${tenant.name}${tenant.address ? ` - ${tenant.address}` : ""}\n\n` +
    `Confirma o agendamento?`;

  await sendWhatsAppMessage(tenant, conv.phone, summary);
  await sendWhatsAppButtons(tenant, conv.phone, "✅ Confirmar", "Deseja confirmar?", [
    { id: "btn_confirmar", text: "✅ Confirmar" },
    { id: "btn_cancelar_booking", text: "❌ Cancelar" },
  ]);

  await updateConversation(supabase, conv.id, STATE.BOOKING_CONFIRM, {
    ...conv.context,
    selected_time: timeStr,
  });
}

async function handleBookingConfirm(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  settings: ChatbotSettings,
  message: string,
  buttonPayload?: string,
): Promise<void> {
  const input = (buttonPayload ?? message).toLowerCase().trim();

  if (input === "btn_cancelar_booking" || input.includes("cancelar") || input.includes("não") || input === "nao") {
    await sendWhatsAppMessage(tenant, conv.phone, "Agendamento cancelado. Voltando ao menu principal.");
    await updateConversation(supabase, conv.id, STATE.IDLE, {});
    return;
  }

  if (input !== "btn_confirmar" && !input.includes("sim") && !input.includes("confirmar") && input !== "s") {
    await sendWhatsAppMessage(tenant, conv.phone, "Por favor, responda *Sim* para confirmar ou *Não* para cancelar.");
    return;
  }

  // Criar o agendamento
  const dateStr = conv.context.selected_date as string;
  const timeStr = conv.context.selected_time as string;
  const serviceId = conv.context.selected_service_id as string;
  const profId = conv.context.selected_professional_id as string;
  const duration = (conv.context.selected_service_duration as number) ?? 30;

  const startTime = new Date(`${dateStr}T${timeStr}:00`);
  const endTime = new Date(startTime.getTime() + duration * 60_000);

  const status = settings.auto_confirm_booking ? "confirmed" : "scheduled";

  const insertPayload: Record<string, unknown> = {
    tenant_id: conv.tenant_id,
    service_id: serviceId,
    professional_id: profId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    scheduled_at: startTime.toISOString(),
    status,
    source: "whatsapp_chatbot",
    notes: "Agendado via chatbot WhatsApp",
  };

  // Link client if known
  if (conv.client_id) {
    insertPayload.client_id = conv.client_id;
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .insert(insertPayload)
    .select("id")
    .single();

  if (apptErr) {
    log("Booking error", { error: apptErr });
    await sendWhatsAppMessage(tenant, conv.phone, "Desculpe, ocorreu um erro ao realizar o agendamento. Por favor, tente novamente ou entre em contato diretamente com a clínica.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const confirmMsg = `✅ *Agendamento ${status === "confirmed" ? "Confirmado" : "Realizado"}!*\n\n` +
    `📌 ${conv.context.selected_service_name}\n` +
    `👨‍⚕️ ${conv.context.selected_professional_name}\n` +
    `📅 ${formatDateBR(startTime.toISOString())} às ${timeStr}\n\n` +
    (status === "scheduled" ? "⚠️ Seu agendamento será confirmado pela clínica em breve.\n\n" : "") +
    `📍 ${tenant.name}\n` +
    (tenant.address ? `📍 ${tenant.address}\n` : "") +
    `\nObrigado por agendar conosco! 🙏`;

  await sendWhatsAppMessage(tenant, conv.phone, confirmMsg);
  await logMessage(supabase, conv.id, conv.tenant_id, "outbound", `[BOOKING] Appointment ${appt.id} created`, "system");
  await updateConversation(supabase, conv.id, STATE.IDLE, {});
}

// ─── Fluxo de Consultas ─────────────────────────────────────────────────────

async function showAppointments(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
): Promise<void> {
  if (!conv.client_id) {
    await sendWhatsAppMessage(
      tenant,
      conv.phone,
      "Não encontramos um cadastro associado a este número. Para ver seus agendamentos, entre em contato com a clínica.",
    );
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const now = new Date().toISOString();
  const { data: appts } = (await supabase
    .from("appointments")
    .select("id, start_time, status, service_id, professional_id")
    .eq("tenant_id", conv.tenant_id)
    .eq("client_id", conv.client_id)
    .gte("start_time", now)
    .neq("status", "cancelled")
    .order("start_time")
    .limit(5)) as unknown as SelectResult<AppointmentRow[] | null>;

  if (!appts?.length) {
    await sendWhatsAppMessage(tenant, conv.phone, "Você não tem consultas agendadas. Deseja agendar uma?");
    await sendWhatsAppButtons(tenant, conv.phone, "📅 Agendar", "O que deseja fazer?", [
      { id: "btn_agendar", text: "📅 Agendar" },
      { id: "btn_menu", text: "🏠 Menu" },
    ]);
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  // Fetch service and professional names
  const serviceIds = [...new Set(appts.map((a) => a.service_id).filter(Boolean))];
  const profIds = [...new Set(appts.map((a) => a.professional_id).filter(Boolean))];

  const [servicesRes, profsRes] = await Promise.all([
    serviceIds.length
      ? (supabase.from("services").select("id, name").in("id", serviceIds) as unknown as SelectResult<ServiceRow[] | null>)
      : { data: [] as ServiceRow[] },
    profIds.length
      ? (supabase.from("profiles").select("id, full_name").in("id", profIds) as unknown as SelectResult<ProfessionalRow[] | null>)
      : { data: [] as ProfessionalRow[] },
  ]);

  const svcMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
  const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p.full_name]));

  let msg = "📋 *Seus Agendamentos*\n\n";
  for (const appt of appts) {
    const svcName = svcMap.get(appt.service_id) ?? "Consulta";
    const profName = profMap.get(appt.professional_id) ?? "";
    const statusEmoji = appt.status === "confirmed" ? "✅" : "⏳";
    msg += `${statusEmoji} *${svcName}*\n`;
    msg += `   📅 ${formatDateBR(appt.start_time)} às ${formatTimeBR(appt.start_time)}\n`;
    if (profName) msg += `   👨‍⚕️ ${profName}\n`;
    msg += "\n";
  }

  await sendWhatsAppMessage(tenant, conv.phone, msg);
  await sendWhatsAppButtons(tenant, conv.phone, "📋 Opções", "O que deseja fazer?", [
    { id: "btn_cancelar_consulta", text: "❌ Cancelar Consulta" },
    { id: "btn_agendar", text: "📅 Novo Agendamento" },
    { id: "btn_menu", text: "🏠 Menu" },
  ]);

  await updateConversation(supabase, conv.id, STATE.VIEW_APPOINTMENTS, {
    appointments: appts.map((a) => ({
      id: a.id,
      date: a.start_time,
      service: svcMap.get(a.service_id) ?? "Consulta",
    })),
  });
}

// ─── Fluxo de Cancelamento ──────────────────────────────────────────────────

async function startCancelFlow(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
): Promise<void> {
  if (!conv.client_id) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não encontramos um cadastro associado a este número.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const now = new Date().toISOString();
  const { data: appts } = (await supabase
    .from("appointments")
    .select("id, start_time, status, service_id")
    .eq("tenant_id", conv.tenant_id)
    .eq("client_id", conv.client_id)
    .gte("start_time", now)
    .neq("status", "cancelled")
    .order("start_time")
    .limit(5)) as unknown as SelectResult<AppointmentRow[] | null>;

  if (!appts?.length) {
    await sendWhatsAppMessage(tenant, conv.phone, "Você não tem consultas para cancelar.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  const serviceIds = [...new Set(appts.map((a) => a.service_id).filter(Boolean))];
  const { data: services } = serviceIds.length
    ? (await supabase.from("services").select("id, name").in("id", serviceIds) as unknown as SelectResult<ServiceRow[] | null>)
    : { data: [] as ServiceRow[] };
  const svcMap = new Map((services ?? []).map((s) => [s.id, s.name]));

  const sections = [{
    title: "Suas Consultas",
    rows: appts.map((a) => ({
      title: `${svcMap.get(a.service_id) ?? "Consulta"} - ${formatDateBR(a.start_time)}`,
      rowId: `cancel_${a.id}`,
      description: formatTimeBR(a.start_time),
    })),
  }];

  await sendWhatsAppList(tenant, conv.phone, "❌ Cancelar", "Selecione a consulta a cancelar:", "Ver Consultas", sections);
  await updateConversation(supabase, conv.id, STATE.CANCEL_SELECT, {
    cancel_appointments: appts.map((a) => ({ id: a.id, service: svcMap.get(a.service_id) ?? "Consulta", date: a.start_time })),
  });
}

async function handleCancelSelect(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  message: string,
  listReplyId?: string,
): Promise<void> {
  const input = listReplyId ?? message;
  let apptId: string | null = null;

  if (input.startsWith("cancel_")) {
    apptId = input.replace("cancel_", "");
  }

  if (!apptId) {
    await sendWhatsAppMessage(tenant, conv.phone, "Não entendi. Selecione a consulta da lista.");
    return;
  }

  const appts = (conv.context.cancel_appointments as Array<{ id: string; service: string; date: string }>) ?? [];
  const selected = appts.find((a) => a.id === apptId);

  if (!selected) {
    await sendWhatsAppMessage(tenant, conv.phone, "Consulta não encontrada.");
    await updateConversation(supabase, conv.id, STATE.MENU, {});
    return;
  }

  await sendWhatsAppMessage(
    tenant,
    conv.phone,
    `Deseja realmente cancelar?\n\n📌 ${selected.service}\n📅 ${formatDateBR(selected.date)} às ${formatTimeBR(selected.date)}`,
  );
  await sendWhatsAppButtons(tenant, conv.phone, "⚠️ Confirmar", "Confirmar cancelamento?", [
    { id: "btn_confirm_cancel", text: "❌ Sim, Cancelar" },
    { id: "btn_keep", text: "✅ Manter" },
  ]);

  await updateConversation(supabase, conv.id, STATE.CANCEL_CONFIRM, {
    ...conv.context,
    cancel_appointment_id: apptId,
  });
}

async function handleCancelConfirm(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
  message: string,
  buttonPayload?: string,
): Promise<void> {
  const input = (buttonPayload ?? message).toLowerCase().trim();

  if (input === "btn_keep" || input.includes("manter") || input.includes("não") || input === "nao") {
    await sendWhatsAppMessage(tenant, conv.phone, "Ok, sua consulta foi mantida! ✅");
    await updateConversation(supabase, conv.id, STATE.IDLE, {});
    return;
  }

  if (input === "btn_confirm_cancel" || input.includes("sim") || input.includes("cancelar") || input === "s") {
    const apptId = conv.context.cancel_appointment_id as string;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", apptId)
      .eq("tenant_id", conv.tenant_id);

    if (error) {
      await sendWhatsAppMessage(tenant, conv.phone, "Erro ao cancelar. Entre em contato com a clínica.");
    } else {
      await sendWhatsAppMessage(tenant, conv.phone, "✅ Consulta cancelada com sucesso.\n\nSe desejar reagendar, é só acessar o menu!");
      await logMessage(supabase, conv.id, conv.tenant_id, "outbound", `[CANCEL] Appointment ${apptId} cancelled`, "system");
    }
    await updateConversation(supabase, conv.id, STATE.IDLE, {});
  } else {
    await sendWhatsAppMessage(tenant, conv.phone, "Por favor, responda *Sim* para cancelar ou *Não* para manter.");
  }
}

// ─── Transferir para Humano ─────────────────────────────────────────────────

async function transferToHuman(
  supabase: SupabaseClient,
  conv: Conversation,
  tenant: TenantConfig,
): Promise<void> {
  await sendWhatsAppMessage(
    tenant,
    conv.phone,
    "Certo! Estou transferindo para um atendente. Por favor, aguarde.\n\n" +
    "💡 Dica: você pode digitar *menu* a qualquer momento para voltar ao menu automático.",
  );
  await logMessage(supabase, conv.id, conv.tenant_id, "outbound", "[TRANSFER] Transferred to human", "system");
  await updateConversation(supabase, conv.id, STATE.WAITING_HUMAN, {});
}

// ─── Helpers de Dados ───────────────────────────────────────────────────────

async function getClientName(supabase: SupabaseClient, clientId: string): Promise<string | null> {
  const { data } = (await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle()) as unknown as SelectResult<{ name: string | null } | null>;
  return data?.name ?? null;
}

// ─── Router Principal ────────────────────────────────────────────────────────

async function processMessage(
  supabase: SupabaseClient,
  payload: IncomingWebhook,
): Promise<{ handled: boolean; state: string }> {
  const { tenant_id: tenantId, phone } = payload;
  const normalizedPhone = normalizePhone(phone);

  // Get tenant config
  const { data: tenant } = (await supabase
    .from("tenants")
    .select("id, name, phone, address, whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
    .eq("id", tenantId)
    .maybeSingle()) as unknown as SelectResult<TenantConfig | null>;

  if (!tenant) return { handled: false, state: "error" };

  // Get chatbot settings
  const { data: settings } = (await supabase
    .from("chatbot_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle()) as unknown as SelectResult<ChatbotSettings | null>;

  if (!settings?.is_active) return { handled: false, state: "inactive" };

  // Get or create conversation
  const conv = await getOrCreateConversation(supabase, tenantId, normalizedPhone);

  // Log inbound message
  await logMessage(supabase, conv.id, tenantId, "inbound", payload.message);

  // Check for global commands
  const msgLower = payload.message.toLowerCase().trim();
  if (msgLower === "menu" || msgLower === "inicio" || msgLower === "início" || msgLower === "#") {
    await updateConversation(supabase, conv.id, STATE.IDLE, {});
    conv.state = STATE.IDLE;
  }

  // Check business hours
  if (!isWithinBusinessHours(settings) && conv.state === STATE.IDLE) {
    await sendWhatsAppMessage(tenant, normalizedPhone, settings.outside_hours_message);
    await logMessage(supabase, conv.id, tenantId, "outbound", settings.outside_hours_message);
    return { handled: true, state: "outside_hours" };
  }

  // Reset if conversation is stale (> 30 min)
  const lastMsg = new Date(conv.last_message_at).getTime();
  const now = Date.now();
  if (now - lastMsg > 30 * 60 * 1000 && conv.state !== STATE.WAITING_HUMAN) {
    conv.state = STATE.IDLE;
    conv.context = {};
  }

  // Route by state
  switch (conv.state) {
    case STATE.IDLE:
      await handleIdle(supabase, conv, tenant, settings, payload.message);
      break;

    case STATE.MENU:
    case STATE.VIEW_APPOINTMENTS:
      await handleMenu(supabase, conv, tenant, settings, payload.message, payload.button_payload);
      break;

    case STATE.BOOKING_SERVICE:
      await handleBookingService(supabase, conv, tenant, payload.message, payload.list_reply_id);
      break;

    case STATE.BOOKING_PROFESSIONAL:
      await handleBookingProfessional(supabase, conv, tenant, settings, payload.message, payload.list_reply_id);
      break;

    case STATE.BOOKING_DATE:
      await handleBookingDate(supabase, conv, tenant, payload.message, payload.list_reply_id);
      break;

    case STATE.BOOKING_TIME:
      await handleBookingTime(supabase, conv, tenant, payload.message, payload.list_reply_id);
      break;

    case STATE.BOOKING_CONFIRM:
      await handleBookingConfirm(supabase, conv, tenant, settings, payload.message, payload.button_payload);
      break;

    case STATE.CANCEL_SELECT:
      await handleCancelSelect(supabase, conv, tenant, payload.message, payload.list_reply_id);
      break;

    case STATE.CANCEL_CONFIRM:
      await handleCancelConfirm(supabase, conv, tenant, payload.message, payload.button_payload);
      break;

    case STATE.WAITING_HUMAN:
      // Don't auto-reply, let human handle
      // Check if keyword to return to bot
      if (msgLower === "bot" || msgLower === "robô" || msgLower === "robo") {
        await updateConversation(supabase, conv.id, STATE.IDLE, {});
        await handleIdle(supabase, conv, tenant, settings, payload.message);
      }
      return { handled: true, state: STATE.WAITING_HUMAN };

    default:
      await updateConversation(supabase, conv.id, STATE.IDLE, {});
      await handleIdle(supabase, conv, tenant, settings, payload.message);
  }

  return { handled: true, state: conv.state };
}

// ─── Serve ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Webhook verification (for Meta Cloud API)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200, headers: cors });
    }
    return new Response("Forbidden", { status: 403, headers: cors });
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
    return new Response(JSON.stringify({ error: "Servidor não configurado" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();

    // Handle Evolution API webhook format
    if (body.event === "messages.upsert" && body.data?.message) {
      const tenantId = body.instance?.instanceName
        ? await resolveTenantByInstance(supabase, body.instance.instanceName)
        : null;

      if (!tenantId) {
        log("Unknown instance", { instance: body.instance?.instanceName });
        return new Response(JSON.stringify({ ok: true, skipped: "unknown_instance" }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const msg = body.data.message;
      const key = body.data.key;

      // Ignorar mensagens enviadas por nós (fromMe)
      if (key?.fromMe) {
        return new Response(JSON.stringify({ ok: true, skipped: "from_me" }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const phone = key?.remoteJid?.replace("@s.whatsapp.net", "") ?? "";
      const text = msg?.conversation ?? msg?.extendedTextMessage?.text ?? "";
      const buttonPayload = msg?.buttonsResponseMessage?.selectedButtonId ?? msg?.templateButtonReplyMessage?.selectedId ?? undefined;
      const listReplyId = msg?.listResponseMessage?.singleSelectReply?.selectedRowId ?? undefined;

      if (!phone || (!text && !buttonPayload && !listReplyId)) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_content" }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const result = await processMessage(supabase, {
        tenant_id: tenantId,
        phone,
        message: text || buttonPayload || listReplyId || "",
        message_id: key?.id,
        message_type: buttonPayload ? "button" : listReplyId ? "list_reply" : "text",
        button_payload: buttonPayload,
        list_reply_id: listReplyId,
      });

      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Handle Meta Cloud API webhook format
    if (body.object === "whatsapp_business_account" && body.entry) {
      for (const entry of body.entry) {
        for (const change of entry.changes ?? []) {
          const messages = change.value?.messages ?? [];
          for (const msg of messages) {
            const phone = msg.from;
            const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
            const buttonPayload = msg.button?.payload ?? msg.interactive?.button_reply?.id ?? undefined;
            const listReplyId = msg.interactive?.list_reply?.id ?? undefined;
            const phoneNumberId = change.value?.metadata?.phone_number_id;

            const tenantId = phoneNumberId
              ? await resolveTenantByPhoneNumberId(supabase, phoneNumberId)
              : null;

            if (!tenantId || !phone) continue;

            await processMessage(supabase, {
              tenant_id: tenantId,
              phone,
              message: text,
              message_id: msg.id,
              message_type: msg.type,
              button_payload: buttonPayload,
              list_reply_id: listReplyId,
            });
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Handle direct API call format (internal)
    if (body.tenant_id && body.phone && body.message) {
      const result = await processMessage(supabase, body as IncomingWebhook);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, skipped: "unrecognized_format" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Exception", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ─── Resolvers de Tenant ────────────────────────────────────────────────────

async function resolveTenantByInstance(supabase: SupabaseClient, instanceName: string): Promise<string | null> {
  const { data } = (await supabase
    .from("tenants")
    .select("id")
    .eq("whatsapp_instance", instanceName)
    .maybeSingle()) as unknown as SelectResult<{ id: string } | null>;
  return data?.id ?? null;
}

async function resolveTenantByPhoneNumberId(supabase: SupabaseClient, phoneNumberId: string): Promise<string | null> {
  // For Meta Cloud API, the phone_number_id maps to a tenant config
  const { data } = (await supabase
    .from("tenants")
    .select("id")
    .eq("whatsapp_instance", phoneNumberId)
    .maybeSingle()) as unknown as SelectResult<{ id: string } | null>;
  return data?.id ?? null;
}
