// SNGPC - Index consolidado de medicamentos controlados
// Portaria 344/98 - ANVISA

import {
  MedicamentoControlado,
  ListaControlada,
  ListaInfo,
  TipoReceituario,
  LISTAS_CONTROLADAS,
  LISTA_A1,
  LISTA_A2,
  LISTA_A3,
} from './sngpc-controlados';

import { LISTA_B1, LISTA_B2, SUBSTANCIAS_B2_PROIBIDAS } from './sngpc-controlados-2';
import { LISTA_C1, LISTA_C2, LISTA_C3, LISTA_C4, LISTA_C5 } from './sngpc-controlados-3';

// Re-exportar tipos
export type { MedicamentoControlado, ListaControlada, ListaInfo, TipoReceituario };
export { LISTAS_CONTROLADAS, SUBSTANCIAS_B2_PROIBIDAS };

// Consolidar todos os medicamentos
export const MEDICAMENTOS_CONTROLADOS: MedicamentoControlado[] = [
  ...LISTA_A1,
  ...LISTA_A2,
  ...LISTA_A3,
  ...LISTA_B1,
  ...LISTA_B2,
  ...LISTA_C1,
  ...LISTA_C2,
  ...LISTA_C3,
  ...LISTA_C4,
  ...LISTA_C5,
];

// Exportar listas individuais
export {
  LISTA_A1,
  LISTA_A2,
  LISTA_A3,
  LISTA_B1,
  LISTA_B2,
  LISTA_C1,
  LISTA_C2,
  LISTA_C3,
  LISTA_C4,
  LISTA_C5,
};

// Map para busca rápida por código
export const CONTROLADOS_MAP = new Map<string, MedicamentoControlado>(
  MEDICAMENTOS_CONTROLADOS.map((m) => [m.codigo, m])
);

// Map para busca por nome
export const CONTROLADOS_NOME_MAP = new Map<string, MedicamentoControlado>(
  MEDICAMENTOS_CONTROLADOS.map((m) => [m.nome.toLowerCase(), m])
);

// Busca por nome ou código
export function searchMedicamentosControlados(
  query: string,
  limit = 20
): MedicamentoControlado[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return MEDICAMENTOS_CONTROLADOS.filter(
    (m) =>
      m.nome.toLowerCase().includes(q) ||
      m.codigo.toLowerCase().includes(q)
  ).slice(0, limit);
}

// Busca por lista específica
export function getMedicamentosByLista(lista: ListaControlada): MedicamentoControlado[] {
  return MEDICAMENTOS_CONTROLADOS.filter((m) => m.lista === lista);
}

// Obter informações da lista
export function getListaInfo(lista: ListaControlada): ListaInfo {
  return LISTAS_CONTROLADAS[lista];
}

// Obter tipo de receituário necessário
export function getTipoReceituario(medicamento: MedicamentoControlado): TipoReceituario {
  return LISTAS_CONTROLADAS[medicamento.lista].receituario;
}

// Verificar se medicamento requer notificação de receita
export function requerNotificacaoReceita(medicamento: MedicamentoControlado): boolean {
  return ['A1', 'A2', 'A3', 'B1', 'B2'].includes(medicamento.lista);
}

// Verificar se medicamento requer receita amarela
export function requerReceitaAmarela(medicamento: MedicamentoControlado): boolean {
  return ['A1', 'A2', 'A3'].includes(medicamento.lista);
}

// Verificar se medicamento requer receita azul
export function requerReceitaAzul(medicamento: MedicamentoControlado): boolean {
  return ['B1', 'B2'].includes(medicamento.lista);
}

// Verificar se medicamento é entorpecente
export function isEntorpecente(medicamento: MedicamentoControlado): boolean {
  return ['A1', 'A2'].includes(medicamento.lista);
}

// Verificar se medicamento é psicotrópico
export function isPsicotropico(medicamento: MedicamentoControlado): boolean {
  return ['A3', 'B1', 'B2'].includes(medicamento.lista);
}

// Verificar se medicamento é anabolizante
export function isAnabolizante(medicamento: MedicamentoControlado): boolean {
  return medicamento.lista === 'C5';
}

// Verificar se medicamento é anti-retroviral
export function isAntiRetroviral(medicamento: MedicamentoControlado): boolean {
  return medicamento.lista === 'C4';
}

// Estatísticas
export const CONTROLADOS_STATS = {
  total: MEDICAMENTOS_CONTROLADOS.length,
  porLista: {
    A1: LISTA_A1.length,
    A2: LISTA_A2.length,
    A3: LISTA_A3.length,
    B1: LISTA_B1.length,
    B2: LISTA_B2.length,
    C1: LISTA_C1.length,
    C2: LISTA_C2.length,
    C3: LISTA_C3.length,
    C4: LISTA_C4.length,
    C5: LISTA_C5.length,
  },
  entorpecentes: LISTA_A1.length + LISTA_A2.length,
  psicotropicos: LISTA_A3.length + LISTA_B1.length + LISTA_B2.length,
  outrasControladas: LISTA_C1.length + LISTA_C2.length + LISTA_C3.length + LISTA_C4.length + LISTA_C5.length,
};

// Verificar se substância B2 é PROIBIDA pela ANVISA
export function isSubstanciaB2Proibida(nomeSubstancia: string): boolean {
  const nomeLower = nomeSubstancia.toLowerCase();
  return SUBSTANCIAS_B2_PROIBIDAS.some(
    (proibida) => nomeLower.includes(proibida.toLowerCase())
  );
}

// Validação de prescrição
export interface ValidacaoPrescricao {
  valido: boolean;
  erros: string[];
  avisos: string[];
  tipoReceituario: TipoReceituario;
  corReceita: string;
  validadeReceita: number;
  quantidadeMaxima: string;
  requerTermo?: 'SIBUTRAMINA' | 'RETINOIDE' | 'TALIDOMIDA';
}

export function validarPrescricaoControlado(
  medicamento: MedicamentoControlado,
  quantidadeDias: number,
  pacienteSexo?: 'M' | 'F',
  pacienteIdade?: number
): ValidacaoPrescricao {
  const listaInfo = LISTAS_CONTROLADAS[medicamento.lista];
  const erros: string[] = [];
  const avisos: string[] = [];
  let requerTermo: ValidacaoPrescricao['requerTermo'] = undefined;

  // ⚠️ VALIDAÇÃO CRÍTICA: Bloquear substâncias B2 PROIBIDAS
  if (isSubstanciaB2Proibida(medicamento.nome)) {
    erros.push(`SUBSTÂNCIA PROIBIDA PELA ANVISA: ${medicamento.nome} teve fabricação, importação, prescrição e venda proibidas pela RDC ANVISA 2023. Não é permitido prescrever este medicamento.`);
    return {
      valido: false,
      erros,
      avisos,
      tipoReceituario: listaInfo.receituario,
      corReceita: listaInfo.corReceita,
      validadeReceita: listaInfo.validadeReceita,
      quantidadeMaxima: listaInfo.quantidadeMaxima,
    };
  }

  // Validar quantidade máxima
  const maxDias = medicamento.lista === 'B1' || medicamento.lista === 'C1' || 
                  medicamento.lista === 'C4' || medicamento.lista === 'C5' ? 60 : 30;
  
  if (quantidadeDias > maxDias) {
    erros.push(`Quantidade máxima para ${medicamento.lista} é ${maxDias} dias de tratamento`);
  }

  // Validações específicas para Sibutramina (B2)
  if (medicamento.nome.toLowerCase().includes('sibutramina')) {
    requerTermo = 'SIBUTRAMINA';
    avisos.push('OBRIGATÓRIO: Termo de Responsabilidade do Prescritor (RDC 52/2011)');
    avisos.push('Verificar contraindicações cardiovasculares antes de prescrever');
    if (pacienteIdade && pacienteIdade > 65) {
      erros.push('Sibutramina contraindicada para pacientes acima de 65 anos');
    }
  }

  // Validações específicas para retinoides (C2)
  if (medicamento.lista === 'C2') {
    requerTermo = 'RETINOIDE';
    avisos.push('OBRIGATÓRIO: Termo de Consentimento para Retinoides');
    if (pacienteSexo === 'F') {
      avisos.push('Paciente feminina: EXIGIR teste de gravidez negativo');
      avisos.push('Orientar sobre contracepção obrigatória durante e 1 mês após tratamento');
      avisos.push('RISCO TERATOGÊNICO: malformações fetais graves');
    }
  }

  // Validações específicas para talidomida (C3)
  if (medicamento.lista === 'C3') {
    requerTermo = 'TALIDOMIDA';
    avisos.push('OBRIGATÓRIO: Termo de Consentimento do Programa de Talidomida do MS');
    avisos.push('Uso restrito a programas específicos do Ministério da Saúde');
    if (pacienteSexo === 'F') {
      erros.push('Talidomida: EXIGIR contracepção adequada e teste de gravidez negativo');
      avisos.push('RISCO TERATOGÊNICO GRAVE: focomelia e outras malformações');
    }
  }

  // Validações para anabolizantes (C5)
  if (medicamento.lista === 'C5') {
    if (pacienteIdade && pacienteIdade < 18) {
      avisos.push('Paciente menor de idade: avaliar indicação criteriosa');
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    tipoReceituario: listaInfo.receituario,
    corReceita: listaInfo.corReceita,
    validadeReceita: listaInfo.validadeReceita,
    quantidadeMaxima: listaInfo.quantidadeMaxima,
    requerTermo,
  };
}
