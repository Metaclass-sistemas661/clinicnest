/**
 * Plano de Continuidade de Negócios e Resposta a Incidentes
 * 
 * PCN (Business Continuity Plan) e PRI (Incident Response Plan)
 * seguindo ISO 22301 e ISO 27035
 */

import { APP_VERSION } from "@/lib/version";

// ═══════════════════════════════════════════════════════════════════════════════
// PLANO DE CONTINUIDADE DE NEGÓCIOS (PCN)
// ═══════════════════════════════════════════════════════════════════════════════

export const PLANO_CONTINUIDADE = {
  metadata: {
    titulo: "Plano de Continuidade de Negócios",
    codigo: "PCN-001",
    versao: APP_VERSION,
    dataAprovacao: "2026-02-23",
    proximaRevisao: "2027-02-23",
    aprovadoPor: "Diretoria Executiva",
    normaReferencia: "ISO 22301:2019",
  },

  objetivo: `Estabelecer procedimentos para garantir a continuidade das operações críticas do ClinicNest em caso de interrupção, minimizando impactos aos clientes e à organização.`,

  escopo: `Este plano cobre:
• Sistema ClinicNest (aplicação web)
• Banco de dados e backups
• Serviços de autenticação
• Integrações críticas (TISS, laboratórios)
• Comunicação com clientes`,

  // ─── Análise de Impacto nos Negócios (BIA) ──────────────────────────────────
  
  analiseImpacto: {
    processosCriticos: [
      {
        processo: "Agendamento de consultas",
        rto: "2 horas",
        rpo: "1 hora",
        impactoFinanceiro: "Alto",
        impactoReputacional: "Alto",
        dependencias: ["Banco de dados", "Autenticação", "Frontend"],
      },
      {
        processo: "Acesso a prontuários",
        rto: "1 hora",
        rpo: "0 (sem perda)",
        impactoFinanceiro: "Crítico",
        impactoReputacional: "Crítico",
        dependencias: ["Banco de dados", "Autenticação"],
      },
      {
        processo: "Faturamento TISS",
        rto: "4 horas",
        rpo: "6 horas",
        impactoFinanceiro: "Alto",
        impactoReputacional: "Médio",
        dependencias: ["Banco de dados", "Geração XML"],
      },
      {
        processo: "Prescrição eletrônica",
        rto: "2 horas",
        rpo: "1 hora",
        impactoFinanceiro: "Médio",
        impactoReputacional: "Alto",
        dependencias: ["Banco de dados", "Autenticação", "Impressão"],
      },
    ],
    
    objetivosRecuperacao: {
      rto: "4 horas (Recovery Time Objective)",
      rpo: "6 horas (Recovery Point Objective)",
      mtpd: "24 horas (Maximum Tolerable Period of Disruption)",
    },
  },

  // ─── Cenários de Desastre ───────────────────────────────────────────────────
  
  cenarios: [
    {
      id: "CEN-001",
      nome: "Falha do provedor de cloud",
      descricao: "Supabase/AWS indisponível por falha regional",
      probabilidade: "Baixa",
      impacto: "Crítico",
      estrategia: "Failover para região secundária",
      tempoRecuperacao: "2-4 horas",
    },
    {
      id: "CEN-002",
      nome: "Ataque de ransomware",
      descricao: "Criptografia maliciosa do banco de dados",
      probabilidade: "Média",
      impacto: "Crítico",
      estrategia: "Restauração de backup limpo",
      tempoRecuperacao: "4-8 horas",
    },
    {
      id: "CEN-003",
      nome: "Corrupção de dados",
      descricao: "Dados corrompidos por bug ou ataque",
      probabilidade: "Baixa",
      impacto: "Alto",
      estrategia: "Point-in-Time Recovery",
      tempoRecuperacao: "2-4 horas",
    },
    {
      id: "CEN-004",
      nome: "Indisponibilidade de DNS/CDN",
      descricao: "Cloudflare ou DNS indisponível",
      probabilidade: "Baixa",
      impacto: "Alto",
      estrategia: "DNS secundário + acesso direto",
      tempoRecuperacao: "1-2 horas",
    },
  ],

  // ─── Procedimentos de Recuperação ───────────────────────────────────────────
  
  procedimentos: {
    ativacao: {
      criterios: [
        "Sistema indisponível por mais de 30 minutos",
        "Perda de dados confirmada",
        "Incidente de segurança com impacto operacional",
        "Falha de provedor crítico",
      ],
      autoridade: ["CTO", "Gestor de TI", "CEO"],
      comunicacao: {
        interno: ["Slack #incident", "E-mail equipe", "Telefone gestores"],
        externo: ["Status page", "E-mail clientes afetados"],
      },
    },
    
    recuperacaoBancoDados: [
      "1. Avaliar extensão do dano e ponto de recuperação necessário",
      "2. Identificar backup mais recente válido (verificar checksum)",
      "3. Provisionar nova instância PostgreSQL",
      "4. Restaurar backup completo",
      "5. Aplicar WAL/incrementais até ponto desejado",
      "6. Validar integridade dos dados restaurados",
      "7. Atualizar connection strings",
      "8. Testar funcionalidades críticas",
      "9. Liberar acesso aos usuários",
      "10. Documentar incidente e ações",
    ],
    
    recuperacaoAplicacao: [
      "1. Verificar status dos serviços (Supabase, Firebase Hosting)",
      "2. Se Firebase Hosting indisponível: deploy em ambiente alternativo",
      "3. Atualizar DNS se necessário",
      "4. Limpar cache CDN",
      "5. Testar fluxos críticos",
      "6. Comunicar restauração aos usuários",
    ],
    
    comunicacaoCrise: {
      templates: {
        inicial: "Identificamos uma interrupção no serviço ClinicNest. Nossa equipe está trabalhando para resolver. Atualizações em [status page].",
        progresso: "Atualização: [descrição do progresso]. Previsão de normalização: [horário].",
        resolucao: "O serviço ClinicNest foi normalizado às [horário]. Pedimos desculpas pelo inconveniente. [link para post-mortem se aplicável].",
      },
      canais: ["Status page", "E-mail", "WhatsApp (clientes Premium)", "Redes sociais"],
    },
  },

  // ─── Equipe de Resposta ─────────────────────────────────────────────────────
  
  equipeResposta: {
    coordenador: { cargo: "CTO", backup: "Gestor de TI" },
    tecnico: { cargo: "DevOps Lead", backup: "Dev Senior" },
    comunicacao: { cargo: "Customer Success", backup: "Marketing" },
    decisor: { cargo: "CEO", backup: "COO" },
  },

  // ─── Testes e Manutenção ────────────────────────────────────────────────────
  
  testes: {
    frequencia: "Semestral",
    tipos: [
      { tipo: "Tabletop", frequencia: "Trimestral", descricao: "Simulação teórica com equipe" },
      { tipo: "Walkthrough", frequencia: "Semestral", descricao: "Revisão passo a passo dos procedimentos" },
      { tipo: "Simulação", frequencia: "Anual", descricao: "Teste real de recuperação em ambiente isolado" },
    ],
    documentacao: "Relatório de teste com lições aprendidas",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLANO DE RESPOSTA A INCIDENTES (PRI)
// ═══════════════════════════════════════════════════════════════════════════════

export const PLANO_RESPOSTA_INCIDENTES = {
  metadata: {
    titulo: "Plano de Resposta a Incidentes de Segurança",
    codigo: "PRI-001",
    versao: APP_VERSION,
    dataAprovacao: "2026-02-23",
    normaReferencia: "ISO 27035:2016",
  },

  // ─── Classificação de Incidentes ────────────────────────────────────────────
  
  classificacao: {
    severidades: [
      {
        nivel: "CRITICO",
        codigo: "P1",
        descricao: "Vazamento de dados sensíveis, ransomware, indisponibilidade total",
        tempoResposta: "15 minutos",
        tempoResolucao: "4 horas",
        escalacao: "Imediata para Diretoria",
        notificacaoANPD: "Obrigatória em 72h",
      },
      {
        nivel: "ALTO",
        codigo: "P2",
        descricao: "Tentativa de invasão, vulnerabilidade explorada, indisponibilidade parcial",
        tempoResposta: "30 minutos",
        tempoResolucao: "8 horas",
        escalacao: "CTO + Gestor de Segurança",
        notificacaoANPD: "Avaliar necessidade",
      },
      {
        nivel: "MEDIO",
        codigo: "P3",
        descricao: "Malware detectado, acesso suspeito, falha de controle",
        tempoResposta: "2 horas",
        tempoResolucao: "24 horas",
        escalacao: "Gestor de TI",
        notificacaoANPD: "Não obrigatória",
      },
      {
        nivel: "BAIXO",
        codigo: "P4",
        descricao: "Tentativa de phishing, scan de portas, alerta de segurança",
        tempoResposta: "8 horas",
        tempoResolucao: "72 horas",
        escalacao: "Analista de Segurança",
        notificacaoANPD: "Não obrigatória",
      },
    ],
    
    tipos: [
      "Vazamento de dados",
      "Acesso não autorizado",
      "Malware/Ransomware",
      "Negação de serviço (DoS/DDoS)",
      "Engenharia social",
      "Vulnerabilidade explorada",
      "Uso indevido de recursos",
      "Violação de política",
    ],
  },

  // ─── Fases de Resposta ──────────────────────────────────────────────────────
  
  fases: {
    preparacao: {
      descricao: "Atividades contínuas para estar pronto para incidentes",
      atividades: [
        "Manter equipe treinada",
        "Atualizar ferramentas de detecção",
        "Revisar procedimentos periodicamente",
        "Manter contatos de emergência atualizados",
        "Garantir acesso a backups",
      ],
    },
    
    deteccao: {
      descricao: "Identificação e análise inicial do incidente",
      fontes: [
        "Alertas de monitoramento",
        "Relato de usuários",
        "Logs de auditoria",
        "Ferramentas de segurança",
        "Notificação externa",
      ],
      atividades: [
        "Confirmar se é um incidente real",
        "Coletar informações iniciais",
        "Classificar severidade",
        "Registrar no sistema de tickets",
        "Notificar equipe de resposta",
      ],
    },
    
    contencao: {
      descricao: "Limitar o impacto e evitar propagação",
      curto_prazo: [
        "Isolar sistemas afetados",
        "Bloquear contas comprometidas",
        "Preservar evidências",
        "Ativar controles adicionais",
      ],
      longo_prazo: [
        "Aplicar patches de emergência",
        "Reforçar controles de acesso",
        "Implementar monitoramento adicional",
      ],
    },
    
    erradicacao: {
      descricao: "Remover a causa raiz do incidente",
      atividades: [
        "Identificar todos os sistemas afetados",
        "Remover malware/backdoors",
        "Corrigir vulnerabilidades exploradas",
        "Resetar credenciais comprometidas",
        "Validar integridade dos sistemas",
      ],
    },
    
    recuperacao: {
      descricao: "Restaurar operações normais",
      atividades: [
        "Restaurar sistemas a partir de backups limpos",
        "Validar funcionamento",
        "Monitorar intensivamente",
        "Liberar acesso gradualmente",
        "Comunicar normalização",
      ],
    },
    
    licoes: {
      descricao: "Aprender com o incidente",
      atividades: [
        "Realizar post-mortem",
        "Documentar timeline completo",
        "Identificar melhorias",
        "Atualizar procedimentos",
        "Treinar equipe",
        "Reportar métricas",
      ],
    },
  },

  // ─── Notificação à ANPD ─────────────────────────────────────────────────────
  
  notificacaoANPD: {
    prazo: "72 horas após conhecimento do incidente",
    criterios: [
      "Incidente envolvendo dados pessoais",
      "Risco ou dano relevante aos titulares",
      "Vazamento confirmado ou provável",
    ],
    conteudo: [
      "Descrição da natureza dos dados afetados",
      "Informações sobre os titulares envolvidos",
      "Medidas técnicas e de segurança utilizadas",
      "Riscos relacionados ao incidente",
      "Medidas adotadas para reverter ou mitigar",
      "Motivos da demora (se aplicável)",
    ],
    responsavel: "DPO (Encarregado de Dados)",
    canal: "https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento",
  },

  // ─── Comunicação com Titulares ──────────────────────────────────────────────
  
  comunicacaoTitulares: {
    criterios: [
      "Incidente pode acarretar risco ou dano relevante",
      "Determinação da ANPD",
    ],
    conteudo: [
      "Descrição da natureza dos dados afetados",
      "Medidas adotadas para mitigar os efeitos",
      "Recomendações ao titular (ex: trocar senha)",
      "Canais de contato para dúvidas",
    ],
    canais: ["E-mail", "Notificação no sistema", "Carta (se necessário)"],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Incidente {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  severidade: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
  status: 'ABERTO' | 'EM_ANALISE' | 'CONTIDO' | 'ERRADICADO' | 'RECUPERADO' | 'FECHADO';
  dataDeteccao: string;
  dataResolucao?: string;
  afetados: string[];
  responsavel: string;
  acoes: AcaoIncidente[];
  notificacaoANPD?: boolean;
  postMortem?: string;
}

export interface AcaoIncidente {
  timestamp: string;
  fase: string;
  acao: string;
  responsavel: string;
  resultado?: string;
}

export function calcularSLA(incidente: Incidente): { dentroSLA: boolean; tempoResposta: number; tempoResolucao?: number } {
  const severidades = PLANO_RESPOSTA_INCIDENTES.classificacao.severidades;
  const config = severidades.find(s => s.nivel === incidente.severidade);
  
  if (!config) return { dentroSLA: false, tempoResposta: 0 };
  
  const deteccao = new Date(incidente.dataDeteccao);
  const primeiraAcao = incidente.acoes[0];
  const tempoResposta = primeiraAcao 
    ? (new Date(primeiraAcao.timestamp).getTime() - deteccao.getTime()) / 60000 
    : Infinity;
  
  const tempoRespostaLimite = parseInt(config.tempoResposta) || 60;
  
  let tempoResolucao: number | undefined;
  let dentroSLA = tempoResposta <= tempoRespostaLimite;
  
  if (incidente.dataResolucao) {
    tempoResolucao = (new Date(incidente.dataResolucao).getTime() - deteccao.getTime()) / 3600000;
    const tempoResolucaoLimite = parseInt(config.tempoResolucao) || 24;
    dentroSLA = dentroSLA && tempoResolucao <= tempoResolucaoLimite;
  }
  
  return { dentroSLA, tempoResposta, tempoResolucao };
}
