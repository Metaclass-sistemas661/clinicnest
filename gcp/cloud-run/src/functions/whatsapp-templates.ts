/**
 * whatsapp-templates — Meta WhatsApp Message Template Registry & Management
 *
 * Enterprise template system for ClinicNest.
 * Templates are created on each tenant's WABA during Embedded Signup
 * and used for proactive messages (outside 24h window).
 *
 * Categories:
 *   UTILITY — transactional (confirmations, reminders) — higher delivery
 *   MARKETING — promotional (offers, reactivation) — requires opt-in
 */

import { createLogger } from "../shared/logging";

const log = createLogger("WHATSAPP-TEMPLATES");
const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Template Definitions ───────────────────────────────────────────────

export type TemplateDefinition = {
  name: string;
  category: "UTILITY" | "MARKETING";
  language: string;
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: "TEXT";
    text?: string;
    example?: { body_text?: string[][] };
    buttons?: Array<{
      type: "URL" | "QUICK_REPLY";
      text: string;
      url?: string;
      example?: string[];
    }>;
  }>;
};

/**
 * All system templates. Variables use {{1}}, {{2}} etc. (Meta format).
 * The `name` must be unique per WABA and contain only lowercase, numbers, underscores.
 */
export const SYSTEM_TEMPLATES: TemplateDefinition[] = [
  // ── UTILITY: Appointment Confirmation ──
  {
    name: "clinicnest_appointment_created",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Agendamento Registrado \u2705",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSeu agendamento foi registrado com sucesso.\n\n\uD83D\uDCC5 Data: {{2}}\n\u23F0 Hor\u00e1rio: {{3}}\n\uD83D\uDC68\u200D\u2695\uFE0F Profissional: {{4}}\n\uD83C\uDFE5 {{5}}",
        example: {
          body_text: [
            ["Maria", "15/04/2026", "14:30", "Dr. Jo\u00e3o Silva", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── UTILITY: Appointment Confirmed ──
  {
    name: "clinicnest_appointment_confirmed",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Consulta Confirmada \u2705",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSua consulta foi confirmada.\n\n\uD83D\uDCC5 {{2}} \u00e0s {{3}}\n\uD83D\uDC68\u200D\u2695\uFE0F {{4}}\n\n\uD83C\uDFE5 {{5}}",
        example: {
          body_text: [
            ["Maria", "15/04/2026", "14:30", "Dr. Jo\u00e3o Silva", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── UTILITY: Reminder 24h ──
  {
    name: "clinicnest_reminder_24h",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Lembrete de Consulta \uD83D\uDD14",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSua consulta \u00e9 *amanh\u00e3* \u00e0s {{2}} com {{3}}.\n\n\uD83C\uDFE5 {{4}}\n\nCaso precise reagendar, entre em contato conosco.",
        example: {
          body_text: [
            ["Maria", "14:30", "Dr. Jo\u00e3o Silva", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── UTILITY: Smart Confirmation 4h ──
  {
    name: "clinicnest_smart_confirm_4h",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Confirme sua Consulta \uD83C\uDFE5",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSua consulta \u00e9 *hoje* \u00e0s {{2}}{{3}}.\n\nPor favor, confirme sua presen\u00e7a clicando no bot\u00e3o abaixo.\n\nSe n\u00e3o puder comparecer, avise para liberarmos a vaga.\n\n{{4}}",
        example: {
          body_text: [
            ["Maria", "14:30", " com Dr. Jo\u00e3o", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "\u2705 Confirmar presen\u00e7a",
            url: "https://example.com/confirmar/{{1}}",
            example: ["abc123"],
          },
        ],
      },
    ],
  },

  // ── UTILITY: Smart Confirmation 1h (urgent) ──
  {
    name: "clinicnest_smart_confirm_1h",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "\u26A0\uFE0F \u00DAltima Chamada!",
      },
      {
        type: "BODY",
        text: "{{1}}, sua consulta \u00e9 em *1 hora* (\u00e0s {{2}}).\n\nConfirme agora para garantir seu hor\u00e1rio.\n\nSem confirma\u00e7\u00e3o, a vaga ser\u00e1 liberada para outro paciente.\n\n{{3}}",
        example: {
          body_text: [
            ["Maria", "14:30", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "\u2705 Confirmar AGORA",
            url: "https://example.com/confirmar/{{1}}",
            example: ["abc123"],
          },
        ],
      },
    ],
  },

  // ── UTILITY: Reminder 2h ──
  {
    name: "clinicnest_reminder_2h",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Consulta em 2 horas \u23F0",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSua consulta \u00e9 em *2 horas* (\u00e0s {{2}}) com {{3}}.\n\n\uD83C\uDFE5 {{4}}\n\nEstamos te aguardando!",
        example: {
          body_text: [
            ["Maria", "14:30", "Dr. Jo\u00e3o", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── UTILITY: Appointment Completed (NPS) ──
  {
    name: "clinicnest_appointment_completed",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Obrigado pela visita! \uD83D\uDE4F",
      },
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nObrigado por nos visitar na {{2}}.\n\nSua opini\u00e3o \u00e9 muito importante. Avalie seu atendimento:",
        example: {
          body_text: [
            ["Maria", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "\u2B50 Avaliar atendimento",
            url: "https://example.com/nps/{{1}}",
            example: ["token123"],
          },
        ],
      },
    ],
  },

  // ── UTILITY: Return Reminder ──
  {
    name: "clinicnest_return_reminder",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\n\u00c9 hora do seu retorno na {{2}}.\n\n{{3}}\n\nAgende pelo nosso WhatsApp ou ligue para n\u00f3s. Estamos te esperando! \uD83D\uDE0A",
        example: {
          body_text: [
            ["Maria", "Cl\u00ednica Exemplo", "Motivo: Acompanhamento semestral"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── MARKETING: Birthday ──
  {
    name: "clinicnest_birthday",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Feliz Anivers\u00e1rio! \uD83C\uDF82",
      },
      {
        type: "BODY",
        text: "Parab\u00e9ns, {{1}}! \uD83C\uDF89\n\nA equipe da {{2}} deseja um dia incr\u00edvel para voc\u00ea!\n\n{{3}}",
        example: {
          body_text: [
            ["Maria", "Cl\u00ednica Exemplo", "Temos um presente especial esperando por voc\u00ea!"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── MARKETING: Reactivation (inactive client) ──
  {
    name: "clinicnest_reactivation",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSentimos sua falta na {{2}}. \uD83D\uDE4F\n\nFaz um tempo desde sua \u00faltima visita. Que tal agendar um hor\u00e1rio?\n\n{{3}}",
        example: {
          body_text: [
            ["Maria", "Cl\u00ednica Exemplo", "Estamos com hor\u00e1rios dispon\u00edveis esta semana!"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },

  // ── UTILITY: Consent Signed ──
  {
    name: "clinicnest_consent_signed",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text: "Ol\u00e1 {{1}}!\n\nSeu termo de consentimento na {{2}} foi registrado com sucesso. \u2705\n\nGuarde esta mensagem como comprovante.\n\nEm caso de d\u00favidas, entre em contato conosco.",
        example: {
          body_text: [
            ["Maria", "Cl\u00ednica Exemplo"],
          ],
        },
      },
      {
        type: "FOOTER",
        text: "Enviado via ClinicNest",
      },
    ],
  },
];

// ─── Template Name → Variable Mapping ───────────────────────────────────

/**
 * Maps automation trigger types to the template name and how to fill variables.
 * Each entry: { templateName, mapVars(vars) → string[] }
 *
 * vars available: patient_name, date, time, professional_name, clinic_name,
 *                 nps_link, confirm_link, return_reason
 */
export const TRIGGER_TEMPLATE_MAP: Record<
  string,
  {
    templateName: string;
    mapVars: (vars: Record<string, string>) => string[];
    buttonVars?: (vars: Record<string, string>) => string[][];
  }
> = {
  appointment_created: {
    templateName: "clinicnest_appointment_created",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.date || "",
      v.time || "",
      v.professional_name || "A definir",
      v.clinic_name || "",
    ],
  },
  appointment_confirmed: {
    templateName: "clinicnest_appointment_confirmed",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.date || "",
      v.time || "",
      v.professional_name || "A definir",
      v.clinic_name || "",
    ],
  },
  appointment_reminder_24h: {
    templateName: "clinicnest_reminder_24h",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.time || "",
      v.professional_name || "A definir",
      v.clinic_name || "",
    ],
  },
  appointment_reminder_2h: {
    templateName: "clinicnest_reminder_2h",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.time || "",
      v.professional_name || "A definir",
      v.clinic_name || "",
    ],
  },
  appointment_completed: {
    templateName: "clinicnest_appointment_completed",
    mapVars: (v) => [v.patient_name || "Paciente", v.clinic_name || ""],
    buttonVars: (v) => [[v.nps_link?.replace(/^https?:\/\/[^/]+/, "") || "/nps"]],
  },
  birthday: {
    templateName: "clinicnest_birthday",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.clinic_name || "",
      v.custom_message || "Temos um presente especial esperando por voc\u00ea!",
    ],
  },
  client_inactive_days: {
    templateName: "clinicnest_reactivation",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.clinic_name || "",
      v.custom_message || "Estamos com hor\u00e1rios dispon\u00edveis!",
    ],
  },
  return_reminder: {
    templateName: "clinicnest_return_reminder",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.clinic_name || "",
      v.return_reason ? `Motivo: ${v.return_reason}` : "Agende seu retorno",
    ],
  },
  consent_signed: {
    templateName: "clinicnest_consent_signed",
    mapVars: (v) => [v.patient_name || "Paciente", v.clinic_name || ""],
  },
  smart_confirm_4h: {
    templateName: "clinicnest_smart_confirm_4h",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.time || "",
      v.professional_name ? ` com ${v.professional_name}` : "",
      v.clinic_name || "",
    ],
    buttonVars: (v) => [[v.confirm_link?.replace(/^https?:\/\/[^/]+/, "") || "/confirmar"]],
  },
  smart_confirm_1h: {
    templateName: "clinicnest_smart_confirm_1h",
    mapVars: (v) => [
      v.patient_name || "Paciente",
      v.time || "",
      v.clinic_name || "",
    ],
    buttonVars: (v) => [[v.confirm_link?.replace(/^https?:\/\/[^/]+/, "") || "/confirmar"]],
  },
};

// ─── Template Creation on WABA ──────────────────────────────────────────

/**
 * Create all system templates on a tenant's WABA.
 * Called during Embedded Signup after WABA is connected.
 *
 * Idempotent: skips templates that already exist (409 / duplicate error).
 */
export async function createTemplatesForWaba(
  wabaId: string,
  accessToken: string,
): Promise<{
  created: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}> {
  const result = { created: [] as string[], skipped: [] as string[], failed: [] as Array<{ name: string; error: string }> };
  const url = `${META_API_BASE}/${wabaId}/message_templates`;

  for (const template of SYSTEM_TEMPLATES) {
    try {
      const payload = {
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (res.ok) {
        result.created.push(template.name);
        log("Template created", { name: template.name, id: data.id });
      } else {
        const errMsg = (data as any)?.error?.message || "";
        const errCode = (data as any)?.error?.code;

        // Template already exists — skip
        if (
          errCode === 100 &&
          (errMsg.includes("already exists") || errMsg.includes("duplicate"))
        ) {
          result.skipped.push(template.name);
          log("Template already exists, skipped", { name: template.name });
        } else {
          result.failed.push({ name: template.name, error: errMsg || JSON.stringify(data) });
          log("Template creation failed", { name: template.name, error: errMsg });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push({ name: template.name, error: msg });
      log("Template creation exception", { name: template.name, error: msg });
    }
  }

  log("Template provisioning complete", {
    created: result.created.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
  });

  return result;
}

// ─── Fetch Template Statuses ────────────────────────────────────────────

export type TemplateStatus = {
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "NOT_FOUND";
  category: string;
  id?: string;
};

/**
 * Fetch the approval status of all system templates on a WABA.
 */
export async function getTemplateStatuses(
  wabaId: string,
  accessToken: string,
): Promise<TemplateStatus[]> {
  const results: TemplateStatus[] = [];
  const systemNames = new Set(SYSTEM_TEMPLATES.map((t) => t.name));

  try {
    let url: string | null =
      `${META_API_BASE}/${wabaId}/message_templates?fields=name,status,category&limit=100`;

    const foundNames = new Set<string>();

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as any;

      if (!res.ok) {
        log("Failed to fetch templates", { error: data?.error?.message });
        break;
      }

      for (const t of data.data || []) {
        if (systemNames.has(t.name)) {
          results.push({
            name: t.name,
            status: t.status,
            category: t.category,
            id: t.id,
          });
          foundNames.add(t.name);
        }
      }

      url = data.paging?.next || null;
    }

    // Mark missing ones
    for (const name of systemNames) {
      if (!foundNames.has(name)) {
        results.push({
          name,
          status: "NOT_FOUND",
          category: SYSTEM_TEMPLATES.find((t) => t.name === name)?.category || "UTILITY",
        });
      }
    }
  } catch (err) {
    log("getTemplateStatuses error", { error: String(err) });
    // Return NOT_FOUND for all
    for (const t of SYSTEM_TEMPLATES) {
      results.push({ name: t.name, status: "NOT_FOUND", category: t.category });
    }
  }

  return results;
}

// ─── Build Template Components for Sending ──────────────────────────────

/**
 * Build the `components` array needed by sendMetaWhatsAppTemplate()
 * given a trigger type and variable values.
 */
export function buildTemplateComponents(
  triggerType: string,
  vars: Record<string, string>,
): { templateName: string; components: unknown[] } | null {
  const mapping = TRIGGER_TEMPLATE_MAP[triggerType];
  if (!mapping) return null;

  const parameters = mapping.mapVars(vars).map((value) => ({
    type: "text",
    text: value || " ",
  }));

  const components: unknown[] = [
    { type: "body", parameters },
  ];

  if (mapping.buttonVars) {
    const btnVars = mapping.buttonVars(vars);
    for (let i = 0; i < btnVars.length; i++) {
      components.push({
        type: "button",
        sub_type: "url",
        index: i.toString(),
        parameters: btnVars[i].map((v) => ({ type: "text", text: v || "/" })),
      });
    }
  }

  return { templateName: mapping.templateName, components };
}
