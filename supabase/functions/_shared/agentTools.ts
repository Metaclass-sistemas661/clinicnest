/**
 * Ferramentas disponíveis para o AI Agent dos profissionais.
 * Cada ferramenta consulta o Supabase dentro do tenant do usuário.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import type { ToolDefinition } from "./bedrock-client.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Definições de ferramentas (schema enviado ao Claude)
// ---------------------------------------------------------------------------

export const PROFESSIONAL_TOOLS: ToolDefinition[] = [
  {
    name: "buscar_pacientes",
    description:
      "Busca pacientes cadastrados pelo nome, CPF ou e-mail. Retorna lista com id, nome, telefone, e-mail, CPF e data de nascimento.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca (nome, CPF ou e-mail)" },
      },
      required: ["query"],
    },
  },
  {
    name: "dados_paciente",
    description:
      "Retorna dados cadastrais completos de um paciente: nome, contato, endereço, alergias, notas e data de nascimento.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID do paciente" },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "prontuario_paciente",
    description:
      "Retorna os últimos registros do prontuário médico de um paciente. Inclui queixa principal, anamnese, diagnóstico, CID, plano de tratamento e prescrições.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID do paciente" },
        limit: { type: "number", description: "Máximo de registros a retornar (padrão: 5)" },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "agenda_hoje",
    description:
      "Lista os agendamentos de hoje da clínica com nome do paciente, serviço, profissional, horário e status. Pode filtrar por profissional.",
    input_schema: {
      type: "object",
      properties: {
        professional_id: {
          type: "string",
          description: "UUID do profissional para filtrar (opcional)",
        },
      },
    },
  },
  {
    name: "agenda_paciente",
    description: "Lista os próximos agendamentos (futuros) de um paciente.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID do paciente" },
        limit: { type: "number", description: "Máximo de registros (padrão: 10)" },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "agendar_consulta",
    description:
      "Cria um novo agendamento. SEMPRE confirme os dados com o profissional antes de agendar. Precisa de paciente, serviço, profissional e data/hora.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID do paciente" },
        service_id: { type: "string", description: "UUID do serviço/procedimento" },
        professional_id: { type: "string", description: "UUID do profissional" },
        scheduled_at: { type: "string", description: "Data e hora ISO 8601 (ex: 2026-03-01T10:00:00)" },
        notes: { type: "string", description: "Observações (opcional)" },
      },
      required: ["patient_id", "service_id", "professional_id", "scheduled_at"],
    },
  },
  {
    name: "servicos_disponiveis",
    description:
      "Lista todos os serviços/procedimentos ativos da clínica com nome, preço e duração.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "resumo_financeiro",
    description:
      "Retorna resumo financeiro do período (receitas, despesas e saldo). Para profissionais admin.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Período: 'today', 'week' ou 'month' (padrão: 'month')",
        },
      },
    },
  },
];

export const PATIENT_TOOLS: ToolDefinition[] = [
  {
    name: "meus_agendamentos",
    description: "Lista os próximos agendamentos do paciente, incluindo serviço, profissional, data e status.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Máximo de registros (padrão: 10)" },
      },
    },
  },
  {
    name: "servicos_clinica",
    description: "Lista os serviços/procedimentos disponíveis na clínica com preço e duração.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "info_clinica",
    description: "Retorna informações da clínica: nome, telefone, e-mail e endereço.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Execução das ferramentas
// ---------------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  tenantId: string,
  _userId?: string,
  clientId?: string,
): Promise<string> {
  try {
    switch (toolName) {
      case "buscar_pacientes":
        return await searchPatients(supabase, tenantId, String(input.query ?? ""));
      case "dados_paciente":
        return await getPatientDetails(supabase, tenantId, String(input.patient_id));
      case "prontuario_paciente":
        return await getPatientRecords(supabase, tenantId, String(input.patient_id), Number(input.limit) || 5);
      case "agenda_hoje":
        return await getTodayAppointments(supabase, tenantId, input.professional_id ? String(input.professional_id) : undefined);
      case "agenda_paciente":
        return await getPatientAppointments(supabase, tenantId, String(input.patient_id), Number(input.limit) || 10);
      case "agendar_consulta":
        return await createAppointment(supabase, tenantId, input);
      case "servicos_disponiveis":
      case "servicos_clinica":
        return await getServices(supabase, tenantId);
      case "resumo_financeiro":
        return await getFinancialSummary(supabase, tenantId, String(input.period ?? "month"));
      case "meus_agendamentos":
        return clientId
          ? await getPatientAppointments(supabase, tenantId, clientId, Number(input.limit) || 10)
          : JSON.stringify({ error: "Paciente não identificado" });
      case "info_clinica":
        return await getClinicInfo(supabase, tenantId);
      default:
        return JSON.stringify({ error: `Ferramenta '${toolName}' não encontrada` });
    }
  } catch (err) {
    return JSON.stringify({ error: `Erro ao executar ${toolName}: ${(err as Error).message}` });
  }
}

// ---------------------------------------------------------------------------
// Implementação de cada ferramenta
// ---------------------------------------------------------------------------

async function searchPatients(sb: SupabaseClient, tenantId: string, query: string): Promise<string> {
  const q = query.replace(/[%_]/g, "");
  const { data, error } = await sb
    .from("clients")
    .select("id, name, phone, email, cpf, date_of_birth")
    .eq("tenant_id", tenantId)
    .or(`name.ilike.%${q}%,cpf.ilike.%${q}%,email.ilike.%${q}%`)
    .order("name")
    .limit(10);

  if (error) return JSON.stringify({ error: error.message });
  if (!data?.length) return JSON.stringify({ message: "Nenhum paciente encontrado.", patients: [] });
  return JSON.stringify({ total: data.length, patients: data });
}

async function getPatientDetails(sb: SupabaseClient, tenantId: string, patientId: string): Promise<string> {
  const { data, error } = await sb
    .from("clients")
    .select("id, name, phone, email, cpf, date_of_birth, allergies, notes, marital_status, city, state")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ error: "Paciente não encontrado" });
  return JSON.stringify(data);
}

async function getPatientRecords(
  sb: SupabaseClient,
  tenantId: string,
  patientId: string,
  limit: number,
): Promise<string> {
  const { data, error } = await sb
    .from("medical_records")
    .select(
      "id, record_date, chief_complaint, anamnesis, diagnosis, cid_code, treatment_plan, prescriptions, notes, professional_id",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", patientId)
    .order("record_date", { ascending: false })
    .limit(limit);

  if (error) return JSON.stringify({ error: error.message });
  if (!data?.length)
    return JSON.stringify({ message: "Nenhum registro de prontuário encontrado.", records: [] });
  return JSON.stringify({ total: data.length, records: data });
}

async function getTodayAppointments(
  sb: SupabaseClient,
  tenantId: string,
  professionalId?: string,
): Promise<string> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  let query = sb
    .from("appointments")
    .select(
      "id, scheduled_at, duration_minutes, status, price, notes, client_id, clients(name), service_id, services(name), professional_id, profiles(full_name)",
    )
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", startOfDay)
    .lt("scheduled_at", endOfDay)
    .order("scheduled_at");

  if (professionalId) {
    query = query.eq("professional_id", professionalId);
  }

  const { data, error } = await query.limit(50);

  if (error) return JSON.stringify({ error: error.message });
  if (!data?.length) return JSON.stringify({ message: "Nenhum agendamento hoje.", appointments: [] });

  // deno-lint-ignore no-explicit-any
  const cleaned = data.map((a: any) => ({
    id: a.id,
    horario: a.scheduled_at,
    duracao_min: a.duration_minutes,
    status: a.status,
    valor: a.price,
    paciente: a.clients?.name ?? "—",
    servico: a.services?.name ?? "—",
    profissional: a.profiles?.full_name ?? "—",
    observacoes: a.notes,
  }));

  return JSON.stringify({ total: cleaned.length, agendamentos: cleaned });
}

async function getPatientAppointments(
  sb: SupabaseClient,
  tenantId: string,
  patientId: string,
  limit: number,
): Promise<string> {
  const { data, error } = await sb
    .from("appointments")
    .select(
      "id, scheduled_at, duration_minutes, status, price, notes, service_id, services(name), professional_id, profiles(full_name)",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", patientId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(limit);

  if (error) return JSON.stringify({ error: error.message });
  if (!data?.length)
    return JSON.stringify({ message: "Nenhum agendamento futuro encontrado.", appointments: [] });

  // deno-lint-ignore no-explicit-any
  const cleaned = data.map((a: any) => ({
    id: a.id,
    horario: a.scheduled_at,
    duracao_min: a.duration_minutes,
    status: a.status,
    valor: a.price,
    servico: a.services?.name ?? "—",
    profissional: a.profiles?.full_name ?? "—",
    observacoes: a.notes,
  }));

  return JSON.stringify({ total: cleaned.length, agendamentos: cleaned });
}

async function createAppointment(
  sb: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { patient_id, service_id, professional_id, scheduled_at, notes } = input;

  // validação básica
  if (!patient_id || !service_id || !professional_id || !scheduled_at) {
    return JSON.stringify({ error: "Campos obrigatórios: patient_id, service_id, professional_id, scheduled_at" });
  }

  // Buscar duração e preço do serviço
  const { data: svc } = await sb
    .from("services")
    .select("duration_minutes, price")
    .eq("id", String(service_id))
    .maybeSingle();

  const { data, error } = await sb.from("appointments").insert({
    tenant_id: tenantId,
    client_id: String(patient_id),
    service_id: String(service_id),
    professional_id: String(professional_id),
    scheduled_at: String(scheduled_at),
    duration_minutes: svc?.duration_minutes ?? 30,
    price: svc?.price ?? 0,
    status: "pending",
    notes: notes ? String(notes) : null,
  }).select("id, scheduled_at, status").single();

  if (error) return JSON.stringify({ error: `Erro ao agendar: ${error.message}` });
  return JSON.stringify({ success: true, message: "Agendamento criado com sucesso!", appointment: data });
}

async function getServices(sb: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await sb
    .from("services")
    .select("id, name, price, duration_minutes, description")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (error) return JSON.stringify({ error: error.message });
  if (!data?.length) return JSON.stringify({ message: "Nenhum serviço cadastrado.", services: [] });
  return JSON.stringify({ total: data.length, services: data });
}

async function getFinancialSummary(
  sb: SupabaseClient,
  tenantId: string,
  period: string,
): Promise<string> {
  const now = new Date();
  let startDate: string;

  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      break;
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      break;
    }
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  const { data, error } = await sb
    .from("financial_transactions")
    .select("type, amount")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", startDate);

  if (error) return JSON.stringify({ error: error.message });

  let receitas = 0;
  let despesas = 0;
  for (const tx of data ?? []) {
    if (tx.type === "income") receitas += Number(tx.amount ?? 0);
    else despesas += Math.abs(Number(tx.amount ?? 0));
  }

  return JSON.stringify({
    periodo: period,
    inicio: startDate,
    receitas: receitas.toFixed(2),
    despesas: despesas.toFixed(2),
    saldo: (receitas - despesas).toFixed(2),
    total_transacoes: data?.length ?? 0,
  });
}

async function getClinicInfo(sb: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await sb
    .from("tenants")
    .select("name, phone, email, address")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ error: "Clínica não encontrada" });
  return JSON.stringify(data);
}
