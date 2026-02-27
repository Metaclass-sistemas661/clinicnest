/**
 * RNDS Client — Cliente HTTP para API da Rede Nacional de Dados em Saúde
 * 
 * Implementa comunicação com a RNDS do Ministério da Saúde para envio
 * de dados clínicos (Contato Assistencial, Resultados de Exames, etc.)
 * 
 * Referência: https://rnds.saude.gov.br/
 * Documentação API: https://servicos-datasus.saude.gov.br/detalhe/RNDS
 */

import { buildFHIRBundle, buildFHIRPatient, buildFHIREncounter, buildFHIRObservation, buildFHIRCondition } from './fhir';
import type { PatientData, EncounterData, ObservationData, ConditionData, FHIRBundle, FHIRResource } from './fhir';

// ─── Configuração de Ambientes ─────────────────────────────────────────────────

export const RNDS_ENVIRONMENTS = {
  homologacao: {
    authUrl: 'https://ehr-auth-hmg.saude.gov.br/api/token',
    fhirUrl: 'https://ehr-services-hmg.saude.gov.br/api/fhir/r4',
    cadsusUrl: 'https://servicos-hmg.saude.gov.br/cadsus/PDQSupplier',
  },
  producao: {
    authUrl: 'https://ehr-auth.saude.gov.br/api/token',
    fhirUrl: 'https://ehr-services.saude.gov.br/api/fhir/r4',
    cadsusUrl: 'https://servicos.saude.gov.br/cadsus/PDQSupplier',
  },
} as const;

export type RNDSEnvironment = keyof typeof RNDS_ENVIRONMENTS;

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface RNDSConfig {
  environment: RNDSEnvironment;
  cnes: string;
  uf: string;
  accessToken?: string;
}

export interface RNDSAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface RNDSSubmissionResult {
  success: boolean;
  protocol?: string;
  resourceId?: string;
  response?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RNDSPatientLookupResult {
  found: boolean;
  cns?: string;
  cpf?: string;
  name?: string;
  birthDate?: string;
  gender?: string;
  error?: string;
}

// ─── Headers padrão RNDS ───────────────────────────────────────────────────────

function buildHeaders(config: RNDSConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json',
    'X-Authorization-Server': 'Bearer ' + (config.accessToken || ''),
  };
  
  return headers;
}

// ─── Classe principal do cliente RNDS ──────────────────────────────────────────

export class RNDSClient {
  private config: RNDSConfig;
  private urls: typeof RNDS_ENVIRONMENTS.homologacao;

  constructor(config: RNDSConfig) {
    this.config = config;
    this.urls = RNDS_ENVIRONMENTS[config.environment];
  }

  setAccessToken(token: string) {
    this.config.accessToken = token;
  }

  getEnvironment(): RNDSEnvironment {
    return this.config.environment;
  }

  // ─── Enviar Bundle FHIR ────────────────────────────────────────────────────────

  async submitBundle(bundle: FHIRBundle): Promise<RNDSSubmissionResult> {
    if (!this.config.accessToken) {
      return {
        success: false,
        error: { code: 'NO_TOKEN', message: 'Token de acesso não configurado' },
      };
    }

    try {
      const response = await fetch(this.urls.fhirUrl, {
        method: 'POST',
        headers: buildHeaders(this.config),
        body: JSON.stringify(bundle),
      });

      const responseData = await response.json().catch(() => null);

      if (response.ok) {
        const protocol = response.headers.get('X-Request-Id') || 
                        response.headers.get('Location')?.split('/').pop();
        
        return {
          success: true,
          protocol,
          resourceId: responseData?.id,
          response: responseData,
        };
      }

      const errorCode = responseData?.issue?.[0]?.code || response.status.toString();
      const errorMessage = responseData?.issue?.[0]?.diagnostics || 
                          responseData?.message || 
                          `Erro HTTP ${response.status}`;

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: responseData,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Erro de conexão com RNDS',
        },
      };
    }
  }

  // ─── Enviar Contato Assistencial (Consulta) ────────────────────────────────────

  async submitContatoAssistencial(
    patient: PatientData,
    encounter: EncounterData,
    observations?: ObservationData[],
    conditions?: ConditionData[]
  ): Promise<RNDSSubmissionResult> {
    const resources: FHIRResource[] = [
      buildFHIRPatient(patient),
      buildFHIREncounter(encounter),
    ];

    if (observations) {
      resources.push(...observations.map(o => buildFHIRObservation(o)));
    }

    if (conditions) {
      resources.push(...conditions.map(c => buildFHIRCondition(c)));
    }

    const bundle = buildFHIRBundle(resources);
    bundle.type = 'transaction';

    return this.submitBundle(bundle);
  }

  // ─── Consultar paciente por CPF (CADSUS) ───────────────────────────────────────

  async lookupPatientByCPF(cpf: string): Promise<RNDSPatientLookupResult> {
    if (!this.config.accessToken) {
      return { found: false, error: 'Token de acesso não configurado' };
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    
    try {
      const url = `${this.urls.fhirUrl}/Patient?identifier=http://rnds-fhir.saude.gov.br/NamingSystem/cpf|${cleanCpf}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(this.config),
      });

      if (!response.ok) {
        return { found: false, error: `Erro HTTP ${response.status}` };
      }

      const data = await response.json();
      
      if (data.total === 0 || !data.entry?.length) {
        return { found: false };
      }

      const patient = data.entry[0].resource;
      const cnsIdentifier = patient.identifier?.find(
        (i: { system?: string }) => i.system?.includes('cns')
      );

      return {
        found: true,
        cns: cnsIdentifier?.value,
        cpf: cleanCpf,
        name: patient.name?.[0]?.text || 
              `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`.trim(),
        birthDate: patient.birthDate,
        gender: patient.gender,
      };
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar CADSUS',
      };
    }
  }

  // ─── Consultar paciente por CNS ────────────────────────────────────────────────

  async lookupPatientByCNS(cns: string): Promise<RNDSPatientLookupResult> {
    if (!this.config.accessToken) {
      return { found: false, error: 'Token de acesso não configurado' };
    }

    const cleanCns = cns.replace(/\D/g, '');
    
    try {
      const url = `${this.urls.fhirUrl}/Patient?identifier=http://rnds-fhir.saude.gov.br/NamingSystem/cns|${cleanCns}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(this.config),
      });

      if (!response.ok) {
        return { found: false, error: `Erro HTTP ${response.status}` };
      }

      const data = await response.json();
      
      if (data.total === 0 || !data.entry?.length) {
        return { found: false };
      }

      const patient = data.entry[0].resource;
      const cpfIdentifier = patient.identifier?.find(
        (i: { system?: string }) => i.system?.includes('cpf')
      );

      return {
        found: true,
        cns: cleanCns,
        cpf: cpfIdentifier?.value,
        name: patient.name?.[0]?.text || 
              `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`.trim(),
        birthDate: patient.birthDate,
        gender: patient.gender,
      };
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar CADSUS',
      };
    }
  }

  // ─── Verificar status da conexão ───────────────────────────────────────────────

  async checkConnection(): Promise<{ connected: boolean; message: string }> {
    if (!this.config.accessToken) {
      return { connected: false, message: 'Token de acesso não configurado' };
    }

    try {
      const response = await fetch(`${this.urls.fhirUrl}/metadata`, {
        method: 'GET',
        headers: buildHeaders(this.config),
      });

      if (response.ok) {
        return { connected: true, message: 'Conexão com RNDS estabelecida' };
      }

      return { connected: false, message: `Erro HTTP ${response.status}` };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }
}

// ─── Validadores ───────────────────────────────────────────────────────────────

export function validateCNES(cnes: string): boolean {
  const clean = cnes.replace(/\D/g, '');
  return clean.length === 7;
}

export function validateCNS(cns: string): boolean {
  const clean = cns.replace(/\D/g, '');
  if (clean.length !== 15) return false;
  
  const firstDigit = parseInt(clean[0], 10);
  
  if ([1, 2].includes(firstDigit)) {
    return validateCNSDefinitivo(clean);
  } else if ([7, 8, 9].includes(firstDigit)) {
    return validateCNSProvisorio(clean);
  }
  
  return false;
}

function validateCNSDefinitivo(cns: string): boolean {
  const pis = cns.substring(0, 11);
  let soma = 0;
  for (let i = 0; i < 11; i++) {
    soma += parseInt(pis[i], 10) * (15 - i);
  }
  const resto = soma % 11;
  const dv = resto === 0 ? 0 : 11 - resto;
  
  let resultado = pis + '001' + dv.toString();
  if (dv === 10) {
    soma = 0;
    for (let i = 0; i < 11; i++) {
      soma += parseInt(pis[i], 10) * (15 - i);
    }
    soma += 2 * 3 + 1 * 2;
    const resto2 = soma % 11;
    const dv2 = resto2 === 0 ? 0 : 11 - resto2;
    resultado = pis + '002' + dv2.toString();
  }
  
  return resultado === cns;
}

function validateCNSProvisorio(cns: string): boolean {
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    soma += parseInt(cns[i], 10) * (15 - i);
  }
  return soma % 11 === 0;
}

export function validateUF(uf: string): boolean {
  const ufs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  return ufs.includes(uf.toUpperCase());
}

// ─── Factory function ──────────────────────────────────────────────────────────

export function createRNDSClient(config: RNDSConfig): RNDSClient {
  return new RNDSClient(config);
}

// ─── Tipos de recursos RNDS ────────────────────────────────────────────────────

export const RNDS_RESOURCE_TYPES = {
  CONTATO_ASSISTENCIAL: 'contato_assistencial',
  RESULTADO_EXAME: 'resultado_exame',
  IMUNIZACAO: 'imunizacao',
  ATESTADO_DIGITAL: 'atestado_digital',
  PRESCRICAO_DIGITAL: 'prescricao_digital',
} as const;

export type RNDSResourceType = typeof RNDS_RESOURCE_TYPES[keyof typeof RNDS_RESOURCE_TYPES];

// ─── Mapeamento de erros RNDS ──────────────────────────────────────────────────

export const RNDS_ERROR_MESSAGES: Record<string, string> = {
  'invalid': 'Recurso FHIR inválido',
  'structure': 'Estrutura do recurso incorreta',
  'required': 'Campo obrigatório não informado',
  'value': 'Valor inválido para o campo',
  'invariant': 'Regra de negócio violada',
  'security': 'Erro de autenticação ou autorização',
  'login': 'Token expirado ou inválido',
  'unknown': 'Erro desconhecido',
  'not-found': 'Recurso não encontrado',
  'conflict': 'Conflito - recurso já existe',
  'gone': 'Recurso foi removido',
  'too-costly': 'Operação muito custosa',
  'business-rule': 'Regra de negócio violada',
  'lock-error': 'Erro de bloqueio',
  'no-store': 'Armazenamento não disponível',
  'exception': 'Exceção interna',
  'timeout': 'Tempo limite excedido',
  'incomplete': 'Operação incompleta',
  'transient': 'Erro temporário - tente novamente',
  'throttled': 'Muitas requisições - aguarde',
};

export function getErrorMessage(code: string): string {
  return RNDS_ERROR_MESSAGES[code] || RNDS_ERROR_MESSAGES['unknown'];
}
