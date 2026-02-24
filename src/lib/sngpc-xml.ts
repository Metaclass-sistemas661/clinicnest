// SNGPC - Geração de XML para transmissão à ANVISA
// Formato conforme especificação técnica SNGPC v2.0

export interface DadosEstabelecimento {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  autorizacaoAnvisa: string;
  responsavelTecnico: string;
  crf: string;
}

export interface MovimentacaoSNGPC {
  dataMovimentacao: string;
  tipoMovimentacao: 'E' | 'S'; // Entrada ou Saída
  tipoOperacao: string;
  medicamento: {
    codigoAnvisa: string;
    nome: string;
    apresentacao: string;
    lista: string;
  };
  quantidade: number;
  lote: string;
  dataValidade: string;
  notaFiscal?: string;
  fornecedorCnpj?: string;
  pacienteNome?: string;
  pacienteCpf?: string;
  prescritorNome?: string;
  prescritorCrm?: string;
  prescritorUf?: string;
  numeroReceita?: string;
  dataReceita?: string;
  compradorNome?: string;
  compradorRg?: string;
  motivoPerda?: string;
}

export interface ArquivoSNGPC {
  estabelecimento: DadosEstabelecimento;
  periodoInicio: string;
  periodoFim: string;
  movimentacoes: MovimentacaoSNGPC[];
}

// Códigos de tipo de operação SNGPC
export const TIPOS_OPERACAO_SNGPC = {
  // Entradas
  COMPRA: '1',
  TRANSFERENCIA_ENTRADA: '2',
  DEVOLUCAO_CLIENTE: '3',
  PRODUCAO: '4',
  TRANSFORMACAO: '5',
  
  // Saídas
  VENDA: '10',
  TRANSFERENCIA_SAIDA: '11',
  PERDA: '12',
  ROUBO_FURTO: '13',
  APREENSAO: '14',
  VENCIMENTO: '15',
  DEVOLUCAO_FORNECEDOR: '16',
  INCINERACAO: '17',
};

// Gerar cabeçalho XML
function gerarCabecalhoXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>`;
}

// Escapar caracteres especiais XML
function escapeXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Formatar data para SNGPC (AAAA-MM-DD)
function formatarData(data: string): string {
  const d = new Date(data);
  return d.toISOString().split('T')[0];
}

// Formatar CNPJ (apenas números)
function formatarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

// Formatar CPF (apenas números)
function formatarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// Gerar XML de movimentação individual
function gerarMovimentacaoXML(mov: MovimentacaoSNGPC, index: number): string {
  const isEntrada = mov.tipoMovimentacao === 'E';
  
  let xml = `
    <movimentacao sequencial="${index + 1}">
      <dataMovimentacao>${formatarData(mov.dataMovimentacao)}</dataMovimentacao>
      <tipoMovimentacao>${mov.tipoMovimentacao}</tipoMovimentacao>
      <tipoOperacao>${mov.tipoOperacao}</tipoOperacao>
      <medicamento>
        <codigoAnvisa>${escapeXML(mov.medicamento.codigoAnvisa)}</codigoAnvisa>
        <nome>${escapeXML(mov.medicamento.nome)}</nome>
        <apresentacao>${escapeXML(mov.medicamento.apresentacao)}</apresentacao>
        <lista>${escapeXML(mov.medicamento.lista)}</lista>
      </medicamento>
      <quantidade>${mov.quantidade}</quantidade>
      <lote>${escapeXML(mov.lote)}</lote>
      <dataValidade>${formatarData(mov.dataValidade)}</dataValidade>`;
  
  if (isEntrada) {
    if (mov.notaFiscal) {
      xml += `
      <notaFiscal>${escapeXML(mov.notaFiscal)}</notaFiscal>`;
    }
    if (mov.fornecedorCnpj) {
      xml += `
      <fornecedor>
        <cnpj>${formatarCNPJ(mov.fornecedorCnpj)}</cnpj>
      </fornecedor>`;
    }
  } else {
    // Saída - dados do paciente/comprador
    if (mov.pacienteNome) {
      xml += `
      <paciente>
        <nome>${escapeXML(mov.pacienteNome)}</nome>
        ${mov.pacienteCpf ? `<cpf>${formatarCPF(mov.pacienteCpf)}</cpf>` : ''}
      </paciente>`;
    }
    
    if (mov.prescritorNome) {
      xml += `
      <prescritor>
        <nome>${escapeXML(mov.prescritorNome)}</nome>
        <crm>${escapeXML(mov.prescritorCrm || '')}</crm>
        <uf>${escapeXML(mov.prescritorUf || '')}</uf>
      </prescritor>`;
    }
    
    if (mov.numeroReceita) {
      xml += `
      <receita>
        <numero>${escapeXML(mov.numeroReceita)}</numero>
        ${mov.dataReceita ? `<data>${formatarData(mov.dataReceita)}</data>` : ''}
      </receita>`;
    }
    
    if (mov.compradorNome) {
      xml += `
      <comprador>
        <nome>${escapeXML(mov.compradorNome)}</nome>
        ${mov.compradorRg ? `<rg>${escapeXML(mov.compradorRg)}</rg>` : ''}
      </comprador>`;
    }
    
    if (mov.motivoPerda) {
      xml += `
      <motivoPerda>${escapeXML(mov.motivoPerda)}</motivoPerda>`;
    }
  }
  
  xml += `
    </movimentacao>`;
  
  return xml;
}

// Gerar XML completo do arquivo SNGPC
export function gerarArquivoSNGPCXML(dados: ArquivoSNGPC): string {
  const { estabelecimento, periodoInicio, periodoFim, movimentacoes } = dados;
  
  const dataGeracao = new Date().toISOString();
  
  let xml = gerarCabecalhoXML();
  
  xml += `
<sngpc versao="2.0" xmlns="http://www.anvisa.gov.br/sngpc">
  <cabecalho>
    <dataGeracao>${dataGeracao}</dataGeracao>
    <periodoInicio>${formatarData(periodoInicio)}</periodoInicio>
    <periodoFim>${formatarData(periodoFim)}</periodoFim>
    <totalMovimentacoes>${movimentacoes.length}</totalMovimentacoes>
  </cabecalho>
  
  <estabelecimento>
    <cnpj>${formatarCNPJ(estabelecimento.cnpj)}</cnpj>
    <razaoSocial>${escapeXML(estabelecimento.razaoSocial)}</razaoSocial>
    <nomeFantasia>${escapeXML(estabelecimento.nomeFantasia)}</nomeFantasia>
    <endereco>
      <logradouro>${escapeXML(estabelecimento.endereco)}</logradouro>
      <numero>${escapeXML(estabelecimento.numero)}</numero>
      ${estabelecimento.complemento ? `<complemento>${escapeXML(estabelecimento.complemento)}</complemento>` : ''}
      <bairro>${escapeXML(estabelecimento.bairro)}</bairro>
      <cidade>${escapeXML(estabelecimento.cidade)}</cidade>
      <uf>${escapeXML(estabelecimento.uf)}</uf>
      <cep>${estabelecimento.cep.replace(/\D/g, '')}</cep>
    </endereco>
    <telefone>${estabelecimento.telefone.replace(/\D/g, '')}</telefone>
    <email>${escapeXML(estabelecimento.email)}</email>
    <autorizacaoAnvisa>${escapeXML(estabelecimento.autorizacaoAnvisa)}</autorizacaoAnvisa>
    <responsavelTecnico>
      <nome>${escapeXML(estabelecimento.responsavelTecnico)}</nome>
      <crf>${escapeXML(estabelecimento.crf)}</crf>
    </responsavelTecnico>
  </estabelecimento>
  
  <movimentacoes>`;
  
  movimentacoes.forEach((mov, index) => {
    xml += gerarMovimentacaoXML(mov, index);
  });
  
  xml += `
  </movimentacoes>
</sngpc>`;
  
  return xml;
}

// Gerar resumo do arquivo para validação
export function gerarResumoArquivo(dados: ArquivoSNGPC): {
  totalMovimentacoes: number;
  entradas: number;
  saidas: number;
  porLista: Record<string, { entradas: number; saidas: number }>;
  porTipoOperacao: Record<string, number>;
} {
  const resumo = {
    totalMovimentacoes: dados.movimentacoes.length,
    entradas: 0,
    saidas: 0,
    porLista: {} as Record<string, { entradas: number; saidas: number }>,
    porTipoOperacao: {} as Record<string, number>,
  };
  
  dados.movimentacoes.forEach((mov) => {
    // Contagem geral
    if (mov.tipoMovimentacao === 'E') {
      resumo.entradas++;
    } else {
      resumo.saidas++;
    }
    
    // Por lista
    const lista = mov.medicamento.lista;
    if (!resumo.porLista[lista]) {
      resumo.porLista[lista] = { entradas: 0, saidas: 0 };
    }
    if (mov.tipoMovimentacao === 'E') {
      resumo.porLista[lista].entradas++;
    } else {
      resumo.porLista[lista].saidas++;
    }
    
    // Por tipo de operação
    const tipoOp = mov.tipoOperacao;
    resumo.porTipoOperacao[tipoOp] = (resumo.porTipoOperacao[tipoOp] || 0) + 1;
  });
  
  return resumo;
}

// Validar arquivo antes de gerar
export function validarArquivoSNGPC(dados: ArquivoSNGPC): {
  valido: boolean;
  erros: string[];
  avisos: string[];
} {
  const erros: string[] = [];
  const avisos: string[] = [];
  
  // Validar estabelecimento
  if (!dados.estabelecimento.cnpj || dados.estabelecimento.cnpj.replace(/\D/g, '').length !== 14) {
    erros.push('CNPJ do estabelecimento inválido');
  }
  if (!dados.estabelecimento.autorizacaoAnvisa) {
    erros.push('Autorização ANVISA não informada');
  }
  if (!dados.estabelecimento.responsavelTecnico) {
    erros.push('Responsável técnico não informado');
  }
  if (!dados.estabelecimento.crf) {
    erros.push('CRF do responsável técnico não informado');
  }
  
  // Validar período
  const inicio = new Date(dados.periodoInicio);
  const fim = new Date(dados.periodoFim);
  if (inicio > fim) {
    erros.push('Data de início maior que data de fim');
  }
  
  // Validar movimentações
  dados.movimentacoes.forEach((mov, index) => {
    const prefixo = `Movimentação ${index + 1}:`;
    
    if (!mov.medicamento.codigoAnvisa) {
      avisos.push(`${prefixo} Código ANVISA não informado`);
    }
    if (!mov.lote) {
      erros.push(`${prefixo} Lote não informado`);
    }
    if (mov.quantidade <= 0) {
      erros.push(`${prefixo} Quantidade deve ser maior que zero`);
    }
    
    // Validações específicas para saídas
    if (mov.tipoMovimentacao === 'S') {
      if (mov.tipoOperacao === TIPOS_OPERACAO_SNGPC.VENDA) {
        if (!mov.pacienteNome) {
          erros.push(`${prefixo} Nome do paciente obrigatório para venda`);
        }
        if (!mov.prescritorNome || !mov.prescritorCrm) {
          erros.push(`${prefixo} Dados do prescritor obrigatórios para venda`);
        }
        if (!mov.numeroReceita) {
          erros.push(`${prefixo} Número da receita obrigatório para venda`);
        }
      }
      
      if (mov.tipoOperacao === TIPOS_OPERACAO_SNGPC.PERDA || 
          mov.tipoOperacao === TIPOS_OPERACAO_SNGPC.ROUBO_FURTO) {
        if (!mov.motivoPerda) {
          erros.push(`${prefixo} Motivo da perda obrigatório`);
        }
      }
    }
    
    // Validações específicas para entradas
    if (mov.tipoMovimentacao === 'E') {
      if (mov.tipoOperacao === TIPOS_OPERACAO_SNGPC.COMPRA) {
        if (!mov.notaFiscal) {
          avisos.push(`${prefixo} Nota fiscal não informada`);
        }
        if (!mov.fornecedorCnpj) {
          avisos.push(`${prefixo} CNPJ do fornecedor não informado`);
        }
      }
    }
  });
  
  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

// Gerar nome do arquivo conforme padrão ANVISA
export function gerarNomeArquivoSNGPC(
  cnpj: string,
  periodoInicio: string,
  periodoFim: string
): string {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const inicio = periodoInicio.replace(/-/g, '');
  const fim = periodoFim.replace(/-/g, '');
  const timestamp = Date.now();
  
  return `SNGPC_${cnpjLimpo}_${inicio}_${fim}_${timestamp}.xml`;
}

// Converter movimentação do banco para formato SNGPC
export function converterMovimentacaoParaSNGPC(
  movimentacao: {
    data_movimentacao: string;
    tipo_movimentacao: string;
    quantidade: number;
    medicamento_codigo: string;
    medicamento_nome: string;
    lista: string;
    lote: string;
    data_validade: string;
    nota_fiscal?: string;
    fornecedor_cnpj?: string;
    paciente_nome?: string;
    paciente_cpf?: string;
    prescriptor_nome?: string;
    prescriptor_crm?: string;
    numero_receita?: string;
    comprador_nome?: string;
    comprador_rg?: string;
    motivo_perda?: string;
  }
): MovimentacaoSNGPC {
  // Mapear tipo de movimentação do banco para SNGPC
  const tipoMap: Record<string, { tipo: 'E' | 'S'; operacao: string }> = {
    ENTRADA_COMPRA: { tipo: 'E', operacao: TIPOS_OPERACAO_SNGPC.COMPRA },
    ENTRADA_TRANSFERENCIA: { tipo: 'E', operacao: TIPOS_OPERACAO_SNGPC.TRANSFERENCIA_ENTRADA },
    ENTRADA_DEVOLUCAO: { tipo: 'E', operacao: TIPOS_OPERACAO_SNGPC.DEVOLUCAO_CLIENTE },
    SAIDA_DISPENSACAO: { tipo: 'S', operacao: TIPOS_OPERACAO_SNGPC.VENDA },
    SAIDA_PERDA: { tipo: 'S', operacao: TIPOS_OPERACAO_SNGPC.PERDA },
    SAIDA_VENCIMENTO: { tipo: 'S', operacao: TIPOS_OPERACAO_SNGPC.VENCIMENTO },
    SAIDA_TRANSFERENCIA: { tipo: 'S', operacao: TIPOS_OPERACAO_SNGPC.TRANSFERENCIA_SAIDA },
    SAIDA_APREENSAO: { tipo: 'S', operacao: TIPOS_OPERACAO_SNGPC.APREENSAO },
  };
  
  const mapeamento = tipoMap[movimentacao.tipo_movimentacao] || { tipo: 'S', operacao: '10' };
  
  return {
    dataMovimentacao: movimentacao.data_movimentacao,
    tipoMovimentacao: mapeamento.tipo,
    tipoOperacao: mapeamento.operacao,
    medicamento: {
      codigoAnvisa: movimentacao.medicamento_codigo,
      nome: movimentacao.medicamento_nome,
      apresentacao: '',
      lista: movimentacao.lista,
    },
    quantidade: movimentacao.quantidade,
    lote: movimentacao.lote,
    dataValidade: movimentacao.data_validade,
    notaFiscal: movimentacao.nota_fiscal,
    fornecedorCnpj: movimentacao.fornecedor_cnpj,
    pacienteNome: movimentacao.paciente_nome,
    pacienteCpf: movimentacao.paciente_cpf,
    prescritorNome: movimentacao.prescriptor_nome,
    prescritorCrm: movimentacao.prescriptor_crm,
    numeroReceita: movimentacao.numero_receita,
    compradorNome: movimentacao.comprador_nome,
    compradorRg: movimentacao.comprador_rg,
    motivoPerda: movimentacao.motivo_perda,
  };
}
