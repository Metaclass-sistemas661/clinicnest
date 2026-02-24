// SNGPC - Alertas de Estoque Mínimo e Vencimento
// Sistema de monitoramento de medicamentos controlados

export interface ConfiguracaoAlerta {
  medicamentoCodigo: string;
  estoqueMinimo: number;
  diasAlertaVencimento: number;
  notificarEmail: boolean;
  notificarSistema: boolean;
  emailsDestino?: string[];
}

export interface AlertaEstoque {
  id: string;
  tipo: 'ESTOQUE_MINIMO' | 'VENCIMENTO_PROXIMO' | 'VENCIDO' | 'SEM_MOVIMENTACAO';
  prioridade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
  medicamento: {
    codigo: string;
    nome: string;
    lista: string;
  };
  lote?: string;
  mensagem: string;
  detalhes: {
    quantidadeAtual?: number;
    estoqueMinimo?: number;
    dataVencimento?: string;
    diasParaVencer?: number;
    ultimaMovimentacao?: string;
  };
  dataGeracao: string;
  lido: boolean;
  resolvido: boolean;
}

export interface ResumoAlertas {
  total: number;
  porTipo: Record<string, number>;
  porPrioridade: Record<string, number>;
  porLista: Record<string, number>;
  naoLidos: number;
  naoResolvidos: number;
}

// Verificar estoque mínimo
export function verificarEstoqueMinimo(
  estoque: {
    medicamentoCodigo: string;
    medicamentoNome: string;
    lista: string;
    quantidadeAtual: number;
  },
  estoqueMinimo: number
): AlertaEstoque | null {
  if (estoque.quantidadeAtual > estoqueMinimo) {
    return null;
  }
  
  const percentual = (estoque.quantidadeAtual / estoqueMinimo) * 100;
  let prioridade: AlertaEstoque['prioridade'];
  
  if (estoque.quantidadeAtual === 0) {
    prioridade = 'CRITICA';
  } else if (percentual <= 25) {
    prioridade = 'ALTA';
  } else if (percentual <= 50) {
    prioridade = 'MEDIA';
  } else {
    prioridade = 'BAIXA';
  }
  
  return {
    id: `EST-${estoque.medicamentoCodigo}-${Date.now()}`,
    tipo: 'ESTOQUE_MINIMO',
    prioridade,
    medicamento: {
      codigo: estoque.medicamentoCodigo,
      nome: estoque.medicamentoNome,
      lista: estoque.lista,
    },
    mensagem: estoque.quantidadeAtual === 0
      ? `ESTOQUE ZERADO: ${estoque.medicamentoNome}`
      : `Estoque abaixo do mínimo: ${estoque.medicamentoNome} (${estoque.quantidadeAtual}/${estoqueMinimo})`,
    detalhes: {
      quantidadeAtual: estoque.quantidadeAtual,
      estoqueMinimo,
    },
    dataGeracao: new Date().toISOString(),
    lido: false,
    resolvido: false,
  };
}

// Verificar vencimento
export function verificarVencimento(
  estoque: {
    medicamentoCodigo: string;
    medicamentoNome: string;
    lista: string;
    lote: string;
    dataVencimento: string;
    quantidadeAtual: number;
  },
  diasAlerta: number = 90
): AlertaEstoque | null {
  if (estoque.quantidadeAtual === 0) {
    return null;
  }
  
  const hoje = new Date();
  const vencimento = new Date(estoque.dataVencimento);
  const diasParaVencer = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diasParaVencer > diasAlerta) {
    return null;
  }
  
  let tipo: AlertaEstoque['tipo'];
  let prioridade: AlertaEstoque['prioridade'];
  let mensagem: string;
  
  if (diasParaVencer < 0) {
    tipo = 'VENCIDO';
    prioridade = 'CRITICA';
    mensagem = `VENCIDO HÁ ${Math.abs(diasParaVencer)} DIAS: ${estoque.medicamentoNome} - Lote ${estoque.lote}`;
  } else if (diasParaVencer === 0) {
    tipo = 'VENCIDO';
    prioridade = 'CRITICA';
    mensagem = `VENCE HOJE: ${estoque.medicamentoNome} - Lote ${estoque.lote}`;
  } else if (diasParaVencer <= 30) {
    tipo = 'VENCIMENTO_PROXIMO';
    prioridade = 'ALTA';
    mensagem = `Vence em ${diasParaVencer} dias: ${estoque.medicamentoNome} - Lote ${estoque.lote}`;
  } else if (diasParaVencer <= 60) {
    tipo = 'VENCIMENTO_PROXIMO';
    prioridade = 'MEDIA';
    mensagem = `Vence em ${diasParaVencer} dias: ${estoque.medicamentoNome} - Lote ${estoque.lote}`;
  } else {
    tipo = 'VENCIMENTO_PROXIMO';
    prioridade = 'BAIXA';
    mensagem = `Vence em ${diasParaVencer} dias: ${estoque.medicamentoNome} - Lote ${estoque.lote}`;
  }
  
  return {
    id: `VEN-${estoque.medicamentoCodigo}-${estoque.lote}-${Date.now()}`,
    tipo,
    prioridade,
    medicamento: {
      codigo: estoque.medicamentoCodigo,
      nome: estoque.medicamentoNome,
      lista: estoque.lista,
    },
    lote: estoque.lote,
    mensagem,
    detalhes: {
      quantidadeAtual: estoque.quantidadeAtual,
      dataVencimento: estoque.dataVencimento,
      diasParaVencer,
    },
    dataGeracao: new Date().toISOString(),
    lido: false,
    resolvido: false,
  };
}

// Verificar medicamentos sem movimentação
export function verificarSemMovimentacao(
  estoque: {
    medicamentoCodigo: string;
    medicamentoNome: string;
    lista: string;
    quantidadeAtual: number;
    ultimaMovimentacao: string;
  },
  diasSemMovimentacao: number = 180
): AlertaEstoque | null {
  if (estoque.quantidadeAtual === 0) {
    return null;
  }
  
  const hoje = new Date();
  const ultimaMov = new Date(estoque.ultimaMovimentacao);
  const diasSem = Math.ceil((hoje.getTime() - ultimaMov.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diasSem < diasSemMovimentacao) {
    return null;
  }
  
  return {
    id: `MOV-${estoque.medicamentoCodigo}-${Date.now()}`,
    tipo: 'SEM_MOVIMENTACAO',
    prioridade: diasSem > 365 ? 'ALTA' : 'MEDIA',
    medicamento: {
      codigo: estoque.medicamentoCodigo,
      nome: estoque.medicamentoNome,
      lista: estoque.lista,
    },
    mensagem: `Sem movimentação há ${diasSem} dias: ${estoque.medicamentoNome}`,
    detalhes: {
      quantidadeAtual: estoque.quantidadeAtual,
      ultimaMovimentacao: estoque.ultimaMovimentacao,
    },
    dataGeracao: new Date().toISOString(),
    lido: false,
    resolvido: false,
  };
}

// Gerar resumo de alertas
export function gerarResumoAlertas(alertas: AlertaEstoque[]): ResumoAlertas {
  const resumo: ResumoAlertas = {
    total: alertas.length,
    porTipo: {},
    porPrioridade: {},
    porLista: {},
    naoLidos: 0,
    naoResolvidos: 0,
  };
  
  alertas.forEach((alerta) => {
    // Por tipo
    resumo.porTipo[alerta.tipo] = (resumo.porTipo[alerta.tipo] || 0) + 1;
    
    // Por prioridade
    resumo.porPrioridade[alerta.prioridade] = (resumo.porPrioridade[alerta.prioridade] || 0) + 1;
    
    // Por lista
    resumo.porLista[alerta.medicamento.lista] = (resumo.porLista[alerta.medicamento.lista] || 0) + 1;
    
    // Contadores
    if (!alerta.lido) resumo.naoLidos++;
    if (!alerta.resolvido) resumo.naoResolvidos++;
  });
  
  return resumo;
}

// Ordenar alertas por prioridade
export function ordenarAlertasPorPrioridade(alertas: AlertaEstoque[]): AlertaEstoque[] {
  const ordemPrioridade: Record<string, number> = {
    CRITICA: 0,
    ALTA: 1,
    MEDIA: 2,
    BAIXA: 3,
  };
  
  return [...alertas].sort((a, b) => {
    // Primeiro por prioridade
    const prioridadeA = ordemPrioridade[a.prioridade] ?? 4;
    const prioridadeB = ordemPrioridade[b.prioridade] ?? 4;
    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }
    
    // Depois por data (mais recentes primeiro)
    return new Date(b.dataGeracao).getTime() - new Date(a.dataGeracao).getTime();
  });
}

// Filtrar alertas
export function filtrarAlertas(
  alertas: AlertaEstoque[],
  filtros: {
    tipo?: AlertaEstoque['tipo'];
    prioridade?: AlertaEstoque['prioridade'];
    lista?: string;
    apenasNaoLidos?: boolean;
    apenasNaoResolvidos?: boolean;
  }
): AlertaEstoque[] {
  return alertas.filter((alerta) => {
    if (filtros.tipo && alerta.tipo !== filtros.tipo) return false;
    if (filtros.prioridade && alerta.prioridade !== filtros.prioridade) return false;
    if (filtros.lista && alerta.medicamento.lista !== filtros.lista) return false;
    if (filtros.apenasNaoLidos && alerta.lido) return false;
    if (filtros.apenasNaoResolvidos && alerta.resolvido) return false;
    return true;
  });
}

// Gerar notificação por email
export function gerarEmailAlerta(alertas: AlertaEstoque[], estabelecimento: string): {
  assunto: string;
  corpo: string;
} {
  const criticos = alertas.filter((a) => a.prioridade === 'CRITICA');
  const altos = alertas.filter((a) => a.prioridade === 'ALTA');
  
  const assunto = criticos.length > 0
    ? `[URGENTE] ${criticos.length} alerta(s) crítico(s) de medicamentos controlados - ${estabelecimento}`
    : `${alertas.length} alerta(s) de medicamentos controlados - ${estabelecimento}`;
  
  let corpo = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .alerta { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .critica { background: #ffebee; border-left: 4px solid #c62828; }
    .alta { background: #fff3e0; border-left: 4px solid #ef6c00; }
    .media { background: #fff8e1; border-left: 4px solid #f9a825; }
    .baixa { background: #e3f2fd; border-left: 4px solid #1565c0; }
    .titulo { font-weight: bold; }
    .detalhes { font-size: 12px; color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <h2>Alertas de Medicamentos Controlados</h2>
  <p>Estabelecimento: <strong>${estabelecimento}</strong></p>
  <p>Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
  
  <h3>Resumo</h3>
  <ul>
    <li>Total de alertas: ${alertas.length}</li>
    <li>Críticos: ${criticos.length}</li>
    <li>Alta prioridade: ${altos.length}</li>
  </ul>
  
  <h3>Alertas</h3>
`;
  
  const alertasOrdenados = ordenarAlertasPorPrioridade(alertas);
  
  alertasOrdenados.forEach((alerta) => {
    const classe = alerta.prioridade.toLowerCase();
    corpo += `
  <div class="alerta ${classe}">
    <div class="titulo">[${alerta.prioridade}] ${alerta.mensagem}</div>
    <div class="detalhes">
      Lista: ${alerta.medicamento.lista} | 
      ${alerta.lote ? `Lote: ${alerta.lote} | ` : ''}
      Gerado em: ${new Date(alerta.dataGeracao).toLocaleString('pt-BR')}
    </div>
  </div>`;
  });
  
  corpo += `
  <hr>
  <p style="font-size: 11px; color: #999;">
    Este é um email automático do sistema SNGPC. 
    Por favor, não responda a este email.
  </p>
</body>
</html>`;
  
  return { assunto, corpo };
}

// Configurações padrão de alerta por lista
export const CONFIGURACOES_PADRAO_ALERTA: Record<string, {
  estoqueMinimo: number;
  diasAlertaVencimento: number;
}> = {
  A1: { estoqueMinimo: 5, diasAlertaVencimento: 90 },
  A2: { estoqueMinimo: 5, diasAlertaVencimento: 90 },
  A3: { estoqueMinimo: 10, diasAlertaVencimento: 90 },
  B1: { estoqueMinimo: 20, diasAlertaVencimento: 60 },
  B2: { estoqueMinimo: 10, diasAlertaVencimento: 60 },
  C1: { estoqueMinimo: 30, diasAlertaVencimento: 60 },
  C2: { estoqueMinimo: 10, diasAlertaVencimento: 90 },
  C3: { estoqueMinimo: 5, diasAlertaVencimento: 90 },
  C4: { estoqueMinimo: 20, diasAlertaVencimento: 60 },
  C5: { estoqueMinimo: 10, diasAlertaVencimento: 60 },
};
