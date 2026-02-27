/**
 * RNDS Auth — Autenticação OAuth2 para RNDS via gov.br
 * 
 * Implementa o fluxo de autenticação com certificado digital ICP-Brasil
 * para obter tokens de acesso à API da RNDS.
 * 
 * Fluxo:
 * 1. Gerar JWT assinado com certificado ICP-Brasil
 * 2. Trocar JWT por access_token na API de autenticação
 * 3. Usar access_token nas requisições à RNDS
 * 
 * Referência: https://rnds.saude.gov.br/documentacao/autenticacao
 */

import { RNDS_ENVIRONMENTS, type RNDSEnvironment } from './rnds-client';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface RNDSAuthConfig {
  environment: RNDSEnvironment;
  certificateData: string;
  certificatePassword: string;
  cnes: string;
}

export interface RNDSTokenResponse {
  success: boolean;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: Date;
  scope?: string;
  error?: string;
}

export interface CertificateInfo {
  subjectCN: string;
  subjectCPF?: string;
  subjectCNPJ?: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  isValid: boolean;
  daysUntilExpiry: number;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const JWT_ALGORITHM = 'RS256';
const JWT_EXPIRY_SECONDS = 300; // 5 minutos
const TOKEN_REFRESH_MARGIN_SECONDS = 60; // Renovar 1 minuto antes de expirar

// ─── Classe de Autenticação RNDS ───────────────────────────────────────────────

export class RNDSAuth {
  private config: RNDSAuthConfig;
  private authUrl: string;
  private currentToken?: RNDSTokenResponse;

  constructor(config: RNDSAuthConfig) {
    this.config = config;
    this.authUrl = RNDS_ENVIRONMENTS[config.environment].authUrl;
  }

  /**
   * Obtém um token de acesso válido.
   * Se já existe um token válido em cache, retorna ele.
   * Caso contrário, solicita um novo token.
   */
  async getAccessToken(): Promise<RNDSTokenResponse> {
    if (this.currentToken?.accessToken && this.isTokenValid()) {
      return this.currentToken;
    }

    return this.requestNewToken();
  }

  /**
   * Força a renovação do token, mesmo que o atual ainda seja válido.
   */
  async refreshToken(): Promise<RNDSTokenResponse> {
    return this.requestNewToken();
  }

  /**
   * Verifica se o token atual ainda é válido.
   */
  isTokenValid(): boolean {
    if (!this.currentToken?.expiresAt) return false;
    
    const now = new Date();
    const expiresAt = new Date(this.currentToken.expiresAt);
    const marginMs = TOKEN_REFRESH_MARGIN_SECONDS * 1000;
    
    return now.getTime() < expiresAt.getTime() - marginMs;
  }

  /**
   * Solicita um novo token de acesso à API de autenticação.
   */
  private async requestNewToken(): Promise<RNDSTokenResponse> {
    try {
      const jwt = await this.generateSignedJWT();
      
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error_description || errorData.error || `Erro HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

      this.currentToken = {
        success: true,
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        expiresAt,
        scope: data.scope,
      };

      return this.currentToken;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao obter token',
      };
    }
  }

  /**
   * Gera um JWT assinado com o certificado ICP-Brasil.
   * 
   * O JWT contém:
   * - iss: CNES do estabelecimento
   * - sub: CNES do estabelecimento
   * - aud: URL da API de autenticação
   * - iat: Timestamp atual
   * - exp: Timestamp de expiração (5 minutos)
   * - jti: ID único do token
   */
  private async generateSignedJWT(): Promise<string> {
    const header = {
      alg: JWT_ALGORITHM,
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.cnes,
      sub: this.config.cnes,
      aud: this.authUrl,
      iat: now,
      exp: now + JWT_EXPIRY_SECONDS,
      jti: crypto.randomUUID(),
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = await this.signWithCertificate(dataToSign);
    
    return `${dataToSign}.${signature}`;
  }

  /**
   * Assina dados com o certificado ICP-Brasil.
   * 
   * NOTA: Em produção, isso deve ser feito no backend (Edge Function)
   * para não expor a chave privada no frontend.
   */
  private async signWithCertificate(data: string): Promise<string> {
    // Esta é uma implementação simplificada.
    // Em produção, a assinatura deve ser feita no servidor
    // usando a biblioteca node-forge ou similar.
    
    // Por enquanto, retornamos um placeholder que será
    // substituído pela Edge Function real.
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Simula assinatura (em produção, usar chave privada real)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = base64UrlEncode(
      String.fromCharCode(...hashArray)
    );
    
    return signature;
  }
}

// ─── Funções auxiliares ────────────────────────────────────────────────────────

/**
 * Codifica string em Base64 URL-safe (sem padding).
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodifica Base64 URL-safe.
 */
export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Extrai informações de um certificado ICP-Brasil (formato PEM ou P12).
 * 
 * NOTA: Implementação completa requer node-forge no backend.
 * Esta versão é um placeholder para o frontend.
 */
export function parseCertificateInfo(certificateData: string): CertificateInfo | null {
  try {
    // Placeholder - em produção, usar node-forge para parsing real
    // O parsing real deve ser feito no backend (Edge Function)
    
    return {
      subjectCN: 'Certificado ICP-Brasil',
      issuer: 'AC Certificadora',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isValid: true,
      daysUntilExpiry: 365,
    };
  } catch {
    return null;
  }
}

/**
 * Valida se um certificado está dentro do prazo de validade.
 */
export function isCertificateValid(validTo: Date): boolean {
  return new Date() < validTo;
}

/**
 * Calcula dias até a expiração do certificado.
 */
export function daysUntilExpiry(validTo: Date): number {
  const now = new Date();
  const diff = validTo.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Factory function ──────────────────────────────────────────────────────────

export function createRNDSAuth(config: RNDSAuthConfig): RNDSAuth {
  return new RNDSAuth(config);
}

// ─── Tipos exportados ──────────────────────────────────────────────────────────

export type { RNDSEnvironment };
