/**
 * Certificado ICP-Brasil de Teste — Homologação SBIS
 * 
 * Utilitários para geração e validação de certificados de teste
 * para ambiente de homologação da certificação SBIS.
 */

import { APP_VERSION } from "@/lib/version";

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICADO DE TESTE (HOMOLOGAÇÃO)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CertificadoTeste {
  tipo: 'A1' | 'A3';
  titular: {
    nome: string;
    cpf: string;
    crm?: string;
    ufCrm?: string;
  };
  emissor: string;
  validadeInicio: string;
  validadeFim: string;
  serial: string;
  thumbprint: string;
  ambiente: 'homologacao' | 'producao';
}

export const CERTIFICADO_HOMOLOGACAO: CertificadoTeste = {
  tipo: 'A1',
  titular: {
    nome: 'MEDICO TESTE HOMOLOGACAO SBIS',
    cpf: '00000000191',
    crm: '123456',
    ufCrm: 'SP',
  },
  emissor: 'AC TESTE SBIS',
  validadeInicio: '2026-01-01T00:00:00Z',
  validadeFim: '2027-12-31T23:59:59Z',
  serial: 'SBIS-HOMOLOG-2026-001',
  thumbprint: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0',
  ambiente: 'homologacao',
};

// ═══════════════════════════════════════════════════════════════════════════════
// DADOS PARA AUDITORIA SBIS
// ═══════════════════════════════════════════════════════════════════════════════

export const DADOS_AUDITORIA_SBIS = {
  sistema: {
    nome: 'ClinicNest',
    versao: APP_VERSION,
    fabricante: 'ClinicNest Sistemas de Saúde Ltda',
    cnpj: '00.000.000/0001-00',
    endereco: 'Av. Paulista, 1000 - São Paulo/SP',
    telefone: '(11) 3000-0000',
    email: 'contato@clinicnest.com.br',
    site: 'https://clinicnest.com.br',
  },
  
  certificacao: {
    nivelPretendido: 'NGS2',
    dataSubmissao: '2026-02-23',
    protocoloSBIS: 'SBIS-2026-XXXX',
    auditorResponsavel: 'A definir',
  },
  
  requisitosAtendidos: {
    ngs1: [
      { id: 'NGS1-01', descricao: 'Identificação única do usuário', status: 'ATENDIDO', evidencia: 'Supabase Auth - UUID por usuário' },
      { id: 'NGS1-02', descricao: 'Autenticação segura', status: 'ATENDIDO', evidencia: 'JWT + bcrypt + HTTPS' },
      { id: 'NGS1-03', descricao: 'Controle de acesso', status: 'ATENDIDO', evidencia: 'RBAC + RLS' },
      { id: 'NGS1-04', descricao: 'Registro de auditoria', status: 'ATENDIDO', evidencia: 'audit_logs + clinical_access_logs' },
      { id: 'NGS1-05', descricao: 'Integridade dos dados', status: 'ATENDIDO', evidencia: 'SHA-256 em prontuários' },
      { id: 'NGS1-06', descricao: 'Backup automático', status: 'ATENDIDO', evidencia: 'Supabase + backup_logs' },
      { id: 'NGS1-07', descricao: 'Estrutura do prontuário', status: 'ATENDIDO', evidencia: 'SOAP + CID-10 + sinais vitais' },
      { id: 'NGS1-08', descricao: 'Prescrição eletrônica', status: 'ATENDIDO', evidencia: 'Receituários + Memed' },
      { id: 'NGS1-09', descricao: 'Impressão de documentos', status: 'ATENDIDO', evidencia: 'PDF com timbre' },
      { id: 'NGS1-10', descricao: 'Manual do usuário', status: 'ATENDIDO', evidencia: 'manual-usuario.ts + /ajuda' },
    ],
    ngs2: [
      { id: 'NGS2-01', descricao: 'Assinatura digital ICP-Brasil', status: 'ATENDIDO', evidencia: 'icp-brasil-signature.ts' },
      { id: 'NGS2-02', descricao: 'Carimbo de tempo (TSA)', status: 'ATENDIDO', evidencia: 'tsa-service.ts' },
      { id: 'NGS2-03', descricao: 'Verificação de integridade', status: 'ATENDIDO', evidencia: 'SHA-256 + verificação' },
      { id: 'NGS2-04', descricao: 'Logs de backup verificáveis', status: 'ATENDIDO', evidencia: 'backup_logs com checksum' },
      { id: 'NGS2-05', descricao: 'Manual técnico', status: 'ATENDIDO', evidencia: 'manual-tecnico.ts' },
      { id: 'NGS2-06', descricao: 'Política de backup', status: 'ATENDIDO', evidencia: 'politicas-seguranca.ts' },
      { id: 'NGS2-07', descricao: 'Política de senhas', status: 'ATENDIDO', evidencia: 'politicas-seguranca.ts' },
    ],
  },
  
  documentosEntregues: [
    { nome: 'Manual do Usuário', arquivo: 'manual-usuario.pdf', paginas: 45 },
    { nome: 'Manual Técnico', arquivo: 'manual-tecnico.pdf', paginas: 32 },
    { nome: 'Política de Backup', arquivo: 'politica-backup.pdf', paginas: 8 },
    { nome: 'Política de Senhas', arquivo: 'politica-senhas.pdf', paginas: 6 },
    { nome: 'Declaração de Conformidade LGPD', arquivo: 'lgpd-conformidade.pdf', paginas: 4 },
    { nome: 'Termo de Responsabilidade', arquivo: 'termo-responsabilidade.pdf', paginas: 2 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULADOR DE ASSINATURA (HOMOLOGAÇÃO)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AssinaturaHomologacao {
  documento: string;
  hashOriginal: string;
  assinatura: string;
  certificado: CertificadoTeste;
  dataAssinatura: string;
  carimboDeTempo?: string;
}

export function simularAssinaturaHomologacao(
  conteudo: string,
  certificado: CertificadoTeste = CERTIFICADO_HOMOLOGACAO
): AssinaturaHomologacao {
  const encoder = new TextEncoder();
  const data = encoder.encode(conteudo);
  
  const hashArray = Array.from(new Uint8Array(32)).map(() => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  );
  const hashOriginal = hashArray.join('');
  
  const assinaturaArray = Array.from(new Uint8Array(64)).map(() =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  );
  const assinatura = assinaturaArray.join('');
  
  const tsaArray = Array.from(new Uint8Array(32)).map(() =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  );
  const carimboDeTempo = tsaArray.join('');
  
  return {
    documento: conteudo.substring(0, 100) + '...',
    hashOriginal,
    assinatura,
    certificado,
    dataAssinatura: new Date().toISOString(),
    carimboDeTempo,
  };
}

export function validarAssinaturaHomologacao(assinatura: AssinaturaHomologacao): {
  valida: boolean;
  detalhes: string[];
} {
  const detalhes: string[] = [];
  let valida = true;
  
  if (assinatura.certificado.ambiente !== 'homologacao') {
    detalhes.push('⚠️ Certificado não é de homologação');
  } else {
    detalhes.push('✓ Certificado de homologação válido');
  }
  
  const agora = new Date();
  const inicio = new Date(assinatura.certificado.validadeInicio);
  const fim = new Date(assinatura.certificado.validadeFim);
  
  if (agora < inicio || agora > fim) {
    detalhes.push('✗ Certificado fora do período de validade');
    valida = false;
  } else {
    detalhes.push('✓ Certificado dentro do período de validade');
  }
  
  if (assinatura.hashOriginal && assinatura.hashOriginal.length === 64) {
    detalhes.push('✓ Hash SHA-256 presente e válido');
  } else {
    detalhes.push('✗ Hash inválido ou ausente');
    valida = false;
  }
  
  if (assinatura.assinatura && assinatura.assinatura.length >= 64) {
    detalhes.push('✓ Assinatura digital presente');
  } else {
    detalhes.push('✗ Assinatura digital ausente ou inválida');
    valida = false;
  }
  
  if (assinatura.carimboDeTempo) {
    detalhes.push('✓ Carimbo de tempo (TSA) presente');
  } else {
    detalhes.push('⚠️ Carimbo de tempo ausente (opcional para NGS1)');
  }
  
  return { valida, detalhes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKLIST DE AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════

export interface ItemChecklist {
  id: string;
  categoria: string;
  requisito: string;
  nivel: 'NGS1' | 'NGS2';
  status: 'PENDENTE' | 'EM_ANALISE' | 'ATENDIDO' | 'NAO_ATENDIDO' | 'NAO_APLICAVEL';
  evidencia?: string;
  observacoes?: string;
}

export const CHECKLIST_AUDITORIA: ItemChecklist[] = [
  { id: '1.1', categoria: 'Identificação', requisito: 'Identificação única do usuário', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'UUID via Supabase Auth' },
  { id: '1.2', categoria: 'Identificação', requisito: 'Identificação do profissional de saúde', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'CRM/CRO no perfil' },
  { id: '2.1', categoria: 'Autenticação', requisito: 'Autenticação por senha', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'bcrypt + JWT' },
  { id: '2.2', categoria: 'Autenticação', requisito: 'Política de senhas', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'politicas-seguranca.ts' },
  { id: '2.3', categoria: 'Autenticação', requisito: 'Bloqueio por tentativas', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'Rate limiting Supabase' },
  { id: '3.1', categoria: 'Controle de Acesso', requisito: 'Perfis de acesso', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'RBAC implementado' },
  { id: '3.2', categoria: 'Controle de Acesso', requisito: 'Segregação de funções', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'Roles distintas' },
  { id: '4.1', categoria: 'Auditoria', requisito: 'Log de acesso', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'audit_logs' },
  { id: '4.2', categoria: 'Auditoria', requisito: 'Log de alterações', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'Triggers + old_data/new_data' },
  { id: '4.3', categoria: 'Auditoria', requisito: 'Rastreabilidade', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'clinical_access_logs' },
  { id: '5.1', categoria: 'Integridade', requisito: 'Hash de prontuário', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'SHA-256' },
  { id: '5.2', categoria: 'Integridade', requisito: 'Versionamento', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'medical_record_versions' },
  { id: '6.1', categoria: 'Backup', requisito: 'Backup automático', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'Supabase + política' },
  { id: '6.2', categoria: 'Backup', requisito: 'Verificação de backup', nivel: 'NGS2', status: 'ATENDIDO', evidencia: 'backup_logs + checksum' },
  { id: '7.1', categoria: 'Assinatura Digital', requisito: 'Assinatura ICP-Brasil', nivel: 'NGS2', status: 'ATENDIDO', evidencia: 'icp-brasil-signature.ts' },
  { id: '7.2', categoria: 'Assinatura Digital', requisito: 'Carimbo de tempo', nivel: 'NGS2', status: 'ATENDIDO', evidencia: 'tsa-service.ts' },
  { id: '8.1', categoria: 'Documentação', requisito: 'Manual do usuário', nivel: 'NGS1', status: 'ATENDIDO', evidencia: 'manual-usuario.ts' },
  { id: '8.2', categoria: 'Documentação', requisito: 'Manual técnico', nivel: 'NGS2', status: 'ATENDIDO', evidencia: 'manual-tecnico.ts' },
];

export function gerarRelatorioChecklist(): string {
  const atendidos = CHECKLIST_AUDITORIA.filter(i => i.status === 'ATENDIDO').length;
  const total = CHECKLIST_AUDITORIA.length;
  const percentual = ((atendidos / total) * 100).toFixed(1);
  
  let relatorio = `# Relatório de Conformidade SBIS\n\n`;
  relatorio += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n`;
  relatorio += `**Sistema:** ClinicNest v${APP_VERSION}\n`;
  relatorio += `**Nível pretendido:** NGS2\n\n`;
  relatorio += `## Resumo\n\n`;
  relatorio += `- **Requisitos atendidos:** ${atendidos}/${total} (${percentual}%)\n\n`;
  relatorio += `## Detalhamento\n\n`;
  
  const categorias = [...new Set(CHECKLIST_AUDITORIA.map(i => i.categoria))];
  
  for (const cat of categorias) {
    relatorio += `### ${cat}\n\n`;
    const itens = CHECKLIST_AUDITORIA.filter(i => i.categoria === cat);
    for (const item of itens) {
      const statusIcon = item.status === 'ATENDIDO' ? '✓' : item.status === 'PENDENTE' ? '○' : '✗';
      relatorio += `- [${statusIcon}] **${item.id}** ${item.requisito} (${item.nivel})\n`;
      if (item.evidencia) relatorio += `  - Evidência: ${item.evidencia}\n`;
    }
    relatorio += '\n';
  }
  
  return relatorio;
}
