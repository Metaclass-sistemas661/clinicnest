/**
 * Motor de variáveis dinâmicas para templates de termos/contratos.
 * Substitui placeholders {{variavel}} pelos dados reais do paciente.
 */

export interface ConsentVariablesData {
  // Paciente
  nome_paciente?: string;
  cpf?: string;
  data_nascimento?: string;
  email?: string;
  telefone?: string;
  endereco_completo?: string;
  // Clínica
  nome_clinica?: string;
  cnpj_clinica?: string;
  endereco_clinica?: string;
  responsavel_tecnico?: string;
  crm_responsavel?: string;
  // Contexto
  data_hoje?: string;
  cidade?: string;
  estado?: string;
}

const VARIABLE_DEFINITIONS: { key: string; label: string; example: string }[] = [
  { key: "nome_paciente", label: "Nome completo do paciente", example: "Maria da Silva" },
  { key: "cpf", label: "CPF do paciente", example: "123.456.789-00" },
  { key: "data_nascimento", label: "Data de nascimento", example: "01/01/1990" },
  { key: "email", label: "E-mail do paciente", example: "maria@email.com" },
  { key: "telefone", label: "Telefone do paciente", example: "(11) 99999-0000" },
  { key: "endereco_completo", label: "Endereço completo do paciente", example: "Rua A, 123 - São Paulo/SP" },
  { key: "nome_clinica", label: "Nome da clínica", example: "Clínica Saúde Plena" },
  { key: "cnpj_clinica", label: "CNPJ da clínica", example: "12.345.678/0001-00" },
  { key: "endereco_clinica", label: "Endereço da clínica", example: "Av. Brasil, 500 - Centro" },
  { key: "responsavel_tecnico", label: "Responsável técnico", example: "Dr. João da Silva" },
  { key: "crm_responsavel", label: "CRM do responsável", example: "CRM/SP 123456" },
  { key: "data_hoje", label: "Data atual (assinatura)", example: "21/02/2026" },
  { key: "cidade", label: "Cidade da clínica", example: "São Paulo" },
  { key: "estado", label: "Estado (UF)", example: "SP" },
];

export function getAvailableVariables() {
  return VARIABLE_DEFINITIONS;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function replaceVariables(html: string, data: ConsentVariablesData): string {
  let result = html;
  for (const def of VARIABLE_DEFINITIONS) {
    const value = data[def.key as keyof ConsentVariablesData];
    const display = value ? escapeHtml(value) : `[${def.label}]`;
    result = result.replace(new RegExp(`\\{\\{${def.key}\\}\\}`, "g"), display);
  }
  return result;
}

export function buildVariablesFromClientAndTenant(
  client: {
    name?: string; cpf?: string; date_of_birth?: string; birth_date?: string;
    email?: string; phone?: string;
    street?: string; street_number?: string; neighborhood?: string;
    city?: string; state?: string; zip_code?: string;
    address_street?: string; address_city?: string; address_state?: string; address_zip?: string;
  } | null,
  tenant: {
    name?: string; cnpj?: string; address?: string;
    responsible_doctor?: string; responsible_crm?: string;
  } | null
): ConsentVariablesData {
  const addressParts: string[] = [];
  if (client?.street || client?.address_street) {
    addressParts.push(client.street || client.address_street || "");
    if (client.street_number) addressParts[0] += `, ${client.street_number}`;
  }
  if (client?.neighborhood) addressParts.push(client.neighborhood);
  const city = client?.city || client?.address_city || "";
  const state = client?.state || client?.address_state || "";
  if (city) addressParts.push(`${city}/${state}`);

  const dob = client?.date_of_birth || client?.birth_date;
  const formattedDob = dob
    ? new Date(dob).toLocaleDateString("pt-BR")
    : undefined;

  return {
    nome_paciente: client?.name,
    cpf: client?.cpf ?? undefined,
    data_nascimento: formattedDob,
    email: client?.email ?? undefined,
    telefone: client?.phone ?? undefined,
    endereco_completo: addressParts.length > 0 ? addressParts.join(" - ") : undefined,
    nome_clinica: tenant?.name,
    cnpj_clinica: tenant?.cnpj ?? undefined,
    endereco_clinica: tenant?.address ?? undefined,
    responsavel_tecnico: tenant?.responsible_doctor ?? undefined,
    crm_responsavel: tenant?.responsible_crm ?? undefined,
    data_hoje: new Date().toLocaleDateString("pt-BR"),
    cidade: city || undefined,
    estado: state || undefined,
  };
}
