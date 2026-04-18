/**
 * whatsapp-chatbot — Cloud Run handler (Enterprise)
 *
 * Patient-facing chatbot for WhatsApp using Meta Cloud API.
 * Features: session timeout, message dedup, cancel/reschedule, N+1 fix.
 *
 * Webhook:
 *   GET  /api/webhooks/whatsapp-chatbot → Meta verification
 *   POST /api/webhooks/whatsapp-chatbot → Incoming messages
 */

import { Request, Response } from "express";
import { createLogger } from "../shared/logging";
import { createDbClient } from "../shared/db-builder";
import {
  sendMetaWhatsAppMessage,
  sendMetaWhatsAppButtons,
  sendMetaWhatsAppList,
  markMessageAsRead,
} from "./whatsapp-sender";

const log = createLogger("WHATSAPP-CHATBOT");
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
const SESSION_TIMEOUT_MIN = 30;
const processedMessages = new Set<string>();
const DEDUP_MAX = 5000;

// ─── Types ──────────────────────────────────────────────────────────────

type TenantConfig = {
  id: string;
  name: string;
  whatsapp_phone_number_id: string;
  whatsapp_access_token: string;
  whatsapp_business_account_id: string;
};

type ChatbotSettings = {
  is_active: boolean;
  welcome_message: string;
  menu_message: string;
  outside_hours_message: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  auto_confirm_booking: boolean;
  max_future_days: number;
  transfer_to_human_message?: string;
};

type ConversationState = {
  id: string;
  tenant_id: string;
  phone: string;
  state: string;
  context: Record<string, unknown>;
  updated_at: string;
};

type SelectResult<T> = { data: T; error: unknown };

// ─── States ─────────────────────────────────────────────────────────────

const STATE = {
  IDLE: "IDLE",
  MENU: "MENU",
  BOOKING_SPECIALTY: "BOOKING_SPECIALTY",
  BOOKING_PROFESSIONAL: "BOOKING_PROFESSIONAL",
  BOOKING_DATE: "BOOKING_DATE",
  BOOKING_TIME: "BOOKING_TIME",
  BOOKING_CONFIRM: "BOOKING_CONFIRM",
  RESCHEDULE_LIST: "RESCHEDULE_LIST",
  RESCHEDULE_DATE: "RESCHEDULE_DATE",
  RESCHEDULE_TIME: "RESCHEDULE_TIME",
  RESCHEDULE_CONFIRM: "RESCHEDULE_CONFIRM",
  CANCEL_LIST: "CANCEL_LIST",
  CANCEL_CONFIRM: "CANCEL_CONFIRM",
  QUEUE_CHECK: "QUEUE_CHECK",
  AWAITING_HUMAN: "AWAITING_HUMAN",
};

// ─── DB helpers ─────────────────────────────────────────────────────────

function db() {
  return createDbClient();
}

async function resolveTenantByPhoneNumberId(
  phoneNumberId: string,
): Promise<TenantConfig | null> {
  const { data } = (await db()
    .from("tenants")
    .select(
      "id, name, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_business_account_id",
    )
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .maybeSingle()) as unknown as SelectResult<TenantConfig | null>;
  return data;
}

async function getSettings(
  tenantId: string,
): Promise<ChatbotSettings | null> {
  const { data } = (await db()
    .from("chatbot_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle()) as unknown as SelectResult<ChatbotSettings | null>;
  return data;
}

async function getConversation(
  tenantId: string,
  phone: string,
): Promise<ConversationState | null> {
  const { data } = (await db()
    .from("chatbot_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle()) as unknown as SelectResult<ConversationState | null>;
  return data;
}

async function upsertConversation(
  tenantId: string,
  phone: string,
  state: string,
  context: Record<string, unknown>,
) {
  await db()
    .from("chatbot_conversations")
    .upsert(
      {
        tenant_id: tenantId,
        phone,
        state,
        context,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,phone" },
    );
}

async function logMessage(
  tenantId: string,
  phone: string,
  direction: "inbound" | "outbound",
  text: string,
) {
  await db()
    .from("chatbot_messages")
    .insert({
      tenant_id: tenantId,
      phone,
      direction,
      message: text,
      created_at: new Date().toISOString(),
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isWithinBusinessHours(
  settings: ChatbotSettings,
  tzOffset = -3,
): boolean {
  const now = new Date();
  const local = new Date(now.getTime() + tzOffset * 60 * 60_000);
  const dow = local.getUTCDay();

  if (settings.business_days && settings.business_days.length > 0) {
    if (!settings.business_days.includes(dow)) return false;
  } else {
    if (dow === 0) return false;
  }

  const hhmm = local.getUTCHours() * 100 + local.getUTCMinutes();
  const [sH, sM] = (settings.business_hours_start || "08:00")
    .split(":")
    .map(Number);
  const [eH, eM] = (settings.business_hours_end || "18:00")
    .split(":")
    .map(Number);
  return hhmm >= sH * 100 + sM && hhmm <= eH * 100 + eM;
}

function isSessionExpired(conv: ConversationState | null): boolean {
  if (!conv) return true;
  const mins =
    (Date.now() - new Date(conv.updated_at).getTime()) / 60_000;
  return mins > SESSION_TIMEOUT_MIN;
}

// ─── Send wrappers ──────────────────────────────────────────────────────

async function send(
  config: TenantConfig,
  to: string,
  text: string,
) {
  await sendMetaWhatsAppMessage(
    config.whatsapp_phone_number_id,
    config.whatsapp_access_token,
    to,
    text,
  );
  await logMessage(config.id, to, "outbound", text);
}

async function sendButtons(
  config: TenantConfig,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
) {
  await sendMetaWhatsAppButtons(
    config.whatsapp_phone_number_id,
    config.whatsapp_access_token,
    to,
    bodyText,
    buttons,
    headerText,
  );
  await logMessage(config.id, to, "outbound", bodyText);
}

async function sendList(
  config: TenantConfig,
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
) {
  await sendMetaWhatsAppList(
    config.whatsapp_phone_number_id,
    config.whatsapp_access_token,
    to,
    headerText,
    bodyText,
    buttonText,
    sections,
  );
  await logMessage(config.id, to, "outbound", bodyText);
}

// ─── State handlers ─────────────────────────────────────────────────────

async function handleIdle(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
  _text: string,
) {
  const welcome =
    settings.welcome_message ||
    `Ol\u00e1! \uD83D\uDC4B Bem-vindo(a) \u00e0 *${config.name}*.`;
  await send(config, phone, welcome);
  await showMainMenu(config, settings, phone);
  await upsertConversation(config.id, phone, STATE.MENU, {});
}

async function showMainMenu(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
) {
  const menuText = settings.menu_message || "Como posso ajud\u00e1-lo(a)?";
  await sendButtons(config, phone, menuText, [
    { id: "menu_agendar", title: "\uD83D\uDCC5 Agendar consulta" },
    { id: "menu_consultas", title: "\uD83D\uDCCB Minhas consultas" },
    { id: "menu_atendente", title: "\uD83D\uDC64 Falar c/ atendente" },
  ]);
}

async function handleMenu(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
  text: string,
  buttonId: string | null,
) {
  const choice = buttonId || text.toLowerCase().trim();

  if (
    choice === "menu_agendar" ||
    choice.includes("agendar") ||
    choice === "1"
  ) {
    return startBooking(config, phone, settings);
  }
  if (
    choice === "menu_consultas" ||
    choice.includes("consulta") ||
    choice === "2"
  ) {
    return showAppointments(config, settings, phone);
  }
  if (
    choice === "menu_atendente" ||
    choice.includes("atendente") ||
    choice.includes("humano") ||
    choice === "3"
  ) {
    return transferToHuman(config, settings, phone);
  }

  await send(
    config,
    phone,
    "Desculpe, n\u00e3o entendi. Por favor, selecione uma das op\u00e7\u00f5es:",
  );
  await showMainMenu(config, settings, phone);
}

// ─── Booking flow ───────────────────────────────────────────────────────

async function startBooking(
  config: TenantConfig,
  phone: string,
  settings?: ChatbotSettings,
) {
  const { data: specialties } = (await db()
    .from("professionals")
    .select("specialty")
    .eq("tenant_id", config.id)
    .eq("is_active", true)) as unknown as SelectResult<
    Array<{ specialty: string }> | null
  >;

  const unique = [
    ...new Set(
      (specialties || []).map((s) => s.specialty).filter(Boolean),
    ),
  ];

  if (unique.length === 0) {
    await send(
      config,
      phone,
      "No momento n\u00e3o h\u00e1 especialidades dispon\u00edveis para agendamento.",
    );
    const s = settings || ((await getSettings(config.id)) as ChatbotSettings);
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return showMainMenu(config, s, phone);
  }

  const sections = [
    {
      title: "Especialidades",
      rows: unique.map((s, i) => ({
        id: `spec_${i}`,
        title: s.slice(0, 24),
      })),
    },
  ];

  await sendList(
    config,
    phone,
    "Agendamento",
    "Selecione a especialidade desejada:",
    "Ver especialidades",
    sections,
  );
  await upsertConversation(config.id, phone, STATE.BOOKING_SPECIALTY, {
    specialties: unique,
  });
}

async function handleBookingSpecialty(
  config: TenantConfig,
  phone: string,
  text: string,
  listRowId: string | null,
  ctx: Record<string, unknown>,
) {
  const specialties = (ctx.specialties as string[]) || [];
  let selected: string | null = null;

  if (listRowId && listRowId.startsWith("spec_")) {
    const idx = parseInt(listRowId.replace("spec_", ""), 10);
    selected = specialties[idx] ?? null;
  } else {
    const num = parseInt(text, 10);
    if (num >= 1 && num <= specialties.length) {
      selected = specialties[num - 1];
    } else {
      selected =
        specialties.find((s) =>
          s.toLowerCase().includes(text.toLowerCase()),
        ) ?? null;
    }
  }

  if (!selected) {
    await send(
      config,
      phone,
      "Especialidade n\u00e3o reconhecida. Tente novamente ou digite *menu*.",
    );
    return;
  }

  const { data: professionals } = (await db()
    .from("professionals")
    .select("id, full_name")
    .eq("tenant_id", config.id)
    .eq("specialty", selected)
    .eq("is_active", true)) as unknown as SelectResult<
    Array<{ id: string; full_name: string }> | null
  >;

  if (!professionals || professionals.length === 0) {
    await send(
      config,
      phone,
      "N\u00e3o h\u00e1 profissionais dispon\u00edveis nesta especialidade.",
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return;
  }

  if (professionals.length === 1) {
    const s = await getSettings(config.id);
    return showAvailableDates(
      config,
      phone,
      selected,
      professionals[0].id,
      professionals[0].full_name,
      s?.max_future_days,
      s?.business_days,
    );
  }

  const sections = [
    {
      title: "Profissionais",
      rows: professionals.map((p) => ({
        id: `prof_${p.id}`,
        title: p.full_name.slice(0, 24),
      })),
    },
  ];

  await sendList(
    config,
    phone,
    selected,
    "Selecione o profissional:",
    "Ver profissionais",
    sections,
  );
  await upsertConversation(config.id, phone, STATE.BOOKING_PROFESSIONAL, {
    specialty: selected,
    professionals,
  });
}

async function handleBookingProfessional(
  config: TenantConfig,
  phone: string,
  text: string,
  listRowId: string | null,
  ctx: Record<string, unknown>,
) {
  const professionals =
    (ctx.professionals as Array<{ id: string; full_name: string }>) || [];
  let selected: { id: string; full_name: string } | null = null;

  if (listRowId && listRowId.startsWith("prof_")) {
    const profId = listRowId.replace("prof_", "");
    selected = professionals.find((p) => p.id === profId) ?? null;
  } else {
    const num = parseInt(text, 10);
    if (num >= 1 && num <= professionals.length) {
      selected = professionals[num - 1];
    } else {
      selected =
        professionals.find((p) =>
          p.full_name.toLowerCase().includes(text.toLowerCase()),
        ) ?? null;
    }
  }

  if (!selected) {
    await send(config, phone, "Profissional n\u00e3o reconhecido. Tente novamente.");
    return;
  }

  const s = await getSettings(config.id);
  return showAvailableDates(
    config,
    phone,
    ctx.specialty as string,
    selected.id,
    selected.full_name,
    s?.max_future_days,
    s?.business_days,
  );
}

async function showAvailableDates(
  config: TenantConfig,
  phone: string,
  specialty: string,
  professionalId: string,
  professionalName: string,
  maxDays?: number,
  businessDays?: number[],
) {
  const lookAhead = maxDays || 14;
  const now = new Date();
  const startDate = new Date(now.getTime() + 86_400_000);
  const endDate = new Date(now.getTime() + lookAhead * 86_400_000);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Single query for all dates (N+1 fix)
  const { data: availableSlots } = (await db()
    .from("appointment_slots")
    .select("date")
    .eq("tenant_id", config.id)
    .eq("professional_id", professionalId)
    .eq("is_available", true)
    .gte("date", startStr)
    .lte("date", endStr)) as unknown as SelectResult<
    Array<{ date: string }> | null
  >;

  const skipDays = new Set(
    businessDays && businessDays.length > 0
      ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !businessDays.includes(d))
      : [0],
  );

  const dates = [
    ...new Set((availableSlots || []).map((s) => s.date)),
  ]
    .filter((d) => {
      const dow = new Date(d + "T12:00:00Z").getUTCDay();
      return !skipDays.has(dow);
    })
    .sort()
    .slice(0, 10);

  if (dates.length === 0) {
    await send(
      config,
      phone,
      `Infelizmente n\u00e3o h\u00e1 hor\u00e1rios dispon\u00edveis com *${professionalName}* nos pr\u00f3ximos dias.`,
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return;
  }

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\u00e1b"];
    return `${weekdays[date.getDay()]} ${day}/${m}`;
  };

  const sections = [
    {
      title: "Datas dispon\u00edveis",
      rows: dates.map((d) => ({
        id: `date_${d}`,
        title: formatDate(d),
      })),
    },
  ];

  await sendList(
    config,
    phone,
    `Agenda - ${professionalName}`,
    "Selecione a data desejada:",
    "Ver datas",
    sections,
  );

  await upsertConversation(config.id, phone, STATE.BOOKING_DATE, {
    specialty,
    professional_id: professionalId,
    professional_name: professionalName,
    available_dates: dates,
  });
}

async function handleBookingDate(
  config: TenantConfig,
  phone: string,
  text: string,
  listRowId: string | null,
  ctx: Record<string, unknown>,
) {
  const dates = (ctx.available_dates as string[]) || [];
  let selectedDate: string | null = null;

  if (listRowId && listRowId.startsWith("date_")) {
    selectedDate = listRowId.replace("date_", "");
  } else {
    const num = parseInt(text, 10);
    if (num >= 1 && num <= dates.length) {
      selectedDate = dates[num - 1];
    }
  }

  if (!selectedDate || !dates.includes(selectedDate)) {
    await send(
      config,
      phone,
      "Data n\u00e3o reconhecida. Por favor, selecione uma das datas na lista.",
    );
    return;
  }

  const { data: slots } = (await db()
    .from("appointment_slots")
    .select("id, start_time")
    .eq("tenant_id", config.id)
    .eq("professional_id", ctx.professional_id as string)
    .eq("date", selectedDate)
    .eq("is_available", true)
    .order("start_time", {
      ascending: true,
    })) as unknown as SelectResult<
    Array<{ id: string; start_time: string }> | null
  >;

  if (!slots || slots.length === 0) {
    await send(
      config,
      phone,
      "Desculpe, os hor\u00e1rios para esta data j\u00e1 foram preenchidos. Escolha outra data.",
    );
    return;
  }

  const sections = [
    {
      title: "Hor\u00e1rios",
      rows: slots.map((s) => ({
        id: `slot_${s.id}`,
        title: s.start_time.slice(0, 5),
      })),
    },
  ];

  await sendList(
    config,
    phone,
    `Hor\u00e1rios - ${selectedDate.split("-").reverse().join("/")}`,
    `Profissional: *${ctx.professional_name}*\nSelecione o hor\u00e1rio:`,
    "Ver hor\u00e1rios",
    sections,
  );

  await upsertConversation(config.id, phone, STATE.BOOKING_TIME, {
    ...ctx,
    selected_date: selectedDate,
    available_slots: slots,
  });
}

async function handleBookingTime(
  config: TenantConfig,
  phone: string,
  text: string,
  listRowId: string | null,
  ctx: Record<string, unknown>,
) {
  const slots =
    (ctx.available_slots as Array<{ id: string; start_time: string }>) || [];
  let selectedSlot: { id: string; start_time: string } | null = null;

  if (listRowId && listRowId.startsWith("slot_")) {
    const slotId = listRowId.replace("slot_", "");
    selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  } else {
    const num = parseInt(text, 10);
    if (num >= 1 && num <= slots.length) {
      selectedSlot = slots[num - 1];
    } else {
      selectedSlot =
        slots.find((s) => s.start_time.startsWith(text.trim())) ?? null;
    }
  }

  if (!selectedSlot) {
    await send(
      config,
      phone,
      "Hor\u00e1rio n\u00e3o reconhecido. Selecione um hor\u00e1rio da lista.",
    );
    return;
  }

  const dateFormatted = (ctx.selected_date as string)
    .split("-")
    .reverse()
    .join("/");

  await sendButtons(
    config,
    phone,
    `*Confirmar agendamento:*\n\n\uD83D\uDCC5 Data: ${dateFormatted}\n\u23F0 Hor\u00e1rio: ${selectedSlot.start_time.slice(0, 5)}\n\uD83D\uDC68\u200D\u2695\uFE0F Profissional: ${ctx.professional_name}\n\uD83C\uDFE5 Especialidade: ${ctx.specialty}`,
    [
      { id: "confirm_yes", title: "\u2705 Confirmar" },
      { id: "confirm_no", title: "\u274C Cancelar" },
    ],
  );

  await upsertConversation(config.id, phone, STATE.BOOKING_CONFIRM, {
    ...ctx,
    selected_slot_id: selectedSlot.id,
    selected_time: selectedSlot.start_time,
  });
}

async function handleBookingConfirm(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
  text: string,
  buttonId: string | null,
) {
  const conv = await getConversation(config.id, phone);
  const ctx = conv?.context || {};
  const choice = buttonId || text.toLowerCase().trim();

  if (
    choice === "confirm_no" ||
    choice.includes("cancelar") ||
    choice.includes("n\u00e3o")
  ) {
    await send(config, phone, "Agendamento cancelado. Voltando ao menu.");
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return showMainMenu(config, settings, phone);
  }

  if (
    choice !== "confirm_yes" &&
    !choice.includes("sim") &&
    !choice.includes("confirm")
  ) {
    await send(config, phone, "Responda *Confirmar* ou *Cancelar*.");
    return;
  }

  // Find or create patient
  let { data: patient } = (await db()
    .from("patients")
    .select("id, full_name")
    .eq("tenant_id", config.id)
    .eq("phone", phone)
    .maybeSingle()) as unknown as SelectResult<{
    id: string;
    full_name: string;
  } | null>;

  if (!patient) {
    const suffix = phone.slice(-4);
    const { data: newPatient } = (await db()
      .from("patients")
      .insert({
        tenant_id: config.id,
        phone,
        full_name: `Paciente WA *${suffix}`,
        source: "whatsapp_chatbot",
      })
      .select("id, full_name")
      .single()) as unknown as SelectResult<{
      id: string;
      full_name: string;
    }>;
    patient = newPatient;
  }

  if (!patient) {
    await send(
      config,
      phone,
      "Desculpe, ocorreu um erro. Por favor, tente novamente.",
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return;
  }

  const status = settings.auto_confirm_booking ? "confirmed" : "pending";
  const { error } = await db()
    .from("appointments")
    .insert({
      tenant_id: config.id,
      patient_id: patient.id,
      professional_id: ctx.professional_id,
      date: ctx.selected_date,
      start_time: ctx.selected_time,
      status,
      source: "whatsapp_chatbot",
      notes: "Agendado via WhatsApp chatbot",
    });

  if (error) {
    log("Booking error", { error });
    await send(
      config,
      phone,
      "Desculpe, ocorreu um erro ao agendar. O hor\u00e1rio pode j\u00e1 ter sido preenchido.",
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return showMainMenu(config, settings, phone);
  }

  if (ctx.selected_slot_id) {
    await db()
      .from("appointment_slots")
      .update({ is_available: false })
      .eq("id", ctx.selected_slot_id);
  }

  const dateF = (ctx.selected_date as string).split("-").reverse().join("/");
  const statusText = settings.auto_confirm_booking
    ? "\u2705 *Consulta confirmada!*"
    : "\u23F3 *Consulta solicitada!* Aguarde a confirma\u00e7\u00e3o da cl\u00ednica.";

  await send(
    config,
    phone,
    `${statusText}\n\n\uD83D\uDCC5 ${dateF} \u00e0s ${(ctx.selected_time as string).slice(0, 5)}\n\uD83D\uDC68\u200D\u2695\uFE0F ${ctx.professional_name}\n\nCaso precise cancelar ou remarcar, entre em contato conosco.`,
  );
  await upsertConversation(config.id, phone, STATE.IDLE, {});
}

// ─── Appointments listing ───────────────────────────────────────────────

async function showAppointments(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
) {
  const { data: patient } = (await db()
    .from("patients")
    .select("id")
    .eq("tenant_id", config.id)
    .eq("phone", phone)
    .maybeSingle()) as unknown as SelectResult<{ id: string } | null>;

  if (!patient) {
    await send(
      config,
      phone,
      "N\u00e3o encontramos consultas agendadas para este n\u00famero.",
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: appointments } = (await db()
    .from("appointments")
    .select("id, date, start_time, status, professionals(full_name)")
    .eq("tenant_id", config.id)
    .eq("patient_id", patient.id)
    .gte("date", today)
    .in("status", ["confirmed", "pending"])
    .order("date", { ascending: true })
    .limit(5)) as unknown as SelectResult<
    Array<{
      id: string;
      date: string;
      start_time: string;
      status: string;
      professionals: { full_name: string } | null;
    }> | null
  >;

  if (!appointments || appointments.length === 0) {
    await send(
      config,
      phone,
      "Voc\u00ea n\u00e3o tem consultas futuras agendadas.",
    );
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return;
  }

  let msg = "*Suas pr\u00f3ximas consultas:*\n\n";
  appointments.forEach((a, i) => {
    const dateF = a.date.split("-").reverse().join("/");
    const profName = a.professionals?.full_name || "A definir";
    const emoji = a.status === "confirmed" ? "\u2705" : "\u23F3";
    msg += `${i + 1}. ${emoji} ${dateF} \u00e0s ${a.start_time.slice(0, 5)} - ${profName}\n`;
  });

  await send(config, phone, msg);

  await sendButtons(config, phone, "O que deseja fazer?", [
    { id: "apt_remarcar", title: "\uD83D\uDD04 Remarcar" },
    { id: "apt_cancelar", title: "\u274C Cancelar consulta" },
    { id: "apt_voltar", title: "\u25C0\uFE0F Voltar ao menu" },
  ]);

  await upsertConversation(config.id, phone, STATE.RESCHEDULE_LIST, {
    appointments: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      start_time: a.start_time,
    })),
  });
}

// ─── Cancel & Reschedule ────────────────────────────────────────────────

async function handleRescheduleList(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
  text: string,
  buttonId: string | null,
) {
  const choice = buttonId || text.toLowerCase().trim();

  if (
    choice === "apt_voltar" ||
    choice.includes("voltar") ||
    choice.includes("menu")
  ) {
    await upsertConversation(config.id, phone, STATE.MENU, {});
    return showMainMenu(config, settings, phone);
  }

  const conv = await getConversation(config.id, phone);
  const ctx = conv?.context || {};
  const apts =
    (ctx.appointments as Array<{
      id: string;
      date: string;
      start_time: string;
    }>) || [];

  if (choice === "apt_cancelar" || choice.includes("cancelar")) {
    if (apts.length === 0) {
      await send(
        config,
        phone,
        "N\u00e3o encontrei consultas para cancelar.",
      );
      await upsertConversation(config.id, phone, STATE.MENU, {});
      return showMainMenu(config, settings, phone);
    }
    if (apts.length === 1) {
      await db()
        .from("appointments")
        .update({
          status: "cancelled_by_patient",
          updated_at: new Date().toISOString(),
        })
        .eq("id", apts[0].id);
      const dateF = apts[0].date.split("-").reverse().join("/");
      await send(
        config,
        phone,
        `\u2705 Consulta de ${dateF} \u00e0s ${apts[0].start_time.slice(0, 5)} cancelada com sucesso.`,
      );
      await upsertConversation(config.id, phone, STATE.MENU, {});
      return showMainMenu(config, settings, phone);
    }
    await send(
      config,
      phone,
      "Qual consulta deseja cancelar? Responda com o n\u00famero (ex: 1, 2...)",
    );
    await upsertConversation(config.id, phone, STATE.CANCEL_CONFIRM, ctx);
    return;
  }

  if (choice === "apt_remarcar" || choice.includes("remarcar")) {
    if (apts.length === 0) {
      await send(
        config,
        phone,
        "N\u00e3o encontrei consultas para remarcar.",
      );
      await upsertConversation(config.id, phone, STATE.MENU, {});
      return showMainMenu(config, settings, phone);
    }
    if (apts.length === 1) {
      await db()
        .from("appointments")
        .update({
          status: "cancelled_by_patient",
          updated_at: new Date().toISOString(),
        })
        .eq("id", apts[0].id);
      const dateF = apts[0].date.split("-").reverse().join("/");
      await send(
        config,
        phone,
        `\uD83D\uDD04 Consulta de ${dateF} cancelada. Vamos agendar uma nova!`,
      );
      return startBooking(config, phone, settings);
    }
    await send(
      config,
      phone,
      "Qual consulta deseja remarcar? Responda com o n\u00famero (ex: 1, 2...)",
    );
    await upsertConversation(config.id, phone, STATE.RESCHEDULE_CONFIRM, {
      ...ctx,
      action: "reschedule",
    });
    return;
  }

  await send(config, phone, "Op\u00e7\u00e3o n\u00e3o reconhecida.");
  await upsertConversation(config.id, phone, STATE.MENU, {});
  return showMainMenu(config, settings, phone);
}

// ─── Transfer to human ──────────────────────────────────────────────────

async function transferToHuman(
  config: TenantConfig,
  settings: ChatbotSettings,
  phone: string,
) {
  const msg =
    settings.transfer_to_human_message ||
    "Estamos transferindo voc\u00ea para um atendente. Aguarde, por favor. \uD83D\uDE4F";
  await send(config, phone, msg);
  await upsertConversation(config.id, phone, STATE.AWAITING_HUMAN, {});

  await db()
    .from("notifications")
    .insert({
      tenant_id: config.id,
      type: "whatsapp_transfer",
      title: "Paciente solicitou atendente",
      message: `Paciente (${phone}) solicitou falar com atendente via WhatsApp.`,
      is_read: false,
    });
}

// ─── Message router ─────────────────────────────────────────────────────

async function processMessage(
  config: TenantConfig,
  phone: string,
  text: string,
  buttonId: string | null,
  listRowId: string | null,
) {
  const settings = await getSettings(config.id);
  if (!settings || !settings.is_active) {
    log("Chatbot disabled for tenant", { tenantId: config.id });
    return;
  }

  await logMessage(config.id, phone, "inbound", text);

  const lower = text.toLowerCase().trim();
  if (
    lower === "menu" ||
    lower === "voltar" ||
    lower === "inicio" ||
    lower === "in\u00edcio"
  ) {
    await upsertConversation(config.id, phone, STATE.IDLE, {});
    return handleIdle(config, settings, phone, text);
  }

  if (!isWithinBusinessHours(settings) && lower !== "menu") {
    const conv = await getConversation(config.id, phone);
    if (!conv || conv.state === STATE.IDLE) {
      await send(config, phone, settings.outside_hours_message);
      await upsertConversation(config.id, phone, STATE.IDLE, {});
      return;
    }
  }

  const conv = await getConversation(config.id, phone);

  if (
    conv &&
    conv.state !== STATE.IDLE &&
    conv.state !== STATE.AWAITING_HUMAN &&
    isSessionExpired(conv)
  ) {
    log("Session expired, resetting", { phone, state: conv.state });
    await upsertConversation(config.id, phone, STATE.IDLE, {});
    return handleIdle(config, settings, phone, text);
  }

  const currentState = conv?.state || STATE.IDLE;
  const ctx = conv?.context || {};

  switch (currentState) {
    case STATE.IDLE:
      return handleIdle(config, settings, phone, text);

    case STATE.MENU:
      return handleMenu(config, settings, phone, text, buttonId);

    case STATE.BOOKING_SPECIALTY:
      return handleBookingSpecialty(config, phone, text, listRowId, ctx);

    case STATE.BOOKING_PROFESSIONAL:
      return handleBookingProfessional(
        config,
        phone,
        text,
        listRowId,
        ctx,
      );

    case STATE.BOOKING_DATE:
      return handleBookingDate(config, phone, text, listRowId, ctx);

    case STATE.BOOKING_TIME:
      return handleBookingTime(config, phone, text, listRowId, ctx);

    case STATE.BOOKING_CONFIRM:
      return handleBookingConfirm(config, settings, phone, text, buttonId);

    case STATE.RESCHEDULE_LIST:
      return handleRescheduleList(
        config,
        settings,
        phone,
        text,
        buttonId,
      );

    case STATE.RESCHEDULE_CONFIRM: {
      const apts =
        (ctx.appointments as Array<{
          id: string;
          date: string;
          start_time: string;
        }>) || [];
      const num = parseInt(text, 10);
      if (num >= 1 && num <= apts.length) {
        const apt = apts[num - 1];
        await db()
          .from("appointments")
          .update({
            status: "cancelled_by_patient",
            updated_at: new Date().toISOString(),
          })
          .eq("id", apt.id);
        const dateF = apt.date.split("-").reverse().join("/");
        await send(
          config,
          phone,
          `\uD83D\uDD04 Consulta de ${dateF} cancelada. Vamos agendar uma nova!`,
        );
        return startBooking(config, phone, settings);
      }
      await send(
        config,
        phone,
        "N\u00famero inv\u00e1lido. Opera\u00e7\u00e3o cancelada.",
      );
      await upsertConversation(config.id, phone, STATE.MENU, {});
      return showMainMenu(config, settings, phone);
    }

    case STATE.CANCEL_CONFIRM: {
      const apts =
        (ctx.appointments as Array<{
          id: string;
          date: string;
          start_time: string;
        }>) || [];
      const num = parseInt(text, 10);
      if (num >= 1 && num <= apts.length) {
        const apt = apts[num - 1];
        await db()
          .from("appointments")
          .update({
            status: "cancelled_by_patient",
            updated_at: new Date().toISOString(),
          })
          .eq("id", apt.id);
        const dateF = apt.date.split("-").reverse().join("/");
        await send(
          config,
          phone,
          `\u2705 Consulta de ${dateF} \u00e0s ${apt.start_time.slice(0, 5)} cancelada com sucesso.`,
        );
      } else {
        await send(
          config,
          phone,
          "N\u00famero inv\u00e1lido. Opera\u00e7\u00e3o cancelada.",
        );
      }
      await upsertConversation(config.id, phone, STATE.MENU, {});
      return showMainMenu(config, settings, phone);
    }

    case STATE.AWAITING_HUMAN:
      await send(
        config,
        phone,
        "Seu atendimento est\u00e1 na fila. Um atendente responder\u00e1 em breve. \uD83D\uDE4F",
      );
      return;

    default:
      await upsertConversation(config.id, phone, STATE.IDLE, {});
      return handleIdle(config, settings, phone, text);
  }
}

// ─── Webhook Handlers ───────────────────────────────────────────────────

function handleVerification(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    log("Webhook verified");
    return res.status(200).send(challenge);
  }

  log("Webhook verification failed", { mode, token });
  return res.status(403).send("Forbidden");
}

function extractMessageFromWebhook(body: any): {
  phoneNumberId: string;
  from: string;
  text: string;
  messageId: string;
  buttonId: string | null;
  listRowId: string | null;
} | null {
  try {
    if (body?.object !== "whatsapp_business_account") return null;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const metadata = value?.metadata;
    const phoneNumberId = metadata?.phone_number_id;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    const from = msg.from;
    const messageId = msg.id;
    let text = "";
    let buttonId: string | null = null;
    let listRowId: string | null = null;

    switch (msg.type) {
      case "text":
        text = msg.text?.body || "";
        break;
      case "interactive":
        if (msg.interactive?.type === "button_reply") {
          buttonId = msg.interactive.button_reply.id;
          text = msg.interactive.button_reply.title || "";
        } else if (msg.interactive?.type === "list_reply") {
          listRowId = msg.interactive.list_reply.id;
          text = msg.interactive.list_reply.title || "";
        }
        break;
      case "button":
        text = msg.button?.text || msg.button?.payload || "";
        buttonId = msg.button?.payload || null;
        break;
      default:
        text = "[m\u00eddia n\u00e3o suportada]";
    }

    if (!phoneNumberId || !from) return null;

    return { phoneNumberId, from, text, messageId, buttonId, listRowId };
  } catch (err) {
    log("extractMessageFromWebhook error", { error: String(err) });
    return null;
  }
}

async function handleIncoming(req: Request, res: Response) {
  res.status(200).json({ status: "ok" });

  try {
    const extracted = extractMessageFromWebhook(req.body);
    if (!extracted) return;

    const { phoneNumberId, from, text, messageId, buttonId, listRowId } =
      extracted;

    // Deduplication
    if (processedMessages.has(messageId)) {
      log("Duplicate message skipped", { messageId });
      return;
    }
    processedMessages.add(messageId);
    if (processedMessages.size > DEDUP_MAX) {
      processedMessages.clear();
    }

    log("Incoming message", {
      phoneNumberId,
      from,
      text: text.slice(0, 50),
    });

    const config = await resolveTenantByPhoneNumberId(phoneNumberId);
    if (!config) {
      log("No tenant found for phone_number_id", { phoneNumberId });
      return;
    }

    markMessageAsRead(
      config.whatsapp_phone_number_id,
      config.whatsapp_access_token,
      messageId,
    ).catch(() => {});

    await processMessage(config, from, text, buttonId, listRowId);
  } catch (err) {
    log("handleIncoming error", { error: String(err) });
  }
}

// ─── Main export ────────────────────────────────────────────────────────

export async function whatsappChatbot(req: Request, res: Response) {
  if (req.method === "GET") {
    return handleVerification(req, res);
  }
  if (req.method === "POST") {
    return handleIncoming(req, res);
  }
  return res.status(405).json({ error: "Method not allowed" });
}
