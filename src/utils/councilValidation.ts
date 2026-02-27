import type { ProfessionalType } from '@/types/database';
import { COUNCIL_BY_TYPE } from '@/types/database';

// ────────────────────────────────────────────────────────────
// Formatos esperados por conselho profissional
// ────────────────────────────────────────────────────────────

/**
 * Regex de formato por tipo de conselho.
 * Aceita apenas dígitos, com min/max razoáveis para cada conselho.
 */
const COUNCIL_FORMAT: Record<string, { pattern: RegExp; description: string }> = {
  CRM:    { pattern: /^\d{4,7}$/, description: '4 a 7 dígitos numéricos' },
  CRO:    { pattern: /^\d{3,7}$/, description: '3 a 7 dígitos numéricos' },
  COREN:  { pattern: /^\d{3,9}$/, description: '3 a 9 dígitos numéricos' },
  CREFITO:{ pattern: /^\d{3,9}$/, description: '3 a 9 dígitos numéricos' },
  CRN:    { pattern: /^\d{3,7}$/, description: '3 a 7 dígitos numéricos' },
  CRP:    { pattern: /^\d{2}\/\d{3,6}$/, description: 'formato XX/XXXXX (região/número)' },
  CRFa:   { pattern: /^\d{1,2}-\d{3,6}$/, description: 'formato X-XXXXX (região-número)' },
};

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────

export interface CouncilValidationResult {
  valid: boolean;
  /** Mensagem de erro humana — vazia se válido */
  message: string;
  /** Se a validação foi feita apenas por formato (true) ou via API (false) */
  formatOnly: boolean;
}

// ────────────────────────────────────────────────────────────
// Funções de validação
// ────────────────────────────────────────────────────────────

/**
 * Verifica se um tipo profissional requer conselho de classe.
 */
export function requiresCouncil(professionalType: ProfessionalType): boolean {
  return professionalType in COUNCIL_BY_TYPE;
}

/**
 * Retorna o tipo de conselho para um tipo profissional.
 */
export function getCouncilType(professionalType: ProfessionalType): string | null {
  return COUNCIL_BY_TYPE[professionalType] ?? null;
}

/**
 * Valida o formato do número do conselho profissional.
 * Para CRM, CRO, COREN e CREFITO: apenas dígitos.
 * Para CRP: formato região/número.
 * Para CRFa: formato região-número.
 */
export function validateCouncilFormat(
  councilType: string,
  councilNumber: string,
): CouncilValidationResult {
  const cleaned = councilNumber.trim();

  if (!cleaned) {
    return { valid: false, message: `Número do ${councilType} é obrigatório.`, formatOnly: true };
  }

  const format = COUNCIL_FORMAT[councilType];
  if (!format) {
    // Conselho desconhecido — aceita qualquer valor não-vazio
    return { valid: true, message: '', formatOnly: true };
  }

  if (!format.pattern.test(cleaned)) {
    return {
      valid: false,
      message: `Formato inválido para ${councilType}. Esperado: ${format.description}.`,
      formatOnly: true,
    };
  }

  return { valid: true, message: '', formatOnly: true };
}

/**
 * Valida a UF do conselho.
 */
export function validateCouncilState(state: string): boolean {
  const validStates = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  ];
  return validStates.includes(state.toUpperCase());
}

/**
 * Validação completa: formato + UF.
 * Retorna a primeira mensagem de erro encontrada, ou string vazia se tudo ok.
 */
export function validateCouncilComplete(
  professionalType: ProfessionalType,
  councilNumber: string,
  councilState: string,
): string {
  const councilType = getCouncilType(professionalType);
  if (!councilType) return '';

  const formatResult = validateCouncilFormat(councilType, councilNumber);
  if (!formatResult.valid) return formatResult.message;

  if (!councilState || !validateCouncilState(councilState)) {
    return 'Selecione a UF do conselho.';
  }

  return '';
}

/**
 * Validação assíncrona que tenta verificar o registro via Edge Function.
 * Se a Edge Function não estiver disponível, faz apenas validação de formato.
 *
 * A Edge Function `validate-council-number` deve aceitar:
 *   { council_type, council_number, council_state }
 * E retornar:
 *   { valid: boolean, professional_name?: string, message?: string }
 */
export async function validateCouncilAsync(
  councilType: string,
  councilNumber: string,
  councilState: string,
): Promise<CouncilValidationResult> {
  // 1. Validação de formato local primeiro
  const formatResult = validateCouncilFormat(councilType, councilNumber);
  if (!formatResult.valid) return formatResult;

  if (!councilState || !validateCouncilState(councilState)) {
    return { valid: false, message: 'UF inválida.', formatOnly: true };
  }

  // 2. Tentar validação via Edge Function
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('validate-council-number', {
      body: {
        council_type: councilType,
        council_number: councilNumber.trim(),
        council_state: councilState.toUpperCase(),
      },
    });

    if (error || !data) {
      // Edge Function não disponível — aceitar com validação de formato apenas
      return { valid: true, message: '', formatOnly: true };
    }

    return {
      valid: data.valid === true,
      message: data.valid ? '' : (data.message || `${councilType} ${councilNumber}/${councilState} não encontrado nos registros oficiais.`),
      formatOnly: false,
    };
  } catch {
    // Fallback — aceitar com validação de formato apenas
    return { valid: true, message: '', formatOnly: true };
  }
}
