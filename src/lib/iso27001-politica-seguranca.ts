/**
 * Política de Segurança da Informação — ISO 27001
 * 
 * Documento formal seguindo o Anexo A da ISO 27001:2022
 * Para certificação ISO 27001 e conformidade com LGPD
 */

import { APP_VERSION } from "@/lib/version";

export interface ControleISO {
  id: string;
  dominio: string;
  controle: string;
  objetivo: string;
  implementacao: string;
  responsavel: string;
  evidencia: string;
  status: 'IMPLEMENTADO' | 'PARCIAL' | 'PLANEJADO' | 'NAO_APLICAVEL';
}

export const POLITICA_SEGURANCA_INFORMACAO = {
  // ═══════════════════════════════════════════════════════════════════════════
  // METADADOS DO DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  
  metadata: {
    titulo: "Política de Segurança da Informação",
    codigo: "PSI-001",
    versao: APP_VERSION,
    dataAprovacao: "2026-02-23",
    proximaRevisao: "2027-02-23",
    classificacao: "Interno",
    aprovadoPor: "Diretoria Executiva",
    elaboradoPor: "Comitê de Segurança da Informação",
    normaReferencia: "ISO/IEC 27001:2022",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. INTRODUÇÃO E ESCOPO
  // ═══════════════════════════════════════════════════════════════════════════
  
  introducao: {
    objetivo: `Esta Política de Segurança da Informação (PSI) estabelece as diretrizes, responsabilidades e práticas para proteção dos ativos de informação do ClinicNest, garantindo a confidencialidade, integridade e disponibilidade das informações de saúde processadas pelo sistema.`,
    
    escopo: `Esta política aplica-se a:
• Todos os colaboradores, terceiros e prestadores de serviço
• Todos os sistemas, aplicações e infraestrutura de TI
• Todas as informações processadas, armazenadas ou transmitidas
• Todos os ambientes (produção, homologação, desenvolvimento)
• Dados de pacientes, profissionais de saúde e administrativos`,
    
    definicoes: {
      ativo: "Qualquer coisa que tenha valor para a organização",
      confidencialidade: "Propriedade de que a informação não esteja disponível para pessoas não autorizadas",
      integridade: "Propriedade de salvaguarda da exatidão e completeza de ativos",
      disponibilidade: "Propriedade de estar acessível e utilizável sob demanda",
      risco: "Efeito da incerteza nos objetivos",
      incidente: "Evento ou série de eventos de segurança da informação indesejados ou inesperados",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PRINCÍPIOS DE SEGURANÇA
  // ═══════════════════════════════════════════════════════════════════════════
  
  principios: [
    {
      nome: "Necessidade de Conhecer",
      descricao: "Acesso à informação apenas quando necessário para execução das atividades",
    },
    {
      nome: "Privilégio Mínimo",
      descricao: "Usuários recebem apenas as permissões mínimas necessárias",
    },
    {
      nome: "Defesa em Profundidade",
      descricao: "Múltiplas camadas de controles de segurança",
    },
    {
      nome: "Segregação de Funções",
      descricao: "Separação de responsabilidades para evitar conflitos de interesse",
    },
    {
      nome: "Responsabilização",
      descricao: "Todas as ações são rastreáveis a um indivíduo",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ESTRUTURA ORGANIZACIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  estruturaOrganizacional: {
    comiteSeguranca: {
      composicao: ["CEO", "CTO", "DPO", "Gestor de TI", "Representante Jurídico"],
      reunioes: "Mensal",
      responsabilidades: [
        "Aprovar políticas e procedimentos de segurança",
        "Analisar relatórios de incidentes",
        "Definir prioridades de investimento em segurança",
        "Avaliar riscos e aprovar tratamentos",
      ],
    },
    papeis: {
      gestor_seguranca: {
        titulo: "Gestor de Segurança da Informação",
        responsabilidades: [
          "Implementar e manter o SGSI",
          "Coordenar análises de risco",
          "Gerenciar incidentes de segurança",
          "Promover conscientização",
        ],
      },
      dpo: {
        titulo: "Encarregado de Proteção de Dados (DPO)",
        responsabilidades: [
          "Garantir conformidade com LGPD",
          "Atender solicitações de titulares",
          "Interface com ANPD",
          "Elaborar RIPD",
        ],
      },
      proprietarios_ativos: {
        titulo: "Proprietários de Ativos",
        responsabilidades: [
          "Classificar informações sob sua responsabilidade",
          "Definir controles de acesso",
          "Aprovar acessos a seus ativos",
        ],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLASSIFICAÇÃO DA INFORMAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  
  classificacaoInformacao: {
    niveis: [
      {
        nivel: "PÚBLICO",
        descricao: "Informações que podem ser divulgadas sem restrições",
        exemplos: ["Site institucional", "Material de marketing"],
        controles: ["Nenhum controle especial"],
      },
      {
        nivel: "INTERNO",
        descricao: "Informações de uso interno da organização",
        exemplos: ["Procedimentos operacionais", "Comunicados internos"],
        controles: ["Acesso restrito a colaboradores", "Não divulgar externamente"],
      },
      {
        nivel: "CONFIDENCIAL",
        descricao: "Informações sensíveis que requerem proteção",
        exemplos: ["Dados financeiros", "Contratos", "Dados de RH"],
        controles: ["Acesso por necessidade", "Criptografia em trânsito", "Logs de acesso"],
      },
      {
        nivel: "RESTRITO",
        descricao: "Informações altamente sensíveis com acesso muito limitado",
        exemplos: ["Dados de saúde (prontuários)", "Credenciais", "Chaves criptográficas"],
        controles: ["Acesso mínimo necessário", "Criptografia em repouso", "MFA obrigatório", "Auditoria completa"],
      },
    ],
    dadosSaude: {
      classificacao: "RESTRITO",
      fundamentoLegal: "LGPD Art. 11 - Dados sensíveis",
      controlesAdicionais: [
        "Consentimento explícito do titular",
        "Acesso apenas por profissionais de saúde autorizados",
        "Registro de todos os acessos",
        "Retenção conforme CFM (20 anos)",
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DIRETRIZES POR DOMÍNIO (ANEXO A - ISO 27001:2022)
  // ═══════════════════════════════════════════════════════════════════════════
  
  diretrizes: {
    // A.5 - Políticas de Segurança da Informação
    politicas: {
      revisao: "Anual ou após mudanças significativas",
      comunicacao: "Todos os colaboradores devem conhecer e aceitar",
      excecoes: "Devem ser documentadas e aprovadas pelo Comitê",
    },
    
    // A.6 - Organização da Segurança da Informação
    organizacao: {
      segregacaoFuncoes: "Desenvolvimento separado de produção",
      contatoAutoridades: "DPO é ponto focal para ANPD",
      projetosSeguranca: "Segurança considerada desde o início (Security by Design)",
    },
    
    // A.7 - Segurança em Recursos Humanos
    recursosHumanos: {
      admissao: ["Verificação de antecedentes", "Termo de confidencialidade"],
      durante: ["Treinamento anual em segurança", "Conscientização contínua"],
      desligamento: ["Revogação imediata de acessos", "Devolução de ativos", "Entrevista de desligamento"],
    },
    
    // A.8 - Gestão de Ativos
    gestaoAtivos: {
      inventario: "Mantido atualizado em sistema dedicado",
      propriedade: "Todo ativo deve ter proprietário definido",
      usoAceitavel: "Definido em política específica",
      devolucao: "Obrigatória no desligamento",
    },
    
    // A.9 - Controle de Acesso
    controleAcesso: {
      politica: "Baseada em perfis (RBAC)",
      provisionamento: "Aprovação do gestor + proprietário do ativo",
      revisao: "Trimestral para acessos privilegiados",
      revogacao: "Imediata no desligamento, 24h para mudança de função",
      senhas: "Conforme Política de Senhas (PSI-002)",
    },
    
    // A.10 - Criptografia
    criptografia: {
      emTransito: "TLS 1.3 obrigatório",
      emRepouso: "AES-256 para dados sensíveis",
      chaves: "Gerenciadas por HSM ou serviço gerenciado",
      certificados: "ICP-Brasil para assinatura digital",
    },
    
    // A.11 - Segurança Física
    segurancaFisica: {
      datacenter: "Supabase Cloud (AWS) - SOC 2 Type II",
      escritorio: "Controle de acesso físico, CFTV",
      equipamentos: "Bloqueio automático, criptografia de disco",
    },
    
    // A.12 - Segurança nas Operações
    operacoes: {
      mudancas: "Processo formal de gestão de mudanças",
      capacidade: "Monitoramento e alertas automáticos",
      separacaoAmbientes: "Produção, Homologação, Desenvolvimento isolados",
      backup: "Conforme Política de Backup (PSI-003)",
      logs: "Centralizados, retidos por 1 ano mínimo",
      vulnerabilidades: "Scan mensal, correção em até 30 dias (críticas: 7 dias)",
    },
    
    // A.13 - Segurança nas Comunicações
    comunicacoes: {
      redes: "Segmentação por função",
      transferencia: "Apenas canais criptografados",
      acordos: "NDAs com todos os terceiros",
    },
    
    // A.14 - Aquisição, Desenvolvimento e Manutenção
    desenvolvimento: {
      requisitos: "Segurança como requisito não-funcional",
      cicloVida: "SSDLC (Secure Software Development Lifecycle)",
      testes: "Testes de segurança antes de produção",
      dadosTeste: "Dados anonimizados/sintéticos",
    },
    
    // A.15 - Relacionamento com Fornecedores
    fornecedores: {
      avaliacao: "Due diligence de segurança",
      contratos: "Cláusulas de segurança e privacidade",
      monitoramento: "Revisão anual de conformidade",
    },
    
    // A.16 - Gestão de Incidentes
    incidentes: {
      deteccao: "Monitoramento 24x7",
      resposta: "Conforme Plano de Resposta a Incidentes",
      comunicacao: "ANPD em até 72h para incidentes com dados pessoais",
      aprendizado: "Post-mortem obrigatório",
    },
    
    // A.17 - Continuidade de Negócios
    continuidade: {
      plano: "Conforme Plano de Continuidade de Negócios",
      testes: "Simulação anual",
      rto: "4 horas",
      rpo: "6 horas",
    },
    
    // A.18 - Conformidade
    conformidade: {
      requisitosLegais: ["LGPD", "CFM", "ANVISA", "ANS"],
      propriedadeIntelectual: "Uso apenas de software licenciado",
      protecaoRegistros: "Conforme requisitos legais de retenção",
      auditorias: "Interna anual, externa conforme certificações",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SANÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  
  sancoes: {
    descricao: "O descumprimento desta política está sujeito a medidas disciplinares",
    graduacao: [
      "Advertência verbal",
      "Advertência escrita",
      "Suspensão",
      "Demissão por justa causa",
      "Ações legais cabíveis",
    ],
    fatoresAgravantes: [
      "Reincidência",
      "Dolo ou má-fé",
      "Prejuízo financeiro ou reputacional",
      "Vazamento de dados sensíveis",
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. DOCUMENTOS RELACIONADOS
  // ═══════════════════════════════════════════════════════════════════════════
  
  documentosRelacionados: [
    { codigo: "PSI-002", titulo: "Política de Senhas e Autenticação" },
    { codigo: "PSI-003", titulo: "Política de Backup e Recuperação" },
    { codigo: "PSI-004", titulo: "Plano de Continuidade de Negócios" },
    { codigo: "PSI-005", titulo: "Plano de Resposta a Incidentes" },
    { codigo: "PSI-006", titulo: "Política de Privacidade (LGPD)" },
    { codigo: "PSI-007", titulo: "Inventário de Ativos" },
    { codigo: "PSI-008", titulo: "Análise de Riscos" },
    { codigo: "RIPD-001", titulo: "Relatório de Impacto à Proteção de Dados" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLES ISO 27001:2022 - ANEXO A
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTROLES_ISO_27001: ControleISO[] = [
  // A.5 - Controles Organizacionais
  { id: "A.5.1", dominio: "Organizacional", controle: "Políticas de segurança da informação", objetivo: "Prover direção e suporte", implementacao: "PSI-001 aprovada pela diretoria", responsavel: "Comitê de Segurança", evidencia: "Documento aprovado", status: "IMPLEMENTADO" },
  { id: "A.5.2", dominio: "Organizacional", controle: "Papéis e responsabilidades", objetivo: "Definir responsabilidades", implementacao: "Estrutura organizacional definida", responsavel: "RH + TI", evidencia: "Organograma + descrições de cargo", status: "IMPLEMENTADO" },
  { id: "A.5.3", dominio: "Organizacional", controle: "Segregação de funções", objetivo: "Reduzir risco de fraude", implementacao: "RBAC com perfis segregados", responsavel: "TI", evidencia: "Matriz de perfis", status: "IMPLEMENTADO" },
  
  // A.6 - Controles de Pessoas
  { id: "A.6.1", dominio: "Pessoas", controle: "Seleção", objetivo: "Verificar candidatos", implementacao: "Processo de admissão com verificação", responsavel: "RH", evidencia: "Checklist de admissão", status: "IMPLEMENTADO" },
  { id: "A.6.2", dominio: "Pessoas", controle: "Termos e condições", objetivo: "Formalizar responsabilidades", implementacao: "Termo de confidencialidade", responsavel: "RH + Jurídico", evidencia: "Termos assinados", status: "IMPLEMENTADO" },
  { id: "A.6.3", dominio: "Pessoas", controle: "Conscientização", objetivo: "Educar colaboradores", implementacao: "Treinamento anual obrigatório", responsavel: "TI + RH", evidencia: "Registros de treinamento", status: "IMPLEMENTADO" },
  
  // A.7 - Controles Físicos
  { id: "A.7.1", dominio: "Físico", controle: "Perímetros de segurança", objetivo: "Proteger instalações", implementacao: "Datacenter AWS com certificação", responsavel: "Supabase/AWS", evidencia: "SOC 2 Type II", status: "IMPLEMENTADO" },
  { id: "A.7.2", dominio: "Físico", controle: "Controle de entrada", objetivo: "Restringir acesso físico", implementacao: "Controle de acesso ao escritório", responsavel: "Facilities", evidencia: "Logs de acesso", status: "IMPLEMENTADO" },
  
  // A.8 - Controles Tecnológicos
  { id: "A.8.1", dominio: "Tecnológico", controle: "Dispositivos endpoint", objetivo: "Proteger dispositivos", implementacao: "Criptografia de disco, antivírus", responsavel: "TI", evidencia: "Políticas de MDM", status: "IMPLEMENTADO" },
  { id: "A.8.2", dominio: "Tecnológico", controle: "Gestão de identidades", objetivo: "Controlar acessos", implementacao: "Supabase Auth + RBAC", responsavel: "TI", evidencia: "Configuração do sistema", status: "IMPLEMENTADO" },
  { id: "A.8.3", dominio: "Tecnológico", controle: "Autenticação", objetivo: "Verificar identidade", implementacao: "JWT + MFA disponível", responsavel: "TI", evidencia: "Configuração de auth", status: "IMPLEMENTADO" },
  { id: "A.8.4", dominio: "Tecnológico", controle: "Gestão de vulnerabilidades", objetivo: "Identificar e corrigir", implementacao: "Dependabot + scans periódicos", responsavel: "DevOps", evidencia: "Relatórios de scan", status: "IMPLEMENTADO" },
  { id: "A.8.5", dominio: "Tecnológico", controle: "Criptografia", objetivo: "Proteger dados", implementacao: "TLS 1.3 + AES-256", responsavel: "TI", evidencia: "Configuração SSL", status: "IMPLEMENTADO" },
  { id: "A.8.6", dominio: "Tecnológico", controle: "Backup", objetivo: "Garantir recuperação", implementacao: "Backup diário + verificação", responsavel: "DevOps", evidencia: "backup_logs", status: "IMPLEMENTADO" },
  { id: "A.8.7", dominio: "Tecnológico", controle: "Logs e monitoramento", objetivo: "Detectar incidentes", implementacao: "audit_logs + alertas", responsavel: "DevOps", evidencia: "Dashboard de logs", status: "IMPLEMENTADO" },
];
