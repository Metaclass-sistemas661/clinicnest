/**
 * e-SUS AB — Atenção Básica
 * 
 * Integração COMPLETA com o sistema e-SUS AB do Ministério da Saúde.
 * Obrigatório para UBS (Unidades Básicas de Saúde) e ESF (Estratégia Saúde da Família).
 * 
 * Referência: https://sisaps.saude.gov.br/esus/
 * Thrift API: https://integracao.esusab.ufsc.br/
 * Manual CDS: https://aps.saude.gov.br/ape/esus/manual_3_2
 * 
 * Versão: 3.2 (compatível com PEC 5.x)
 */

// ─── Tipos de Ficha CDS ───────────────────────────────────────────────────────

export const TIPOS_FICHA = {
  CADASTRO_INDIVIDUAL: 'CadastroIndividual',
  CADASTRO_DOMICILIAR: 'CadastroDomiciliar',
  ATENDIMENTO_INDIVIDUAL: 'AtendimentoIndividual',
  ATENDIMENTO_ODONTOLOGICO: 'AtendimentoOdontologico',
  PROCEDIMENTOS: 'Procedimentos',
  VISITA_DOMICILIAR: 'VisitaDomiciliar',
  ATIVIDADE_COLETIVA: 'AtividadeColetiva',
  VACINACAO: 'Vacinacao',
  MARCADORES_CONSUMO: 'MarcadoresConsumoAlimentar',
  SINDROME_NEUROLOGICA: 'SindromeNeurologica',
} as const;

// ─── CBO (Classificação Brasileira de Ocupações) — Saúde ─────────────────────

export const CBO_SAUDE = {
  // Médicos
  MEDICO_CLINICO: '225125',
  MEDICO_FAMILIA: '225130',
  MEDICO_PEDIATRA: '225124',
  MEDICO_GINECOLOGISTA: '225250',
  MEDICO_PSIQUIATRA: '225133',
  MEDICO_GERIATRA: '225109',
  // Enfermagem
  ENFERMEIRO: '223505',
  ENFERMEIRO_SAUDE_FAMILIA: '223565',
  TECNICO_ENFERMAGEM: '322205',
  AUXILIAR_ENFERMAGEM: '322210',
  // Odontologia
  DENTISTA: '223208',
  DENTISTA_SAUDE_FAMILIA: '223293',
  TECNICO_SAUDE_BUCAL: '322415',
  AUXILIAR_SAUDE_BUCAL: '322420',
  // Agentes
  ACS: '515105', // Agente Comunitário de Saúde
  ACE: '515110', // Agente de Combate a Endemias
  // Outros profissionais
  PSICOLOGO: '251510',
  NUTRICIONISTA: '223710',
  FISIOTERAPEUTA: '223605',
  FARMACEUTICO: '223405',
  ASSISTENTE_SOCIAL: '251605',
  FONOAUDIOLOGO: '223810',
  TERAPEUTA_OCUPACIONAL: '223905',
  EDUCADOR_FISICO: '224110',
} as const;

// ─── CIAP-2 (Classificação Internacional de Atenção Primária) ─────────────────
// Códigos mais usados na Atenção Básica — expandido para UBS

export const CIAP2 = {
  // A - Geral e Inespecífico
  A03: { codigo: 'A03', descricao: 'Febre' },
  A04: { codigo: 'A04', descricao: 'Debilidade/cansaço geral' },
  A05: { codigo: 'A05', descricao: 'Mal-estar geral' },
  A13: { codigo: 'A13', descricao: 'Preocupação com/medo de tratamento' },
  A97: { codigo: 'A97', descricao: 'Sem doença' },
  A98: { codigo: 'A98', descricao: 'Promoção da saúde/medicina preventiva' },
  
  // B - Sangue/Sistema Hematopoiético
  B80: { codigo: 'B80', descricao: 'Anemia por deficiência de ferro' },
  B82: { codigo: 'B82', descricao: 'Outras anemias' },
  
  // D - Aparelho Digestivo
  D01: { codigo: 'D01', descricao: 'Dor abdominal generalizada' },
  D02: { codigo: 'D02', descricao: 'Dor abdominal epigástrica' },
  D10: { codigo: 'D10', descricao: 'Vômito' },
  D11: { codigo: 'D11', descricao: 'Diarreia' },
  D12: { codigo: 'D12', descricao: 'Obstipação' },
  D73: { codigo: 'D73', descricao: 'Gastroenterite presumível infecção' },
  D86: { codigo: 'D86', descricao: 'Úlcera péptica' },
  D87: { codigo: 'D87', descricao: 'Alteração funcional do estômago' },
  
  // K - Aparelho Circulatório
  K78: { codigo: 'K78', descricao: 'Fibrilação/flutter auricular' },
  K79: { codigo: 'K79', descricao: 'Taquicardia paroxística' },
  K85: { codigo: 'K85', descricao: 'Pressão arterial elevada' },
  K86: { codigo: 'K86', descricao: 'Hipertensão sem complicações' },
  K87: { codigo: 'K87', descricao: 'Hipertensão com complicações' },
  K89: { codigo: 'K89', descricao: 'Isquemia cerebral transitória' },
  K90: { codigo: 'K90', descricao: 'AVC/Derrame' },
  K92: { codigo: 'K92', descricao: 'Doença vascular periférica' },
  
  // L - Sistema Musculoesquelético
  L01: { codigo: 'L01', descricao: 'Sintoma/queixa do pescoço' },
  L02: { codigo: 'L02', descricao: 'Sintoma/queixa da região dorsal' },
  L03: { codigo: 'L03', descricao: 'Sintoma/queixa da região lombar' },
  L14: { codigo: 'L14', descricao: 'Sintoma/queixa da perna/coxa' },
  L15: { codigo: 'L15', descricao: 'Sintoma/queixa do joelho' },
  L86: { codigo: 'L86', descricao: 'Síndrome vertebral lombar com irradiação' },
  L88: { codigo: 'L88', descricao: 'Artrite reumatoide' },
  L91: { codigo: 'L91', descricao: 'Osteoartrose' },
  
  // N - Sistema Neurológico
  N01: { codigo: 'N01', descricao: 'Cefaleia' },
  N17: { codigo: 'N17', descricao: 'Vertigem/tontura' },
  N89: { codigo: 'N89', descricao: 'Enxaqueca' },
  N95: { codigo: 'N95', descricao: 'Cefaleia de tensão' },
  
  // P - Psicológico
  P01: { codigo: 'P01', descricao: 'Sensação de ansiedade/nervosismo/tensão' },
  P02: { codigo: 'P02', descricao: 'Reação aguda ao stress' },
  P03: { codigo: 'P03', descricao: 'Sensação de depressão' },
  P06: { codigo: 'P06', descricao: 'Perturbação do sono' },
  P74: { codigo: 'P74', descricao: 'Distúrbio ansioso/estado de ansiedade' },
  P76: { codigo: 'P76', descricao: 'Perturbação depressiva' },
  P82: { codigo: 'P82', descricao: 'Stress pós-traumático' },
  
  // R - Aparelho Respiratório
  R05: { codigo: 'R05', descricao: 'Tosse' },
  R07: { codigo: 'R07', descricao: 'Espirros/congestão nasal' },
  R21: { codigo: 'R21', descricao: 'Sintoma/queixa da garganta' },
  R74: { codigo: 'R74', descricao: 'Infecção aguda do aparelho respiratório superior' },
  R75: { codigo: 'R75', descricao: 'Sinusite aguda/crônica' },
  R76: { codigo: 'R76', descricao: 'Amigdalite aguda' },
  R77: { codigo: 'R77', descricao: 'Laringite/traqueíte aguda' },
  R78: { codigo: 'R78', descricao: 'Bronquite aguda/bronquiolite' },
  R80: { codigo: 'R80', descricao: 'Gripe' },
  R81: { codigo: 'R81', descricao: 'Pneumonia' },
  R96: { codigo: 'R96', descricao: 'Asma' },
  
  // S - Pele
  S03: { codigo: 'S03', descricao: 'Verrugas' },
  S06: { codigo: 'S06', descricao: 'Erupção cutânea localizada' },
  S07: { codigo: 'S07', descricao: 'Erupção cutânea generalizada' },
  S74: { codigo: 'S74', descricao: 'Dermatofitose' },
  S84: { codigo: 'S84', descricao: 'Impetigo' },
  S87: { codigo: 'S87', descricao: 'Dermatite atópica/eczema' },
  S88: { codigo: 'S88', descricao: 'Dermatite de contato/alérgica' },
  
  // T - Endócrino/Metabólico/Nutricional
  T82: { codigo: 'T82', descricao: 'Obesidade' },
  T83: { codigo: 'T83', descricao: 'Excesso de peso' },
  T89: { codigo: 'T89', descricao: 'Diabetes insulino-dependente' },
  T90: { codigo: 'T90', descricao: 'Diabetes não insulino-dependente' },
  T93: { codigo: 'T93', descricao: 'Alteração do metabolismo dos lipídios' },
  
  // U - Aparelho Urinário
  U01: { codigo: 'U01', descricao: 'Disúria/micção dolorosa' },
  U71: { codigo: 'U71', descricao: 'Cistite/infecção urinária' },
  
  // W - Gravidez/Parto/Planejamento Familiar
  W11: { codigo: 'W11', descricao: 'Contracepção oral' },
  W14: { codigo: 'W14', descricao: 'Contracepção intrauterina' },
  W78: { codigo: 'W78', descricao: 'Gravidez' },
  W84: { codigo: 'W84', descricao: 'Gravidez de alto risco' },
  W90: { codigo: 'W90', descricao: 'Parto sem complicações' },
  W96: { codigo: 'W96', descricao: 'Puerpério normal' },
  
  // X - Aparelho Genital Feminino
  X11: { codigo: 'X11', descricao: 'Sintoma/queixa da menopausa' },
  X72: { codigo: 'X72', descricao: 'Candidíase genital' },
  X84: { codigo: 'X84', descricao: 'Vaginite/vulvite' },
  
  // Y - Aparelho Genital Masculino
  Y85: { codigo: 'Y85', descricao: 'Hipertrofia prostática benigna' },
  
  // Z - Problemas Sociais
  Z01: { codigo: 'Z01', descricao: 'Pobreza/problemas econômicos' },
  Z05: { codigo: 'Z05', descricao: 'Problemas com condições de trabalho' },
  Z25: { codigo: 'Z25', descricao: 'Problema por ato de violência' },
} as const;

// Alias para compatibilidade
export const CIAP2_COMUM = CIAP2;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ESUSCidadao {
  cns?: string;
  cpf?: string;
  nome: string;
  nomeSocial?: string;
  dataNascimento: string;
  sexo: 'M' | 'F';
  racaCor: 'BRANCA' | 'PRETA' | 'AMARELA' | 'PARDA' | 'INDIGENA' | 'SEM_INFO';
  nomeMae: string;
  nacionalidade: 'BRASILEIRA' | 'NATURALIZADO' | 'ESTRANGEIRO';
  telefone?: string;
  email?: string;
}

export interface ESUSEndereco {
  cep?: string;
  municipio: string;
  uf: string;
  bairro: string;
  tipoLogradouro: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  microarea?: string;
}

export interface ESUSProfissional {
  cns: string;
  cbo: string;
  nome: string;
  ine?: string; // Identificador Nacional de Equipe
}

export interface ESUSEstabelecimento {
  cnes: string;
  nome: string;
  ine?: string;
}

export interface ESUSAtendimentoIndividual {
  uuid?: string;
  cidadao: ESUSCidadao;
  profissional: ESUSProfissional;
  estabelecimento: ESUSEstabelecimento;
  dataAtendimento: string;
  turno: 'M' | 'T' | 'N'; // Manhã, Tarde, Noite
  localAtendimento: 'UBS' | 'DOMICILIO' | 'ESCOLA' | 'OUTROS';
  tipoAtendimento: 'CONSULTA_AGENDADA' | 'DEMANDA_ESPONTANEA' | 'URGENCIA';
  pesoKg?: number;
  alturaCm?: number;
  perimetroCefalicoMm?: number;
  vacinacaoEmDia?: boolean;
  problemasAvaliados: Array<{ ciap2?: string; cid10?: string }>;
  condutas: ESUSConduta[];
  examesSolicitados?: string[];
  examesAvaliados?: string[];
  ficouEmObservacao?: boolean;
  nasfs?: string[]; // Núcleo de Apoio à Saúde da Família
  racionalidadeSaude?: 'MEDICINA_TRADICIONAL' | 'HOMEOPATIA' | 'FITOTERAPIA' | 'ACUPUNTURA';
}

export type ESUSConduta = 
  | 'RETORNO_CONSULTA'
  | 'RETORNO_CUIDADO_PROGRAMADO'
  | 'AGENDAMENTO_GRUPOS'
  | 'AGENDAMENTO_NASF'
  | 'ALTA_EPISODIO'
  | 'ENCAMINHAMENTO_INTERNO'
  | 'ENCAMINHAMENTO_SERVICO_ESPECIALIZADO'
  | 'ENCAMINHAMENTO_CAPS'
  | 'ENCAMINHAMENTO_INTERNACAO'
  | 'ENCAMINHAMENTO_URGENCIA'
  | 'ENCAMINHAMENTO_SERVICO_AD';

export interface ESUSVisitaDomiciliar {
  uuid?: string;
  cidadao: ESUSCidadao;
  profissional: ESUSProfissional;
  estabelecimento: ESUSEstabelecimento;
  dataVisita: string;
  turno: 'M' | 'T' | 'N';
  motivoVisita: ESUSMotivoVisita[];
  desfecho: 'VISITA_REALIZADA' | 'VISITA_RECUSADA' | 'AUSENTE';
  acompanhamento?: {
    gestante?: boolean;
    puerpera?: boolean;
    recem_nascido?: boolean;
    crianca?: boolean;
    desnutricao?: boolean;
    reabilitacao?: boolean;
    hipertensao?: boolean;
    diabetes?: boolean;
    asma?: boolean;
    dpoc?: boolean;
    cancer?: boolean;
    domiciliado?: boolean;
    saude_mental?: boolean;
    tabagista?: boolean;
    alcoolista?: boolean;
    drogas?: boolean;
    condicoes_vulnerabilidade?: boolean;
    bolsa_familia?: boolean;
  };
}

export type ESUSMotivoVisita =
  | 'CADASTRAMENTO'
  | 'VISITA_PERIODICA'
  | 'CONSULTA'
  | 'EXAME'
  | 'VACINA'
  | 'CONDICIONALIDADES_BOLSA_FAMILIA'
  | 'ACOMPANHAMENTO'
  | 'EGRESSO_INTERNACAO'
  | 'CONVITE_ATIVIDADES_COLETIVAS'
  | 'ORIENTACAO_PREVENCAO'
  | 'OUTROS';

// ─── Gerador de Ficha de Atendimento Individual ───────────────────────────────

export function gerarFichaAtendimentoIndividual(atendimento: ESUSAtendimentoIndividual): object {
  return {
    uuidFicha: atendimento.uuid || crypto.randomUUID(),
    tpCdsOrigem: 3, // Sistema próprio
    headerTransport: {
      profissionalCNS: atendimento.profissional.cns,
      cboCodigo_2002: atendimento.profissional.cbo,
      cnes: atendimento.estabelecimento.cnes,
      ine: atendimento.estabelecimento.ine,
      dataAtendimento: formatarDataESUS(atendimento.dataAtendimento),
    },
    atendimentoIndividual: {
      turno: { M: 1, T: 2, N: 3 }[atendimento.turno],
      localDeAtendimento: {
        UBS: 1,
        DOMICILIO: 4,
        ESCOLA: 5,
        OUTROS: 99,
      }[atendimento.localAtendimento],
      tipoAtendimento: {
        CONSULTA_AGENDADA: 1,
        DEMANDA_ESPONTANEA: 2,
        URGENCIA: 4,
      }[atendimento.tipoAtendimento],
      pesoKg: atendimento.pesoKg,
      alturaKg: atendimento.alturaCm,
      perimetroCefalico: atendimento.perimetroCefalicoMm,
      vacinacaoEmDia: atendimento.vacinacaoEmDia,
      problemasAvaliados: atendimento.problemasAvaliados.map(p => ({
        ciap: p.ciap2,
        cid: p.cid10,
      })),
      condutas: atendimento.condutas.map(c => mapConduta(c)),
      examesSolicitados: atendimento.examesSolicitados,
      examesAvaliados: atendimento.examesAvaliados,
      ficouEmObservacao: atendimento.ficouEmObservacao,
    },
    identificacaoCidadao: {
      cnsCidadao: atendimento.cidadao.cns,
      cpfCidadao: atendimento.cidadao.cpf,
      nomeCidadao: atendimento.cidadao.nome,
      nomeSocialCidadao: atendimento.cidadao.nomeSocial,
      dataNascimentoCidadao: formatarDataESUS(atendimento.cidadao.dataNascimento),
      sexoCidadao: atendimento.cidadao.sexo === 'M' ? 1 : 2,
    },
  };
}

function mapConduta(conduta: ESUSConduta): number {
  const map: Record<ESUSConduta, number> = {
    RETORNO_CONSULTA: 1,
    RETORNO_CUIDADO_PROGRAMADO: 2,
    AGENDAMENTO_GRUPOS: 3,
    AGENDAMENTO_NASF: 4,
    ALTA_EPISODIO: 5,
    ENCAMINHAMENTO_INTERNO: 6,
    ENCAMINHAMENTO_SERVICO_ESPECIALIZADO: 7,
    ENCAMINHAMENTO_CAPS: 8,
    ENCAMINHAMENTO_INTERNACAO: 9,
    ENCAMINHAMENTO_URGENCIA: 10,
    ENCAMINHAMENTO_SERVICO_AD: 11,
  };
  return map[conduta];
}

// ─── Gerador de Ficha de Visita Domiciliar ────────────────────────────────────

export function gerarFichaVisitaDomiciliar(visita: ESUSVisitaDomiciliar): object {
  return {
    uuidFicha: visita.uuid || crypto.randomUUID(),
    tpCdsOrigem: 3,
    headerTransport: {
      profissionalCNS: visita.profissional.cns,
      cboCodigo_2002: visita.profissional.cbo,
      cnes: visita.estabelecimento.cnes,
      ine: visita.estabelecimento.ine,
      dataAtendimento: formatarDataESUS(visita.dataVisita),
    },
    visitaDomiciliar: {
      turno: { M: 1, T: 2, N: 3 }[visita.turno],
      motivoVisita: visita.motivoVisita.map(m => mapMotivoVisita(m)),
      desfecho: {
        VISITA_REALIZADA: 1,
        VISITA_RECUSADA: 2,
        AUSENTE: 3,
      }[visita.desfecho],
      ...mapAcompanhamento(visita.acompanhamento),
    },
    identificacaoCidadao: {
      cnsCidadao: visita.cidadao.cns,
      cpfCidadao: visita.cidadao.cpf,
      nomeCidadao: visita.cidadao.nome,
      dataNascimentoCidadao: formatarDataESUS(visita.cidadao.dataNascimento),
      sexoCidadao: visita.cidadao.sexo === 'M' ? 1 : 2,
    },
  };
}

function mapMotivoVisita(motivo: ESUSMotivoVisita): number {
  const map: Record<ESUSMotivoVisita, number> = {
    CADASTRAMENTO: 1,
    VISITA_PERIODICA: 2,
    CONSULTA: 3,
    EXAME: 4,
    VACINA: 5,
    CONDICIONALIDADES_BOLSA_FAMILIA: 6,
    ACOMPANHAMENTO: 7,
    EGRESSO_INTERNACAO: 8,
    CONVITE_ATIVIDADES_COLETIVAS: 9,
    ORIENTACAO_PREVENCAO: 10,
    OUTROS: 99,
  };
  return map[motivo];
}

function mapAcompanhamento(acomp?: ESUSVisitaDomiciliar['acompanhamento']): object {
  if (!acomp) return {};
  return {
    stGestante: acomp.gestante,
    stPuerpera: acomp.puerpera,
    stRecemNascido: acomp.recem_nascido,
    stCrianca: acomp.crianca,
    stDesnutricao: acomp.desnutricao,
    stReabilitacao: acomp.reabilitacao,
    stHipertensao: acomp.hipertensao,
    stDiabetes: acomp.diabetes,
    stAsma: acomp.asma,
    stDpoc: acomp.dpoc,
    stCancer: acomp.cancer,
    stDomiciliado: acomp.domiciliado,
    stSaudeMental: acomp.saude_mental,
    stTabagista: acomp.tabagista,
    stAlcoolista: acomp.alcoolista,
    stDrogas: acomp.drogas,
    stCondicoesVulnerabilidade: acomp.condicoes_vulnerabilidade,
    stBolsaFamilia: acomp.bolsa_familia,
  };
}

function formatarDataESUS(data: string): number {
  const d = new Date(data);
  return parseInt(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`, 10);
}

// ─── Validação de Ficha ───────────────────────────────────────────────────────

export interface ValidacaoFicha {
  valida: boolean;
  erros: string[];
  avisos: string[];
}

export function validarFichaAtendimento(atendimento: ESUSAtendimentoIndividual): ValidacaoFicha {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!atendimento.cidadao.cns && !atendimento.cidadao.cpf) {
    erros.push('Cidadão deve ter CNS ou CPF');
  }
  if (!atendimento.cidadao.nome) {
    erros.push('Nome do cidadão é obrigatório');
  }
  if (!atendimento.cidadao.dataNascimento) {
    erros.push('Data de nascimento é obrigatória');
  }
  if (!atendimento.profissional.cns) {
    erros.push('CNS do profissional é obrigatório');
  }
  if (!atendimento.profissional.cbo) {
    erros.push('CBO do profissional é obrigatório');
  }
  if (!atendimento.estabelecimento.cnes) {
    erros.push('CNES do estabelecimento é obrigatório');
  }
  if (!atendimento.dataAtendimento) {
    erros.push('Data do atendimento é obrigatória');
  }
  if (atendimento.problemasAvaliados.length === 0) {
    avisos.push('Nenhum problema/condição avaliado informado');
  }
  if (atendimento.condutas.length === 0) {
    avisos.push('Nenhuma conduta informada');
  }

  return { valida: erros.length === 0, erros, avisos };
}

// ─── Exportação para Thrift (formato e-SUS) ───────────────────────────────────

export function exportarLoteThrift(fichas: object[]): string {
  const lote = {
    uuidLote: crypto.randomUUID(),
    lotacaoFormList: fichas,
    qtdRegistros: fichas.length,
  };
  return JSON.stringify(lote, null, 2);
}

// ─── Ficha de Cadastro Individual ─────────────────────────────────────────────

export interface ESUSCadastroIndividual {
  uuid?: string;
  cidadao: ESUSCidadao & {
    nomePai?: string;
    cns?: string;
    cpf?: string;
    nis?: string;
    responsavelFamiliar?: boolean;
    relacaoParentesco?: 'CONJUGE' | 'FILHO' | 'ENTEADO' | 'NETO' | 'PAI' | 'SOGRO' | 'IRMAO' | 'OUTRO';
  };
  profissional: ESUSProfissional;
  estabelecimento: ESUSEstabelecimento;
  microarea?: string;
  dataRegistro: string;
  situacaoRua?: boolean;
  condicoesSaude?: {
    gestante?: boolean;
    fumante?: boolean;
    alcool?: boolean;
    drogas?: boolean;
    hipertensao?: boolean;
    diabetes?: boolean;
    avc?: boolean;
    infarto?: boolean;
    doencaCardiaca?: boolean;
    doencaRenal?: boolean;
    hanseniase?: boolean;
    tuberculose?: boolean;
    cancer?: boolean;
    internacao12meses?: boolean;
    saudeMental?: boolean;
    acamado?: boolean;
    domiciliado?: boolean;
    usaPlantasMedicinais?: boolean;
  };
}

export function gerarFichaCadastroIndividual(cadastro: ESUSCadastroIndividual): object {
  return {
    uuidFicha: cadastro.uuid || crypto.randomUUID(),
    tpCdsOrigem: 3,
    headerTransport: {
      profissionalCNS: cadastro.profissional.cns,
      cboCodigo_2002: cadastro.profissional.cbo,
      cnes: cadastro.estabelecimento.cnes,
      ine: cadastro.estabelecimento.ine,
      dataAtendimento: formatarDataESUS(cadastro.dataRegistro),
      codigoIbgeMunicipio: '',
    },
    identificacaoUsuarioCidadao: {
      nomeCidadao: cadastro.cidadao.nome,
      nomeSocialCidadao: cadastro.cidadao.nomeSocial,
      dataNascimentoCidadao: formatarDataESUS(cadastro.cidadao.dataNascimento),
      sexoCidadao: cadastro.cidadao.sexo === 'M' ? 1 : 2,
      racaCorCidadao: mapRacaCor(cadastro.cidadao.racaCor),
      nomeMaeCidadao: cadastro.cidadao.nomeMae,
      cnsCidadao: cadastro.cidadao.cns,
      cpfCidadao: cadastro.cidadao.cpf,
      microarea: cadastro.microarea,
      stForaArea: !cadastro.microarea,
    },
    condicoesDeSaude: cadastro.condicoesSaude ? {
      stGestante: cadastro.condicoesSaude.gestante,
      stFumante: cadastro.condicoesSaude.fumante,
      stAlcool: cadastro.condicoesSaude.alcool,
      stOutrasDrogas: cadastro.condicoesSaude.drogas,
      stHipertensaoArterial: cadastro.condicoesSaude.hipertensao,
      stDiabetes: cadastro.condicoesSaude.diabetes,
      stAvcDerrame: cadastro.condicoesSaude.avc,
      stInfarto: cadastro.condicoesSaude.infarto,
      stDoencaCardiaca: cadastro.condicoesSaude.doencaCardiaca,
      stDoencaRenal: cadastro.condicoesSaude.doencaRenal,
      stHanseniase: cadastro.condicoesSaude.hanseniase,
      stTuberculose: cadastro.condicoesSaude.tuberculose,
      stCancer: cadastro.condicoesSaude.cancer,
      stInternadoEm12Meses: cadastro.condicoesSaude.internacao12meses,
      stProblemaSaudeMental: cadastro.condicoesSaude.saudeMental,
      stAcamado: cadastro.condicoesSaude.acamado,
      stDomiciliado: cadastro.condicoesSaude.domiciliado,
      stUsaPlantasMedicinais: cadastro.condicoesSaude.usaPlantasMedicinais,
    } : undefined,
    saidaCidadaoCadastro: null,
  };
}

function mapRacaCor(raca: ESUSCidadao['racaCor']): number {
  const map = { BRANCA: 1, PRETA: 2, AMARELA: 3, PARDA: 4, INDIGENA: 5, SEM_INFO: 99 };
  return map[raca] || 99;
}

// ─── Ficha de Procedimentos ───────────────────────────────────────────────────

export interface ESUSProcedimento {
  uuid?: string;
  cidadao: ESUSCidadao;
  profissional: ESUSProfissional;
  estabelecimento: ESUSEstabelecimento;
  dataProcedimento: string;
  turno: 'M' | 'T' | 'N';
  localAtendimento: 'UBS' | 'DOMICILIO' | 'ESCOLA' | 'OUTROS';
  procedimentos: Array<{
    codigoSigtap: string;
    quantidade: number;
  }>;
}

export const PROCEDIMENTOS_SIGTAP_COMUNS = {
  AFERIR_PA: '0301100039',
  GLICEMIA_CAPILAR: '0202010503',
  CURATIVO_SIMPLES: '0401010015',
  CURATIVO_ESPECIAL: '0401010023',
  ADMINISTRAR_MEDICAMENTO_IM: '0301100012',
  ADMINISTRAR_MEDICAMENTO_EV: '0301100020',
  NEBULIZACAO: '0301100047',
  RETIRADA_PONTOS: '0401010066',
  COLETA_MATERIAL_LABORATORIO: '0201020033',
  TESTE_RAPIDO_HIV: '0214010074',
  TESTE_RAPIDO_SIFILIS: '0214010082',
  TESTE_RAPIDO_HEPATITE_B: '0214010090',
  TESTE_RAPIDO_HEPATITE_C: '0214010104',
  TESTE_RAPIDO_GRAVIDEZ: '0214010112',
  ELETROCARDIOGRAMA: '0211020036',
} as const;

export function gerarFichaProcedimentos(proc: ESUSProcedimento): object {
  return {
    uuidFicha: proc.uuid || crypto.randomUUID(),
    tpCdsOrigem: 3,
    headerTransport: {
      profissionalCNS: proc.profissional.cns,
      cboCodigo_2002: proc.profissional.cbo,
      cnes: proc.estabelecimento.cnes,
      ine: proc.estabelecimento.ine,
      dataAtendimento: formatarDataESUS(proc.dataProcedimento),
    },
    atendimentoProcedimentos: {
      turno: { M: 1, T: 2, N: 3 }[proc.turno],
      localAtendimento: { UBS: 1, DOMICILIO: 4, ESCOLA: 5, OUTROS: 99 }[proc.localAtendimento],
      procedimentos: proc.procedimentos.map(p => ({
        coProced: p.codigoSigtap,
        qtd: p.quantidade,
      })),
    },
    identificacaoCidadao: {
      cnsCidadao: proc.cidadao.cns,
      cpfCidadao: proc.cidadao.cpf,
      nomeCidadao: proc.cidadao.nome,
      dataNascimentoCidadao: formatarDataESUS(proc.cidadao.dataNascimento),
      sexoCidadao: proc.cidadao.sexo === 'M' ? 1 : 2,
    },
  };
}

// ─── Ficha de Atividade Coletiva ──────────────────────────────────────────────

export interface ESUSAtividadeColetiva {
  uuid?: string;
  profissional: ESUSProfissional;
  estabelecimento: ESUSEstabelecimento;
  dataAtividade: string;
  turno: 'M' | 'T' | 'N';
  tipoAtividade: 'REUNIAO_EQUIPE' | 'REUNIAO_OUTROS' | 'EDUCACAO_SAUDE' | 'ATENDIMENTO_GRUPO' | 'AVALIACAO_GRUPO' | 'MOBILIZACAO_SOCIAL';
  temasAbordados: string[];
  publicoAlvo: string[];
  numeroParticipantes: number;
  numeroAvaliacoes?: number;
  localAtividade: string;
  inep?: string;
}

export function gerarFichaAtividadeColetiva(atividade: ESUSAtividadeColetiva): object {
  return {
    uuidFicha: atividade.uuid || crypto.randomUUID(),
    tpCdsOrigem: 3,
    headerTransport: {
      profissionalCNS: atividade.profissional.cns,
      cboCodigo_2002: atividade.profissional.cbo,
      cnes: atividade.estabelecimento.cnes,
      ine: atividade.estabelecimento.ine,
      dataAtendimento: formatarDataESUS(atividade.dataAtividade),
    },
    atividadeColetiva: {
      turno: { M: 1, T: 2, N: 3 }[atividade.turno],
      tipoAtividade: mapTipoAtividade(atividade.tipoAtividade),
      temasParaReuniao: atividade.temasAbordados,
      publicoAlvo: atividade.publicoAlvo,
      numParticipantes: atividade.numeroParticipantes,
      numAvaliacoesAlteradas: atividade.numeroAvaliacoes,
      localAtividade: atividade.localAtividade,
      inep: atividade.inep,
    },
  };
}

function mapTipoAtividade(tipo: ESUSAtividadeColetiva['tipoAtividade']): number {
  const map = {
    REUNIAO_EQUIPE: 1,
    REUNIAO_OUTROS: 2,
    EDUCACAO_SAUDE: 3,
    ATENDIMENTO_GRUPO: 4,
    AVALIACAO_GRUPO: 5,
    MOBILIZACAO_SOCIAL: 6,
  };
  return map[tipo];
}

// ─── Validação de CNS ─────────────────────────────────────────────────────────

export function validarCNS(cns: string): boolean {
  const cleanCns = cns.replace(/\D/g, '');
  if (cleanCns.length !== 15) return false;
  
  const firstDigit = parseInt(cleanCns[0], 10);
  
  if ([1, 2].includes(firstDigit)) {
    return validarCNSDefinitivo(cleanCns);
  } else if ([7, 8, 9].includes(firstDigit)) {
    return validarCNSProvisorio(cleanCns);
  }
  
  return false;
}

function validarCNSDefinitivo(cns: string): boolean {
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

function validarCNSProvisorio(cns: string): boolean {
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    soma += parseInt(cns[i], 10) * (15 - i);
  }
  return soma % 11 === 0;
}

// ─── Validação de CNES ────────────────────────────────────────────────────────

export function validarCNES(cnes: string): boolean {
  const cleanCnes = cnes.replace(/\D/g, '');
  return cleanCnes.length === 7;
}

// ─── Validação de INE ─────────────────────────────────────────────────────────

export function validarINE(ine: string): boolean {
  const cleanIne = ine.replace(/\D/g, '');
  return cleanIne.length === 10;
}

// ─── Relatório de Produção (PMA) ──────────────────────────────────────────────

export interface RelatorioProducao {
  competencia: string;
  estabelecimento: ESUSEstabelecimento;
  atendimentosIndividuais: number;
  visitasDomiciliares: number;
  procedimentos: number;
  atividadesColetivas: number;
  vacinacoes: number;
  porProfissional: Array<{
    profissional: ESUSProfissional;
    atendimentos: number;
    visitas: number;
    procedimentos: number;
  }>;
  porTipoAtendimento: Record<string, number>;
  porCIAP2: Array<{ codigo: string; descricao: string; quantidade: number }>;
}

export function gerarRelatorioProducao(
  fichas: object[],
  competencia: string,
  estabelecimento: ESUSEstabelecimento
): RelatorioProducao {
  const relatorio: RelatorioProducao = {
    competencia,
    estabelecimento,
    atendimentosIndividuais: 0,
    visitasDomiciliares: 0,
    procedimentos: 0,
    atividadesColetivas: 0,
    vacinacoes: 0,
    porProfissional: [],
    porTipoAtendimento: {},
    porCIAP2: [],
  };

  for (const ficha of fichas) {
    const f = ficha as any;
    if (f.atendimentoIndividual) relatorio.atendimentosIndividuais++;
    if (f.visitaDomiciliar) relatorio.visitasDomiciliares++;
    if (f.atendimentoProcedimentos) relatorio.procedimentos++;
    if (f.atividadeColetiva) relatorio.atividadesColetivas++;
    if (f.vacinacao) relatorio.vacinacoes++;
  }

  return relatorio;
}
