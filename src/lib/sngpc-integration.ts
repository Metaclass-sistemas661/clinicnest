// SNGPC Integration Service
// Integra os dados do ClinicNest com a API SNGPC da ANVISA

import { sngpcClient, SNGPCAuthCredentials, SNGPCEnvioResponse, SNGPCConsultaResponse } from './sngpc-api-client';
import { logger } from '@/lib/logger';
import {
  MensagemSNGPC,
  MensagemSNGPCInventario,
  EntradaMedicamento,
  SaidaMedicamentoVendaAoConsumidor,
  SaidaMedicamentoPerda,
  SaidaMedicamentoTransferencia,
  gerarMensagemSNGPCXML,
  gerarMensagemInventarioXML,
  TIPO_RECEITUARIO_MAP,
  MOTIVO_PERDA_MAP,
  TipoReceituario,
  ClasseTerapeutica,
  UnidadeMedidaMedicamento,
  ConselhoProfissional,
  UF,
} from './sngpc-xml-oficial';

// ============================================================================
// TIPOS DE DADOS DO SISTEMA
// ============================================================================

export interface DadosClinica {
  cnpj: string;
  cpfResponsavel: string;
  email: string;
}

export interface MovimentacaoMedicamento {
  id: string;
  tipo: 'ENTRADA' | 'SAIDA_VENDA' | 'SAIDA_TRANSFERENCIA' | 'SAIDA_PERDA';
  data: string;
  medicamento: {
    registroMS: string;
    nome: string;
    lote: string;
    quantidade: number;
    unidade: 'CAIXA' | 'FRASCO';
    classeTerapeutica: 'ANTIMICROBIANO' | 'CONTROLADO';
  };
  notaFiscal?: {
    numero: number;
    data: string;
    cnpjOrigem: string;
    cnpjDestino: string;
    tipoOperacao: 'COMPRA' | 'TRANSFERENCIA' | 'VENDA';
  };
  prescricao?: {
    tipoReceituario: 'AMARELA' | 'AZUL' | 'BRANCA_2VIAS' | 'BRANCA_ESPECIAL' | 'ANTIMICROBIANO';
    numeroNotificacao?: string;
    dataPrescricao: string;
    usoProlongado: boolean;
    prescritor: {
      nome: string;
      registro: string;
      conselho: 'CRM' | 'CRMV' | 'CRO' | 'CRF' | 'RMS';
      uf: string;
    };
    comprador: {
      nome: string;
      tipoDocumento: string;
      numeroDocumento: string;
      orgaoExpedidor: string;
      ufDocumento: string;
    };
    usoVeterinario: boolean;
  };
  perda?: {
    motivo: keyof typeof MOTIVO_PERDA_MAP;
    observacao?: string;
  };
}

export interface PeriodoTransmissao {
  dataInicio: string;
  dataFim: string;
}

// ============================================================================
// CONVERSÃO DE DADOS
// ============================================================================

function converterUnidade(unidade: 'CAIXA' | 'FRASCO'): UnidadeMedidaMedicamento {
  return unidade === 'CAIXA' ? '1' : '2';
}

function converterClasseTerapeutica(classe: 'ANTIMICROBIANO' | 'CONTROLADO'): ClasseTerapeutica {
  return classe === 'ANTIMICROBIANO' ? '1' : '2';
}

function converterTipoOperacaoNF(tipo: 'COMPRA' | 'TRANSFERENCIA' | 'VENDA'): '1' | '2' | '3' {
  const map = { COMPRA: '1', TRANSFERENCIA: '2', VENDA: '3' } as const;
  return map[tipo];
}

function converterMovimentacaoParaEntrada(mov: MovimentacaoMedicamento): EntradaMedicamento | null {
  if (mov.tipo !== 'ENTRADA' || !mov.notaFiscal) return null;

  return {
    notaFiscalEntradaMedicamento: {
      numeroNotaFiscal: mov.notaFiscal.numero,
      tipoOperacaoNotaFiscal: converterTipoOperacaoNF(mov.notaFiscal.tipoOperacao),
      dataNotaFiscal: mov.notaFiscal.data,
      cnpjOrigem: mov.notaFiscal.cnpjOrigem,
      cnpjDestino: mov.notaFiscal.cnpjDestino,
    },
    medicamentoEntrada: {
      classeTerapeutica: converterClasseTerapeutica(mov.medicamento.classeTerapeutica),
      registroMSMedicamento: mov.medicamento.registroMS,
      numeroLoteMedicamento: mov.medicamento.lote,
      quantidadeMedicamento: mov.medicamento.quantidade,
      unidadeMedidaMedicamento: converterUnidade(mov.medicamento.unidade),
    },
    dataRecebimentoMedicamento: mov.data,
  };
}

function converterMovimentacaoParaVenda(mov: MovimentacaoMedicamento): SaidaMedicamentoVendaAoConsumidor | null {
  if (mov.tipo !== 'SAIDA_VENDA' || !mov.prescricao) return null;

  const tipoReceituario = TIPO_RECEITUARIO_MAP[mov.prescricao.tipoReceituario] as TipoReceituario;

  return {
    tipoReceituarioMedicamento: tipoReceituario,
    numeroNotificacaoMedicamento: mov.prescricao.numeroNotificacao,
    dataPrescricaoMedicamento: mov.prescricao.dataPrescricao,
    prescritorMedicamento: {
      nomePrescritor: mov.prescricao.prescritor.nome,
      numeroRegistroProfissional: mov.prescricao.prescritor.registro,
      conselhoProfissional: mov.prescricao.prescritor.conselho as ConselhoProfissional,
      UFConselho: mov.prescricao.prescritor.uf as UF,
    },
    usoMedicamento: mov.prescricao.usoVeterinario ? '2' : '1',
    compradorMedicamento: {
      nomeComprador: mov.prescricao.comprador.nome,
      tipoDocumento: mov.prescricao.comprador.tipoDocumento,
      numeroDocumento: mov.prescricao.comprador.numeroDocumento,
      orgaoExpedidor: mov.prescricao.comprador.orgaoExpedidor,
      UFEmissaoDocumento: mov.prescricao.comprador.ufDocumento as UF,
    },
    medicamentoVenda: {
      usoProlongado: mov.prescricao.usoProlongado ? 'S' : 'N',
      registroMSMedicamento: mov.medicamento.registroMS,
      numeroLoteMedicamento: mov.medicamento.lote,
      quantidadeMedicamento: mov.medicamento.quantidade,
      unidadeMedidaMedicamento: converterUnidade(mov.medicamento.unidade),
    },
    dataVendaMedicamento: mov.data,
  };
}

function converterMovimentacaoParaTransferencia(mov: MovimentacaoMedicamento): SaidaMedicamentoTransferencia | null {
  if (mov.tipo !== 'SAIDA_TRANSFERENCIA' || !mov.notaFiscal) return null;

  return {
    notaFiscalTransferenciaMedicamento: {
      numeroNotaFiscal: mov.notaFiscal.numero,
      tipoOperacaoNotaFiscal: '2',
      dataNotaFiscal: mov.notaFiscal.data,
      cnpjOrigem: mov.notaFiscal.cnpjOrigem,
      cnpjDestino: mov.notaFiscal.cnpjDestino,
    },
    medicamentoTransferencia: {
      registroMSMedicamento: mov.medicamento.registroMS,
      numeroLoteMedicamento: mov.medicamento.lote,
      quantidadeMedicamento: mov.medicamento.quantidade,
      unidadeMedidaMedicamento: converterUnidade(mov.medicamento.unidade),
    },
    dataTransferenciaMedicamento: mov.data,
  };
}

function converterMovimentacaoParaPerda(mov: MovimentacaoMedicamento): SaidaMedicamentoPerda | null {
  if (mov.tipo !== 'SAIDA_PERDA' || !mov.perda) return null;

  return {
    motivoPerda: MOTIVO_PERDA_MAP[mov.perda.motivo],
    medicamentoPerda: {
      registroMSMedicamento: mov.medicamento.registroMS,
      numeroLoteMedicamento: mov.medicamento.lote,
      quantidadeMedicamento: mov.medicamento.quantidade,
      unidadeMedidaMedicamento: converterUnidade(mov.medicamento.unidade),
    },
    dataPerdaMedicamento: mov.data,
    observacao: mov.perda.observacao,
  };
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export interface TransmissaoResult {
  sucesso: boolean;
  hash?: string;
  xml?: string;
  erros?: string[];
  dataTransmissao: string;
}

export interface ConsultaResult extends SNGPCConsultaResponse {
  sucesso: boolean;
  erros?: string[];
}

export class SNGPCIntegrationService {
  private clinica: DadosClinica;

  constructor(clinica: DadosClinica) {
    this.clinica = clinica;
  }

  async autenticar(credentials: SNGPCAuthCredentials): Promise<boolean> {
    try {
      await sngpcClient.autenticar(credentials);
      return true;
    } catch (error) {
      logger.error('Erro na autenticação SNGPC:', error);
      return false;
    }
  }

  gerarXMLMovimentacao(
    movimentacoes: MovimentacaoMedicamento[],
    periodo: PeriodoTransmissao
  ): string {
    const entradas = movimentacoes
      .map(converterMovimentacaoParaEntrada)
      .filter((e): e is EntradaMedicamento => e !== null);

    const vendas = movimentacoes
      .map(converterMovimentacaoParaVenda)
      .filter((v): v is SaidaMedicamentoVendaAoConsumidor => v !== null);

    const transferencias = movimentacoes
      .map(converterMovimentacaoParaTransferencia)
      .filter((t): t is SaidaMedicamentoTransferencia => t !== null);

    const perdas = movimentacoes
      .map(converterMovimentacaoParaPerda)
      .filter((p): p is SaidaMedicamentoPerda => p !== null);

    const mensagem: MensagemSNGPC = {
      cabecalho: {
        cnpjEmissor: this.clinica.cnpj,
        cpfTransmissor: this.clinica.cpfResponsavel,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      },
      corpo: {
        medicamentos: {
          entradaMedicamentos: entradas.length > 0 ? entradas : undefined,
          saidaMedicamentoVendaAoConsumidor: vendas.length > 0 ? vendas : undefined,
          saidaMedicamentoTransferencia: transferencias.length > 0 ? transferencias : undefined,
          saidaMedicamentoPerda: perdas.length > 0 ? perdas : undefined,
        },
        insumos: {},
      },
    };

    return gerarMensagemSNGPCXML(mensagem);
  }

  gerarXMLInventario(
    estoque: Array<{
      registroMS: string;
      lote: string;
      quantidade: number;
      unidade: 'CAIXA' | 'FRASCO';
      classeTerapeutica: 'ANTIMICROBIANO' | 'CONTROLADO';
    }>,
    data: string
  ): string {
    const mensagem: MensagemSNGPCInventario = {
      cabecalho: {
        cnpjEmissor: this.clinica.cnpj,
        cpfTransmissor: this.clinica.cpfResponsavel,
        data,
      },
      corpo: {
        medicamentos: {
          entradaMedicamentos: estoque.map(item => ({
            medicamentoEntrada: {
              classeTerapeutica: converterClasseTerapeutica(item.classeTerapeutica),
              registroMSMedicamento: item.registroMS,
              numeroLoteMedicamento: item.lote,
              quantidadeMedicamento: item.quantidade,
              unidadeMedidaMedicamento: converterUnidade(item.unidade),
            },
          })),
        },
        insumos: {},
      },
    };

    return gerarMensagemInventarioXML(mensagem);
  }

  async transmitirMovimentacao(
    movimentacoes: MovimentacaoMedicamento[],
    periodo: PeriodoTransmissao
  ): Promise<TransmissaoResult> {
    if (!sngpcClient.isAuthenticated()) {
      return {
        sucesso: false,
        erros: ['Não autenticado na API SNGPC'],
        dataTransmissao: new Date().toISOString(),
      };
    }

    const xml = this.gerarXMLMovimentacao(movimentacoes, periodo);

    try {
      const response: SNGPCEnvioResponse = await sngpcClient.enviarArquivoXML(xml);

      return {
        sucesso: response.sucesso,
        hash: response.hash,
        xml,
        erros: response.erros,
        dataTransmissao: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sucesso: false,
        xml,
        erros: [error instanceof Error ? error.message : 'Erro desconhecido'],
        dataTransmissao: new Date().toISOString(),
      };
    }
  }

  async transmitirInventario(
    estoque: Array<{
      registroMS: string;
      lote: string;
      quantidade: number;
      unidade: 'CAIXA' | 'FRASCO';
      classeTerapeutica: 'ANTIMICROBIANO' | 'CONTROLADO';
    }>,
    data: string
  ): Promise<TransmissaoResult> {
    if (!sngpcClient.isAuthenticated()) {
      return {
        sucesso: false,
        erros: ['Não autenticado na API SNGPC'],
        dataTransmissao: new Date().toISOString(),
      };
    }

    const xml = this.gerarXMLInventario(estoque, data);

    try {
      const response = await sngpcClient.enviarArquivoXML(xml);

      return {
        sucesso: response.sucesso,
        hash: response.hash,
        xml,
        erros: response.erros,
        dataTransmissao: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sucesso: false,
        xml,
        erros: [error instanceof Error ? error.message : 'Erro desconhecido'],
        dataTransmissao: new Date().toISOString(),
      };
    }
  }

  async consultarTransmissao(hash: string): Promise<ConsultaResult> {
    if (!sngpcClient.isAuthenticated()) {
      return {
        sucesso: false,
        erros: ['Não autenticado na API SNGPC'],
        hash,
        dataInicioRetorno: '',
        dataFimRetorno: '',
        dataTransmissao: '',
        dataValidacao: '',
        descricaoValidacao: [],
        validado: false,
      };
    }

    try {
      const response = await sngpcClient.consultarArquivo(
        this.clinica.email,
        this.clinica.cnpj,
        hash
      );

      return {
        ...response,
        sucesso: true,
      };
    } catch (error) {
      return {
        sucesso: false,
        erros: [error instanceof Error ? error.message : 'Erro desconhecido'],
        hash,
        dataInicioRetorno: '',
        dataFimRetorno: '',
        dataTransmissao: '',
        dataValidacao: '',
        descricaoValidacao: [],
        validado: false,
      };
    }
  }

  validarMovimentacoes(movimentacoes: MovimentacaoMedicamento[]): {
    valido: boolean;
    erros: string[];
    avisos: string[];
  } {
    const erros: string[] = [];
    const avisos: string[] = [];

    for (const mov of movimentacoes) {
      // Validar registro MS (13-14 dígitos, inicia com "1")
      if (!mov.medicamento.registroMS.match(/^1\d{12,13}$/)) {
        erros.push(`Medicamento ${mov.medicamento.nome}: Registro MS inválido (${mov.medicamento.registroMS})`);
      }

      // Validar lote (max 20 chars)
      if (mov.medicamento.lote.length > 20) {
        erros.push(`Medicamento ${mov.medicamento.nome}: Lote excede 20 caracteres`);
      }

      // Validar quantidade (max 6 dígitos, > 0)
      if (mov.medicamento.quantidade <= 0 || mov.medicamento.quantidade > 999999) {
        erros.push(`Medicamento ${mov.medicamento.nome}: Quantidade inválida`);
      }

      // Validações específicas por tipo
      if (mov.tipo === 'ENTRADA' && !mov.notaFiscal) {
        erros.push(`Entrada ${mov.id}: Nota fiscal obrigatória`);
      }

      if (mov.tipo === 'SAIDA_VENDA' && !mov.prescricao) {
        erros.push(`Saída venda ${mov.id}: Prescrição obrigatória`);
      }

      if (mov.tipo === 'SAIDA_PERDA' && !mov.perda) {
        erros.push(`Saída perda ${mov.id}: Motivo da perda obrigatório`);
      }

      // Avisos
      if (mov.tipo === 'SAIDA_VENDA' && mov.prescricao && !mov.prescricao.numeroNotificacao) {
        if (['AMARELA', 'AZUL'].includes(mov.prescricao.tipoReceituario)) {
          avisos.push(`Saída ${mov.id}: Número de notificação recomendado para receituário ${mov.prescricao.tipoReceituario}`);
        }
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      avisos,
    };
  }
}

// Factory function
export function criarServicoSNGPC(clinica: DadosClinica): SNGPCIntegrationService {
  return new SNGPCIntegrationService(clinica);
}
