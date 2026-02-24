// Template de RIPD - Relatório de Impacto à Proteção de Dados Pessoais
// Conforme modelo ANPD (Autoridade Nacional de Proteção de Dados)

export interface RIPDIdentificacaoAgentes {
  controlador: {
    nome: string;
    cnpj: string;
    endereco: string;
    telefone: string;
    email: string;
  };
  encarregado: {
    nome: string;
    email: string;
    telefone: string;
  };
  operadores: Array<{
    nome: string;
    cnpj?: string;
    servico: string;
    dadosCompartilhados: string[];
  }>;
}

export interface RIPDDadosTratados {
  categoria: string;
  tiposDados: string[];
  titulares: string;
  volume: string;
  fontesColeta: string[];
  baseLegal: string;
  finalidade: string;
  retencao: string;
}

export interface RIPDRisco {
  id: string;
  descricao: string;
  probabilidade: 'baixa' | 'media' | 'alta';
  impacto: 'baixo' | 'medio' | 'alto';
  nivelRisco: 'baixo' | 'medio' | 'alto' | 'critico';
  medidaMitigacao: string;
  responsavel: string;
  prazo: string;
  status: 'pendente' | 'em_andamento' | 'implementado';
}

export interface RIPDMedida {
  tipo: 'tecnica' | 'administrativa';
  descricao: string;
  status: 'implementada' | 'em_implementacao' | 'planejada';
  evidencia?: string;
}

export interface RIPDData {
  versao: string;
  dataElaboracao: string;
  dataRevisao?: string;
  identificacaoAgentes: RIPDIdentificacaoAgentes;
  dadosTratados: RIPDDadosTratados[];
  riscos: RIPDRisco[];
  medidasTecnicas: RIPDMedida[];
  medidasAdministrativas: RIPDMedida[];
  conclusao: string;
  aprovadoPor?: string;
  dataAprovacao?: string;
}

// Template padrão para clínicas médicas
export const RIPD_TEMPLATE_CLINICA: Partial<RIPDData> = {
  versao: '1.0',
  dadosTratados: [
    {
      categoria: 'Dados de Identificação',
      tiposDados: ['Nome completo', 'CPF', 'RG', 'Data de nascimento', 'Sexo', 'Estado civil', 'Nacionalidade'],
      titulares: 'Pacientes',
      volume: 'Variável conforme demanda',
      fontesColeta: ['Cadastro presencial', 'Agendamento online', 'Portal do paciente'],
      baseLegal: 'Art. 7º, VIII - Tutela da saúde',
      finalidade: 'Identificação do paciente para prestação de serviços de saúde',
      retencao: '20 anos após último atendimento (CFM)',
    },
    {
      categoria: 'Dados de Contato',
      tiposDados: ['Endereço', 'Telefone', 'E-mail', 'Contato de emergência'],
      titulares: 'Pacientes',
      volume: 'Variável conforme demanda',
      fontesColeta: ['Cadastro presencial', 'Atualização pelo paciente'],
      baseLegal: 'Art. 7º, VIII - Tutela da saúde',
      finalidade: 'Comunicação sobre agendamentos, resultados e emergências',
      retencao: '20 anos após último atendimento',
    },
    {
      categoria: 'Dados Sensíveis de Saúde',
      tiposDados: ['Prontuário médico', 'Histórico de doenças', 'Alergias', 'Medicamentos', 'Exames', 'Diagnósticos (CID)', 'Evolução clínica'],
      titulares: 'Pacientes',
      volume: 'Variável conforme demanda',
      fontesColeta: ['Consultas médicas', 'Exames', 'Laudos', 'Encaminhamentos'],
      baseLegal: 'Art. 11, II, f - Tutela da saúde por profissionais de saúde',
      finalidade: 'Prestação de assistência à saúde, diagnóstico e tratamento',
      retencao: '20 anos após último atendimento (Resolução CFM 1.821/2007)',
    },
    {
      categoria: 'Dados Financeiros',
      tiposDados: ['Dados de pagamento', 'Convênio', 'Número da carteirinha'],
      titulares: 'Pacientes',
      volume: 'Variável conforme demanda',
      fontesColeta: ['Cadastro', 'Faturamento'],
      baseLegal: 'Art. 7º, V - Execução de contrato',
      finalidade: 'Cobrança e faturamento de serviços',
      retencao: '5 anos (prazo fiscal)',
    },
  ],
  riscos: [
    {
      id: 'R001',
      descricao: 'Acesso não autorizado a dados de saúde por funcionários sem necessidade',
      probabilidade: 'media',
      impacto: 'alto',
      nivelRisco: 'alto',
      medidaMitigacao: 'Implementar controle de acesso baseado em perfis (RBAC) com logs de auditoria',
      responsavel: 'TI / DPO',
      prazo: 'Implementado',
      status: 'implementado',
    },
    {
      id: 'R002',
      descricao: 'Vazamento de dados por ataque cibernético',
      probabilidade: 'baixa',
      impacto: 'alto',
      nivelRisco: 'medio',
      medidaMitigacao: 'Criptografia em trânsito (TLS) e em repouso, firewall, monitoramento',
      responsavel: 'TI',
      prazo: 'Implementado',
      status: 'implementado',
    },
    {
      id: 'R003',
      descricao: 'Perda de dados por falha de backup',
      probabilidade: 'baixa',
      impacto: 'alto',
      nivelRisco: 'medio',
      medidaMitigacao: 'Backup automático diário com verificação de integridade e teste de restauração',
      responsavel: 'TI',
      prazo: 'Implementado',
      status: 'implementado',
    },
    {
      id: 'R004',
      descricao: 'Compartilhamento indevido de dados com terceiros',
      probabilidade: 'baixa',
      impacto: 'alto',
      nivelRisco: 'medio',
      medidaMitigacao: 'Contratos com cláusulas de proteção de dados, DPA com operadores',
      responsavel: 'Jurídico / DPO',
      prazo: 'Em andamento',
      status: 'em_andamento',
    },
    {
      id: 'R005',
      descricao: 'Não atendimento a solicitações de titulares no prazo legal',
      probabilidade: 'media',
      impacto: 'medio',
      nivelRisco: 'medio',
      medidaMitigacao: 'Canal LGPD implementado, fluxo de atendimento definido, treinamento da equipe',
      responsavel: 'DPO',
      prazo: 'Implementado',
      status: 'implementado',
    },
  ],
  medidasTecnicas: [
    { tipo: 'tecnica', descricao: 'Criptografia de dados em trânsito (TLS 1.3)', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Criptografia de dados em repouso (AES-256)', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Controle de acesso baseado em perfis (RBAC)', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Autenticação multifator (MFA)', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Logs de auditoria de acesso a dados sensíveis', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Backup automático com verificação de integridade', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Firewall e proteção contra DDoS', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Anonimização de dados para relatórios estatísticos', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Timeout de sessão automático', status: 'implementada' },
    { tipo: 'tecnica', descricao: 'Assinatura digital de documentos clínicos', status: 'implementada' },
  ],
  medidasAdministrativas: [
    { tipo: 'administrativa', descricao: 'Política de Privacidade publicada e acessível', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Termos de Uso com cláusulas LGPD', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Nomeação de Encarregado (DPO)', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Canal de atendimento LGPD para titulares', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Treinamento de funcionários em proteção de dados', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Contratos com operadores incluindo cláusulas de proteção de dados', status: 'em_implementacao' },
    { tipo: 'administrativa', descricao: 'Procedimento de resposta a incidentes de segurança', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Revisão periódica de acessos e permissões', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Termo de confidencialidade para funcionários', status: 'implementada' },
    { tipo: 'administrativa', descricao: 'Procedimento de descarte seguro de dados', status: 'implementada' },
  ],
};

// Gerar HTML do RIPD para PDF
export function generateRIPDHTML(data: RIPDData, clinicName: string): string {
  const calcularNivelRisco = (prob: string, imp: string): string => {
    const matriz: Record<string, Record<string, string>> = {
      baixa: { baixo: 'baixo', medio: 'baixo', alto: 'medio' },
      media: { baixo: 'baixo', medio: 'medio', alto: 'alto' },
      alta: { baixo: 'medio', medio: 'alto', alto: 'critico' },
    };
    return matriz[prob]?.[imp] || 'medio';
  };

  const corNivelRisco = (nivel: string): string => {
    const cores: Record<string, string> = {
      baixo: '#22c55e',
      medio: '#eab308',
      alto: '#f97316',
      critico: '#ef4444',
    };
    return cores[nivel] || '#6b7280';
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>RIPD - ${clinicName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 30px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #1e40af; }
    .header h1 { color: #1e40af; font-size: 20pt; margin-bottom: 10px; }
    .header h2 { color: #64748b; font-size: 14pt; font-weight: normal; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; }
    .meta-item { text-align: center; }
    .meta-label { font-size: 9pt; color: #64748b; text-transform: uppercase; }
    .meta-value { font-weight: 600; color: #1e40af; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h3 { color: #1e40af; font-size: 14pt; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    .section h4 { color: #475569; font-size: 12pt; margin: 15px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    th, td { padding: 10px; text-align: left; border: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; color: #475569; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
    .badge-orange { background: #ffedd5; color: #9a3412; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .risk-matrix { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; max-width: 400px; margin: 20px auto; }
    .risk-cell { padding: 10px; text-align: center; font-size: 9pt; font-weight: 600; color: white; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
    .signature { margin-top: 60px; display: flex; justify-content: space-around; }
    .signature-box { text-align: center; width: 250px; }
    .signature-line { border-top: 1px solid #333; margin-bottom: 5px; }
    .signature-name { font-weight: 600; }
    .signature-role { font-size: 9pt; color: #64748b; }
    @media print { .container { max-width: 100%; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RELATÓRIO DE IMPACTO À PROTEÇÃO DE DADOS PESSOAIS</h1>
      <h2>${clinicName}</h2>
    </div>
    
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Versão</div>
        <div class="meta-value">${data.versao}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Data de Elaboração</div>
        <div class="meta-value">${data.dataElaboracao}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Próxima Revisão</div>
        <div class="meta-value">${data.dataRevisao || 'A definir'}</div>
      </div>
    </div>
    
    <div class="section">
      <h3>1. Identificação dos Agentes de Tratamento</h3>
      <h4>1.1 Controlador</h4>
      <table>
        <tr><th>Razão Social</th><td>${data.identificacaoAgentes.controlador.nome}</td></tr>
        <tr><th>CNPJ</th><td>${data.identificacaoAgentes.controlador.cnpj}</td></tr>
        <tr><th>Endereço</th><td>${data.identificacaoAgentes.controlador.endereco}</td></tr>
        <tr><th>Contato</th><td>${data.identificacaoAgentes.controlador.telefone} | ${data.identificacaoAgentes.controlador.email}</td></tr>
      </table>
      
      <h4>1.2 Encarregado (DPO)</h4>
      <table>
        <tr><th>Nome</th><td>${data.identificacaoAgentes.encarregado.nome}</td></tr>
        <tr><th>E-mail</th><td>${data.identificacaoAgentes.encarregado.email}</td></tr>
        <tr><th>Telefone</th><td>${data.identificacaoAgentes.encarregado.telefone}</td></tr>
      </table>
      
      ${data.identificacaoAgentes.operadores.length > 0 ? `
      <h4>1.3 Operadores</h4>
      <table>
        <tr><th>Nome</th><th>Serviço</th><th>Dados Compartilhados</th></tr>
        ${data.identificacaoAgentes.operadores.map(op => `
        <tr>
          <td>${op.nome}${op.cnpj ? ` (${op.cnpj})` : ''}</td>
          <td>${op.servico}</td>
          <td>${op.dadosCompartilhados.join(', ')}</td>
        </tr>
        `).join('')}
      </table>
      ` : ''}
    </div>
    
    <div class="section">
      <h3>2. Dados Pessoais Tratados</h3>
      <table>
        <tr>
          <th>Categoria</th>
          <th>Tipos de Dados</th>
          <th>Titulares</th>
          <th>Base Legal</th>
          <th>Finalidade</th>
          <th>Retenção</th>
        </tr>
        ${data.dadosTratados.map(d => `
        <tr>
          <td><strong>${d.categoria}</strong></td>
          <td>${d.tiposDados.join(', ')}</td>
          <td>${d.titulares}</td>
          <td>${d.baseLegal}</td>
          <td>${d.finalidade}</td>
          <td>${d.retencao}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="section">
      <h3>3. Análise de Riscos</h3>
      <table>
        <tr>
          <th>ID</th>
          <th>Risco</th>
          <th>Prob.</th>
          <th>Impacto</th>
          <th>Nível</th>
          <th>Medida de Mitigação</th>
          <th>Status</th>
        </tr>
        ${data.riscos.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.descricao}</td>
          <td>${r.probabilidade}</td>
          <td>${r.impacto}</td>
          <td><span class="badge badge-${r.nivelRisco === 'baixo' ? 'green' : r.nivelRisco === 'medio' ? 'yellow' : r.nivelRisco === 'alto' ? 'orange' : 'red'}">${r.nivelRisco.toUpperCase()}</span></td>
          <td>${r.medidaMitigacao}</td>
          <td><span class="badge badge-${r.status === 'implementado' ? 'green' : r.status === 'em_andamento' ? 'yellow' : 'orange'}">${r.status.replace('_', ' ')}</span></td>
        </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="section">
      <h3>4. Medidas de Segurança</h3>
      <h4>4.1 Medidas Técnicas</h4>
      <table>
        <tr><th>Medida</th><th>Status</th></tr>
        ${data.medidasTecnicas.map(m => `
        <tr>
          <td>${m.descricao}</td>
          <td><span class="badge badge-${m.status === 'implementada' ? 'green' : m.status === 'em_implementacao' ? 'yellow' : 'orange'}">${m.status.replace('_', ' ')}</span></td>
        </tr>
        `).join('')}
      </table>
      
      <h4>4.2 Medidas Administrativas</h4>
      <table>
        <tr><th>Medida</th><th>Status</th></tr>
        ${data.medidasAdministrativas.map(m => `
        <tr>
          <td>${m.descricao}</td>
          <td><span class="badge badge-${m.status === 'implementada' ? 'green' : m.status === 'em_implementacao' ? 'yellow' : 'orange'}">${m.status.replace('_', ' ')}</span></td>
        </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="section">
      <h3>5. Conclusão</h3>
      <p>${data.conclusao}</p>
    </div>
    
    <div class="footer">
      <div class="signature">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-name">${data.identificacaoAgentes.controlador.nome}</div>
          <div class="signature-role">Controlador</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-name">${data.identificacaoAgentes.encarregado.nome}</div>
          <div class="signature-role">Encarregado (DPO)</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
