/**
 * Inventário de Ativos e Análise de Riscos — ISO 27001/27005
 * 
 * Inventário completo de ativos de informação e análise de riscos
 * seguindo a metodologia ISO 27005 para gestão de riscos.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTÁRIO DE ATIVOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Ativo {
  id: string;
  nome: string;
  tipo: 'INFORMACAO' | 'SOFTWARE' | 'HARDWARE' | 'SERVICO' | 'PESSOA' | 'INSTALACAO';
  descricao: string;
  proprietario: string;
  custodiante: string;
  classificacao: 'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'RESTRITO';
  criticidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  localizacao: string;
  dependencias?: string[];
}

export const INVENTARIO_ATIVOS: Ativo[] = [
  // ─── Ativos de Informação ───────────────────────────────────────────────────
  {
    id: "INF-001",
    nome: "Prontuários Eletrônicos",
    tipo: "INFORMACAO",
    descricao: "Registros clínicos dos pacientes incluindo anamnese, exames, diagnósticos e tratamentos",
    proprietario: "Diretor Clínico",
    custodiante: "TI",
    classificacao: "RESTRITO",
    criticidade: "CRITICA",
    localizacao: "Supabase PostgreSQL",
    dependencias: ["SRV-001", "SRV-002"],
  },
  {
    id: "INF-002",
    nome: "Dados Cadastrais de Pacientes",
    tipo: "INFORMACAO",
    descricao: "Nome, CPF, endereço, telefone, e-mail dos pacientes",
    proprietario: "Diretor Administrativo",
    custodiante: "TI",
    classificacao: "CONFIDENCIAL",
    criticidade: "ALTA",
    localizacao: "Supabase PostgreSQL",
    dependencias: ["SRV-001"],
  },
  {
    id: "INF-003",
    nome: "Dados Financeiros",
    tipo: "INFORMACAO",
    descricao: "Transações, faturamento, contas a receber/pagar",
    proprietario: "Diretor Financeiro",
    custodiante: "TI",
    classificacao: "CONFIDENCIAL",
    criticidade: "ALTA",
    localizacao: "Supabase PostgreSQL",
    dependencias: ["SRV-001"],
  },
  {
    id: "INF-004",
    nome: "Credenciais de Acesso",
    tipo: "INFORMACAO",
    descricao: "Senhas, tokens, chaves de API",
    proprietario: "Gestor de TI",
    custodiante: "TI",
    classificacao: "RESTRITO",
    criticidade: "CRITICA",
    localizacao: "Supabase Auth + Vault",
    dependencias: ["SRV-002"],
  },
  {
    id: "INF-005",
    nome: "Logs de Auditoria",
    tipo: "INFORMACAO",
    descricao: "Registros de ações dos usuários no sistema",
    proprietario: "Gestor de Segurança",
    custodiante: "TI",
    classificacao: "CONFIDENCIAL",
    criticidade: "ALTA",
    localizacao: "Supabase PostgreSQL",
    dependencias: ["SRV-001"],
  },
  {
    id: "INF-006",
    nome: "Backups",
    tipo: "INFORMACAO",
    descricao: "Cópias de segurança do banco de dados",
    proprietario: "Gestor de TI",
    custodiante: "DevOps",
    classificacao: "RESTRITO",
    criticidade: "CRITICA",
    localizacao: "AWS S3 (criptografado)",
    dependencias: ["SRV-003"],
  },

  // ─── Ativos de Software ─────────────────────────────────────────────────────
  {
    id: "SW-001",
    nome: "ClinicaFlow Frontend",
    tipo: "SOFTWARE",
    descricao: "Aplicação web React para interface do usuário",
    proprietario: "CTO",
    custodiante: "Desenvolvimento",
    classificacao: "INTERNO",
    criticidade: "CRITICA",
    localizacao: "Vercel/Cloudflare",
    dependencias: ["SRV-001", "SRV-002"],
  },
  {
    id: "SW-002",
    nome: "Supabase Backend",
    tipo: "SOFTWARE",
    descricao: "Backend-as-a-Service com PostgreSQL, Auth e Storage",
    proprietario: "CTO",
    custodiante: "DevOps",
    classificacao: "INTERNO",
    criticidade: "CRITICA",
    localizacao: "Supabase Cloud (AWS)",
    dependencias: ["SRV-003"],
  },
  {
    id: "SW-003",
    nome: "Edge Functions",
    tipo: "SOFTWARE",
    descricao: "Funções serverless para lógica de negócio",
    proprietario: "CTO",
    custodiante: "Desenvolvimento",
    classificacao: "INTERNO",
    criticidade: "ALTA",
    localizacao: "Supabase Edge (Deno)",
    dependencias: ["SW-002"],
  },

  // ─── Ativos de Serviço ──────────────────────────────────────────────────────
  {
    id: "SRV-001",
    nome: "Banco de Dados PostgreSQL",
    tipo: "SERVICO",
    descricao: "Serviço de banco de dados relacional",
    proprietario: "CTO",
    custodiante: "Supabase",
    classificacao: "INTERNO",
    criticidade: "CRITICA",
    localizacao: "Supabase Cloud",
  },
  {
    id: "SRV-002",
    nome: "Serviço de Autenticação",
    tipo: "SERVICO",
    descricao: "Supabase Auth para gestão de identidades",
    proprietario: "Gestor de TI",
    custodiante: "Supabase",
    classificacao: "INTERNO",
    criticidade: "CRITICA",
    localizacao: "Supabase Cloud",
  },
  {
    id: "SRV-003",
    nome: "Infraestrutura Cloud (AWS)",
    tipo: "SERVICO",
    descricao: "Infraestrutura de nuvem subjacente",
    proprietario: "CTO",
    custodiante: "AWS/Supabase",
    classificacao: "INTERNO",
    criticidade: "CRITICA",
    localizacao: "AWS us-east-1",
  },
  {
    id: "SRV-004",
    nome: "CDN (Cloudflare)",
    tipo: "SERVICO",
    descricao: "Rede de distribuição de conteúdo",
    proprietario: "Gestor de TI",
    custodiante: "Cloudflare",
    classificacao: "INTERNO",
    criticidade: "ALTA",
    localizacao: "Cloudflare Global",
  },
  {
    id: "SRV-005",
    nome: "Serviço de E-mail",
    tipo: "SERVICO",
    descricao: "Envio de e-mails transacionais",
    proprietario: "Gestor de TI",
    custodiante: "Resend/SendGrid",
    classificacao: "INTERNO",
    criticidade: "MEDIA",
    localizacao: "Cloud",
  },

  // ─── Ativos de Pessoa ───────────────────────────────────────────────────────
  {
    id: "PES-001",
    nome: "Equipe de Desenvolvimento",
    tipo: "PESSOA",
    descricao: "Desenvolvedores com acesso ao código e infraestrutura",
    proprietario: "CTO",
    custodiante: "RH",
    classificacao: "INTERNO",
    criticidade: "ALTA",
    localizacao: "Remoto/Escritório",
  },
  {
    id: "PES-002",
    nome: "Equipe de Suporte",
    tipo: "PESSOA",
    descricao: "Analistas de suporte com acesso a dados de clientes",
    proprietario: "Gestor de Suporte",
    custodiante: "RH",
    classificacao: "INTERNO",
    criticidade: "MEDIA",
    localizacao: "Remoto/Escritório",
  },
  {
    id: "PES-003",
    nome: "DPO (Encarregado de Dados)",
    tipo: "PESSOA",
    descricao: "Responsável pela proteção de dados pessoais",
    proprietario: "CEO",
    custodiante: "RH",
    classificacao: "INTERNO",
    criticidade: "ALTA",
    localizacao: "Escritório",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE RISCOS — ISO 27005
// ═══════════════════════════════════════════════════════════════════════════════

export interface Ameaca {
  id: string;
  nome: string;
  tipo: 'NATURAL' | 'HUMANA_INTENCIONAL' | 'HUMANA_ACIDENTAL' | 'TECNICA';
  descricao: string;
}

export interface Vulnerabilidade {
  id: string;
  nome: string;
  descricao: string;
  ativosAfetados: string[];
}

export interface Risco {
  id: string;
  nome: string;
  descricao: string;
  ameaca: string;
  vulnerabilidade: string;
  ativosAfetados: string[];
  probabilidade: 1 | 2 | 3 | 4 | 5; // 1=Muito Baixa, 5=Muito Alta
  impacto: 1 | 2 | 3 | 4 | 5; // 1=Insignificante, 5=Catastrófico
  nivelRisco: number; // probabilidade * impacto
  classificacao: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  tratamento: 'ACEITAR' | 'MITIGAR' | 'TRANSFERIR' | 'EVITAR';
  controles: string[];
  responsavel: string;
  prazo?: string;
  status: 'IDENTIFICADO' | 'EM_TRATAMENTO' | 'TRATADO' | 'ACEITO';
}

export const AMEACAS: Ameaca[] = [
  { id: "AM-001", nome: "Ataque de ransomware", tipo: "HUMANA_INTENCIONAL", descricao: "Criptografia maliciosa de dados com pedido de resgate" },
  { id: "AM-002", nome: "Vazamento de dados", tipo: "HUMANA_INTENCIONAL", descricao: "Exfiltração não autorizada de informações sensíveis" },
  { id: "AM-003", nome: "Acesso não autorizado", tipo: "HUMANA_INTENCIONAL", descricao: "Invasão de contas ou sistemas" },
  { id: "AM-004", nome: "Engenharia social", tipo: "HUMANA_INTENCIONAL", descricao: "Phishing, pretexting, manipulação de usuários" },
  { id: "AM-005", nome: "Erro humano", tipo: "HUMANA_ACIDENTAL", descricao: "Exclusão acidental, configuração incorreta" },
  { id: "AM-006", nome: "Falha de hardware", tipo: "TECNICA", descricao: "Defeito em servidores, storage, rede" },
  { id: "AM-007", nome: "Falha de software", tipo: "TECNICA", descricao: "Bugs, vulnerabilidades, incompatibilidades" },
  { id: "AM-008", nome: "Indisponibilidade de serviço", tipo: "TECNICA", descricao: "DDoS, sobrecarga, falha de provedor" },
  { id: "AM-009", nome: "Desastre natural", tipo: "NATURAL", descricao: "Incêndio, inundação, terremoto no datacenter" },
  { id: "AM-010", nome: "Insider malicioso", tipo: "HUMANA_INTENCIONAL", descricao: "Colaborador ou ex-colaborador com más intenções" },
];

export const VULNERABILIDADES: Vulnerabilidade[] = [
  { id: "VU-001", nome: "Senhas fracas", descricao: "Usuários com senhas que não atendem política", ativosAfetados: ["INF-004", "SRV-002"] },
  { id: "VU-002", nome: "Software desatualizado", descricao: "Dependências com vulnerabilidades conhecidas", ativosAfetados: ["SW-001", "SW-002", "SW-003"] },
  { id: "VU-003", nome: "Falta de MFA", descricao: "Contas sem autenticação multifator", ativosAfetados: ["INF-004", "SRV-002"] },
  { id: "VU-004", nome: "Backup não testado", descricao: "Backups que podem não restaurar corretamente", ativosAfetados: ["INF-006"] },
  { id: "VU-005", nome: "Logs insuficientes", descricao: "Eventos críticos não registrados", ativosAfetados: ["INF-005"] },
  { id: "VU-006", nome: "Treinamento inadequado", descricao: "Usuários sem conscientização de segurança", ativosAfetados: ["PES-001", "PES-002"] },
  { id: "VU-007", nome: "Dependência de fornecedor único", descricao: "Concentração em um provedor de cloud", ativosAfetados: ["SRV-001", "SRV-002", "SRV-003"] },
];

export const RISCOS: Risco[] = [
  {
    id: "RI-001",
    nome: "Vazamento de prontuários",
    descricao: "Exposição não autorizada de dados clínicos de pacientes",
    ameaca: "AM-002",
    vulnerabilidade: "VU-001",
    ativosAfetados: ["INF-001", "INF-002"],
    probabilidade: 2,
    impacto: 5,
    nivelRisco: 10,
    classificacao: "CRITICO",
    tratamento: "MITIGAR",
    controles: ["MFA obrigatório", "Criptografia em repouso", "Logs de acesso", "DLP"],
    responsavel: "Gestor de Segurança",
    status: "EM_TRATAMENTO",
  },
  {
    id: "RI-002",
    nome: "Ransomware",
    descricao: "Criptografia maliciosa do banco de dados",
    ameaca: "AM-001",
    vulnerabilidade: "VU-002",
    ativosAfetados: ["INF-001", "INF-002", "INF-003", "SRV-001"],
    probabilidade: 2,
    impacto: 5,
    nivelRisco: 10,
    classificacao: "CRITICO",
    tratamento: "MITIGAR",
    controles: ["Backup offline", "Antivírus/EDR", "Segmentação de rede", "Treinamento anti-phishing"],
    responsavel: "Gestor de TI",
    status: "EM_TRATAMENTO",
  },
  {
    id: "RI-003",
    nome: "Indisponibilidade prolongada",
    descricao: "Sistema fora do ar por mais de 4 horas",
    ameaca: "AM-008",
    vulnerabilidade: "VU-007",
    ativosAfetados: ["SRV-001", "SRV-002", "SRV-003"],
    probabilidade: 2,
    impacto: 4,
    nivelRisco: 8,
    classificacao: "ALTO",
    tratamento: "MITIGAR",
    controles: ["SLA com provedor", "Monitoramento 24x7", "Plano de DR", "Redundância"],
    responsavel: "DevOps",
    status: "TRATADO",
  },
  {
    id: "RI-004",
    nome: "Acesso indevido por ex-colaborador",
    descricao: "Ex-funcionário mantém acesso ao sistema",
    ameaca: "AM-010",
    vulnerabilidade: "VU-003",
    ativosAfetados: ["INF-001", "INF-002", "INF-003", "INF-004"],
    probabilidade: 3,
    impacto: 4,
    nivelRisco: 12,
    classificacao: "CRITICO",
    tratamento: "MITIGAR",
    controles: ["Revogação imediata no desligamento", "Revisão trimestral de acessos", "MFA"],
    responsavel: "RH + TI",
    status: "TRATADO",
  },
  {
    id: "RI-005",
    nome: "Perda de dados por erro humano",
    descricao: "Exclusão acidental de registros críticos",
    ameaca: "AM-005",
    vulnerabilidade: "VU-004",
    ativosAfetados: ["INF-001", "INF-002", "INF-003"],
    probabilidade: 3,
    impacto: 3,
    nivelRisco: 9,
    classificacao: "ALTO",
    tratamento: "MITIGAR",
    controles: ["Soft delete", "Backup com verificação", "Confirmação de exclusão", "Versionamento"],
    responsavel: "Desenvolvimento",
    status: "TRATADO",
  },
  {
    id: "RI-006",
    nome: "Phishing contra colaboradores",
    descricao: "Roubo de credenciais via e-mail fraudulento",
    ameaca: "AM-004",
    vulnerabilidade: "VU-006",
    ativosAfetados: ["INF-004", "PES-001", "PES-002"],
    probabilidade: 4,
    impacto: 3,
    nivelRisco: 12,
    classificacao: "CRITICO",
    tratamento: "MITIGAR",
    controles: ["Treinamento anti-phishing", "Simulações periódicas", "MFA", "Filtro de e-mail"],
    responsavel: "Gestor de Segurança",
    status: "EM_TRATAMENTO",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE ANÁLISE
// ═══════════════════════════════════════════════════════════════════════════════

export function calcularNivelRisco(probabilidade: number, impacto: number): { nivel: number; classificacao: Risco['classificacao'] } {
  const nivel = probabilidade * impacto;
  let classificacao: Risco['classificacao'];
  
  if (nivel <= 4) classificacao = 'BAIXO';
  else if (nivel <= 9) classificacao = 'MEDIO';
  else if (nivel <= 15) classificacao = 'ALTO';
  else classificacao = 'CRITICO';
  
  return { nivel, classificacao };
}

export function gerarMatrizRiscos(): string[][] {
  const matriz: string[][] = [
    ['', 'Impacto 1', 'Impacto 2', 'Impacto 3', 'Impacto 4', 'Impacto 5'],
    ['Prob. 5', '5-MÉDIO', '10-ALTO', '15-ALTO', '20-CRÍTICO', '25-CRÍTICO'],
    ['Prob. 4', '4-BAIXO', '8-ALTO', '12-CRÍTICO', '16-CRÍTICO', '20-CRÍTICO'],
    ['Prob. 3', '3-BAIXO', '6-MÉDIO', '9-ALTO', '12-CRÍTICO', '15-ALTO'],
    ['Prob. 2', '2-BAIXO', '4-BAIXO', '6-MÉDIO', '8-ALTO', '10-ALTO'],
    ['Prob. 1', '1-BAIXO', '2-BAIXO', '3-BAIXO', '4-BAIXO', '5-MÉDIO'],
  ];
  return matriz;
}

export function gerarRelatorioRiscos(): string {
  const criticos = RISCOS.filter(r => r.classificacao === 'CRITICO');
  const altos = RISCOS.filter(r => r.classificacao === 'ALTO');
  const medios = RISCOS.filter(r => r.classificacao === 'MEDIO');
  const baixos = RISCOS.filter(r => r.classificacao === 'BAIXO');
  
  let relatorio = `# Relatório de Análise de Riscos\n\n`;
  relatorio += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n`;
  relatorio += `**Metodologia:** ISO 27005:2022\n\n`;
  relatorio += `## Resumo Executivo\n\n`;
  relatorio += `| Classificação | Quantidade |\n`;
  relatorio += `|---------------|------------|\n`;
  relatorio += `| Crítico | ${criticos.length} |\n`;
  relatorio += `| Alto | ${altos.length} |\n`;
  relatorio += `| Médio | ${medios.length} |\n`;
  relatorio += `| Baixo | ${baixos.length} |\n`;
  relatorio += `| **Total** | **${RISCOS.length}** |\n\n`;
  
  relatorio += `## Riscos Críticos (Ação Imediata)\n\n`;
  for (const r of criticos) {
    relatorio += `### ${r.id} - ${r.nome}\n`;
    relatorio += `- **Descrição:** ${r.descricao}\n`;
    relatorio += `- **Nível:** ${r.nivelRisco} (P:${r.probabilidade} x I:${r.impacto})\n`;
    relatorio += `- **Tratamento:** ${r.tratamento}\n`;
    relatorio += `- **Controles:** ${r.controles.join(', ')}\n`;
    relatorio += `- **Responsável:** ${r.responsavel}\n`;
    relatorio += `- **Status:** ${r.status}\n\n`;
  }
  
  return relatorio;
}
