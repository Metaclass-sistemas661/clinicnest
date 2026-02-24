/**
 * Integração com CRMs — RD Station e HubSpot
 * 
 * Clientes para sincronização de leads e contatos com plataformas de marketing.
 * Permite automação de marketing para clínicas com estratégias avançadas.
 */

// ─── Tipos Comuns ─────────────────────────────────────────────────────────────

export interface CRMContato {
  id?: string;
  email: string;
  nome?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  tags?: string[];
  camposPersonalizados?: Record<string, string | number | boolean>;
  origem?: string;
  dataConversao?: string;
}

export interface CRMEvento {
  tipo: string;
  contatoEmail: string;
  valor?: number;
  dados?: Record<string, unknown>;
  dataEvento?: string;
}

export interface CRMOportunidade {
  id?: string;
  nome: string;
  contatoId: string;
  valor?: number;
  etapa: string;
  probabilidade?: number;
  dataFechamentoPrevisto?: string;
  responsavelId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RD STATION API
// Referência: https://developers.rdstation.com/
// ═══════════════════════════════════════════════════════════════════════════════

export interface RDStationConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export class RDStationClient {
  private config: RDStationConfig;
  private baseUrl = 'https://api.rd.services';

  constructor(config: RDStationConfig) {
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
      throw new Error(`RD Station API Error: ${error.error_message || response.statusText}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  async buscarContato(email: string): Promise<CRMContato | null> {
    try {
      const result = await this.request<any>(`/platform/contacts/email:${encodeURIComponent(email)}`);
      return mapRDContato(result);
    } catch {
      return null;
    }
  }

  async criarOuAtualizarContato(contato: CRMContato): Promise<{ uuid: string }> {
    const result = await this.request<any>('/platform/contacts', 'PATCH', {
      email: contato.email,
      name: contato.nome,
      personal_phone: contato.telefone,
      company_name: contato.empresa,
      job_title: contato.cargo,
      tags: contato.tags,
      cf_origem: contato.origem,
      ...mapCamposPersonalizadosRD(contato.camposPersonalizados),
    });

    return { uuid: result.uuid };
  }

  async adicionarTags(email: string, tags: string[]): Promise<void> {
    await this.request('/platform/contacts', 'PATCH', {
      email,
      tags,
    });
  }

  async registrarEvento(evento: CRMEvento): Promise<void> {
    await this.request('/platform/events', 'POST', {
      event_type: evento.tipo,
      event_family: 'CDP',
      payload: {
        email: evento.contatoEmail,
        value: evento.valor,
        ...evento.dados,
      },
    });
  }

  async registrarConversao(identificador: string, email: string, dados?: Record<string, unknown>): Promise<void> {
    await this.request('/platform/conversions', 'POST', {
      event_type: 'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: identificador,
        email,
        ...dados,
      },
    });
  }

  async listarFunis(): Promise<Array<{ id: string; nome: string }>> {
    const result = await this.request<any>('/platform/funnels');
    return (result.funnels || []).map((f: any) => ({
      id: f.id,
      nome: f.name,
    }));
  }

  async criarOportunidade(funilId: string, oportunidade: CRMOportunidade): Promise<{ id: string }> {
    const result = await this.request<any>(`/platform/funnels/${funilId}/opportunities`, 'POST', {
      name: oportunidade.nome,
      contact_uuid: oportunidade.contatoId,
      amount: oportunidade.valor,
      stage_id: oportunidade.etapa,
      win_probability: oportunidade.probabilidade,
      expected_close_date: oportunidade.dataFechamentoPrevisto,
      owner_id: oportunidade.responsavelId,
    });

    return { id: result.id };
  }

  async atualizarOportunidade(funilId: string, oportunidadeId: string, dados: Partial<CRMOportunidade>): Promise<void> {
    await this.request(`/platform/funnels/${funilId}/opportunities/${oportunidadeId}`, 'PUT', {
      name: dados.nome,
      amount: dados.valor,
      stage_id: dados.etapa,
      win_probability: dados.probabilidade,
    });
  }
}

function mapRDContato(c: any): CRMContato {
  return {
    id: c.uuid,
    email: c.email,
    nome: c.name,
    telefone: c.personal_phone || c.mobile_phone,
    empresa: c.company_name,
    cargo: c.job_title,
    tags: c.tags,
    origem: c.cf_origem,
    dataConversao: c.first_conversion?.created_at,
  };
}

function mapCamposPersonalizadosRD(campos?: Record<string, string | number | boolean>): Record<string, unknown> {
  if (!campos) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(campos)) {
    result[`cf_${key}`] = value;
  }
  return result;
}

// ─── Eventos Pré-definidos para Clínicas (RD Station) ─────────────────────────

export const RD_EVENTOS_CLINICA = {
  AGENDAMENTO_CONSULTA: 'agendamento_consulta',
  CONSULTA_REALIZADA: 'consulta_realizada',
  EXAME_SOLICITADO: 'exame_solicitado',
  EXAME_REALIZADO: 'exame_realizado',
  ORCAMENTO_ENVIADO: 'orcamento_enviado',
  ORCAMENTO_APROVADO: 'orcamento_aprovado',
  PAGAMENTO_REALIZADO: 'pagamento_realizado',
  RETORNO_AGENDADO: 'retorno_agendado',
  CANCELAMENTO: 'cancelamento',
  NO_SHOW: 'no_show',
} as const;

export const RD_CONVERSOES_CLINICA = {
  LEAD_SITE: 'lead_site',
  LEAD_WHATSAPP: 'lead_whatsapp',
  LEAD_TELEFONE: 'lead_telefone',
  LEAD_INDICACAO: 'lead_indicacao',
  AGENDAMENTO_ONLINE: 'agendamento_online',
  DOWNLOAD_MATERIAL: 'download_material',
  INSCRICAO_NEWSLETTER: 'inscricao_newsletter',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HUBSPOT API
// Referência: https://developers.hubspot.com/
// ═══════════════════════════════════════════════════════════════════════════════

export interface HubSpotConfig {
  accessToken: string;
}

export class HubSpotClient {
  private config: HubSpotConfig;
  private baseUrl = 'https://api.hubapi.com';

  constructor(config: HubSpotConfig) {
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
      throw new Error(`HubSpot API Error: ${error.message || response.statusText}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  async buscarContato(email: string): Promise<CRMContato | null> {
    try {
      const result = await this.request<any>(`/crm/v3/objects/contacts/${email}?idProperty=email`);
      return mapHubSpotContato(result);
    } catch {
      return null;
    }
  }

  async criarContato(contato: CRMContato): Promise<{ id: string }> {
    const result = await this.request<any>('/crm/v3/objects/contacts', 'POST', {
      properties: {
        email: contato.email,
        firstname: contato.nome?.split(' ')[0],
        lastname: contato.nome?.split(' ').slice(1).join(' '),
        phone: contato.telefone,
        company: contato.empresa,
        jobtitle: contato.cargo,
        hs_lead_status: 'NEW',
        ...contato.camposPersonalizados,
      },
    });

    return { id: result.id };
  }

  async atualizarContato(contatoId: string, dados: Partial<CRMContato>): Promise<void> {
    await this.request(`/crm/v3/objects/contacts/${contatoId}`, 'PATCH', {
      properties: {
        firstname: dados.nome?.split(' ')[0],
        lastname: dados.nome?.split(' ').slice(1).join(' '),
        phone: dados.telefone,
        company: dados.empresa,
        jobtitle: dados.cargo,
        ...dados.camposPersonalizados,
      },
    });
  }

  async criarOuAtualizarContato(contato: CRMContato): Promise<{ id: string }> {
    const existente = await this.buscarContato(contato.email);
    if (existente?.id) {
      await this.atualizarContato(existente.id, contato);
      return { id: existente.id };
    }
    return this.criarContato(contato);
  }

  async listarContatos(limit = 100, after?: string): Promise<{ contatos: CRMContato[]; nextPage?: string }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (after) params.set('after', after);

    const result = await this.request<any>(`/crm/v3/objects/contacts?${params}`);
    return {
      contatos: (result.results || []).map(mapHubSpotContato),
      nextPage: result.paging?.next?.after,
    };
  }

  async criarNegocio(oportunidade: CRMOportunidade): Promise<{ id: string }> {
    const result = await this.request<any>('/crm/v3/objects/deals', 'POST', {
      properties: {
        dealname: oportunidade.nome,
        amount: oportunidade.valor,
        dealstage: oportunidade.etapa,
        closedate: oportunidade.dataFechamentoPrevisto,
        hubspot_owner_id: oportunidade.responsavelId,
        hs_deal_stage_probability: oportunidade.probabilidade,
      },
    });

    if (oportunidade.contatoId) {
      await this.associarContatoNegocio(result.id, oportunidade.contatoId);
    }

    return { id: result.id };
  }

  async atualizarNegocio(negocioId: string, dados: Partial<CRMOportunidade>): Promise<void> {
    await this.request(`/crm/v3/objects/deals/${negocioId}`, 'PATCH', {
      properties: {
        dealname: dados.nome,
        amount: dados.valor,
        dealstage: dados.etapa,
        closedate: dados.dataFechamentoPrevisto,
        hs_deal_stage_probability: dados.probabilidade,
      },
    });
  }

  async associarContatoNegocio(negocioId: string, contatoId: string): Promise<void> {
    await this.request(`/crm/v3/objects/deals/${negocioId}/associations/contacts/${contatoId}/deal_to_contact`, 'PUT');
  }

  async registrarEvento(evento: CRMEvento): Promise<void> {
    const contato = await this.buscarContato(evento.contatoEmail);
    if (!contato?.id) return;

    await this.request('/crm/v3/objects/events', 'POST', {
      eventTemplateId: evento.tipo,
      objectId: contato.id,
      tokens: evento.dados,
      occurredAt: evento.dataEvento || new Date().toISOString(),
    });
  }

  async listarPipelines(): Promise<Array<{ id: string; nome: string; etapas: Array<{ id: string; nome: string }> }>> {
    const result = await this.request<any>('/crm/v3/pipelines/deals');
    return (result.results || []).map((p: any) => ({
      id: p.id,
      nome: p.label,
      etapas: (p.stages || []).map((s: any) => ({
        id: s.id,
        nome: s.label,
      })),
    }));
  }

  async criarNota(contatoId: string, conteudo: string): Promise<{ id: string }> {
    const result = await this.request<any>('/crm/v3/objects/notes', 'POST', {
      properties: { hs_note_body: conteudo },
    });

    await this.request(`/crm/v3/objects/notes/${result.id}/associations/contacts/${contatoId}/note_to_contact`, 'PUT');

    return { id: result.id };
  }

  async criarTarefa(contatoId: string, titulo: string, dataVencimento: string, descricao?: string): Promise<{ id: string }> {
    const result = await this.request<any>('/crm/v3/objects/tasks', 'POST', {
      properties: {
        hs_task_subject: titulo,
        hs_task_body: descricao,
        hs_task_status: 'NOT_STARTED',
        hs_timestamp: new Date(dataVencimento).getTime(),
      },
    });

    await this.request(`/crm/v3/objects/tasks/${result.id}/associations/contacts/${contatoId}/task_to_contact`, 'PUT');

    return { id: result.id };
  }
}

function mapHubSpotContato(c: any): CRMContato {
  const props = c.properties || {};
  return {
    id: c.id,
    email: props.email,
    nome: [props.firstname, props.lastname].filter(Boolean).join(' '),
    telefone: props.phone,
    empresa: props.company,
    cargo: props.jobtitle,
    dataConversao: props.createdate,
  };
}

// ─── Etapas de Pipeline Sugeridas para Clínicas (HubSpot) ─────────────────────

export const HUBSPOT_ETAPAS_CLINICA = {
  LEAD: 'lead',
  CONTATO_REALIZADO: 'contato_realizado',
  AGENDAMENTO_MARCADO: 'agendamento_marcado',
  CONSULTA_REALIZADA: 'consulta_realizada',
  ORCAMENTO_ENVIADO: 'orcamento_enviado',
  NEGOCIACAO: 'negociacao',
  FECHADO_GANHO: 'closedwon',
  FECHADO_PERDIDO: 'closedlost',
} as const;

// ─── Utilitário de Sincronização ──────────────────────────────────────────────

export interface SyncResult {
  criados: number;
  atualizados: number;
  erros: Array<{ email: string; erro: string }>;
}

export async function sincronizarContatosParaCRM(
  contatos: CRMContato[],
  cliente: RDStationClient | HubSpotClient
): Promise<SyncResult> {
  const result: SyncResult = { criados: 0, atualizados: 0, erros: [] };

  for (const contato of contatos) {
    try {
      const existente = await cliente.buscarContato(contato.email);
      await cliente.criarOuAtualizarContato(contato);
      
      if (existente) {
        result.atualizados++;
      } else {
        result.criados++;
      }
    } catch (e) {
      result.erros.push({
        email: contato.email,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
