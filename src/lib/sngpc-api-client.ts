// SNGPC API Client - ANVISA
// Baseado na documentação oficial: https://sngpc-api.anvisa.gov.br/swagger/v1/swagger.json

const SNGPC_API_BASE_URL = 'https://sngpc-api.anvisa.gov.br';

export interface SNGPCAuthCredentials {
  username: string;
  password: string;
}

export interface SNGPCAuthResponse {
  token: string;
  expiresIn?: number;
}

export interface SNGPCEnvioResponse {
  hash: string;
  mensagem?: string;
  sucesso: boolean;
  erros?: string[];
}

export interface SNGPCConsultaResponse {
  hash: string;
  dataInicioRetorno: string;
  dataFimRetorno: string;
  dataTransmissao: string;
  dataValidacao: string;
  descricaoValidacao: string[];
  validado: boolean;
}

export class SNGPCApiClient {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  async autenticar(credentials: SNGPCAuthCredentials): Promise<string> {
    const response = await fetch(`${SNGPC_API_BASE_URL}/v1/Authentication/GetToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(`Erro na autenticação SNGPC: ${response.status} ${response.statusText}`);
    }

    this.token = await response.text();
    this.tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hora
    return this.token;
  }

  async autenticarKeycloak(code: string): Promise<string> {
    const response = await fetch(
      `${SNGPC_API_BASE_URL}/api/Auth/ObterTokenKeycloak?code=${code}`,
      {
        method: 'GET',
        headers: { 'Accept': '*/*' },
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na autenticação Keycloak: ${response.status}`);
    }

    this.token = await response.text();
    return this.token;
  }

  async enviarArquivoXML(xml: string): Promise<SNGPCEnvioResponse> {
    if (!this.token) {
      throw new Error('Não autenticado. Chame autenticar() primeiro.');
    }

    const response = await fetch(`${SNGPC_API_BASE_URL}/v1/FileXml/EnviarArquivoXmlSNGPC`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(xml),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        hash: '',
        sucesso: false,
        erros: [responseText || `Erro ${response.status}: ${response.statusText}`],
      };
    }

    return {
      hash: responseText,
      sucesso: true,
    };
  }

  async consultarArquivo(email: string, cnpj: string, hash: string): Promise<SNGPCConsultaResponse> {
    if (!this.token) {
      throw new Error('Não autenticado. Chame autenticar() primeiro.');
    }

    const response = await fetch(
      `${SNGPC_API_BASE_URL}/v1/FileXml/ConsultaDadosArquivoXml/${encodeURIComponent(email)}/${cnpj}/${hash}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Authorization': `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na consulta: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return {
        hash,
        dataInicioRetorno: '',
        dataFimRetorno: '',
        dataTransmissao: '',
        dataValidacao: '',
        descricaoValidacao: [text],
        validado: false,
      };
    }
  }

  isAuthenticated(): boolean {
    return !!this.token && (!this.tokenExpiry || this.tokenExpiry > new Date());
  }

  getToken(): string | null {
    return this.token;
  }
}

export const sngpcClient = new SNGPCApiClient();
