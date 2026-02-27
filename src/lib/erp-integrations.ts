/**
 * Integração com ERPs — Omie, Bling, Conta Azul
 * 
 * Clientes para sincronização financeira com sistemas de gestão empresarial.
 * Permite integração contábil para clínicas com contabilidade integrada.
 */

// ─── Tipos Comuns ─────────────────────────────────────────────────────────────

export interface ERPCliente {
  id?: string;
  codigo?: string;
  nome: string;
  cpfCnpj: string;
  email?: string;
  telefone?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
}

export interface ERPProdutoServico {
  id?: string;
  codigo?: string;
  descricao: string;
  tipo: 'PRODUTO' | 'SERVICO';
  valor: number;
  unidade?: string;
  ncm?: string;
  codigoServico?: string;
}

export interface ERPContaReceber {
  id?: string;
  clienteId: string;
  valor: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  descricao?: string;
  categoriaId?: string;
  formaPagamento?: string;
}

export interface ERPNotaFiscal {
  id?: string;
  numero?: string;
  serie?: string;
  clienteId: string;
  dataEmissao: string;
  valorTotal: number;
  itens: Array<{ produtoId: string; quantidade: number; valorUnitario: number }>;
  status: 'EMITIDA' | 'CANCELADA' | 'PENDENTE';
  chaveAcesso?: string;
  linkPdf?: string;
  linkXml?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OMIE API
// Referência: https://developer.omie.com.br/
// ═══════════════════════════════════════════════════════════════════════════════

export interface OmieConfig {
  appKey: string;
  appSecret: string;
}

export class OmieClient {
  private config: OmieConfig;
  private baseUrl = 'https://app.omie.com.br/api/v1';

  constructor(config: OmieConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, call: string, params: object = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call,
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        param: [params],
      }),
    });

    const data = await response.json();
    if (data.faultstring) {
      throw new Error(`Omie API Error: ${data.faultstring}`);
    }
    return data;
  }

  async listarClientes(pagina = 1, registrosPorPagina = 50): Promise<{ clientes: ERPCliente[]; total: number }> {
    const result = await this.request<any>('/geral/clientes/', 'ListarClientes', {
      pagina,
      registros_por_pagina: registrosPorPagina,
      apenas_importado_api: 'N',
    });

    return {
      clientes: (result.clientes_cadastro || []).map(mapOmieCliente),
      total: result.total_de_registros || 0,
    };
  }

  async incluirCliente(cliente: ERPCliente): Promise<{ codigo: string }> {
    const result = await this.request<any>('/geral/clientes/', 'IncluirCliente', {
      codigo_cliente_integracao: cliente.id || crypto.randomUUID(),
      razao_social: cliente.nome,
      cnpj_cpf: cliente.cpfCnpj,
      email: cliente.email,
      telefone1_numero: cliente.telefone,
      endereco: cliente.endereco?.logradouro,
      endereco_numero: cliente.endereco?.numero,
      complemento: cliente.endereco?.complemento,
      bairro: cliente.endereco?.bairro,
      cidade: cliente.endereco?.cidade,
      estado: cliente.endereco?.uf,
      cep: cliente.endereco?.cep,
    });

    return { codigo: result.codigo_cliente_omie?.toString() };
  }

  async listarContasReceber(pagina = 1): Promise<{ contas: ERPContaReceber[]; total: number }> {
    const result = await this.request<any>('/financas/contareceber/', 'ListarContasReceber', {
      pagina,
      registros_por_pagina: 50,
    });

    return {
      contas: (result.conta_receber_cadastro || []).map(mapOmieContaReceber),
      total: result.total_de_registros || 0,
    };
  }

  async incluirContaReceber(conta: ERPContaReceber): Promise<{ codigo: string }> {
    const result = await this.request<any>('/financas/contareceber/', 'IncluirContaReceber', {
      codigo_lancamento_integracao: conta.id || crypto.randomUUID(),
      codigo_cliente_fornecedor: conta.clienteId,
      data_vencimento: formatDateOmie(conta.dataVencimento),
      valor_documento: conta.valor,
      codigo_categoria: conta.categoriaId || '1.01.01',
      data_previsao: formatDateOmie(conta.dataVencimento),
      observacao: conta.descricao,
    });

    return { codigo: result.codigo_lancamento_omie?.toString() };
  }

  async emitirNFSe(nf: ERPNotaFiscal): Promise<{ numero: string; chave: string }> {
    const result = await this.request<any>('/servicos/nfse/', 'IncluirNFSe', {
      Cabecalho: {
        cCodIntServ: nf.id || crypto.randomUUID(),
        nCodCli: nf.clienteId,
        dDtEmiss: formatDateOmie(nf.dataEmissao),
      },
      ServicosPrestados: nf.itens.map(item => ({
        cCodServ: item.produtoId,
        nQtde: item.quantidade,
        nValUnit: item.valorUnitario,
      })),
    });

    return {
      numero: result.nNumeroNFSe?.toString() || '',
      chave: result.cChaveNFSe || '',
    };
  }
}

function mapOmieCliente(c: any): ERPCliente {
  return {
    id: c.codigo_cliente_omie?.toString(),
    codigo: c.codigo_cliente_integracao,
    nome: c.razao_social || c.nome_fantasia,
    cpfCnpj: c.cnpj_cpf,
    email: c.email,
    telefone: c.telefone1_numero,
    endereco: {
      logradouro: c.endereco,
      numero: c.endereco_numero,
      complemento: c.complemento,
      bairro: c.bairro,
      cidade: c.cidade,
      uf: c.estado,
      cep: c.cep,
    },
  };
}

function mapOmieContaReceber(c: any): ERPContaReceber {
  return {
    id: c.codigo_lancamento_omie?.toString(),
    clienteId: c.codigo_cliente_fornecedor?.toString(),
    valor: c.valor_documento,
    dataEmissao: c.data_emissao,
    dataVencimento: c.data_vencimento,
    dataPagamento: c.data_pagamento,
    status: c.status_titulo === 'LIQUIDADO' ? 'PAGO' : c.status_titulo === 'CANCELADO' ? 'CANCELADO' : 'PENDENTE',
    descricao: c.observacao,
  };
}

function formatDateOmie(date: string): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLING API
// Referência: https://developer.bling.com.br/
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlingConfig {
  apiKey: string;
}

export class BlingClient {
  private config: BlingConfig;
  private baseUrl = 'https://www.bling.com.br/Api/v3';

  constructor(config: BlingConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, method = 'GET', body?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Bling API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data;
  }

  async listarContatos(pagina = 1, limite = 100): Promise<{ contatos: ERPCliente[]; total: number }> {
    const result = await this.request<any>(`/contatos?pagina=${pagina}&limite=${limite}`);
    return {
      contatos: (result.data || []).map(mapBlingContato),
      total: result.data?.length || 0,
    };
  }

  async incluirContato(cliente: ERPCliente): Promise<{ id: string }> {
    const result = await this.request<any>('/contatos', 'POST', {
      nome: cliente.nome,
      codigo: cliente.codigo,
      tipo: cliente.cpfCnpj.length > 11 ? 'J' : 'F',
      numeroDocumento: cliente.cpfCnpj,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: {
        endereco: cliente.endereco?.logradouro,
        numero: cliente.endereco?.numero,
        complemento: cliente.endereco?.complemento,
        bairro: cliente.endereco?.bairro,
        municipio: cliente.endereco?.cidade,
        uf: cliente.endereco?.uf,
        cep: cliente.endereco?.cep,
      },
    });

    return { id: result.data?.id?.toString() };
  }

  async listarContasReceber(pagina = 1): Promise<{ contas: ERPContaReceber[] }> {
    const result = await this.request<any>(`/contas/receber?pagina=${pagina}`);
    return {
      contas: (result.data || []).map(mapBlingContaReceber),
    };
  }

  async incluirContaReceber(conta: ERPContaReceber): Promise<{ id: string }> {
    const result = await this.request<any>('/contas/receber', 'POST', {
      contato: { id: parseInt(conta.clienteId, 10) },
      vencimento: conta.dataVencimento,
      valor: conta.valor,
      historico: conta.descricao,
    });

    return { id: result.data?.id?.toString() };
  }

  async emitirNFSe(nf: ERPNotaFiscal): Promise<{ id: string; numero: string }> {
    const result = await this.request<any>('/nfse', 'POST', {
      contato: { id: parseInt(nf.clienteId, 10) },
      data: nf.dataEmissao,
      servicos: nf.itens.map(item => ({
        codigo: item.produtoId,
        quantidade: item.quantidade,
        valor: item.valorUnitario,
      })),
    });

    return {
      id: result.data?.id?.toString(),
      numero: result.data?.numero?.toString() || '',
    };
  }
}

function mapBlingContato(c: any): ERPCliente {
  return {
    id: c.id?.toString(),
    codigo: c.codigo,
    nome: c.nome,
    cpfCnpj: c.numeroDocumento,
    email: c.email,
    telefone: c.telefone,
    endereco: c.endereco ? {
      logradouro: c.endereco.endereco,
      numero: c.endereco.numero,
      complemento: c.endereco.complemento,
      bairro: c.endereco.bairro,
      cidade: c.endereco.municipio,
      uf: c.endereco.uf,
      cep: c.endereco.cep,
    } : undefined,
  };
}

function mapBlingContaReceber(c: any): ERPContaReceber {
  return {
    id: c.id?.toString(),
    clienteId: c.contato?.id?.toString(),
    valor: c.valor,
    dataEmissao: c.dataEmissao,
    dataVencimento: c.vencimento,
    dataPagamento: c.pagamento,
    status: c.situacao === 1 ? 'PAGO' : c.situacao === 2 ? 'CANCELADO' : 'PENDENTE',
    descricao: c.historico,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTA AZUL API
// Referência: https://developers.contaazul.com/
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContaAzulConfig {
  accessToken: string;
  refreshToken?: string;
  patientId?: string;
  clientSecret?: string;
}

export class ContaAzulClient {
  private config: ContaAzulConfig;
  private baseUrl = 'https://api.contaazul.com/v1';

  constructor(config: ContaAzulConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, method = 'GET', body?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Conta Azul API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async listarClientes(page = 1, size = 50): Promise<{ clientes: ERPCliente[] }> {
    const result = await this.request<any[]>(`/customers?page=${page}&size=${size}`);
    return { clientes: (result || []).map(mapContaAzulCliente) };
  }

  async incluirCliente(cliente: ERPCliente): Promise<{ id: string }> {
    const result = await this.request<any>('/customers', 'POST', {
      name: cliente.nome,
      company_name: cliente.nome,
      document: cliente.cpfCnpj,
      email: cliente.email,
      phone: cliente.telefone,
      address: {
        street: cliente.endereco?.logradouro,
        number: cliente.endereco?.numero,
        complement: cliente.endereco?.complemento,
        neighborhood: cliente.endereco?.bairro,
        city: { name: cliente.endereco?.cidade },
        state: { name: cliente.endereco?.uf },
        zip_code: cliente.endereco?.cep,
      },
    });

    return { id: result.id };
  }

  async listarContasReceber(): Promise<{ contas: ERPContaReceber[] }> {
    const result = await this.request<any[]>('/receivables');
    return { contas: (result || []).map(mapContaAzulContaReceber) };
  }

  async incluirContaReceber(conta: ERPContaReceber): Promise<{ id: string }> {
    const result = await this.request<any>('/receivables', 'POST', {
      customer_id: conta.clienteId,
      due_date: conta.dataVencimento,
      value: conta.valor,
      description: conta.descricao,
    });

    return { id: result.id };
  }

  async emitirNFSe(nf: ERPNotaFiscal): Promise<{ id: string }> {
    const result = await this.request<any>('/services', 'POST', {
      customer_id: nf.clienteId,
      emission: nf.dataEmissao,
      services: nf.itens.map(item => ({
        service_id: item.produtoId,
        quantity: item.quantidade,
        value: item.valorUnitario,
      })),
    });

    return { id: result.id };
  }
}

function mapContaAzulCliente(c: any): ERPCliente {
  return {
    id: c.id,
    nome: c.name || c.company_name,
    cpfCnpj: c.document,
    email: c.email,
    telefone: c.phone,
    endereco: c.address ? {
      logradouro: c.address.street,
      numero: c.address.number,
      complemento: c.address.complement,
      bairro: c.address.neighborhood,
      cidade: c.address.city?.name,
      uf: c.address.state?.name,
      cep: c.address.zip_code,
    } : undefined,
  };
}

function mapContaAzulContaReceber(c: any): ERPContaReceber {
  return {
    id: c.id,
    clienteId: c.customer_id,
    valor: c.value,
    dataEmissao: c.emission,
    dataVencimento: c.due_date,
    dataPagamento: c.payment_date,
    status: c.status === 'PAID' ? 'PAGO' : c.status === 'CANCELLED' ? 'CANCELADO' : 'PENDENTE',
    descricao: c.description,
  };
}
