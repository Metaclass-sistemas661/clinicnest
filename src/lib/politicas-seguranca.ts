/**
 * Políticas de Segurança — ClinicNest
 * Documentação para certificação SBIS e ISO 27001
 */

import { APP_VERSION } from "@/lib/version";

// ═══════════════════════════════════════════════════════════════════════════════
// POLÍTICA DE BACKUP
// ═══════════════════════════════════════════════════════════════════════════════

export const POLITICA_BACKUP = {
  titulo: "Política de Backup e Recuperação de Dados",
  versao: APP_VERSION,
  dataVigencia: "2026-02-23",
  proximaRevisao: "2027-02-23",
  responsavel: "Equipe de Infraestrutura",
  
  objetivo: `Esta política estabelece as diretrizes para backup, armazenamento e recuperação de dados do sistema ClinicNest, garantindo a disponibilidade, integridade e confidencialidade das informações de saúde.`,
  
  escopo: `Aplica-se a todos os dados armazenados no sistema ClinicNest, incluindo:
• Dados de pacientes e prontuários eletrônicos
• Dados financeiros e administrativos
• Configurações do sistema
• Logs de auditoria
• Arquivos e documentos anexados`,
  
  frequencia: {
    completo: {
      periodicidade: "Diário",
      horario: "02:00 UTC",
      retencao: "365 dias",
      descricao: "Backup completo de todo o banco de dados",
    },
    incremental: {
      periodicidade: "A cada 6 horas",
      horarios: ["08:00", "14:00", "20:00", "02:00"],
      retencao: "30 dias",
      descricao: "Backup das alterações desde o último backup completo",
    },
    transactionLog: {
      periodicidade: "Contínuo",
      retencao: "7 dias",
      descricao: "Write-Ahead Log (WAL) para Point-in-Time Recovery",
    },
  },
  
  armazenamento: {
    primario: {
      local: "Supabase Cloud (AWS us-east-1)",
      tipo: "Object Storage (S3)",
      criptografia: "AES-256",
      redundancia: "3 cópias em zonas diferentes",
    },
    secundario: {
      local: "AWS S3 (região alternativa)",
      tipo: "Cross-region replication",
      criptografia: "AES-256",
      redundancia: "Replicação automática",
    },
  },
  
  verificacao: {
    checksum: {
      algoritmo: "SHA-256",
      frequencia: "A cada backup",
      registro: "Tabela backup_logs",
    },
    testeRestauracao: {
      frequencia: "Mensal",
      ambiente: "Staging isolado",
      documentacao: "Relatório de teste obrigatório",
    },
    monitoramento: {
      alertas: ["Falha de backup", "Checksum inválido", "Espaço insuficiente"],
      notificacao: ["E-mail", "SMS para críticos"],
    },
  },
  
  recuperacao: {
    rto: "4 horas (Recovery Time Objective)",
    rpo: "6 horas (Recovery Point Objective)",
    procedimento: [
      "1. Identificar o ponto de recuperação desejado",
      "2. Validar integridade do backup (checksum)",
      "3. Provisionar ambiente de recuperação",
      "4. Restaurar backup completo mais recente",
      "5. Aplicar backups incrementais/WAL até o ponto desejado",
      "6. Validar integridade dos dados restaurados",
      "7. Redirecionar tráfego para ambiente recuperado",
      "8. Documentar incidente e ações tomadas",
    ],
    responsaveis: ["DBA", "DevOps", "Gestor de TI"],
  },
  
  retencaoLegal: {
    prontuarios: "20 anos (CFM 1.821/2007)",
    financeiro: "5 anos (legislação fiscal)",
    auditoria: "5 anos (LGPD)",
    logs: "1 ano (mínimo)",
  },
  
  exclusao: {
    procedimento: "Exclusão segura com sobrescrita",
    autorizacao: "Aprovação do DPO e Gestor",
    documentacao: "Registro em audit_logs",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// POLÍTICA DE SENHAS
// ═══════════════════════════════════════════════════════════════════════════════

export const POLITICA_SENHAS = {
  titulo: "Política de Senhas e Autenticação",
  versao: APP_VERSION,
  dataVigencia: "2026-02-23",
  proximaRevisao: "2027-02-23",
  responsavel: "Equipe de Segurança",
  
  objetivo: `Esta política estabelece os requisitos para criação, uso e gerenciamento de senhas no sistema ClinicNest, visando proteger o acesso aos dados de saúde.`,
  
  requisitosComplexidade: {
    comprimentoMinimo: 8,
    comprimentoRecomendado: 12,
    maiusculas: true,
    minusculas: true,
    numeros: true,
    especiais: true,
    caracteresEspeciais: "!@#$%^&*()_+-=[]{}|;:,.<>?",
    historicoProibido: 5, // últimas 5 senhas não podem ser reutilizadas
  },
  
  validacao: {
    regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]).{8,}$/,
    mensagemErro: "A senha deve ter no mínimo 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais.",
  },
  
  expiracao: {
    diasValidade: 90,
    avisoAntecipado: 14, // dias antes de expirar
    bloqueioAposExpiracao: false, // força troca no próximo login
    excecoes: ["Contas de serviço com MFA habilitado"],
  },
  
  bloqueio: {
    tentativasMaximas: 5,
    tempoBloqueio: 30, // minutos
    bloqueioProgressivo: true, // aumenta a cada bloqueio
    desbloqueio: ["Automático após tempo", "Manual por admin", "Reset por e-mail"],
  },
  
  mfa: {
    obrigatorio: ["Administradores", "Acesso a dados financeiros"],
    recomendado: ["Todos os usuários"],
    metodos: ["TOTP (Google Authenticator)", "SMS", "E-mail"],
    recuperacao: "Códigos de backup (10 códigos únicos)",
  },
  
  sessao: {
    duracaoMaxima: 8, // horas
    inatividade: 30, // minutos
    renovacaoAutomatica: true,
    sessaoUnica: false, // permite múltiplas sessões
    logoutRemoto: true, // admin pode encerrar sessões
  },
  
  armazenamento: {
    algoritmo: "bcrypt",
    saltRounds: 12,
    nuncaEmTextoPlano: true,
    transmissao: "Apenas HTTPS",
  },
  
  recuperacao: {
    metodo: "Link por e-mail",
    validadeLink: 1, // hora
    usoUnico: true,
    verificacaoAdicional: "Confirmação de dados cadastrais",
  },
  
  boasPraticas: [
    "Não compartilhe sua senha com ninguém",
    "Não anote senhas em locais visíveis",
    "Use um gerenciador de senhas",
    "Não use a mesma senha em outros sistemas",
    "Altere imediatamente se suspeitar de comprometimento",
    "Não use informações pessoais óbvias",
    "Evite sequências (123456, qwerty)",
  ],
  
  auditoria: {
    registros: [
      "Tentativas de login (sucesso/falha)",
      "Alterações de senha",
      "Bloqueios de conta",
      "Recuperações de senha",
      "Ativação/desativação de MFA",
    ],
    retencao: "1 ano",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export function validarSenha(senha: string): { valida: boolean; erros: string[] } {
  const erros: string[] = [];
  const { requisitosComplexidade } = POLITICA_SENHAS;

  if (senha.length < requisitosComplexidade.comprimentoMinimo) {
    erros.push(`Mínimo de ${requisitosComplexidade.comprimentoMinimo} caracteres`);
  }
  if (requisitosComplexidade.maiusculas && !/[A-Z]/.test(senha)) {
    erros.push("Deve conter letra maiúscula");
  }
  if (requisitosComplexidade.minusculas && !/[a-z]/.test(senha)) {
    erros.push("Deve conter letra minúscula");
  }
  if (requisitosComplexidade.numeros && !/\d/.test(senha)) {
    erros.push("Deve conter número");
  }
  if (requisitosComplexidade.especiais && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(senha)) {
    erros.push("Deve conter caractere especial");
  }

  return { valida: erros.length === 0, erros };
}

export function calcularForcaSenha(senha: string): { forca: number; nivel: string; cor: string } {
  let forca = 0;

  if (senha.length >= 8) forca += 20;
  if (senha.length >= 12) forca += 10;
  if (senha.length >= 16) forca += 10;
  if (/[a-z]/.test(senha)) forca += 10;
  if (/[A-Z]/.test(senha)) forca += 10;
  if (/\d/.test(senha)) forca += 10;
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(senha)) forca += 15;
  if (senha.length >= 8 && /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /\d/.test(senha) && /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(senha)) {
    forca += 15;
  }

  let nivel: string;
  let cor: string;

  if (forca < 30) {
    nivel = "Muito fraca";
    cor = "bg-red-500";
  } else if (forca < 50) {
    nivel = "Fraca";
    cor = "bg-orange-500";
  } else if (forca < 70) {
    nivel = "Média";
    cor = "bg-yellow-500";
  } else if (forca < 90) {
    nivel = "Forte";
    cor = "bg-green-500";
  } else {
    nivel = "Muito forte";
    cor = "bg-emerald-500";
  }

  return { forca: Math.min(forca, 100), nivel, cor };
}
