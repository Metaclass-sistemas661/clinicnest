/**
 * whatsapp-sales-chatbot — Enterprise Sales Chatbot
 *
 * Professional WhatsApp sales bot for ClinicNest SaaS.
 * Uses Meta WhatsApp Cloud API interactive messages (buttons, lists),
 * clinic-type segmentation, lead scoring, follow-up scheduling,
 * and Vertex AI for open-ended Q&A.
 */

import { Request, Response } from "express";
import { createHmac } from "crypto";
import { chatCompletion } from "../shared/vertexAi";
import {
  sendMetaWhatsAppMessage,
  sendMetaWhatsAppButtons,
  sendMetaWhatsAppList,
  markMessageAsRead,
} from "./whatsapp-sender";
import { createDbClient } from "../shared/db-builder";
import { checkRateLimit } from "../shared/rateLimit";

const db = createDbClient();

// ─── Config ──────────────────────────────────────────────────────────────────
const SALES_CHATBOT_SECRET = process.env.SALES_CHATBOT_SECRET || "";
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
const PHONE_ID = process.env.WHATSAPP_SALES_PHONE_NUMBER_ID || "";
const ACCESS_TOKEN = process.env.WHATSAPP_SALES_ACCESS_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const SESSION_TIMEOUT_MIN = 120;
const MAX_AI_HISTORY = 15;
const TRIAL_URL = "https://clinicnest.metaclass.com.br/registro";
const DEMO_URL = "https://clinicnest.metaclass.com.br/demonstracao";

// ─── Message Deduplication ───────────────────────────────────────────────────
const processedMessages = new Set<string>();
const DEDUP_MAX = 5000;

// ─── Webhook Signature Verification (HMAC-SHA256) ───────────────────────────
function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!META_APP_SECRET) return true; // Skip if secret not configured
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", META_APP_SECRET)
    .update(typeof rawBody === "string" ? rawBody : rawBody)
    .digest("hex");
  return signature === expected;
}

// ─── Input Sanitization ─────────────────────────────────────────────────────
function sanitizeInput(text: string): string {
  return Array.from(text)
    .filter(ch => {
      const code = ch.codePointAt(0) ?? 0;
      // Allow: tab(9), newline(10), carriage return(13), printable ASCII(32-126), Latin/Unicode(160+)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code >= 160;
    })
    .join("")
    .slice(0, 4096)
    .trim();
}

// ─── Clinic Types ────────────────────────────────────────────────────────────
type ClinicType = "odonto" | "medica" | "estetica" | "multi" | "outro";

const TYPE_LABELS: Record<ClinicType, string> = {
  odonto: "🦷 Odontologia",
  medica: "🩺 Clínica Médica",
  estetica: "✨ Estética & Dermatologia",
  multi: "🏥 Multiespecialidade",
  outro: "📋 Outro segmento",
};

// ─── Features by clinic type ─────────────────────────────────────────────────
interface Feature { id: string; title: string; desc: string; detail: string }

const FEATURES: Record<ClinicType, Feature[]> = {
  odonto: [
    { id: "f_odontograma", title: "Odontograma Digital", desc: "Arcada completa interativa", detail: "Odontograma interativo com marcação por dente, planejamento de tratamento, acompanhamento de evolução e integração com prontuário. Classificação FDI." },
    { id: "f_agenda", title: "Agenda Inteligente", desc: "Confirmação automática", detail: "Agenda com confirmação via WhatsApp, lista de espera inteligente, bloqueio por tipo de procedimento e visualização por profissional ou cadeira." },
    { id: "f_financeiro", title: "Gestão Financeira", desc: "Orçamentos e convênios", detail: "Orçamentos detalhados por procedimento, parcelamento, gestão de convênios TUSS/CBHPM, controle de inadimplência e relatórios financeiros." },
    { id: "f_ia", title: "IA Clínica", desc: "Assistente inteligente", detail: "Sugestão de CID/CIAP, predição de cancelamentos, copiloto clínico com recomendações baseadas em evidências, triagem inteligente." },
    { id: "f_prontuario", title: "Prontuário Eletrônico", desc: "Registros completos", detail: "Prontuário digital com anamnese customizável, evolução, prescrições, atestados, encaminhamentos e anexos. Conformidade CFO e LGPD." },
    { id: "f_portal", title: "Portal do Paciente", desc: "Autoatendimento digital", detail: "Portal onde o paciente visualiza agendamentos, orçamentos, documentos, assina consentimentos digitalmente e acessa teleconsulta." },
  ],
  medica: [
    { id: "f_prontuario", title: "Prontuário Eletrônico", desc: "Registros médicos SOAP", detail: "Prontuário com anamnese estruturada, SOAP, prescrição digital com verificação de interações, atestados e integração TISS/SUS." },
    { id: "f_agenda", title: "Agenda Inteligente", desc: "Multi-profissional", detail: "Agenda com confirmação automática via WhatsApp, encaixes inteligentes, lista de espera e visualização multi-profissional." },
    { id: "f_ia", title: "IA Clínica Avançada", desc: "Suporte à decisão", detail: "Sugestão de CID-10/CIAP-2, protocolos clínicos, predição de cancelamentos, copiloto, detecção de deterioração e triagem." },
    { id: "f_financeiro", title: "Gestão Financeira", desc: "Faturamento TISS", detail: "Faturamento TISS automatizado, gestão de convênios, tabela CBHPM, controle de glosas, split de pagamentos e relatórios em tempo real." },
    { id: "f_portal", title: "Portal do Paciente", desc: "Experiência digital", detail: "Agendamento online, acesso a resultados, teleconsulta, assinatura digital de consentimentos e comunicação via WhatsApp." },
    { id: "f_relatorios", title: "Relatórios & BI", desc: "Indicadores de performance", detail: "Dashboards de ocupação, faturamento, inadimplência, satisfação do paciente, produtividade e análise preditiva." },
  ],
  estetica: [
    { id: "f_fichas", title: "Fichas de Avaliação", desc: "Protocolos estéticos", detail: "Fichas específicas: facial, corporal, capilar. Fotos antes/depois, escalas de satisfação, protocolos personalizados." },
    { id: "f_agenda", title: "Agenda por Sala/Equip.", desc: "Salas e equipamentos", detail: "Controle de salas, equipamentos (laser, criolipólise), duração de sessões, pacotes de tratamento e gestão de retornos." },
    { id: "f_financeiro", title: "Pacotes & Pagamentos", desc: "Pacotes estéticos", detail: "Venda de pacotes de sessões, controle de créditos, parcelamento, comissões por profissional, fidelidade e cashback." },
    { id: "f_fidelidade", title: "Programa de Fidelidade", desc: "Gamificação e retenção", detail: "Pontos, níveis (Bronze/Prata/Ouro/Diamante), recompensas personalizadas, referral program e campanhas de reativação." },
    { id: "f_ia", title: "IA para Estética", desc: "Recomendações inteligentes", detail: "Sugestão de protocolos por perfil, predição de resultados, recomendação de produtos e análise de tendências." },
    { id: "f_marketing", title: "Marketing Integrado", desc: "Campanhas automáticas", detail: "Campanhas WhatsApp (aniversário, reativação, promoções), segmentação por perfil, landing pages e integração com ads." },
  ],
  multi: [
    { id: "f_agenda_multi", title: "Agenda Multi-Especialidade", desc: "Múltiplos profissionais", detail: "Agenda unificada por especialidade, sala ou departamento. Encaminhamentos internos e fila de espera por especialidade." },
    { id: "f_prontuario", title: "Prontuário Universal", desc: "Por especialidade", detail: "Prontuário adaptável com templates customizáveis, compartilhamento entre profissionais, histórico unificado e prescrição digital." },
    { id: "f_financeiro", title: "Gestão Financeira Central", desc: "Consolidação financeira", detail: "Dashboard consolidado, split por especialidade, convênios múltiplos, comissões diferenciadas e comparativos entre unidades." },
    { id: "f_ia", title: "IA Clínica Completa", desc: "Todas as especialidades", detail: "CID/CIAP/TUSS, protocolos por especialidade, copiloto, predição de cancelamentos, triagem e análise de sentimento." },
    { id: "f_equipe", title: "Gestão de Equipe", desc: "Escalas e desempenho", detail: "Escalas multi-profissional, disponibilidade, metas, comissões automáticas e relatórios de produtividade individual." },
    { id: "f_relatorios", title: "BI & Relatórios", desc: "Inteligência de negócio", detail: "Dashboards executivos, comparativo entre especialidades, rentabilidade por procedimento, previsão e indicadores de qualidade." },
  ],
  outro: [
    { id: "f_agenda", title: "Agenda Profissional", desc: "Gestão de horários", detail: "Agenda com confirmação automática via WhatsApp, lista de espera inteligente e visualização por profissional." },
    { id: "f_prontuario", title: "Prontuário Digital", desc: "Registros personalizáveis", detail: "Prontuário eletrônico com templates customizáveis, anexos, assinatura digital e conformidade LGPD." },
    { id: "f_financeiro", title: "Gestão Financeira", desc: "Controle de receitas", detail: "Faturamento, orçamentos, inadimplência, parcelamentos, relatórios e integração com pagamentos." },
    { id: "f_ia", title: "Inteligência Artificial", desc: "Automação inteligente", detail: "IA para triagem, predição de cancelamentos, copiloto clínico e automação de processos repetitivos." },
    { id: "f_portal", title: "Portal do Paciente", desc: "Autoatendimento", detail: "Agendamento online, teleconsulta, documentos, consentimentos e comunicação via WhatsApp." },
    { id: "f_relatorios", title: "Relatórios Completos", desc: "Indicadores e dashboards", detail: "Dashboards de ocupação, faturamento, satisfação, produtividade e análise preditiva." },
  ],
};

// ─── Plans ───────────────────────────────────────────────────────────────────
interface Plan {
  id: string; name: string; price: string; professionals: string;
  highlights: string[]; recommended?: ClinicType[];
}

const PLANS: Plan[] = [
  {
    id: "p_starter", name: "🚀 Starter", price: "R$ 89,90/mês",
    professionals: "1 profissional",
    highlights: ["Agenda + confirmação WhatsApp", "Prontuário básico", "Financeiro essencial", "Portal do paciente", "Suporte por chat"],
    recommended: ["outro"],
  },
  {
    id: "p_professional", name: "⭐ Professional", price: "R$ 149,90/mês",
    professionals: "Até 3 profissionais",
    highlights: ["Tudo do Starter +", "Odontograma / Fichas estéticas", "IA clínica (CID, protocolos)", "Teleconsulta", "Relatórios avançados", "Suporte prioritário"],
    recommended: ["odonto", "estetica"],
  },
  {
    id: "p_clinic", name: "🏥 Clínica", price: "R$ 249,90/mês",
    professionals: "Até 10 profissionais",
    highlights: ["Tudo do Professional +", "Multi-profissional completo", "Convênios (TISS)", "Comissões automáticas", "Fidelidade", "API + integrações", "Suporte dedicado"],
    recommended: ["medica", "multi"],
  },
  {
    id: "p_enterprise", name: "💎 Enterprise", price: "R$ 399,90/mês",
    professionals: "Profissionais ilimitados",
    highlights: ["Tudo do Clínica +", "Multi-unidades", "BI avançado + IA preditiva", "SNGPC integrado", "Onboarding dedicado", "SLA 4h", "Customizações"],
  },
];

// ─── States ──────────────────────────────────────────────────────────────────
enum ST {
  LGPD_CONSENT = "LGPD_CONSENT",
  WELCOME = "WELCOME",
  CLINIC_TYPE = "CLINIC_TYPE",
  MAIN_MENU = "MAIN_MENU",
  FEATURES_MENU = "FEATURES_MENU",
  FEATURE_DETAIL = "FEATURE_DETAIL",
  PLANS_MENU = "PLANS_MENU",
  PLAN_DETAIL = "PLAN_DETAIL",
  FREE_TRIAL = "FREE_TRIAL",
  DEMO = "DEMO",
  HUMAN = "HUMAN",
  AI_QA = "AI_QA",
  COLLECT_NAME = "COLLECT_NAME",
  COLLECT_EMAIL = "COLLECT_EMAIL",
  COLLECT_SIZE = "COLLECT_SIZE",
  COLLECT_SYSTEM = "COLLECT_SYSTEM",
  COLLECT_PAIN = "COLLECT_PAIN",
  SCORED = "SCORED",
  ENDED = "ENDED",
}

// ─── Lead scoring ────────────────────────────────────────────────────────────
type Temp = "hot" | "warm" | "cold";

function scoreFromCtx(ctx: Record<string, unknown>): { score: number; temp: Temp; factors: string[] } {
  let s = 0;
  const f: string[] = [];
  if (ctx.leadName) { s += 10; f.push("nome"); }
  if (ctx.leadEmail) { s += 15; f.push("email"); }
  if (ctx.leadSize && Number(ctx.leadSize) > 0) {
    s += 10; f.push("tamanho");
    if (Number(ctx.leadSize) >= 5) { s += 10; f.push("clinica_grande"); }
  }
  if (ctx.clinicType) { s += 5; f.push("tipo"); }
  if (ctx.currentSystem) { s += 10; f.push("sistema_atual"); }
  if (ctx.mainPain) { s += 10; f.push("dor"); }
  if (ctx.viewedPlans) { s += 10; f.push("planos"); }
  if (ctx.viewedFeatures) { s += 5; f.push("funcionalidades"); }
  if (ctx.trialInterest) { s += 15; f.push("trial"); }
  if (ctx.demoInterest) { s += 15; f.push("demo"); }
  const ic = Number(ctx.interactionCount || 0);
  if (ic >= 5) { s += 5; f.push("engajado"); }
  if (ic >= 10) { s += 5; f.push("muito_engajado"); }
  s = Math.min(s, 100);
  return { score: s, temp: s >= 60 ? "hot" : s >= 30 ? "warm" : "cold", factors: f };
}

// ─── AI prompt builder ───────────────────────────────────────────────────────
function aiPrompt(ct?: ClinicType): string {
  const label = ct ? TYPE_LABELS[ct] : "clínica de saúde";
  return `Você é um consultor comercial sênior do ClinicNest, o sistema de gestão mais completo para clínicas de saúde do Brasil.
PERFIL DO LEAD: ${label}
REGRAS:
- Português brasileiro, tom profissional e acolhedor
- Máximo 3 parágrafos curtos
- Destaque benefícios específicos para o tipo de clínica do lead
- Sugira funcionalidades específicas do ClinicNest quando relevante
- Se o lead demonstrar interesse, sugira trial gratuito ou demonstração
- Funcionalidades reais: agenda inteligente, prontuário eletrônico, odontograma, fichas estéticas, financeiro (TISS/convênios), IA clínica (CID/CIAP, copiloto, predições), teleconsulta, portal do paciente, relatórios/BI, fidelidade, WhatsApp, equipe/comissões, SNGPC, marketing automático
- Se não souber, direcione para consultor humano
- NUNCA invente funcionalidades ou mencione preços`;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Conv {
  id: string; phone: string; visitor_name: string | null;
  visitor_email: string | null; visitor_clinic_size: number | null;
  context: Record<string, unknown>; last_message_at: string;
  is_human_takeover: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

interface Extracted {
  from: string; text: string; messageId: string;
  btnPayload?: string; listPayload?: string;
  referral?: Record<string, unknown>;
}

function extractMeta(body: any): Extracted | null {
  try {
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;
    const from = msg.from;
    const messageId = msg.id;
    let text = "";
    let btnPayload: string | undefined;
    let listPayload: string | undefined;

    switch (msg.type) {
      case "text": text = msg.text?.body || ""; break;
      case "interactive":
        if (msg.interactive?.type === "button_reply") {
          text = msg.interactive.button_reply.title || "";
          btnPayload = msg.interactive.button_reply.id || "";
        } else if (msg.interactive?.type === "list_reply") {
          text = msg.interactive.list_reply.title || "";
          listPayload = msg.interactive.list_reply.id || "";
        }
        break;
      case "button":
        text = msg.button?.text || msg.button?.payload || "";
        btnPayload = msg.button?.payload || "";
        break;
      default: text = "[mensagem não suportada]";
    }

    const referral = msg.referral || body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.referral || undefined;
    return { from, text: text.trim(), messageId, btnPayload, listPayload, referral };
  } catch { return null; }
}

// ─── Sender wrappers ─────────────────────────────────────────────────────────
const txt = (to: string, t: string) => t ? sendMetaWhatsAppMessage(PHONE_ID, ACCESS_TOKEN, to, t) : Promise.resolve({ ok: true });
const btns = (to: string, body: string, b: Array<{ id: string; title: string }>, hdr?: string) =>
  sendMetaWhatsAppButtons(PHONE_ID, ACCESS_TOKEN, to, body, b, hdr);
const list = (to: string, hdr: string, body: string, btn: string, secs: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>) =>
  sendMetaWhatsAppList(PHONE_ID, ACCESS_TOKEN, to, hdr, body, btn, secs);

// ─── DB operations ───────────────────────────────────────────────────────────
async function getOrCreate(phone: string): Promise<Conv> {
  const { data: existing } = await db.from("sales_chatbot_conversations").select("*").eq("phone", phone).maybeSingle();
  if (existing) {
    const diff = (Date.now() - new Date(existing.last_message_at).getTime()) / 60000;
    if (diff > SESSION_TIMEOUT_MIN) {
      const prevCtx = existing.context || {};
      const resetState = prevCtx.lgpdAccepted ? ST.WELCOME : ST.LGPD_CONSENT;
      await db.from("sales_chatbot_conversations").update({
        context: { ...prevCtx, interactionCount: 0, state: resetState },
        last_message_at: new Date().toISOString(),
        is_human_takeover: false, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      await db.from("sales_chatbot_messages").delete().eq("conversation_id", existing.id);
      return { ...existing, context: { ...prevCtx, interactionCount: 0, state: resetState }, last_message_at: new Date().toISOString(), is_human_takeover: false };
    }
    await db.from("sales_chatbot_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.id);
    return existing;
  }
  const { data: created, error } = await db.from("sales_chatbot_conversations")
    .insert({ phone, context: { state: ST.LGPD_CONSENT, interactionCount: 0 }, last_message_at: new Date().toISOString() })
    .select("*").single();
  if (error || !created) throw new Error(`Create conv failed: ${error?.message}`);
  return created;
}

async function setState(cid: string, state: ST, extra: Record<string, unknown> = {}): Promise<void> {
  const { data } = await db.from("sales_chatbot_conversations").select("context").eq("id", cid).single();
  const ctx = (data?.context || {}) as Record<string, unknown>;
  const ic = Number(ctx.interactionCount || 0) + 1;
  await db.from("sales_chatbot_conversations").update({ context: { ...ctx, ...extra, state, interactionCount: ic }, updated_at: new Date().toISOString() }).eq("id", cid);
}

async function saveMsg(cid: string, dir: "inbound" | "outbound", content: string): Promise<void> {
  if (!content) return;
  await db.from("sales_chatbot_messages").insert({ conversation_id: cid, direction: dir, content: content.slice(0, 4000) });
}

async function getHistory(cid: string): Promise<Array<{ role: string; content: string }>> {
  const { data } = await db.from("sales_chatbot_messages").select("direction, content")
    .eq("conversation_id", cid).order("created_at", { ascending: false }).limit(MAX_AI_HISTORY);
  if (!data) return [];
  return data.reverse().map((m: any) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content }));
}

async function saveLead(cid: string, phone: string, d: Record<string, unknown>): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name) updates.visitor_name = d.name;
  if (d.email) updates.visitor_email = d.email;
  if (d.professionals) updates.visitor_clinic_size = d.professionals;
  await db.from("sales_chatbot_conversations").update(updates).eq("id", cid);

  const { data: existing } = await db.from("sales_leads").select("id, metadata").eq("phone", phone).maybeSingle();
  const meta = { ...(existing?.metadata || {}), ...d, last_updated: new Date().toISOString() };
  if (existing) {
    const lu: Record<string, unknown> = { metadata: meta, updated_at: new Date().toISOString() };
    if (d.name) lu.name = d.name;
    if (d.email) lu.email = d.email;
    if (d.professionals) lu.clinic_size = d.professionals;
    if (d.score !== undefined) lu.notes = `Score: ${d.score} | ${d.temperature}`;
    await db.from("sales_leads").update(lu).eq("id", existing.id);
  } else {
    await db.from("sales_leads").insert({ phone, name: (d.name as string) || null, email: (d.email as string) || null, clinic_size: (d.professionals as number) || null, source: "whatsapp_chatbot", status: "new", metadata: meta });
  }
}

async function scheduleFollowUp(phone: string, days: number, reason: string): Promise<void> {
  const at = new Date(); at.setDate(at.getDate() + days);
  const { data: lead } = await db.from("sales_leads").select("id, metadata").eq("phone", phone).maybeSingle();
  if (!lead) return;
  const fups = ((lead.metadata as any)?.follow_ups || []) as Array<Record<string, unknown>>;
  fups.push({ scheduled_at: at.toISOString(), reason, status: "pending", created_at: new Date().toISOString() });
  await db.from("sales_leads").update({ metadata: { ...(lead.metadata || {}), follow_ups: fups }, updated_at: new Date().toISOString() }).eq("id", lead.id);
}

// ─── LGPD Consent ────────────────────────────────────────────────────────────
const LGPD_TEXT = `Antes de continuarmos, precisamos do seu consentimento conforme a *Lei Geral de Proteção de Dados (LGPD – Lei 13.709/2018)*.\n\n📋 *Dados coletados:* nome, e-mail, telefone e informações sobre sua clínica.\n\n🎯 *Finalidade:* apresentar o ClinicNest, enviar informações comerciais e agendar demonstrações.\n\n🔒 *Seus direitos:* acesso, correção, exclusão e revogação a qualquer momento.\n\n📄 Política de privacidade: https://clinicnest.metaclass.com.br/privacidade`;

async function sendLgpdConsent(to: string): Promise<void> {
  await txt(to, `Olá! 👋 Bem-vindo ao *ClinicNest*!\n\n${LGPD_TEXT}`);
  await btns(to, "Você concorda com o tratamento dos seus dados?", [
    { id: "lgpd_accept", title: "✅ Aceito" },
    { id: "lgpd_reject", title: "❌ Não aceito" },
    { id: "lgpd_more", title: "ℹ️ Saber mais" },
  ]);
}

async function recordSalesLgpdConsent(phone: string, accepted: boolean): Promise<void> {
  await db.from("lgpd_consentimentos").insert({
    tenant_id: "00000000-0000-0000-0000-000000000000",
    titular_email: phone,
    titular_nome: null,
    finalidade: "whatsapp_sales_chatbot",
    descricao: "Consentimento para coleta de dados via chatbot de vendas WhatsApp",
    dados_coletados: ["nome", "email", "telefone", "tipo_clinica", "tamanho_clinica"],
    consentido: accepted,
    metodo: "whatsapp_button",
    ip_address: null,
    user_agent: "WhatsApp",
  }).then(() => {}).catch((err: any) => console.error("[sales-chatbot] LGPD insert error:", err?.message));
}

// ─── Interactive message senders ─────────────────────────────────────────────
async function sendWelcome(to: string): Promise<void> {
  await txt(to, `Olá! 👋 Bem-vindo ao *ClinicNest* — o sistema de gestão mais completo para clínicas de saúde do Brasil.\n\nSou seu consultor virtual e estou aqui para mostrar como podemos transformar a gestão da sua clínica.\n\nPara personalizar sua experiência, me conte: *qual é o tipo da sua clínica?*`);
  await list(to, "Tipo de Clínica", "Selecione o tipo da sua clínica para personalizar as informações:", "Escolher tipo", [{
    title: "Selecione seu segmento", rows: [
      { id: "type_odonto", title: "🦷 Odontologia", description: "Clínica odontológica" },
      { id: "type_medica", title: "🩺 Clínica Médica", description: "Consultório ou clínica médica" },
      { id: "type_estetica", title: "✨ Estética/Dermatologia", description: "Clínica de estética" },
      { id: "type_multi", title: "🏥 Multiespecialidade", description: "Diversas especialidades" },
      { id: "type_outro", title: "📋 Outro segmento", description: "Fisioterapia, psicologia, etc." },
    ],
  }]);
}

async function sendMainMenu(to: string, name?: string, ct?: ClinicType): Promise<void> {
  const g = name ? `${name}, como` : "Como";
  const tl = ct ? ` para ${TYPE_LABELS[ct]}` : "";
  await list(to, "Menu Principal", `${g} posso ajudar?${tl}\n\nEscolha uma opção:`, "Ver opções", [{
    title: "O que gostaria de saber?", rows: [
      { id: "m_features", title: "🔍 Funcionalidades", description: "Explore recursos do ClinicNest" },
      { id: "m_plans", title: "📊 Planos e Preços", description: "Compare nossos planos" },
      { id: "m_trial", title: "🆓 Trial Gratuito", description: "14 dias grátis, sem cartão" },
      { id: "m_demo", title: "📅 Agendar Demonstração", description: "Demo personalizada ao vivo" },
      { id: "m_ai", title: "💡 Tirar Dúvidas (IA)", description: "Pergunte qualquer coisa" },
      { id: "m_human", title: "🤝 Falar com Consultor", description: "Atendimento humano" },
    ],
  }]);
}

async function sendFeaturesList(to: string, ct?: ClinicType): Promise<void> {
  const feats = FEATURES[ct || "outro"];
  await list(to, "Funcionalidades", `Funcionalidades do ClinicNest${ct ? ` para ${TYPE_LABELS[ct]}` : ""}:`, "Ver funcionalidades", [{
    title: "Funcionalidades", rows: feats.map(f => ({ id: f.id, title: f.title, description: f.desc })),
  }]);
}

async function sendPlansList(to: string, ct?: ClinicType): Promise<void> {
  await list(to, "Planos ClinicNest", "Todos incluem *14 dias de trial gratuito* sem cartão. Escolha para detalhes:", "Ver planos", [{
    title: "Planos", rows: PLANS.map(p => {
      const rec = ct && p.recommended?.includes(ct);
      return { id: p.id, title: `${p.name}${rec ? " ⭐" : ""}`, description: `${p.price} • ${p.professionals}` };
    }),
  }]);
}

function planMsg(p: Plan, ct?: ClinicType): string {
  const badge = ct && p.recommended?.includes(ct) ? " ⭐ *RECOMENDADO*" : "";
  return `${p.name}${badge}\n\n💰 *${p.price}*\n👥 ${p.professionals}\n\n` + p.highlights.map(h => `✅ ${h}`).join("\n") + `\n\n🔗 Teste grátis: ${TRIAL_URL}`;
}

async function sendTrialReady(to: string, name?: string, ct?: ClinicType): Promise<void> {
  const n = name || "Você";
  const bonus = ct ? `\n\n🎯 Conta pré-configurada para *${TYPE_LABELS[ct]}* com templates do seu segmento.` : "";
  await txt(to, `${n}, tudo pronto! 🚀\n\n🔗 *Crie sua conta gratuita:*\n${TRIAL_URL}${bonus}\n\n📱 Setup em menos de 5 minutos.\n💬 Estou aqui se precisar!`);
  await btns(to, "Posso ajudar com mais alguma coisa?", [
    { id: "go_demo", title: "📅 Agendar Demo" },
    { id: "m_plans", title: "📊 Comparar Planos" },
    { id: "back_menu", title: "📋 Menu Principal" },
  ]);
}

async function sendDemoOffer(to: string, name?: string): Promise<void> {
  const n = name || "Você";
  await txt(to, `${n}, que ótimo! 🎯\n\nNa demonstração, um especialista vai:\n\n✅ Apresentar o sistema para sua clínica\n✅ Tirar todas as dúvidas ao vivo\n✅ Mostrar como migrar de outro sistema\n✅ Criar plano de implantação\n\n📅 *Agende:* ${DEMO_URL}\n\n⏱️ Duração: ~30 minutos`);
  await btns(to, "Ou, se preferir:", [
    { id: "go_trial", title: "🆓 Começar Trial" },
    { id: "m_human", title: "🤝 Falar c/ Consultor" },
    { id: "back_menu", title: "📋 Menu Principal" },
  ]);
}

function painSolution(pain: string, ct?: ClinicType): string {
  const pl = pain.toLowerCase();
  if (pl.includes("agenda") || pl.includes("cancelamento") || pl.includes("falta"))
    return "A gestão de agenda é o coração de qualquer clínica. Com o ClinicNest, você reduz até *40% dos cancelamentos* com confirmação automática via WhatsApp e lista de espera inteligente.";
  if (pl.includes("financ") || pl.includes("inadimplência") || pl.includes("custo"))
    return "O ClinicNest automatiza faturamento, convênios e oferece *relatórios em tempo real* para você sempre saber a saúde financeira da clínica.";
  if (pl.includes("prontuário") || pl.includes("registro"))
    return "Prontuários organizados = mais segurança e menos retrabalho. Com o ClinicNest, prontuário 100% digital, LGPD, acessível de qualquer lugar.";
  if (pl.includes("paciente") || pl.includes("captação") || pl.includes("marketing"))
    return "O ClinicNest oferece portal do paciente, campanhas automatizadas por WhatsApp, fidelidade e ferramentas para transformar pacientes em promotores.";
  if (pl.includes("equipe") || pl.includes("escala"))
    return "Com o ClinicNest você controla escalas, comissões automáticas e acompanha a produtividade individual de cada profissional.";
  if (pl.includes("tempo") || pl.includes("manual") || pl.includes("burocracia"))
    return "O ClinicNest automatiza confirmações, faturamento, relatórios e processos — clínicas economizam em média *8 horas por semana*. ⏰";
  if (pl.includes("cresci") || pl.includes("escalar"))
    return "Para crescer, você precisa de dados e automação. O ClinicNest oferece BI avançado, multi-unidade e indicadores para decisões estratégicas.";
  if (pl.includes("lgpd") || pl.includes("compliance"))
    return "O ClinicNest é 100% LGPD: criptografia, consentimento digital, auditoria de acessos e gestão de dados sensíveis conforme a lei.";
  const hint = ct === "odonto" ? "odontológicas" : ct === "estetica" ? "de estética" : ct === "medica" ? "médicas" : "de saúde";
  return `Esse é um desafio comum em clínicas ${hint}. O ClinicNest foi projetado exatamente para resolver isso.`;
}

// ─── Main handler ────────────────────────────────────────────────────────────
async function handleIncoming(phone: string, text: string, payload?: string, referral?: Record<string, unknown>): Promise<void> {
  const conv = await getOrCreate(phone);
  const ctx = (conv.context || {}) as Record<string, unknown>;
  const st = (ctx.state as ST) || ST.WELCOME;
  const input = (payload || text).trim().toLowerCase();
  const ct = ctx.clinicType as ClinicType | undefined;
  const name = ctx.leadName as string | undefined;

  await saveMsg(conv.id, "inbound", text);

  // UTM referral tracking
  if (referral && !ctx.referral) {
    await setState(conv.id, st, { referral });
    await saveLead(conv.id, phone, { utm_source: referral.source_url || referral.source_id, utm_medium: "whatsapp_ad", referral_body: referral.body });
  }

  // ── Global commands ──
  if (["menu", "voltar", "inicio", "início", "oi", "olá", "ola", "hi", "hello"].includes(input) && st !== ST.WELCOME) {
    if (ct) { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
    await setState(conv.id, ST.WELCOME); await sendWelcome(phone); return;
  }
  if (["0", "sair", "encerrar", "tchau", "bye", "fim"].includes(input)) {
    await setState(conv.id, ST.ENDED);
    const bye = name
      ? `${name}, foi um prazer! 😊\n\nSe precisar, é só enviar mensagem.\n\n🔗 Trial gratuito: ${TRIAL_URL}\n\nAté logo! 👋`
      : `Foi um prazer! 😊\n\nSe precisar, é só enviar mensagem.\n\n🔗 Trial gratuito: ${TRIAL_URL}\n\nAté logo! 👋`;
    await txt(phone, bye); await saveMsg(conv.id, "outbound", bye);
    const sc = scoreFromCtx(ctx);
    if (sc.temp !== "cold") {
      await scheduleFollowUp(phone, 1, "post_conversa");
      await scheduleFollowUp(phone, 3, "d3");
      await scheduleFollowUp(phone, 7, "d7");
    }
    return;
  }
  if (conv.is_human_takeover) return;

  // ── State machine ──
  switch (st) {

    // ── LGPD CONSENT (mandatory first step) ──
    case ST.LGPD_CONSENT: {
      const a = payload || input;
      if (a === "lgpd_accept" || a === "aceito" || a === "sim" || a === "concordo") {
        await recordSalesLgpdConsent(phone, true);
        await setState(conv.id, ST.CLINIC_TYPE, { lgpdAccepted: true, lgpdAcceptedAt: new Date().toISOString() });
        await sendWelcome(phone);
        return;
      }
      if (a === "lgpd_reject" || a === "não" || a === "nao" || a === "recuso") {
        await recordSalesLgpdConsent(phone, false);
        await setState(conv.id, ST.ENDED, { lgpdAccepted: false });
        await txt(phone, "Entendemos e respeitamos sua decisão. 🙏\n\nSem o consentimento, não podemos dar continuidade ao atendimento via WhatsApp.\n\nSe mudar de ideia, envie *oi* a qualquer momento.\n\nAcesse nosso site: https://clinicnest.metaclass.com.br");
        return;
      }
      if (a === "lgpd_more" || a === "saber mais" || a === "info") {
        await txt(phone, `*Sobre a LGPD e seus dados:*\n\n🔹 Coletamos apenas dados necessários para o atendimento\n🔹 Seus dados nunca são compartilhados com terceiros\n🔹 Você pode solicitar exclusão total a qualquer momento\n🔹 Usamos criptografia em trânsito e em repouso\n🔹 Nosso DPO (Encarregado): dpo@metaclass.com.br\n\n📄 Política completa: https://clinicnest.metaclass.com.br/privacidade`);
        await btns(phone, "Deseja prosseguir?", [
          { id: "lgpd_accept", title: "✅ Aceito" },
          { id: "lgpd_reject", title: "❌ Não aceito" },
        ]);
        return;
      }
      // Didn't understand — re-send consent
      await sendLgpdConsent(phone);
      return;
    }

    // ── WELCOME / ENDED ──
    case ST.WELCOME:
    case ST.ENDED: {
      // If returning after previous rejection or session reset, require consent again
      if (!ctx.lgpdAccepted) {
        await setState(conv.id, ST.LGPD_CONSENT);
        await sendLgpdConsent(phone);
        return;
      }
      await setState(conv.id, ST.CLINIC_TYPE);
      await sendWelcome(phone);
      return;
    }

    // ── CLINIC TYPE SELECTION ──
    case ST.CLINIC_TYPE: {
      let sel: ClinicType | null = null;
      if (payload?.startsWith("type_")) sel = payload.replace("type_", "") as ClinicType;
      else {
        const m: Record<string, ClinicType> = {
          "1": "odonto", odonto: "odonto", odontologia: "odonto", dentista: "odonto",
          "2": "medica", médica: "medica", medica: "medica", medicina: "medica",
          "3": "estetica", estética: "estetica", estetica: "estetica", dermatologia: "estetica",
          "4": "multi", multiespecialidade: "multi", multi: "multi",
          "5": "outro", outro: "outro", outra: "outro",
        };
        sel = m[input] || null;
      }
      if (!sel) {
        await txt(phone, "Não entendi. Por favor, selecione uma opção:");
        await sendWelcome(phone);
        return;
      }
      await setState(conv.id, ST.MAIN_MENU, { clinicType: sel });
      await saveLead(conv.id, phone, { clinic_type: sel });
      await txt(phone, `Excelente! ${TYPE_LABELS[sel]} — temos soluções específicas para o seu segmento! 🎯`);
      await sendMainMenu(phone, name, sel);
      return;
    }

    // ── MAIN MENU ──
    case ST.MAIN_MENU: {
      const a = payload || input;
      if (a === "m_features" || a === "1" || a === "funcionalidades") {
        await setState(conv.id, ST.FEATURES_MENU, { viewedFeatures: true });
        await sendFeaturesList(phone, ct); return;
      }
      if (a === "m_plans" || a === "2" || a === "planos") {
        await setState(conv.id, ST.PLANS_MENU, { viewedPlans: true });
        await sendPlansList(phone, ct); return;
      }
      if (a === "m_trial" || a === "3" || a === "trial" || a === "testar") {
        await setState(conv.id, ST.FREE_TRIAL, { trialInterest: true });
        if (name) { await sendTrialReady(phone, name, ct); await setState(conv.id, ST.MAIN_MENU); return; }
        await txt(phone, "Excelente! 🎉 Trial *100% gratuito por 14 dias*, sem cartão.\n\nPreciso de algumas informações rápidas.\n\n✏️ *Qual é o seu nome completo?*");
        await setState(conv.id, ST.COLLECT_NAME, { trialInterest: true });
        return;
      }
      if (a === "m_demo" || a === "4" || a === "demo" || a === "demonstração") {
        await setState(conv.id, ST.DEMO, { demoInterest: true });
        if (name) { await sendDemoOffer(phone, name); await scheduleFollowUp(phone, 0, "demo"); await setState(conv.id, ST.MAIN_MENU); return; }
        await txt(phone, "Perfeito! 📅 Vou agendar uma demonstração personalizada.\n\n✏️ *Qual é o seu nome completo?*");
        await setState(conv.id, ST.COLLECT_NAME, { demoInterest: true });
        return;
      }
      if (a === "m_ai" || a === "5" || a === "dúvida" || a === "duvida" || a === "pergunta") {
        await setState(conv.id, ST.AI_QA);
        await txt(phone, "💡 Pode perguntar o que quiser sobre o ClinicNest!\n\nEstou preparado para responder sobre funcionalidades, integrações, segurança, LGPD, migração e muito mais.\n\nDigite sua pergunta:");
        return;
      }
      if (a === "m_human" || a === "6" || a === "humano" || a === "consultor") {
        await db.from("sales_chatbot_conversations").update({ is_human_takeover: true, updated_at: new Date().toISOString() }).eq("id", conv.id);
        await setState(conv.id, ST.HUMAN);
        await txt(phone, `Entendido! 🤝\n\nTransferindo para um consultor especializado.\n\n⏰ *Atendimento:* Seg-Sáb, 8h às 18h\n\nEnquanto aguarda, explore: ${TRIAL_URL}`);
        await scheduleFollowUp(phone, 0, "human_transfer");
        return;
      }
      await txt(phone, "Não entendi. Veja as opções:");
      await sendMainMenu(phone, name, ct);
      return;
    }

    // ── FEATURES MENU ──
    case ST.FEATURES_MENU: {
      const feats = FEATURES[ct || "outro"];
      if (payload?.startsWith("f_")) {
        const feat = feats.find(f => f.id === payload);
        if (feat) {
          await setState(conv.id, ST.FEATURE_DETAIL, { lastFeature: feat.id });
          await txt(phone, `*${feat.title}*\n\n${feat.detail}`);
          await btns(phone, "O que deseja fazer?", [
            { id: "back_features", title: "← Funcionalidades" },
            { id: "go_trial", title: "🆓 Testar Grátis" },
            { id: "back_menu", title: "📋 Menu Principal" },
          ]);
          await saveMsg(conv.id, "outbound", feat.detail);
          return;
        }
      }
      const idx = parseInt(input, 10) - 1;
      if (idx >= 0 && idx < feats.length) {
        const feat = feats[idx];
        await setState(conv.id, ST.FEATURE_DETAIL, { lastFeature: feat.id });
        await txt(phone, `*${feat.title}*\n\n${feat.detail}`);
        await btns(phone, "O que deseja fazer?", [
          { id: "back_features", title: "← Funcionalidades" },
          { id: "go_trial", title: "🆓 Testar Grátis" },
          { id: "back_menu", title: "📋 Menu Principal" },
        ]);
        await saveMsg(conv.id, "outbound", feat.detail);
        return;
      }
      if (input === "voltar" || payload === "back_menu") { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
      await txt(phone, "Selecione uma funcionalidade:");
      await sendFeaturesList(phone, ct);
      return;
    }

    // ── FEATURE DETAIL ──
    case ST.FEATURE_DETAIL: {
      if (payload === "back_features" || input === "voltar") { await setState(conv.id, ST.FEATURES_MENU); await sendFeaturesList(phone, ct); return; }
      if (payload === "go_trial" || input === "trial") { await setState(conv.id, ST.FREE_TRIAL, { trialInterest: true }); if (name) { await sendTrialReady(phone, name, ct); await setState(conv.id, ST.MAIN_MENU); } else { await txt(phone, "Ótima escolha! 🎉 Trial gratuito por 14 dias.\n\n✏️ *Qual é o seu nome completo?*"); await setState(conv.id, ST.COLLECT_NAME, { trialInterest: true }); } return; }
      if (payload === "back_menu" || input === "menu") { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
      await setState(conv.id, ST.FEATURES_MENU); await sendFeaturesList(phone, ct);
      return;
    }

    // ── PLANS MENU ──
    case ST.PLANS_MENU: {
      if (payload?.startsWith("p_")) {
        const plan = PLANS.find(p => p.id === payload);
        if (plan) {
          await setState(conv.id, ST.PLAN_DETAIL, { lastPlan: plan.id });
          await txt(phone, planMsg(plan, ct));
          await btns(phone, "Deseja continuar?", [
            { id: "go_trial", title: "🆓 Testar Grátis" },
            { id: "go_demo", title: "📅 Agendar Demo" },
            { id: "back_plans", title: "← Ver Planos" },
          ]);
          await saveMsg(conv.id, "outbound", planMsg(plan, ct));
          return;
        }
      }
      const pi = parseInt(input, 10) - 1;
      if (pi >= 0 && pi < PLANS.length) {
        const plan = PLANS[pi];
        await setState(conv.id, ST.PLAN_DETAIL, { lastPlan: plan.id });
        await txt(phone, planMsg(plan, ct));
        await btns(phone, "Deseja continuar?", [
          { id: "go_trial", title: "🆓 Testar Grátis" },
          { id: "go_demo", title: "📅 Agendar Demo" },
          { id: "back_plans", title: "← Ver Planos" },
        ]);
        await saveMsg(conv.id, "outbound", planMsg(plan, ct));
        return;
      }
      if (input === "voltar" || payload === "back_menu") { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
      await txt(phone, "Selecione um plano:");
      await sendPlansList(phone, ct);
      return;
    }

    // ── PLAN DETAIL ──
    case ST.PLAN_DETAIL: {
      if (payload === "go_trial" || input === "trial") {
        if (name) { await sendTrialReady(phone, name, ct); await setState(conv.id, ST.MAIN_MENU); return; }
        await txt(phone, "Ótima escolha! 🎉\n\n✏️ *Qual é o seu nome completo?*");
        await setState(conv.id, ST.COLLECT_NAME, { trialInterest: true }); return;
      }
      if (payload === "go_demo") {
        if (name) { await sendDemoOffer(phone, name); await scheduleFollowUp(phone, 0, "demo"); await setState(conv.id, ST.MAIN_MENU); return; }
        await txt(phone, "Perfeito! 📅\n\n✏️ *Qual é o seu nome completo?*");
        await setState(conv.id, ST.COLLECT_NAME, { demoInterest: true }); return;
      }
      if (payload === "back_plans" || input === "voltar") { await setState(conv.id, ST.PLANS_MENU); await sendPlansList(phone, ct); return; }
      if (payload === "back_menu" || input === "menu") { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
      await setState(conv.id, ST.PLANS_MENU); await sendPlansList(phone, ct);
      return;
    }

    // ── FREE TRIAL / DEMO ──
    case ST.FREE_TRIAL:
    case ST.DEMO: {
      if (!name) {
        await setState(conv.id, ST.COLLECT_NAME, st === ST.FREE_TRIAL ? { trialInterest: true } : { demoInterest: true });
        await txt(phone, "Para continuar, preciso de algumas informações.\n\n✏️ *Qual é o seu nome completo?*");
        return;
      }
      if (st === ST.FREE_TRIAL) { await sendTrialReady(phone, name, ct); }
      else { await sendDemoOffer(phone, name); await scheduleFollowUp(phone, 0, "demo"); }
      await setState(conv.id, ST.MAIN_MENU);
      return;
    }

    // ── COLLECT NAME ──
    case ST.COLLECT_NAME: {
      if (input.length < 2 || /^\d+$/.test(input)) { await txt(phone, "Por favor, informe seu nome completo:"); return; }
      const n = text.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      await saveLead(conv.id, phone, { name: n });
      await setState(conv.id, ST.COLLECT_EMAIL, { leadName: n });
      await txt(phone, `Prazer, ${n}! 😊\n\n📧 *Qual é o seu melhor e-mail?*\n\n_(opcional — digite "pular" para continuar)_`);
      return;
    }

    // ── COLLECT EMAIL ──
    case ST.COLLECT_EMAIL: {
      const n = name || (ctx.leadName as string) || "Você";
      if (input !== "pular" && input !== "skip" && input.includes("@") && input.includes(".")) {
        await saveLead(conv.id, phone, { email: input.toLowerCase().trim() });
        await setState(conv.id, ST.COLLECT_SIZE, { leadEmail: input.toLowerCase().trim() });
      } else {
        await setState(conv.id, ST.COLLECT_SIZE);
      }
      await btns(phone, `${n}, quantos profissionais atendem na sua clínica?`, [
        { id: "sz_1", title: "1 (Só eu)" },
        { id: "sz_2_5", title: "2 a 5" },
        { id: "sz_6", title: "6 ou mais" },
      ], "Tamanho da Clínica");
      return;
    }

    // ── COLLECT SIZE ──
    case ST.COLLECT_SIZE: {
      let sz: number | null = null;
      if (payload === "sz_1" || input === "1") sz = 1;
      else if (payload === "sz_2_5" || ["2", "3", "4", "5"].includes(input)) sz = parseInt(input, 10) || 3;
      else if (payload === "sz_6" || parseInt(input, 10) >= 6) sz = parseInt(input, 10) || 10;
      else { const p = parseInt(input, 10); if (p > 0) sz = p; }
      if (sz) await saveLead(conv.id, phone, { professionals: sz });
      await setState(conv.id, ST.COLLECT_SYSTEM, { leadSize: sz });
      await btns(phone, `${name || "Você"}, utiliza algum sistema de gestão atualmente?`, [
        { id: "sys_yes", title: "✅ Sim, uso outro" },
        { id: "sys_paper", title: "📋 Papel/planilha" },
        { id: "sys_no", title: "❌ Não uso nada" },
      ], "Sistema Atual");
      return;
    }

    // ── COLLECT SYSTEM ──
    case ST.COLLECT_SYSTEM: {
      let sys = "nao_informado";
      if (payload === "sys_yes" || input.includes("sim") || input.includes("uso")) sys = "outro_sistema";
      else if (payload === "sys_paper" || input.includes("papel") || input.includes("planilha") || input.includes("excel")) sys = "papel_planilha";
      else if (payload === "sys_no" || input.includes("não") || input.includes("nao") || input.includes("nada")) sys = "nenhum";
      await saveLead(conv.id, phone, { currentSystem: sys });
      await setState(conv.id, ST.COLLECT_PAIN, { currentSystem: sys });
      await list(phone, "Maior Desafio", "Qual é o *maior desafio* na gestão da sua clínica hoje?", "Selecionar", [{
        title: "Desafios", rows: [
          { id: "pain_agenda", title: "📅 Gestão de Agenda", description: "Faltas, cancelamentos" },
          { id: "pain_finance", title: "💰 Controle Financeiro", description: "Receitas, inadimplência" },
          { id: "pain_records", title: "📋 Prontuários", description: "Organização e acesso" },
          { id: "pain_patients", title: "👥 Captação Pacientes", description: "Marketing e retenção" },
          { id: "pain_team", title: "👨‍⚕️ Gestão de Equipe", description: "Escalas e produtividade" },
          { id: "pain_time", title: "⏰ Falta de Tempo", description: "Processos manuais" },
          { id: "pain_growth", title: "📈 Crescimento", description: "Escalar o negócio" },
          { id: "pain_lgpd", title: "🔒 LGPD/Compliance", description: "Adequação legal" },
        ],
      }]);
      return;
    }

    // ── COLLECT PAIN ──
    case ST.COLLECT_PAIN: {
      const n = name || (ctx.leadName as string) || "Você";
      const painMap: Record<string, string> = {
        pain_agenda: "Gestão de Agenda", pain_finance: "Controle Financeiro",
        pain_records: "Prontuários", pain_patients: "Captação de Pacientes",
        pain_team: "Gestão de Equipe", pain_time: "Falta de Tempo",
        pain_growth: "Crescimento", pain_lgpd: "LGPD/Compliance",
      };
      const painLabel = (payload && painMap[payload]) || text;
      await saveLead(conv.id, phone, { mainPain: painLabel });

      // Score lead
      const { data: freshConv } = await db.from("sales_chatbot_conversations").select("context").eq("id", conv.id).single();
      const fCtx = { ...(freshConv?.context || {}), mainPain: painLabel };
      const sc = scoreFromCtx(fCtx);
      await saveLead(conv.id, phone, { score: sc.score, temperature: sc.temp, score_factors: sc.factors });
      await setState(conv.id, ST.SCORED, { mainPain: painLabel, leadScore: sc.score, leadTemp: sc.temp });

      const sol = painSolution(painLabel, ct);
      await txt(phone, `Entendo perfeitamente, ${n}! ${sol}\n\nCom o ClinicNest, clínicas como a sua resolvem esse desafio nas primeiras semanas. 💪`);

      if (sc.temp === "hot") {
        await btns(phone, `${n}, o ClinicNest parece ideal para você! O que prefere?`, [
          { id: "go_trial", title: "🆓 Começar Trial" },
          { id: "go_demo", title: "📅 Agendar Demo" },
          { id: "m_human", title: "🤝 Falar c/ Consultor" },
        ], "Próximo Passo");
        await scheduleFollowUp(phone, 0, "hot_lead");
      } else {
        await btns(phone, "Como deseja continuar?", [
          { id: "m_features", title: "🔍 Funcionalidades" },
          { id: "m_plans", title: "📊 Ver Planos" },
          { id: "go_trial", title: "🆓 Testar Grátis" },
        ], "Próximo Passo");
        if (sc.temp === "warm") await scheduleFollowUp(phone, 1, "warm_lead");
      }
      return;
    }

    // ── SCORED ──
    case ST.SCORED: {
      const a = payload || input;
      if (a === "go_trial") { if (name) { await sendTrialReady(phone, name, ct); await setState(conv.id, ST.MAIN_MENU); } else { await txt(phone, "🎉\n\n✏️ *Qual é o seu nome?*"); await setState(conv.id, ST.COLLECT_NAME, { trialInterest: true }); } return; }
      if (a === "go_demo") { if (name) { await sendDemoOffer(phone, name); await scheduleFollowUp(phone, 0, "demo"); await setState(conv.id, ST.MAIN_MENU); } else { await txt(phone, "📅\n\n✏️ *Qual é o seu nome?*"); await setState(conv.id, ST.COLLECT_NAME, { demoInterest: true }); } return; }
      if (a === "m_human") {
        await db.from("sales_chatbot_conversations").update({ is_human_takeover: true, updated_at: new Date().toISOString() }).eq("id", conv.id);
        await setState(conv.id, ST.HUMAN);
        await txt(phone, "Perfeito! 🤝 Um consultor entrará em contato em breve.\n\n⏰ *Atendimento:* Seg-Sáb, 8h às 18h");
        await scheduleFollowUp(phone, 0, "human_from_scoring"); return;
      }
      if (a === "m_features") { await setState(conv.id, ST.FEATURES_MENU, { viewedFeatures: true }); await sendFeaturesList(phone, ct); return; }
      if (a === "m_plans") { await setState(conv.id, ST.PLANS_MENU, { viewedPlans: true }); await sendPlansList(phone, ct); return; }
      await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct);
      return;
    }

    // ── AI Q&A ──
    case ST.AI_QA: {
      if (payload === "ai_continue") { await txt(phone, "💡 Pode enviar sua próxima pergunta:"); return; }
      if (payload === "back_menu" || input === "menu") { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); return; }
      if (payload === "go_trial") { if (name) { await sendTrialReady(phone, name, ct); await setState(conv.id, ST.MAIN_MENU); } else { await txt(phone, "🎉\n\n✏️ *Qual é o seu nome?*"); await setState(conv.id, ST.COLLECT_NAME, { trialInterest: true }); } return; }
      if (payload === "m_human") {
        await db.from("sales_chatbot_conversations").update({ is_human_takeover: true, updated_at: new Date().toISOString() }).eq("id", conv.id);
        await setState(conv.id, ST.HUMAN);
        await txt(phone, "🤝 Transferindo para consultor.\n\n⏰ Seg-Sáb, 8h às 18h");
        await scheduleFollowUp(phone, 0, "human_from_ai"); return;
      }

      try {
        const history = await getHistory(conv.id);
        const msgs = history.length <= 1
          ? [{ role: "user" as const, content: input }]
          : [...history, ...(history[history.length - 1].role !== "user" ? [{ role: "user" as const, content: input }] : [])];

        const result = await chatCompletion(
          msgs.map((m: any) => ({ role: m.role === "assistant" ? "model" as const : "user" as const, text: m.content })),
          { systemInstruction: aiPrompt(ct), maxTokens: 400, temperature: 0.5 },
        );
        const cleaned = String(result.text).replace(/\s*\[LEAD:[^\]]*\]\s*/g, "").trim();
        await txt(phone, cleaned);
        await saveMsg(conv.id, "outbound", cleaned);
        await btns(phone, "Deseja continuar?", [
          { id: "ai_continue", title: "💬 Nova pergunta" },
          { id: "go_trial", title: "🆓 Testar Grátis" },
          { id: "back_menu", title: "📋 Menu Principal" },
        ]);
      } catch (err: any) {
        console.error("[sales-chatbot] AI error:", String(err));
        await txt(phone, "Desculpe, não consegui processar. Vou conectar a um consultor.");
        await btns(phone, "Como continuar?", [
          { id: "ai_continue", title: "🔄 Tentar novamente" },
          { id: "m_human", title: "🤝 Falar c/ Consultor" },
          { id: "back_menu", title: "📋 Menu Principal" },
        ]);
      }
      return;
    }

    // ── HUMAN TAKEOVER ──
    case ST.HUMAN: return;

    // ── DEFAULT ──
    default: {
      if (ct) { await setState(conv.id, ST.MAIN_MENU); await sendMainMenu(phone, name, ct); }
      else { await setState(conv.id, ST.CLINIC_TYPE); await sendWelcome(phone); }
      return;
    }
  }
}

// ─── Webhook verification (GET) ──────────────────────────────────────────────
function handleVerify(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) { res.status(200).send(challenge); return; }
  res.status(403).send("Forbidden");
}

// ─── HTTP handler ────────────────────────────────────────────────────────────
export async function whatsappSalesChatbot(req: Request, res: Response) {
  try {
    if (req.method === "GET") { handleVerify(req, res); return; }

    // ── HMAC-SHA256 webhook signature verification ──
    const sig = req.headers["x-hub-signature-256"] as string | undefined;
    if (META_APP_SECRET && !verifyWebhookSignature((req as any).rawBody || JSON.stringify(req.body), sig)) {
      console.error("[whatsapp-sales-chatbot] Invalid webhook signature");
      res.status(401).json({ error: "Invalid signature" }); return;
    }

    const body = req.body;
    const extracted = extractMeta(body);

    if (!extracted) {
      if (body?.phone && body?.message) {
        const key = (req.headers["apikey"] as string) || (req.headers["x-api-key"] as string) || "";
        if (SALES_CHATBOT_SECRET && key !== SALES_CHATBOT_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
        const phone = normalizePhone(body.phone);
        const rl = await checkRateLimit(`sales-chatbot:${phone}`, 20, 60);
        if (!rl.allowed) { res.status(429).json({ error: "Too many messages" }); return; }
        await handleIncoming(phone, sanitizeInput(body.message));
        res.status(200).json({ ok: true }); return;
      }
      res.status(200).json({ ok: true, skipped: true }); return;
    }

    // 200 immediately for Meta
    res.status(200).json({ status: "ok" });

    const { from, text, messageId, btnPayload, listPayload, referral } = extracted;

    // ── Deduplication ──
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);
    if (processedMessages.size > DEDUP_MAX) processedMessages.clear();

    // ── Rate limiting ──
    const rl = await checkRateLimit(`sales-chatbot:${from}`, 20, 60);
    if (!rl.allowed) return;

    if (PHONE_ID && ACCESS_TOKEN) markMessageAsRead(PHONE_ID, ACCESS_TOKEN, messageId).catch(() => {});
    await handleIncoming(from, sanitizeInput(text), btnPayload || listPayload, referral);
  } catch (err: any) {
    console.error("[whatsapp-sales-chatbot] Error:", err.message || err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
}
