/**
 * Integração com NFE.io — Emissão de NFS-e (Nota Fiscal de Serviço Eletrônica)
 * 
 * NFE.io é uma API intermediária que abstrai a complexidade de integrar com
 * mais de 2.000 prefeituras brasileiras. A clínica configura:
 * - API Key do NFE.io
 * - Certificado Digital A1 (.pfx)
 * - Dados da empresa (CNPJ, Inscrição Municipal, etc.)
 * 
 * Referência: https://nfe.io/docs
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface NFEioConfig {
  apiKey: string;
  companyId?: string; // ID da empresa no NFE.io (obtido após cadastro)
}

export interface NFEioEmpresa {
  id?: string;
  name: string;
  tradeName?: string;
  federalTaxNumber: string; // CNPJ (apenas números)
  email: string;
  address: {
    country: string;
    postalCode: string;
    street: string;
    number: string;
    additionalInformation?: string;
    district: string;
    city: {
      code: string; // Código IBGE
      name: string;
    };
    state: string; // UF
  };
  taxRegime?: 'Isento' | 'MicroempreendedorIndividual' | 'SimplesNacional' | 'LucroPresumido' | 'LucroReal';
  specialTaxRegime?: 'Automatico' | 'MicroempresaMunicipal' | 'Estimativa' | 'SociedadeProfissionais' | 'Cooperativa' | 'MicroempreendedorIndividual' | 'MicroempresarioEmpresaPequenoPorte';
  municipalTaxNumber?: string; // Inscrição Municipal
  rpsSerialNumber?: string; // Série do RPS
  rpsNumber?: number; // Número inicial do RPS
}

export interface NFEioCertificado {
  file: string; // Base64 do arquivo .pfx
  password: string;
}

export interface NFEioTomador {
  name: string;
  federalTaxNumber?: string; // CPF ou CNPJ
  email?: string;
  address?: {
    country?: string;
    postalCode?: string;
    street?: string;
    number?: string;
    additionalInformation?: string;
    district?: string;
    city?: {
      code?: string;
      name?: string;
    };
    state?: string;
  };
}

export interface NFEioServico {
  code: string; // Código do serviço municipal (LC 116)
  description: string;
  cnaeCode?: string;
  unitAmount: number; // Valor unitário
  amount?: number; // Quantidade (default: 1)
  taxationType: 'None' | 'WithinCity' | 'OutsideCity' | 'Export' | 'Free' | 'Immune' | 'SuspendedCourtDecision' | 'SuspendedAdministrativeProcedure';
}

export interface NFEioNFSe {
  id?: string;
  borrower: NFEioTomador;
  cityServiceCode: string;
  description: string;
  servicesAmount: number;
  deductionsAmount?: number;
  discountUnconditionedAmount?: number;
  discountConditionedAmount?: number;
  baseTaxAmount?: number;
  issRate?: number;
  issTaxAmount?: number;
  irAmountWithheld?: number;
  pccAmountWithheld?: number;
  cofinsAmountWithheld?: number;
  csllAmountWithheld?: number;
  inssAmountWithheld?: number;
  issAmountWithheld?: number;
  othersAmountWithheld?: number;
  taxationType?: 'None' | 'WithinCity' | 'OutsideCity' | 'Export' | 'Free' | 'Immune' | 'SuspendedCourtDecision' | 'SuspendedAdministrativeProcedure';
}

export interface NFEioNFSeResponse {
  id: string;
  environment: 'Development' | 'Production';
  flowStatus: 'Issued' | 'Cancelled' | 'WaitingCalculateTaxes' | 'WaitingDefineRpsNumber' | 'WaitingSend' | 'WaitingSendCancel' | 'WaitingReturn' | 'WaitingDownload' | 'CancelFailed' | 'IssueFailed';
  flowMessage?: string;
  provider: string;
  batchNumber?: string;
  batchCheckNumber?: string;
  number?: string;
  checkCode?: string;
  status: 'Created' | 'Issued' | 'Cancelled' | 'Error' | 'None';
  rpsType?: number;
  rpsStatus?: number;
  taxationType?: string;
  issuedOn?: string;
  cancelledOn?: string;
  rpsSerialNumber?: string;
  rpsNumber?: number;
  cityServiceCode?: string;
  cityServiceCodeDescription?: string;
  federalServiceCode?: string;
  description?: string;
  servicesAmount?: number;
  deductionsAmount?: number;
  discountUnconditionedAmount?: number;
  discountConditionedAmount?: number;
  baseTaxAmount?: number;
  issRate?: number;
  issTaxAmount?: number;
  totalAmount?: number;
  borrower?: NFEioTomador;
  createdOn?: string;
  modifiedOn?: string;
}

export interface NFEioPrefeitura {
  code: string;
  name: string;
  state: string;
  provider: string;
  supportsProductionEnvironment: boolean;
  supportsDevelopmentEnvironment: boolean;
}

export interface NFEioWebhook {
  url: string;
  events: ('ServiceInvoiceIssued' | 'ServiceInvoiceCancelled' | 'ServiceInvoiceIssueFailed' | 'ServiceInvoiceCancelFailed')[];
}

// ─── Cliente NFE.io ──────────────────────────────────────────────────────────

export class NFEioClient {
  private config: NFEioConfig;
  private baseUrl = 'https://api.nfe.io/v1';

  constructor(config: NFEioConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: object
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': this.config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error || JSON.stringify(data);
      throw new NFEioError(
        `NFE.io API Error (${response.status}): ${errorMessage}`,
        response.status,
        data
      );
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPRESAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lista todas as empresas cadastradas na conta
   */
  async listarEmpresas(): Promise<{ companies: NFEioEmpresa[] }> {
    return this.request<{ companies: NFEioEmpresa[] }>('/companies');
  }

  /**
   * Cadastra uma nova empresa
   */
  async cadastrarEmpresa(empresa: NFEioEmpresa): Promise<{ company: NFEioEmpresa }> {
    return this.request<{ company: NFEioEmpresa }>('/companies', 'POST', empresa);
  }

  /**
   * Busca uma empresa pelo ID
   */
  async buscarEmpresa(companyId: string): Promise<{ company: NFEioEmpresa }> {
    return this.request<{ company: NFEioEmpresa }>(`/companies/${companyId}`);
  }

  /**
   * Atualiza dados de uma empresa
   */
  async atualizarEmpresa(companyId: string, empresa: Partial<NFEioEmpresa>): Promise<{ company: NFEioEmpresa }> {
    return this.request<{ company: NFEioEmpresa }>(`/companies/${companyId}`, 'PUT', empresa);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CERTIFICADO DIGITAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Faz upload do certificado digital A1 (.pfx)
   * O certificado é necessário para emissão de NFS-e
   */
  async uploadCertificado(companyId: string, certificado: NFEioCertificado): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/companies/${companyId}/certificate`,
      'POST',
      certificado
    );
  }

  /**
   * Verifica se a empresa tem certificado válido
   */
  async verificarCertificado(companyId: string): Promise<{ 
    hasCertificate: boolean; 
    expiresOn?: string;
    thumbprint?: string;
  }> {
    return this.request<{ hasCertificate: boolean; expiresOn?: string; thumbprint?: string }>(
      `/companies/${companyId}/certificate`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMISSÃO DE NFS-e
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emite uma NFS-e
   */
  async emitirNFSe(companyId: string, nfse: NFEioNFSe): Promise<{ serviceInvoice: NFEioNFSeResponse }> {
    return this.request<{ serviceInvoice: NFEioNFSeResponse }>(
      `/companies/${companyId}/serviceinvoices`,
      'POST',
      nfse
    );
  }

  /**
   * Lista NFS-e emitidas
   */
  async listarNFSe(
    companyId: string,
    params?: {
      pageCount?: number;
      pageIndex?: number;
      status?: 'Created' | 'Issued' | 'Cancelled' | 'Error';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ serviceInvoices: NFEioNFSeResponse[]; totalCount: number }> {
    const queryParams = new URLSearchParams();
    if (params?.pageCount) queryParams.set('pageCount', params.pageCount.toString());
    if (params?.pageIndex) queryParams.set('pageIndex', params.pageIndex.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    const query = queryParams.toString();
    return this.request<{ serviceInvoices: NFEioNFSeResponse[]; totalCount: number }>(
      `/companies/${companyId}/serviceinvoices${query ? `?${query}` : ''}`
    );
  }

  /**
   * Busca uma NFS-e pelo ID
   */
  async buscarNFSe(companyId: string, invoiceId: string): Promise<{ serviceInvoice: NFEioNFSeResponse }> {
    return this.request<{ serviceInvoice: NFEioNFSeResponse }>(
      `/companies/${companyId}/serviceinvoices/${invoiceId}`
    );
  }

  /**
   * Cancela uma NFS-e
   */
  async cancelarNFSe(companyId: string, invoiceId: string): Promise<{ serviceInvoice: NFEioNFSeResponse }> {
    return this.request<{ serviceInvoice: NFEioNFSeResponse }>(
      `/companies/${companyId}/serviceinvoices/${invoiceId}`,
      'DELETE'
    );
  }

  /**
   * Baixa o PDF da NFS-e
   */
  async downloadPDF(companyId: string, invoiceId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/companies/${companyId}/serviceinvoices/${invoiceId}/pdf`,
      {
        headers: {
          'Authorization': this.config.apiKey,
          'Accept': 'application/pdf',
        },
      }
    );

    if (!response.ok) {
      throw new NFEioError(`Erro ao baixar PDF: ${response.statusText}`, response.status);
    }

    return response.blob();
  }

  /**
   * Baixa o XML da NFS-e
   */
  async downloadXML(companyId: string, invoiceId: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/companies/${companyId}/serviceinvoices/${invoiceId}/xml`,
      {
        headers: {
          'Authorization': this.config.apiKey,
          'Accept': 'application/xml',
        },
      }
    );

    if (!response.ok) {
      throw new NFEioError(`Erro ao baixar XML: ${response.statusText}`, response.status);
    }

    return response.text();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFEITURAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lista prefeituras disponíveis para emissão
   */
  async listarPrefeituras(uf?: string): Promise<{ cities: NFEioPrefeitura[] }> {
    const query = uf ? `?state=${uf}` : '';
    return this.request<{ cities: NFEioPrefeitura[] }>(`/cities${query}`);
  }

  /**
   * Verifica se uma prefeitura está disponível pelo código IBGE
   */
  async verificarPrefeitura(codigoIBGE: string): Promise<{ city: NFEioPrefeitura }> {
    return this.request<{ city: NFEioPrefeitura }>(`/cities/${codigoIBGE}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Configura webhook para receber notificações de NFS-e
   */
  async configurarWebhook(companyId: string, webhook: NFEioWebhook): Promise<{ webhook: NFEioWebhook }> {
    return this.request<{ webhook: NFEioWebhook }>(
      `/companies/${companyId}/hooks`,
      'POST',
      webhook
    );
  }

  /**
   * Lista webhooks configurados
   */
  async listarWebhooks(companyId: string): Promise<{ hooks: NFEioWebhook[] }> {
    return this.request<{ hooks: NFEioWebhook[] }>(`/companies/${companyId}/hooks`);
  }

  /**
   * Remove um webhook
   */
  async removerWebhook(companyId: string, hookId: string): Promise<void> {
    await this.request(`/companies/${companyId}/hooks/${hookId}`, 'DELETE');
  }
}

// ─── Classe de Erro ──────────────────────────────────────────────────────────

export class NFEioError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'NFEioError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte arquivo .pfx para Base64
 */
export function certificadoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formata CNPJ para envio (apenas números)
 */
export function formatarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Formata CPF para envio (apenas números)
 */
export function formatarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida CNPJ
 */
export function validarCNPJ(cnpj: string): boolean {
  cnpj = formatarCNPJ(cnpj);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let soma = 0;
  let peso = 5;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj[i]) * peso;
    peso = peso === 2 ? 9 : peso - 1;
  }
  let digito = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (parseInt(cnpj[12]) !== digito) return false;

  soma = 0;
  peso = 6;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj[i]) * peso;
    peso = peso === 2 ? 9 : peso - 1;
  }
  digito = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return parseInt(cnpj[13]) === digito;
}

/**
 * Códigos de serviço mais comuns para clínicas (LC 116/2003)
 */
export const CODIGOS_SERVICO_CLINICA = {
  // 4 - Serviços de saúde, assistência médica e congêneres
  '4.01': 'Medicina e biomedicina',
  '4.02': 'Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia, ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres',
  '4.03': 'Hospitais, clínicas, laboratórios, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres',
  '4.04': 'Instrumentação cirúrgica',
  '4.05': 'Acupuntura',
  '4.06': 'Enfermagem, inclusive serviços auxiliares',
  '4.07': 'Serviços farmacêuticos',
  '4.08': 'Terapia ocupacional, fisioterapia e fonoaudiologia',
  '4.09': 'Terapias de qualquer espécie destinadas ao tratamento físico, orgânico e mental',
  '4.10': 'Nutrição',
  '4.11': 'Obstetrícia',
  '4.12': 'Odontologia',
  '4.13': 'Ortóptica',
  '4.14': 'Próteses sob encomenda',
  '4.15': 'Psicanálise',
  '4.16': 'Psicologia',
  '4.17': 'Casas de repouso e de recuperação, creches, asilos e congêneres',
  '4.18': 'Inseminação artificial, fertilização in vitro e congêneres',
  '4.19': 'Bancos de sangue, leite, pele, olhos, óvulos, sêmen e congêneres',
  '4.20': 'Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie',
  '4.21': 'Unidade de atendimento, assistência ou tratamento móvel e congêneres',
  '4.22': 'Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres',
  '4.23': 'Outros planos de saúde que se cumpram através de serviços de terceiros contratados, credenciados, cooperados ou apenas pagos pelo operador do plano mediante indicação do beneficiário',
} as const;

/**
 * Monta objeto de NFS-e a partir de dados do ClinicNest
 */
export function montarNFSeClinica(params: {
  paciente: {
    nome: string;
    cpf?: string;
    cnpj?: string;
    email?: string;
    endereco?: {
      cep?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      codigoIBGE?: string;
      uf?: string;
    };
  };
  servico: {
    codigo: string;
    descricao: string;
    valor: number;
  };
  aliquotaISS?: number;
}): NFEioNFSe {
  const { paciente, servico, aliquotaISS } = params;

  return {
    borrower: {
      name: paciente.nome,
      federalTaxNumber: paciente.cnpj || paciente.cpf,
      email: paciente.email,
      address: paciente.endereco ? {
        country: 'BRA',
        postalCode: paciente.endereco.cep,
        street: paciente.endereco.logradouro,
        number: paciente.endereco.numero,
        additionalInformation: paciente.endereco.complemento,
        district: paciente.endereco.bairro,
        city: {
          code: paciente.endereco.codigoIBGE,
          name: paciente.endereco.cidade,
        },
        state: paciente.endereco.uf,
      } : undefined,
    },
    cityServiceCode: servico.codigo,
    description: servico.descricao,
    servicesAmount: servico.valor,
    issRate: aliquotaISS,
    taxationType: 'WithinCity',
  };
}
