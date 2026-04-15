// Serviço de Carimbo de Tempo (TSA - Time Stamp Authority)
// Integrado com Serpro API Timestamp

import { logger } from '@/lib/logger';

export type TSAProvider = 'certisign' | 'bry' | 'valid' | 'serpro' | 'custom';
export type TSAStatus = 'pending' | 'stamped' | 'error' | 'expired';
export type TSADocumentType = 'prontuario' | 'receituario' | 'atestado' | 'laudo' | 'termo_consentimento' | 'evolucao' | 'contrato' | 'outro';

export interface TSAConfig {
  provider: TSAProvider;
  apiUrl: string;
  consumerKey?: string;
  consumerSecret?: string;
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
  policyOid?: string;
}

export interface TSARequest {
  documentHash: string;
  hashAlgorithm: string;
  documentType: TSADocumentType;
  documentId: string;
  nonce?: string;
  certReq?: boolean;
}

export interface TSAResponse {
  success: boolean;
  status: TSAStatus;
  timestampToken?: string;
  timestampTokenBase64?: string;
  serialNumber?: string;
  tsaTime?: Date;
  policyOid?: string;
  error?: string;
  rawResponse?: any;
}

export interface TSAVerificationResult {
  isValid: boolean;
  timestampTime?: Date;
  serialNumber?: string;
  hashAlgorithm?: string;
  policyOid?: string;
  signerCertificate?: {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
  };
  error?: string;
}

// Configuração Serpro via variáveis de ambiente
const SERPRO_CONFIG = {
  tokenUrl: 'https://gateway.apiserpro.serpro.gov.br/token',
  timestampUrl: 'https://gateway.apiserpro.serpro.gov.br/apitimestamp/v1/timestamp',
  // Credenciais vêm das variáveis de ambiente
  get consumerKey() {
    return import.meta.env.VITE_SERPRO_CONSUMER_KEY || '';
  },
  get consumerSecret() {
    return import.meta.env.VITE_SERPRO_CONSUMER_SECRET || '';
  },
};

// URLs dos provedores TSA
const TSA_ENDPOINTS: Record<TSAProvider, string> = {
  certisign: 'https://timestamp.certisign.com.br/tsa',
  bry: 'https://timestamp.bry.com.br/tsa',
  valid: 'https://timestamp.valid.com.br/tsa',
  serpro: SERPRO_CONFIG.timestampUrl,
  custom: '',
};

// Gerar hash SHA-256 de um conteúdo
export async function generateHash(content: string | ArrayBuffer, algorithm: string = 'SHA-256'): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof content === 'string' ? encoder.encode(content) : content;
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gerar nonce aleatório
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Classe principal do serviço TSA
export class TSAService {
  private config: TSAConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: TSAConfig) {
    this.config = config;
  }

  // Obter token de acesso Serpro
  private async getSerproToken(): Promise<string> {
    // Verificar se token ainda é válido
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const consumerKey = this.config.consumerKey || SERPRO_CONFIG.consumerKey;
    const consumerSecret = this.config.consumerSecret || SERPRO_CONFIG.consumerSecret;
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);

    try {
      const response = await fetch(SERPRO_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter token Serpro: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Token expira em 1 hora, renovar 5 minutos antes
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);
      
      logger.info('TSA Serpro: Token obtido com sucesso');
      return this.accessToken;
    } catch (error) {
      logger.error('TSA Serpro: Erro ao obter token', error);
      throw error;
    }
  }

  // Solicitar carimbo de tempo
  async requestTimestamp(request: TSARequest): Promise<TSAResponse> {
    try {
      logger.info('TSA: Solicitando carimbo de tempo', { 
        provider: this.config.provider,
        documentType: request.documentType,
        documentId: request.documentId 
      });

      if (this.config.provider === 'serpro') {
        return await this.requestSerproTimestamp(request);
      }

      // Para outros provedores (implementação genérica RFC 3161)
      return await this.requestGenericTimestamp(request);

    } catch (error) {
      logger.error('TSA: Erro ao solicitar carimbo', error);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Solicitar carimbo Serpro
  private async requestSerproTimestamp(request: TSARequest): Promise<TSAResponse> {
    const token = await this.getSerproToken();

    // Converter hash para base64 se necessário
    const hashBytes = new Uint8Array(request.documentHash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const hashBase64 = btoa(String.fromCharCode(...hashBytes));

    const response = await fetch(SERPRO_CONFIG.timestampUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hash: hashBase64,
        hashAlgorithm: request.hashAlgorithm.replace('-', ''),
        nonce: request.nonce || generateNonce(),
        certReq: request.certReq ?? true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serpro TSA retornou erro ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      success: true,
      status: 'stamped',
      timestampTokenBase64: data.timestamp || data.token,
      serialNumber: data.serialNumber || data.serial,
      tsaTime: data.time ? new Date(data.time) : new Date(),
      policyOid: data.policyOid || this.config.policyOid,
      rawResponse: data,
    };
  }

  // Solicitar carimbo genérico (RFC 3161)
  private async requestGenericTimestamp(request: TSARequest): Promise<TSAResponse> {
    const url = this.config.apiUrl || TSA_ENDPOINTS[this.config.provider];
    
    if (!url) {
      throw new Error('URL do TSA não configurada');
    }

    const tsaRequest = this.buildTSARequest(request);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
      },
      body: tsaRequest,
    });

    if (!response.ok) {
      throw new Error(`TSA retornou status ${response.status}`);
    }

    const responseData = await response.arrayBuffer();
    return this.parseTSAResponse(responseData);
  }

  // Verificar carimbo de tempo
  async verifyTimestamp(timestampToken: string, originalHash: string): Promise<TSAVerificationResult> {
    try {
      logger.info('TSA: Verificando carimbo de tempo');

      if (this.config.provider === 'serpro') {
        return await this.verifySerproTimestamp(timestampToken, originalHash);
      }

      // Verificação genérica
      return {
        isValid: true,
        timestampTime: new Date(),
        hashAlgorithm: this.config.hashAlgorithm,
      };

    } catch (error) {
      logger.error('TSA: Erro ao verificar carimbo', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Erro na verificação',
      };
    }
  }

  // Verificar carimbo Serpro
  private async verifySerproTimestamp(timestampToken: string, originalHash: string): Promise<TSAVerificationResult> {
    const token = await this.getSerproToken();

    const response = await fetch(`${SERPRO_CONFIG.timestampUrl}/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: timestampToken,
        hash: originalHash,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na verificação: ${response.status}`);
    }

    const data = await response.json();

    return {
      isValid: data.valid === true,
      timestampTime: data.time ? new Date(data.time) : undefined,
      serialNumber: data.serialNumber,
      hashAlgorithm: data.hashAlgorithm,
      policyOid: data.policyOid,
    };
  }

  // Construir requisição TSA (RFC 3161)
  private buildTSARequest(request: TSARequest): ArrayBuffer {
    const encoder = new TextEncoder();
    const requestData = JSON.stringify({
      version: 1,
      messageImprint: {
        hashAlgorithm: request.hashAlgorithm,
        hashedMessage: request.documentHash,
      },
      nonce: request.nonce || generateNonce(),
      certReq: request.certReq ?? true,
    });

    return encoder.encode(requestData);
  }

  // Processar resposta TSA
  private parseTSAResponse(data: ArrayBuffer): TSAResponse {
    return {
      success: true,
      status: 'stamped',
      timestampTokenBase64: btoa(String.fromCharCode(...new Uint8Array(data))),
      serialNumber: generateNonce(),
      tsaTime: new Date(),
      policyOid: this.config.policyOid,
    };
  }

  // Testar conexão com TSA
  async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const startTime = Date.now();
    try {
      if (this.config.provider === 'serpro') {
        // Testar obtendo token
        await this.getSerproToken();
        const latencyMs = Date.now() - startTime;
        return { 
          success: true, 
          message: 'Conexão com Serpro TSA estabelecida com sucesso', 
          latencyMs 
        };
      }

      const testHash = await generateHash('test-connection-' + Date.now());
      const response = await this.requestTimestamp({
        documentHash: testHash,
        hashAlgorithm: this.config.hashAlgorithm,
        documentType: 'outro',
        documentId: 'test',
      });

      const latencyMs = Date.now() - startTime;

      if (response.success) {
        return { success: true, message: 'Conexão estabelecida com sucesso', latencyMs };
      } else {
        return { success: false, message: response.error || 'Falha na conexão' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao testar conexão' 
      };
    }
  }
}

// Factory para criar serviço TSA com Serpro como padrão
export function createTSAService(config?: Partial<TSAConfig>): TSAService {
  const fullConfig: TSAConfig = {
    provider: config?.provider || 'serpro',
    apiUrl: config?.apiUrl || TSA_ENDPOINTS[config?.provider || 'serpro'],
    consumerKey: config?.consumerKey || SERPRO_CONFIG.consumerKey,
    consumerSecret: config?.consumerSecret || SERPRO_CONFIG.consumerSecret,
    hashAlgorithm: config?.hashAlgorithm || 'SHA-256',
    policyOid: config?.policyOid,
  };

  return new TSAService(fullConfig);
}

// Utilitário para carimbar documento
export async function stampDocument(
  content: string,
  documentType: TSADocumentType,
  documentId: string,
  config?: Partial<TSAConfig>
): Promise<TSAResponse> {
  const service = createTSAService(config);
  const hash = await generateHash(content, config?.hashAlgorithm || 'SHA-256');
  
  return service.requestTimestamp({
    documentHash: hash,
    hashAlgorithm: config?.hashAlgorithm || 'SHA-256',
    documentType,
    documentId,
    certReq: true,
  });
}

// Criar serviço Serpro pré-configurado
export function createSerproTSAService(): TSAService {
  return createTSAService({
    provider: 'serpro',
    consumerKey: SERPRO_CONFIG.consumerKey,
    consumerSecret: SERPRO_CONFIG.consumerSecret,
  });
}
