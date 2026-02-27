import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: validate-council-number
 *
 * Valida o número de registro de um conselho profissional.
 * Faz validação de formato e, quando disponível, consulta fontes oficiais.
 *
 * Body: { council_type: string, council_number: string, council_state: string }
 *
 * Retorna: { valid: boolean, professional_name?: string, message?: string }
 *
 * Conselhos suportados:
 * - CRM (Conselho Regional de Medicina) — consulta API pública do CFM
 * - CRO (Conselho Regional de Odontologia)
 * - COREN (Conselho Regional de Enfermagem)
 * - CREFITO (Conselho Regional de Fisioterapia e Terapia Ocupacional)
 * - CRN (Conselho Regional de Nutrição)
 * - CRP (Conselho Regional de Psicologia)
 * - CRFa (Conselho Regional de Fonoaudiologia)
 */

// Padrões de formato por conselho
const FORMAT_PATTERNS: Record<string, { pattern: RegExp; desc: string }> = {
  CRM:     { pattern: /^\d{4,7}$/, desc: "4 a 7 dígitos numéricos" },
  CRO:     { pattern: /^\d{3,7}$/, desc: "3 a 7 dígitos numéricos" },
  COREN:   { pattern: /^\d{3,9}$/, desc: "3 a 9 dígitos numéricos" },
  CREFITO: { pattern: /^\d{3,9}$/, desc: "3 a 9 dígitos numéricos" },
  CRN:     { pattern: /^\d{3,7}$/, desc: "3 a 7 dígitos numéricos" },
  CRP:     { pattern: /^\d{2}\/\d{3,6}$/, desc: "formato XX/XXXXX" },
  CRFa:    { pattern: /^\d{1,2}-\d{3,6}$/, desc: "formato X-XXXXX" },
};

const VALID_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function validateFormat(councilType: string, number: string): { valid: boolean; message: string } {
  const fmt = FORMAT_PATTERNS[councilType];
  if (!fmt) return { valid: true, message: "" }; // tipo desconhecido, aceitar
  if (!fmt.pattern.test(number)) {
    return { valid: false, message: `Formato inválido para ${councilType}. Esperado: ${fmt.desc}.` };
  }
  return { valid: true, message: "" };
}

/**
 * Tenta validar CRM consultando a API pública do CFM.
 * URL: https://portal.cfm.org.br/api/rest/medicos?crm={number}&uf={state}
 * 
 * NOTA: Esta API pode ter rate limits e não é oficialmente documentada.
 * Se não responder, a função retorna sucesso com validação somente de formato.
 */
async function validateCRM(number: string, state: string): Promise<{
  valid: boolean;
  professional_name?: string;
  message?: string;
}> {
  try {
    const url = `https://portal.cfm.org.br/api/rest/medicos?crm=${encodeURIComponent(number)}&uf=${encodeURIComponent(state)}&situacao=A`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ClinicNest/1.0",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      // API indisponível — aceitar com validação de formato
      return { valid: true };
    }

    const data = await response.json();
    
    // A API do CFM retorna array de resultados
    if (Array.isArray(data) && data.length > 0) {
      const medico = data[0];
      const nome = medico.nome || medico.nomeCompleto || medico.name;
      return { 
        valid: true, 
        professional_name: nome || undefined,
      };
    }
    
    // Se retorna lista vazia ou null, verificar se had `items` ou `data` wrapper
    const items = data?.items || data?.data || data?.results;
    if (Array.isArray(items) && items.length > 0) {
      const medico = items[0];
      return { 
        valid: true, 
        professional_name: medico.nome || medico.nomeCompleto || undefined,
      };
    }
    
    // Nenhum resultado encontrado
    return { 
      valid: false, 
      message: `CRM ${number}/${state} não encontrado nos registros ativos do CFM.`,
    };
  } catch {
    // Timeout ou erro de rede — aceitar com validação de formato apenas
    return { valid: true };
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { council_type, council_number, council_state } = body;

    if (!council_type || !council_number || !council_state) {
      return new Response(
        JSON.stringify({ valid: false, message: "council_type, council_number e council_state são obrigatórios." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const number = String(council_number).trim();
    const state = String(council_state).trim().toUpperCase();
    const type = String(council_type).trim().toUpperCase();

    // Validar UF
    if (!VALID_UFS.includes(state)) {
      return new Response(
        JSON.stringify({ valid: false, message: "UF inválida." }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Validar formato
    const formatResult = validateFormat(type, number);
    if (!formatResult.valid) {
      return new Response(
        JSON.stringify({ valid: false, message: formatResult.message }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Validação específica por conselho
    let result: { valid: boolean; professional_name?: string; message?: string };

    switch (type) {
      case "CRM":
        result = await validateCRM(number, state);
        break;
      // Adicionar outros conselhos aqui quando APIs forem disponibilizadas:
      // case "CRO": result = await validateCRO(number, state); break;
      // case "COREN": result = await validateCOREN(number, state); break;
      // case "CREFITO": result = await validateCREFITO(number, state); break;
      default:
        // Para conselhos sem API disponível, aceitar com formato válido
        result = { valid: true };
        break;
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, message: "Erro interno ao validar conselho." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
